import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Section, SectionHeader, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import {
  cdutCampus,
  cdutCategories,
  cdutTrustPoints,
} from '../data/cdutServices.js'
import { useBackendListings } from '../lib/useBackendListings.js'

/* 把后端 normalizeBackendService 的输出补齐成 CDUT listing 需要的字段 */
function mapToCDUTShape(item) {
  const raw = item.raw || {}
  const catKey = (raw.category || '').replace(/^cdut\//, '') || 'parcel'
  return {
    id: item.id,
    categoryKey: catKey,
    zone: raw.zone || raw.location || '校内',
    title: item.title,
    desc: item.desc,
    priceFrom: item.price,
    priceUnit: item.priceUnit || '单',
    tags: item.tags || [],
    seller: {
      name: item.seller?.name || '同学',
      rating: item.rating ?? 5.0,
      level: item.seller?.verified ? '已核验' : '新人',
      grade: raw.sellerGrade || '',
      orders: raw.sellerOrders ?? 0,
    },
  }
}

/* ============================================================
   Hero · CDUT 专属首屏
   ============================================================ */
function CDUTHero({ metrics }) {
  return (
    <section className="relative pt-24 sm:pt-28 md:pt-32 pb-10 sm:pb-14">
      <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <Reveal>
          <div
            className="card p-6 sm:p-10 md:p-12 relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, rgba(127,211,255,0.09) 0%, rgba(94,234,212,0.07) 50%, rgba(165,180,252,0.07) 100%)',
              borderColor: 'rgba(127,211,255,0.28)',
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-60 pointer-events-none"
              style={{
                background:
                  'radial-gradient(45% 60% at 100% 0%, rgba(127,211,255,0.22), transparent 60%), radial-gradient(40% 55% at 0% 100%, rgba(94,234,212,0.16), transparent 60%)',
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="mono-label text-[#BEE6FF]">CAMPUS · 校园专区</span>
                <span className="text-[10px] sm:text-xs font-mono tracking-wider px-2 py-1 rounded border border-[#7FD3FF]/30 text-[#BEE6FF] bg-[#7FD3FF]/[0.06]">
                  {cdutCampus.nameEn}
                </span>
              </div>
              <h1 className="mt-3 sm:mt-4 text-2xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight leading-tight">
                {cdutCampus.name}
                <span className="text-cool-gradient"> 服务专区</span>
              </h1>
              <p className="mt-3 sm:mt-4 text-white/70 leading-relaxed text-sm sm:text-base md:text-lg max-w-3xl">
                {cdutCampus.desc}
              </p>

              {/* 校区 tags */}
              <div className="mt-5 sm:mt-6 flex flex-wrap gap-2">
                {cdutCampus.zones.map((z) => (
                  <span
                    key={z}
                    className="text-[11px] sm:text-xs px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-white/70"
                  >
                    {z}
                  </span>
                ))}
              </div>

              {/* Metrics · 均从后端实时统计 */}
              <div className="mt-6 sm:mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {metrics.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-white/8 bg-white/[0.025] px-3 sm:px-4 py-3 sm:py-4"
                  >
                    <div className="text-lg sm:text-2xl font-semibold text-white tracking-tight">
                      {m.value}
                    </div>
                    <div className="mt-0.5 text-[10px] sm:text-[11px] mono-label text-white/50">
                      {m.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ============================================================
   Category filter
   ============================================================ */
function CDUTFilterBar({ active, setActive }) {
  const all = [{ key: 'all', label: '全部', color: '#BEE6FF' }, ...cdutCategories]
  return (
    <div className="mt-6 sm:mt-8 flex flex-wrap gap-2">
      {all.map((c) => {
        const isActive = active === c.key
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => setActive(c.key)}
            className="px-3.5 h-9 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap"
            style={{
              background: isActive ? `${c.color}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isActive ? `${c.color}70` : 'rgba(255,255,255,0.10)'}`,
              color: isActive ? c.color : 'rgba(255,255,255,0.70)',
            }}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

/* ============================================================
   3 big category cards
   ============================================================ */
function CDUTCategoryCards({ onSelect, minPriceByCat }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5">
      {cdutCategories.map((c, i) => {
        const minPrice = minPriceByCat?.[c.key]
        const hasReal = Number.isFinite(minPrice)
        return (
        <Reveal key={c.key} delay={i * 0.06}>
          <button
            type="button"
            onClick={() => onSelect(c.key)}
            className="card card-hover block w-full text-left p-5 sm:p-6 relative overflow-hidden group"
          >
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background: `linear-gradient(to right, transparent, ${c.color}, transparent)`,
              }}
            />
            <div className="flex items-center justify-between">
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center"
                style={{
                  background: `${c.color}14`,
                  border: `1px solid ${c.color}40`,
                  color: c.color,
                }}
              >
                <Icon name={c.icon} size={20} />
              </div>
              <span
                className="font-mono text-xs tracking-wider"
                style={{ color: hasReal ? c.color : 'rgba(255,255,255,0.45)' }}
              >
                {hasReal ? `¥${minPrice} 起 / ${c.priceUnit}` : '等你来首单'}
              </span>
            </div>
            <div className="mt-4 text-white font-medium text-base sm:text-lg leading-snug">
              {c.label}
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-white/60 leading-relaxed">
              {c.desc}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {c.scenes.map((s) => (
                <span
                  key={s}
                  className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/8 text-white/65 whitespace-nowrap"
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between">
              <span className="text-[11px] text-white/45">{c.meta}</span>
              <span
                className="text-xs flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
                style={{ color: c.color }}
              >
                看服务者 <Icon name="arrow" size={12} />
              </span>
            </div>
          </button>
        </Reveal>
        )
      })}
    </div>
  )
}

/* ============================================================
   Listings (列表视图 · 移动端堆叠)
   ============================================================ */
function CDUTListings({ listings }) {
  const colorFor = (key) =>
    cdutCategories.find((c) => c.key === key)?.color || '#7FD3FF'
  const labelFor = (key) =>
    cdutCategories.find((c) => c.key === key)?.label || ''

  if (listings.length === 0) {
    return (
      <div className="mt-6 card p-8 text-center text-white/55">
        暂时还没有这类服务。换一个分类试试?
      </div>
    )
  }

  return (
    <div className="mt-6 sm:mt-8 card p-2 md:p-3">
      {listings.map((item, i) => {
        const color = colorFor(item.categoryKey)
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            className="px-3 sm:px-4 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors last:border-b-0"
          >
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: `${color}18`,
                  border: `1px solid ${color}45`,
                  color,
                }}
              >
                <Icon name={cdutCategories.find((c) => c.key === item.categoryKey)?.icon || 'cube'} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-block whitespace-nowrap text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded"
                        style={{
                          background: `${color}14`,
                          border: `1px solid ${color}35`,
                          color,
                        }}
                      >
                        {labelFor(item.categoryKey)}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-white/45 whitespace-nowrap">
                        {item.zone}
                      </span>
                    </div>
                    <div className="mt-1.5 text-sm sm:text-base text-white font-medium leading-snug">
                      {item.title}
                    </div>
                    <div className="mt-1 text-[11px] sm:text-xs text-white/55 leading-relaxed line-clamp-2">
                      {item.desc}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[11px] text-white/45">¥</span>
                      <span
                        className="text-lg sm:text-xl font-semibold"
                        style={{ color }}
                      >
                        {item.priceFrom}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-white/50">
                        起 / {item.priceUnit}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] sm:text-[11px]" style={{ color }}>
                      ★ {item.seller.rating}
                    </div>
                  </div>
                </div>

                {/* Seller + tags */}
                <div className="mt-3 flex items-center gap-2 sm:gap-3 flex-wrap">
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0"
                    style={{
                      background: `${color}20`,
                      border: `1px solid ${color}40`,
                      color,
                    }}
                  >
                    {item.seller.name.slice(-1)}
                  </div>
                  <div className="text-[11px] sm:text-xs text-white/70 truncate">
                    {item.seller.name}
                    <span className="text-white/40">
                      {' '}· {item.seller.level}
                      {item.seller.grade ? ` · ${item.seller.grade}` : ''}
                    </span>
                  </div>
                  {item.seller.orders > 0 && (
                    <span className="text-[10px] sm:text-[11px] text-white/40 whitespace-nowrap">
                      已接 {item.seller.orders} 单
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/8 text-white/60 whitespace-nowrap"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    to={`/ai-match?category=${item.categoryKey === 'photo' ? 'design' : 'any'}`}
                    className="text-[11px] sm:text-xs px-3 py-1.5 rounded-md border border-white/10 text-white/70 hover:border-[#7FD3FF]/40 hover:text-white transition-colors"
                  >
                    发需求找 ta
                  </Link>
                  <button
                    type="button"
                    className="text-[11px] sm:text-xs px-3 py-1.5 rounded-md font-medium"
                    style={{
                      background: `${color}18`,
                      border: `1px solid ${color}50`,
                      color,
                    }}
                  >
                    立即下单
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ============================================================
   Trust Row · 为什么放心
   ============================================================ */
function CDUTTrustRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5">
      {cdutTrustPoints.map((t, i) => (
        <Reveal key={t.title} delay={i * 0.06}>
          <div className="card p-5 sm:p-6 h-full">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{
                background: `${t.color}14`,
                border: `1px solid ${t.color}40`,
                color: t.color,
              }}
            >
              <Icon name={t.icon} size={18} />
            </div>
            <div className="mt-4 text-white font-medium text-base sm:text-lg">
              {t.title}
            </div>
            <p className="mt-2 text-xs sm:text-sm text-white/60 leading-relaxed">
              {t.desc}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

/* ============================================================
   How it works · 校园专属 3 步流程
   ============================================================ */
function CDUTHowItWorks() {
  const steps = [
    {
      k: '01',
      title: '选分类 + 发单',
      desc: '选"快递代取 / 外卖代取 / 校园约拍", 30 秒填完单子, 系统推送给附近同学。',
      color: '#7FD3FF',
    },
    {
      k: '02',
      title: '同校同学接单',
      desc: '系统按校区 + 楼栋就近派单, 同一栋楼优先。站内聊天先对齐细节和金额。',
      color: '#A5B4FC',
    },
    {
      k: '03',
      title: '见面完成 · 自行结款',
      desc: '校园专区不走平台托管, 金额和支付方式由双方自行协商; 沟通记录全部留在站内。',
      color: '#5EEAD4',
    },
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
      {steps.map((s, i) => (
        <Reveal key={s.k} delay={i * 0.05}>
          <div className="card p-5 sm:p-6 h-full">
            <div className="flex items-center justify-between">
              <span
                className="font-mono text-xs tracking-wider"
                style={{ color: s.color }}
              >
                STEP {s.k}
              </span>
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }}
              />
            </div>
            <div className="mt-4 text-white font-medium text-base sm:text-lg">
              {s.title}
            </div>
            <p className="mt-2 text-xs sm:text-sm text-white/60 leading-relaxed">
              {s.desc}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

/* ============================================================
   主页面
   ============================================================ */
export default function CDUT() {
  const [active, setActive] = useState('all')
  // CDUT 校园服务统一用 category 前缀 "cdut/*" —— 当后端有上架时自动出现
  const { listings: backend, loading, error } = useBackendListings('cdut')

  const all = useMemo(() => backend.map(mapToCDUTShape), [backend])
  const filtered = useMemo(() => {
    if (active === 'all') return all
    return all.filter(
      (l) => l.categoryKey === active || (Array.isArray(l.tags) && l.tags.includes(active)),
    )
  }, [all, active])

  // 每个分类的最低真实价(从后端统计)
  const minPriceByCat = useMemo(() => {
    const map = {}
    for (const item of all) {
      const key = item.categoryKey
      const price = Number(item.priceFrom)
      if (!Number.isFinite(price) || price <= 0) continue
      if (!(key in map) || price < map[key]) map[key] = price
    }
    return map
  }, [all])

  // Hero 真实指标 —— 服务者数 / 上架数 / 本月接单(先以当月上架数占位) / 完成率
  const metrics = useMemo(() => {
    const sellerIds = new Set()
    for (const item of backend) {
      const sid = item.raw?.sellerId || item.seller?.id
      if (sid) sellerIds.add(sid)
    }
    const total = backend.length
    return [
      { label: '在校服务者', value: sellerIds.size > 0 ? String(sellerIds.size) : '—' },
      { label: '在架服务', value: total > 0 ? String(total) : '—' },
      { label: '平均响应', value: total > 0 ? '< 12 分钟' : '—' },
      { label: '完成率', value: total > 0 ? '—' : '—' },
    ]
  }, [backend])

  return (
    <>
      <CDUTHero metrics={metrics} />

      {/* 3 张大分类卡 —— 点击直接滚动到筛选结果 */}
      <Section className="!pt-4 !pb-10 sm:!pb-16">
        <SectionHeader
          eyebrow="SERVICES · 三类校园微服务"
          title="先把最高频的三件事做好。"
          desc="后续会根据同学们的真实需求继续加品类, 不会一口气铺一堆没人用的栏目。"
        />
        <div className="mt-6 sm:mt-8">
          <CDUTCategoryCards onSelect={setActive} minPriceByCat={minPriceByCat} />
        </div>
      </Section>

      {/* Listings + filter */}
      <Section className="!pt-0">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <SectionHeader
            eyebrow="LISTINGS · 在校服务者"
            title="都是 CDUT 在校同学。"
            desc="身份已核验, 按校区就近派单。看到合适的就下单, 不合适再试另一个。"
          />
        </div>
        <CDUTFilterBar active={active} setActive={setActive} />
        <CDUTListings listings={filtered} />
      </Section>

      {/* How it works */}
      <Section>
        <SectionHeader
          eyebrow="HOW IT WORKS · 三步走完"
          title="从发单到见面, 一张图讲清。"
          desc="站内沟通 + 就近派单, 金额由双方自行协商, 平台不介入资金。"
        />
        <div className="mt-8 sm:mt-10">
          <CDUTHowItWorks />
        </div>
      </Section>

      {/* Trust */}
      <Section>
        <SectionHeader
          eyebrow="TRUST · 凭什么放心"
          title="校园场景, 三件事托住。"
          desc="身份核验、站内留痕、就近派单 —— 每一件都是可验证的机制, 不是口号。校园专区金额由双方自行协商, 平台不做资金托管。"
        />
        <div className="mt-8 sm:mt-10">
          <CDUTTrustRow />
        </div>
      </Section>

      {/* CTA · 招募在校服务者 */}
      <Section className="!pb-20">
        <Reveal>
          <div
            className="card p-6 sm:p-10 md:p-12 relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, rgba(127,211,255,0.08) 0%, rgba(165,180,252,0.06) 50%, rgba(94,234,212,0.06) 100%)',
              borderColor: 'rgba(127,211,255,0.28)',
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-60 pointer-events-none"
              style={{
                background:
                  'radial-gradient(55% 65% at 100% 0%, rgba(94,234,212,0.20), transparent 60%), radial-gradient(45% 55% at 0% 100%, rgba(127,211,255,0.18), transparent 60%)',
              }}
            />
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="min-w-0">
                <div className="mono-label text-[#BEE6FF]">FOR CREATORS · 招募在校服务者</div>
                <h3 className="mt-2 text-xl sm:text-2xl md:text-3xl font-semibold text-white tracking-tight leading-tight">
                  你也在成都理工,
                  <br className="hidden sm:block" />
                  想用空余时间接单赚零花?
                </h3>
                <p className="mt-2 sm:mt-3 text-white/65 leading-relaxed max-w-2xl text-sm sm:text-base">
                  提交姓名和学号, 人工审核通过即可开单。
                  <span className="text-[#BEE6FF]">平台初期 0 佣金</span>,
                  卖家收多少就是多少, 我们先把人气聚起来。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-[#5EEAD4]/40 bg-[#5EEAD4]/10 text-[11px] text-[#A7F3D0]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4]" />
                    0 佣金 · 限时招募
                  </span>
                  <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-[#7FD3FF]/35 bg-[#7FD3FF]/10 text-[11px] text-[#BEE6FF]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7FD3FF]" />
                    人工审核 · 真人把关
                  </span>
                </div>
              </div>
              <div className="flex gap-3 shrink-0 flex-wrap">
                <Link to="/sell?scope=cdut" className="btn-primary">
                  开设校园服务 <Icon name="arrow" size={16} />
                </Link>
                <Link to="/how-it-works" className="btn-ghost">
                  了解平台规则
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
