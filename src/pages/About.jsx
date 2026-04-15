import { Link } from 'react-router-dom'
import { Section, SectionHeader, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'

const beliefs = [
  {
    icon: 'cube',
    title: '结构胜过话术',
    desc: '一个好的交易平台，应该让信息以相同的结构流动，而不是依赖双方的表达能力。',
  },
  {
    icon: 'shield',
    title: '治理前置',
    desc: '最好的纠纷处理，是让纠纷根本不发生。所以我们把治理逻辑放在交易开始之前。',
  },
  {
    icon: 'spark',
    title: '创作者友好',
    desc: 'WhiteHive 希望成为青年创作者被看到、被信任、被合理回报的第一站。',
  },
  {
    icon: 'chain',
    title: '证据胜于承诺',
    desc: '比起口头保证，我们更相信结构化留痕和第三方可验证的凭据。',
  },
]

export default function About() {
  return (
    <>
      <Section className="pt-32 md:pt-36">
        <SectionHeader
          eyebrow="ABOUT · 关于我们"
          title="线上交易，值得被重新设计一次。"
          desc="WhiteHive 来自一个很朴素的观察 —— 大多数线上数字服务的交易，长期停留在聊天窗口和转账截图之间。我们把它重新做成了一个有结构、有治理、有证据的产品。"
        />
      </Section>

      <Section className="!pt-0">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {beliefs.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.06}>
              <div className="card card-hover p-6 h-full">
                <div className="h-10 w-10 rounded-xl bg-brand-300/10 border border-brand-300/25 flex items-center justify-center text-brand-300">
                  <Icon name={b.icon} />
                </div>
                <div className="mt-5 text-white font-medium">{b.title}</div>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">
                  {b.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid lg:grid-cols-2 gap-4">
          <Reveal>
            <div className="card p-10 h-full">
              <div className="mono-label mb-4">MISSION</div>
              <h3 className="text-2xl md:text-3xl font-semibold text-white leading-tight tracking-tight">
                让每一次数字服务的交易，
                <br />
                都有据可查、有章可依。
              </h3>
              <p className="mt-6 text-white/60 leading-relaxed">
                WhiteHive 不追求做最大的接单平台，而是专注做最可信的那个。
                每一次版本迭代，都只围绕一个问题 —— 这次合作怎么才能更可靠。
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="card p-10 h-full">
              <div className="mono-label mb-4">WHO WE BUILD FOR</div>
              <ul className="space-y-4 text-white/80">
                {[
                  ['青年创作者', '想把作品和技能变成可持续收入'],
                  ['自由职业者', '需要更结构化的需求和更可靠的结算'],
                  ['学生卖家', '想在学习之外获得真实世界的反馈'],
                  ['个人 / 小微团队买家', '希望用更低的心智成本完成一次合作'],
                  ['初创企业', '需要快速、可信、可追溯的数字交付能力'],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-start gap-3">
                    <div className="mt-[6px] h-1.5 w-1.5 rounded-full bg-brand-300 shrink-0" />
                    <div>
                      <div className="text-white font-medium">{k}</div>
                      <div className="text-sm text-white/55">{v}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section>
        <Reveal>
          <div className="card p-10 md:p-14 relative overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(50% 60% at 100% 0%, rgba(167,139,250,0.18), transparent 60%)',
              }}
            />
            <div className="relative grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="mono-label mb-3">CONTACT</div>
                <h3 className="text-2xl md:text-3xl font-semibold text-white leading-tight">
                  想和我们聊聊？
                </h3>
                <p className="mt-4 text-white/60 max-w-lg leading-relaxed">
                  无论你是潜在的创作者、买家、合作伙伴，还是对平台机制本身感兴趣，
                  都欢迎直接联系我们。
                </p>
              </div>
              <div className="flex flex-col sm:flex-row lg:justify-end gap-3">
                <a
                  href="mailto:hello@whitehive.cn"
                  className="btn-primary"
                >
                  hello@whitehive.cn <Icon name="arrow" size={18} />
                </a>
                <Link to="/how-it-works" className="btn-ghost">
                  查看交易流程
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
