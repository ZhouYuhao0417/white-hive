// 卖家等级徽章 · 三种尺寸 + 可选进度条
//
// 用法:
//   <SellerLevelBadge stats={seller.stats} />                 默认尺寸
//   <SellerLevelBadge stats={seller.stats} size="xs" />       小字(服务卡)
//   <SellerLevelBadge stats={seller.stats} showProgress />    大卡片右侧 / 详情页 sidebar
//
// stats: { ordersCompleted, avgRating }
// 也可以直接传 level 对象跳过计算: <SellerLevelBadge level={computed} />

import { computeSellerLevel } from '../lib/sellerLevel.js'

export function SellerLevelBadge({ stats, level: precomputed, size = 'sm', showProgress = false }) {
  const lv = precomputed || computeSellerLevel(stats || {})

  const height = size === 'xs' ? 'h-5 px-1.5 text-[10px]' : size === 'lg' ? 'h-7 px-3 text-xs' : 'h-6 px-2 text-[11px]'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-medium ${height}`}
      style={{
        borderColor: `${lv.color}55`,
        background: `${lv.color}14`,
        color: lv.color,
      }}
      title={`Lv.${lv.tier} · ${lv.orders} 单${lv.rating != null ? ` · ★ ${lv.rating.toFixed(1)}` : ''}`}
    >
      <span className="tracking-wider">Lv.{lv.tier}</span>
      {showProgress && lv.next && (
        <span className="ml-1 opacity-70">
          · 距 Lv.{lv.next.tier} 还差 {lv.progress.ordersNeeded} 单
        </span>
      )}
    </span>
  )
}

export default SellerLevelBadge
