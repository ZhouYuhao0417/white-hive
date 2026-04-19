import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Section, SectionHeader, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import {
  localCategories,
  trustTips,
  routeCards,
} from '../data/localServices.js'
import { useBackendListings } from '../lib/useBackendListings.js'

/* 后端 normalizeBackendService → Local ListingCard 需要的字段 */
function mapToLocalShape(item) {
  const raw = item.raw || {}
  const category = (raw.category || '').replace(/^local\//, '') || null
  const name = item.seller?.name || '服务者'
  return {
    id: item.id,
    category,
    title: item.title,
    displayName: name,
    avatarLetter: name.slice(0, 1),
    org: raw.sellerOrg || item.seller?.bio || '',
    accent: '#7FD3FF',
    canMeet: raw.canMeet !== false,
    distanceKm: raw.distanceKm ?? '—',
    region: raw.region || '同城',
    badges: item.tags || [],
    priceFrom: item.price,
    priceUnit: item.priceUnit || '起',
  }
}

/* ------------------------------ Hero ------------------------------ */
function LocalHero() {
  return (
    <section className="relative pt-14 sm:pt-20 pb-10 sm:pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="grid lg:grid-cols-[1.1fr_.9fr] gap-10 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#7FD3FF]/30 bg-[#7FD3FF]/8 text-[11px] text-[#BEE6FF] tracking-wider"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#7FD3FF] animate-pulse" />
              WHITEHIVE LOCAL · 附近可信服务
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.05 }}
              className="mt-5 text-3xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.08]"
            >
              附近的人，<br className="sm:hidden" />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(120deg,#BEE6FF,#7FD3FF 45%,#5EEAD4)' }}>
                面对面更可信
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.1 }}
              className="mt-5 text-white/65 leading-relaxed text-base sm:text-lg max-w-xl"
            >
              WhiteHive Local 专注同城、近距离、必须线下交付的服务。
              可以先线上沟通、再线下面谈，让家教、陪拍、设备调试、同城协助更踏实。
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-7 flex flex-wrap gap-3"
            >
              <a href="#nearby" className="btn-primary">
                找附近服务
                <Icon name="arrow" size={16} />
              </a>
              <a
                href="#post-need"
                className="inline-flex items-center gap-2 px-5 h-11 rounded-xl border border-white/15 hover:border-brand-300/50 hover:bg-white/[0.04] text-sm text-white/85 hover:text-white transition-colors"
              >
                发布本地需求
              </a>
            </motion.div>

            {/* 三个微指标 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              className="mt-8 grid grid-cols-3 gap-2 sm:gap-4 max-w-md"
            >
              {[
                { k: '6', label: '本地场景' },
                { k: '3km', label: '中位距离' },
                { k: '100%', label: '平台留痕' },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3 sm:px-4 sm:py-4">
                  <div className="text-xl sm:text-2xl font-semibold text-white">{m.k}</div>
                  <div className="mt-0.5 text-[11px] sm:text-xs text-white/45 tracking-wide">{m.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* 右侧：抽象"地图 + 定位点"装饰卡 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative hidden lg:block"
          >
            <div className="relative h-[380px] rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden">
              {/* 网格地图感 */}
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(127,211,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(127,211,255,0.12) 1px, transparent 1px)',
                  backgroundSize: '36px 36px',
                }}
              />
              {/* 中心 you-are-here */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div className="relative">
                  <div className="h-4 w-4 rounded-full bg-[#7FD3FF] shadow-[0_0_0_4px_rgba(127,211,255,0.25)]" />
                  <div className="absolute inset-0 h-4 w-4 rounded-full bg-[#7FD3FF]/60 animate-ping" />
                </div>
                <div className="mt-2 text-[11px] text-white/70 tracking-wider">YOU ARE HERE</div>
              </div>
              {/* 附近点 */}
              {[
                { x: '22%', y: '30%', d: '1.2km', n: '林学姐' },
                { x: '70%', y: '24%', d: '2.4km', n: '陈同学' },
                { x: '78%', y: '64%', d: '3.8km', n: 'Kai' },
                { x: '24%', y: '70%', d: '0.8km', n: '周学长' },
                { x: '52%', y: '80%', d: '5.6km', n: 'Alex' },
              ].map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.12, duration: 0.4 }}
                  className="absolute"
                  style={{ left: p.x, top: p.y }}
                >
                  <div className="flex items-center gap-2 rounded-full bg-ink-900/80 border border-white/15 backdrop-blur px-2.5 py-1 text-[10px] text-white/80 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4]" />
                    {p.n} · {p.d}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------ 两条路线 ------------------------------ */
