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
- Neon Postgres
- Resend 邮件验证码
- Vercel Blob 头像存储

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
- `GET /api/auth/providers`
- `POST /api/auth/email-verification`
- `POST /api/auth/password-reset`
- `POST /api/uploads/avatar`
- `GET /api/services`
- `POST /api/services`
- `GET /api/orders`
- `POST /api/orders`
- `PATCH /api/orders?id=...`
- `GET /api/messages?orderId=...`
- `POST /api/messages`

当前线上已接入 Neon Postgres。没有数据库环境变量时，接口会自动回退到内存种子数据，方便本地联调。数据库、邮件和对象存储配置请参考：

- `docs/api-contract.md`
- `docs/backend-mvp.md`
- `db/schema.sql`

Vercel 环境变量建议：

```text
DATABASE_URL=...
RESEND_API_KEY=...
EMAIL_FROM=WhiteHive <no-reply@whitehive.cn>
BLOB_READ_WRITE_TOKEN=...
WHITEHIVE_ADMIN_EMAILS=your-admin-email@example.com
WHITEHIVE_ADMIN_REVIEW_TOKEN=optional-long-random-token
WHITEHIVE_SITE_URL=https://www.whitehive.cn
```

`/api/health` 会返回 `storage`、`email`、`uploads.avatar` 和 `authProviders` 的配置状态，但不会暴露密钥。

当前已接入 API 的前端闭环：

- 登录/注册抽屉会调用 `POST /api/auth/session`
- `/sell` 可以通过 `POST /api/services` 发布服务
- `/ai-match` 可以通过 `POST /api/orders` 创建订单
- `/orders/:id` 登录后可以查看参与订单、推进状态、发送留言
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

安全边界：

1. 订单详情、付款、聊天只允许订单买家、卖家或管理员访问。
2. 服务发布要求登录且账号身份为创作者。
3. 实名认证审核需要管理员邮箱白名单或 `WHITEHIVE_ADMIN_REVIEW_TOKEN`。
4. 手机号已走短信验证码登录/注册；微信、QQ、GitHub 在平台应用密钥配置前仍会降级到临时桥接登录。

## 环境变量

| 变量 | 是否必需 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 否 | Neon/Postgres 连接串。未配置时自动回退到内存种子数据。 |
| `POSTGRES_URL` | 否 | `DATABASE_URL` 的 Vercel Postgres 别名。 |
| `DEEPSEEK_API_KEY` | 生产推荐 | 启用 DeepSeek 真实 LLM 调用（AI 匹配 / brief 审稿 / 定价建议 / listing 润色 / 纠纷摘要 / 消息审核）。未配置时全部降级到规则兜底，不崩。 |
| `DEEPSEEK_MODEL` | 否 | 默认 `deepseek-chat`，想 A/B 其他模型时覆盖。 |
| `WHITEHIVE_REQUIRE_DATABASE` | 否 | 设为 `1` 时关闭"Postgres 失败回退到内存"的行为，适合生产。 |
| `WHITEHIVE_SMS_PROVIDER` | 生产推荐 | 当前推荐填 `spug`。 |
| `SPUG_SMS_URL` | 生产推荐 | Spug 推送助手短信验证码模板复制出来的完整 URL。 |
| `SPUG_SMS_APP_NAME` | 否 | 发送到 Spug 的应用名，默认 `WhiteHive`。 |
| `WHITEHIVE_SMS_MOCK` | 否 | 本地调试可设为 `1`，线上应为 `0`。 |

AI 模块详细说明见 [`docs/ai-backend.md`](./docs/ai-backend.md)。

### 让 AI 在生产真的跑起来

没配 `DEEPSEEK_API_KEY` 的话，AI 追问 / brief 审稿 / 定价 / listing 润色 / 纠纷摘要 / 消息审核都会静默地走规则兜底 —— 不崩，但你看到的就是固定模板，而不是根据用户需求的真实追问。

生产部署要点：

1. 在 [platform.deepseek.com](https://platform.deepseek.com/) 申请一个 API key。
2. Vercel → 项目 → **Settings → Environment Variables**，新增：
   - `DEEPSEEK_API_KEY` = `sk-...`（Production + Preview 都勾）
   - 可选 `DEEPSEEK_MODEL`，默认 `deepseek-chat`
3. 重新部署一次（Vercel 环境变量必须触发新部署才生效）。
4. 可以访问 `GET /api/health`（或任何 AI 端点）看 `engine` 字段：
   - `whitehive-deepseek-v1` = 已接上 LLM
   - `whitehive-rule-match-v1` = 还在规则兜底，key 没生效

### 资金托管：双方确认后才放款

`api/_lib/escrow.js` 已实现"买家确认收到 + 卖家标记可放款 → 自动放款"的状态机。
管理员仍可在纠纷裁决时强制放款 / 强制退款。接入 store 与前端按钮的指引见
[`docs/escrow-dual-confirm.md`](./docs/escrow-dual-confirm.md)。

## 本地开发 / 测试

```bash
bun install
bun run dev      # Vite dev server
bun test         # 跑全部单元 + 合约测试（不需要任何 key）
bun run build    # 生产构建
```

CI（`.github/workflows/ci.yml`）在每次 PR / push 到 `main` 时自动执行 `bun test` + `bun run build`。
