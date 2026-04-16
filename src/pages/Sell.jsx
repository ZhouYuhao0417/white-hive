import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Section, SectionHeader, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { services } from '../data/services.js'
import { categoryDetails } from '../data/listings.js'
import { createBackendService } from '../lib/api.js'
import { cacheService, readCachedServices } from '../lib/serviceCache.js'

/* ============ 从每个分类抽 1 张高分卡作为"同行是怎么上架的"示例 ============ */
function pickFeatured() {
  const out = []
  Object.values(categoryDetails).forEach((cat) => {
    const top = cat.listings[0]
    if (top) out.push({ cat, item: top })
  })
  return out.slice(0, 6)
}

/* ============ Hero ============ */
function SellHero() {
  return (
    <div className="relative card p-8 md:p-12 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(55% 65% at 100% 0%, rgba(165,180,252,0.22), transparent 60%), radial-gradient(45% 55% at 0% 100%, rgba(127,211,255,0.18), transparent 60%), radial-gradient(45% 55% at 50% 100%, rgba(94,234,212,0.14), transparent 60%)',
        }}
      />
      <div className="relative flex flex-col lg:flex-row gap-8 lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mono-label">FOR CREATORS · 开设服务</div>
          <h1 className="mt-3 text-3xl md:text-5xl font-semibold text-white leading-[1.1] tracking-tight">
            把你的技能, 上架成一张
            <br className="hidden md:block" />
            可以被搜索的<span className="text-cool-gradient">商品卡片</span>。
          </h1>
          <p className="mt-5 text-white/65 leading-relaxed max-w-xl">
            WhiteHive 不是一个接单广场。
            你用同一套结构化字段把服务说清楚, 它就会出现在对应的分类里, 被结构化的买家找到。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#listing-form" className="btn-primary">
              开始开设服务 <Icon name="arrow" size={18} />
            </a>
            <a href="#featured" className="btn-ghost">
              先看同行怎么做
            </a>
          </div>
        </div>
        <div className="flex gap-4 shrink-0">
          {[
            { label: '活跃创作者', value: '390+', color: '#7FD3FF' },
            { label: '在售服务', value: '1,281', color: '#A5B4FC' },
            { label: '近 30 天 GMV', value: '¥ 284K', color: '#5EEAD4' },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right"
              style={{ minWidth: 100 }}
            >
              <div className="mono-label">{m.label}</div>
              <div
                className="mt-1 text-lg font-semibold"
                style={{ color: m.color }}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============ Featured 同行商品 ============ */
function FeaturedListings() {
  const featured = pickFeatured()
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {featured.map(({ cat, item }, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: i * 0.06 }}
          className="card card-hover overflow-hidden flex flex-col"
        >
          <div
            className="relative aspect-[16/10]"
            style={{
              background: item.grad
                ? `linear-gradient(135deg, ${item.grad[0]}, ${item.grad[1]}, ${item.grad[2]})`
                : `linear-gradient(135deg, ${cat.color}33, ${cat.color}08)`,
            }}
          >
            <div className="absolute inset-0 bg-grid-fine opacity-20" />
            <div className="absolute inset-0 flex items-center justify-center text-white/80">
              <Icon name={item.icon} size={48} />
            </div>
            <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/40 backdrop-blur text-[10px] text-white/90 border border-white/15">
              {cat.title}
            </div>
          </div>
          <div className="p-5 flex-1 flex flex-col">
            <div className="text-white font-medium leading-snug">{item.title}</div>
            <p className="mt-2 text-xs text-white/55 leading-relaxed line-clamp-2">
              {item.desc}
            </p>
            <div className="mt-auto pt-4 flex items-end justify-between">
              <div>
                <span className="text-[11px] text-white/45 mr-1">¥</span>
                <span className="text-xl font-semibold" style={{ color: cat.color }}>
                  {item.price}
                </span>
                <span className="text-xs text-white/50 ml-1">/ {item.priceUnit}</span>
              </div>
              <div className="text-[11px]" style={{ color: cat.color }}>
                ★ {item.rating} · {item.seller.reviews} 评价
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/* ============ 三步上架流程 ============ */
function ListingProcess() {
  const steps = [
    {
      k: '01',
      icon: 'cube',
      color: '#7FD3FF',
      title: '选择一个分类',
      desc: '七个主要分类 + AI 帮你定义新分类。同一分类内, 所有商品用同一套字段被描述。',
    },
    {
      k: '02',
      icon: 'document',
      color: '#A5B4FC',
      title: '填写结构化模板',
      desc: '按平台字段填:交付物、适用对象、范围边界、参考案例、交付周期、定价与档位。',
    },
    {
      k: '03',
      icon: 'check',
      color: '#5EEAD4',
      title: '上架 · 接单 · 结算',
      desc: '通过合规审查后正式上架。订单资金进入托管, 按里程碑释放, 不再追讨。',
    },
  ]
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {steps.map((s, i) => (
        <Reveal key={s.k} delay={i * 0.08}>
          <div className="card card-hover p-7 h-full relative">
            <div className="flex items-center justify-between">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: `${s.color}14`,
                  border: `1px solid ${s.color}40`,
                  color: s.color,
                }}
              >
                <Icon name={s.icon} size={20} />
              </div>
              <span
                className="font-mono text-xs tracking-wider"
                style={{ color: s.color }}
              >
                STEP {s.k}
              </span>
            </div>
            <div className="mt-5 text-white font-medium text-lg tracking-tight">
              {s.title}
            </div>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">{s.desc}</p>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

/* ============ 分类选择 ============ */
function CategoryPicker() {
  return (
    <div id="choose-category" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {services.map((s, i) => (
        <Reveal key={s.slug} delay={i * 0.04}>
          <Link
            to={`/services/${s.slug}`}
            className="card card-hover block p-6 h-full relative overflow-hidden group"
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
              <span className="text-[11px] text-white/45">同行 →</span>
            </div>
            <div className="mt-5 font-medium text-white text-lg">{s.title}</div>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">{s.tagline}</p>
            <div
              className="mt-5 flex items-center gap-2 text-sm opacity-70 group-hover:opacity-100 transition-opacity"
              style={{ color: s.color }}
            >
              在此分类开店 <Icon name="arrow" size={14} />
            </div>
          </Link>
        </Reveal>
      ))}
    </div>
  )
}

function parsePriceCents(value) {
  const number = Number(String(value).replace(/[^\d.]/g, ''))
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.round(number * 100)
}

function splitTags(value) {
  return String(value)
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function ListingForm() {
  const [form, setForm] = useState({
    category: 'web',
    title: '',
    summary: '',
    price: '',
    deliveryDays: '7',
    tags: '',
  })
  const [created, setCreated] = useState(null)
  const [cached, setCached] = useState(() => readCachedServices())
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeCategory = useMemo(
    () => services.find((item) => item.slug === form.category) || services[0],
    [form.category],
  )

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const service = await createBackendService({
        sellerId: 'usr_demo_seller',
        category: form.category,
        title: form.title,
        summary: form.summary,
        priceCents: parsePriceCents(form.price),
        deliveryDays: Number(form.deliveryDays || 7),
        status: 'published',
        tags: splitTags(form.tags),
      })

      cacheService(service)
      setCreated(service)
      setCached(readCachedServices())
      setForm({
        category: form.category,
        title: '',
        summary: '',
        price: '',
        deliveryDays: '7',
        tags: '',
      })
    } catch (err) {
      setError(err.message || '服务发布失败，请稍后再试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div id="listing-form" className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
      <form onSubmit={submit} className="card p-7 md:p-9">
        <div className="mono-label">LISTING FORM · MVP 服务发布</div>
        <h3 className="mt-2 text-2xl md:text-3xl font-semibold text-white tracking-tight">
          填一张真正会进入后端的服务卡。
        </h3>
        <p className="mt-3 text-sm text-white/55 leading-relaxed max-w-2xl">
          这不是静态表单。提交后会调用 `/api/services`, 创建一条服务记录。现在先用于演示,
          等接入数据库后会变成真实持久化上架。
        </p>

        <div className="mt-7 grid md:grid-cols-2 gap-5">
          <label className="block md:col-span-2">
            <span className="mono-label">分类</span>
            <select
              value={form.category}
              onChange={(event) => update('category', event.target.value)}
              className="mt-2 w-full h-12 px-4 rounded-xl bg-ink-800 border border-white/10 text-sm text-white focus:outline-none focus:border-[#7FD3FF]/55"
            >
              {services.map((service) => (
                <option key={service.slug} value={service.slug}>
                  {service.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="mono-label">服务标题</span>
            <input
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              required
              minLength={6}
              placeholder="例: 创业项目官网与预约落地页"
              className="mt-2 w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mono-label">服务简介</span>
            <textarea
              value={form.summary}
              onChange={(event) => update('summary', event.target.value)}
              required
              minLength={12}
              rows={5}
              placeholder="说清楚你能交付什么、适合谁、边界在哪里。"
              className="mt-2 w-full p-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors resize-none leading-relaxed"
            />
          </label>

          <label className="block">
            <span className="mono-label">起步价 / 元</span>
            <input
              value={form.price}
              onChange={(event) => update('price', event.target.value)}
              required
              inputMode="decimal"
              placeholder="2800"
              className="mt-2 w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
            />
          </label>

          <label className="block">
            <span className="mono-label">交付周期 / 天</span>
            <input
              value={form.deliveryDays}
              onChange={(event) => update('deliveryDays', event.target.value)}
              required
              inputMode="numeric"
              placeholder="7"
              className="mt-2 w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mono-label">标签</span>
            <input
              value={form.tags}
              onChange={(event) => update('tags', event.target.value)}
              placeholder="官网, Vercel, 响应式"
              className="mt-2 w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
            />
          </label>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {created && (
          <div className="mt-5 rounded-xl border border-[#5EEAD4]/25 bg-[#5EEAD4]/10 px-4 py-3 text-sm text-[#CFFDF5]">
            服务已发布到 MVP 后端：{created.id}
          </div>
        )}

        <div className="mt-7 pt-6 border-t border-white/6 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs text-white/45">
            当前会直接标记为 published，方便比赛演示；正式版会先进入审核。
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary !py-2.5 !px-5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '正在发布...' : '发布服务'} <Icon name="arrow" size={16} />
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <div
          className="card p-6"
          style={{
            borderColor: `${activeCategory.color}33`,
            background: `linear-gradient(180deg, ${activeCategory.color}0F, rgba(255,255,255,0.015))`,
          }}
        >
          <div className="mono-label">LIVE PREVIEW</div>
          <div className="mt-4 flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center"
              style={{
                background: `${activeCategory.color}18`,
                border: `1px solid ${activeCategory.color}45`,
                color: activeCategory.color,
              }}
            >
              <Icon name={activeCategory.icon} />
            </div>
            <div>
              <div className="text-white font-medium">
                {form.title || '你的服务标题'}
              </div>
              <div className="text-xs text-white/45">{activeCategory.title}</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/60 leading-relaxed">
            {form.summary || '服务简介会在这里预览。建议写清楚交付物、适合对象和不包含的范围。'}
          </p>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <span className="text-[11px] text-white/45 mr-1">¥</span>
              <span className="text-2xl font-semibold" style={{ color: activeCategory.color }}>
                {form.price || '—'}
              </span>
              <span className="text-xs text-white/50 ml-1">/ 起</span>
            </div>
            <div className="text-xs text-white/50">
              {form.deliveryDays || '—'} 天交付
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="mono-label">RECENT CREATED</div>
          <div className="mt-4 space-y-3">
            {cached.length === 0 ? (
              <div className="text-sm text-white/45 leading-relaxed">
                还没有本地发布记录。提交第一张服务卡后会显示在这里。
              </div>
            ) : (
              cached.slice(0, 4).map((service) => (
                <div key={service.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="text-sm text-white font-medium">{service.title}</div>
                  <div className="mt-1 text-[11px] text-white/45">
                    {service.category} · {service.id}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============ AI 兜底 ============ */
function AIMatchFallback() {
  return (
    <Link
      to="/ai-match"
      className="card card-hover block p-8 md:p-10 relative overflow-hidden group"
      style={{
        background:
          'linear-gradient(135deg, rgba(127,211,255,0.10) 0%, rgba(165,180,252,0.08) 50%, rgba(94,234,212,0.08) 100%)',
        borderColor: 'rgba(127,211,255,0.32)',
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(45% 60% at 100% 0%, rgba(127,211,255,0.22), transparent 60%), radial-gradient(40% 55% at 0% 100%, rgba(165,180,252,0.18), transparent 60%)',
        }}
      />
      <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(127,211,255,0.16)',
            border: '1px solid rgba(127,211,255,0.50)',
            color: '#7FD3FF',
          }}
        >
          <Icon name="spark" size={26} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="mono-label mb-1">NO FIT?</div>
          <div className="text-white font-medium text-xl leading-tight">
            你要做的服务, 七个分类都不太贴? 用 AI 帮你定义一个新的。
          </div>
          <p className="mt-2 text-sm text-white/65 leading-relaxed max-w-2xl">
            把你的服务内容、交付形式、目标用户直接告诉 AI,
            它会帮你起草一套结构化字段, 并建议应归属或新开哪个分类。
          </p>
        </div>
        <span className="btn-primary shrink-0 md:ml-auto">
          试试 AI 定义分类 <Icon name="arrow" size={18} />
        </span>
      </div>
    </Link>
  )
}

export default function Sell() {
  return (
    <>
      <Section className="pt-28 md:pt-32">
        <Reveal>
          <SellHero />
        </Reveal>
      </Section>

      <Section id="featured" className="!pt-4">
        <SectionHeader
          eyebrow="WHAT CREATORS SELL · 同行的商品"
          title="先看看同类创作者是怎么上架的。"
          desc="每一件商品都用同一套字段被描述。看清楚结构, 就知道自己能怎么写。"
        />
        <div className="mt-10">
          <FeaturedListings />
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="HOW TO LIST · 三步上架"
          title="把技能, 变成一张结构化的服务卡片。"
          desc="不用谈判话术、不用反复沟通定价, 只需要按模板填满三件事。"
        />
        <div className="mt-10">
          <ListingProcess />
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="CREATE LISTING · 真实发布"
          title="现在，把你的服务写进后端。"
          desc="先用 MVP 接口保存服务卡，后续接数据库后它会进入真实的服务市场。"
        />
        <div className="mt-10">
          <ListingForm />
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="CHOOSE A CATEGORY · 分类参考"
          title="还不确定怎么写? 先看分类结构。"
          desc="每个分类有独立的筛选器、独立的展示模板和独立的买家画像。"
        />
        <div className="mt-10">
          <CategoryPicker />
        </div>
      </Section>

      <Section>
        <Reveal>
          <AIMatchFallback />
        </Reveal>
      </Section>
    </>
  )
}
