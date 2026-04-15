import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
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
    <section className="relative hero-glow pt-20 md:pt-28 pb-20 md:pb-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        {/* 放大的品牌 chip */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center"
        >
          <span className="chip-hero">
            <span className="h-2 w-2 rounded-full bg-[#F5C451] shadow-[0_0_12px_#F5C451]" />
            whitehive.cn · 可信数字服务交易平台
          </span>
        </motion.div>

        {/* 主标题 */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="mt-7 text-center text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-semibold tracking-tight text-white leading-[1.08]"
        >
          把每一次线上合作,
          <br className="hidden sm:block" />
          做成一件可以<span className="text-honey-gradient">被托付</span>的事。
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-6 max-w-2xl mx-auto text-center text-white/65 text-base md:text-lg leading-relaxed"
        >
          WhiteHive 面向青年创作者、自由职业者、学生卖家, 以及个人与小微团队买家。
          让服务更容易被理解、让需求更结构化、让交付真正可信。
        </motion.p>

        {/* 买家入口 / 卖家入口 —— 双轨 CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22 }}
          className="mt-10 flex flex-col sm:flex-row items-stretch justify-center gap-3"
        >
          <Link to="/how-it-works" className="btn-primary group">
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-normal opacity-75 tracking-wider">FOR BUYERS</span>
              <span>我是买家 · 发布需求</span>
            </span>
            <Icon name="arrow" size={18} />
          </Link>
          <Link to="/services" className="btn-brand group">
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-normal opacity-75 tracking-wider">FOR CREATORS</span>
              <span>我是卖家 · 开设服务</span>
            </span>
            <Icon name="arrow" size={18} />
          </Link>
        </motion.div>

        {/* 细节:三个信任徽章 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="mt-12 flex items-center justify-center gap-6 text-[12px] text-white/45"
        >
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F5C451]" />
            资金托管
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7FD3FF]" />
            结构化需求
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
            可验收交付
          </span>
        </motion.div>
      </div>
    </section>
  )
}

/* ============================================================
   PopularCategories · 热门分类 (交易入口, 前置)
   6 个主要方向 + 第 7 格 AI 精准匹配 (大横卡)
   ============================================================ */
function PopularCategories() {
  // 只展示前 6 个 (web, design, resume, data, video, ai), 游戏代肝留在 /services 全集里
  const list = services.slice(0, 6)
  return (
    <Section className="!py-20 md:!py-24">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <SectionHeader
          eyebrow="CATEGORIES · 热门分类"
          title="六个方向, 同一套结构。"
          desc="每一个分类都按相同的字段设计: 交付物、适用对象、范围边界。点击进入对应分类详情。"
        />
        <Link to="/services" className="btn-ghost text-sm">
          查看全部分类 <Icon name="arrow" size={16} />
        </Link>
      </div>

      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((s, i) => (
          <Reveal key={s.slug} delay={i * 0.05}>
            <Link
              to={`/services#${s.slug}`}
              className="card card-hover block p-6 h-full group relative overflow-hidden"
            >
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{
                  background: `linear-gradient(to right, transparent, ${s.color}, transparent)`,
                }}
              />
              <div className="flex items-center justify-between">
                <div
                  className="h-11 w-11 rounded-xl flex items-center justify-center"
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
              <div className="mt-5 font-medium text-white text-lg">{s.title}</div>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">{s.tagline}</p>
              <div className="mt-5 flex flex-wrap gap-1.5">
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
                className="mt-5 flex items-center gap-2 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: s.color }}
              >
                查看详情 <Icon name="arrow" size={14} />
              </div>
            </Link>
          </Reveal>
        ))}
      </div>

      {/* 第 7 格 · AI 精准匹配 —— 跨列大卡 */}
      <Reveal delay={0.1}>
        <div className="mt-4">
          <Link
            to="/how-it-works"
            className="card card-hover block p-7 md:p-9 relative overflow-hidden group"
            style={{
              background:
                'linear-gradient(135deg, rgba(245,196,81,0.08) 0%, rgba(127,211,255,0.06) 100%)',
              borderColor: 'rgba(245,196,81,0.30)',
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(40% 60% at 100% 0%, rgba(245,196,81,0.18), transparent 60%), radial-gradient(40% 60% at 0% 100%, rgba(127,211,255,0.15), transparent 60%)',
              }}
            />
            <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(245,196,81,0.14)',
                  border: '1px solid rgba(245,196,81,0.45)',
                  color: '#F5C451',
                }}
              >
                <Icon name="spark" size={26} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="mono-label mb-1">AI MATCH · 07</div>
                <div className="text-white font-medium text-xl leading-tight">
                  没找到相关的服务? 试试 AI 精准匹配需求。
                </div>
                <p className="mt-2 text-sm text-white/65 leading-relaxed max-w-2xl">
                  把你想做的事直接告诉 AI, 它会理解你的意图、拆解需求, 并从全平台匹配到最合适的创作者
                  —— 覆盖以上六个分类之外的长尾场景。
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:ml-auto shrink-0">
                <span className="chip">自然语言描述</span>
                <span className="chip">智能拆解</span>
                <span className="chip">精准匹配</span>
              </div>
              <div className="text-[#F5C451] hidden md:block">
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
   ProcessTimeline · 7 步流程 (Scroll-Triggered 顺序点亮)
   ============================================================ */
