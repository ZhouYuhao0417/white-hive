import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Section, SectionHeader, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { trustPillars } from '../data/services.js'

function PillarCard({ p, index }) {
  return (
    <Reveal delay={index * 0.05}>
      <div className="card card-hover p-8 h-full relative overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${p.color}, transparent)` }}
        />
        <div className="flex items-center justify-between">
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center"
            style={{
              background: `${p.color}14`,
              border: `1px solid ${p.color}40`,
              color: p.color,
            }}
          >
            <Icon name={p.icon} size={22} />
          </div>
          <span className="mono-label">TRUST · 0{index + 1}</span>
        </div>
        <div className="mt-6 text-white text-xl font-medium tracking-tight">
          {p.title}
        </div>
        <p className="mt-3 text-sm text-white/60 leading-relaxed">{p.desc}</p>
        <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
          {p.points.map((pt) => (
            <div key={pt} className="flex items-start gap-2 text-sm text-white/75">
              <span className="mt-[2px]" style={{ color: p.color }}>
                <Icon name="check" size={14} />
              </span>
              {pt}
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  )
}

export default function Trust() {
  return (
    <>
      <Section className="pt-32 md:pt-36">
        <SectionHeader
          eyebrow="TRUST SYSTEM · 可信机制"
          title="信任，不靠口号，靠结构。"
          desc="我们不把 '可信' 当成一句话挂在首页上，而是把它拆成六根支柱，前置到产品设计和交易流程里。"
        />

        <Reveal delay={0.08}>
          <div className="mt-10 flex flex-wrap gap-2">
            {[
              '前置治理',
              '结构化留痕',
              '资金托管',
              '版权绑定',
              '合规红线',
              '可验证证据',
            ].map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </Reveal>
      </Section>

      <Section className="!pt-0">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trustPillars.map((p, i) => (
            <PillarCard key={p.key} p={p} index={i} />
          ))}
        </div>
      </Section>

      {/* Escrow flow diagram */}
      <Section>
        <SectionHeader
          eyebrow="ESCROW LOGIC · 资金托管"
          title="资金托管，按里程碑释放。"
          desc="款项不是直接打给卖家，而是先进平台托管账户，按约定的节点逐步释放；出现纠纷时可以冻结并复核。"
        />
        <Reveal>
          <div className="mt-14 card p-8 md:p-12">
            <div className="grid md:grid-cols-5 gap-4 items-stretch">
              {[
                { t: '买家下单', d: '款项进入平台托管', tone: 'buyer' },
                { t: '开始制作', d: '冻结资金 · 开工留痕', tone: 'platform' },
                { t: '提交交付', d: '交付哈希存证', tone: 'platform' },
                { t: '买家验收', d: '按里程碑释放', tone: 'platform' },
                { t: '卖家到账', d: '结算 · 评价 · 归档', tone: 'seller' },
              ].map((s, i) => (
                <motion.div
                  key={s.t}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="relative"
                >
                  <div
                    className={`rounded-2xl p-5 h-full border ${
                      s.tone === 'platform'
                        ? 'bg-brand-300/[0.06] border-brand-300/25'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="mono-label text-white/55">
                      STEP 0{i + 1}
                    </div>
                    <div className="mt-2 text-white font-medium">{s.t}</div>
                    <div className="mt-1 text-xs text-white/55 leading-relaxed">
                      {s.d}
                    </div>
                  </div>
                  {i < 4 && (
                    <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 text-white/25">
                      <Icon name="arrow" size={18} />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
            <div className="mt-6 text-xs text-white/40">
              * 本示意图仅展示资金托管逻辑的产品结构，不涉及具体金融与合规实现细节。
            </div>
          </div>
        </Reveal>
      </Section>

      {/* Compliance boundary */}
      <Section>
        <SectionHeader
          eyebrow="COMPLIANCE · 合规边界"
          title="合规边界，写在明面上。"
          desc="WhiteHive 主动划出可交易服务的范围，把灰色地带挡在门外。清晰的红线，本身就是一种保护。"
        />
        <div className="mt-12 grid md:grid-cols-2 gap-4">
          <Reveal>
            <div className="card p-8 h-full">
              <div className="mono-label mb-4 text-brand-200">允许 · ALLOW</div>
              <ul className="space-y-3 text-sm text-white/75">
                {[
                  '面向公开可交付的数字服务',
                  '原创作品与授权素材',
                  '可验收、可界定范围的服务内容',
                  '符合平台规范的 AI 辅助交付',
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-brand-300 mt-[2px]">
                      <Icon name="check" size={14} />
                    </span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="card p-8 h-full">
              <div className="mono-label mb-4 text-white/55">禁止 · DENY</div>
              <ul className="space-y-3 text-sm text-white/70">
                {[
                  '涉及代考、代写学位论文等学术不端',
                  '侵犯第三方版权的内容分发',
                  '违反所在地法律法规的服务',
                  '任何绕过平台托管的私下交易',
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-white/35 mt-[2px]">✕</span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section>
        <Reveal>
          <div className="card p-10 md:p-14 text-center">
            <h3 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
              信任不是附赠的服务，而是产品本身。
            </h3>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto leading-relaxed">
              WhiteHive 的可信机制会随着真实的纠纷和真实的案例持续迭代。
              你遇到的每一个问题，都会成为下一版更可信的依据。
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/how-it-works" className="btn-primary">
                查看完整流程 <Icon name="arrow" size={18} />
              </Link>
              <Link to="/services" className="btn-ghost">浏览服务</Link>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
