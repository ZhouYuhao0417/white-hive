import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Section, SectionHeader, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { trustPillars } from '../data/services.js'

/* ---------- 每根支柱的"展开后"更详细的内容 ---------- */
const pillarDetails = {
  dispute: {
    how: '结构化需求在开工前就固化了交付物与边界, 任何变更都需要双方再次确认。阶段节点留痕让"谁先改的、谁没回复"都有据可查。一旦产生争议, 平台仲裁组会在 72 小时内接入。',
    protects: ['需求描述被结构化', '阶段节点全程留痕', '仲裁时效 < 72h', '历史纠纷案例库'],
    example:
      '案例: 2025 年初的"落地页二次改稿"纠纷, 因交付物字段与改稿轮次在开工前已经明确, 最终在 8 小时内以不扣费闭合。',
  },
  escrow: {
    how: '买家付款后资金进入持牌支付机构的监管账户, 不在平台自有账上流动。达到里程碑后按比例释放, 出现纠纷时资金会被冻结并等待仲裁结论。',
    protects: ['持牌机构监管账户', '里程碑按比例释放', '纠纷资金冻结', '失败退款可追溯'],
    example:
      '逻辑: 订单 ¥2000 → 下单托管 ¥2000 → 草案交付释放 30% → 终稿验收释放 60% → 评价完成释放 10%。',
  },
  copyright: {
    how: '每一次交付都自动生成带时间戳的原创声明, 并记录作者、订单、哈希。交付物归属与再授权边界被写入合同模板, 默认保护作者主权。',
    protects: ['交付即原创声明', '作者主权清晰', '授权边界写入合同', '侵权可回溯至订单'],
    example: '范例: 设计师 A 完成 Logo 交付后, 客户 B 想二次授权给第三方, 系统自动触发二次授权审批。',
  },
  api: {
    how: 'AI 类交付中最常见的 Key 泄漏, 由平台侧代理兜底: 真实 Key 存放在平台的密钥保险箱, 买家拿到的是平台下发的调用配额与代理 URL。',
    protects: ['真实 Key 永不外泄', '调用配额按次计费', '可随时吊销', '调用日志可审计'],
    example:
      '场景: 某买家购买"GPT 排版工作流"后, 平台下发的是代理 URL + 30 万 token 配额, 不是 OpenAI 原生 Key。',
  },
  chain: {
    how: '交付物、需求快照、关键验收节点的哈希会写入公链, 形成不可篡改的时间戳证据。平台本身不保留仲裁所需证据的最终决定权, 第三方可独立校验。',
    protects: ['哈希上链不可篡改', '第三方独立校验', '中立时间戳', '证据链可导出'],
    example:
      '目前节点选择: 已接入 2 条公链 (以太坊 L2 + 国密合规链), 每笔订单仅写入哈希, 不包含业务数据本身。',
  },
  legal: {
    how: '禁售清单对所有用户公开。任何进入平台的服务在上架前都会经过内容安全与合规审查。涉及灰色地带的订单会被 pending 等待人工复核。',
    protects: ['禁售清单公开', '上架前合规审查', '灰色地带自动 hold', '违规账号封禁公示'],
    example:
      '禁售范围: 代写学位论文、代考、版权素材分发、绕开平台的私下收款等, 一经发现即冻结资金并公示。',
  },
}

