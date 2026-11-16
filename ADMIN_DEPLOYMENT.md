# 鑫灵 AI 独立后台部署说明

- 管理后台 Worker：`xinling-admin`
- Wrangler 配置：`wrangler.admin.jsonc`
- 管理页面入口：`admin-site/index.html`
- API 仍由主 Worker 提供：`https://digital-human-iphone-demo.aaamao666666.workers.dev`
- 普通客户端不再展示后台入口；主 Worker 的 `/admin` 与 `/admin.html` 路径返回 404。
- 后台使用独立 Worker 的 workers.dev 地址，不复用客户端域名。

部署命令：`npx wrangler deploy --config wrangler.admin.jsonc`

注意：管理后台只提供管理界面，素材读写仍通过主 API，并继续校验 `APP_TEST_KEY`。不要把 Supabase Secret 放进前端静态资源或此独立后台 Worker。
