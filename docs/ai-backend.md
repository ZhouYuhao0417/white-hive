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
