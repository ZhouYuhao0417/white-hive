import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icons.jsx'

const quickReplies = [
  '收到，我确认一下范围和档期',
  '这是最新的交付物，请看一下',
  '能否再确认一下验收标准？',
  '方便电话沟通一下吗？',
]

function formatTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const hm = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? `今天 ${hm}` : d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function groupByDay(messages) {
  const groups = []
  let current = null
  for (const m of messages) {
    const d = new Date(m.createdAt)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!current || current.key !== key) {
      current = { key, label: d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }), items: [] }
      groups.push(current)
    }
    current.items.push(m)
  }
  return groups
}

function Avatar({ name, self, system }) {
  const letter = (name?.[0] || (system ? '客' : 'U')).toUpperCase()
  const gradient = system
    ? 'linear-gradient(135deg, #FBBF77, #F8A5D1)'
    : self
      ? 'linear-gradient(135deg, #BEE6FF, #7FD3FF)'
      : 'linear-gradient(135deg, #C7D2FE, #A5B4FC)'
  return (
    <span
      className="inline-grid place-items-center rounded-full shrink-0 font-semibold text-ink-900 select-none"
      style={{ width: 28, height: 28, fontSize: 12, background: gradient }}
    >
      {letter}
    </span>
  )
}

function Bubble({ message, role, name }) {
  // role: 'self' | 'other' | 'system'
  if (role === 'system') {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[90%] rounded-xl border border-[#FBBF77]/25 bg-[#FBBF77]/8 px-3.5 py-2 text-[11px] sm:text-xs text-[#FFE2BC] flex items-center gap-2">
          <Icon name="shield" size={12} />
          <span className="leading-relaxed">{message.body}</span>
        </div>
      </div>
    )
  }

  const isSelf = role === 'self'
  return (
    <div className={`flex gap-2 ${isSelf ? 'justify-end' : 'justify-start'}`}>
      {!isSelf && <Avatar name={name} self={false} />}
      <div className={`max-w-[78%] flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
        <div className="text-[10px] text-white/35 px-1 mb-0.5">
          {name} · {formatTime(message.createdAt)}
        </div>
        <div
          className={`rounded-2xl px-3.5 py-2.5 border text-sm leading-relaxed break-words whitespace-pre-wrap ${
            isSelf
              ? 'rounded-tr-sm bg-[#7FD3FF]/12 border-[#7FD3FF]/30 text-[#E8F7FF]'
              : 'rounded-tl-sm bg-white/[0.04] border-white/12 text-white/80'
          }`}
        >
          {message.body}
        </div>
      </div>
      {isSelf && <Avatar name={name} self />}
    </div>
  )
}

function roleOf(message, order, currentUserId) {
  if (message.senderId === 'usr_system' || message.sender?.role === 'admin') return 'system'
  const senderId = message.senderId || message.sender?.id
  if (currentUserId && senderId === currentUserId) return 'self'
  // 如果是买家视角登录，且消息也是买家发的，也算 self
  if (currentUserId && senderId && currentUserId === order?.buyerId && senderId === order?.buyerId) return 'self'
  // fallback: 买家发的靠右显示
  if (senderId === order?.buyerId) return 'self'
  return 'other'
}

function displayNameOf(message, order, role) {
  if (role === 'system') return '平台客服'
  if (message.sender?.displayName) return message.sender.displayName
  if (role === 'self') return '我'
  if (message.senderId === order?.buyerId) return order?.buyer?.displayName || '买家'
  return order?.seller?.displayName || '卖家'
}

export default function OrderChat({
  order,
  messages,
  currentSession,
  onSend,
  onOpenDispute,
  disputeActive = false,
}) {
  const [body, setBody] = useState('')
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)

  const currentUserId = currentSession?.user?.id
  const counterpart = useMemo(() => {
    if (!order) return null
    const me = currentUserId
    if (me && me === order.sellerId) return { name: order.buyer?.displayName || '买家', role: '买家', id: order.buyerId }
    return { name: order.seller?.displayName || '卖家', role: '卖家', id: order.sellerId }
  }, [order, currentUserId])

  const groups = useMemo(() => groupByDay(messages || []), [messages])

  // 自动滚到底
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  const send = async (text) => {
    const t = (text ?? body).trim()
    if (!t) return
    setBody('')
    await onSend?.(t)
  }

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="card p-0 flex flex-col overflow-hidden">
      {/* 顶部：对方信息 */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 h-14 border-b border-white/6">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={counterpart?.name} self={false} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {counterpart?.name || '对方'}
            </div>
            <div className="text-[11px] text-white/45 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4]" />
              站内沟通 · {counterpart?.role}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-white/40 px-2 py-1 rounded-md border border-white/8 bg-white/[0.02]">
            <Icon name="shield" size={11} />
            平台留痕
          </span>
          <span className="text-xs text-white/40">{messages.length} 条</span>
        </div>
      </div>

      {/* 消息区 */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-[360px] max-h-[520px] overflow-y-auto px-4 sm:px-5 py-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="h-full min-h-[240px] grid place-items-center text-center">
            <div>
              <div className="mx-auto h-10 w-10 rounded-xl bg-white/[0.04] border border-white/10 grid place-items-center text-white/45">
                <Icon name="mail" size={16} />
              </div>
              <div className="mt-3 text-sm text-white/70">还没有消息</div>
              <div className="mt-1 text-xs text-white/40 max-w-xs mx-auto leading-relaxed">
                先发一条消息开启沟通。所有对话都会在 WhiteHive 内留痕。
              </div>
            </div>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="space-y-2.5">
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/6" />
                <span className="text-[10px] text-white/35 tracking-wider">{g.label}</span>
                <div className="flex-1 h-px bg-white/6" />
              </div>
              {g.items.map((m) => {
                const role = roleOf(m, order, currentUserId)
                const name = displayNameOf(m, order, role)
                return <Bubble key={m.id} message={m} role={role} name={name} />
              })}
            </div>
          ))
        )}
      </div>

      {/* 快捷短语 */}
      <div className="px-4 sm:px-5 pt-3 pb-1 border-t border-white/6 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {quickReplies.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => send(q)}
            className="shrink-0 text-[11px] sm:text-xs px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.02] text-white/65 hover:text-white hover:border-white/25 hover:bg-white/[0.05] transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* 输入区 */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="px-4 sm:px-5 pb-4 pt-2"
      >
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          placeholder="写一条消息... (⌘/Ctrl + Enter 发送)"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors leading-relaxed resize-none"
        />
        <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenDispute}
            disabled={disputeActive}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs sm:text-sm border transition-colors ${
              disputeActive
                ? 'border-[#FBBF77]/35 bg-[#FBBF77]/10 text-[#FFE2BC] cursor-default'
                : 'border-white/12 bg-white/[0.02] text-white/70 hover:text-white hover:border-[#FBBF77]/40 hover:bg-[#FBBF77]/6'
            }`}
          >
            <Icon name="shield" size={13} />
            {disputeActive ? '平台介入处理中' : '申请平台介入'}
          </button>

          <button
            type="submit"
            disabled={!body.trim()}
            className="btn-primary !py-2 !px-4 text-sm disabled:opacity-45 disabled:cursor-not-allowed"
          >
            发送
            <Icon name="arrow" size={14} />
          </button>
        </div>

        <div className="mt-2 text-[11px] text-white/35 leading-relaxed">
          <span className="text-white/50">平台提示</span>：请勿在沟通中索取或发送站外收款方式。所有付款请走平台托管。
        </div>
      </form>
    </div>
  )
}
