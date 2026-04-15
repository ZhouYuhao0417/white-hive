import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Icon,
  GithubLogo,
  WechatLogo,
  QQLogo,
  MailLogo,
  PhoneLogo,
} from './Icons.jsx'
import Logo from './Logo.jsx'

const socialMethods = [
  { key: 'email',  label: '邮箱',   Logo: MailLogo,   color: '#7FD3FF' },
  { key: 'phone',  label: '手机号', Logo: PhoneLogo,  color: '#A3E635' },
  { key: 'wechat', label: '微信',   Logo: WechatLogo, color: '#22C55E' },
  { key: 'qq',     label: 'QQ',     Logo: QQLogo,     color: '#38BDF8' },
  { key: 'github', label: 'GitHub', Logo: GithubLogo, color: '#E6E9F2' },
]

export default function AuthDrawer({ open, onClose }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'

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
              <div className="mono-label mb-3">
                {mode === 'signin' ? 'SIGN IN' : 'SIGN UP'}
              </div>
              <h3 className="text-2xl font-semibold text-white tracking-tight">
                {mode === 'signin' ? '欢迎回来' : '加入 WhiteHive'}
              </h3>
              <p className="mt-2 text-sm text-white/55 leading-relaxed">
                {mode === 'signin'
                  ? '登录后可以提交需求、管理订单，以及查看可信凭据。'
                  : '注册后，你可以作为买家提交需求，也可以作为创作者开设服务。'}
              </p>

              {/* primary email form */}
              <div className="mt-7 space-y-3">
                <label className="block">
                  <span className="mono-label">邮箱</span>
                  <input
                    type="email"
                    placeholder="you@whitehive.cn"
                    className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-300/60 focus:bg-white/[0.05] transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="mono-label">密码</span>
                  <input
                    type="password"
                    placeholder="至少 8 位"
                    className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-300/60 focus:bg-white/[0.05] transition-colors"
                  />
                </label>

                <button
                  type="button"
                  className="btn-primary w-full justify-center !py-3 mt-2"
                >
                  {mode === 'signin' ? '登录' : '创建账户'}
                  <Icon name="arrow" size={16} />
                </button>
              </div>

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
                    className="group w-full flex items-center gap-3 px-4 h-11 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/25 hover:bg-white/[0.06] transition-colors text-sm text-white/85"
                  >
                    <span
                      className="h-6 w-6 grid place-items-center shrink-0"
                      style={{ color: m.color }}
                    >
                      <m.Logo size={18} />
                    </span>
                    <span>使用 {m.label} 继续</span>
                    <span className="ml-auto text-white/35 group-hover:text-white/70 transition-colors">
                      <Icon name="arrow" size={14} />
                    </span>
                  </button>
                ))}
              </div>

              {/* switch mode */}
              <div className="mt-8 text-sm text-white/55 text-center">
                {mode === 'signin' ? (
                  <>
                    还没有账号？{' '}
                    <button
                      className="text-brand-300 hover:text-brand-200"
                      onClick={() => setMode('signup')}
                    >
                      创建一个
                    </button>
                  </>
                ) : (
                  <>
                    已经有账号？{' '}
                    <button
                      className="text-brand-300 hover:text-brand-200"
                      onClick={() => setMode('signin')}
                    >
                      直接登录
                    </button>
                  </>
                )}
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
