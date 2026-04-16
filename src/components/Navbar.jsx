import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo.jsx'
import AuthDrawer from './AuthDrawer.jsx'
import { Icon } from './Icons.jsx'

const links = [
  { to: '/', label: '首页' },
  { to: '/services', label: '服务' },
  { to: '/ai-match', label: 'AI 匹配', badge: 'NEW' },
  { to: '/dashboard', label: '工作台' },
  { to: '/trust', label: '可信机制' },
  { to: '/how-it-works', label: '流程' },
  { to: '/about', label: '关于' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

          {/* 登录/注册 —— 始终可见，紧贴右侧菜单之前 */}
          <button
            onClick={() => setAuthOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg text-sm text-white/85 hover:text-white border border-white/12 hover:border-brand-300/40 hover:bg-brand-300/[0.05] transition-colors"
          >
            <Icon name="user" size={15} />
            <span>登录/注册</span>
          </button>

          {/* 移动端：右侧折叠导航按钮 */}
          <button
            className="md:hidden h-9 w-9 grid place-items-center rounded-lg text-white/75 hover:text-white hover:bg-white/5"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="toggle nav"
          >
            <Icon name={mobileOpen ? 'close' : 'menu'} size={18} />
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-white/5 bg-ink-900/95 backdrop-blur-xl">
            <div className="px-5 py-4 flex flex-col gap-1">
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
              <Link
                to="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="btn-primary text-sm justify-center"
              >
                进入工作台 →
              </Link>
            </div>
          </div>
        )}
      </header>

      <AuthDrawer open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
