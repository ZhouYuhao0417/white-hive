import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Section, SectionHeader, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { categoryDetails } from '../data/listings.js'

const examples = [
  '我想给我的小游戏做一个落地页,能倒计时、能订阅邮件,像 Linear 那样极简',
  '帮我把 3 年前的简历重新排版成能投大厂的中英双语版',
  '我要一份 60 秒的产品介绍短视频,适合发小红书,带字幕和 B-Roll',
  '帮我把一份 Excel 调研数据清洗后跑一版可交互看板',
  '公众号运营想要一个能自动选题 + 排版的 AI 流水线',
  '我是大学社团,要一个成员墙 + 活动日历 + 入团表单的轻官网',
]

const pipeline = [
  {
    k: '01',
    icon: 'spark',
    title: '理解意图',
    desc: '用 LLM 拆解你描述的目标、约束、偏好、预算。',
    color: '#7FD3FF',
  },
  {
    k: '02',
    icon: 'cube',
    title: '结构化字段',
    desc: '把自由文本转成平台统一的需求字段 (交付物 / 边界 / 周期 / 参考案例)。',
    color: '#A5B4FC',
  },
  {
    k: '03',
    icon: 'route',
    title: '跨分类检索',
    desc: '向量检索 + 规则过滤, 在全部分类里找到最契合的服务与创作者。',
    color: '#5EEAD4',
  },
  {
    k: '04',
    icon: 'check',
    title: '打分排序',
    desc: '综合评分、历史交付、风格契合度、预算匹配度, 给出 Top 5 推荐。',
    color: '#C7D2FE',
  },
]

function HeroInput() {
  const [value, setValue] = useState('')
  return (
    <div className="relative card p-8 md:p-10 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(55% 65% at 100% 0%, rgba(127,211,255,0.22), transparent 60%), radial-gradient(45% 55% at 0% 100%, rgba(165,180,252,0.18), transparent 60%), radial-gradient(45% 55% at 50% 100%, rgba(94,234,212,0.14), transparent 60%)',
        }}
      />
      <div className="relative">
        <div className="mono-label">AI MATCH · PROMPT</div>
        <h1 className="mt-2 text-3xl md:text-4xl font-semibold text-white leading-tight tracking-tight">
          把你想做的事, 直接说给 AI 听。
        </h1>
        <p className="mt-3 text-white/65 max-w-2xl leading-relaxed">
          不用预先选择分类, 不用反复找关键字。
          用一段自然语言描述你的目标, 系统会自动拆解需求并跨分类匹配最合适的创作者。
        </p>

        <div className="mt-8 rounded-2xl border border-white/12 bg-white/[0.03] focus-within:border-[#7FD3FF]/55 transition-colors">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="例: 我要给独立游戏做一个预约落地页, 深色科技风, 含倒计时和邮件订阅, 预算 1500 以内, 一周内上线..."
            rows={5}
            className="w-full bg-transparent outline-none p-5 text-sm text-white placeholder:text-white/30 resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/8">
            <div className="flex items-center gap-2 text-[11px] text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4]" />
              WhiteHive AI · 已就绪
            </div>
            <button
              type="button"
              disabled={!value.trim()}
              className="btn-primary !py-2.5 !px-5 disabled:opacity-50"
            >
              开始匹配 <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-3 flex-wrap">
          <span className="mono-label shrink-0 mt-1.5">TRY</span>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setValue(ex)}
                className="text-[12px] px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-white/70 hover:border-[#7FD3FF]/45 hover:text-white transition-colors"
              >
                {ex.length > 36 ? ex.slice(0, 35) + '…' : ex}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Pipeline() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      {pipeline.map((p, i) => (
        <motion.div
          key={p.k}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="card card-hover p-6 relative"
        >
          <div className="flex items-center justify-between">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{
                background: `${p.color}14`,
                border: `1px solid ${p.color}40`,
                color: p.color,
              }}
            >
              <Icon name={p.icon} size={18} />
            </div>
            <span className="font-mono text-xs tracking-wider" style={{ color: p.color }}>
              STEP {p.k}
            </span>
          </div>
          <div className="mt-5 text-white font-medium text-[15px]">{p.title}</div>
          <p className="mt-2 text-xs text-white/60 leading-relaxed">{p.desc}</p>
        </motion.div>
      ))}
    </div>
  )
}

function CoverageMap() {
  const cats = Object.values(categoryDetails)
  return (
    <div className="card p-8 md:p-10">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="mono-label mb-2">COVERAGE · 覆盖范围</div>
          <h3 className="text-2xl font-semibold text-white tracking-tight">
            七个分类之外, 仍然覆盖。
          </h3>
          <p className="mt-2 text-white/60 max-w-lg leading-relaxed text-sm">
            AI 精准匹配不只是搜索预设分类。它会在全部服务、甚至跨分类的服务组合中为你找到解。
          </p>
        </div>
        <Link to="/services" className="btn-ghost text-sm">
          查看全部分类 <Icon name="arrow" size={16} />
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {cats.map((c) => (
          <Link
            key={c.slug}
            to={`/services/${c.slug}`}
            className="rounded-xl border border-white/10 bg-white/[0.025] p-4 hover:border-white/30 transition-colors"
          >
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{
                background: `${c.color}18`,
                border: `1px solid ${c.color}40`,
                color: c.color,
              }}
            >
              <Icon name="cube" size={16} />
            </div>
            <div className="mt-3 text-xs text-white font-medium leading-tight">
              {c.title}
            </div>
            <div className="mt-1 text-[10px] text-white/40">
              {c.listings.length} 件在售
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function AIMatch() {
  return (
    <>
      <Section className="pt-28 md:pt-32">
        <Reveal>
          <HeroInput />
        </Reveal>
      </Section>

      <Section className="!pt-4">
        <SectionHeader
          eyebrow="HOW IT WORKS · AI 匹配流水线"
          title="四步, 把一段话变成一份推荐清单。"
          desc="整条链路都是结构化的, 不是一个黑盒搜索框。"
        />
        <div className="mt-10">
          <Pipeline />
        </div>
      </Section>

      <Section>
        <Reveal>
          <CoverageMap />
        </Reveal>
      </Section>
    </>
  )
}
