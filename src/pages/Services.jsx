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
        className="card card-hover p-8 h-full flex flex-col relative overflow-hidden scroll-mt-28"
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(to right, transparent, ${s.color}, transparent)`,
          }}
        />
        <div className="flex items-center justify-between">
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center"
            style={{
              background: `${s.color}14`,
              border: `1px solid ${s.color}40`,
              color: s.color,
            }}
          >
            <Icon name={s.icon} size={22} />
          </div>
          <span className="mono-label">CAT · 0{index + 1}</span>
        </div>

        <div className="mt-6 text-white text-xl font-medium tracking-tight">
          {s.title}
        </div>
        <p className="mt-2 text-sm text-white/60 leading-relaxed">{s.tagline}</p>

        <div className="mt-6">
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

        <div className="mt-6">
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

        <div className="mt-6 pt-6 border-t border-white/5">
          <div className="mono-label mb-2">EXAMPLE</div>
          <div className="text-xs text-white/55 leading-relaxed">{s.example}</div>
        </div>

        <div className="mt-auto pt-6">
          <Link
            to={`/services/${s.slug}`}
            className="inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
            style={{ color: s.color }}
          >
            进入该分类的商品陈列 <Icon name="arrow" size={14} />
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s, i) => (
            <ServiceCard key={s.slug} s={s} index={i} />
          ))}
        </div>
      </Section>

      <Section>
        <Reveal>
          <div className="card p-10 md:p-14 relative overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 opacity-50"
              style={{
                background:
                  'radial-gradient(50% 60% at 100% 0%, rgba(245,196,81,0.14), transparent 60%)',
              }}
            />
            <div className="relative grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="mono-label mb-3">NOT FOUND?</div>
                <h3 className="text-2xl md:text-3xl font-semibold text-white leading-tight">
                  没找到合适的分类?
                </h3>
                <p className="mt-4 text-white/60 leading-relaxed max-w-lg">
                  WhiteHive 的分类会随着真实需求持续演化。
                  把你的需求告诉我们, 我们会把它纳入新的分类体系中。
                </p>
              </div>
              <div className="flex lg:justify-end gap-3">
                <Link to="/how-it-works" className="btn-primary">
                  提交自定义需求 <Icon name="arrow" size={18} />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
