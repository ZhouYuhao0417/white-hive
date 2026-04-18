// Lightweight in-memory search helpers for services / orders / messages.
//
// Designed for the memory-store path and for small Postgres result sets
// where we don't want to depend on pg_trgm or external search. All logic
// is deterministic and synchronous — zero external calls.
//
// Exports:
//   - tokenize(text)        -> string[]        normalized tokens
//   - scoreMatch(haystack, query) -> number    simple keyword hit score
//   - filterByQuery(items, query, getText)     keeps items with hit > 0
//   - sortServices(items, sort)                price_asc|price_desc|newest|relevance
//   - applyFilters(items, filters)             category / tags / priceMin / priceMax / sellerId

const STOPWORDS = new Set([
  '的', '了', '我', '你', '他', '她', '它', '们', '在', '是', '和', '与', '或',
  '这', '那', '一个', '一些', '就', '但', '有', '没', '不', 'a', 'an', 'the',
  'and', 'or', 'of', 'to', 'for', 'with', 'in', 'on', 'is', 'are',
])

export function tokenize(text) {
  if (!text) return []
  const lower = String(text).toLowerCase()
  const latin = (lower.match(/[a-z0-9][a-z0-9+#.-]{0,30}/g) || []).filter(
    (tok) => tok.length >= 2 && !STOPWORDS.has(tok),
  )
  // Treat each CJK char as a unigram; concat adjacent ones up to length 2 as bigrams.
  const cjk = lower.match(/[\u4e00-\u9fff]+/g) || []
  const cjkGrams = []
  for (const run of cjk) {
    for (let i = 0; i < run.length; i += 1) {
      if (!STOPWORDS.has(run[i])) cjkGrams.push(run[i])
      if (i + 1 < run.length) {
        const bi = run[i] + run[i + 1]
        if (!STOPWORDS.has(bi)) cjkGrams.push(bi)
      }
    }
  }
  return Array.from(new Set([...latin, ...cjkGrams]))
}

export function scoreMatch(haystack, query) {
  if (!query) return 0
  const qTokens = tokenize(query)
  if (qTokens.length === 0) return 0
  const target = String(haystack || '').toLowerCase()
  if (!target) return 0

  let score = 0
  for (const token of qTokens) {
    if (!token) continue
    if (target.includes(token)) {
      score += token.length >= 2 ? token.length : 1
    }
  }
  return score
}

export function filterByQuery(items, query, getText = (item) => item.text) {
  if (!query) return Array.isArray(items) ? items.slice() : []
  if (!Array.isArray(items)) return []
  return items
    .map((item) => ({ item, score: scoreMatch(getText(item), query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
}

export function applyFilters(items, filters = {}) {
  if (!Array.isArray(items)) return []
  const { category, sellerId, status, tags, priceMin, priceMax } = filters
  const tagSet =
    Array.isArray(tags) && tags.length
      ? new Set(tags.map((t) => String(t).toLowerCase()))
      : null

  return items.filter((item) => {
    if (category && item.category !== category) return false
    if (sellerId && item.sellerId !== sellerId) return false
    if (status && item.status !== status) return false
    if (priceMin != null && Number(item.priceCents || 0) < Number(priceMin)) return false
    if (priceMax != null && Number(item.priceCents || 0) > Number(priceMax)) return false
    if (tagSet) {
      const itemTags = Array.isArray(item.tags) ? item.tags.map((t) => String(t).toLowerCase()) : []
      if (!itemTags.some((t) => tagSet.has(t))) return false
    }
    return true
  })
}

export function sortServices(items, sort = 'newest') {
  if (!Array.isArray(items)) return []
  const copy = items.slice()
  switch (sort) {
    case 'price_asc':
      copy.sort((a, b) => Number(a.priceCents || 0) - Number(b.priceCents || 0))
      break
    case 'price_desc':
      copy.sort((a, b) => Number(b.priceCents || 0) - Number(a.priceCents || 0))
      break
    case 'delivery_fast':
      copy.sort((a, b) => Number(a.deliveryDays || 9999) - Number(b.deliveryDays || 9999))
      break
    case 'newest':
    default:
      copy.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      )
      break
  }
  return copy
}

export function serviceSearchText(service) {
  if (!service) return ''
  return [
    service.title,
    service.summary,
    service.category,
    service.description,
    ...(Array.isArray(service.tags) ? service.tags : []),
    service.seller?.displayName,
  ]
    .filter(Boolean)
    .join(' ')
}
