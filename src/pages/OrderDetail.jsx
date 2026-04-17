import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Section, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import OrderChat from '../components/OrderChat.jsx'
import DisputeModal from '../components/DisputeModal.jsx'
import { createMessage, createPayment, getSession, listMessages, listOrders, updateOrder } from '../lib/api.js'
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

const paymentStatusText = {
  mock_pending: '待模拟付款',
  mock_paid: '资金托管中',
  mock_released: '托管已释放',
  mock_refunded: '已模拟退款',
  mock_failed: '付款失败',
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

export default function OrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState(() => readCachedOrder(id))
  const [messages, setMessages] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeActive, setDisputeActive] = useState(false)

  const action = useMemo(() => (order ? nextStatus[order.status] : null), [order])

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        const session = await getSession().catch(() => null)
        if (mounted) setCurrentSession(session)

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

  const refreshMessages = async () => {
    try {
      const data = await listMessages(id)
      setMessages(data)
    } catch {
      // 留言刷新失败不阻断主流程；用户仍可继续演示订单状态。
    }
  }

  const patchOrder = async (changes, fallbackNotice) => {
    if (!order) return
    setNotice('')
    setError('')

    try {
      const updated = await updateOrder(order.id, changes)
      setOrder(updated)
      cacheOrder(updated)
      await refreshMessages()
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

  const payOrder = async () => {
    if (!order) return
    setNotice('')
    setError('')

    try {
      const payment = await createPayment({
        orderId: order.id,
        method: 'alipay_mock',
      })
      const updated = await listOrders({ id: order.id })
      setOrder(updated)
      cacheOrder(updated)
      await refreshMessages()
      setNotice(`已创建模拟托管付款：${payment.id}`)
    } catch {
      const updated = {
        ...order,
        paymentStatus: 'mock_paid',
        updatedAt: new Date().toISOString(),
      }
      setOrder(updated)
      cacheOrder(updated)
      setNotice('已在本地演示状态中模拟付款；接入数据库后会持久保存。')
    }
  }

  const sendChatMessage = async (text) => {
    const value = (text || '').trim()
    if (!value) return
    setNotice('')

    try {
      const created = await createMessage({ orderId: id, body: value })
      setMessages((current) => [...current, created])
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `local_${Date.now()}`,
          orderId: id,
          senderId: currentSession?.user?.id || order?.buyerId || 'usr_demo_buyer',
          sender: currentSession?.user || order?.buyer || null,
          body: value,
          createdAt: new Date().toISOString(),
        },
      ])
      setNotice('消息已临时保存在当前演示会话；接入数据库后会持久保存。')
    }
  }

  const submitDispute = async ({ reason, details, contact }) => {
    const reasonLabels = {
      no_reply: '对方长时间不回复',
      delay: '交付进度延迟',
      mismatch: '交付物与需求不符',
      quality: '质量不达标',
      refund: '申请退款 / 取消',
      other: '其它争议',
    }
    const contactLabels = {
      platform: '站内消息',
      email: '邮件',
      phone: '电话',
    }

    // 1) 把当事人提交动作作为普通消息插入
    const reasonLabel = reasonLabels[reason] || reason
    const userMsg = `我申请平台介入。原因：${reasonLabel}\n详情：${details}\n联系方式偏好：${contactLabels[contact] || contact}`
    await sendChatMessage(userMsg)

    // 2) 插入一条平台系统回执
    const systemNotice = {
      id: `local_sys_${Date.now()}`,
      orderId: id,
      senderId: 'usr_system',
      sender: { role: 'admin', displayName: '平台客服' },
      body: `已收到平台介入申请（${reasonLabel}）。客服将在 24 小时内联系你与对方，资金托管已自动冻结。`,
      createdAt: new Date().toISOString(),
    }
    setMessages((current) => [...current, systemNotice])

    setDisputeActive(true)
    setDisputeOpen(false)
    setNotice('已提交平台介入申请，客服将在 24 小时内介入。')
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
                    onClick={payOrder}
                    disabled={['mock_paid', 'mock_released', 'mock_refunded'].includes(order.paymentStatus)}
                    className="btn-ghost disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {order.paymentStatus === 'mock_paid'
                      ? '资金托管中'
                      : order.paymentStatus === 'mock_released'
                        ? '托管已释放'
                        : '模拟付款'}
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
                    {paymentStatusText[order.paymentStatus] || order.paymentStatus}
                  </div>
                  {order.payment?.escrowStatus && (
                    <div className="mt-1 text-xs text-white/40">Escrow · {order.payment.escrowStatus}</div>
                  )}
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
            <div className="space-y-3">
              {notice && (
                <div className="rounded-xl border border-[#5EEAD4]/25 bg-[#5EEAD4]/10 px-3 py-2 text-xs text-[#CFFDF5]">
                  {notice}
                </div>
              )}
              <OrderChat
                order={order}
                messages={messages}
                currentSession={currentSession}
                onSend={sendChatMessage}
                onOpenDispute={() => setDisputeOpen(true)}
                disputeActive={disputeActive}
              />
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

      <DisputeModal
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        orderId={order.id}
        onSubmit={submitDispute}
      />
    </>
  )
}