function PillarCard({ p, index, open, setOpen }) {
  const isOpen = open === p.key
  const detail = pillarDetails[p.key]
  return (
    <Reveal delay={index * 0.05}>
      <div
        className={`card card-hover p-8 h-full relative overflow-hidden cursor-pointer transition-all ${
          isOpen ? 'ring-1' : ''
        }`}
        style={
          isOpen
            ? {
                borderColor: `${p.color}70`,
                boxShadow: `0 20px 60px -30px ${p.color}40`,
              }
            : undefined
        }
        onClick={() => setOpen(isOpen ? null : p.key)}
      >
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
          <div className="flex items-center gap-2">
            <span className="mono-label">TRUST · 0{index + 1}</span>
            <motion.span
              animate={{ rotate: isOpen ? 45 : 0 }}
              transition={{ duration: 0.25 }}
              className="h-6 w-6 rounded-md grid place-items-center"
              style={{
                background: `${p.color}14`,
                border: `1px solid ${p.color}40`,
                color: p.color,
              }}
            >
              +
            </motion.span>
          </div>
        </div>

        <div className="mt-6 text-white text-xl font-medium tracking-tight">{p.title}</div>
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

        {/* 展开层 */}
        <AnimatePresence initial={false}>
          {isOpen && detail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              className="mt-6 pt-6 border-t overflow-hidden"
              style={{ borderColor: `${p.color}33` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mono-label mb-2" style={{ color: p.color }}>
                如何工作
              </div>
              <p className="text-xs text-white/65 leading-relaxed">{detail.how}</p>

              <div className="mono-label mt-5 mb-2" style={{ color: p.color }}>
                被保护的
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.protects.map((x) => (
                  <span
                    key={x}
                    className="text-[11px] px-2 py-1 rounded-md"
                    style={{
                      background: `${p.color}10`,
                      border: `1px solid ${p.color}35`,
                      color: '#E6E9F2',
                    }}
                  >
                    {x}
                  </span>
                ))}
              </div>

              <div className="mono-label mt-5 mb-2" style={{ color: p.color }}>
                示例
              </div>
              <p className="text-xs text-white/55 leading-relaxed">{detail.example}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {!isOpen && (
          <div
            className="mt-4 text-[11px] transition-opacity"
            style={{ color: `${p.color}cc` }}
          >
            点击查看详细机制 →
          </div>
        )}
      </div>
    </Reveal>
  )
}

export default function Trust() {
  const [open, setOpen] = useState(null)
  return (
    <>
      <Section className="pt-32 md:pt-36">
        <SectionHeader
          eyebrow="TRUST SYSTEM · 可信机制"
          title="信任, 不靠口号, 靠结构。"
          desc="WhiteHive 把「可信」拆成六根支柱, 前置到产品设计和交易流程里。每一根都可以点开看详细机制。"
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
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        </Reveal>
      </Section>

      <Section className="!pt-0">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {trustPillars.map((p, i) => (
            <PillarCard key={p.key} p={p} index={i} open={open} setOpen={setOpen} />
          ))}
        </div>
      </Section>

      {/* Escrow flow diagram */}
      <Section>
        <SectionHeader
          eyebrow="ESCROW LOGIC · 资金托管"
          title="资金托管, 按里程碑释放。"
          desc="款项不是直接打给卖家, 而是先进入持牌机构的监管账户, 按约定的节点逐步释放; 出现纠纷时可以冻结并复核。"
        />
        <Reveal>
          <div className="mt-14 card p-8 md:p-12">
            <div className="grid md:grid-cols-5 gap-4 items-stretch">
              {[
                { t: '买家下单', d: '款项进入持牌监管账户', tone: 'buyer' },
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
                        ? 'bg-[#7FD3FF]/[0.06] border-[#7FD3FF]/25'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="mono-label text-white/55">STEP 0{i + 1}</div>
                    <div className="mt-2 text-white font-medium">{s.t}</div>
                    <div className="mt-1 text-xs text-white/55 leading-relaxed">{s.d}</div>
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
              * 本图展示资金托管的产品结构。具体对接的持牌支付机构与清算细节另有合规文档。
            </div>
          </div>
        </Reveal>
      </Section>

      {/* Compliance boundary */}
      <Section>
        <SectionHeader
          eyebrow="COMPLIANCE · 合规边界"
          title="合规边界, 写在明面上。"
          desc="WhiteHive 主动划出可交易服务的范围, 把灰色地带挡在门外。清晰的红线, 本身就是一种保护。"
        />
        <div className="mt-12 grid md:grid-cols-2 gap-4">
          <Reveal>
            <div className="card p-8 h-full">
              <div className="mono-label mb-4 text-[#BEE6FF]">允许 · ALLOW</div>
              <ul className="space-y-3 text-sm text-white/75">
                {[
                  '面向公开可交付的数字服务',
                  '原创作品与有授权素材',
                  '可验收、可界定范围的服务内容',
                  '符合平台规范的 AI 辅助交付',
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-[#7FD3FF] mt-[2px]">
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
                  '代考、代写学位论文等学术不端行为',
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
              信任不是附赠的服务, 而是产品本身。
            </h3>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto leading-relaxed">
              WhiteHive 的可信机制会随着真实的交易与真实的案例持续迭代。
              任何一个被发现的问题, 都会在下一版的规则里被修补。
            </p>
            <div className="mt-8 flex justify-center gap-3 flex-wrap">
              <Link to="/how-it-works" className="btn-primary">
                查看完整流程 <Icon name="arrow" size={18} />
              </Link>
              <Link to="/services" className="btn-ghost">
                浏览服务
              </Link>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
