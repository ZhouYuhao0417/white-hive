import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Icon,
  GithubLogo,
  WechatLogo,
  QQLogo,
  PhoneLogo,
} from './Icons.jsx'
import Logo from './Logo.jsx'
import { useAuth } from '../lib/auth.jsx'

// 邮箱已经是上面的主表单登录方式, 这里不再重复出现
const socialMethods = [
  { key: 'phone',  label: '手机号', Logo: PhoneLogo,  color: '#A5B4FC' },
  { key: 'wechat', label: '微信',   Logo: WechatLogo, color: '#22C55E' },
  { key: 'qq',     label: 'QQ',     Logo: QQLogo,     color: '#7FD3FF' },
  { key: 'github', label: 'GitHub', Logo: GithubLogo, color: '#E6E9F2' },
]

const initialForm = {
  email: '',
  password: '',
  confirmPassword: '',
  displayName: '',
  role: 'buyer',
  phone: '',
  schoolOrCompany: '',
  city: '',
  bio: '',
  avatarUrl: '',
}

const avatarMaxFileSize = 2 * 1024 * 1024

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('头像读取失败，请换一张图片。'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('头像图片无法识别，请换一张 PNG、JPG 或 WebP。'))
    image.src = src
  })
}

async function createAvatarDataUrl(file) {
  if (!file) return ''
  if (!file.type.startsWith('image/')) {
    throw new Error('请上传图片格式的头像。')
  }

  if (file.size > avatarMaxFileSize) {
    throw new Error('头像文件请控制在 2MB 以内。')
  }

  const rawDataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(rawDataUrl)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  const side = Math.min(image.width, image.height)
  const sourceX = Math.max(0, (image.width - side) / 2)
  const sourceY = Math.max(0, (image.height - side) / 2)
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, size, size)
  return canvas.toDataURL('image/jpeg', 0.82)
}

