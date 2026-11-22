#!/usr/bin/env node
/**
 * 鑫灵 AI 云端素材库端到端冒烟测试
 *
 * 用法：
 *   APP_BASE_URL="https://你的-worker.workers.dev" APP_TEST_KEY="你的测试口令" node scripts/storage-smoke-test.mjs
 *
 * 测试会上传一个 1x1 PNG 临时文件，并在结束时尝试删除它。
 * 不会输出或保存测试口令。请只对自己的测试环境运行。
 */
import assert from "node:assert/strict";

const base = (process.env.APP_BASE_URL || "https://digital-human-iphone-demo.aaamao666666.workers.dev").replace(/\/+$/, "");
const key = process.env.APP_TEST_KEY || "";
if (!key) {
  console.error("缺少 APP_TEST_KEY。请在本机环境变量中设置，不要把口令写进代码或发到聊天里。");
  process.exit(2);
}

const headers = { "x-app-access-key": key };
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l0sAAAAASUVORK5CYII=",
  "base64"
);
let uploadedId = null;

async function expectStatus(response, status, label) {
  if (response.status !== status) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${label}: 预期 HTTP ${status}，实际 ${response.status}。 ${detail.slice(0, 300)}`);
  }
}

try {
  const healthResponse = await fetch(base + "/api/health", { cache: "no-store" });
  await expectStatus(healthResponse, 200, "健康检查");
  const health = await healthResponse.json();
  assert.equal(health.ok, true, "API 未报告 ok=true");
  assert.equal(health.cloudStorageConfigured, true, "云端存储尚未配置");
  if (health.cloudStorageReachable !== true || health.storageStatus !== "connected") {
    const diagnostic = health.storageError
      ? `HTTP ${health.storageError.status || "未知"}：${health.storageError.detail || "无详细信息"}`
      : `storageStatus=${health.storageStatus || "缺失"}`;
    throw new Error(`云端存储配置存在，但实时连接探测未通过。${diagnostic}`);
  }
  console.log(`✓ API 健康检查与云端存储实时连通（${health.storageProvider || "unknown"}）`);

  const denied = await fetch(base + "/api/assets", { cache: "no-store" });
  await expectStatus(denied, 401, "未授权访问保护");
  console.log("✓ 未授权素材列表请求被拒绝");

  const upload = await fetch(base + "/api/assets", {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "image/png",
      "x-file-name": encodeURIComponent("xinling-storage-smoke-test.png")
    },
    body: png
  });
  await expectStatus(upload, 201, "上传临时 PNG");
  const uploadData = await upload.json();
  assert.equal(uploadData.ok, true);
  uploadedId = uploadData.item?.id;
  assert.ok(uploadedId, "上传响应缺少素材 ID");
  console.log("✓ 上传临时素材");

  const download = await fetch(base + "/api/assets/" + encodeURIComponent(uploadedId), { headers, cache: "no-store" });
  await expectStatus(download, 200, "下载临时 PNG");
  const downloaded = Buffer.from(await download.arrayBuffer());
  assert.deepEqual(downloaded, png, "下载内容与上传内容不一致");
  console.log("✓ 下载内容与原始文件一致");

  const listResponse = await fetch(base + "/api/assets", { headers, cache: "no-store" });
  await expectStatus(listResponse, 200, "素材列表");
  const list = await listResponse.json();
  assert.ok(Array.isArray(list.items) && list.items.some(item => item.id === uploadedId), "列表中找不到刚上传的临时素材");
  console.log("✓ 素材列表可查到上传文件");

  const remove = await fetch(base + "/api/assets/" + encodeURIComponent(uploadedId), { method: "DELETE", headers });
  await expectStatus(remove, 200, "删除临时 PNG");
  uploadedId = null;
  console.log("✓ 删除临时素材");
  console.log("全部云端素材库冒烟测试通过。");
} catch (error) {
  console.error("测试失败：", error.message || error);
  process.exitCode = 1;
} finally {
  if (uploadedId) {
    try {
      const cleanup = await fetch(base + "/api/assets/" + encodeURIComponent(uploadedId), { method: "DELETE", headers });
      if (cleanup.ok) console.log("✓ 已清理测试临时文件");
      else console.error("警告：临时文件未能自动清理，请在素材库中删除：", uploadedId);
    } catch {
      console.error("警告：清理请求失败，请在素材库中删除临时文件：", uploadedId);
    }
  }
}
