# AI Backend Modules

This doc covers the AI + helper modules under `api/_lib/` that sit on top of
the DeepSeek API. Everything here is **additive** — the core store contract
in `api-contract.md` is unchanged.

## Environment

| Variable              | Required? | Effect                                                                                 |
| --------------------- | --------- | -------------------------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY`    | no (recommended for prod) | Enables real LLM re-ranking / review / moderation. Without it, everything falls back to deterministic rules. |
| `DEEPSEEK_MODEL`      | no        | Defaults to `deepseek-chat`. Override if you want to A/B a different model.            |

**Design rule:** every AI module MUST gracefully degrade when the key is missing
or the LLM call fails. None of them ever throw. They return `{ ok: false, reason }`
and the handler falls back to a rule-based path.

## Module map

### `api/_lib/deepseek.js` — shared LLM client

```js
import { callDeepSeek, isDeepSeekConfigured, parseJsonFromLlm } from './deepseek.js'
```

- `callDeepSeek({ messages, jsonMode, temperature, maxTokens, timeoutMs, model })`
  - Returns `{ ok: true, text, model, usage }` or `{ ok: false, reason, error? }`.
  - `reason` is one of `not_configured`, `no_messages`, `timeout`, `http_error`, `network_error`.
- `isDeepSeekConfigured()` — boolean, checks env.
- `deepSeekStatus()` — `{ configured, provider, missing: string[] }` for a `/healthz`-style handler.
- `parseJsonFromLlm(text)` — tolerant JSON parser: strips ```json fences, extracts first balanced
  `{…}` block, returns `null` on any failure (never throws).

### `api/_lib/matcher.js` — AI service matcher

`createMatch(input)` — two-stage pipeline:
1. **Rule pre-filter** — scores all published services against buyer signals.
2. **DeepSeek re-rank** — top N rule candidates handed to the LLM; LLM returns
   rankings + 2-4 clarifying questions + an intent summary.

Legacy response shape preserved:
```ts
{
  id: 'mat_...',
  engine: 'whitehive-deepseek-v1' | 'whitehive-rule-match-v1',
  engineDetails: { llmUsed, llmReason, llmModel, llmUsage, preFilterSize, totalCandidates },
  query: { category, budgetCents, deadline, signals, llmIntent },
  confidence: 'low' | 'medium' | 'high',
  matches: [{ service, score, fit, reasons, warnings }],
  clarifyingQuestions: [{ key, label, reason }],
  suggestedOrderDraft: { serviceId, category, title, brief, budgetCents } | null,
  createdAt: '...',
}
```

### `api/_lib/ai-brief.js` — buyer brief review

```js
await reviewBrief({ category, title, brief, budgetCents, deadline, notes })
// → { ok, score, summary, strengths[], gaps[{key,label,reason}],
//     suggestedRewrite, redFlags[], model, usage }
```

Intended use: AIMatch "Stage 0", or a `/api/ai/brief-review` endpoint. Frontend can
either auto-run it when the user finishes typing a brief, or behind a "AI 帮我检查" button.

### `api/_lib/ai-price.js` — seller pricing advice

```js
await suggestPricing({ category, title, summary, deliveryDays, sellerExperience,
                      targetBudgetCents, comparableServices })
// → { ok, suggestedMinCents, suggestedMaxCents, reasoning,
//     tiers: [{name,priceCents,deliveryDays,includes}], tagSuggestions, model, usage }
```

Intended use: Sell.jsx — "帮我定价" button next to the price input.

### `api/_lib/ai-listing.js` — seller listing polish

```js
await polishListing({ category, title, summary, tags, deliveryDays, priceCents, sellerBio })
// → { ok, title, summary, tags, whyBuy[], scopeIncluded[], scopeExcluded[], model, usage }
```

Notable: returns a `scopeExcluded[]` array — a list of **what the service does NOT include**.
This is specifically designed to reduce OrderChat disputes by making boundaries explicit.

### `api/_lib/ai-dispute.js` — dispute summarization

```js
await summarizeDispute({ order, messages, buyerClaim, sellerClaim })
// → { ok, summary, timeline[], buyerPosition, sellerPosition,
//     factualDisputes[], agreedFacts[],
//     recommendedAction: 'refund_buyer'|'release_seller'|'split'|'request_more_evidence',
//     recommendedActionReason, confidence: 'low'|'medium'|'high', model, usage }
```

