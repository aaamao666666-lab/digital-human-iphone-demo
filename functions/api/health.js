import { storageProvider } from "./storage.js";

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export function onRequestGet({ env }) {
  const provider = storageProvider(env);
  return new Response(JSON.stringify({
    ok: true,
    service: "xinling-api",
    deepseekConfigured: Boolean(env.DEEPSEEK_API_KEY),
    geminiConfigured: Boolean(env.GEMINI_API_KEY),
    accessGateConfigured: Boolean(env.APP_TEST_KEY),
    cloudStorageConfigured: Boolean(provider),
    storageProvider: provider || "未连接",
    message: "鑫灵 API 状态已检查"
  }), { headers: HEADERS });
}
