import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'

export default function Footer() {
  return (
    <footer className="relative mt-32 border-t border-white/5 bg-ink-950/60">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-10 sm:py-16 grid gap-8 sm:gap-12 grid-cols-2 md:grid-cols-5">
        <div className="col-span-2 space-y-4">
          <Logo />
          <p className="text-xs sm:text-sm text-white/55 max-w-sm leading-relaxed">
            WhiteHive 是一个面向线上数字服务的可信交易平台。
            让服务更容易被理解、让需求更结构化、让交付真正可信。
          </p>
          <div className="flex gap-2 pt-1">
            <span className="chip text-[11px] sm:text-xs">whitehive.cn</span>
            <span className="chip text-[11px] sm:text-xs">Beta</span>
          </div>
        </div>

        <div>
          <div className="mono-label mb-3 sm:mb-4">PRODUCT</div>
          <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-white/70">
            <li><Link to="/services" className="hover:text-white">服务分类</Link></li>
            <li><Link to="/how-it-works" className="hover:text-white">交易流程</Link></li>
            <li><Link to="/trust" className="hover:text-white">可信机制</Link></li>
          </ul>
        </div>

        <div>
          <div className="mono-label mb-3 sm:mb-4">COMPANY</div>
          <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-white/70">
            <li><Link to="/about" className="hover:text-white">关于我们</Link></li>
            <li><a href="mailto:zhouyuhao162@gmail.com" className="hover:text-white">联系邮箱</a></li>
            <li><Link to="/services" className="hover:text-white">浏览商品</Link></li>
          </ul>
        </div>

        <div>
          <div className="mono-label mb-3 sm:mb-4">LEGAL</div>
          <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-white/70">
            <li><Link to="/legal/terms" className="hover:text-white">服务协议</Link></li>
            <li><Link to="/legal/privacy" className="hover:text-white">隐私政策</Link></li>
            <li><Link to="/legal/copyright" className="hover:text-white">版权与投诉</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <div>© {new Date().getFullYear()} WhiteHive · whitehive.cn · All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span>Built for creators, trusted by buyers.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
