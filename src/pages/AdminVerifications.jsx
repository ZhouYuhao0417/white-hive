import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Section, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { listVerificationRequests, reviewVerification } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'

const statusOptions = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '未通过' },
  { value: 'all', label: '全部' },
]

const statusLabels = {
  pending: '待审核',
  approved: '已通过',
  rejected: '未通过',
}

const statusStyles = {
  pending: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
  approved: 'border-[#5EEAD4]/25 bg-[#5EEAD4]/10 text-[#CFFDF5]',
  rejected: 'border-red-400/25 bg-red-400/10 text-red-100',
}

const typeLabels = {
  individual: '个人实名',
  campus: '校园认证',
  studio: '团队 / 工作室',
  company: '企业主体',
}

export default function AdminVerifications() {
  const { isAuthenticated, isLoading } = useAuth()
  const [status, setStatus] = useState('pending')
  const [requests, setRequests] = useState([])
  const [notes, setNotes] = useState({})
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const counts = useMemo(() => {
    return requests.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      },
      { pending: 0, approved: 0, rejected: 0 },
    )
  }, [requests])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listVerificationRequests({ status, limit: 100 })
      setRequests(data || [])
      setNotes((current) => {
        const next = { ...current }
        ;(data || []).forEach((item) => {
          if (next[item.id] === undefined) next[item.id] = item.reviewerNote || ''
        })
        return next
      })
    } catch (err) {
      setRequests([])
      setError(err.message || '审核列表加载失败，请确认当前账号有管理员权限。')
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
      await reviewVerification(id, {
        status: nextStatus,
        reviewerNote: notes[id] || defaultReviewerNote(nextStatus),
      })
      setNotice(nextStatus === 'approved' ? '已通过这条认证申请。' : '已拒绝这条认证申请。')
      await load()
    } catch (err) {
      setError(err.message || '审核操作失败，请稍后再试。')
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
            <div className="mono-label">ADMIN · 实名审核</div>
            <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">先登录管理员账号。</h1>
            <p className="mt-4 max-w-2xl text-white/60 leading-relaxed">
              实名审核会直接改变用户可信状态，需要使用已配置在 WhiteHive 管理员名单里的账号登录。
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
            <div className="mono-label">ADMIN · 实名审核</div>
            <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">人工审核先跑起来。</h1>
                <p className="mt-4 max-w-3xl text-white/60 leading-relaxed">
                  上线初期先由管理员核对卖家的姓名和学号。成都理工校园认证会以“校园认证”类型进入这里，通过后卖家才能发布 CDUT 校园服务。
                </p>
              </div>
              <Link to="/account" className="btn-ghost shrink-0 justify-center">
                账号页 <Icon name="arrow" size={15} />
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

          <div className="grid grid-cols-3 gap-2 text-center sm:w-[360px]">
            <CountTile label="待审核" value={counts.pending} tone="pending" />
            <CountTile label="已通过" value={counts.approved} tone="approved" />
            <CountTile label="未通过" value={counts.rejected} tone="rejected" />
          </div>
        </div>

        {loading ? (
          <div className="card p-8 text-white/60">正在加载审核列表...</div>
        ) : requests.length === 0 ? (
          <div className="card p-8 text-white/60">当前筛选下没有认证申请。</div>
        ) : (
          <div className="space-y-4">
            {requests.map((item) => (
              <article key={item.id} className="card p-5 md:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-lg border px-2.5 py-1 text-xs ${statusStyles[item.status] || statusStyles.pending}`}>
                        {statusLabels[item.status] || item.status}
                      </span>
                      <span className="rounded-lg border border-[#7FD3FF]/25 bg-[#7FD3FF]/10 px-2.5 py-1 text-xs text-[#BEE6FF]">
                        {typeLabels[item.verificationType] || item.verificationType}
                      </span>
                      <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/55">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>

                    <h2 className="mt-4 text-xl font-semibold text-white">
                      {item.realName || '未命名申请'}
                    </h2>
                    <p className="mt-2 text-sm text-white/50">
                      {item.user?.displayName || item.user?.email || item.userId} · {item.role || '未填写身份'}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:w-[360px]">
                    <button
                      type="button"
                      onClick={() => submitReview(item.id, 'approved')}
                      disabled={busyId === item.id}
                      className="btn-primary justify-center"
                    >
                      <Icon name="check" size={15} />
                      {busyId === item.id ? '处理中' : '通过'}
                    </button>
                    <button
                      type="button"
                      onClick={() => submitReview(item.id, 'rejected')}
                      disabled={busyId === item.id}
                      className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100 transition-colors hover:border-red-300/40 hover:bg-red-400/15 disabled:opacity-60"
                    >
                      拒绝
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Info label="联系邮箱" value={item.contactEmail || item.user?.email} />
                  <Info label="手机号" value={item.user?.phone || '未绑定'} />
                  <Info label="学校 / 公司" value={item.schoolOrCompany || '未填写'} />
                  <Info label="城市" value={item.city || '未填写'} />
                  <Info
                    label={item.verificationType === 'campus' ? '学号' : '证件尾号'}
                    value={item.verificationType === 'campus' ? item.studentId : item.idNumberLast4}
                  />
                  <Info label="账号状态" value={item.user?.verificationStatus || '未知'} />
                  <Info label="账号来源" value={item.user?.authProvider || 'password'} />
                  <Info label="申请 ID" value={item.id} />
                </div>

                {item.evidenceUrl && (
                  <a
                    href={item.evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm text-[#BEE6FF] hover:text-white"
                  >
                    查看辅助证明链接 <Icon name="arrow" size={14} />
                  </a>
                )}

                <label className="mt-5 block">
                  <span className="mono-label">审核备注</span>
                  <textarea
                    value={notes[item.id] || ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                    rows={3}
                    placeholder="例如：姓名和学号已人工核对；或说明未通过原因。"
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
    pending: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    approved: 'border-[#5EEAD4]/20 bg-[#5EEAD4]/10 text-[#CFFDF5]',
    rejected: 'border-red-400/20 bg-red-400/10 text-red-100',
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

function formatDate(value) {
  if (!value) return '未知时间'
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

function defaultReviewerNote(status) {
  return status === 'approved' ? '人工审核通过。' : '人工审核未通过，请补充更清晰的证明材料。'
}