function StepCard({ step, index, progress, total }) {
  const startAt = index / total
  const endAt = (index + 0.6) / total
  const stepOpacity = useTransform(progress, [startAt, endAt], [0.25, 1])
  const stepY = useTransform(progress, [startAt, endAt], [18, 0])
  const borderColor = useTransform(
    progress,
    [startAt, endAt],
    ['rgba(255,255,255,0.08)', 'rgba(245,196,81,0.55)']
  )
  const bgColor = useTransform(
    progress,
    [startAt, endAt],
    ['rgba(255,255,255,0.025)', 'rgba(245,196,81,0.08)']
  )
  const labelColor = useTransform(
    progress,
    [startAt, endAt],
    ['#7FD3FF', '#F5C451']
  )

  return (
    <motion.div style={{ opacity: stepOpacity, y: stepY }} className="relative">
      <motion.div
        style={{ borderColor, background: bgColor }}
        className="h-[58px] rounded-xl border flex items-center justify-center"
      >
        <motion.span
          style={{ color: labelColor }}
          className="font-mono text-xs tracking-wider font-semibold"
        >
          STEP {step.k}
        </motion.span>
      </motion.div>
      <div className="mt-3 text-sm text-white font-medium">{step.title}</div>
      <div className="mt-1 text-xs text-white/50 leading-relaxed">{step.desc}</div>
    </motion.div>
  )
}

function ProcessTimeline() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'end 0.4'],
  })

  // 连接线从左到右扫过
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <Section className="!py-20 md:!py-24">
      <SectionHeader
        eyebrow="HOW IT WORKS · 交易流程"
        title="一次交易, 七个结构化节点。"
        desc="从浏览服务到完成评价, 每一步都是一个明确的状态, 而不是一次模糊的聊天。往下滚, 看它一步一步点亮。"
      />

      <div ref={ref} className="mt-12 relative">
        {/* 背景线 */}
        <div className="absolute left-0 right-0 top-[29px] h-px bg-white/8 hidden lg:block" />
        {/* 动画扫过的亮线 */}
        <motion.div
          style={{ scaleX: lineScale, transformOrigin: '0% 50%' }}
          className="absolute left-0 right-0 top-[29px] h-px hidden lg:block"
        >
          <div className="h-full w-full bg-gradient-to-r from-[#7FD3FF] via-[#F5C451] to-[#FBE29A]" />
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {steps.map((s, i) => (
            <StepCard
              key={s.k}
              step={s}
              index={i}
              progress={scrollYProgress}
              total={steps.length}
            />
          ))}
        </div>
      </div>

      <div className="mt-12 flex justify-center">
        <Link to="/how-it-works" className="btn-ghost text-sm">
          查看完整流程 <Icon name="arrow" size={16} />
        </Link>
      </div>
    </Section>
  )
}

/* ============================================================
   Problem → Solution · 主要信任内容 (双卡对齐)
   ============================================================ */