function RouteCards() {
  return (
    <Section id="routes">
      <SectionHeader
        eyebrow="TWO ROUTES · 两条增长路线"
        title="为什么 WhiteHive Local 独立于普通服务"
        desc="它不是单纯的分类，而是一套围绕“附近、面谈、线下履约”的独立信任机制。"
      />
      <div className="mt-8 sm:mt-12 grid md:grid-cols-2 gap-4 sm:gap-6">
        {routeCards.map((r, idx) => (
          <Reveal key={r.key} delay={idx * 0.08}>
            <div className="h-full rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7 hover:border-white/20 transition-colors">
              <div className="flex items-center gap-3">
                <span
                  className="text-[10px] tracking-[0.2em] px-2 py-1 rounded-md font-semibold"
                  style={{ background: `${r.accent}1A`, color: r.accent, border: `1px solid ${r.accent}55` }}
                >
                  {r.tag}
                </span>
              </div>
              <h3 className="mt-4 text-xl sm:text-2xl font-semibold text-white leading-tight">
                {r.title}
              </h3>
              <p className="mt-3 text-sm sm:text-base text-white/60 leading-relaxed">
                {r.desc}
              </p>

              <div className="mt-5 mono-label">典型场景</div>
              <ul className="mt-2 space-y-1.5">
                {r.scenes.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm text-white/75">
                    <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: r.accent }} />
                    {s}
                  </li>
                ))}
              </ul>

              <div className="mt-5 mono-label">信任机制</div>
              <ul className="mt-2 space-y-1.5">
                {r.trust.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-white/70">
                    <span className="mt-0.5 text-white/50 shrink-0">
                      <Icon name="check" size={14} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ------------------------------ 分类 ------------------------------ */
function CategoryGrid({ activeKey, onPick }) {
  return (
    <Section id="categories">
      <SectionHeader
        eyebrow="LOCAL CATEGORIES · 本地服务分类"
        title="找得到附近的人，解决真实的小问题"
        desc="每个分类都标注了距离范围、价格区间、是否需实名、是否可先线上沟通，不折腾。"
      />
      <div className="mt-8 sm:mt-12 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
        {localCategories.map((c, idx) => {
          const active = activeKey === c.key
          return (
            <Reveal key={c.key} delay={idx * 0.05}>
              <button
                onClick={() => onPick(active ? null : c.key)}
                className={`group w-full text-left h-full rounded-2xl border bg-white/[0.025] p-4 sm:p-5 transition-all ${
                  active ? 'border-[#7FD3FF]/50 bg-[#7FD3FF]/[0.06]' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl grid place-items-center shrink-0"
                    style={{ background: `${c.accent}18`, color: c.accent, border: `1px solid ${c.accent}44` }}
                  >
                    <Icon name={c.icon} size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-semibold text-white truncate">{c.label}</div>
                    <div className="mt-0.5 text-[11px] sm:text-xs text-white/45">{c.distance}</div>
                  </div>
                </div>

                <p className="mt-3 text-xs sm:text-sm text-white/60 leading-relaxed line-clamp-2">
                  {c.desc}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs text-[#BEE6FF]">{c.priceRange}</span>
                  <div className="flex items-center gap-1">
                    {c.needsIdentity && (
                      <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-[#5EEAD4]/10 border border-[#5EEAD4]/25 text-[#CFFDF5] tracking-wide">
                        实名
                      </span>
                    )}
                    {c.allowOnlineFirst && (
                      <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/55 tracking-wide">
                        可线上先聊
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </Reveal>
          )
        })}
      </div>

      {activeKey && (
        <div className="mt-5 text-sm text-white/55 text-center">
          已筛选分类 · <span className="text-white">{localCategories.find((c) => c.key === activeKey)?.label}</span>
          <button className="ml-3 text-[#BEE6FF] hover:underline" onClick={() => onPick(null)}>
            清除
          </button>
        </div>
      )}
    </Section>
  )
}

/* ------------------------------ 附近服务卡 ------------------------------ */
function Avatar({ letter, accent }) {
  return (
    <span
      className="inline-grid place-items-center rounded-full shrink-0 font-semibold text-ink-900 select-none"
      style={{
        width: 42,
        height: 42,
        fontSize: 16,
        background: `linear-gradient(135deg, ${accent}, #7FD3FF)`,
      }}
    >
      {letter}
    </span>
  )
}

function ListingCard({ item }) {
  return (
    <div className="h-full rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5 hover:border-white/25 hover:bg-white/[0.04] transition-colors flex flex-col">
      <div className="flex items-start gap-3">
        <Avatar letter={item.avatarLetter} accent={item.accent} />
        <div className="min-w-0 flex-1">
          <div className="text-sm sm:text-base font-semibold text-white truncate">{item.displayName}</div>
          <div className="text-[11px] sm:text-xs text-white/45 truncate">{item.org}</div>
        </div>
        {item.canMeet && (
          <span className="shrink-0 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-[#7FD3FF]/12 border border-[#7FD3FF]/30 text-[#BEE6FF] tracking-wide whitespace-nowrap">
            可见面
          </span>
        )}
      </div>

      <div className="mt-3 text-sm sm:text-[15px] text-white/90 leading-snug line-clamp-2 min-h-[2.5rem]">
        {item.title}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] sm:text-xs text-white/55">
        <span className="inline-flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          距你 {item.distanceKm}km
        </span>
        <span className="text-white/25">·</span>
        <span className="truncate">{item.region}</span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1">
        {item.badges.map((b) => (
          <span
            key={b}
            className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/12 text-white/60 tracking-wide"
          >
            {b}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-end justify-between gap-2 pt-3 border-t border-white/5">
        <div>
          <div className="text-[10px] text-white/40 tracking-wider">起步价</div>
          <div className="text-base sm:text-lg font-semibold text-white">
            ¥{item.priceFrom}
            <span className="text-[11px] text-white/45 ml-0.5">{item.priceUnit}</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg border border-white/12 hover:border-white/30 hover:bg-white/5 text-[11px] sm:text-xs text-white/80 transition-colors">
            详情
          </button>
          <button className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-medium text-ink-900"
            style={{ background: 'linear-gradient(180deg,#BEE6FF,#7FD3FF)' }}
          >
            发起沟通
          </button>
        </div>
      </div>
    </div>
  )
}

function NearbyList({ activeKey }) {
  const { listings: backend, loading, error } = useBackendListings('local')
  const list = useMemo(() => {
    const mapped = backend.map(mapToLocalShape)
    if (!activeKey) return mapped
    return mapped.filter((n) => n.category === activeKey)
  }, [backend, activeKey])

  return (
    <Section id="nearby">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <SectionHeader
          eyebrow="NEARBY · 附近的服务"
          title="按距离排序，优先为您匹配附近买卖家"
          desc="位置仅展示到区 / 校园，具体见面点由双方在订单里确认。"
        />
        <div className="flex items-center gap-2 text-xs text-white/45 pb-2">
          <span className="h-2 w-2 rounded-full bg-[#5EEAD4]" />
          基于模拟定位 · 成都
        </div>
      </div>

      {loading ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
          正在加载附近的服务...
        </div>
      ) : error ? (
        <div className="mt-8 rounded-2xl border border-red-400/25 bg-red-400/5 p-8 text-center text-sm text-red-100/80">
          加载失败：{error.message || '网络不稳, 稍后再试。'}
        </div>
      ) : list.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-white/50">
          {activeKey ? '当前分类附近暂无可见的服务者。' : '平台刚开放, 还没有本地服务者入驻。你可以直接发布需求, 我们会推送给附近符合条件的服务者。'}
        </div>
      ) : (
        <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
          {list.map((item, idx) => (
            <Reveal key={item.id} delay={idx * 0.04}>
              <ListingCard item={item} />
            </Reveal>
          ))}
        </div>
      )}
    </Section>
  )
}

/* ------------------------------ 信任与安全 ------------------------------ */
function TrustTips() {
  return (
    <Section id="safety" className="bg-gradient-to-b from-transparent via-white/[0.015] to-transparent">
      <SectionHeader
        eyebrow="SAFETY · 本地服务安全提示"
        title="线下更有温度，但前提是安全可控"
        desc="WhiteHive Local 的设计原则：把可能的风险在下单前说清楚，而不是只讲故事。"
      />
      <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        {trustTips.map((t, idx) => (
          <Reveal key={t.title} delay={idx * 0.06}>
            <div className="h-full rounded-2xl border border-white/10 bg-white/[0.025] p-5 hover:border-[#7FD3FF]/30 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-[#7FD3FF]/10 border border-[#7FD3FF]/25 text-[#BEE6FF] grid place-items-center">
                <Icon name={t.icon} size={18} />
              </div>
              <h4 className="mt-4 text-sm sm:text-base font-semibold text-white">{t.title}</h4>
              <p className="mt-2 text-xs sm:text-sm text-white/60 leading-relaxed">
                {t.desc}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ------------------------------ 发布本地需求 ------------------------------ */
function PostNeedForm() {
  const [form, setForm] = useState({
    city: '',
    service: '',
    meetMode: 'offline',
    budget: '',
    time: '',
    needIdentity: true,
  })
  const [submitted, setSubmitted] = useState(false)

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    // 原型：仅前端展示成功态
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 4000)
  }

  return (
    <Section id="post-need">
      <SectionHeader
        eyebrow="POST · 发布本地需求"
        title="说清楚你在哪 · 需要什么 · 什么时候见"
        desc="表单提交后会进入本地需求池，附近符合条件的服务者会收到推送。"
      />

      <div className="mt-8 sm:mt-12 grid lg:grid-cols-[1fr_.8fr] gap-6">
        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="mono-label">你在哪个城市 / 区域</span>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="例如：成都 · 高新区"
                required
                className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
              />
            </label>
            <label className="block">
              <span className="mono-label">需要什么服务</span>
              <input
                type="text"
                value={form.service}
                onChange={(e) => update('service', e.target.value)}
                placeholder="例如：周末高数辅导"
                required
                className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
              />
            </label>
          </div>

          <div>
            <span className="mono-label">期望形式</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { v: 'offline', label: '上门 / 线下' },
                { v: 'meet-first', label: '先见一面' },
                { v: 'online-first', label: '线上先聊' },
              ].map((o) => {
                const active = form.meetMode === o.v
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => update('meetMode', o.v)}
                    className={`h-11 rounded-xl text-xs sm:text-sm border transition-colors ${
                      active
                        ? 'bg-[#7FD3FF]/10 border-[#7FD3FF]/55 text-white'
                        : 'bg-white/[0.02] border-white/10 text-white/65 hover:border-white/25'
                    }`}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="mono-label">预算（可选）</span>
              <input
                type="text"
                value={form.budget}
                onChange={(e) => update('budget', e.target.value)}
                placeholder="例如：¥200 以内 / 小时"
                className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
              />
            </label>
            <label className="block">
              <span className="mono-label">期望时间</span>
              <input
                type="text"
                value={form.time}
                onChange={(e) => update('time', e.target.value)}
                placeholder="例如：本周六下午 / 工作日晚"
                className="mt-2 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
              />
            </label>
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.015]">
            <input
              type="checkbox"
              checked={form.needIdentity}
              onChange={(e) => update('needIdentity', e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#7FD3FF]"
            />
            <div>
              <div className="text-sm text-white">只允许实名认证服务者接单</div>
              <div className="mt-0.5 text-[11px] sm:text-xs text-white/45">
                推荐开启：涉及未成年人 / 上门服务 / 现金支付时，建议强制实名。
              </div>
            </div>
          </label>

          {submitted && (
            <div className="rounded-xl border border-[#5EEAD4]/25 bg-[#5EEAD4]/10 px-4 py-3 text-xs sm:text-sm text-[#CFFDF5] flex items-center gap-2">
              <Icon name="check" size={14} />
              本地需求已进入附近服务者推送池（前端原型效果）。
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="submit" className="btn-primary">
              发布本地需求
              <Icon name="arrow" size={16} />
            </button>
            <span className="text-[11px] sm:text-xs text-white/45">
              发布需求不收取费用，成交后仅对服务者收取平台服务费。
            </span>
          </div>
        </form>

        {/* 右侧辅助说明 */}
        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7 h-full">
            <div className="mono-label mb-3">发布后会发生什么</div>
            <ol className="space-y-4">
              {[
                { k: '01', t: '附近服务者收到推送', d: '系统按距离 + 分类匹配，只推送给真实在该区域活跃的人。' },
                { k: '02', t: '他们主动联系你', d: '对方在站内发起沟通，所有对话在平台留痕。' },
                { k: '03', t: '先线上聊 / 再线下见', d: '你可以先在站内聊，确认后约在公共场所见面。' },
                { k: '04', t: '在订单里托管付款', d: '线下履约结束后确认，平台再把款项释放给服务者。' },
              ].map((s) => (
                <li key={s.k} className="flex gap-3">
                  <span className="shrink-0 h-7 w-7 rounded-md bg-[#7FD3FF]/10 border border-[#7FD3FF]/25 text-[#BEE6FF] grid place-items-center text-[11px] font-semibold">
                    {s.k}
                  </span>
                  <div>
                    <div className="text-sm text-white">{s.t}</div>
                    <div className="mt-0.5 text-xs text-white/55 leading-relaxed">{s.d}</div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-[11px] sm:text-xs text-white/50 leading-relaxed">
              WhiteHive 提示：任何要求「先线下付现金、跳过平台」的行为均不受平台担保。
              <Link to="/trust" className="ml-1 text-[#BEE6FF] hover:underline">
                了解可信机制
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

/* ------------------------------ 页面入口 ------------------------------ */
export default function Local() {
  const [activeCategory, setActiveCategory] = useState(null)

  return (
    <>
      {/* 顶部只保留 Hero 做总介绍 */}
      <LocalHero />
      {/* 商品直接前置 */}
      <NearbyList activeKey={activeCategory} />
      {/* 以下为说明性内容：分类说明 / 两条路线 / 安全提示 / 发布需求 */}
      <CategoryGrid activeKey={activeCategory} onPick={setActiveCategory} />
      <RouteCards />
      <TrustTips />
      <PostNeedForm />
    </>
  )
}