export default function AuthDrawer({ open, onClose }) {
  const {
    login,
    signup,
    loginWithProvider,
    getProviderStatus,
    requestEmailVerification,
    confirmEmailVerification,
    requestPhoneVerification,
    confirmPhoneVerification,
    requestPasswordReset,
    confirmPasswordReset,
  } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [socialBusy, setSocialBusy] = useState('')
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false)
  const [isSendingVerification, setIsSendingVerification] = useState(false)
  const [isConfirmingVerification, setIsConfirmingVerification] = useState(false)
  const [isSendingPhoneVerification, setIsSendingPhoneVerification] = useState(false)
  const [isConfirmingPhoneVerification, setIsConfirmingPhoneVerification] = useState(false)
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false)
  const [isConfirmingPasswordReset, setIsConfirmingPasswordReset] = useState(false)
  const [emailChallenge, setEmailChallenge] = useState(null)
  const [phoneChallenge, setPhoneChallenge] = useState(null)
  const [passwordResetChallenge, setPasswordResetChallenge] = useState(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('')
  const [passwordResetCode, setPasswordResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [providerStatus, setProviderStatus] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const hasEmailChallenge = emailChallenge?.status === 'pending'
  const hasPhoneChallenge = phoneChallenge?.status === 'pending'

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setNotice('')
    setError('')
  }

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const status = await getProviderStatus()
        if (!cancelled) setProviderStatus(status)
      } catch {
        if (!cancelled) setProviderStatus(null)
      }
    })()
    return () => { cancelled = true }
  }, [getProviderStatus, open])

  const resetTransientAuthState = () => {
    setEmailChallenge(null)
    setPhoneChallenge(null)
    setPasswordResetChallenge(null)
    setVerificationCode('')
    setPhoneVerificationCode('')
    setPasswordResetCode('')
    setNewPassword('')
    setConfirmNewPassword('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (hasEmailChallenge || hasPhoneChallenge) return
    const isSignup = mode === 'signup'
    const signupPhone = form.phone.replace(/[^\d]/g, '')

    if (isSignup && form.password !== form.confirmPassword) {
      setError('两次输入的密码不一致。')
      return
    }

    if (isSignup && form.displayName.trim().length < 2) {
      setError('请填写至少 2 个字的昵称或团队名。')
      return
    }

    if (isSignup && !/^1[3-9]\d{9}$/.test(signupPhone)) {
      setError('请填写可接收短信验证码的 11 位中国大陆手机号。')
      return
    }

    setIsSubmitting(true)
    setNotice('')
    setError('')

    try {
      const payload = {
        email: form.email,
        password: form.password,
        mode: isSignup ? form.role : 'signin',
        role: form.role,
        displayName: form.displayName,
        phone: isSignup ? signupPhone : form.phone,
        schoolOrCompany: form.schoolOrCompany,
        city: form.city,
        bio: form.bio,
        avatarUrl: form.avatarUrl,
      }

      const result = isSignup ? await signup(payload) : await login(payload)
      const name = result?.user?.displayName || result?.user?.email || '用户'

      if (isSignup) {
        const challenge = await requestPhoneVerification(signupPhone)
        const phoneVerification = challenge?.phoneVerification || null
        if (phoneVerification?.status === 'verified') {
          setNotice(`账户已创建，手机号已验证：${name}。`)
          setTimeout(() => {
            onClose()
            setForm(initialForm)
            resetTransientAuthState()
            setNotice('')
            setError('')
            setMode('signin')
          }, 800)
          return
        }

        if (phoneVerification?.status === 'pending') {
          setPhoneChallenge(phoneVerification)
          setPhoneVerificationCode('')
          setNotice(
            `账户已创建：${name}。${phoneVerification?.delivery?.message || '请完成手机号验证。'}`,
          )
          return
        }

        setNotice(
          `账户已创建：${name}。${phoneVerification?.delivery?.message || '手机号已登记，短信认证稍后开放。'}`,
        )
        setTimeout(() => {
          onClose()
          setForm(initialForm)
          resetTransientAuthState()
          setNotice('')
          setError('')
          setMode('signin')
        }, 1200)
        return
      }

      setNotice(`登录成功：${name}`)

      setTimeout(() => {
        onClose()
        setForm(initialForm)
        resetTransientAuthState()
        setNotice('')
        setError('')
        setMode('signin')
      }, 800)
    } catch (err) {
      setError(err.message || '登录暂时失败，请稍后再试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resendPhoneVerification = async () => {
    const phone = (phoneChallenge?.phone || form.phone).replace(/[^\d]/g, '')
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请填写正确的 11 位中国大陆手机号。')
      return
    }

    setIsSendingPhoneVerification(true)
    setError('')
    setNotice('')
    try {
      const result = await requestPhoneVerification(phone)
      setPhoneChallenge(result?.phoneVerification || null)
      setPhoneVerificationCode('')
      setNotice(result?.phoneVerification?.delivery?.message || '短信验证码已重新发送。')
    } catch (err) {
      setError(err.message || '短信验证码发送失败，请稍后再试。')
    } finally {
      setIsSendingPhoneVerification(false)
    }
  }

  const verifyPhoneCode = async () => {
    const phone = (phoneChallenge?.phone || form.phone).replace(/[^\d]/g, '')
    setIsConfirmingPhoneVerification(true)
    setError('')
    setNotice('')
    try {
      await confirmPhoneVerification(phone, phoneVerificationCode)
      setPhoneChallenge(null)
      setPhoneVerificationCode('')
      setNotice('手机号验证成功，注册认证已完成。')
      setTimeout(() => {
        onClose()
        setForm(initialForm)
        resetTransientAuthState()
        setNotice('')
        setError('')
        setMode('signin')
      }, 900)
    } catch (err) {
      setError(err.message || '短信验证码校验失败，请重新输入。')
    } finally {
      setIsConfirmingPhoneVerification(false)
    }
  }

  const handleSocialLogin = async (method) => {
    setSocialBusy(method.key)
    setNotice('')
    setError('')
    resetTransientAuthState()

    try {
      let status = providerStatus
      if (!status && ['wechat', 'qq', 'github'].includes(method.key)) {
        status = await getProviderStatus()
        setProviderStatus(status)
      }
      const liveProvider = ['wechat', 'qq', 'github'].includes(method.key)
        && status?.[method.key]?.configured
      if (liveProvider) {
        window.location.href = `/api/auth/oauth/${method.key}/start?role=${encodeURIComponent(form.role)}&returnTo=/dashboard`
        return
      }

      const result = await loginWithProvider(method.key, {
        role: form.role,
        displayName: `${method.label}用户`,
      })
      const name = result?.user?.displayName || method.label
      setNotice(`已通过 ${method.label} 登录：${name}。`)
      setTimeout(() => {
        onClose()
        setNotice('')
        setError('')
        setMode('signin')
      }, 800)
    } catch (err) {
      setError(err.message || `${method.label} 登录暂时失败，请稍后再试。`)
    } finally {
      setSocialBusy('')
    }
  }

  const startPasswordReset = async () => {
    const email = form.email.trim()
    if (!email) {
      setError('请先在邮箱输入框里填写要找回密码的邮箱。')
      return
    }

    setIsSendingPasswordReset(true)
    setNotice('')
    setError('')
    setPasswordResetChallenge(null)
    setPasswordResetCode('')
    setNewPassword('')
    setConfirmNewPassword('')

    try {
      const result = await requestPasswordReset(email)
      setPasswordResetChallenge(result?.passwordReset || { email })
      setNotice(result?.passwordReset?.delivery?.message || '如果这个邮箱已注册，验证码邮件会发送到邮箱。')
    } catch (err) {
      setError(err.message || '密码重置邮件发送失败，请稍后再试。')
    } finally {
      setIsSendingPasswordReset(false)
    }
  }

  const finishPasswordReset = async () => {
    if (newPassword !== confirmNewPassword) {
      setError('两次输入的新密码不一致。')
      return
    }

    setIsConfirmingPasswordReset(true)
    setNotice('')
    setError('')

    try {
      await confirmPasswordReset({
        email: form.email,
        code: passwordResetCode,
        password: newPassword,
      })
      setPasswordResetChallenge(null)
      setPasswordResetCode('')
      setNewPassword('')
      setConfirmNewPassword('')
      setNotice('密码已重置。请使用新密码登录。')
      setMode('signin')
    } catch (err) {
      setError(err.message || '密码重置失败，请检查验证码后再试。')
    } finally {
      setIsConfirmingPasswordReset(false)
    }
  }

  const resendVerification = async () => {
    setIsSendingVerification(true)
    setError('')
    setNotice('')
    try {
      const result = await requestEmailVerification()
      setEmailChallenge(result?.emailVerification || null)
      setVerificationCode('')
      setNotice(result?.emailVerification?.delivery?.message || '验证码已重新发送。')
    } catch (err) {
      setError(err.message || '验证码发送失败，请稍后再试。')
    } finally {
      setIsSendingVerification(false)
    }
  }

  const changeAvatar = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsProcessingAvatar(true)
    setNotice('')
    setError('')

    try {
      const avatarUrl = await createAvatarDataUrl(file)
      updateForm('avatarUrl', avatarUrl)
    } catch (err) {
      setError(err.message || '头像处理失败，请换一张图片。')
    } finally {
      setIsProcessingAvatar(false)
      event.target.value = ''
    }
  }

  const verifyEmailCode = async () => {
    setIsConfirmingVerification(true)
    setError('')
    setNotice('')
    try {
      await confirmEmailVerification(verificationCode)
      setEmailChallenge(null)
      setVerificationCode('')
      setNotice('邮箱验证成功，账户可信状态已更新。')
      setTimeout(() => {
        onClose()
        setForm(initialForm)
        setNotice('')
        setError('')
        setMode('signin')
      }, 900)
    } catch (err) {
      setError(err.message || '验证码校验失败，请重新输入。')
    } finally {
      setIsConfirmingVerification(false)
    }
  }

  // lock body scroll
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [open])

  // esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-sm"
          />

          {/* drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', ease: [0.2, 0.8, 0.2, 1], duration: 0.4 }}
            className="fixed top-0 right-0 bottom-0 z-[90] w-[88%] max-w-[400px] bg-ink-900 border-l border-white/8 flex flex-col"
          >
            {/* top */}
            <div className="flex items-center justify-between px-6 h-16 border-b border-white/5">
              <Logo />
              <button
                onClick={onClose}
                className="h-9 w-9 grid place-items-center rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="close"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* content */}
            <div className="flex-1 overflow-y-auto px-6 py-8">
              {/* 登录 / 注册 Tab 切换 (放最上方, 显著) */}
              <div className="relative grid grid-cols-2 p-1 rounded-xl bg-white/[0.03] border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    resetTransientAuthState()
                  }}
                  className="relative z-10 h-10 text-sm font-medium transition-colors"
                  style={{ color: mode === 'signin' ? '#04131F' : 'rgba(255,255,255,0.65)' }}
                >
                  登录
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    resetTransientAuthState()
                  }}
                  className="relative z-10 h-10 text-sm font-medium transition-colors"
                  style={{ color: mode === 'signup' ? '#04131F' : 'rgba(255,255,255,0.65)' }}
                >
                  注册
                </button>
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg"
                  style={{
                    background: 'linear-gradient(180deg, #BEE6FF, #7FD3FF)',
                    boxShadow: '0 6px 20px -8px rgba(127,211,255,0.55)',
                    left: mode === 'signin' ? 4 : 'calc(50% + 0px)',
                  }}
                />
              </div>

              <div className="mono-label mt-6 mb-2">
                {mode === 'signin' ? 'SIGN IN' : 'SIGN UP'}
              </div>
              <h3 className="text-2xl font-semibold text-white tracking-tight">
                {mode === 'signin' ? '欢迎回来' : '加入 WhiteHive'}
              </h3>
              <p className="mt-2 text-sm text-white/55 leading-relaxed">
                {mode === 'signin'
                  ? '登录后可以提交需求、管理订单, 以及查看可信凭据。'
                  : '注册后可以作为买家提交需求, 也可以作为创作者开设服务。'}
              </p>

              {/* primary email form */}
              <form className="mt-7 space-y-3" onSubmit={submit}>
                <label className="block">
                  <span className="mono-label">邮箱</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                    placeholder="you@whitehive.cn"
                    required
                    className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="mono-label">密码</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => updateForm('password', event.target.value)}
                    placeholder="至少 8 位"
                    minLength={8}
                    required
                    className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                  />
                </label>
                {mode === 'signup' && (
                  <>
                    <label className="block">
                      <span className="mono-label">确认密码</span>
                      <input
                        type="password"
                        value={form.confirmPassword}
                        onChange={(event) => updateForm('confirmPassword', event.target.value)}
                        placeholder="再输入一次"
                        minLength={8}
                        required
                        className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                      />
                    </label>

                    <div className="pt-2">
                      <div className="mono-label mb-3">个人信息</div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 space-y-3">
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                          <div className="h-14 w-14 overflow-hidden rounded-full border border-[#7FD3FF]/25 bg-[#7FD3FF]/10 grid place-items-center text-[#BEE6FF]">
                            {form.avatarUrl ? (
                              <img src={form.avatarUrl} alt="头像预览" className="h-full w-full object-cover" />
                            ) : (
                              <Icon name="user" size={24} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mono-label">真人头像</div>
                            <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                              选填。真实头像会让买卖双方更容易建立第一层信任。
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-[#7FD3FF]/25 bg-[#7FD3FF]/10 px-3 text-xs text-[#BEE6FF] hover:border-[#7FD3FF]/45">
                                {isProcessingAvatar ? '处理中...' : '上传头像'}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  onChange={changeAvatar}
                                  disabled={isProcessingAvatar}
                                  className="hidden"
                                />
                              </label>
                              {form.avatarUrl && (
                                <button
                                  type="button"
                                  onClick={() => updateForm('avatarUrl', '')}
                                  className="h-8 rounded-lg border border-white/10 px-3 text-xs text-white/50 hover:text-white hover:bg-white/5"
                                >
                                  移除
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <label className="block">
                          <span className="mono-label">昵称 / 团队名</span>
                          <input
                            type="text"
                            value={form.displayName}
                            onChange={(event) => updateForm('displayName', event.target.value)}
                            placeholder="例如：周同学 / 蜂巢工作室"
                            minLength={2}
                            required
                            className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                          />
                        </label>

                        <label className="block">
                          <span className="mono-label">账户身份</span>
                          <select
                            value={form.role}
                            onChange={(event) => updateForm('role', event.target.value)}
                            className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-ink-900 transition-colors"
                          >
                            <option value="buyer">我是买家：发布需求、找人接单</option>
                            <option value="seller">我是创作者：发布服务、承接订单</option>
                          </select>
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block">
                            <span className="mono-label">手机</span>
                            <input
                              type="tel"
                              value={form.phone}
                              onChange={(event) => updateForm('phone', event.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                              inputMode="numeric"
                              maxLength={11}
                              placeholder="用于短信验证"
                              required
                              className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                            />
                          </label>
                          <label className="block">
                            <span className="mono-label">城市</span>
                            <input
                              type="text"
                              value={form.city}
                              onChange={(event) => updateForm('city', event.target.value)}
                              placeholder="选填"
                              className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                            />
                          </label>
                        </div>

                        <label className="block">
                          <span className="mono-label">学校 / 公司</span>
                          <input
                            type="text"
                            value={form.schoolOrCompany}
                            onChange={(event) => updateForm('schoolOrCompany', event.target.value)}
                            placeholder="选填，例如：四川某某大学"
                            className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                          />
                        </label>

                        <label className="block">
                          <span className="mono-label">一句话介绍</span>
                          <textarea
                            value={form.bio}
                            onChange={(event) => updateForm('bio', event.target.value)}
                            placeholder="选填：你想买什么服务，或你擅长交付什么。"
                            rows={3}
                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors resize-none"
                          />
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-100">
                    {error}
                  </div>
                )}

                {notice && (
                  <div className="rounded-xl border border-[#5EEAD4]/25 bg-[#5EEAD4]/10 px-3 py-2 text-xs text-[#CFFDF5] flex items-center gap-2">
                    <Icon name="check" size={14} />
                    {notice}
                  </div>
                )}

                {hasEmailChallenge && (
                  <div className="rounded-2xl border border-[#7FD3FF]/25 bg-[#7FD3FF]/[0.07] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="mono-label text-[#BEE6FF]">EMAIL VERIFY</div>
                        <div className="mt-1 text-sm font-medium text-white">验证邮箱</div>
                      </div>
                      <span className="rounded-full border border-[#7FD3FF]/30 bg-[#7FD3FF]/10 px-2 py-1 text-[10px] text-[#BEE6FF]">
                        {emailChallenge.delivery?.delivered ? '已发送' : emailChallenge.delivery?.mock ? '本地模式' : '待配置'}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-white/55">
                      {emailChallenge.delivery?.delivered
                        ? `验证码已发送到 ${emailChallenge.email}。完成验证后，账号可信度会提升，后续实名认证和交易流程也会更顺。`
                        : `邮箱验证已准备好：${emailChallenge.email}。等真实邮件服务配置完成后，这里会收到 6 位验证码。`}
                    </p>
                    {emailChallenge.delivery?.message && (
                      <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                        {emailChallenge.delivery.message}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(event) => setVerificationCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                        placeholder="6 位验证码"
                        className="flex-1 h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                      />
                      <button
                        type="button"
                        disabled={isConfirmingVerification}
                        onClick={verifyEmailCode}
                        className="btn-primary !px-4"
                      >
                        {isConfirmingVerification ? '校验中' : '验证'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <button
                        type="button"
                        disabled={isSendingVerification}
                        onClick={resendVerification}
                        className="text-[#BEE6FF] hover:text-white transition-colors"
                      >
                        {isSendingVerification ? '发送中...' : '重新发送验证码'}
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="text-white/45 hover:text-white transition-colors"
                      >
                        稍后再验证
                      </button>
                    </div>
                  </div>
                )}

                {hasPhoneChallenge && (
                  <div className="rounded-2xl border border-[#5EEAD4]/25 bg-[#5EEAD4]/[0.07] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="mono-label text-[#CFFDF5]">PHONE VERIFY</div>
                        <div className="mt-1 text-sm font-medium text-white">验证手机号</div>
                      </div>
                      <span className="rounded-full border border-[#5EEAD4]/30 bg-[#5EEAD4]/10 px-2 py-1 text-[10px] text-[#CFFDF5]">
                        {phoneChallenge.delivery?.delivered ? '已发送' : phoneChallenge.delivery?.mock ? '本地模式' : '待配置'}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-white/55">
                      验证码将发送到 {phoneChallenge.phone}。手机号验证完成后，账号会获得基础可信凭据，后续订单通知和安全联系也会更稳定。
                    </p>
                    {phoneChallenge.delivery?.message && (
                      <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                        {phoneChallenge.delivery.message}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={phoneVerificationCode}
                        onChange={(event) => setPhoneVerificationCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                        placeholder="6 位短信验证码"
                        className="flex-1 h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                      />
                      <button
                        type="button"
                        disabled={isConfirmingPhoneVerification || phoneVerificationCode.length !== 6}
                        onClick={verifyPhoneCode}
                        className="btn-primary !px-4"
                      >
                        {isConfirmingPhoneVerification ? '校验中' : '验证'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <button
                        type="button"
                        disabled={isSendingPhoneVerification}
                        onClick={resendPhoneVerification}
                        className="text-[#CFFDF5] hover:text-white transition-colors"
                      >
                        {isSendingPhoneVerification ? '发送中...' : '重新发送短信'}
                      </button>
                      <span className="text-white/35">5 分钟内有效</span>
                    </div>
                  </div>
                )}

                {!hasEmailChallenge && !hasPhoneChallenge && (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full justify-center !py-3 mt-2"
                  >
                    {isSubmitting ? '连接后端中...' : mode === 'signin' ? '登录' : '创建账户'}
                    <Icon name="arrow" size={16} />
                  </button>
                )}

                {mode === 'signin' && (
                  <div className="pt-1 text-right">
                    <button
                      type="button"
                      onClick={startPasswordReset}
                      disabled={isSendingPasswordReset}
                      className="text-xs text-white/50 hover:text-[#BEE6FF] transition-colors"
                    >
                      {isSendingPasswordReset ? '发送中...' : '忘记密码?'}
                    </button>
                  </div>
                )}

                {passwordResetChallenge && (
                  <div className="rounded-2xl border border-[#7FD3FF]/25 bg-[#7FD3FF]/[0.07] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="mono-label text-[#BEE6FF]">PASSWORD RESET</div>
                        <div className="mt-1 text-sm font-medium text-white">重置密码</div>
                      </div>
                      <span className="rounded-full border border-[#7FD3FF]/30 bg-[#7FD3FF]/10 px-2 py-1 text-[10px] text-[#BEE6FF]">
                        已受理
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-white/55">
                      请查收 {passwordResetChallenge.email || form.email} 的 6 位验证码，并设置一个至少 8 位的新密码。
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={passwordResetCode}
                        onChange={(event) => setPasswordResetCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                        placeholder="6 位验证码"
                        className="h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                      />
                      <input
                        type="password"
                        minLength={8}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="新密码，至少 8 位"
                        className="h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                      />
                      <input
                        type="password"
                        minLength={8}
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        placeholder="再次输入新密码"
                        className="h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isConfirmingPasswordReset}
                        onClick={finishPasswordReset}
                        className="btn-primary flex-1 justify-center !px-4"
                      >
                        {isConfirmingPasswordReset ? '重置中...' : '确认重置'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordResetChallenge(null)
                          setPasswordResetCode('')
                          setNewPassword('')
                          setConfirmNewPassword('')
                        }}
                        className="rounded-xl border border-white/10 px-4 text-xs text-white/55 hover:text-white hover:bg-white/5"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </form>

              {/* divider */}
              <div className="flex items-center gap-3 my-7">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[11px] text-white/40 tracking-widest">
                  或使用以下方式
                </span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              {/* social buttons */}
              <div className="space-y-2">
                {socialMethods.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => handleSocialLogin(m)}
                    disabled={Boolean(socialBusy)}
                    className="group w-full flex items-center gap-3 px-4 h-11 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/25 hover:bg-white/[0.06] transition-colors text-sm text-white/85"
                  >
                    <span
                      className="h-6 w-6 grid place-items-center shrink-0"
                      style={{ color: m.color }}
                    >
                      <m.Logo size={18} />
                    </span>
                    <span>{socialBusy === m.key ? `${m.label}连接中...` : `使用 ${m.label} 继续`}</span>
                    <span className="ml-auto text-white/35 group-hover:text-white/70 transition-colors">
                      <Icon name="arrow" size={14} />
                    </span>
                  </button>
                ))}
              </div>

              {/* 底部辅助提示 (顶部已有 tab, 这里只做辅助) */}
              <div className="mt-8 text-sm text-white/45 text-center">
                {mode === 'signin'
                  ? '没有账号? 点击上方「注册」标签。'
                  : '已有账号? 点击上方「登录」标签。'}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/5 text-[11px] text-white/35 leading-relaxed">
              登录即表示你同意 WhiteHive 的服务协议与隐私政策。
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
