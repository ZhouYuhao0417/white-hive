import { useEffect, useState, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import Logo from './Logo.jsx'
import AuthDrawer from './AuthDrawer.jsx'
import { Icon } from './Icons.jsx'
import { useAuth } from '../lib/auth.jsx'

const links = [
  { to: '/', label: '首页' },
  { to: '/services', label: '服务' },
  { to: '/local', label: '本地服务', badge: 'NEW' },
  { to: '/ai-match', label: 'AI 匹配' },
  { to: '/dashboard', label: '工作台' },
  { to: '/trust', label: '可信机制' },
  { to: '/how-it-works', label: '流程' },
  { to: '/about', label: '关于' },
]

/* ---- 用户头像（取昵称首字或邮箱首字母） ---- */
function UserAvatar({ user, size = 32 }) {
  const letter = (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()
  if (user.avatarUrl) {
    return (
      <span
        className="inline-block overflow-hidden rounded-full shrink-0 border border-white/10 bg-white/5"
        style={{ width: size, height: size }}
      >
        <img src={user.avatarUrl} alt={user.displayName || user.email || '用户头像'} className="h-full w-full object-cover" />
      </span>
    )
  }

  return (
    <span
      className="inline-grid place-items-center rounded-full shrink-0 font-semibold text-ink-900 select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: 'linear-gradient(135deg, #BEE6FF, #7FD3FF)',
      }}
    >
      {letter}
    </span>
  )
}

