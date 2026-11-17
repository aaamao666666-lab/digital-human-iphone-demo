# 鑫灵 AI：Cloudflare Workers 部署设置

本仓库当前使用 **Cloudflare Workers Builds + Static Assets**，不是 GitHub Pages，也不是旧版 Pages Functions。worker.js 负责 API 路由，wrangler.jsonc 负责静态资源。

## Git 连接参数

- 项目名称：digital-human-iphone-demo
- GitHub 仓库：aaamao666666-lab/digital-human-iphone-demo
- 生产分支：1主要的
- 根目录：仓库根目录（/）
- 构建命令：留空
- 部署命令：npx wrangler deploy
- 预览命令：npx wrangler preview

不要改成静态 Pages 构建，也不要用 exit 0 替代部署命令。Wrangler 版本由 package.json 管理。生产分支有新提交时，已连接的 Workers Builds 会按项目设置触发部署。

## 私有云端存储（二选一）

后端同时支持 **Supabase Storage** 和 **Cloudflare R2**。代码优先使用 Supabase；没有完整 Supabase 配置时才回退到 R2。

### 方案 A：Supabase Storage（当前代码优先）

1. 在 Supabase 创建 Storage bucket，建议命名 xinling-media。
2. bucket 必须保持 **Private**，不要开启公开访问。
3. 在 Cloudflare Worker 的 **Settings → Variables and Secrets** 配置：
   - SUPABASE_URL：Supabase 项目 URL（普通变量即可）。
   - SUPABASE_SECRET_KEY：Supabase Secret Key（Secret）。
   - 如果项目使用旧版服务密钥名称，也可使用 SUPABASE_SERVICE_ROLE_KEY（Secret）。
   - 如果 bucket 不是 xinling-media，再设置 SUPABASE_STORAGE_BUCKET 为实际名称。
4. 保存后重新部署 Worker。

### 方案 B：Cloudflare R2

1. 创建 Standard bucket，保持 **Private**，不要开启 Public Bucket 或 r2.dev。
2. 在 Worker 的 **Settings → Bindings** 添加 R2 Bucket：
   - 变量名称：XINLING_MEDIA
   - 绑定到刚创建的私有 bucket。
3. 保存后重新部署 Worker。

## 运行时 Secrets

在 Worker 的 **Settings → Variables and Secrets** 中添加 Production Secrets：

- APP_TEST_KEY：内部测试随机口令，由项目管理员自行生成并保管。
- DEEPSEEK_API_KEY：DeepSeek API Key，只保存在服务端 Secret。
- GEMINI_API_KEY：Google AI Studio 创建的 Gemini API Key（可选，只保存在服务端 Secret）。
- GEMINI_MODEL：可选普通变量，默认 `gemini-flash-latest`；按 Google 当前可用模型调整。
- DEEPSEEK_MODEL：可选普通变量，默认 `deepseek-chat`。

不要把任何密钥写入网页、GitHub 仓库或聊天消息。

## 验证

部署后打开：

- https://<你的-worker>.workers.dev/：网站首页
- https://<你的-worker>.workers.dev/api/health：后端状态

健康检查字段：

- deepseekConfigured：DeepSeek Secret 是否存在。
- geminiConfigured：Gemini Secret 是否存在。
- accessGateConfigured：内部测试口令是否存在。
- cloudStorageConfigured：Supabase 或 R2 是否已连接。
- storageProvider：当前使用 supabase、r2 或 未连接。

只有 cloudStorageConfigured: true 才代表云端素材库已连接。Worker 首页能打开，不代表照片、视频或模型上传已经可用。

### 云端素材库端到端测试

仓库提供 `scripts/storage-smoke-test.mjs`，会依次验证健康检查、未授权请求拦截、临时 PNG 上传、下载校验、列表读取和删除清理。请在自己的电脑终端执行（不要把测试口令写进文件或发到聊天里）：

```bash
APP_BASE_URL="https://你的-worker.workers.dev" APP_TEST_KEY="你的内部测试口令" npm run test:storage
```

测试成功会显示全部步骤通过；若失败，会显示具体失败步骤。测试结束会自动删除临时文件；若网络中断导致清理失败，请到素材库手动删除名称为 `xinling-storage-smoke-test.png` 的测试文件。

## 安全与费用

- 上传对象保存在私有 bucket；不要启用公开桶。
- 当前 APP_TEST_KEY 是共享测试门禁，不是正式用户账户系统。正式开放前还需要用户登录、每人独立授权和删除策略。
- 只处理本人或已取得明确授权的照片、视频和模型。
- 不启用付费升级、不添加付款方式；免费额度和账户要求以服务商控制台当时显示为准。
