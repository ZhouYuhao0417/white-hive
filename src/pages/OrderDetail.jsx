import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Section, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { createMessage, listMessages, listOrders, updateOrder } from '../lib/api.js'
import { cacheOrder, readCachedOrder } from '../lib/orderCache.js'

const statusSteps = [
  { key: 'submitted', label: '已提交', desc: '买家需求已进入系统' },
  { key: 'accepted', label: '已接单', desc: '卖家确认范围与档期' },
  { key: 'in_progress', label: '制作中', desc: '服务进入交付阶段' },
  { key: 'delivered', label: '待验收', desc: '卖家提交交付物' },
  { key: 'completed', label: '已完成', desc: '买家验收并归档' },
]

const statusText = {
  submitted: '待卖家接单',
  accepted: '卖家已接单',
  in_progress: '制作进行中',
  delivered: '等待买家验收',
  completed: '订单已完成',
  cancelled: '订单已取消',
}

const nextStatus = {
  submitted: { value: 'accepted', label: '卖家接单' },
  accepted: { value: 'in_progress', label: '开始制作' },
  in_progress: { value: 'delivered', label: '提交交付' },
  delivered: { value: 'completed', label: '确认验收' },
}

function formatMoney(cents, currency = 'CNY') {
  const amount = Number(cents || 0) / 100
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

function StatusTimeline({ status }) {
  const activeIndex = statusSteps.findIndex((step) => step.key === status)
  const doneIndex = activeIndex === -1 && status === 'completed' ? statusSteps.length - 1 : activeIndex

  return (
    <div className="grid md:grid-cols-5 gap-3">
      {statusSteps.map((step, index) => {
        const active = index <= doneIndex
        return (
          <div
            key={step.key}
            className="rounded-xl border p-4"
            style={{
              borderColor: active ? 'rgba(127,211,255,0.38)' : 'rgba(255,255,255,0.08)',
              background: active ? 'rgba(127,211,255,0.07)' : 'rgba(255,255,255,0.02)',
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold"
                style={{
                  background: active ? 'rgba(127,211,255,0.20)' : 'rgba(255,255,255,0.05)',
                  color: active ? '#BEE6FF' : 'rgba(255,255,255,0.35)',
                }}
              >
                {active ? '✓' : index + 1}
              </span>
              <span className="text-sm font-medium text-white">{step.label}</span>
            </div>
            <p className="mt-2 text-xs text-white/45 leading-relaxed">{step.desc}</p>
          </div>
        )
      })}
    </div>
  )
}

function MessageBubble({ message }) {
  const fromBuyer = message.senderId?.includes('buyer')
  return (
    <div className={`flex ${fromBuyer ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 border text-sm leading-relaxed ${
          fromBuyer
            ? 'rounded-tr-sm bg-[#7FD3FF]/10 border-[#7FD3FF]/25 text-[#E8F7FF]'
            : 'rounded-tl-sm bg-white/[0.035] border-white/10 text-white/75'
        }`}
      >
        <div className="text-[10px] text-white/35 mb-1">
          {fromBuyer ? '买家' : '卖家'} · {new Date(message.createdAt).toLocaleString('zh-CN')}
        </div>
        {message.body}
      </div>
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState(() => readCachedOrder(id))
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [sender, setSender] = useState('usr_demo_buyer')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const action = useMemo(() => (order ? nextStatus[order.status] : null), [order])

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        const data = await listOrders({ id })
        if (!mounted) return
        setOrder(data)
        cacheOrder(data)
      } catch (err) {
        if (!mounted) return
        const cached = readCachedOrder(id)
        if (cached) {
          setOrder(cached)
          setNotice('当前订单来自本地缓存；接入数据库后会自动持久化。')
        } else {
          setError(err.message || '订单加载失败。')
        }
      }

      try {
        const data = await listMessages(id)
        if (mounted) setMessages(data)
      } catch {
        if (mounted) setMessages([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [id])

  const patchOrder = async (changes, fallbackNotice) => {
    if (!order) return
    setNotice('')
    setError('')

    try {
      const updated = await updateOrder(order.id, changes)
      setOrder(updated)
      cacheOrder(updated)
    } catch {
      const updated = {
        ...order,
        ...changes,
        updatedAt: new Date().toISOString(),
      }
      setOrder(updated)
      cacheOrder(updated)
      setNotice(fallbackNotice || '已在本地演示状态中更新；接入数据库后会持久保存。')
    }
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    const text = body.trim()
    if (!text) return

    setBody('')
    setNotice('')

    try {
      const created = await createMessage({
        orderId: id,
        senderId: sender,
        body: text,
      })
      setMessages((current) => [...current, created])
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `local_${Date.now()}`,
          orderId: id,
          senderId: sender,
          body: text,
          createdAt: new Date().toISOString(),
        },
      ])
      setNotice('留言已临时保存在当前演示会话；接入数据库后会持久保存。')
    }
  }

  if (loading && !order) {
    return (
      <Section className="pt-28 md:pt-32">
        <div className="card p-8 text-white/60">正在加载订单...</div>
      </Section>
    )
  }

  if (!order) {
    return (
      <Section className="pt-28 md:pt-32">
        <div className="card p-8">
          <div className="mono-label">ORDER NOT FOUND</div>
          <h1 className="mt-3 text-2xl font-semibold text-white">没有找到这张订单</h1>
          <p className="mt-2 text-white/55">{error || '这张订单可能还没有被创建，或演示数据已被重置。'}</p>
          <Link to="/ai-match" className="btn-primary mt-6">
            去提交需求 <Icon name="arrow" size={16} />
          </Link>
        </div>
      </Section>
    )
  }

  return (
    <>
      <Section className="pt-28 md:pt-32">
        <Reveal>
          <div className="card p-8 md:p-10 relative overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(55% 65% at 100% 0%, rgba(127,211,255,0.18), transparent 60%), radial-gradient(45% 55% at 0% 100%, rgba(94,234,212,0.12), transparent 60%)',
              }}
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-5 flex-wrap">
                <div>
                  <div className="mono-label">ORDER · {order.id}</div>
                  <h1 className="mt-3 text-3xl md:text-4xl font-semibold text-white tracking-tight leading-tight">
                    {order.title}
                  </h1>
                  <p className="mt-3 text-white/60 max-w-2xl leading-relaxed">
                    {order.service?.title || 'WhiteHive 自定义需求'} · {statusText[order.status] || order.status}
                  </p>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => patchOrder({ paymentStatus: 'mock_paid' }, '已模拟付款确认。')}
                    disabled={order.paymentStatus === 'mock_paid'}
                    className="btn-ghost disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {order.paymentStatus === 'mock_paid' ? '已模拟付款' : '模拟付款'}
                  </button>
                  {action && (
                    <button
                      type="button"
                      onClick={() => patchOrder({ status: action.value }, `已模拟状态更新为：${statusText[action.value]}`)}
                      className="btn-primary"
                    >
                      {action.label} <Icon name="arrow" size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-8 grid md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="mono-label">预算</div>
                  <div className="mt-1 text-2xl font-semibold text-[#BEE6FF]">
                    {formatMoney(order.budgetCents, order.currency)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="mono-label">付款状态</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {order.paymentStatus === 'mock_paid' ? '已模拟付款' : '待模拟付款'}
                  </div>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="mono-label">参与方</div>
                  <div className="mt-1 text-sm text-white/70">
                    {order.buyer?.displayName || '买家'} / {order.seller?.displayName || '卖家'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section className="!pt-4">
        <StatusTimeline status={order.status} />
      </Section>

      <Section className="!pt-4">
        <div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
          <Reveal>
            <div className="card p-6 md:p-8">
              <div className="mono-label">BRIEF · 需求说明</div>
              <pre className="mt-4 whitespace-pre-wrap text-sm text-white/70 leading-relaxed font-sans">
                {order.brief}
              </pre>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="card p-6 md:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="mono-label">MESSAGES</div>
                  <h2 className="mt-1 text-xl font-semibold text-white">订单留言</h2>
                </div>
                <span className="text-xs text-white/40">{messages.length} 条</span>
              </div>

              {notice && (
                <div className="mt-4 rounded-xl border border-[#5EEAD4]/25 bg-[#5EEAD4]/10 px-3 py-2 text-xs text-[#CFFDF5]">
                  {notice}
                </div>
              )}

              <div className="mt-5 min-h-48 max-h-[420px] overflow-y-auto space-y-3 pr-1">
                {messages.length === 0 ? (
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm text-white/45">
                    还没有留言。你可以先补充一句需求背景。
                  </div>
                ) : (
                  messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))
                )}
              </div>

              <form onSubmit={sendMessage} className="mt-5 pt-5 border-t border-white/6">
                <div className="flex gap-2 mb-3">
                  {[
                    ['usr_demo_buyer', '买家'],
                    ['usr_demo_seller', '卖家'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSender(value)}
                      className="px-3 h-8 rounded-lg text-xs border transition-colors"
                      style={{
                        borderColor: sender === value ? 'rgba(127,211,255,0.50)' : 'rgba(255,255,255,0.10)',
                        background: sender === value ? 'rgba(127,211,255,0.10)' : 'rgba(255,255,255,0.02)',
                        color: sender === value ? '#BEE6FF' : 'rgba(255,255,255,0.55)',
                      }}
                    >
                      {label}视角
                    </button>
                  ))}
                </div>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={4}
                  placeholder="写一条订单留言，例如补充需求、确认范围、提交交付说明..."
                  className="w-full bg-white/[0.03] rounded-xl border border-white/10 p-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors leading-relaxed resize-none"
                />
                <button type="submit" className="btn-primary !py-2.5 !px-5 mt-3">
                  发送留言 <Icon name="arrow" size={16} />
                </button>
              </form>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section className="!pt-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <div className="mono-label">NEXT</div>
            <p className="mt-2 text-white/65">
              这一页是后端 MVP 的第一个真实闭环。下一步会把服务发布页也接入 `/api/services`。
            </p>
          </div>
          <Link to="/sell" className="btn-ghost">
            去开设服务
          </Link>
        </motion.div>
      </Section>
    </>
  )
}
