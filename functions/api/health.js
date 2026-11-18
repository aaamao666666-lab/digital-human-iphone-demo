import { storageProvider, checkStorageConnection } from "./storage.js";

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export async function onRequestGet({ env }) {
  const provider = storageProvider(env);
  const storageCheck = await checkStorageConnection(env);
  return new Response(JSON.stringify({
    ok: true,
    service: "xinling-api",
    deepseekConfigured: Boolean(env.DEEPSEEK_API_KEY),
    meshyConfigured: Boolean(env.MESHY_API_KEY),
    accessGateConfigured: Boolean(env.APP_TEST_KEY),
    cloudStorageConfigured: Boolean(provider),
    cloudStorageReachable: storageCheck.ok,
    storageStatus: storageCheck.ok ? "connected" : (provider ? "error" : "not_configured"),
    storageError: storageCheck.ok ? null : { status: storageCheck.status, detail: storageCheck.detail },
    storageProvider: provider || "未连接",
    message: "鑫灵 API 状态已检查"
  }), { headers: HEADERS });
}
