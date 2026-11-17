const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function reply(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function safeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) return null;
  const clean = [];
  for (const item of messages) {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") return null;
    const content = item.content.trim();
    if (!content || content.length > 6000) return null;
    clean.push({ role: item.role, content });
  }
  return clean;
}

function authorized(request, env) {
  const expected = env.APP_TEST_KEY || "";
  const supplied = request.headers.get("x-app-access-key") || "";
  if (!expected || supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return diff === 0;
}

async function askDeepSeek(env, messages) {
  if (!env.DEEPSEEK_API_KEY) return reply({ error: "后端尚未配置 DeepSeek 密钥。" }, 503);
  const upstream = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "authorization": "Bearer " + env.DEEPSEEK_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: "你是鑫灵 AI 数字人平台的中文创作助手。回答清晰、友好、务实；不要声称尚未实现的功能已经可用。" },
        ...messages
      ],
      stream: false,
      max_tokens: 1200,
      temperature: 0.7
    })
  });
  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error("DeepSeek upstream error", upstream.status, detail.slice(0, 1000));
    return reply({ error: "DeepSeek 服务暂时没有成功响应（" + upstream.status + "）。请检查密钥和账户额度。" }, 502);
  }
  const data = await upstream.json().catch(() => null);
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) return reply({ error: "DeepSeek 没有返回文字内容。" }, 502);
  return reply({ reply: answer.trim(), provider: "deepseek", usage: data.usage || null });
}

async function askGemini(env, messages) {
  if (!env.GEMINI_API_KEY) return reply({ error: "Gemini 尚未配置。请在 Cloudflare Worker Secrets 添加 GEMINI_API_KEY。" }, 503);
  const input = messages.map(item => ({
    type: item.role === "user" ? "user_input" : "model_output",
    content: [{ type: "text", text: item.content }]
  }));
  const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      model: env.GEMINI_MODEL || "gemini-flash-latest",
      input,
      system_instruction: "你是鑫灵 AI 数字人平台的中文创作助手。回答清晰、友好、务实；不要声称尚未实现的功能已经可用。",
      store: false
    })
  });
  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error("Gemini upstream error", upstream.status, detail.slice(0, 1000));
    return reply({ error: "Gemini 服务暂时没有成功响应（" + upstream.status + "）。请检查 API Key、模型权限和额度。" }, 502);
  }
  const data = await upstream.json().catch(() => null);
  const answer = (data?.steps || [])
    .filter(step => step?.type === "model_output")
    .flatMap(step => Array.isArray(step.content) ? step.content : [])
    .filter(part => part?.type === "text" && typeof part.text === "string")
    .map(part => part.text)
    .join("\n")
    .trim();
  if (!answer) return reply({ error: "Gemini 没有返回文字内容。" }, 502);
  return reply({ reply: answer, provider: "gemini", usage: data.usage || null });
}

export async function onRequestPost({ request, env }) {
  if (!env.APP_TEST_KEY) return reply({ error: "后端尚未配置内部测试口令。" }, 503);
  if (!authorized(request, env)) return reply({ error: "测试口令不正确，或尚未配置。" }, 401);

  let body;
  try { body = await request.json(); } catch { return reply({ error: "请求格式不正确。" }, 400); }
  const messages = safeMessages(body.messages);
  if (!messages) return reply({ error: "对话内容无效；每次最多发送 12 条消息。" }, 400);

  const provider = body.provider === "gemini" ? "gemini" : "deepseek";
  try {
    return provider === "gemini" ? await askGemini(env, messages) : await askDeepSeek(env, messages);
  } catch (error) {
    console.error(provider + " request failed", error);
    return reply({ error: provider === "gemini" ? "Gemini 网络请求失败，请稍后重试。" : "DeepSeek 网络请求失败，请稍后重试。" }, 502);
  }
}
