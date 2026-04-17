import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from './Icons.jsx'

const reasons = [
  { key: 'no_reply', label: '对方长时间不回复', hint: '超过 48 小时未收到回应' },
  { key: 'delay', label: '交付进度明显延迟', hint: '已超过约定完成时间' },
  { key: 'mismatch', label: '交付物与需求不符', hint: '与订单约定范围 / 质量差距大' },
  { key: 'quality', label: '质量 / 专业度不达标', hint: '返修多轮仍无法达标' },
  { key: 'refund', label: '希望退款 / 取消订单', hint: '已无法继续合作' },
  { key: 'other', label: '其它争议', hint: '请在下方详细说明' },
]

export default function DisputeModal({ open, onClose, orderId, onSubmit }) {
  const [reason, setReason] = useState('no_reply')
  const [details, setDetails] = useState('')
  const [contact, setContact] = useState('platform')
  const [submitting, setSubmitting] = useState(false)

  // reset when closed
  useEffect(() => {
    if (!open) {
      setReason('no_reply')
      setDetails('')
      setContact('platform')
      setSubmitting(false)
    }
  }, [open])

  // esc + lock body scroll
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const submit = async (e) => {
    e.preventDefault()
    if (details.trim().length < 10) return
    setSubmitting(true)
    try {
      await onSubmit?.({ reason, details: details.trim(), contact })
    } finally {
      setSubmitting(false)
    }
  }

  const activeReason = reasons.find((r) => r.key === reason)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dispute-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6"
          onMouseDown={(e) => {
            // 点击外层空白区域关闭（不拦截子元素事件）
            if (e.target === e.currentTarget) onClose()
          }}
        >
          {/* backdrop */}
          <div className="absolute inset-0 -z-10 bg-black/60 backdrop-blur-sm" />

          {/* modal */}
          <motion.div
            key="dispute-modal"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative w-full max-w-[560px] max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)] rounded-2xl bg-ink-900 border border-white/10 shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
          >
            {/* header */}
            <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 h-14 border-b border-white/5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-8 w-8 rounded-lg bg-[#FBBF77]/12 border border-[#FBBF77]/30 text-[#FBBF77] grid place-items-center shrink-0">
                  <Icon name="shield" size={15} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">申请平台介入</div>
                  <div className="text-[11px] text-white/45 truncate">订单 {orderId}</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 grid place-items-center rounded-lg text-white/55 hover:text-white hover:bg-white/5 transition-colors shrink-0"
                aria-label="close"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* scrollable body */}
            <form
              id="dispute-form"
              onSubmit={submit}
              className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5"
            >
              <p className="text-xs sm:text-sm text-white/55 leading-relaxed">
                当买卖双方无法自行协商时，平台客服可在 24 小时内介入。请先选择主要原因，并补充关键事实与时间节点。
              </p>

              <div className="mt-4 sm:mt-5">
                <div className="mono-label mb-2">争议原因</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {reasons.map((r) => {
                    const active = reason === r.key
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setReason(r.key)}
                        className={`text-left rounded-xl border p-2.5 sm:p-3 transition-colors ${
                          active
                            ? 'border-[#7FD3FF]/55 bg-[#7FD3FF]/[0.07]'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-3.5 w-3.5 rounded-full border shrink-0 ${
                              active ? 'border-[#7FD3FF] bg-[#7FD3FF]' : 'border-white/25'
                            }`}
                          />
                          <span className="text-sm text-white">{r.label}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/45 pl-5">{r.hint}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-4 sm:mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="mono-label">详细说明</span>
                  <span className="text-[10px] text-white/35">{details.length} / 600</span>
                </div>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 600))}
                  rows={4}
                  placeholder={`例如：${activeReason?.label || '请描述事实'} · 关键时间节点 · 双方沟通情况 · 期望的处理方式。`}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors resize-none leading-relaxed"
                />
                {details.trim().length > 0 && details.trim().length < 10 && (
                  <div className="mt-1 text-[11px] text-[#FBBF77]">至少填写 10 个字，客服才能快速理解情况。</div>
                )}
              </div>

              <div className="mt-4 sm:mt-5">
                <div className="mono-label mb-2">联系方式偏好</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'platform', label: '站内消息' },
                    { v: 'email', label: '邮件联系' },
                    { v: 'phone', label: '电话联系' },
                  ].map((opt) => {
                    const active = contact === opt.v
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setContact(opt.v)}
                        className={`h-10 rounded-xl text-xs sm:text-sm border transition-colors ${
                          active
                            ? 'bg-[#7FD3FF]/10 border-[#7FD3FF]/55 text-white'
                            : 'bg-white/[0.02] border-white/10 text-white/65 hover:border-white/25'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-4 sm:mt-5 rounded-xl border border-white/8 bg-black/20 px-3.5 py-2.5 text-[11px] sm:text-xs text-white/55 leading-relaxed">
                提交后，订单会进入「争议处理中」状态，资金托管将自动冻结。客服会在 24 小时内联系双方并查看站内完整沟通记录。
              </div>
            </form>

            {/* sticky footer —— 按钮始终可见 */}
            <div className="shrink-0 flex items-center justify-end gap-2.5 px-5 sm:px-6 py-3 sm:py-4 border-t border-white/8 bg-ink-900">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                form="dispute-form"
                disabled={submitting || details.trim().length < 10}
                className="btn-primary !py-2 !px-5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '提交中...' : '提交介入申请'}
                <Icon name="arrow" size={15} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
