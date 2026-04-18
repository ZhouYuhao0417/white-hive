import { test, expect, describe } from 'bun:test'
import {
  redactSensitive,
  threadKey,
  groupByOrder,
  publicMessageShape,
  buildMessageTimeline,
  lastMessagePreview,
} from '../api/_lib/message-shape.js'

describe('message-shape · redactSensitive', () => {
  test('redacts phone', () => {
    expect(redactSensitive('打我 13812345678')).not.toContain('13812345678')
  })
  test('redacts email', () => {
    expect(redactSensitive('邮件 abc@example.com')).toContain('***@***')
  })
  test('redacts 18-digit ID card', () => {
    const out = redactSensitive('身份证 110101199001011234')
    expect(out).not.toContain('110101199001011234')
  })
  test('redacts bank card', () => {
    const out = redactSensitive('卡号 6225880137891234')
    expect(out).not.toContain('6225880137891234')
    expect(out).toContain('6225')
    expect(out).toContain('1234')
  })
  test('passes through normal text', () => {
    expect(redactSensitive('你好, 明天见')).toBe('你好, 明天见')
  })
  test('null safe', () => {
    expect(redactSensitive(null)).toBe('')
    expect(redactSensitive(undefined)).toBe('')
  })
})

describe('message-shape · threadKey / groupByOrder', () => {
  test('threadKey stable regardless of buyer/seller order', () => {
    const a = threadKey({ id: 'ord_1', buyerId: 'b', sellerId: 's' })
    const b = threadKey({ id: 'ord_1', buyerId: 's', sellerId: 'b' })
    expect(a).toBe(b)
  })
  test('threadKey empty on no id', () => {
    expect(threadKey(null)).toBe('')
    expect(threadKey({})).toBe('')
  })
  test('groupByOrder buckets + sorts', () => {
    const msgs = [
      { id: 'm2', orderId: 'o1', createdAt: '2026-01-02T00:00:00Z' },
      { id: 'm1', orderId: 'o1', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'm3', orderId: 'o2', createdAt: '2026-01-01T00:00:00Z' },
    ]
    const m = groupByOrder(msgs)
    expect(m.get('o1').map((x) => x.id)).toEqual(['m1', 'm2'])
    expect(m.get('o2')).toHaveLength(1)
  })
  test('groupByOrder skips messages without orderId', () => {
    const m = groupByOrder([{ body: 'lonely' }])
    expect(m.size).toBe(0)
  })
})

describe('message-shape · publicMessageShape', () => {
  const msg = {
    id: 'msg_1',
    orderId: 'ord_1',
    senderRole: 'buyer',
    senderId: 'usr_1',
    body: '加我微信 13812345678',
    createdAt: '2026-01-01T00:00:00Z',
    flagged: true,
    moderation: { allow: false, severity: 'high', categories: ['offplatform'] },
    adminNotes: '内部记录',
  }

  test('returns redacted body to non-admin', () => {
    const p = publicMessageShape(msg, 'buyer')
    expect(p.body).toContain('13812345678') // raw body still present
    expect(p.bodyRedacted).not.toContain('13812345678')
    expect(p.flagged).toBe(true)
    expect(p.adminNotes).toBeUndefined()
  })

  test('admin gets adminNotes + rawModeration', () => {
    const p = publicMessageShape(msg, 'admin')
    expect(p.adminNotes).toBe('内部记录')
    expect(p.rawModeration).toEqual(msg.moderation)
  })

  test('null safe', () => {
    expect(publicMessageShape(null)).toBeNull()
  })
})

describe('message-shape · buildMessageTimeline', () => {
  const msgs = [
    { id: 'm2', body: 'b', senderRole: 'seller', createdAt: '2026-01-02', flagged: false },
    { id: 'm1', body: 'a', senderRole: 'buyer', createdAt: '2026-01-01', flagged: false },
    { id: 'm3', body: 'c', senderRole: 'buyer', createdAt: '2026-01-03', flagged: true },
  ]

  test('sorts asc by createdAt', () => {
    const tl = buildMessageTimeline(msgs)
    expect(tl.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
  })

  test('hideFlagged filters out flagged', () => {
    const tl = buildMessageTimeline(msgs, { hideFlagged: true })
    expect(tl.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  test('limit keeps last N', () => {
    const tl = buildMessageTimeline(msgs, { limit: 2 })
    expect(tl.map((m) => m.id)).toEqual(['m2', 'm3'])
  })

  test('empty/null safe', () => {
    expect(buildMessageTimeline(null)).toEqual([])
    expect(buildMessageTimeline([])).toEqual([])
  })
})

describe('message-shape · lastMessagePreview', () => {
  test('returns redacted preview', () => {
    const msgs = [{ body: '联系 13812345678 明天见', senderRole: 'buyer', createdAt: '2026-01-01' }]
    const p = lastMessagePreview(msgs)
    expect(p.text).not.toContain('13812345678')
    expect(p.senderRole).toBe('buyer')
  })
  test('truncates long text', () => {
    const msgs = [{ body: 'x'.repeat(200), senderRole: 'buyer', createdAt: '2026-01-01' }]
    const p = lastMessagePreview(msgs, { length: 10 })
    expect(p.text.length).toBeLessThanOrEqual(11) // +ellipsis
    expect(p.text.endsWith('…')).toBe(true)
  })
  test('null on empty', () => {
    expect(lastMessagePreview([])).toBeNull()
    expect(lastMessagePreview(null)).toBeNull()
  })
})
