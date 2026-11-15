> **当前部署方式已更新：** 本仓库现在优先使用 Cloudflare Workers Builds（Worker + Static Assets），请先看 [`WORKER_DEPLOYMENT.md`](./WORKER_DEPLOYMENT.md)。本文后续的 Pages Functions 部署说明是旧方案，不要与当前 Worker 部署设置混用。\n\n# 鑫灵 AI 后端与云端素材库（Cloudflare Pages Functions）

## 测试版接口
- `GET /api/health`：检查 DeepSeek、内部测试口令、R2 云存储绑定状态。
- `POST /api/chat`：服务端安全调用 DeepSeek。API Key 只保存在 Cloudflare Secret。
- `POST /api/assets`：照片、视频、GLB/GLTF 上传到私有 R2 存储桶，单文件上限 50 MB。
- `GET /api/assets`：列出内部测试素材。
- `GET /api/assets/:assetId`：通过鉴权读取单个云端文件。
- `DELETE /api/assets/:assetId`：删除云端素材。

所有测试素材保存在 `testing/` 前缀。存储桶必须保持 Private，不开启 Public Bucket 或 `r2.dev`。上传、读取、列表、删除都要求 HTTP Header `x-app-access-key`。

## 一次性部署步骤

### A. 建立 Cloudflare Pages 网站
1. 登录 Cloudflare Dashboard，进入 **Workers & Pages → Create application → Pages → Connect to Git**。
2. 连接 GitHub 账号，只选择仓库 `aaamao666666-lab/digital-human-iphone-demo`。
3. Production branch 选择 `1主要的`。
4. Build settings：Framework preset 选 **None**；Build command 填 `exit 0`；Build output directory 填 `.`；Root directory 保持仓库根目录。
5. 保存并首次部署。Cloudflare Pages 成功后会给一个 `*.pages.dev` 网站地址；后端 API 只在这个 Cloudflare 地址工作，旧 GitHub Pages 地址仍然只是静态托管。

### B. 创建私有云端素材库
1. 在 Cloudflare Dashboard 打开 **R2 Object Storage**，创建一个 Standard 存储桶，例如 `xinling-private-media`。
2. 不要开启 Public Bucket，不要启用 `r2.dev`。
3. 回到 **Workers & Pages → 你的 Pages 项目 → Settings → Bindings → Add → R2 bucket**。
4. Variable name 必须填写 `XINLING_MEDIA`，选择刚建立的存储桶，保存后重新部署。

### C. 添加服务端 Secrets
在 Pages 项目 **Settings → Variables and Secrets → Production** 添加以下两个 Secret（不要选普通明文变量）：
- `APP_TEST_KEY`：内部测试专用的随机长口令。请自己生成并保存，不要发到聊天里。
- `DEEPSEEK_API_KEY`：你的 DeepSeek API Key。只粘贴到 Cloudflare Secret 输入框，不要放进 GitHub 或网页源码。

保存并重新部署。

### D. 验证
打开新 Cloudflare Pages 地址后，进入工作台：
1. 在“内部测试访问”输入你自己设置的 `APP_TEST_KEY`，点“保存并连接”。
2. 后端状态应显示“云端后端在线 · 私有素材库已连接”。
3. 选择一张测试照片或小视频，上传状态应显示“已上传到云端素材库”。
4. 在“我的云端素材”确认能看到文件，点“查看”能预览，点“删除”能从 R2 移除。
5. 配置 DeepSeek Secret 后，对话区才可以真实调用模型。

## 成本与限制
Cloudflare R2 Standard 当前每月包含 10 GB-month 存储、100 万次 Class A 操作、1000 万次 Class B 操作，公网出站流量免费；超出额度会按官方价格计费。当前接口单文件上限为 50 MB。Cloudflare Workers/Pages Functions 免费档也有每日请求和 CPU 限制。免费额度不是无限服务，需留意使用量。

## 安全边界
这是使用一个共享测试口令的单人内部测试版，不是正式用户账户系统。当前所有获准使用同一测试口令的人都能查看和删除该测试桶里的素材。不要公开推广，也不要放身份证、银行卡或第三方敏感资料。开放普通用户之前，必须加入真正的用户登录、每用户独立对象前缀与数据库权限、配额、审计和删除机制。