function ProblemSolution() {
  const rowClass = 'min-h-[96px] flex items-start gap-4'
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
          <div className="card p-7 md:p-8 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="flex items-center gap-3 mb-7">
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
                  className={`${rowClass} rounded-xl bg-white/[0.02] border border-white/8 p-4`}
                >
                  <div className="mono-label text-white/35 w-7 shrink-0 mt-[2px]">
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

          {/* 解法卡 —— 改为蜂蜜金主调 */}
          <div
            className="card p-7 md:p-8 relative overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, rgba(245,196,81,0.06), rgba(245,196,81,0.01))',
              borderColor: 'rgba(245,196,81,0.30)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F5C451]/55 to-transparent" />
            <div className="flex items-center gap-3 mb-7">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'rgba(245,196,81,0.12)',
                  border: '1px solid rgba(245,196,81,0.38)',
                  color: '#F5C451',
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
                  className={`${rowClass} rounded-xl p-4`}
                  style={{
                    background: 'rgba(245,196,81,0.05)',
                    border: '1px solid rgba(245,196,81,0.22)',
                  }}
                >
                  <div
                    className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-[1px]"
                    style={{
                      background: 'rgba(245,196,81,0.16)',
                      border: '1px solid rgba(245,196,81,0.38)',
                      color: '#F5C451',
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

        {/* 指引到 /trust */}
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
      desc: '调用平台的 Vibe Coding API, 用结构化的需求直接跑出一版可运行的成品。',
      color: '#F5C451',
    },
    {
      k: '03',
      icon: 'check',
      title: '满意? 直接结算。',
      desc: '如果初版已经达到你的预期, 可以直接付款收走, 省去一轮人工沟通。',
      color: '#34D399',
    },
    {
      k: '04',
      icon: 'route',
      title: '不满意? AI 精准匹配卖家。',
      desc: '平台根据已经说清的需求和初版反馈, 挑出最契合的真人卖家继续打磨。',
      color: '#FBE29A',
    },
  ]
  return (
    <Section className="!py-20 md:!py-24">
      <SectionHeader
        eyebrow="VIBE CODING · AI 辅助交付"
        title="当你需要的是一段代码、一页设计、一份文档。"
        desc="Vibe Coding 在国内还不算流行。WhiteHive 想做的是: 把它做成一个人人都能用、而且用得放心的入口。"
      />
      <Reveal>
        <div className="mt-12 relative card p-8 md:p-10 overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(60% 70% at 100% 0%, rgba(245,196,81,0.14), transparent 60%), radial-gradient(50% 60% at 0% 100%, rgba(127,211,255,0.14), transparent 60%)',
            }}
          />
          <div className="relative grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {vibeSteps.map((s, i) => (
              <motion.div
                key={s.k}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${s.color}14`,
                      border: `1px solid ${s.color}40`,
                      color: s.color,
                    }}
                  >
                    <Icon name={s.icon} size={18} />
                  </div>
                  <span
                    className="font-mono text-xs tracking-wider"
                    style={{ color: s.color }}
                  >
                    STEP {s.k}
                  </span>
                </div>
                <div className="mt-5 text-white font-medium text-[15px] leading-snug">
                  {s.title}
                </div>
                <p className="mt-2 text-xs text-white/60 leading-relaxed">{s.desc}</p>
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
            <Link to="/how-it-works" className="btn-ghost text-sm">
              试试 AI 引导式提交 <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

/* ============================================================
   ValueProps · 核心价值 (放到后半段作为品牌叙事)
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
      color: '#F5C451',
      title: '前置化的信任治理',
      desc: '纠纷防控、版权保护、合规边界, 全部在交易开始前就已建立。',
    },
    {
      icon: 'vault',
      color: '#34D399',
      title: '可追溯的交易流程',
      desc: '从下单到验收, 每一步都有记录, 关键节点支持上链存证。',
    },
    {
      icon: 'spark',
      color: '#FBE29A',
      title: '像产品一样的体验',
      desc: 'WhiteHive 不是一个接单广场, 而是一个成熟产品化的交易环境。',
    },
  ]
  return (
    <Section className="!py-20 md:!py-24">
      <SectionHeader
        eyebrow="CORE VALUE · 核心价值"
        title="我们在解决一个真实存在的问题。"
        desc="线上数字服务的交易, 长期依赖聊天、转账和个人信誉。我们想把这件事做成产品。"
      />
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 0.06}>
            <div className="card card-hover p-6 h-full">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `${it.color}14`,
                  border: `1px solid ${it.color}40`,
                  color: it.color,
                }}
              >
                <Icon name={it.icon} />
              </div>
              <div className="mt-5 font-medium text-white">{it.title}</div>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">{it.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ============================================================
   UseCases · 真实场景
   ============================================================ */
function UseCasesSection() {
  return (
    <Section className="!py-20 md:!py-24">
      <SectionHeader
        eyebrow="USE CASES · 场景"
        title="在真实的场景里, 它长这样。"
      />
      <div className="mt-10 grid md:grid-cols-3 gap-4">
        {useCases.map((u, i) => (
          <Reveal key={u.title} delay={i * 0.06}>
            <div className="card card-hover p-6 h-full">
              <span className="chip">{u.tag}</span>
              <div className="mt-5 text-white font-medium text-lg leading-snug">
                {u.title}
              </div>
              <p className="mt-3 text-sm text-white/60 leading-relaxed">{u.desc}</p>
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
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-700 to-ink-800 px-8 py-14 md:px-14 md:py-16">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(60% 70% at 80% 0%, rgba(245,196,81,0.22), transparent 60%), radial-gradient(50% 60% at 0% 100%, rgba(127,211,255,0.14), transparent 60%)',
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
                无论你是想把事情做成的买家, 还是想把技能变成稳定收入的创作者,
                WhiteHive 都会陪你走完第一步。
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:justify-end gap-3">
              <Link to="/how-it-works" className="btn-primary">
                我是买家 · 发布需求 <Icon name="arrow" size={18} />
              </Link>
              <Link to="/services" className="btn-brand">
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
   页面装配 —— 交易模块前置
   ============================================================ */
export default function Home() {
  return (
    <>
      <Hero />
      <div className="divider-line mx-auto max-w-7xl" />
      {/* 交易入口前置 */}
      <PopularCategories />
      {/* 主要交付流程(动画) */}
      <ProcessTimeline />
      {/* 主要可信内容 */}
      <ProblemSolution />
      {/* AI 辅助亮点 */}
      <VibeCoding />
      {/* 品牌叙事放后面 */}
      <ValueProps />
      <UseCasesSection />
      <CTA />
    </>
  )
}
