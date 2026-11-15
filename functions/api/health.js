const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    ok: true,
    service: "xinling-api",
    deepseekConfigured: Boolean(env.DEEPSEEK_API_KEY),
    accessGateConfigured: Boolean(env.APP_TEST_KEY),
    cloudStorageConfigured: Boolean(env.XINLING_MEDIA),
    message: "鑫灵 API 状态已检查"
  }), { headers: HEADERS });
}
