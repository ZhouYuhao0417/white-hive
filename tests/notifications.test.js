import { test, expect, describe } from 'bun:test'
import {
  notificationEvents,
  notificationChannels,
  renderNotification,
  renderNotificationBatch,
} from '../api/_lib/notifications.js'

const order = { id: 'ord_1', title: '做一个落地页', budgetCents: 120000 }
const dispute = { id: 'dsp_1', reason: '未交付', resolution: { action: 'refund_buyer' } }
const review = { rating: 5, body: '交付很快，质量很好，很满意，下次还找你。' }
const message = { categories: ['contact_info'] }

describe('notifications · enums', () => {
  test('14 events are frozen', () => {
    expect(notificationEvents.length).toBe(14)
    expect(() => (notificationEvents[0] = 'x')).toThrow()
  })
  test('3 channels', () => {
    expect(notificationChannels).toEqual(['email', 'inapp', 'push'])
  })
})

describe('notifications · renderNotification', () => {
  for (const event of notificationEvents) {
    test(`renders ${event}`, () => {
      const p = renderNotification({
        event,
        recipientRole: 'buyer',
        recipientId: 'usr_1',
        context: { order, dispute, review, message, amount: 120000 },
      })
      expect(p.event).toBe(event)
      expect(p.channel).toBe('inapp')
      expect(p.subject).toBeTruthy()
      expect(p.title).toBeTruthy()
      expect(p.body).toBeTruthy()
      expect(p.cta?.href).toContain('/orders/ord_1')
      expect(['info', 'success', 'warning']).toContain(p.severity)
      expect(p.audience).toEqual({ role: 'buyer', id: 'usr_1' })
      expect(p.createdAt).toBeTruthy()
    })
  }

  test('seller role changes wording on delivered', () => {
    const b = renderNotification({
      event: 'order.delivered',
      recipientRole: 'buyer',
      context: { order },
    })
    const s = renderNotification({
      event: 'order.delivered',
      recipientRole: 'seller',
      context: { order },
    })
    expect(b.body).not.toBe(s.body)
  })

  test('released maps to success severity + review CTA', () => {
    const p = renderNotification({
      event: 'order.released',
      recipientRole: 'seller',
      context: { order, amount: 120000 },
    })
    expect(p.severity).toBe('success')
    expect(p.cta.href).toContain('#review')
  })

  test('dispute.opened uses dispute hash anchor', () => {
    const p = renderNotification({
      event: 'dispute.opened',
      recipientRole: 'seller',
      context: { order, dispute },
    })
    expect(p.cta.href).toContain('#dispute')
    expect(p.severity).toBe('warning')
  })

  test('channel defaults to inapp, accepts email/push', () => {
    const email = renderNotification({
      event: 'order.placed',
      channel: 'email',
      recipientRole: 'buyer',
      context: { order },
    })
    expect(email.channel).toBe('email')
  })

  test('uses now override for createdAt', () => {
    const p = renderNotification({
      event: 'order.placed',
      recipientRole: 'buyer',
      context: { order },
      now: '2026-01-01T00:00:00Z',
    })
    expect(p.createdAt).toBe('2026-01-01T00:00:00Z')
  })
})

describe('notifications · errors', () => {
  test('rejects unknown event', () => {
    expect(() =>
      renderNotification({ event: 'bogus', recipientRole: 'buyer', context: { order } }),
    ).toThrow(/invalid_notification_event|未知事件/)
  })
  test('rejects unknown channel', () => {
    expect(() =>
      renderNotification({
        event: 'order.placed',
        channel: 'sms',
        recipientRole: 'buyer',
        context: { order },
      }),
    ).toThrow(/invalid_notification_channel|未知通道/)
  })
  test('rejects missing recipientRole', () => {
    expect(() =>
      renderNotification({ event: 'order.placed', context: { order } }),
    ).toThrow(/invalid_notification_recipient|recipientRole/)
  })
})

describe('notifications · renderNotificationBatch', () => {
  test('fans out to each recipient', () => {
    const out = renderNotificationBatch({
      event: 'order.released',
      recipients: [
        { role: 'buyer', id: 'usr_1' },
        { role: 'seller', id: 'usr_2' },
      ],
      context: { order, amount: 120000 },
    })
    expect(out.length).toBe(2)
    expect(out[0].audience.id).toBe('usr_1')
    expect(out[1].audience.id).toBe('usr_2')
    expect(out.every((p) => p.event === 'order.released')).toBe(true)
  })

  test('empty recipients → empty array', () => {
    expect(renderNotificationBatch({ event: 'order.placed', recipients: [], context: {} })).toEqual(
      [],
    )
    expect(
      renderNotificationBatch({ event: 'order.placed', recipients: null, context: {} }),
    ).toEqual([])
  })
})