Intended use: admin console / Dashboard dispute view. The LLM is pinned to low
temperature (0.2) and instructed to stay neutral; if the chat is too thin to
judge, it returns `confidence: 'low'` and `recommendedAction: 'request_more_evidence'`.

### `api/_lib/ai-moderation.js` — message moderation

Two entry points:

```js
quickCheck(body)
// → { ok: true, flagged, hits: [{id,category,severity,label}], severity } (sync, no LLM)

await moderateMessage({ body })
// → { ok, source: 'llm'|'rules'|'rules-fallback', allow, severity,
//     categories[], reasons[], suggestedRewrite, ruleHits, model?, usage? }
```

Rule layer catches the obvious cases synchronously:
- `offplatform` — WeChat / QQ / phone / paypal+telegram links
- `scam` — "私下转账 / 不走平台"
- `abuse` — basic CN/EN abuse tokens
- `pii` — 18-digit ID number, 16-19 digit bank card

LLM layer complements it with context (e.g. "add me on WeChat **later** after we
close here" is OK). If the LLM fails, we fall back to the rule decision.

## Helper modules (no LLM)

### `api/_lib/pagination.js`

```js
const { limit, offset } = parsePagination(query) // clamps to [1,100] and ≥0
const { items, pagination } = paginate(allItems, { limit, offset })
// pagination = { total, limit, offset, hasMore, nextOffset }
```

`paginateFrom(source, items)` does both in one call.

### `api/_lib/search.js`

- `tokenize(text)` — latin words + CJK unigram/bigram; stopword-filtered.
- `scoreMatch(haystack, query)` — number, higher = better.
- `filterByQuery(items, query, getText)` — returns matches sorted by score.
- `applyFilters(items, { category, sellerId, status, tags, priceMin, priceMax })`
- `sortServices(items, 'price_asc'|'price_desc'|'delivery_fast'|'newest')`
- `serviceSearchText(service)` — canonical searchable string for a service.

### `api/_lib/dispute.js`

Pure-logic domain model:
- Enums: `disputeStatuses`, `disputeActions`, `disputeReasons`.
- `canTransition(from, to, actorRole)` + `assertTransition(...)` — state machine.
  Terminal states (`resolved`, `withdrawn`) can't be re-opened even by admin.
- `normalizeEvidence({ type, body, url })` — trims + validates an evidence entry.
- `resolveFinancialOutcome(action, escrowCents, splitPercent?)` — computes
  refund / release split.
- `computeSlaDeadline(status, fromIso)` — auto-advance deadline ISO string.
- `publicDisputeShape(dispute)` — safe public projection.

### `api/_lib/escrow.js`

纯逻辑的托管状态机 —— 强制"买卖双方都确认后才放款"。

```js
import { applyAction, validateAction, canRelease, publicEscrowShape } from './escrow.js'

const { payment, released, refunded, dualConfirmed } = applyAction(oldPayment, {
  action: 'confirm_delivery', // | 'ready_for_release' | 'cancel_confirmation' | 'force_release' | 'force_refund'
  actorRole: 'buyer',         // | 'seller' | 'admin'
  actorId: 'usr_...',
})
```

- 双方都确认时自动 `held → released`，并记录 `releaseRequestedBy`。
- `cancel_confirmation` 只回滚自己那一侧，不能在 terminal 状态下用。
- `force_release` / `force_refund` 仅 admin 可用，用于纠纷裁决。
- 非法动作抛 `HttpError(409, 'escrow_action_rejected', …, { reason })`，详细原因见 `validateAction` 的返回码。

接入 store 的完整指引：[`docs/escrow-dual-confirm.md`](./escrow-dual-confirm.md)。

### `api/_lib/reviews.js`

订单完成后的评价纯逻辑。

```js
import {
  reviewRoles, reviewTags, normalizeReview, canEdit, applyEdit,
  publicReviewShape, aggregateReviews, hasExistingReview,
} from './reviews.js'

const r = normalizeReview({ rating: 5, body: '很满意', tags: ['on_time'], attachments: [] })
// 无效输入抛 HttpError(400, 'review_invalid', ...)
canEdit(r, { now })    // 48h 编辑窗口
aggregateReviews(list) // { count, average, distribution, positiveRate, topTags }
```

`normalizeReview` 校验 rating (1–5 整数)、body ≤600 字、最多 6 个合法 tag、attachment
必须是 https。`publicReviewShape` 过滤 `reviewerId` 与被隐藏的评价。

### `api/_lib/rate-limit.js`

纯内存限流器，两种算法可选；`opts.store` 可注入 KV 以跨实例共享。

```js
import { createLimiter, rateLimitHeaders } from './rate-limit.js'
const L = createLimiter()
const r = L.tokenBucket(`ip:${ip}`, { capacity: 20, refillPerSec: 2 })
// 或
const r = L.slidingWindow(`user:${uid}:login`, { limit: 5, windowMs: 60_000 })
if (!r.allowed) return { status: 429, headers: rateLimitHeaders(r) }
```

`L.reset(key)` 清除该 key 的两种桶, 方便测试 / 手动解封。

### `api/_lib/idempotency.js`

Stripe 风格的 `Idempotency-Key` 处理器。

```js
import { validateKey, createIdempotencyCache, runIdempotent } from './idempotency.js'
const cache = createIdempotencyCache({ ttlMs: 24*60*60*1000 })
const { result, replayed } = await runIdempotent(cache, {
  key: req.headers['idempotency-key'],
  handler: async () => await createOrder(body),
})
```

状态机：`fresh → in_flight → completed`（或 `expired`）。handler 抛异常时
`cache.fail(key)` 自动释放，允许客户端重试；成功结果在 TTL 内命中同 key 直接重放。

### `api/_lib/notifications.js`

订单 / 托管 / 纠纷 / 消息 / 评价事件 → 结构化通知模板。**只渲染内容, 不负责发送**
（发送由 `email.js` / 未来的 push adapter 处理）。

```js
import { renderNotification, renderNotificationBatch, notificationEvents } from './notifications.js'
const payload = renderNotification({
  event: 'order.released',
  channel: 'email',             // email | inapp | push
  recipientRole: 'seller',
  recipientId: 'usr_2',
  context: { order, amount: order.budgetCents },
})
// payload = { event, channel, audience, severity, subject, title, body, cta, createdAt }
```

支持 14 个事件（见 `notificationEvents`），每个事件按 `recipientRole` 产出不同措辞。
`renderNotificationBatch({ recipients: [{role,id}, ...] })` 一次 fan-out 给多个收件人。

### `api/_lib/order-machine.js`

订单状态机 —— 和 `dispute.js` 同构, 覆盖 7 个状态 + 4 个 actor 角色。

```js
import {
  canTransition, assertTransition, applyTransition,
  availableActions, orderStatuses, orderProgressPercent,
} from './order-machine.js'

assertTransition(order.status, 'accepted', 'seller')          // 抛 409 if illegal
const next = applyTransition(order, {
  toStatus: 'accepted', actorRole: 'seller', actorId: 'usr_2', note: 'ok',
})
// next = { ...order, status: 'accepted', acceptedAt, statusHistory: [...] }
availableActions(order, 'buyer')  // → 合法的 next state 列表, 给 UI 画按钮
```

`actorRole ∈ 'buyer' | 'seller' | 'admin' | 'system'`（`system` 给定时任务用, 例如
交付 7 天买家没反应就 `applyTransition(order, { toStatus: 'completed', actorRole: 'system' })`）。

### `api/_lib/deadline.js`

订单 / 托管 / SLA / 评价 的时间计算, 全部是 pure function + 显式 `now` 参数。

```js
import {
  orderDeadline, timeUntil, isOverdue, autoReleaseAt,
  reviewEditDeadline, nextSlaMilestone, humanizeRelative,
} from './deadline.js'

orderDeadline({ createdAt, deliveryDays: 3 })     // ISO
nextSlaMilestone(order, Date.now())               // { kind, deadline, hoursRemaining, overdue }
humanizeRelative('2026-01-10T09:00:00Z', now)     // "3 小时前"
```

Dashboard "还有 12 小时自动放款" 这类提示都用 `nextSlaMilestone`。

### `api/_lib/message-shape.js`

订单消息的对外投影 + 敏感信息遮罩。不做真正的内容审核（那是 `ai-moderation.js`）,
只是让 API 响应不要意外 leak 手机号 / 邮箱 / 卡号。

```js
import {
  publicMessageShape, buildMessageTimeline, lastMessagePreview,
  redactSensitive, threadKey,
} from './message-shape.js'

const tl = buildMessageTimeline(messages, { viewerRole: 'buyer', hideFlagged: true })
// [{ id, body, bodyRedacted, senderRole, flagged, moderation, ... }]
redactSensitive('加我 13812345678')  // "加我 ***-****-*678"
```

`publicMessageShape` 对非 admin 隐藏 `adminNotes` 与 `rawModeration`, 同时给一份
`bodyRedacted` —— 前端可以选择显示遮罩版、真正的 body 只给双方订单参与者看。

### `api/_lib/profile-shape.js`

用户信息的对外投影 + 信任分（0-100）+ 徽章。

```js
import {
  selfUserShape, publicUserShape, sellerCard, adminUserShape,
  profileTrustScore, computeBadges,
} from './profile-shape.js'

selfUserShape(user)          // 给 "我自己" —— 去掉 passwordHash, 保留邮箱 / 手机
publicUserShape(user)        // 给陌生人 —— 只保留公开字段 + trustScore + badges
sellerCard(user, stats)      // 列表页 / 匹配结果的轻量卡片
adminUserShape(user)         // admin 看到的 mask 过的 email / phone
profileTrustScore(user, stats) // 0-100 分
```

信任分规则写在注释里, 纯函数——前端也可以 import 来算 preview。

### `api/_lib/payment-cascade.js`

订单状态变化 → 托管该做什么。很薄的 orchestration 层, 不碰 store, 只把 `escrow.js`
的 `applyAction` 包一层。

```js
import { cascadeOnOrderTransition, canAutoComplete } from './payment-cascade.js'

const { paymentPatch, released, refunded, skipped, reason } = cascadeOnOrderTransition({
  fromStatus: 'delivered', toStatus: 'completed',
  actorRole: 'buyer', payment,
})
if (paymentPatch) await store.updatePayment(payment.id, paymentPatch)
```

Codex 的 `updateOrder()` 在完成状态机转移后, 直接把这个 helper 的结果合并进事务即可。

### `api/_lib/webhook-signature.js`

HMAC-SHA256 签名 / 验签 (Web Crypto subtle, Edge/Node 通用)。Stripe 风格
`t=<ts>,v1=<hex>` header。

```js
import {
  signPayload, verifyPayload, parseSignatureHeader,
  generateWebhookSecret,
} from './webhook-signature.js'

const header = await signPayload({ body: JSON.stringify(payload), secret, now: Date.now() })
const { valid, reason } = await verifyPayload({ body, secret, header, toleranceSec: 300 })
const newSecret = generateWebhookSecret()  // 'whsec_...' 32 bytes hex
```

5 分钟 replay 窗口 + 常数时间比较, `reason ∈ bad_header|expired|signature_mismatch|bad_input`。

### `api/_lib/validate.js`

```js
const body = validate(raw, {
  title:    { type: 'string', required: true, maxLen: 80 },
  brief:    { type: 'string', required: true, minLen: 4, maxLen: 4000 },
  budgetCents: { type: 'int', min: 0 },
  category: { type: 'enum', values: ['web','design','video'] },
  tags:     { type: 'stringArray', maxItems: 8, maxItemLen: 16 },
  email:    { type: 'email' },
  avatar:   { type: 'url', protocols: ['https:'] },
})
```

Throws `HttpError(400, 'validation_failed', '请求体字段校验失败。', { issues: [...] })`
with a structured per-field list on failure.

## Testing

Every module above has a corresponding `tests/*.test.js` running under `bun test`.
AI lib tests cover the "no key" path + input gating; real LLM calls are not
exercised in CI to keep tests hermetic and free.

To smoke-test against the real DeepSeek:
```
DEEPSEEK_API_KEY=sk-... bun test tests/matcher.test.js
```
The matcher will switch to the LLM path and the test shape assertions still hold.