/* ---- 用户下拉菜单 ---- */
function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onClick)
    return () => document.removeEventListener('pointerdown', onClick)
  }, [open])

  // esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const displayName = user.displayName || user.email?.split('@')[0] || '用户'
  const roleBadge = user.role === 'seller' ? '创作者' : '买家'
  const emailNeedsVerification = Boolean(user.email && !user.emailVerified)
  const contactVerified = Boolean(user.phoneVerified || user.emailVerified)
  const contactBadge = user.phoneVerified
    ? emailNeedsVerification ? '邮箱待验证' : '手机已验证'
    : user.emailVerified
      ? '邮箱已验证'
      : '联系方式待验证'
  const verificationBadge = {
    verified: '实名已认证',
    pending: '实名审核中',
    rejected: '实名未通过',
    unverified: '实名未认证',
  }[user.verificationStatus || 'unverified']

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-full border border-white/12 hover:border-brand-300/40 hover:bg-white/[0.04] transition-colors"
      >
        <UserAvatar user={user} size={28} />
        <span className="hidden sm:inline text-sm text-white/85 max-w-[100px] truncate">
          {displayName}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" className={`text-white/50 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-2xl bg-ink-800 border border-white/10 shadow-xl shadow-black/40 overflow-hidden z-50">
          {/* 用户信息头 */}
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <UserAvatar user={user} size={36} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{displayName}</div>
                <div className="text-xs text-white/45 truncate">{user.email}</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#7FD3FF]/15 border border-[#7FD3FF]/30 text-[#BEE6FF] font-medium tracking-wide">
                {roleBadge}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md border font-medium tracking-wide ${
                  contactVerified
                    ? 'bg-[#5EEAD4]/10 border-[#5EEAD4]/30 text-[#CFFDF5]'
                    : 'bg-amber-300/10 border-amber-300/25 text-amber-100'
                }`}
              >
                {contactBadge}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/10 text-white/60 font-medium tracking-wide">
                {verificationBadge}
              </span>
            </div>
            {emailNeedsVerification && (
              <button
                type="button"
                onClick={() => { setOpen(false); navigate('/account') }}
                className="mt-3 w-full rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-left text-xs leading-relaxed text-amber-100 transition-colors hover:border-amber-200/40 hover:bg-amber-300/15"
              >
                邮箱待验证。完成后可用于找回账号和接收订单通知。
              </button>
            )}
          </div>

          {/* 菜单项 */}
          <div className="py-1.5">
            <button
              onClick={() => { setOpen(false); navigate('/dashboard') }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/75 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Icon name="store" size={15} />
              工作台
            </button>
            <button
              onClick={() => { setOpen(false); navigate('/account') }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/75 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Icon name="shield" size={15} />
              账号与认证
            </button>
            {user.role === 'admin' && (
              <>
                <button
                  onClick={() => { setOpen(false); navigate('/admin/verifications') }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/75 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Icon name="document" size={15} />
                  实名审核
                </button>
                <button
                  onClick={() => { setOpen(false); navigate('/admin/services') }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/75 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Icon name="store" size={15} />
                  服务审核
                </button>
              </>
            )}
            <button
              onClick={() => { setOpen(false); navigate('/sell') }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/75 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Icon name="palette" size={15} />
              开设服务
            </button>
          </div>

          {/* 退出 */}
          <div className="border-t border-white/5 py-1.5">
            <button
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-300/80 hover:text-red-200 hover:bg-red-400/10 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- Navbar 主组件 ---- */
export default function Navbar() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'backdrop-blur-xl bg-ink-900/70 border-b border-white/5'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-8 h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center shrink-0">
            <Logo />
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-6">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-lg text-sm transition-colors inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'text-white bg-white/5'
                      : 'text-white/65 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {l.label}
                {l.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-sm font-semibold tracking-wider bg-[#7FD3FF]/15 border border-[#7FD3FF]/40 text-[#BEE6FF]">
                    {l.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* 登录态：用户菜单 / 未登录：登录按钮 */}
          {isLoading ? (
            <div className="h-9 w-20 rounded-lg bg-white/5 animate-pulse" />
          ) : isAuthenticated ? (
            <UserMenu user={user} onLogout={handleLogout} />
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg text-sm text-white/85 hover:text-white border border-white/12 hover:border-brand-300/40 hover:bg-brand-300/[0.05] transition-colors"
            >
              <Icon name="user" size={15} />
              <span>登录/注册</span>
            </button>
          )}

          {/* 移动端：右侧折叠导航按钮 */}
          <button
            className="md:hidden h-9 w-9 grid place-items-center rounded-lg text-white/75 hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="toggle nav"
          >
            <span
              className={`inline-flex transition-transform duration-300 ease-out ${
                mobileOpen ? 'rotate-90' : 'rotate-0'
              }`}
            >
              <Icon name={mobileOpen ? 'close' : 'menu'} size={18} />
            </span>
          </button>
        </div>

        <div
          className={`md:hidden grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
            mobileOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden border-t border-white/5 bg-ink-900/95 backdrop-blur-xl">
            <div
              className={`px-5 py-4 flex flex-col gap-1 transition-transform duration-300 ease-out ${
                mobileOpen ? 'translate-y-0' : '-translate-y-2'
              }`}
            >
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-sm ${
                      isActive ? 'text-white bg-white/5' : 'text-white/70'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              <div className="h-px my-2 bg-white/5" />

              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <UserAvatar user={user} size={28} />
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{user.displayName || user.email?.split('@')[0]}</div>
                      <div className="text-xs text-white/40 truncate">{user.email}</div>
                    </div>
                  </div>
                  {user.email && !user.emailVerified && (
                    <button
                      type="button"
                      onClick={() => { setMobileOpen(false); navigate('/account') }}
                      className="mx-3 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-left text-xs leading-relaxed text-amber-100"
                    >
                      邮箱待验证。完成后可用于找回账号和接收订单通知。
                    </button>
                  )}
                  <button
                    onClick={() => { setMobileOpen(false); handleLogout() }}
                    className="mt-1 px-3 py-2 rounded-lg text-sm text-red-300/80 hover:bg-red-400/10 text-left transition-colors"
                  >
                    退出登录
                  </button>
                  {user.role === 'admin' && (
                    <>
                      <button
                        onClick={() => { setMobileOpen(false); navigate('/admin/verifications') }}
                        className="px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5 text-left transition-colors"
                      >
                        实名审核
                      </button>
                      <button
                        onClick={() => { setMobileOpen(false); navigate('/admin/services') }}
                        className="px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5 text-left transition-colors"
                      >
                        服务审核
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button
                  onClick={() => { setMobileOpen(false); setAuthOpen(true) }}
                  className="btn-primary text-sm justify-center"
                >
                  登录 / 注册
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <AuthDrawer open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
