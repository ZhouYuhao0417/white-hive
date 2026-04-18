# WhiteHive

`WhiteHive` 是一个面向中国市场的线上数字服务交易平台。当前版本已经从纯前端展示站进入 MVP 后端阶段，目标是先跑通“买家提交需求 -> 卖家接单 -> 订单状态流转 -> 订单留言”的最小闭环。

线上访问地址：

- [https://whitehive.cn](https://whitehive.cn)
- [https://www.whitehive.cn](https://www.whitehive.cn)

## 技术栈

- React 18
- Vite 5
- Tailwind CSS
- Framer Motion
- React Router
- Vercel Functions
- Postgres schema draft

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

本地预览地址通常为：

```text
http://127.0.0.1:5173
```

## 生产构建

```bash
npm run build
```

Vite 会输出静态产物到 `dist/`，当前 Vercel 项目会直接部署该产物。

## 后端接口

当前第一版后端位于 `api/`，使用 Vercel Functions：

- `GET /api/health`
- `GET /api/auth/session`
- `POST /api/auth/session`
- `GET /api/services`
- `POST /api/services`
- `GET /api/orders`
- `POST /api/orders`
- `PATCH /api/orders?id=...`
- `GET /api/messages?orderId=...`
- `POST /api/messages`

目前接口使用内存种子数据，适合前端联调和比赛演示。真实持久化数据库接入前，请参考：

- `docs/api-contract.md`
- `docs/backend-mvp.md`
- `db/schema.sql`

当前已接入 API 的前端闭环：

- 登录/注册抽屉会调用 `POST /api/auth/session`
- `/sell` 可以通过 `POST /api/services` 发布服务
- `/ai-match` 可以通过 `POST /api/orders` 创建订单
- `/orders/:id` 可以查看订单、推进状态、发送留言
- `/dashboard` 可以汇总查看买家订单和卖家服务

## 目录结构

```text
.
├── index.html
├── package.json
├── api/
├── db/
├── docs/
├── public/
│   ├── favicon.svg
│   └── og-cover.svg
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── components/
│   ├── data/
│   └── pages/
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── vercel.json
```

## 页面

- `/` 首页
- `/services` 服务分类
- `/services/:slug` 分类详情
- `/ai-match` AI 需求匹配
- `/sell` 开设服务
- `/dashboard` MVP 工作台
- `/orders/:id` 订单详情
- `/trust` 可信机制
- `/how-it-works` 交易流程
- `/about` 关于我们

## 部署说明

当前线上部署链路已经绑定到现有 Vercel 项目和 `whitehive.cn` 域名。

发布方式：

1. 本地提交代码
2. 推送到当前已绑定的 Git 仓库分支
3. Vercel 自动触发重新部署

`vercel.json` 已包含 SPA 路由重写配置，确保 `react-router-dom` 的子路由在生产环境不会 404。

下一步如果接入真实数据库：

1. 在 Neon / Supabase 创建 Postgres 数据库
2. 运行 `db/schema.sql`
3. 在 Vercel 项目环境变量中添加 `DATABASE_URL`
4. 将 `api/_lib/store.js` 的内存适配器替换为 Postgres 适配器

## 环境变量

| 变量 | 是否必需 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 否 | Neon/Postgres 连接串。未配置时自动回退到内存种子数据。 |
| `POSTGRES_URL` | 否 | `DATABASE_URL` 的 Vercel Postgres 别名。 |
| `DEEPSEEK_API_KEY` | 生产推荐 | 启用 DeepSeek 真实 LLM 调用（AI 匹配 / brief 审稿 / 定价建议 / listing 润色 / 纠纷摘要 / 消息审核）。未配置时全部降级到规则兜底，不崩。 |
| `DEEPSEEK_MODEL` | 否 | 默认 `deepseek-chat`，想 A/B 其他模型时覆盖。 |
| `WHITEHIVE_REQUIRE_DATABASE` | 否 | 设为 `1` 时关闭"Postgres 失败回退到内存"的行为，适合生产。 |

AI 模块详细说明见 [`docs/ai-backend.md`](./docs/ai-backend.md)。

## 本地开发 / 测试

```bash
bun install
bun run dev      # Vite dev server
bun test         # 跑全部单元 + 合约测试（不需要任何 key）
bun run build    # 生产构建
```

CI（`.github/workflows/ci.yml`）在每次 PR / push 到 `main` 时自动执行 `bun test` + `bun run build`。
