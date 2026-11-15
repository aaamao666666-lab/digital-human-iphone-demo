# 鑫灵 AI：Cloudflare Workers 部署设置

本仓库当前使用 **Cloudflare Workers Builds + Static Assets** 部署，不使用 Pages Functions 直接托管。`worker.js` 将现有 API 模块接入 Worker 路由，`wrangler.jsonc` 负责静态文件与 API 路由。

## Git 连接页面参数

- 项目名称：`digital-human-iphone-demo`（必须与 wrangler.jsonc 中的 name 一致）
- GitHub 仓库：`aaamao666666-lab/digital-human-iphone-demo`
- 生产分支：`1主要的`
- 根目录：仓库根目录（`/`）
- 构建命令：留空（项目没有独立前端构建步骤）
- 部署命令：`npx wrangler deploy`
- 预览命令：`npx wrangler preview`

不要把项目设成静态 Pages 构建，也不要用 `exit 0` 替换部署命令。Workers Builds 的部署命令需要运行 Wrangler。Wrangler 版本由 `package.json` 管理。

## 部署完成后需要配置的云端资源

### 1. 私有 R2 存储桶
创建 Standard 存储桶，例如 `xinling-private-media`。保持 Private，不启用 Public Bucket 或 `r2.dev`。

在 Worker 的设置中添加 R2 Bucket 绑定：
- 变量名称：`XINLING_MEDIA`
- 存储桶：`xinling-private-media`（以实际创建的桶名为准）

### 2. 运行时 Secrets
在 Worker 的 Variables & Secrets / 变量和机密中添加 Production Secrets：
- `APP_TEST_KEY`：内部测试随机口令，由项目管理员生成并保管。
- `DEEPSEEK_API_KEY`：用户自己的 DeepSeek API Key，只粘贴到 Cloudflare Secret，不要放到 GitHub 或网页端。

不要在聊天中发送或提交任何密钥。

### 3. 验证
部署后打开：
- `https://<你的-worker>.workers.dev/`：网站首页
- `https://<你的-worker>.workers.dev/api/health`：后端状态检查

健康检查字段：
- `deepseekConfigured`：DeepSeek Secret 是否存在
- `accessGateConfigured`：内部测试口令是否存在
- `cloudStorageConfigured`：R2 绑定是否存在

未配置密钥或 R2 时，对应功能会明确返回未配置，不代表已可用。

## 安全和费用
- `functions/` 中的服务端代码不会作为公开静态文件上传。
- R2 必须保持私有；当前测试口令是共享测试门禁，不是正式用户账户系统。
- 不启用付费升级、不添加付款方式。免费额度和账户要求以 Cloudflare 控制台当时显示为准。
