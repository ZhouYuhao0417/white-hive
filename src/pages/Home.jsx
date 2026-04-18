import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Section, SectionHeader, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import {
  services,
  pairs,
  steps,
  useCases,
} from '../data/services.js'

/* ============================================================
   Hero · 首屏
   ============================================================ */
function Hero() {
  return (
    <section className="relative hero-glow pt-14 sm:pt-20 md:pt-28 pb-14 sm:pb-20 md:pb-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center"
        >
          <span className="chip-hero">
            <span className="h-2 w-2 rounded-full bg-[#7FD3FF] shadow-[0_0_12px_#7FD3FF]" />
            whitehive.cn · 可信数字服务交易平台
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="mt-5 sm:mt-7 text-center text-[26px] sm:text-4xl md:text-5xl lg:text-[68px] font-semibold tracking-tight text-white leading-[1.12] sm:leading-[1.08]"
        >
          把每一次线上合作,
          <br className="hidden sm:block" />
          做成一件可以<span className="text-cool-gradient">被托付</span>的事。
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-4 sm:mt-6 max-w-2xl mx-auto text-center text-white/65 text-sm sm:text-base md:text-lg leading-relaxed"
        >
          WhiteHive 面向青年创作者、自由职业者、学生卖家, 以及个人与小微团队买家。
          服务被结构化地描述, 需求被结构化地拆解, 交付被结构化地验收。
        </motion.p>

        {/* 买家入口 / 卖家入口 —— 双轨 CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22 }}
          className="mt-7 sm:mt-10 flex flex-col sm:flex-row items-stretch justify-center gap-2.5 sm:gap-3"
        >
          <Link to="/services" className="btn-primary group">
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-normal opacity-75 tracking-wider">FOR BUYERS</span>
              <span>我是买家 · 浏览商品</span>
            </span>
            <Icon name="arrow" size={18} />
          </Link>
          <Link to="/sell" className="btn-brand group">
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-normal opacity-75 tracking-wider">FOR CREATORS</span>
              <span>我是卖家 · 开设服务</span>
            </span>
            <Icon name="arrow" size={18} />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="mt-12 flex items-center justify-center gap-6 text-[12px] text-white/45"
        >
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7FD3FF]" />
            资金托管
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#A5B4FC]" />
            结构化需求
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4]" />
            可验收交付
          </span>
        </motion.div>
      </div>
    </section>
  )
}

/* ============================================================
   CampusCDUT · 成都理工大学服务专区
   —— 校园场景的"线下微服务": 快递代取 / 外卖代取 / 校园约拍。
   视觉: 冰蓝 + 薄荷的校园感配色, 大卡统一入口 + 三张子卡
   ============================================================ */
function CampusCDUT() {
  const items = [
    {
      key: 'parcel',
      icon: 'route',
      title: '快递代取',
      desc: '宿舍 / 图书馆 / 实验楼, 顺手带到你手上。',
      price: '¥3 起',
      meta: '承诺 30 分钟内取件',
      color: '#7FD3FF',
    },
    {
      key: 'food',
      icon: 'spark',
      title: '外卖代取',
      desc: '下课不赶趟? 校外取餐 / 食堂打包都行。',
      price: '¥4 起',
      meta: '午晚高峰也能抢到单',
      color: '#A5B4FC',
    },
    {
      key: 'photo',
      icon: 'palette',
      title: '校园约拍',
      desc: '毕业照 · 社团活动 · 情侣照 · 证件照上门。',
      price: '¥80 起',
      meta: '在校摄影爱好者, 比外面便宜一半',
      color: '#5EEAD4',
    },
  ]

  return (
    <Section className="!py-16 md:!py-20">
      <Reveal>
        <div
          className="card p-6 sm:p-8 md:p-10 relative overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, rgba(127,211,255,0.07) 0%, rgba(94,234,212,0.05) 50%, rgba(165,180,252,0.05) 100%)',
            borderColor: 'rgba(127,211,255,0.26)',
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-60 pointer-events-none"
            style={{
              background:
                'radial-gradient(40% 55% at 100% 0%, rgba(127,211,255,0.18), transparent 60%), radial-gradient(40% 55% at 0% 100%, rgba(94,234,212,0.14), transparent 60%)',
            }}
          />
          <div className="relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="mono-label text-[#BEE6FF]">CAMPUS · 校园专区</div>
                <h3 className="mt-2 text-xl sm:text-2xl md:text-3xl font-semibold text-white tracking-tight leading-tight">
                  成都理工大学
                  <span className="text-cool-gradient"> 服务专区</span>
                </h3>
                <p className="mt-2 text-sm sm:text-base text-white/65 leading-relaxed max-w-2xl">
                  本校同学提供的线下微服务, 走 WhiteHive 托管, 见面核销即结款。不靠熟人, 不加微信, 照样能托付。
                </p>
              </div>
              <Link
                to="/cdut"
                className="btn-ghost text-xs sm:text-sm shrink-0"
              >
                进入 CDUT 专区 <Icon name="arrow" size={14} />
              </Link>
            </div>

            {/* Cards */}
            <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {items.map((it, i) => (
                <Reveal key={it.key} delay={i * 0.06} y={16}>
                  <Link
                    to="/cdut"
                    className="card card-hover block p-4 sm:p-5 h-full relative overflow-hidden group"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-px"
                      style={{
                        background: `linear-gradient(to right, transparent, ${it.color}, transparent)`,
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <div
                        className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center"
                        style={{
                          background: `${it.color}14`,
                          border: `1px solid ${it.color}40`,
                          color: it.color,
                        }}
                      >
                        <Icon name={it.icon} size={18} />
                      </div>
                      <span
                        className="text-[11px] sm:text-xs font-mono shrink-0"
                        style={{ color: it.color }}
                      >
                        {it.price}
                      </span>
                    </div>
                    <div className="mt-3 text-white font-medium text-sm sm:text-base leading-snug">
                      {it.title}
                    </div>
                    <p className="mt-1 text-xs text-white/60 leading-relaxed line-clamp-2">
                      {it.desc}
                    </p>
                    <div className="mt-3 pt-3 border-t border-white/6 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-white/45 truncate">
                        {it.meta}
                      </span>
                      <span
                        className="text-[11px] opacity-70 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0"
                        style={{ color: it.color }}
                      >
                        下单 <Icon name="arrow" size={12} />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>

            {/* Footer tags */}
            <div className="mt-6 flex items-center gap-4 sm:gap-6 text-[11px] sm:text-xs text-white/50 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7FD3FF]" />
                学生身份核验
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A5B4FC]" />
                平台托管结款
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4]" />
                同校就近接单
              </span>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

/* ============================================================
   PopularCategories · 热门分类 (点击直达 /services/:slug)
   ============================================================ */
function PopularCategories() {
  const list = services.slice(0, 6)
  return (
    <Section className="!py-20 md:!py-24">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <SectionHeader
          eyebrow="CATEGORIES · 热门分类"
          title="六个方向, 同一套结构。"
          desc="每一个分类都有自己的商品陈列, 结构一致, 内容不同。点击任一卡片直接进入该分类的商品页面。"
        />
        <Link to="/services" className="btn-ghost text-sm">
          查看全部分类 <Icon name="arrow" size={16} />
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
        {list.map((s, i) => (
          <Reveal key={s.slug} delay={i * 0.05}>
            <Link
              to={`/services/${s.slug}`}
              className="card card-hover block p-3.5 sm:p-6 h-full group relative overflow-hidden"
            >
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{
                  background: `linear-gradient(to right, transparent, ${s.color}, transparent)`,
                }}
              />
              <div className="flex items-center justify-between">
                <div
                  className="h-8 w-8 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl flex items-center justify-center"
                  style={{
                    background: `${s.color}14`,
                    border: `1px solid ${s.color}40`,
                    color: s.color,
                  }}
                >
                  <Icon name={s.icon} />
                </div>
                <span className="mono-label">0{i + 1}</span>
              </div>
              <div className="mt-2.5 sm:mt-5 font-medium text-white text-sm sm:text-lg leading-snug">{s.title}</div>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-white/60 leading-relaxed line-clamp-2 sm:line-clamp-none">{s.tagline}</p>
              <div className="mt-3 sm:mt-5 hidden sm:flex flex-wrap gap-1.5">
                {s.audience.map((a) => (
                  <span
                    key={a}
                    className="text-[11px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/8 text-white/65"
                  >
                    {a}
                  </span>
                ))}
              </div>
              <div
                className="mt-2.5 sm:mt-5 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm opacity-70 group-hover:opacity-100 transition-opacity"
                style={{ color: s.color }}
              >
                <span className="hidden sm:inline">进入商品陈列</span>
                <span className="sm:hidden">查看</span> <Icon name="arrow" size={14} />
              </div>
            </Link>
          </Reveal>
        ))}
      </div>

      {/* 第 7 格 · AI 精准匹配 —— 跨列大卡 */}
      <Reveal delay={0.1}>
        <div className="mt-4">
          <Link
            to="/ai-match"
            className="card card-hover block p-5 sm:p-7 md:p-9 relative overflow-hidden group"
            style={{
              background:
                'linear-gradient(135deg, rgba(127,211,255,0.08) 0%, rgba(165,180,252,0.06) 50%, rgba(94,234,212,0.06) 100%)',
              borderColor: 'rgba(127,211,255,0.30)',
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(40% 60% at 100% 0%, rgba(127,211,255,0.20), transparent 60%), radial-gradient(40% 60% at 0% 100%, rgba(165,180,252,0.18), transparent 60%)',
              }}
            />
            <div className="relative flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-6">
              <div
                className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(127,211,255,0.14)',
                  border: '1px solid rgba(127,211,255,0.45)',
                  color: '#7FD3FF',
                }}
              >
                <Icon name="spark" size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="mono-label mb-1">AI MATCH · 07</div>
                <div className="text-white font-medium text-base sm:text-xl leading-tight">
                  没找到相关的服务? 用 AI 精准匹配需求。
                </div>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-white/65 leading-relaxed max-w-2xl">
                  把你的意图直接告诉 AI, 它会理解你想做的事、拆解关键字段, 并从全平台匹配最合适的创作者
                  —— 覆盖以上六个分类之外的长尾场景。
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:ml-auto shrink-0">
                <span className="chip">自然语言描述</span>
                <span className="chip">智能拆解</span>
                <span className="chip">精准匹配</span>
              </div>
              <div className="text-[#7FD3FF] hidden md:block">
                <Icon name="arrow" size={22} />
              </div>
            </div>
          </Link>
        </div>
      </Reveal>
    </Section>
  )
}

/* ============================================================
   LocalPromo · 本地服务推广（首页第二条产品线）
   ============================================================ */
function LocalPromo() {
  const localPicks = [
    { icon: 'document', label: '家教辅导', hint: '¥80–240/小时', accent: '#BEE6FF' },
    { icon: 'palette',  label: '摄影陪拍', hint: '同城上门',     accent: '#7FD3FF' },
    { icon: 'wand',     label: '设备调试', hint: '3–10km 上门',  accent: '#5EEAD4' },
    { icon: 'route',    label: '同城跑腿', hint: '校园 / 同城',  accent: '#FBBF77' },
  ]

  return (
    <Section className="!py-20 md:!py-24">
      <Reveal>
        <div
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl border p-5 sm:p-8 md:p-10"
          style={{
            background:
              'linear-gradient(135deg, rgba(94,234,212,0.08) 0%, rgba(127,211,255,0.08) 55%, rgba(165,180,252,0.05) 100%)',
            borderColor: 'rgba(94,234,212,0.28)',
          }}
        >
          {/* 装饰光晕 */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(45% 60% at 100% 0%, rgba(94,234,212,0.20), transparent 60%), radial-gradient(40% 50% at 0% 100%, rgba(127,211,255,0.18), transparent 60%)',
            }}
          />

          <div className="relative grid lg:grid-cols-[1.1fr_.9fr] gap-6 sm:gap-8 lg:gap-10 items-center">
            {/* 左：介绍 + CTA */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5EEAD4]/35 bg-[#5EEAD4]/10 text-[11px] text-[#CFFDF5] tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4] animate-pulse" />
                WHITEHIVE LOCAL · 本地服务
              </div>

              <h3 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-semibold text-white leading-tight tracking-tight">
                附近的人,<br className="sm:hidden" />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(120deg,#BEE6FF,#7FD3FF 45%,#5EEAD4)' }}
                >
                  面对面更可信
                </span>
              </h3>

              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-white/65 leading-relaxed max-w-xl">
                除了线上数字服务, WhiteHive 还有第二条产品线 ——
                专注同城、近距离、必须线下交付的服务：家教、陪拍、设备上门、校园跑腿。
                可以先线上聊、再线下见, 让本地服务更踏实。
              </p>

              {/* 三个微指标 */}
              <div className="mt-5 sm:mt-6 flex flex-wrap gap-2">
                <span className="chip text-[11px] sm:text-xs">附近可见面</span>
                <span className="chip text-[11px] sm:text-xs">实名 / 学生认证</span>
                <span className="chip text-[11px] sm:text-xs">模糊定位保护</span>
              </div>

              <div className="mt-6 sm:mt-7 flex flex-wrap gap-2.5 sm:gap-3">
                <Link to="/local" className="btn-primary">
                  进入本地服务
                  <Icon name="arrow" size={16} />
                </Link>
                <Link
                  to="/local#post-need"
                  className="inline-flex items-center gap-2 px-4 sm:px-5 h-10 sm:h-11 rounded-xl border border-white/15 hover:border-[#5EEAD4]/50 hover:bg-white/[0.04] text-sm text-white/85 hover:text-white transition-colors"
                >
                  发布本地需求
                </Link>
              </div>
            </div>

            {/* 右：四个本地分类精选 */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {localPicks.map((p, i) => (
                <motion.div
                  key={p.label}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: i * 0.07 }}
                >
                  <Link
                    to="/local"
                    className="group block h-full rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/25 p-3 sm:p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl grid place-items-center"
                        style={{
                          background: `${p.accent}18`,
                          border: `1px solid ${p.accent}40`,
                          color: p.accent,
                        }}
                      >
                        <Icon name={p.icon} size={16} />
                      </span>
                      <span className="text-white/30 group-hover:text-white/70 transition-colors">
                        <Icon name="arrow" size={14} />
                      </span>
                    </div>
                    <div className="mt-2.5 sm:mt-4 text-sm sm:text-base font-medium text-white">
                      {p.label}
                    </div>
                    <div className="mt-0.5 text-[11px] sm:text-xs text-white/50">
                      {p.hint}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

/* ============================================================
   ProcessTimeline · 7 步流程 (入场一次性级联点亮)
   ============================================================ */
function ProcessTimeline() {
  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.14,
        delayChildren: 0.05,
      },
    },
  }
  const item = {
    hidden: { opacity: 0, y: 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] },
    },
  }
  const line = {
    hidden: { scaleX: 0 },
    show: {
      scaleX: 1,
      transition: { duration: 1.25, ease: [0.2, 0.8, 0.2, 1] },
    },
  }

  return (
    <Section className="!py-20 md:!py-24">
      <SectionHeader
        eyebrow="HOW IT WORKS · 交易流程"
        title="一次交易, 七个结构化节点。"
        desc="从浏览服务到完成评价, 每一步都是一个明确的状态, 而不是一次模糊的聊天。"
      />

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="mt-12 relative"
      >
        {/* 背景线 */}
        <div className="absolute left-0 right-0 top-[29px] h-px bg-white/8 hidden lg:block" />
        {/* 动画扫过的亮线 (入场一次) */}
        <motion.div
          variants={line}
          style={{ transformOrigin: '0% 50%' }}
          className="absolute left-0 right-0 top-[29px] h-px hidden lg:block"
        >
          <div className="h-full w-full bg-gradient-to-r from-[#7FD3FF] via-[#A5B4FC] to-[#5EEAD4]" />
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
          {steps.map((s) => (
            <motion.div key={s.k} variants={item} className="relative">
              <div
                className="h-11 sm:h-[58px] rounded-lg sm:rounded-xl border flex items-center justify-center"
                style={{
                  borderColor: 'rgba(127,211,255,0.45)',
                  background:
                    'linear-gradient(180deg, rgba(127,211,255,0.10), rgba(165,180,252,0.04))',
                }}
              >
                <span
                  className="font-mono text-[10px] sm:text-xs tracking-wider font-semibold"
                  style={{ color: '#BEE6FF' }}
                >
                  {s.k}
                </span>
              </div>
              <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-white font-medium">{s.title}</div>
              <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-white/50 leading-relaxed">{s.desc}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className="mt-12 flex justify-center">
        <Link to="/how-it-works" className="btn-ghost text-sm">
          查看完整流程 <Icon name="arrow" size={16} />
        </Link>
      </div>
    </Section>
  )
}

/* ============================================================
   Problem → Solution · 主要信任内容
   ============================================================ */
function ProblemSolution() {
  const rowClass = 'min-h-0 sm:min-h-[96px] flex items-start gap-3 sm:gap-4'
  return (
    <Section className="!py-20 md:!py-24">
      <SectionHeader
        eyebrow="WHY TRUST · 为什么说可信"
        title="先看清问题, 再看清解法。"
        desc="首页只讲最主要的几件事, 更完整的信任体系在顶栏「可信机制」里。"
      />

      <Reveal>
        <div className="mt-12 grid md:grid-cols-2 gap-4">
          {/* 痛点卡 */}
          <div className="card p-4 sm:p-7 md:p-8 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="flex items-center gap-3 mb-5 sm:mb-7">
              <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center text-white/55">
                <Icon name="close" size={16} />
              </div>
              <div>
                <div className="mono-label text-white/45">CURRENT PAIN</div>
                <div className="text-white font-medium mt-0.5">当前的痛点</div>
              </div>
            </div>
            <ul className="space-y-3">
              {pairs.map((row, i) => (
                <li
                  key={i}
                  className={`${rowClass} rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/8 p-3 sm:p-4`}
                >
                  <div className="mono-label text-white/35 w-5 sm:w-7 shrink-0 mt-[2px] text-[10px] sm:text-[11px]">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-medium text-sm">{row.pain.title}</div>
                    <p className="mt-1 text-xs text-white/55 leading-relaxed">
                      {row.pain.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* 解法卡 —— 冰蓝主调 */}
          <div
            className="card p-4 sm:p-7 md:p-8 relative overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, rgba(127,211,255,0.07), rgba(165,180,252,0.02))',
              borderColor: 'rgba(127,211,255,0.30)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7FD3FF]/55 to-transparent" />
            <div className="flex items-center gap-3 mb-5 sm:mb-7">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'rgba(127,211,255,0.14)',
                  border: '1px solid rgba(127,211,255,0.40)',
                  color: '#7FD3FF',
                }}
              >
                <Icon name="check" size={16} />
              </div>
              <div>
                <div className="mono-label">WHITEHIVE SOLUTION</div>
                <div className="text-white font-medium mt-0.5">WhiteHive 的解法</div>
              </div>
            </div>
            <ul className="space-y-3">
              {pairs.map((row, i) => (
                <li
                  key={i}
                  className={`${rowClass} rounded-lg sm:rounded-xl p-3 sm:p-4`}
                  style={{
                    background: 'rgba(127,211,255,0.05)',
                    border: '1px solid rgba(127,211,255,0.22)',
                  }}
                >
                  <div
                    className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-[1px]"
                    style={{
                      background: 'rgba(127,211,255,0.16)',
                      border: '1px solid rgba(127,211,255,0.38)',
                      color: '#7FD3FF',
                    }}
                  >
                    <Icon name="arrow" size={12} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-medium text-sm">{row.solution.title}</div>
                    <p className="mt-1 text-xs text-white/65 leading-relaxed">
                      {row.solution.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Link to="/trust" className="btn-ghost text-sm">
            查看完整可信机制 · 6 大支柱 <Icon name="arrow" size={16} />
          </Link>
        </div>
      </Reveal>
    </Section>
  )
}

/* ============================================================
   VibeCoding · AI 辅助交付
   ============================================================ */
function VibeCoding() {
  const vibeSteps = [
    {
      k: '01',
      icon: 'spark',
      title: '引导式需求采集',
      desc: '平台用 Prompt Engineering 一步步引导你说清楚想要什么, 避免"说半天说不到重点"。',
      color: '#7FD3FF',
    },
    {
      k: '02',
      icon: 'wand',
      title: 'AI 生成初版交付',
      desc: '调用平台的 Vibe Coding API, 用结构化需求直接跑出一版可运行的成品。',
      color: '#A5B4FC',
    },
    {
      k: '03',
      icon: 'check',
      title: '满意? 直接结算。',
      desc: '如果初版已经达到预期, 可以直接付款收走, 省去一轮人工沟通。',
      color: '#5EEAD4',
    },
    {
      k: '04',
      icon: 'route',
      title: '不满意? AI 精准匹配卖家。',
      desc: '平台根据已经说清的需求和初版反馈, 挑出最契合的真人卖家继续打磨。',
      color: '#C7D2FE',
    },
  ]
  return (
    <Section className="!py-20 md:!py-24">
      <SectionHeader
        eyebrow="VIBE CODING · AI 辅助交付"
        title="当你需要的是一段代码、一页设计、一份文档。"
        desc="WhiteHive 把 Vibe Coding 做成了一个人人都能用、而且用得放心的入口: 先让 AI 跑一版, 不行再交给真人。"
      />
      <Reveal>
        <div className="mt-10 sm:mt-12 relative card p-4 sm:p-8 md:p-10 overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(60% 70% at 100% 0%, rgba(127,211,255,0.16), transparent 60%), radial-gradient(50% 60% at 0% 100%, rgba(165,180,252,0.14), transparent 60%)',
            }}
          />
          <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {vibeSteps.map((s, i) => (
              <motion.div
                key={s.k}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-5"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl flex items-center justify-center"
                    style={{
                      background: `${s.color}14`,
                      border: `1px solid ${s.color}40`,
                      color: s.color,
                    }}
                  >
                    <Icon name={s.icon} size={16} />
                  </div>
                  <span
                    className="font-mono text-[10px] sm:text-xs tracking-wider"
                    style={{ color: s.color }}
                  >
                    {s.k}
                  </span>
                </div>
                <div className="mt-3 sm:mt-5 text-white font-medium text-xs sm:text-[15px] leading-snug">
                  {s.title}
                </div>
                <p className="mt-1 sm:mt-2 text-[11px] sm:text-xs text-white/60 leading-relaxed">{s.desc}</p>
                {i < vibeSteps.length - 1 && (
                  <div className="hidden lg:flex absolute -right-[13px] top-1/2 -translate-y-1/2 text-white/25 z-10">
                    <div className="h-[22px] w-[22px] rounded-full bg-ink-800 border border-white/10 flex items-center justify-center">
                      <Icon name="arrow" size={12} />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          <div className="relative mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex flex-wrap gap-2">
              <span className="chip">前端开发</span>
              <span className="chip">软件工程</span>
              <span className="chip">文档生成</span>
              <span className="chip">内容初稿</span>
            </div>
            <Link to="/ai-match" className="btn-ghost text-sm">
              试试 AI 引导式提交 <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

/* ============================================================
   ValueProps · 核心价值
   ============================================================ */
function ValueProps() {
  const items = [
    {
      icon: 'cube',
      color: '#7FD3FF',
      title: '结构化的服务表达',
      desc: '所有服务都用同一套字段被描述, 避免话术差异带来的信息不对称。',
    },
    {
      icon: 'shield',
      color: '#A5B4FC',
      title: '前置化的信任治理',
      desc: '纠纷防控、版权保护、合规边界, 全部在交易开始前就已建立。',
    },
    {
      icon: 'vault',
      color: '#5EEAD4',
      title: '可追溯的交易流程',
      desc: '从下单到验收, 每一步都有记录, 关键节点支持上链存证。',
    },
    {
      icon: 'spark',
      color: '#C7D2FE',
      title: '像产品一样的体验',
      desc: 'WhiteHive 不是一个接单广场, 而是一个成熟产品化的交易环境。',
    },
  ]
  return (
    <Section className="!py-20 md:!py-24">
      <SectionHeader
        eyebrow="CORE VALUE · 核心价值"
        title="我们在解决一个真实存在的问题。"
        desc="线上数字服务的交易, 过去依赖聊天、转账和个人信誉。WhiteHive 把它重做成了一个结构化的产品。"
      />
      <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 0.06}>
            <div className="card card-hover p-3.5 sm:p-6 h-full">
              <div
                className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl flex items-center justify-center"
                style={{
                  background: `${it.color}14`,
                  border: `1px solid ${it.color}40`,
                  color: it.color,
                }}
              >
                <Icon name={it.icon} />
              </div>
              <div className="mt-3 sm:mt-5 font-medium text-white text-sm sm:text-base">{it.title}</div>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-white/60 leading-relaxed">{it.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ============================================================
   UseCases
   ============================================================ */
function UseCasesSection() {
  return (
    <Section className="!py-20 md:!py-24">
      <SectionHeader
        eyebrow="USE CASES · 场景"
        title="在真实的场景里, 它长这样。"
      />
      <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
        {useCases.map((u, i) => (
          <Reveal key={u.title} delay={i * 0.06}>
            <div className="card card-hover p-3.5 sm:p-6 h-full">
              <span className="chip text-[11px] sm:text-xs">{u.tag}</span>
              <div className="mt-3 sm:mt-5 text-white font-medium text-sm sm:text-lg leading-snug">
                {u.title}
              </div>
              <p className="mt-1.5 sm:mt-3 text-xs sm:text-sm text-white/60 leading-relaxed">{u.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ============================================================
   CTA
   ============================================================ */
function CTA() {
  return (
    <Section className="!py-20 md:!py-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-br from-ink-700 to-ink-800 px-5 py-10 sm:px-8 sm:py-14 md:px-14 md:py-16">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(60% 70% at 80% 0%, rgba(127,211,255,0.22), transparent 60%), radial-gradient(50% 60% at 0% 100%, rgba(165,180,252,0.18), transparent 60%)',
            }}
          />
          <div className="relative grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="mono-label mb-4">GET STARTED</div>
              <h3 className="text-3xl md:text-4xl font-semibold text-white leading-tight tracking-tight">
                让每一次合作,
                <br />
                都不再依赖运气。
              </h3>
              <p className="mt-5 text-white/65 max-w-lg leading-relaxed">
                无论你是要把事情做成的买家, 还是要把技能变成稳定收入的创作者,
                WhiteHive 都提供一整套结构化的工具和流程。
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:justify-end gap-3">
              <Link to="/services" className="btn-primary">
                我是买家 · 浏览商品 <Icon name="arrow" size={18} />
              </Link>
              <Link to="/sell" className="btn-brand">
                我是卖家 · 开设服务 <Icon name="arrow" size={18} />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

/* ============================================================
   Contact · 联系我们
   ============================================================ */
function Contact() {
  return (
    <Section className="!py-20 md:!py-24">
      <Reveal>
        <div className="card p-6 sm:p-10 md:p-14 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(50% 60% at 100% 0%, rgba(165,180,252,0.18), transparent 60%)',
            }}
          />
          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="mono-label mb-3">CONTACT</div>
              <h3 className="text-2xl md:text-3xl font-semibold text-white leading-tight">
                想和我们聊聊?
              </h3>
              <p className="mt-4 text-white/60 max-w-lg leading-relaxed">
                无论你是潜在的创作者、买家、合作伙伴, 还是对平台机制本身感兴趣,
                都欢迎直接联系我们。
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:justify-end gap-3">
              <a
                href="mailto:zhouyuhao162@gmail.com"
                className="btn-primary"
              >
                zhouyuhao162@gmail.com <Icon name="arrow" size={18} />
              </a>
              <Link to="/how-it-works" className="btn-ghost">
                查看交易流程
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

/* ============================================================
   页面装配
   ============================================================ */
export default function Home() {
  return (
    <>
      <Hero />
      <div className="divider-line mx-auto max-w-7xl" />
      <CampusCDUT />
      <PopularCategories />
      <LocalPromo />
      <ProcessTimeline />
      <ProblemSolution />
      <VibeCoding />
      <ValueProps />
      <UseCasesSection />
      <CTA />
      <Contact />
    </>
  )
}
