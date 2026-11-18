import { storageProvider, listAssets, putAsset, kindFor } from "./storage.js";

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const MAX_BYTES = 50 * 1024 * 1024;

function json(data, status=200) { return new Response(JSON.stringify(data), { status, headers: HEADERS }); }
function authorized(request, env) {
  const expected = env.APP_TEST_KEY || "";
  const supplied = request.headers.get("x-app-access-key") || "";
  if (!expected || supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i=0;i<expected.length;i++) diff |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return diff === 0;
}
function storageErrorResponse(error, fallback) {
  const status = Number(error?.status);
  const httpStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
  const detail = String(error?.detail || error?.message || fallback).slice(0, 1500);
  console.error("Cloud storage operation failed", {
    provider: error?.provider || "unknown",
    status: httpStatus,
    detail
  });
  return json({
    error: fallback,
    upstreamStatus: error?.provider === "supabase" ? httpStatus : undefined,
    detail
  }, httpStatus);
}
function safeName(value) {
  return String(value || "upload").replace(/[\/\\\u0000-\u001f\u007f]/g, "_").slice(0,160) || "upload";
}

export async function onRequestGet({ request, env }) {
  if (!authorized(request, env)) return json({ error:"未授权。请输入内部测试口令。" }, 401);
  if (!storageProvider(env)) return json({ error:"云端素材库尚未连接。请配置 R2 或 Supabase Storage。" }, 503);
  try { return json(await listAssets(env)); }
  catch (error) {
    return storageErrorResponse(error, "读取云端素材库失败。");
  }
}

export async function onRequestPost({ request, env }) {
  if (!authorized(request, env)) return json({ error:"未授权。请先填写内部测试口令。" }, 401);
  if (!storageProvider(env)) return json({ error:"云端素材库尚未连接。请配置 R2 或 Supabase Storage。" }, 503);

  let decodedName = "upload";
  try { decodedName = decodeURIComponent(request.headers.get("x-file-name") || "upload"); } catch {}
  const name = safeName(decodedName);
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const MIME_BY_EXT = {
    jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp", gif:"image/gif",
    mp4:"video/mp4", mov:"video/quicktime", webm:"video/webm",
    glb:"model/gltf-binary", gltf:"model/gltf+json"
  };
  const mime = MIME_BY_EXT[ext];
  if (!mime) return json({ error:"目前只支持 JPG、PNG、WEBP、GIF、MP4、MOV、WEBM、GLB、GLTF 文件。" }, 415);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES) return json({ error:"单个文件不能超过 50 MB，请先压缩后再上传。" }, 413);

  try {
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) return json({ error:"文件内容为空。" }, 400);
    if (bytes.byteLength > MAX_BYTES) return json({ error:"单个文件不能超过 50 MB，请先压缩后再上传。" }, 413);
    const uuid = crypto.randomUUID();
    const id = uuid + "--" + encodeURIComponent(name);
    const kind = kindFor(mime);
    await putAsset(env, id, name, bytes, mime, kind);
    return json({ ok:true, item:{ id, name, kind, contentType:mime, size:bytes.byteLength } }, 201);
  } catch (error) {
    return storageErrorResponse(error, "上传到云端失败。");
  }
}
