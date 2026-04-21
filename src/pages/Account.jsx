import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Section, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import SellerLevelBadge from '../components/SellerLevelBadge.jsx'
import { computeSellerLevel } from '../lib/sellerLevel.js'
import {
  confirmEmailVerification,
  confirmPhoneVerification,
  getCurrentVerificationProfile,
  requestEmailVerification,
  requestPhoneVerification,
  submitCurrentVerification,
  updateProfile,
} from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'

const verificationLabels = {
  unverified: '未认证',
  pending: '审核中',
  verified: '已认证',
  rejected: '未通过',
}

const requestStatusLabels = {
  pending: '待审核',
  approved: '已通过',
  rejected: '未通过',
}

const verificationTypeLabels = {
  individual: '个人',
  campus: '校园学生',
  studio: '团队 / 工作室',
  company: '企业主体',
}

const initialVerificationForm = {
  verificationType: 'individual',
  realName: '',
  studentId: '',
  role: '个人创作者',
  idNumberLast4: '',
  contactEmail: '',
  schoolOrCompany: '',
  city: '',
  evidenceUrl: '',
}

export default function Account() {
  const { user, isAuthenticated, isLoading, refreshUser, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [emailCode, setEmailCode] = useState('')
  const [emailChallenge, setEmailChallenge] = useState(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneChallenge, setPhoneChallenge] = useState(null)
  const [phoneBusy, setPhoneBusy] = useState(false)
  const [phoneVerifyBusy, setPhoneVerifyBusy] = useState(false)
  const [roleBusy, setRoleBusy] = useState(false)
  const [verificationProfile, setVerificationProfile] = useState(null)
  const [verificationForm, setVerificationForm] = useState(initialVerificationForm)
  const [submittingVerification, setSubmittingVerification] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    getCurrentVerificationProfile()
      .then((profile) => {
        if (cancelled) return
        setVerificationProfile(profile)
        setVerificationForm((current) => ({
          ...current,
          contactEmail: profile?.user?.email || user?.email || '',
          schoolOrCompany: profile?.user?.schoolOrCompany || '',
          city: profile?.user?.city || '',
        }))
      })
      .catch(() => {
        if (!cancelled) setError('实名认证状态暂时加载失败，请稍后刷新。')
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user?.email])

  const updateVerificationForm = (field, value) => {
    setVerificationForm((current) => ({ ...current, [field]: value }))
    setNotice('')
    setError('')
  }

  const sendEmailCode = async () => {
    setEmailBusy(true)
    setNotice('')
    setError('')
    try {
      const result = await requestEmailVerification()
      setEmailChallenge(result.emailVerification)
      setEmailCode('')
      setNotice(result.emailVerification?.delivery?.message || '验证码已发送。')
    } catch (err) {
      setError(err.message || '发送验证码失败，请稍后再试。')
    } finally {
      setEmailBusy(false)
    }
  }

  const verifyEmail = async () => {
    setVerifyBusy(true)
    setNotice('')
    setError('')
    try {
      await confirmEmailVerification(emailCode)
      await refreshUser()
      setEmailChallenge(null)
      setEmailCode('')
      setNotice('邮箱验证完成。')
    } catch (err) {
      setError(err.message || '验证码不正确，请重新输入。')
    } finally {
      setVerifyBusy(false)
    }
  }

  const sendPhoneCode = async () => {
    setPhoneBusy(true)
    setNotice('')
    setError('')
    try {
      const phoneToUse = phoneInput || user?.phone || ''
      const result = await requestPhoneVerification(phoneToUse)
      setPhoneChallenge(result.phoneVerification)
      setPhoneCode('')
      setNotice(result.phoneVerification?.delivery?.message || '短信验证码已发送。')
    } catch (err) {
      setError(err.message || '发送短信验证码失败，请稍后再试。')
    } finally {
      setPhoneBusy(false)
    }
  }

  const verifyPhone = async () => {
    setPhoneVerifyBusy(true)
    setNotice('')
    setError('')
    try {
      const phoneToUse = phoneInput || phoneChallenge?.phone || user?.phone || ''
      await confirmPhoneVerification(phoneToUse, phoneCode)
      await refreshUser()
      setPhoneChallenge(null)
      setPhoneCode('')
      setPhoneInput('')
      setNotice('手机号验证完成。')
    } catch (err) {
      setError(err.message || '短信验证码不正确，请重新输入。')
    } finally {
      setPhoneVerifyBusy(false)
    }
  }

  const submitRealName = async (event) => {
    event.preventDefault()
    setSubmittingVerification(true)
    setNotice('')
    setError('')
    try {
      const payload =
        verificationForm.verificationType === 'campus'
          ? {
              verificationType: 'campus',
              realName: verificationForm.realName,
              studentId: verificationForm.studentId,
              role: '成都理工校园服务者',
            }
          : verificationForm
      const result = await submitCurrentVerification(payload)
      await refreshUser()
      setVerificationProfile((current) => ({
        ...(current || {}),
        user: result.user,
        latestRequest: result.request,
        history: [result.request, ...((current?.history || []).filter((item) => item.id !== result.request.id))],
      }))
      setNotice('实名认证申请已提交，当前状态为待审核。')
    } catch (err) {
      setError(err.message || '实名认证提交失败，请检查信息后重试。')
    } finally {
      setSubmittingVerification(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('确定注销当前账号吗？没有订单/服务/消息的测试账号会被直接删除，这个操作不能撤销。')) {
      return
    }

    setNotice('')
    setError('')
    try {
      await deleteAccount()
      navigate('/')
    } catch (err) {
      setError(err.message || '注销账户失败，请稍后再试。')
    }
  }

  const becomeSeller = async () => {
    setRoleBusy(true)
    setNotice('')
    setError('')
    try {
      const result = await updateProfile({ role: 'seller' })
      await refreshUser()
      setNotice(result?.user?.verificationStatus === 'verified'
        ? '已切换为创作者账号，现在可以发布服务了。'
        : '已切换为创作者账号。发布服务后会进入人工审核。')
    } catch (err) {
      setError(err.message || '切换创作者账号失败，请稍后再试。')
    } finally {
      setRoleBusy(false)
    }
  }

  if (isLoading) {
    return (
      <Section className="pt-32">
        <div className="card p-8 text-white/60">正在读取账号状态...</div>
      </Section>
    )
  }

  if (!isAuthenticated) {
    return (
      <Section className="pt-32">
        <Reveal>
          <div className="card p-8 md:p-12">
            <div className="mono-label">ACCOUNT · 账号与认证</div>
            <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">先登录，再管理可信资料。</h1>
            <p className="mt-4 max-w-2xl text-white/60 leading-relaxed">
              邮箱验证和实名认证都绑定到真实账号。请先点击右上角「登录/注册」，完成后再回来查看。
            </p>
            <Link to="/" className="btn-primary mt-7">
              回到首页 <Icon name="arrow" size={16} />
            </Link>
          </div>
        </Reveal>
      </Section>
    )
  }

  const latestRequest = verificationProfile?.latestRequest
  const isCampusVerification = verificationForm.verificationType === 'campus'
  const canRequestCampusVerification = ['seller', 'admin'].includes(user.role)

  return (
    <>
      <Section className="pt-28 md:pt-32">
        <Reveal>
          <div className="card p-8 md:p-12 relative overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(60% 70% at 100% 0%, rgba(127,211,255,0.18), transparent 60%), radial-gradient(50% 60% at 0% 100%, rgba(94,234,212,0.11), transparent 60%)',
              }}
            />
            <div className="relative">
              <div className="mono-label">ACCOUNT · 账号与认证</div>
              <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
                让账号先可信,
                <br className="hidden md:block" />
                交易才走得稳。
              </h1>
              <p className="mt-5 max-w-2xl text-white/60 leading-relaxed">
                这里管理 WhiteHive 的基础身份能力：邮箱验证、实名认证申请和审核状态。后续支付、接单、仲裁都会复用这些可信资料。
              </p>
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

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
          <div className="space-y-6">
            <div className="card p-6 md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#7FD3FF]/25 bg-[#7FD3FF]/10 grid place-items-center text-lg font-semibold text-[#BEE6FF]">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName || user.email || '用户头像'} className="h-full w-full object-cover" />
                    ) : (
                      (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="mono-label">PROFILE</div>
                    <h2 className="mt-1 truncate text-xl font-semibold text-white">{user.displayName || user.email}</h2>
                    <p className="mt-2 truncate text-sm text-white/50">{user.email}</p>
                  </div>
                </div>
                <span className="rounded-full border border-[#7FD3FF]/25 bg-[#7FD3FF]/10 px-3 py-1 text-xs text-[#BEE6FF]">
                  {user.role === 'seller' ? '创作者' : '买家'}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <StatusTile label="邮箱" value={user.emailVerified ? '已验证' : '待验证'} active={user.emailVerified} />
                <StatusTile label="手机号" value={user.phoneVerified ? '已验证' : '待验证'} active={user.phoneVerified} />
                <StatusTile
                  label="实名认证"
                  value={verificationLabels[user.verificationStatus] || '未认证'}
                  active={user.verificationStatus === 'verified'}
                />
              </div>
              {user.role !== 'seller' && user.role !== 'admin' && (
                <div className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4">
                  <div className="text-sm font-medium text-amber-100">想发布服务，需要先切换为创作者账号。</div>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">
                    实名认证负责证明身份真实；账号角色负责开放接单和服务发布权限。切换后不影响你作为买家下单。
                  </p>
                  <button
                    type="button"
                    onClick={becomeSeller}
                    disabled={roleBusy}
                    className="btn-primary mt-4 w-full justify-center !py-2.5 disabled:opacity-60"
                  >
                    {roleBusy ? '切换中...' : '切换为创作者账号'}
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              )}
              {user.role === 'seller' && (() => {
                const stats = {
                  ordersCompleted: user.stats?.ordersCompleted || 0,
                  avgRating: Number.isFinite(user.stats?.avgRating) ? user.stats.avgRating : null,
                }
                const lv = computeSellerLevel(stats)
                return (
                  <div
                    className="mt-5 rounded-xl border p-4"
                    style={{
                      borderColor: `${lv.color}45`,
                      background: `${lv.color}10`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="mono-label" style={{ color: lv.color }}>SELLER LEVEL · 卖家等级</div>
                      <SellerLevelBadge level={lv} size="lg" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-white/65">
                      <div>
                        已完成订单
                        <div className="mt-0.5 text-base font-semibold text-white">{stats.ordersCompleted}</div>
                      </div>
                      <div>
                        平均评分
                        <div className="mt-0.5 text-base font-semibold text-white">
                          {stats.avgRating != null ? `★ ${stats.avgRating.toFixed(1)}` : '暂无评分'}
                        </div>
                      </div>
                    </div>
                    {lv.next ? (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] text-white/55">
                          <span>升到 Lv.{lv.next.tier} 还差 {lv.progress.ordersNeeded} 单{lv.progress.ratingNeeded > 0 ? ` · 评分再涨 ${lv.progress.ratingNeeded}` : ''}</span>
                          <span>{Math.round(lv.progress.ordersPct * 100)}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-[width]"
                            style={{ width: `${Math.round(lv.progress.ordersPct * 100)}%`, background: lv.color }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-[11px] text-white/55">已封顶。</p>
                    )}
                  </div>
                )
              })()}

              <button
                type="button"
                onClick={handleDeleteAccount}
                className="mt-5 w-full rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-100/80 transition-colors hover:border-red-300/35 hover:bg-red-400/10"
              >
                注销测试账号
              </button>
              <p className="mt-2 text-xs leading-relaxed text-white/35">
                为保护订单关系，已有服务、订单或消息的账号不会被硬删除。
              </p>
            </div>

            <div className="card p-6 md:p-7">
              <div className="mono-label">EMAIL VERIFY</div>
              <h2 className="mt-1 text-xl font-semibold text-white">邮箱验证</h2>
              <p className="mt-2 text-sm text-white/55 leading-relaxed">
                邮箱验证用于找回账号、接收订单通知和后续支付提醒。当前先支持验证码流。
              </p>

              {user.emailVerified ? (
                <div className="mt-5 rounded-xl border border-[#5EEAD4]/25 bg-[#5EEAD4]/10 px-4 py-3 text-sm text-[#CFFDF5] break-all">
                  已验证：{user.emailVerifiedAt || '状态已同步'}
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {emailChallenge?.delivery?.message && (
                    <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                      {emailChallenge.delivery.message}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={emailCode}
                      onChange={(event) => setEmailCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6 位验证码"
                      className="flex-1 h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05]"
                    />
                    <button type="button" onClick={verifyEmail} disabled={verifyBusy} className="btn-primary !px-4">
                      {verifyBusy ? '验证中' : '验证'}
                    </button>
                  </div>
                  <button type="button" onClick={sendEmailCode} disabled={emailBusy} className="btn-ghost w-full justify-center">
                    {emailBusy ? '发送中...' : '发送 / 重发验证码'}
                  </button>
                </div>
              )}
            </div>

            <div className="card p-6 md:p-7">
              <div className="mono-label">PHONE VERIFY</div>
              <h2 className="mt-1 text-xl font-semibold text-white">手机号验证</h2>
              <p className="mt-2 text-sm text-white/55 leading-relaxed">
                手机号用于接单提醒、订单状态同步和交易过程中的安全联系。目前接入 Spug 短信验证码。
              </p>

              {user.phoneVerified ? (
                <div className="mt-5 rounded-xl border border-[#5EEAD4]/25 bg-[#5EEAD4]/10 px-4 py-3 text-sm text-[#CFFDF5]">
                  已验证：{user.phone || '手机号已绑定'}
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <input
                    value={phoneInput}
                    onChange={(event) => setPhoneInput(event.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="中国大陆 11 位手机号"
                    className="w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05]"
                  />
                  {phoneChallenge?.delivery?.message && (
                    <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                      {phoneChallenge.delivery.message}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={phoneCode}
                      onChange={(event) => setPhoneCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6 位短信验证码"
                      className="flex-1 h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05]"
                    />
                    <button
                      type="button"
                      onClick={verifyPhone}
                      disabled={phoneVerifyBusy || !phoneCode}
                      className="btn-primary !px-4"
                    >
                      {phoneVerifyBusy ? '验证中' : '验证'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={sendPhoneCode}
                    disabled={phoneBusy}
                    className="btn-ghost w-full justify-center"
                  >
                    {phoneBusy ? '发送中...' : '发送 / 重发短信验证码'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mono-label">REAL-NAME VERIFY</div>
                <h2 className="mt-1 text-xl font-semibold text-white">实名认证</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/60">
                {verificationLabels[user.verificationStatus] || '未认证'}
              </span>
            </div>

            {latestRequest && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">最近一次申请</div>
                  <span className="rounded-lg border border-[#7FD3FF]/25 bg-[#7FD3FF]/10 px-2 py-1 text-xs text-[#BEE6FF]">
                    {requestStatusLabels[latestRequest.status] || latestRequest.status}
                  </span>
                </div>
                <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs text-white/50 break-all">
                  <div className="min-w-0">主体：{latestRequest.realName}</div>
                  <div className="min-w-0">身份：{latestRequest.role}</div>
                  <div className="min-w-0">类型：{verificationTypeLabels[latestRequest.verificationType] || latestRequest.verificationType || '个人'}</div>
                  <div className="min-w-0">城市：{latestRequest.city || '未填'}</div>
                  <div className="min-w-0">学校/公司：{latestRequest.schoolOrCompany || '未填'}</div>
                  <div className="min-w-0">
                    {latestRequest.verificationType === 'campus'
                      ? `学号：${latestRequest.studentId || '未填'}`
                      : `证件尾号：${latestRequest.idNumberLast4 || '未填'}`}
                  </div>
                  <div className="min-w-0">联系邮箱：{latestRequest.contactEmail}</div>
                </div>
                {latestRequest.evidenceUrl && (
                  <a
                    href={latestRequest.evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-xs text-[#BEE6FF] hover:text-white"
                  >
                    查看辅助证明链接
                  </a>
                )}
                {latestRequest.reviewerNote && (
                  <p className="mt-3 text-xs text-white/45">审核备注：{latestRequest.reviewerNote}</p>
                )}
              </div>
            )}

            <form className="mt-6 space-y-4" onSubmit={submitRealName}>
              <label className="block">
                <span className="mono-label">认证类型</span>
                <select
                  value={verificationForm.verificationType}
                  onChange={(event) => updateVerificationForm('verificationType', event.target.value)}
                  className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-ink-900"
                >
                  <option value="individual">个人</option>
                  {canRequestCampusVerification && <option value="campus">校园卖家 / CDUT</option>}
                  <option value="studio">团队 / 工作室</option>
                  <option value="company">企业主体</option>
                </select>
              </label>
              <label className="block">
                <span className="mono-label">真实姓名 / 主体名称</span>
                <input
                  value={verificationForm.realName}
                  onChange={(event) => updateVerificationForm('realName', event.target.value)}
                  required
                  minLength={2}
                  placeholder={isCampusVerification ? '请输入真实姓名' : '例如：周煜皓 / 白色蜂巢工作室'}
                  className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05]"
                />
              </label>
              {isCampusVerification ? (
                <label className="block">
                  <span className="mono-label">成都理工学号</span>
                  <input
                    value={verificationForm.studentId}
                    onChange={(event) => updateVerificationForm('studentId', event.target.value.replace(/[^\dA-Za-z]/g, '').slice(0, 24))}
                    required
                    placeholder="仅用于人工核对，不公开展示"
                    className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05]"
                  />
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className="mono-label">认证身份</span>
                    <select
                      value={verificationForm.role}
                      onChange={(event) => updateVerificationForm('role', event.target.value)}
                      className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-ink-900"
                    >
                      <option value="个人创作者">个人创作者</option>
                      <option value="买家个人">买家个人</option>
                      <option value="团队 / 工作室">团队 / 工作室</option>
                      <option value="企业主体">企业主体</option>
                    </select>
                  </label>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mono-label">学校 / 公司</span>
                      <input
                        value={verificationForm.schoolOrCompany}
                        onChange={(event) => updateVerificationForm('schoolOrCompany', event.target.value)}
                        placeholder="例如：成都理工大学"
                        className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05]"
                      />
                    </label>
                    <label className="block">
                      <span className="mono-label">所在城市</span>
                      <input
                        value={verificationForm.city}
                        onChange={(event) => updateVerificationForm('city', event.target.value)}
                        placeholder="例如：成都"
                        className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05]"
                      />
                    </label>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mono-label">证件后 4 位</span>
                      <input
                        value={verificationForm.idNumberLast4}
                        onChange={(event) => updateVerificationForm('idNumberLast4', event.target.value.replace(/[^\dXx]/g, '').slice(-4))}
                        placeholder="用于人工核对"
                        className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05]"
                      />
                    </label>
                    <label className="block">
                      <span className="mono-label">联系邮箱</span>
                      <input
                        type="email"
                        value={verificationForm.contactEmail}
                        onChange={(event) => updateVerificationForm('contactEmail', event.target.value)}
                        required
                        className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05]"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mono-label">辅助证明链接</span>
                    <input
                      type="url"
                      value={verificationForm.evidenceUrl}
                      onChange={(event) => updateVerificationForm('evidenceUrl', event.target.value)}
                      placeholder="选填，HTTPS 链接，例如作品集/学生主页/企业官网"
                      className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05]"
                    />
                  </label>
                </>
              )}
              <p className="text-xs text-white/40 leading-relaxed">
                {isCampusVerification
                  ? 'CDUT 专区买家登录即可交易；只有发布校园服务的卖家需要提交姓名和学号，先由平台人工审核。'
                  : '当前采用最小化采集原则，只保存人工审核需要的字段和可公开证明链接。后续接入合规实名服务商前，会同步更新隐私政策、授权说明和数据留存策略。'}
              </p>
              <button type="submit" disabled={submittingVerification} className="btn-primary w-full justify-center">
                {submittingVerification ? '提交中...' : '提交实名认证申请'}
                <Icon name="arrow" size={16} />
              </button>
            </form>
          </div>
        </div>
      </Section>
    </>
  )
}

function StatusTile({ label, value, active }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        active ? 'border-[#5EEAD4]/25 bg-[#5EEAD4]/10' : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <div className="mono-label">{label}</div>
      <div className={`mt-2 text-sm font-medium ${active ? 'text-[#CFFDF5]' : 'text-white/70'}`}>{value}</div>
    </div>
  )
}
