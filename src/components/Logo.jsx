export default function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7FD3FF" />
            <stop offset="1" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="#0F111A" stroke="rgba(255,255,255,0.08)" />
        <path
          d="M14 20 L24 46 L32 26 L40 46 L50 20"
          fill="none"
          stroke="url(#lg)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-semibold tracking-tight text-white">
        WhiteHive
      </span>
    </div>
  )
}
