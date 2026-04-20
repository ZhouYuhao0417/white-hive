import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Section, SectionHeader, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { services } from '../data/services.js'
import { categoryDetails } from '../data/listings.js'
import { createOrder, matchServices } from '../lib/api.js'
import { cacheOrder } from '../lib/orderCache.js'

/* ============================================================
   静态字段
   ============================================================ */
const deadlineOptions = ['3 天内', '1 周内', '2 周内', '1 个月内', '更长或灵活']
const budgetOptions = ['< ¥1,000', '¥1,000 - ¥3,000', '¥3,000 - ¥10,000', '¥10,000+', '暂不确定']
const categoryOptions = [
  { slug: 'any', title: '不确定 / 让 AI 帮我选', color: '#BEE6FF' },
  ...services.map((s) => ({ slug: s.slug, title: s.title, color: s.color })),
]

function budgetToCents(budget) {
  const map = {
    '< ¥1,000': 80000,
    '¥1,000 - ¥3,000': 200000,
    '¥3,000 - ¥10,000': 600000,
    '¥10,000+': 1000000,
    '暂不确定': 200000,
  }
  return map[budget] || 200000
}

function categoryLabel(slug) {
  return categoryOptions.find((item) => item.slug === slug)?.title || slug || '未选择'
}

/* API 暂不可用时的本地追问兜底；正式结果优先使用 /api/matches 返回的问题。 */
const baseQuestions = [
  {
    key: 'reference',
    label: '有没有参考的案例或风格?',
    hint: '可以是一个链接、一张图、一个产品名。参考帮 AI 更快定位你的审美。',
    placeholder: '例: Linear 的极简风, 或者某个 Dribbble 作品链接',
  },
  {
    key: 'audience',
    label: '目标受众是谁?',
    hint: '给谁看? 给谁用? 目标受众决定了语言、视觉和技术选型。',
    placeholder: '例: 25-35 岁的独立开发者 / 想投资的 LP / 小红书女性用户',
  },
  {
    key: 'success',
    label: '对"达标"的定义是什么?',
    hint: '什么状态你就算满意了? 把"达标线"说清, 后面的验收就不会扯皮。',
    placeholder: '例: 能上线、能被分享、能带来 100 次预约',
  },
  {
    key: 'avoid',
    label: '有没有明确不想要的东西?',
    hint: '禁区往往比目标更重要。写下你绝对不想要的风格、内容或体验。',
    placeholder: '例: 不要渐变色、不要弹窗、不要英文比例过高',
  },
]

const localQuestionBank = {
  gaming: [
    {
      key: 'game_context',
      label: '具体是哪款游戏、区服/服务器和账号平台？',
      reason: '不同游戏和区服决定卖家是否能接单。',
    },
    {
      key: 'gaming_goal',
      label: '这次要代肝到什么目标？',
      reason: '明确段位、任务或资源数量，方便报价验收。',
    },
    {
      key: 'gaming_safety',
      label: '账号交接和安全边界有什么要求？',
      reason: '先说清登录方式、禁用操作和截图留痕。',
    },
    {
      key: 'gaming_proof',
      label: '完成后用什么截图或记录验收？',
      reason: '验收标准越清楚，纠纷越少。',
    },
  ],
  web: [
    {
      key: 'page_scope',
      label: '需要哪些页面和核心功能？',
      reason: '页面和功能范围会直接影响报价与周期。',
    },
    {
      key: 'conversion_goal',
      label: '最希望访问者在页面上完成什么动作？',
      reason: '先明确转化目标，页面设计才不会跑偏。',
    },
    {
      key: 'assets_ready',
      label: '文案、图片、Logo、域名现在准备到什么程度？',
      reason: '素材是否齐全会影响上线速度。',
    },
    {
      key: 'web_integrations',
      label: '是否要接入表单、支付、登录或后台管理？',
      reason: '外部接口会影响技术方案和验收方式。',
    },
  ],
  design: [
    {
      key: 'design_usage',
      label: '这套设计主要会用在哪里？',
      reason: '使用场景决定尺寸、风格和交付格式。',
    },
    {
      key: 'brand_keywords',
      label: '你希望别人看到后想到哪 3 个关键词？',
      reason: '关键词能把抽象审美转成明确方向。',
    },
    {
      key: 'design_assets',
      label: '已有 Logo、字体、色彩或品牌素材吗？',
      reason: '现有资产会影响是否需要从零设计。',
    },
  ],
  ai: [
    {
      key: 'workflow_steps',
      label: '你想把哪几步工作交给 AI/自动化？',
      reason: '拆清步骤才能判断适合脚本还是工作流。',
    },
    {
      key: 'current_tools',
      label: '现在用哪些工具或平台处理这件事？',
      reason: '现有工具决定接入方式。',
    },
    {
      key: 'data_privacy',
      label: '里面有没有账号、客户资料或敏感数据？',
      reason: '敏感数据需要提前设计安全边界。',
    },
  ],
}

