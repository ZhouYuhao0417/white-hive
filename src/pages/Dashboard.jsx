import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Section, Reveal } from '../components/Section.jsx'
import { Icon } from '../components/Icons.jsx'
import { getSession, listBackendServices, listOrders } from '../lib/api.js'
import { readCachedOrders } from '../lib/orderCache.js'
import { readCachedServices } from '../lib/serviceCache.js'

const orderStatus = {
  submitted: '待接单',
  accepted: '已接单',
  in_progress: '制作中',
  delivered: '待验收',
  completed: '已完成',
  cancelled: '已取消',
}

const serviceStatus = {
  draft: '草稿',
  pending_review: '待审核',
  published: '已上架',
  rejected: '未通过',
  paused: '已暂停',
  archived: '已归档',
}

function formatMoney(cents, currency = 'CNY') {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(cents || 0) / 100)
}

function mergeById(primary, fallback) {
  const map = new Map()
  ;[...primary, ...fallback].forEach((item) => {
    if (item?.id && !map.has(item.id)) map.set(item.id, item)
  })
  return Array.from(map.values())
}

function StatCard({ label, value, color }) {
  return (
    <div className="card p-5">
      <div className="mono-label">{label}</div>
      <div className="mt-2 text-2xl font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function OrderRow({ order }) {
  return (
    <Link
      to={`/orders/${order.id}`}
      className="block rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:border-[#7FD3FF]/35 hover:bg-[#7FD3FF]/[0.04] transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-white font-medium truncate">{order.title}</div>
          <div className="mt-1 text-xs text-white/45 truncate">
            {order.service?.title || '自定义需求'} · {order.id}
          </div>
        </div>
        <span className="shrink-0 rounded-lg border border-[#7FD3FF]/25 bg-[#7FD3FF]/10 px-2.5 py-1 text-xs text-[#BEE6FF]">
          {orderStatus[order.status] || order.status}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-white/50">
        <span>{formatMoney(order.budgetCents, order.currency)}</span>
        <span>{order.messageCount || 0} 条留言</span>
      </div>
    </Link>
  )
}

function ServiceRow({ service }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-white font-medium truncate">{service.title}</div>
          <p className="mt-1 text-xs text-white/45 line-clamp-2">{service.summary}</p>
        </div>
        <span className="shrink-0 rounded-lg border border-[#5EEAD4]/25 bg-[#5EEAD4]/10 px-2.5 py-1 text-xs text-[#CFFDF5]">
          {serviceStatus[service.status] || service.status || '草稿'}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-white/50">
        <span>{service.category}</span>
        <span>{formatMoney(service.priceCents, service.currency)} · {service.deliveryDays} 天</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [orders, setOrders] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setNotice('')

      try {
        const session = await getSession().catch(() => null)
        const user = session?.session?.mode === 'demo' ? null : session?.user || null
        const [apiOrders, apiServices] = user
          ? await Promise.all([
              listOrders({ userId: user.id }),
              listBackendServices({ status: 'all', sellerId: user.id }),
            ])
          : await Promise.all([
              Promise.resolve([]),
              listBackendServices({ status: 'published' }),
            ])
        if (!mounted) return
        setCurrentUser(user)
        setOrders(user ? mergeById(apiOrders, readCachedOrders()) : [])
        setServices(user ? mergeById(apiServices, readCachedServices()) : apiServices)
        if (user) {
          setNotice(`当前工作台已切换到 ${user.displayName || user.email} 的真实账号数据。`)
        }
      } catch {
        if (!mounted) return
        setOrders([])
        setServices([])
        setNotice('暂时无法连接工作台数据，请稍后刷新。')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const stats = useMemo(() => {
    const activeOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length
    const completedOrders = orders.filter((order) => order.status === 'completed').length
    return {
      orders: orders.length,
      services: services.length,
      activeOrders,
      completedOrders,
    }
  }, [orders, services])

  return (
    <>
      <Section className="pt-28 md:pt-32">
        <Reveal>
          <div className="card p-8 md:p-12 relative overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(55% 65% at 100% 0%, rgba(127,211,255,0.20), transparent 60%), radial-gradient(45% 55% at 0% 100%, rgba(94,234,212,0.12), transparent 60%)',
              }}
            />
            <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <div>
                <div className="mono-label">DASHBOARD · 工作台</div>
                <h1 className="mt-3 text-3xl md:text-5xl font-semibold text-white tracking-tight leading-tight">
                  订单、服务和认证状态,
                  <br className="hidden md:block" />
                  先在这里汇总。
                </h1>
                <p className="mt-5 text-white/60 max-w-2xl leading-relaxed">
                  登录后查看你的买家订单、卖家服务和平台审核状态。未登录时只展示公开服务,
                  订单与聊天数据不会对外暴露。
                </p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Link to="/ai-match" className="btn-primary">
                  提交需求 <Icon name="arrow" size={16} />
                </Link>
                <Link to="/sell" className="btn-ghost">
                  发布服务
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section className="!pt-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={currentUser ? '我的订单' : '订单总数'} value={stats.orders} color="#BEE6FF" />
          <StatCard label="进行中订单" value={stats.activeOrders} color="#A5B4FC" />
          <StatCard label="已完成订单" value={stats.completedOrders} color="#5EEAD4" />
          <StatCard label={currentUser ? '我的服务' : '已发布服务'} value={stats.services} color="#C7D2FE" />
        </div>
      </Section>

      <Section className="!pt-4">
        {notice && (
          <div className="mb-5 rounded-xl border border-[#5EEAD4]/25 bg-[#5EEAD4]/10 px-4 py-3 text-sm text-[#CFFDF5]">
            {notice}
          </div>
        )}
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="card p-6 md:p-7"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="mono-label">BUYER SIDE</div>
                <h2 className="mt-1 text-xl font-semibold text-white">买家订单</h2>
              </div>
              <Link to="/ai-match" className="text-sm text-[#BEE6FF] hover:text-white">
                新需求 →
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {loading && orders.length === 0 ? (
                <div className="text-sm text-white/45">正在加载订单...</div>
              ) : orders.length === 0 ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm text-white/45">
                    还没有订单。先从 AI 匹配页提交一个需求。
                  </div>
                  {!currentUser && (
                    <Link
                      to="/account"
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#7FD3FF]/30 bg-[#7FD3FF]/[0.07] hover:bg-[#7FD3FF]/[0.11] transition-colors px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-white font-medium">登录后查看你的订单协作区</div>
                        <div className="mt-0.5 text-[11px] text-white/55">
                          订单详情、聊天记录和付款状态只对交易双方开放
                        </div>
                      </div>
                      <span className="shrink-0 text-[#BEE6FF]">→</span>
                    </Link>
                  )}
                </div>
              ) : (
                orders.map((order) => <OrderRow key={order.id} order={order} />)
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="card p-6 md:p-7"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="mono-label">SELLER SIDE</div>
                <h2 className="mt-1 text-xl font-semibold text-white">卖家服务</h2>
              </div>
              <Link to="/sell" className="text-sm text-[#BEE6FF] hover:text-white">
                发布服务 →
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {loading && services.length === 0 ? (
                <div className="text-sm text-white/45">正在加载服务...</div>
              ) : services.length === 0 ? (
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm text-white/45">
                  还没有服务。先去开设服务页发布一张商品卡。
                </div>
              ) : (
                services.map((service) => <ServiceRow key={service.id} service={service} />)
              )}
            </div>
          </motion.div>
        </div>
      </Section>
    </>
  )
}
