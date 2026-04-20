import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Section, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { listBackendServices, reviewService } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'

const statusOptions = [
  { value: 'pending_review', label: '待审核' },
  { value: 'published', label: '已上架' },
  { value: 'rejected', label: '未通过' },
  { value: 'paused', label: '已暂停' },
  { value: 'all', label: '全部' },
]

const statusLabels = {
  draft: '草稿',
  pending_review: '待审核',
  published: '已上架',
  rejected: '未通过',
  paused: '已暂停',
  archived: '已归档',
}

const statusStyles = {
  pending_review: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
  published: 'border-[#5EEAD4]/25 bg-[#5EEAD4]/10 text-[#CFFDF5]',
  rejected: 'border-red-400/25 bg-red-400/10 text-red-100',
  paused: 'border-white/15 bg-white/[0.05] text-white/70',
  archived: 'border-white/10 bg-white/[0.03] text-white/45',
  draft: 'border-white/10 bg-white/[0.03] text-white/55',
}

export default function AdminServices() {
  const { isAuthenticated, isLoading } = useAuth()
  const [status, setStatus] = useState('pending_review')
  const [services, setServices] = useState([])
  const [notes, setNotes] = useState({})
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const counts = useMemo(() => {
    return services.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      },
      { pending_review: 0, published: 0, rejected: 0, paused: 0 },
    )
  }, [services])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listBackendServices({ status, limit: 100 })
      setServices(data || [])
      setNotes((current) => {
        const next = { ...current }
        ;(data || []).forEach((item) => {
          if (next[item.id] === undefined) next[item.id] = item.reviewNote || ''
        })
        return next
      })
    } catch (err) {
      setServices([])
      setError(err.message || '服务审核列表加载失败，请确认当前账号有管理员权限。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, status])

  const submitReview = async (id, nextStatus) => {
    setBusyId(id)
    setNotice('')
    setError('')
    try {
      await reviewService(id, {
        status: nextStatus,
        reviewNote: notes[id] || defaultReviewNote(nextStatus),
      })
      setNotice(nextStatus === 'published' ? '服务已通过审核并公开上架。' : '服务状态已更新。')
      await load()
    } catch (err) {
      setError(err.message || '服务审核操作失败，请稍后再试。')
    } finally {
      setBusyId('')
    }
  }

  if (isLoading) {
    return (
      <Section className="pt-32">
        <div className="card p-8 text-white/60">正在读取管理员状态...</div>
      </Section>
    )
  }

  if (!isAuthenticated) {
    return (
      <Section className="pt-32">
        <Reveal>
          <div className="card p-8 md:p-12">
            <div className="mono-label">ADMIN · 服务审核</div>
            <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">先登录管理员账号。</h1>
            <p className="mt-4 max-w-2xl text-white/60 leading-relaxed">
              服务审核会决定哪些服务可以公开展示和接单，需要使用已配置在 WhiteHive 管理员名单里的账号登录。
            </p>
            <Link to="/account" className="btn-primary mt-7">
              去登录 <Icon name="arrow" size={16} />
            </Link>
          </div>
        </Reveal>
      </Section>
    )
  }

  return (
    <>
      <Section className="pt-28 md:pt-32">
        <Reveal>
          <div className="card p-8 md:p-12">
            <div className="mono-label">ADMIN · 服务审核</div>
            <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">先人工把关，再公开接单。</h1>
                <p className="mt-4 max-w-3xl text-white/60 leading-relaxed">
                  卖家提交的服务默认进入待审核。管理员确认标题、价格、分类、交付范围和资质风险后，服务才会公开展示给买家。
                </p>
              </div>
              <Link to="/admin/verifications" className="btn-ghost shrink-0 justify-center">
                实名审核 <Icon name="arrow" size={15} />
              </Link>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section className="!pt-4">
        {(notice || error) && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              error
                ? 'border-red-400/25 bg-red-400/10 text-red-100'
                : 'border-[#5EEAD4]/25 bg-[#5EEAD4]/10 text-[#CFFDF5]'
            }`}
          >
            {error || notice}
          </div>
        )}

        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={`h-10 rounded-xl border px-4 text-sm transition-colors ${
                  status === option.value
                    ? 'border-[#7FD3FF]/40 bg-[#7FD3FF]/12 text-[#BEE6FF]'
                    : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2 text-center sm:w-[440px]">
            <CountTile label="待审" value={counts.pending_review} tone="pending_review" />
            <CountTile label="上架" value={counts.published} tone="published" />
            <CountTile label="拒绝" value={counts.rejected} tone="rejected" />
            <CountTile label="暂停" value={counts.paused} tone="paused" />
          </div>
        </div>

        {loading ? (
          <div className="card p-8 text-white/60">正在加载服务审核列表...</div>
        ) : services.length === 0 ? (
          <div className="card p-8 text-white/60">当前筛选下没有服务。</div>
        ) : (
          <div className="space-y-4">
            {services.map((service) => (
              <article key={service.id} className="card p-5 md:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-lg border px-2.5 py-1 text-xs ${statusStyles[service.status] || statusStyles.draft}`}>
                        {statusLabels[service.status] || service.status}
                      </span>
                      <span className="rounded-lg border border-[#7FD3FF]/25 bg-[#7FD3FF]/10 px-2.5 py-1 text-xs text-[#BEE6FF]">
                        {service.category}
                      </span>
                      <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/55">
                        {formatDate(service.createdAt)}
                      </span>
                    </div>

                    <h2 className="mt-4 text-xl font-semibold text-white">{service.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/60">{service.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/45">
                      {(service.tags || []).map((tag) => (
                        <span key={tag} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:w-[360px]">
                    <button
                      type="button"
                      onClick={() => submitReview(service.id, 'published')}
                      disabled={busyId === service.id}
                      className="btn-primary justify-center"
                    >
                      <Icon name="check" size={15} />
                      {busyId === service.id ? '处理中' : '通过上架'}
                    </button>
                    <button
                      type="button"
                      onClick={() => submitReview(service.id, 'rejected')}
                      disabled={busyId === service.id}
                      className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100 transition-colors hover:border-red-300/40 hover:bg-red-400/15 disabled:opacity-60"
                    >
                      拒绝
                    </button>
                    <button
                      type="button"
                      onClick={() => submitReview(service.id, 'paused')}
                      disabled={busyId === service.id}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:opacity-60 sm:col-span-2"
                    >
                      暂停服务
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Info label="卖家" value={service.seller?.displayName || service.sellerId} />
                  <Info label="卖家实名" value={service.seller?.verificationStatus || '未知'} />
                  <Info label="起步价" value={formatMoney(service.priceCents, service.currency)} />
                  <Info label="交付周期" value={`${service.deliveryDays || 0} 天`} />
                  <Info label="服务 ID" value={service.id} />
                  <Info label="卖家 ID" value={service.sellerId} />
                  <Info label="审核时间" value={formatDate(service.reviewedAt)} />
                  <Info label="审核备注" value={service.reviewNote || '未填写'} />
                </div>

                <label className="mt-5 block">
                  <span className="mono-label">审核备注</span>
                  <textarea
                    value={notes[service.id] || ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [service.id]: event.target.value }))}
                    rows={3}
                    placeholder="例如：服务描述清楚，价格合理；或说明需补充资质/修改标题/调整交付边界。"
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] focus:outline-none"
                  />
                </label>
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}

function CountTile({ label, value, tone }) {
  const colors = {
    pending_review: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    published: 'border-[#5EEAD4]/20 bg-[#5EEAD4]/10 text-[#CFFDF5]',
    rejected: 'border-red-400/20 bg-red-400/10 text-red-100',
    paused: 'border-white/10 bg-white/[0.04] text-white/70',
  }

  return (
    <div className={`rounded-xl border px-3 py-2 ${colors[tone]}`}>
      <div className="text-base font-semibold">{value}</div>
      <div className="mt-0.5 text-[11px] opacity-75">{label}</div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="mono-label">{label}</div>
      <div className="mt-1 truncate text-sm text-white/70">{value || '未填写'}</div>
    </div>
  )
}

function formatMoney(cents, currency = 'CNY') {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(cents || 0) / 100)
}

function formatDate(value) {
  if (!value) return '未审核'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function defaultReviewNote(status) {
  if (status === 'published') return '服务信息清晰，人工审核通过。'
  if (status === 'paused') return '服务暂时下架，请补充或修正信息后再提交。'
  return '服务未通过审核，请补充更清晰的交付范围、资质或证明材料。'
}