function fallbackQuestionsForForm(form) {
  const want = String(form.want || '').toLowerCase()
  const inferred =
    form.category && form.category !== 'any'
      ? form.category
      : /游戏|代肝|陪玩|排位|开黑|账号|装备/.test(want)
        ? 'gaming'
        : /官网|网站|落地页|表单|前端|上线/.test(want)
          ? 'web'
          : /设计|logo|品牌|海报|ui|视觉/.test(want)
            ? 'design'
            : /ai|prompt|自动化|智能体|agent/.test(want)
              ? 'ai'
              : ''

  return localQuestionBank[inferred] || baseQuestions
}

/* ============================================================
   Stage 指示器
   ============================================================ */
function StageHeader({ n, title, desc, active, done }) {
  return (
    <div className="flex items-start gap-4">
      <div
        className="h-11 w-11 rounded-xl flex items-center justify-center font-mono text-sm shrink-0 transition-all"
        style={{
          background: active || done ? 'rgba(127,211,255,0.14)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${active || done ? 'rgba(127,211,255,0.50)' : 'rgba(255,255,255,0.10)'}`,
          color: active || done ? '#BEE6FF' : 'rgba(255,255,255,0.45)',
        }}
      >
        {done ? '✓' : n}
      </div>
      <div className="min-w-0">
        <div
          className="mono-label"
          style={{ color: active || done ? '#BEE6FF' : 'rgba(255,255,255,0.35)' }}
        >
          STAGE {n}
        </div>
        <h3
          className="mt-1 text-xl md:text-2xl font-semibold tracking-tight leading-tight"
          style={{ color: active || done ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}
        >
          {title}
        </h3>
        {desc && (
          <p className="mt-1.5 text-sm text-white/55 leading-relaxed">{desc}</p>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Stage 1 · 结构化表单
   ============================================================ */
function ChipGroup({ value, onChange, options, color = '#7FD3FF' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.title
        const k = typeof opt === 'string' ? opt : opt.slug
        const optColor = typeof opt === 'string' ? color : opt.color
        const isActive = value === k
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className="px-3.5 h-9 rounded-lg text-sm transition-all"
            style={{
              background: isActive ? `${optColor}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isActive ? `${optColor}70` : 'rgba(255,255,255,0.10)'}`,
              color: isActive ? optColor : 'rgba(255,255,255,0.70)',
            }}
          >
            {v}
          </button>
        )
      })}
    </div>
  )
}

function StructuredForm({ form, setForm, onAdvance, canAdvance }) {
  return (
    <div className="mt-8 card p-7 md:p-9">
      <div className="grid md:grid-cols-2 gap-x-8 gap-y-7">
        {/* 时限 */}
        <div>
          <label className="mono-label">时限 / DEADLINE</label>
          <div className="mt-3">
            <ChipGroup
              value={form.deadline}
              onChange={(v) => setForm({ ...form, deadline: v })}
              options={deadlineOptions}
            />
          </div>
        </div>

        {/* 预算 */}
        <div>
          <label className="mono-label">预算 / BUDGET</label>
          <div className="mt-3">
            <ChipGroup
              value={form.budget}
              onChange={(v) => setForm({ ...form, budget: v })}
              options={budgetOptions}
            />
          </div>
        </div>

        {/* 分类 (跨越两列) */}
        <div className="md:col-span-2">
          <label className="mono-label">分类 / CATEGORY</label>
          <div className="mt-3">
            <ChipGroup
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              options={categoryOptions}
            />
          </div>
        </div>

        {/* 想要什么 */}
        <div className="md:col-span-2">
          <label className="mono-label">想要什么 · CORE GOAL</label>
          <p className="mt-1.5 text-xs text-white/45 leading-relaxed">
            用一两句话说清楚你核心要做成什么。AI 会从这里开始追问细节。
          </p>
          <input
            type="text"
            value={form.want}
            onChange={(e) => setForm({ ...form, want: e.target.value })}
            placeholder="例: 我要给独立游戏做一个预约落地页, 深色科技风, 含倒计时和邮件订阅"
            className="mt-3 w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors"
          />
        </div>
      </div>

      <div className="mt-7 pt-6 border-t border-white/6 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-xs text-white/45">
          {canAdvance ? (
            <span className="text-[#5EEAD4]">● 表单已足以让 AI 开始追问</span>
          ) : (
            <span>填完以上四个字段即可进入下一步</span>
          )}
        </div>
        <button
          type="button"
          onClick={onAdvance}
          disabled={!canAdvance}
          className="btn-primary !py-2.5 !px-5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          让 AI 继续追问 <Icon name="arrow" size={16} />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   Stage 2 · AI 追问
   ============================================================ */
function hintFor(q) {
  // LLM questions come with { key, label, reason } but no hint/placeholder.
  // Fall back to the matching baseQuestion entry if available.
  const base = baseQuestions.find((b) => b.key === q.key)
  return {
    hint: q.reason || base?.hint || '',
    placeholder: base?.placeholder || '直接写下你的答案就行，一句话也可以。',
  }
}

function AIClarify({
  form,
  answers,
  setAnswers,
  onAdvance,
  revealed,
  questions,
  matchLoading,
  matchError,
  intentSummary,
  engineLabel,
}) {
  const showLoading = matchLoading
  const visibleQuestions = questions.slice(0, revealed)
  const awaitingMore = !matchLoading && revealed < questions.length
  const canAdvance = !matchLoading && revealed >= questions.length && questions.length > 0

  return (
    <div className="mt-8 card p-7 md:p-9 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          background:
            'radial-gradient(40% 50% at 100% 0%, rgba(127,211,255,0.14), transparent 60%), radial-gradient(40% 50% at 0% 100%, rgba(165,180,252,0.12), transparent 60%)',
        }}
      />
      <div className="relative">
        {/* 用户说的话 (用 chat bubble 呈现) */}
        <div className="flex justify-end">
          <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-sm bg-white/[0.06] border border-white/10 text-sm text-white/85 leading-relaxed break-words">
            {form.want}
          </div>
        </div>

        {/* AI 的开场白 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-5 flex items-start gap-3"
        >
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(127,211,255,0.14)',
              border: '1px solid rgba(127,211,255,0.45)',
              color: '#7FD3FF',
            }}
          >
            <Icon name="spark" size={16} />
          </div>
          <div className="flex-1 min-w-0 max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-sm bg-[#7FD3FF]/[0.07] border border-[#7FD3FF]/25 text-sm text-white/80 leading-relaxed break-words">
            {showLoading ? (
              <>
                我正在读你的需求，并在已发布的服务里做初筛。等一下就告诉你我还想确认什么。
              </>
            ) : matchError ? (
              <>
                AI 匹配暂时拿不到结果（{matchError}），我先按通用模板继续追问，不影响后面提交。
              </>
            ) : intentSummary ? (
              <>
                {intentSummary}。接下来想再确认 {questions.length || '几'} 件事，这样匹配到的创作者会更贴近你要的结果。
              </>
            ) : (
              <>
                收到。我从你的描述里补齐了
                <span className="text-[#BEE6FF]"> {form.deadline || '时限'} </span>和
                <span className="text-[#BEE6FF]"> {form.budget || '预算'} </span>
                两个字段。接下来我想再确认 {questions.length || '几'} 件事, 这样匹配到的创作者会更贴近你想要的结果。
              </>
            )}
          </div>
        </motion.div>

        {/* 追问区 */}
        <div className="mt-6 space-y-5">
          {showLoading ? (
            <div className="flex items-center gap-2 text-xs text-white/55 pl-12 py-4">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7FD3FF] animate-pulse" />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#A5B4FC] animate-pulse"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4] animate-pulse"
                  style={{ animationDelay: '300ms' }}
                />
              </span>
              AI 正在读你的需求，这通常需要 5–15 秒…
            </div>
          ) : (
            visibleQuestions.map((q, i) => {
              const { hint, placeholder } = hintFor(q)
              return (
                <motion.div
                  key={q.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                  className="flex items-start gap-3"
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 font-mono text-xs"
                    style={{
                      background: 'rgba(165,180,252,0.14)',
                      border: '1px solid rgba(165,180,252,0.45)',
                      color: '#C7D2FE',
                    }}
                  >
                    Q{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium">{q.label}</div>
                    {hint && (
                      <div className="mt-1 text-[11px] text-white/45 leading-relaxed">
                        {hint}
                      </div>
                    )}
                    <input
                      type="text"
                      value={answers[q.key] || ''}
                      onChange={(e) =>
                        setAnswers({ ...answers, [q.key]: e.target.value })
                      }
                      placeholder={placeholder}
                      className="mt-3 w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#A5B4FC]/60 focus:bg-white/[0.05] transition-colors"
                    />
                  </div>
                </motion.div>
              )
            })
          )}

          {/* Typing indicator between staggered questions */}
          {awaitingMore && (
            <div className="flex items-center gap-2 text-xs text-white/45 pl-12">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7FD3FF] animate-pulse" />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#A5B4FC] animate-pulse"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4] animate-pulse"
                  style={{ animationDelay: '300ms' }}
                />
              </span>
              AI 正在生成下一个问题…
            </div>
          )}
        </div>

        <div className="mt-7 pt-6 border-t border-white/6 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs text-white/45">
            {engineLabel ? <span className="text-[#5EEAD4]">● {engineLabel} · </span> : null}
            追问可以选择性回答。空着的字段 AI 会根据分类默认值推断。
          </div>
          <button
            type="button"
            onClick={onAdvance}
            disabled={!canAdvance}
            className="btn-primary !py-2.5 !px-5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            添加补充备注 <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Stage 3 · 自由备注
   ============================================================ */
function FreeNotes({ notes, setNotes, onSubmit, submitting, error }) {
  return (
    <div className="mt-8 card p-7 md:p-9">
      <p className="text-sm text-white/55 leading-relaxed">
        前面是结构化的字段, 这里是留给你的自由区。
        任何不方便放进上面字段的想法、担心、个人偏好、背景故事,
        都可以写在这里。AI 会把这段文本作为非结构化备注附在需求上。
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={6}
        placeholder="例: 我是第一次做这种项目, 希望创作者能在 Slack 里保持响应; 另外我朋友推荐过 XX, 你们如果有类似风格的人选优先..."
        className="mt-4 w-full bg-white/[0.03] rounded-xl border border-white/10 p-5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7FD3FF]/55 focus:bg-white/[0.05] transition-colors leading-relaxed resize-none"
      />
      <div className="mt-6 pt-5 border-t border-white/6 flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4]" />
            所有字段已就绪 · 提交后会创建一张订单
          </div>
          {error && (
            <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-100">
              {error}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="btn-primary !py-2.5 !px-5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '正在创建订单...' : '提交需求, 生成订单'} <Icon name="arrow" size={16} />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   Pipeline + Coverage (保留上一版)
   ============================================================ */
function Pipeline() {
  const pipeline = [
    { k: '01', icon: 'spark', title: '理解意图', desc: '用 LLM 拆解你描述的目标、约束、偏好、预算。', color: '#7FD3FF' },
    { k: '02', icon: 'cube', title: '结构化字段', desc: '把自由文本转成平台统一的需求字段 (交付物 / 边界 / 周期 / 参考案例)。', color: '#A5B4FC' },
    { k: '03', icon: 'route', title: '跨分类检索', desc: '向量检索 + 规则过滤, 在全部分类里找到最契合的服务与创作者。', color: '#5EEAD4' },
    { k: '04', icon: 'check', title: '打分排序', desc: '综合评分、历史交付、风格契合度、预算匹配度, 给出 Top 5 推荐。', color: '#C7D2FE' },
  ]
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      {pipeline.map((p, i) => (
        <motion.div
          key={p.k}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="card card-hover p-6"
        >
          <div className="flex items-center justify-between">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ background: `${p.color}14`, border: `1px solid ${p.color}40`, color: p.color }}
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
              style={{ background: `${c.color}18`, border: `1px solid ${c.color}40`, color: c.color }}
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

/* ============================================================
   提交成功 overlay
   ============================================================ */
function SubmittedOverlay({ onClose, form, answers, notes, order }) {
  return (
    <div className="card p-8 md:p-10 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(55% 65% at 100% 0%, rgba(94,234,212,0.22), transparent 60%), radial-gradient(45% 55% at 0% 100%, rgba(127,211,255,0.18), transparent 60%)',
        }}
      />
      <div className="relative">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'rgba(94,234,212,0.14)',
            border: '1px solid rgba(94,234,212,0.50)',
            color: '#5EEAD4',
          }}
        >
          <Icon name="check" size={24} />
        </div>
        <h3 className="mt-5 text-2xl md:text-3xl font-semibold text-white tracking-tight">
          需求已提交, AI 正在匹配。
        </h3>
        <p className="mt-3 text-white/65 leading-relaxed max-w-2xl">
          WhiteHive 已经为这份需求创建了一张订单。你现在可以进入订单详情页,
          继续补充留言、查看状态，并和服务方确认交付范围。
        </p>

        <div className="mt-6 grid md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mono-label mb-2">结构化字段</div>
            <div className="text-xs text-white/70 space-y-1.5">
              <div>时限: <span className="text-white">{form.deadline || '—'}</span></div>
              <div>预算: <span className="text-white">{form.budget || '—'}</span></div>
              <div>分类: <span className="text-white">{categoryLabel(form.category)}</span></div>
              <div>核心: <span className="text-white">{form.want}</span></div>
              <div>订单: <span className="text-white">{order?.id || '—'}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mono-label mb-2">AI 追问回答</div>
            <div className="text-xs text-white/70 space-y-1.5">
              {baseQuestions.map((q) => (
                <div key={q.key}>
                  {q.label.slice(0, 10)}…:{' '}
                  <span className="text-white">{answers[q.key] || '(留空)'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3 flex-wrap">
          <button type="button" onClick={onClose} className="btn-ghost">
            再提交一次
          </button>
          <Link to={order ? `/orders/${order.id}` : '/services'} className="btn-primary">
            进入订单详情 <Icon name="arrow" size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   主页面
   ============================================================ */
export default function AIMatch() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    deadline: '',
    budget: '',
    category: searchParams.get('category') || '',
    want: '',
  })
  const [answers, setAnswers] = useState({})
  const [notes, setNotes] = useState('')
  const [stage, setStage] = useState(1) // 1 | 2 | 3
  const [revealed, setRevealed] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [createdOrder, setCreatedOrder] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // AI match state (Stage 2 clarifying questions come from /api/matches)
  const [matchResult, setMatchResult] = useState(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchError, setMatchError] = useState('')

  const liveQuestions = useMemo(() => {
    const fromApi = matchResult?.clarifyingQuestions
    if (Array.isArray(fromApi) && fromApi.length > 0) {
      return fromApi.map((q) => ({
        key: q.key || 'detail',
        label: q.label,
        reason: q.reason || '',
      }))
    }
    return fallbackQuestionsForForm(form)
  }, [matchResult, form])

  const engineLabel = matchResult
    ? matchResult.engine === 'whitehive-deepseek-v1'
      ? 'DeepSeek 实时推理'
      : '规则匹配'
    : null

  const intentSummary = matchResult?.query?.llmIntent?.summary || null

  const canAdvanceToStage2 = useMemo(
    () =>
      !!form.deadline &&
      !!form.budget &&
      !!form.category &&
      form.want.trim().length >= 6,
    [form]
  )

  /* 进入 Stage 2 时，等 matcher 返回后逐条揭示问题。
     loading 期间 revealed=0；questions 到位后每 700ms 揭示一个。 */
  useEffect(() => {
    if (stage !== 2) return
    if (matchLoading) {
      setRevealed(0)
      return
    }
    const total = liveQuestions.length
    if (total === 0) return
    setRevealed(0)
    let i = 0
    const iv = setInterval(() => {
      i += 1
      setRevealed(i)
      if (i >= total) clearInterval(iv)
    }, 700)
    return () => clearInterval(iv)
  }, [stage, matchLoading, liveQuestions])

  /* Stage 1 → Stage 2：触发 /api/matches，拿回 LLM 追问。
     失败时静默回退到 baseQuestions，不阻塞用户推进。 */
  async function advanceFromStage1() {
    setStage(2)
    setMatchLoading(true)
    setMatchError('')
    try {
      const result = await matchServices({
        category: form.category === 'any' ? undefined : form.category,
        budgetCents: budgetToCents(form.budget),
        deadline: form.deadline,
        title: form.want,
        brief: form.want,
        limit: 5,
      })
      setMatchResult(result)
    } catch (err) {
      setMatchResult(null)
      setMatchError(err?.message || '匹配服务暂时不可用')
    } finally {
      setMatchLoading(false)
    }
  }

  const reset = () => {
    setForm({ deadline: '', budget: '', category: '', want: '' })
    setAnswers({})
    setNotes('')
    setStage(1)
    setSubmitted(false)
    setCreatedOrder(null)
    setSubmitError('')
    setSubmitting(false)
    setMatchResult(null)
    setMatchLoading(false)
    setMatchError('')
  }

  const submitDemand = async () => {
    setSubmitting(true)
    setSubmitError('')

    // Use the actual questions the user was asked (LLM-generated or fallback).
    const clarification = liveQuestions
      .map((q) => `${q.label} ${answers[q.key] || '(未填写)'}`)
      .join('\n')

    const brief = [
      `核心目标: ${form.want}`,
      `时限: ${form.deadline}`,
      `预算: ${form.budget}`,
      `分类: ${categoryLabel(form.category)}`,
      clarification,
      notes ? `补充备注: ${notes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    try {
      const order = await createOrder({
        category: form.category === 'any' ? undefined : form.category,
        title: form.want,
        brief,
        budgetCents: budgetToCents(form.budget),
        verificationRequired: false,
      })
      cacheOrder(order)
      setCreatedOrder(order)
      setSubmitted(true)
      window.setTimeout(() => navigate(`/orders/${order.id}`), 900)
    } catch (err) {
      setSubmitError(err.message || '需求提交失败，请稍后再试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Hero */}
      <Section className="pt-28 md:pt-32">
        <Reveal>
          <div className="relative card p-8 md:p-12 overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(55% 65% at 100% 0%, rgba(127,211,255,0.22), transparent 60%), radial-gradient(45% 55% at 0% 100%, rgba(165,180,252,0.18), transparent 60%), radial-gradient(45% 55% at 50% 100%, rgba(94,234,212,0.14), transparent 60%)',
              }}
            />
            <div className="relative">
              <div className="mono-label">AI MATCH · 引导式提交</div>
              <h1 className="mt-2 text-3xl md:text-4xl font-semibold text-white leading-tight tracking-tight">
                三步, 把一段需求,
                <br className="hidden sm:block" />
                交给最合适的创作者。
              </h1>
              <p className="mt-4 text-white/65 max-w-2xl leading-relaxed">
                不是一个搜索框。先填几个结构化字段, 让 AI 根据你的描述继续追问细节,
                最后补一段自由备注。每一步都是为了让匹配更准, 不是让你多填表。
              </p>
              <div className="mt-6 flex items-center gap-6 text-xs text-white/50 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#7FD3FF]" />
                  Stage 1 · 结构化字段
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#A5B4FC]" />
                  Stage 2 · AI 智能追问
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4]" />
                  Stage 3 · 非结构化备注
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* Guided Form Stages */}
      <Section className="!pt-6">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <SubmittedOverlay
                onClose={reset}
                form={form}
                answers={answers}
                notes={notes}
                order={createdOrder}
              />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-10"
            >
              {/* Stage 1 */}
              <div>
                <StageHeader
                  n="01"
                  title="告诉 WhiteHive 基本信息"
                  desc="先填四个结构化字段: 时限、预算、分类、核心目标。这是整个匹配的起点。"
                  active={stage === 1}
                  done={stage > 1}
                />
                <StructuredForm
                  form={form}
                  setForm={setForm}
                  canAdvance={canAdvanceToStage2}
                  onAdvance={advanceFromStage1}
                />
              </div>

              {/* Stage 2 */}
              {stage >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  <StageHeader
                    n="02"
                    title="让 AI 追问细节"
                    desc="AI 基于你的核心目标生成几条澄清问题。回答一个算一个, 空着也可以。"
                    active={stage === 2}
                    done={stage > 2}
                  />
                  <AIClarify
                    form={form}
                    answers={answers}
                    setAnswers={setAnswers}
                    revealed={revealed}
                    questions={liveQuestions}
                    matchLoading={matchLoading}
                    matchError={matchError}
                    intentSummary={intentSummary}
                    engineLabel={engineLabel}
                    onAdvance={() => setStage(3)}
                  />
                </motion.div>
              )}

              {/* Stage 3 */}
              {stage >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  <StageHeader
                    n="03"
                    title="补充非结构化备注"
                    desc="任何不方便塞进字段里的、细碎的、偏主观的想法, 都可以写在这里。"
                    active={stage === 3}
                  />
                  <FreeNotes
                    notes={notes}
                    setNotes={setNotes}
                    onSubmit={submitDemand}
                    submitting={submitting}
                    error={submitError}
                  />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      {/* Pipeline explainer */}
      <Section>
        <SectionHeader
          eyebrow="HOW IT WORKS · AI 匹配流水线"
          title="四步, 把一份表单变成一份推荐清单。"
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
