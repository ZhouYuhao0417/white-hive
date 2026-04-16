import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Section, SectionHeader, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { steps } from '../data/services.js'

const perspectives = {
  buyer: {
    label: '买家视角',
    items: [
      '在结构化分类中找到服务',
      '用表单而不是聊天描述需求',
      '在开工前对齐边界',
      '托管付款、等待交付',
      '按里程碑验收、提出修改',
      '完成评价，归档留痕',
    ],
  },
  seller: {
    label: '卖家视角',
    items: [
      '发布标准化服务卡片',
      '接收结构化需求',
      '确认边界，保护自身',
      '进入制作，阶段留痕',
      '按约定格式提交交付物',
      '收到结算，积累信誉',
    ],
  },
  platform: {
    label: 'WhiteHive 视角',
    items: [
      '提供分类与结构化字段',
      '托管款项与阶段释放',
      '记录交付节点、生成证据',
      '介入纠纷、提供仲裁',
      '绑定原创声明与版权',
      '治理合规边界与红线',
    ],
  },
}

function Timeline() {
  return (
    <div className="relative">
      {/* vertical line */}
      <div className="absolute left-[20px] sm:left-[26px] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
      <ol className="space-y-4 sm:space-y-6">
        {steps.map((s, i) => (
          <motion.li
            key={s.k}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="relative pl-12 sm:pl-16"
          >
            <div className="absolute left-0 top-0 h-10 w-10 sm:h-[52px] sm:w-[52px] rounded-xl sm:rounded-2xl border border-brand-300/30 bg-brand-300/[0.08] flex items-center justify-center">
              <span className="font-mono text-brand-200 text-xs sm:text-sm">{s.k}</span>
            </div>
            <div className="card p-3.5 sm:p-5">
              <div className="text-white font-medium text-sm sm:text-base">{s.title}</div>
              <div className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-white/60 leading-relaxed">
                {s.desc}
              </div>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}

function PerspectiveSwitcher() {
  const [tab, setTab] = useState('buyer')
  const current = perspectives[tab]

  return (
    <div className="card p-4 sm:p-8">
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/8 w-fit">
        {Object.entries(perspectives).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors ${
              tab === k
                ? 'bg-brand-300/15 text-brand-200 border border-brand-300/30'
                : 'text-white/60 hover:text-white border border-transparent'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.ul
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="mt-6 sm:mt-8 grid grid-cols-2 gap-2 sm:gap-3"
        >
          {current.items.map((t, i) => (
            <li
              key={t}
              className="flex items-start gap-2 sm:gap-3 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/8 px-3 py-2 sm:px-4 sm:py-3"
            >
              <span className="mono-label mt-[2px] sm:mt-[3px] text-white/45 text-[10px] sm:text-[11px]">
                0{i + 1}
              </span>
              <span className="text-xs sm:text-sm text-white/80">{t}</span>
            </li>
          ))}
        </motion.ul>
      </AnimatePresence>
    </div>
  )
}

export default function HowItWorks() {
  return (
    <>
      <Section className="pt-32 md:pt-36">
        <SectionHeader
          eyebrow="HOW IT WORKS · 交易流程"
          title="一次交易，七个明确的节点。"
          desc="WhiteHive 的流程不是聊出来的，而是一步步走出来的。每一步都有明确的进入条件和完成标准。"
        />
      </Section>

      <Section className="!pt-0">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <Reveal>
              <div className="mono-label mb-6">TIMELINE · 完整流程</div>
              <Timeline />
            </Reveal>
          </div>

          <div className="lg:col-span-2">
            <Reveal delay={0.1}>
              <div className="mono-label mb-6">PERSPECTIVES · 三方视角</div>
              <PerspectiveSwitcher />
            </Reveal>

            <Reveal delay={0.2}>
              <div className="card p-6 mt-4">
                <div className="mono-label mb-3">STATE MACHINE</div>
                <div className="text-sm text-white/70 leading-relaxed">
                  每一个订单在系统中都是一个状态机：
                  <span className="text-brand-200"> Draft</span> →
                  <span className="text-brand-200"> Scoped</span> →
                  <span className="text-brand-200"> In Progress</span> →
                  <span className="text-brand-200"> Delivered</span> →
                  <span className="text-brand-200"> Accepted</span> →
                  <span className="text-brand-200"> Closed</span>。
                  异常路径会进入 Dispute 并由平台仲裁。
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* Structured request form preview */}
      <Section>
        <SectionHeader
          eyebrow="REQUEST FORM · 结构化需求"
          title="用表单描述需求，而不是靠聊。"
          desc="在 WhiteHive，每一个需求都用同一套结构被表达。你不需要反复截图、反复解释、反复对齐。"
        />

        <Reveal>
          <div className="mt-12 card p-8 md:p-10">
            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              {[
                { label: '服务分类', value: '网页搭建与落地页' },
                { label: '目标', value: '两周内上线首版官网 + 预约落地页' },
                { label: '受众', value: '早期用户访谈对象（约 50 人）' },
                { label: '关键内容模块', value: 'Hero / 产品介绍 / 预约表单 / FAQ' },
                { label: '风格偏好', value: '冷静 / 结构化 / 浅色主题' },
                { label: '交付物', value: '可访问站点 + 源代码 + 部署说明' },
                { label: '时间预期', value: '10 - 14 个自然日' },
                { label: '预算范围', value: '面议 · 平台托管' },
              ].map((f) => (
                <div
                  key={f.label}
                  className="rounded-lg sm:rounded-xl border border-white/8 bg-white/[0.02] p-3 sm:p-4"
                >
                  <div className="mono-label text-white/45 text-[10px] sm:text-[11px]">{f.label}</div>
                  <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-white/85">{f.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center justify-between flex-wrap gap-4">
              <div className="text-xs text-white/40">
                * 这是一份示例需求表单，用于展示结构化字段。
              </div>
              <Link to="/services" className="btn-primary text-sm !py-2 !px-4">
                从服务分类开始 <Icon name="arrow" size={16} />
              </Link>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <div className="card p-10 md:p-14 text-center">
            <h3 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
              把模糊的沟通，变成确定的步骤。
            </h3>
            <p className="mt-4 text-white/60 max-w-2xl mx-auto leading-relaxed">
              WhiteHive 相信，好的流程会减少 80% 的误会。
              剩下的 20%，才需要仲裁和信任机制去兜底。
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/trust" className="btn-ghost">了解可信机制</Link>
              <Link to="/services" className="btn-primary">
                开始使用 <Icon name="arrow" size={18} />
              </Link>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
