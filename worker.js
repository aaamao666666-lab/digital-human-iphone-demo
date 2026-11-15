import { onRequestGet as healthGet } from "./functions/api/health.js";
import {
  onRequestGet as assetsListGet,
  onRequestPost as assetsUploadPost
} from "./functions/api/assets.js";
import { onRequestPost as chatPost } from "./functions/api/chat.js";
import {
  onRequestGet as assetGet,
  onRequestDelete as assetDelete
} from "./functions/api/assets/[assetId].js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(payload, status = 404, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function methodNotAllowed(allowed) {
  return json(
    { error: "请求方法不支持。" },
    405,
    { allow: allowed.join(", ") }
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/api/health") {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return healthGet({ request, env, params: {}, waitUntil: p => ctx.waitUntil(p) });
    }

    if (path === "/api/chat") {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      return chatPost({ request, env, params: {}, waitUntil: p => ctx.waitUntil(p) });
    }

    if (path === "/api/assets") {
      if (request.method === "GET") {
        return assetsListGet({ request, env, params: {}, waitUntil: p => ctx.waitUntil(p) });
      }
      if (request.method === "POST") {
        return assetsUploadPost({ request, env, params: {}, waitUntil: p => ctx.waitUntil(p) });
      }
      return methodNotAllowed(["GET", "POST"]);
    }

    const assetMatch = path.match(/^\/api\/assets\/([^/]+)$/);
    if (assetMatch) {
      let assetId;
      try {
        assetId = decodeURIComponent(assetMatch[1]);
      } catch {
        return json({ error: "素材编号无效。" }, 400);
      }
      const params = { assetId };
      if (request.method === "GET") {
        return assetGet({ request, env, params, waitUntil: p => ctx.waitUntil(p) });
      }
      if (request.method === "DELETE") {
        return assetDelete({ request, env, params, waitUntil: p => ctx.waitUntil(p) });
      }
      return methodNotAllowed(["GET", "DELETE"]);
    }

    if (path.startsWith("/api/")) {
      return json({ error: "接口不存在。" }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
