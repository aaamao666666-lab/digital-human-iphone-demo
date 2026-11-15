const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    ok: true,
    service: "xinling-api",
    deepseekConfigured: Boolean(env.DEEPSEEK_API_KEY),
    accessGateConfigured: Boolean(env.APP_TEST_KEY),
    message: "鑫灵 API 在线"
  }), { headers: HEADERS });
}
