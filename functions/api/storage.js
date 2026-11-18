const PREFIX = "testing/";
const BUCKET_DEFAULT = "xinling-media";

export function storageProvider(env) {
  if (env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) return "supabase";
  if (env.XINLING_MEDIA) return "r2";
  return null;
}

function supabaseConfig(env) {
  const base = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  const bucket = env.SUPABASE_STORAGE_BUCKET || BUCKET_DEFAULT;
  if (!base || !key) throw new Error("Supabase Storage is not configured");
  return { base, key, bucket };
}

async function throwSupabaseError(response, operation) {
  const raw = await response.text().catch(() => "");
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch {}
  const detail = parsed && typeof parsed === "object"
    ? [parsed.message, parsed.error_description, parsed.error, parsed.details, parsed.hint]
        .filter(value => typeof value === "string" && value.trim())
        .join(" | ")
    : raw;
  const error = new Error(detail || ("Supabase Storage " + operation + " failed"));
  error.status = response.status;
  error.detail = String(detail || error.message).slice(0, 1500);
  error.provider = "supabase";
  throw error;
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function supabaseFetch(env, path, init = {}) {
  const { base, key } = supabaseConfig(env);
  const headers = new Headers(init.headers || {});
  headers.set("apikey", key);
  headers.set("Authorization", "Bearer " + key);
  return fetch(base + "/storage/v1" + path, { ...init, headers });
}

export async function listAssets(env) {
  if (storageProvider(env) === "r2") {
    const result = await env.XINLING_MEDIA.list({ prefix: PREFIX, limit: 100, include: ["customMetadata", "httpMetadata"] });
    return {
      items: result.objects.map(obj => ({
        id: obj.key.slice(PREFIX.length),
        name: obj.customMetadata?.name || "未命名素材",
        kind: obj.customMetadata?.kind || kindFor(obj.httpMetadata?.contentType || ""),
        contentType: obj.httpMetadata?.contentType || "application/octet-stream",
        size: obj.size,
        uploaded: obj.uploaded ? obj.uploaded.toISOString() : null
      })),
      truncated: result.truncated,
      cursor: result.truncated ? result.cursor : null
    };
  }

  const { bucket } = supabaseConfig(env);
  const response = await supabaseFetch(env, "/object/list/" + encodeURIComponent(bucket), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prefix: PREFIX, limit: 100, offset: 0, sortBy: { column: "created_at", order: "desc" } })
  });
  if (!response.ok) await throwSupabaseError(response, "list");
  const rows = await response.json();
  const items = (Array.isArray(rows) ? rows : []).filter(row => row && row.name && row.id !== null).map(row => {
    const id = String(row.name);
    const split = id.match(/^([0-9a-f-]{36})--(.*)$/i);
    let name = "未命名素材";
    if (split) {
      try { name = decodeURIComponent(split[2]); } catch {}
    }
    const contentType = row.metadata?.mimetype || row.metadata?.contentType || "application/octet-stream";
    return {
      id,
      name,
      kind: kindFor(contentType),
      contentType,
      size: Number(row.metadata?.size || row.metadata?.contentLength || 0),
      uploaded: row.created_at || row.updated_at || null
    };
  });
  items.sort((a, b) => String(b.uploaded || "").localeCompare(String(a.uploaded || "")));
  return { items, truncated: false, cursor: null };
}

export async function putAsset(env, id, name, bytes, mime, kind) {
  const key = PREFIX + id;
  if (storageProvider(env) === "r2") {
    await env.XINLING_MEDIA.put(key, bytes, {
      httpMetadata: { contentType: mime, contentDisposition: "inline" },
      customMetadata: { name, kind, uploadedAt: new Date().toISOString(), stage: "internal-test" }
    });
    return;
  }
  const { bucket } = supabaseConfig(env);
  const response = await supabaseFetch(env, "/object/" + encodeURIComponent(bucket) + "/" + encodePath(key), {
    method: "POST",
    headers: { "content-type": mime, "x-upsert": "false", "cache-control": "3600" },
    body: bytes
  });
  if (!response.ok) await throwSupabaseError(response, "upload");
}

export async function getAsset(env, id) {
  const key = PREFIX + id;
  if (storageProvider(env) === "r2") {
    const object = await env.XINLING_MEDIA.get(key);
    if (!object) return null;
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Disposition", "inline");
    headers.set("ETag", object.httpEtag);
    return new Response(object.body, { headers });
  }
  const { bucket } = supabaseConfig(env);
  const response = await supabaseFetch(env, "/object/" + encodeURIComponent(bucket) + "/" + encodePath(key), { method: "GET" });
  if (response.status === 404) return null;
  if (!response.ok) await throwSupabaseError(response, "download");
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", "inline");
  headers.delete("content-length");
  return new Response(response.body, { status: 200, headers });
}

export async function deleteAsset(env, id) {
  const key = PREFIX + id;
  if (storageProvider(env) === "r2") {
    await env.XINLING_MEDIA.delete(key);
    return;
  }
  const { bucket } = supabaseConfig(env);
  const response = await supabaseFetch(env, "/object/" + encodeURIComponent(bucket), {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prefixes: [key] })
  });
  if (!response.ok) await throwSupabaseError(response, "delete");
}

export function kindFor(mime) {
  if (String(mime).startsWith("image/")) return "image";
  if (String(mime).startsWith("video/")) return "video";
  return "model";
}
