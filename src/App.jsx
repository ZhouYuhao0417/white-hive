import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Background from './components/Background.jsx'
import Home from './pages/Home.jsx'
import Services from './pages/Services.jsx'
import Trust from './pages/Trust.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import About from './pages/About.jsx'

const titles = {
  '/': 'WhiteHive · 可信数字服务交易平台',
  '/services': '服务分类 · WhiteHive',
  '/trust': '可信机制 · WhiteHive',
  '/how-it-works': '交易流程 · WhiteHive',
  '/about': '关于我们 · WhiteHive',
}

export default function App() {
  const location = useLocation()

  useEffect(() => {
    document.title = titles[location.pathname] || 'WhiteHive'
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  return (
    <div className="relative min-h-screen flex flex-col bg-ink-900 text-white overflow-x-hidden">
      <Background />
      <div className="relative z-10 flex flex-col flex-1 min-h-screen">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/trust" element={<Trust />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
      </div>
    </div>
  )
}
