import { useMemo, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Section, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { categoryDetails } from '../data/listings.js'
import { useBackendListings } from '../lib/useBackendListings.js'
import SellerLevelBadge from '../components/SellerLevelBadge.jsx'

/* ---------------- 顶部区:分类头 + 指标 + 筛选 ---------------- */
function CategoryHero({ cat }) {
  return (
    <div className="relative overflow-hidden card p-8 md:p-12">
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(55% 65% at 90% 0%, ${cat.color}22, transparent 60%), radial-gradient(45% 55% at 0% 100%, ${cat.color}18, transparent 60%)`,
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Link to="/services" className="mono-label hover:text-white transition-colors">
            ← 全部分类
          </Link>
          <span className="mono-label text-white/25">/</span>
          <span className="mono-label" style={{ color: cat.color }}>
            {cat.slug.toUpperCase()}
          </span>
        </div>

        <div className="mt-4 flex items-start gap-5">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: `${cat.color}18`,
              border: `1px solid ${cat.color}55`,
              color: cat.color,
            }}
          >
            <Icon name="cube" size={26} />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight leading-tight">
              {cat.title}
            </h1>
            <p className="mt-2 text-white/65 max-w-2xl leading-relaxed">{cat.tagline}</p>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {cat.metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-lg sm:rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 sm:px-4 sm:py-3"
            >
              <div className="mono-label text-[10px] sm:text-[11px]">{m.label}</div>
              <div
                className="mt-0.5 sm:mt-1 text-base sm:text-xl font-semibold"
                style={{ color: cat.color }}
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

function FilterBar({ filters, active, setActive, color }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-2">
      {filters.map((f) => {
        const isActive = active === f
        return (
          <button
            key={f}
            type="button"
            onClick={() => setActive(f)}
            className="px-3.5 h-9 rounded-lg text-sm transition-colors"
            style={{
              background: isActive ? `${color}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isActive ? `${color}55` : 'rgba(255,255,255,0.10)'}`,
              color: isActive ? color : 'rgba(255,255,255,0.70)',
            }}
          >
            {f}
          </button>
        )
      })}
      <div className="flex-1" />
      <div className="text-xs text-white/40">
        <span className="mono-label">SORTED BY</span> 热度
      </div>
    </div>
  )
}

function AIMatchStrip({ color }) {
  return (
    <Link
      to="/ai-match"
      className="mt-6 block rounded-2xl p-4 md:p-5 relative overflow-hidden group transition-transform hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(100deg, ${color}14 0%, rgba(165,180,252,0.10) 60%, rgba(94,234,212,0.08) 100%)`,
        border: `1px solid ${color}40`,
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}1F`, color }}
        >
          <Icon name="spark" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium text-[15px]">
            在本分类下没找到想要的? 试试 AI 精准匹配。
          </div>
          <div className="mt-1 text-xs text-white/60 leading-relaxed">
            用自然语言描述你想做的事, 系统会跨分类匹配最合适的创作者和服务。
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-sm" style={{ color }}>
          去匹配 <Icon name="arrow" size={14} />
        </div>
      </div>
    </Link>
  )
}

/* ============ 公共小部件 ============ */
function SellerLine({ seller, rating, color }) {
  return (
    <div className="mt-2 sm:mt-4 flex items-center justify-between text-[10px] sm:text-xs">
      <div className="flex items-center gap-1.5 sm:gap-2 text-white/65 min-w-0">
        <div
          className="h-5 w-5 sm:h-6 sm:w-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-semibold shrink-0"
          style={{
            background: `${color}22`,
            border: `1px solid ${color}55`,
            color,
          }}
        >
          {seller.name.slice(0, 1)}
        </div>
        <span className="truncate">{seller.name}</span>
        <span className="text-white/25 hidden sm:inline">·</span>
        <span className="hidden sm:inline">
          <SellerLevelBadge level={seller.level} stats={{ ordersCompleted: seller.ordersCompleted, avgRating: seller.avgRating }} size="xs" />
        </span>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" style={{ color }}>
        ★ <span className="text-white/80">{rating}</span>
      </div>
    </div>
  )
}

function PriceLine({ item, color }) {
  return (
    <div className="mt-2.5 sm:mt-4 flex items-end justify-between">
      <div>
        <span className="text-[10px] sm:text-[11px] text-white/45 mr-0.5 sm:mr-1">¥</span>
        <span className="text-base sm:text-2xl font-semibold" style={{ color }}>
          {item.price}
        </span>
        <span className="text-[10px] sm:text-xs text-white/50 ml-0.5 sm:ml-1 hidden sm:inline">/ {item.priceUnit}</span>
      </div>
      <div className="text-[10px] sm:text-[11px] text-white/50 hidden sm:block">
        平均 <span className="text-white/80">{item.days} 天</span> 交付
      </div>
    </div>
  )
}

function Tags({ tags }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="text-[11px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/8 text-white/60"
        >
          #{t}
        </span>
      ))}
    </div>
  )
}

/* ============ Gallery · 大图视觉墙 ============ */
function GalleryView({ cat, listings }) {
  return (
    <div className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-5">
      {listings.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: i * 0.05 }}
          className="card card-hover overflow-hidden flex flex-col"
        >
          {/* 渐变视觉缩略 */}
          <div
            className="relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${item.grad[0]} 0%, ${item.grad[1]} 50%, ${item.grad[2]} 100%)`,
            }}
          >
            <div className="absolute inset-0 bg-grid-fine opacity-20" />
            <div className="absolute inset-0 flex items-center justify-center text-white/80">
              <Icon name={item.icon} size={36} />
            </div>
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-black/40 backdrop-blur text-[9px] sm:text-[10px] text-white/90 border border-white/15">
              {item.kind}
            </div>
          </div>
          <div className="p-3 sm:p-5 flex-1 flex flex-col">
            <div className="text-white font-medium leading-snug text-xs sm:text-base line-clamp-2">{item.title}</div>
            <p className="mt-1 sm:mt-2 text-[11px] sm:text-xs text-white/55 leading-relaxed line-clamp-2 hidden sm:block">
              {item.desc}
            </p>
            <div className="hidden sm:block"><Tags tags={item.tags} /></div>
            <div className="mt-auto">
              <PriceLine item={item} color={cat.color} />
              <SellerLine seller={item.seller} rating={item.rating} color={cat.color} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/* ============ Docs · 文档列表 (紧凑行) ============ */
