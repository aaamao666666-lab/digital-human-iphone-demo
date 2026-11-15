# 鑫灵 AI 后端（Cloudflare Pages Functions）

## 当前接口

- `GET /api/health`：查看后端及必需密钥是否配置（只返回布尔状态，不返回密钥）。
- `POST /api/chat`：通过服务端安全调用 DeepSeek Chat Completions。浏览器不会接触 DeepSeek API Key。

## 需要在 Cloudflare Pages 项目中设置的 Secrets

在 Settings → Variables and Secrets → Production（如使用 Preview，也要分别配置）设置：

- `DEEPSEEK_API_KEY`：用户自己的 DeepSeek API Key，作为 **Secret** 保存。
- `APP_TEST_KEY`：自定义的内部测试口令，作为 **Secret** 保存。

不要把这两个值写入 GitHub、网页源码或聊天消息。

## 部署

GitHub Pages 只托管静态资源，不会执行 `functions/` 目录里的后端代码。需要在 Cloudflare Pages 创建一个项目，连接本仓库，并将生产分支选择为 `1主要的`。本仓库静态页面在根目录，Framework preset 选 None，Build command 留空，Build output directory 填 `/`（若控制台不接受根目录值，按 Cloudflare Pages 新建项目向导的静态根目录默认值）。Cloudflare Pages 会自动识别根目录下的 `functions/` 路由并部署为 Functions。

首次连接 Cloudflare GitHub App 时，只授权 `digital-human-iphone-demo` 一个仓库即可。

## 安全与限制

这是单人内部测试阶段：`APP_TEST_KEY` 是简单的共享口令，不是正式用户登录系统。不可公开推广。后续要加入真正的账户身份验证、用户隔离、请求限流、文件存储与删除控制后，才能开放普通用户。
