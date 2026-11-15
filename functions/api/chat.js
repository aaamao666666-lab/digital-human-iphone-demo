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

export async function onRequestPost({ request, env }) {
  if (!env.DEEPSEEK_API_KEY) return reply({ error: "后端尚未配置 DeepSeek 密钥。" }, 503);
  if (!env.APP_TEST_KEY) return reply({ error: "后端尚未配置内部测试口令。" }, 503);

  const supplied = request.headers.get("x-app-access-key") || "";
  if (supplied.length !== env.APP_TEST_KEY.length || supplied !== env.APP_TEST_KEY) {
    return reply({ error: "测试口令不正确，或尚未配置。" }, 401);
  }

  let body;
  try { body = await request.json(); } catch { return reply({ error: "请求格式不正确。" }, 400); }
  const messages = safeMessages(body.messages);
  if (!messages) return reply({ error: "对话内容无效；每次最多发送 12 条消息。" }, 400);

  const upstream = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "authorization": "Bearer " + env.DEEPSEEK_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek-flash",
      messages: [
        { role: "system", content: "你是鑫灵 AI 数字人平台的中文创作助手。回答清晰、友好、务实；不要声称尚未实现的功能已经可用。" },
        ...messages
      ],
      thinking: { type: "disabled" },
      stream: false,
      max_tokens: 1200,
      temperature: 0.7
    })
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error("DeepSeek upstream error", upstream.status, detail.slice(0, 1200));
    return reply({ error: "DeepSeek 服务暂时没有成功响应（" + upstream.status + "）。请检查密钥和账户额度。" }, 502);
  }

  let data;
  try { data = await upstream.json(); } catch {
    return reply({ error: "DeepSeek 返回的数据无法解析。" }, 502);
  }
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) return reply({ error: "DeepSeek 没有返回文字内容。" }, 502);
  return reply({ reply: answer.trim(), usage: data.usage || null });
}
