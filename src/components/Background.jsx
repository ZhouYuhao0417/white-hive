// 全局装饰背景：细栅格 + 顶部光晕 + 边缘淡化
export default function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-grid-fine opacity-[0.55]" />
      <div
        className="absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 0%, rgba(127,211,255,0.14), transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, #0A0B10 100%)',
        }}
      />
    </div>
  )
}
