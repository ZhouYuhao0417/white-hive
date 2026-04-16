import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Section, SectionHeader, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { services } from '../data/services.js'

function ServiceCard({ s, index }) {
  return (
    <Reveal delay={index * 0.05}>
      <div
        id={s.slug}
        className="card card-hover p-4 sm:p-8 h-full flex flex-col relative overflow-hidden scroll-mt-28"
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(to right, transparent, ${s.color}, transparent)`,
          }}
        />
        <div className="flex items-center justify-between">
          <div
            className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl flex items-center justify-center"
            style={{
              background: `${s.color}14`,
              border: `1px solid ${s.color}40`,
              color: s.color,
            }}
          >
            <Icon name={s.icon} size={20} />
          </div>
          <span className="mono-label hidden sm:inline">CAT · 0{index + 1}</span>
        </div>

        <div className="mt-3 sm:mt-6 text-white text-sm sm:text-xl font-medium tracking-tight leading-snug">
          {s.title}
        </div>
        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-white/60 leading-relaxed line-clamp-2 sm:line-clamp-none">{s.tagline}</p>

        <div className="mt-4 sm:mt-6 hidden sm:block">
          <div className="mono-label mb-3">ADAPT TO</div>
          <div className="flex flex-wrap gap-1.5">
            {s.audience.map((a) => (
              <span
                key={a}
                className="text-[11px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/8 text-white/70"
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 hidden sm:block">
          <div className="mono-label mb-3">DELIVERABLES</div>
          <ul className="space-y-2">
            {s.deliverables.map((d) => (
              <li
                key={d}
                className="flex items-start gap-2 text-sm text-white/70"
              >
                <span
                  className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                  style={{ background: s.color }}
                />
                {d}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t border-white/5 hidden sm:block">
          <div className="mono-label mb-2">EXAMPLE</div>
          <div className="text-xs text-white/55 leading-relaxed">{s.example}</div>
        </div>

        <div className="mt-auto pt-3 sm:pt-6">
          <Link
            to={`/services/${s.slug}`}
            className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm transition-opacity hover:opacity-80"
            style={{ color: s.color }}
          >
            <span className="hidden sm:inline">进入该分类的商品陈列</span>
            <span className="sm:hidden">查看商品</span> <Icon name="arrow" size={14} />
          </Link>
        </div>
      </div>
    </Reveal>
  )
}

export default function Services() {
  const { hash } = useLocation()

  // 支持 /services#<slug> 自动滚动并短暂高亮
  useEffect(() => {
    if (!hash) return
    const id = hash.replace('#', '')
    const el = document.getElementById(id)
    if (!el) return
    // 等 Reveal 出现再滚
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add('ring-2', 'ring-[#7FD3FF]/60', 'ring-offset-0')
      setTimeout(
        () => el.classList.remove('ring-2', 'ring-[#7FD3FF]/60', 'ring-offset-0'),
        2400
      )
    }, 250)
    return () => clearTimeout(t)
  }, [hash])

  return (
    <>
      <Section className="pt-32 md:pt-36">
        <SectionHeader
          eyebrow="SERVICES"
          title="结构化的服务分类。"
          desc="每一个分类都用相同的字段描述: 适用对象、交付物、示例场景。降低信息不对称, 是 WhiteHive 的第一步。"
        />
      </Section>

      <Section className="!pt-0">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {services.map((s, i) => (
            <ServiceCard key={s.slug} s={s} index={i} />
          ))}
        </div>
      </Section>

      <Section>
        <Reveal>
          <Link
            to="/ai-match"
            className="card card-hover block p-10 md:p-14 relative overflow-hidden group"
            style={{
              background:
                'linear-gradient(135deg, rgba(127,211,255,0.10) 0%, rgba(165,180,252,0.08) 50%, rgba(94,234,212,0.08) 100%)',
              borderColor: 'rgba(127,211,255,0.32)',
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{
                background:
                  'radial-gradient(55% 65% at 100% 0%, rgba(127,211,255,0.25), transparent 60%), radial-gradient(45% 55% at 0% 100%, rgba(165,180,252,0.20), transparent 60%), radial-gradient(45% 55% at 50% 100%, rgba(94,234,212,0.16), transparent 60%)',
              }}
            />
            <div className="relative grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="h-12 w-12 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'rgba(127,211,255,0.16)',
                      border: '1px solid rgba(127,211,255,0.50)',
                      color: '#7FD3FF',
                    }}
                  >
                    <Icon name="spark" size={22} />
                  </div>
                  <div>
                    <div className="mono-label">NOT FOUND? · AI MATCH</div>
                    <div className="text-white font-medium">长尾需求兜底</div>
                  </div>
                </div>
                <h3 className="text-2xl md:text-3xl font-semibold text-white leading-tight tracking-tight">
                  没找到想要的? 用 AI 精准匹配需求。
                </h3>
                <p className="mt-4 text-white/65 leading-relaxed max-w-xl">
                  先填几个结构化字段, 让 AI 追问你没说清的细节,
                  最后补一段自由备注。系统会跨全部分类帮你匹配最合适的创作者。
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="chip">结构化表单</span>
                  <span className="chip">AI 智能追问</span>
                  <span className="chip">跨分类匹配</span>
                </div>
              </div>
              <div className="flex lg:justify-end">
                <span className="btn-primary shrink-0">
                  进入 AI 匹配 <Icon name="arrow" size={18} />
                </span>
              </div>
            </div>
          </Link>
        </Reveal>
      </Section>
    </>
  )
}