function DocsView({ cat, listings }) {
  return (
    <div className="mt-8 space-y-3">
      {listings.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, delay: i * 0.04 }}
          className="card card-hover p-5 md:p-6 flex flex-col md:flex-row gap-5"
        >
          <div
            className="h-16 w-16 md:h-20 md:w-20 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `${cat.color}10`,
              border: `1px solid ${cat.color}35`,
              color: cat.color,
            }}
          >
            <Icon name={item.icon} size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-block whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background: `${cat.color}1A`,
                  border: `1px solid ${cat.color}40`,
                  color: cat.color,
                }}
              >
                {item.kind}
              </span>
              <div className="text-white font-medium">{item.title}</div>
            </div>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">{item.desc}</p>
            <Tags tags={item.tags} />
          </div>
          <div className="md:w-44 md:text-right md:border-l md:border-white/8 md:pl-5 flex md:flex-col md:items-end justify-between md:justify-center gap-2">
            <div>
              <span className="text-[11px] text-white/45 mr-1">¥</span>
              <span className="text-xl font-semibold" style={{ color: cat.color }}>
                {item.price}
              </span>
              <span className="text-xs text-white/50 ml-1">/ {item.priceUnit}</span>
            </div>
            <div className="text-[11px] text-white/50">
              {item.days} 天 · ★ {item.rating}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/* ============ Dashboard · 大特写 ============ */
