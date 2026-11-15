# 鑫灵 AI 后端与云端素材库（Cloudflare Pages Functions）

## 测试版功能
- `GET /api/health`：检查 DeepSeek、内部测试口令、R2 云存储绑定状态。
- `POST /api/chat`：服务端安全调用 DeepSeek。API Key 只保存在 Cloudflare Secret。
- `POST /api/assets`：把照片、视频、GLB/GLTF 文件上传到私有 R2 存储桶（单文件上限 50 MB）。
- `GET /api/assets`：列出内部测试素材。
- `GET /api/assets/:assetId`：通过鉴权读取单个云端文件。
- `DELETE /api/assets/:assetId`：删除云端素材。

所有素材对象放在 `testing/` 前缀下，R2 桶保持私有，不开启 Public Bucket / r2.dev。读取、列表、删除和上传都必须提供 `x-app-access-key`。

## Cloudflare Pages 配置（一次性）
1. 在 Cloudflare 创建 Pages 项目，连接 GitHub 仓库 `aaamao666666-lab/digital-human-iphone-demo`，生产分支选 `1主要的`。Framework preset 选 None，Build command 留空，Build output directory 设为仓库根目录（控制台一般填 `/` 或 `.`，以创建页面显示的说明为准）。
2. 在 Cloudflare R2 创建 Standard 存储桶（例如 `xinling-private-media`）。
3. 在 Pages 项目 Settings → Bindings → Add → R2 bucket，变量名必须填 `XINLING_MEDIA`，选择刚建立的存储桶，保存后重新部署。保持桶为 Private，不能开启 Public Bucket。
4. 在 Settings → Variables and Secrets → Production 添加两个 Secret：
   - `APP_TEST_KEY`：你自己生成一个长的随机内部测试口令。
   - `DEEPSEEK_API_KEY`：DeepSeek API Key。
5. 保存并重新部署，打开 `/api/health`，确认 `cloudStorageConfigured` 和 `accessGateConfigured` 都是 true。

## 成本与限制
Cloudflare R2 Standard 当前有每月 10 GB-month 存储、每月 100 万次 Class A、1000 万次 Class B 免费额度，互联网出站流量免费。超过免费额度会按官方价计费；这不是无限免费服务。Workers Free 有每日请求和 CPU 等限制。详情以 Cloudflare 官方定价页为准。

## 安全边界
这是一个共用内部测试口令的单人测试版，不等于正式用户账户系统。不要把站点公开推广，也不要用它保存敏感证件或第三方私人资料。以后开放普通用户前，必须加入真实登录、每用户独立对象前缀和数据库权限、上传配额、审计与删除机制。