function DashboardView({ cat, listings }) {
  return (
    <div className="mt-8 grid md:grid-cols-6 gap-5">
      {listings.map((item, i) => {
        const colSpan = (item.gridCols || 3) * 2 // out of 6
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
            className="card card-hover p-6 md:p-7 overflow-hidden"
            style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
          >
            {/* 模拟数据图 */}
            <div
              className="relative h-40 rounded-xl overflow-hidden mb-5"
              style={{
                background: `linear-gradient(180deg, ${cat.color}14, rgba(255,255,255,0.02))`,
                border: `1px solid ${cat.color}30`,
              }}
            >
              <div className="absolute inset-0 bg-grid-fine opacity-30" />
              {/* 假柱状图 */}
              <div className="absolute inset-x-4 bottom-4 top-6 flex items-end gap-2">
                {[0.4, 0.7, 0.55, 0.85, 0.6, 0.95, 0.7, 0.5, 0.8, 0.65, 0.88, 0.72].map(
                  (h, j) => (
                    <div
                      key={j}
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${h * 100}%`,
                        background: `linear-gradient(180deg, ${cat.color}, ${cat.color}55)`,
                        opacity: 0.75,
                      }}
                    />
                  )
                )}
              </div>
              <div
                className="absolute top-3 left-4 text-[10px] font-mono"
                style={{ color: cat.color }}
              >
                {item.kind.toUpperCase()} · LIVE
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-white font-medium text-lg leading-snug">
                  {item.title}
                </div>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{item.desc}</p>
              </div>
              <div
                className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `${cat.color}18`,
                  border: `1px solid ${cat.color}45`,
                  color: cat.color,
                }}
              >
                <Icon name={item.icon} size={18} />
              </div>
            </div>
            <Tags tags={item.tags} />
            <PriceLine item={item} color={cat.color} />
            <SellerLine seller={item.seller} rating={item.rating} color={cat.color} />
          </motion.div>
        )
      })}
    </div>
  )
}

/* ============ Workflow · 工作流 ============ */
function WorkflowView({ cat, listings }) {
  return (
    <div className="mt-8 grid md:grid-cols-2 gap-5">
      {listings.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: i * 0.06 }}
          className="card card-hover p-6 md:p-7"
        >
          <div className="flex items-center justify-between">
            <span
              className="inline-block whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: `${cat.color}1A`,
                border: `1px solid ${cat.color}40`,
                color: cat.color,
              }}
            >
              {item.kind}
            </span>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{
                background: `${cat.color}18`,
                border: `1px solid ${cat.color}45`,
                color: cat.color,
              }}
            >
              <Icon name={item.icon} size={16} />
            </div>
          </div>

          <div className="mt-4 text-white font-medium text-lg leading-snug">
            {item.title}
          </div>
          <p className="mt-2 text-sm text-white/60 leading-relaxed">{item.desc}</p>

          {/* Flow diagram */}
          <div className="mt-5 p-4 rounded-xl border border-white/8 bg-white/[0.02]">
            <div className="mono-label mb-3">WORKFLOW</div>
            <div className="flex items-center gap-2 flex-wrap">
              {item.flow.map((f, j) => (
                <div key={f} className="flex items-center gap-2">
                  <div
                    className="px-3 h-8 rounded-lg flex items-center text-xs"
                    style={{
                      background: `${cat.color}10`,
                      border: `1px solid ${cat.color}35`,
                      color: '#E6E9F2',
                    }}
                  >
                    {f}
                  </div>
                  {j < item.flow.length - 1 && (
                    <span className="text-white/30">
                      <Icon name="arrow" size={12} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Tags tags={item.tags} />
          <PriceLine item={item} color={cat.color} />
          <SellerLine seller={item.seller} rating={item.rating} color={cat.color} />
        </motion.div>
      ))}
    </div>
  )
}

/* ============ List · 服务列表 (游戏代肝) ============ */
function ListView({ cat, listings }) {
  return (
    <div className="mt-8 card p-2 md:p-3">
      {/* Desktop 表头 */}
      <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-3 text-[11px] mono-label text-white/45 border-b border-white/5">
        <div className="col-span-5">服务</div>
        <div className="col-span-2">类型</div>
        <div className="col-span-2">价格</div>
        <div className="col-span-2">服务者</div>
        <div className="col-span-1 text-right">评分</div>
      </div>
      {listings.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4, delay: i * 0.04 }}
          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
        >
          {/* Desktop: 原 12 列 grid */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-4 items-center">
            <div className="col-span-5 flex items-center gap-3 min-w-0">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: `${cat.color}18`,
                  border: `1px solid ${cat.color}45`,
                  color: cat.color,
                }}
              >
                <Icon name={item.icon} size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm text-white font-medium truncate">{item.title}</div>
                <div className="text-[11px] text-white/50 truncate">{item.desc}</div>
              </div>
            </div>
            <div className="col-span-2">
              <span
                className="inline-block whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background: `${cat.color}14`,
                  border: `1px solid ${cat.color}35`,
                  color: cat.color,
                }}
              >
                {item.kind}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-sm font-semibold" style={{ color: cat.color }}>
                ¥{item.price}
              </span>
              <span className="text-[11px] text-white/50 ml-1">/{item.priceUnit}</span>
            </div>
            <div className="col-span-2 text-xs text-white/65 truncate">
              {item.seller.name}
              <div className="mt-0.5">
                <SellerLevelBadge level={item.seller.level} stats={{ ordersCompleted: item.seller.ordersCompleted, avgRating: item.seller.avgRating }} size="xs" />
              </div>
            </div>
            <div className="col-span-1 text-right text-xs" style={{ color: cat.color }}>
              ★ {item.rating}
            </div>
          </div>

          {/* Mobile: 纵向堆叠,不再硬塞 12 列 */}
          <div className="md:hidden px-3 py-3.5">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: `${cat.color}18`,
                  border: `1px solid ${cat.color}45`,
                  color: cat.color,
                }}
              >
                <Icon name={item.icon} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm text-white font-medium truncate min-w-0">
                    {item.title}
                  </div>
                  <span className="text-xs shrink-0" style={{ color: cat.color }}>
                    ★ {item.rating}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-white/50 line-clamp-2 leading-snug">
                  {item.desc}
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-block whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: `${cat.color}14`,
                      border: `1px solid ${cat.color}35`,
                      color: cat.color,
                    }}
                  >
                    {item.kind}
                  </span>
                  <span className="text-[11px] text-white/60 truncate flex items-center gap-1.5">
                    {item.seller.name}
                    <SellerLevelBadge level={item.seller.level} stats={{ ordersCompleted: item.seller.ordersCompleted, avgRating: item.seller.avgRating }} size="xs" />
                  </span>
                </div>
                <div className="mt-1.5">
                  <span className="text-sm font-semibold" style={{ color: cat.color }}>
                    ¥{item.price}
                  </span>
                  <span className="text-[11px] text-white/50 ml-1">/{item.priceUnit}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

const layoutMap = {
  gallery: GalleryView,
  docs: DocsView,
  dashboard: DashboardView,
  workflow: WorkflowView,
  list: ListView,
}

/* ============ 空态 / 加载态 / 错误态 ============ */
function ListingsSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="card p-4 sm:p-6 h-48 animate-pulse"
          style={{ opacity: 0.5 - i * 0.05 }}
        >
          <div className="h-3 w-16 rounded bg-white/10" />
          <div className="mt-4 h-4 w-3/4 rounded bg-white/10" />
          <div className="mt-2 h-3 w-full rounded bg-white/8" />
          <div className="mt-2 h-3 w-2/3 rounded bg-white/8" />
        </div>
      ))}
    </div>
  )
}

function ListingsError({ error }) {
  return (
    <div className="mt-8 card p-8 sm:p-10 text-center">
      <div className="mono-label mb-2 text-[#FCA5A5]">LOAD FAILED</div>
      <div className="text-white text-lg font-medium">暂时无法加载上架服务</div>
      <p className="mt-2 text-sm text-white/60 max-w-md mx-auto">
        {error?.message || '网络不太稳, 稍后再试一下。'}
      </p>
    </div>
  )
}

function EmptyListings({ cat, totalInCategory, activeFilter }) {
  const filtering = activeFilter && activeFilter !== '全部' && totalInCategory > 0
  return (
    <div className="mt-8 card p-8 sm:p-12 text-center relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background: `radial-gradient(50% 60% at 50% 0%, ${cat.color}22, transparent 60%)`,
        }}
      />
      <div className="relative">
        <div
          className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{
            background: `${cat.color}18`,
            border: `1px solid ${cat.color}55`,
            color: cat.color,
          }}
        >
          <Icon name="spark" size={26} />
        </div>
        <div className="mt-4 text-white text-lg sm:text-xl font-semibold">
          {filtering ? '这个筛选下还没有作品' : '这个分类还没有上架的服务'}
        </div>
        <p className="mt-2 text-sm text-white/60 max-w-lg mx-auto leading-relaxed">
          {filtering
            ? '试着看看"全部", 或者用 AI 匹配直接发布需求——系统会在有新创作者入驻时通知你。'
            : '平台刚开始邀请创作者入驻。你可以用 AI 匹配发布需求, 我们会在 48 小时内帮你找到合适的人, 或等这个分类有新服务上架。'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          <Link
            to={`/ai-match?category=${encodeURIComponent(cat.slug)}`}
            className="btn-primary"
          >
            发布一个需求 <Icon name="arrow" size={16} />
          </Link>
          <Link to="/sell" className="btn-ghost">
            我来入驻这个分类
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ============ 页面 ============ */
export default function ServiceDetail() {
  const { slug } = useParams()
  const cat = categoryDetails[slug]
  const [active, setActive] = useState('全部')
  const { listings: backendListings, loading, error } = useBackendListings(slug)

  if (!cat) return <Navigate to="/services" replace />

  const allListings = backendListings
  const filtered = useMemo(() => {
    if (active === '全部') return allListings
    return allListings.filter(
      (l) => l.kind === active || (Array.isArray(l.tags) && l.tags.includes(active)),
    )
  }, [allListings, active])

  // 用真实数据刷新 metrics (替换掉 mock 的"在售作品 142")
  const liveMetrics = useMemo(() => {
    const base = cat.metrics ? [...cat.metrics] : []
    if (base.length > 0) {
      base[0] = { label: base[0].label, value: String(allListings.length) }
    }
    return base
  }, [cat.metrics, allListings.length])

  const LayoutView = layoutMap[cat.layout] || GalleryView

  return (
    <>
      <Section className="pt-28 md:pt-32">
        <Reveal>
          <CategoryHero cat={{ ...cat, metrics: liveMetrics }} />
        </Reveal>
        <AIMatchStrip color={cat.color} />
        <FilterBar
          filters={cat.filters}
          active={active}
          setActive={setActive}
          color={cat.color}
        />
        {loading ? (
          <ListingsSkeleton />
        ) : error ? (
          <ListingsError error={error} />
        ) : filtered.length === 0 ? (
          <EmptyListings cat={cat} totalInCategory={allListings.length} activeFilter={active} />
        ) : (
          <LayoutView cat={cat} listings={filtered} />
        )}
      </Section>

      <Section>
        <Reveal>
          <div className="card p-10 md:p-14 relative overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 opacity-50"
              style={{
                background: `radial-gradient(50% 60% at 100% 0%, ${cat.color}22, transparent 60%)`,
              }}
            />
            <div className="relative grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="mono-label mb-3">READY TO GO</div>
                <h3 className="text-2xl md:text-3xl font-semibold text-white leading-tight">
                  在这个分类里, 你可以:
                </h3>
                <ul className="mt-5 space-y-2 text-white/70 text-sm">
                  <li className="flex gap-2">
                    <span style={{ color: cat.color }}>·</span>
                    作为买家 · 直接挑选一个已经上架的服务。
                  </li>
                  <li className="flex gap-2">
                    <span style={{ color: cat.color }}>·</span>
                    作为买家 · 用结构化表单提交自定义需求。
                  </li>
                  <li className="flex gap-2">
                    <span style={{ color: cat.color }}>·</span>
                    作为创作者 · 按同一套字段开设自己的服务卡片。
                  </li>
                </ul>
              </div>
              <div className="flex lg:justify-end gap-3 flex-wrap">
                <Link to={`/ai-match?category=${encodeURIComponent(cat.slug)}`} className="btn-primary">
                  发布一个需求 <Icon name="arrow" size={18} />
                </Link>
                <Link to="/services" className="btn-ghost">
                  返回全部分类
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
