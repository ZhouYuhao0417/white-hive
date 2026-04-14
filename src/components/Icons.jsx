// 轻量线性图标集（无第三方依赖），stroke 跟随 currentColor
const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function Icon({ name, className = '', size = 22 }) {
  const props = { ...base, width: size, height: size, className }
  switch (name) {
    case 'browser':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18" />
          <circle cx="6.5" cy="6.5" r=".6" />
          <circle cx="9" cy="6.5" r=".6" />
          <circle cx="11.5" cy="6.5" r=".6" />
        </svg>
      )
    case 'palette':
      return (
        <svg {...props}>
          <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.5-.9.2-2 1.3-2H17a4 4 0 0 0 4-4 9 9 0 0 0-9-10z" />
          <circle cx="7.5" cy="11" r="1" />
          <circle cx="10" cy="7.5" r="1" />
          <circle cx="14.5" cy="7.5" r="1" />
          <circle cx="17" cy="11" r="1" />
        </svg>
      )
    case 'document':
      return (
        <svg {...props}>
          <path d="M7 3h8l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h7M9 17h5" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...props}>
          <path d="M4 20V6" />
          <path d="M20 20H4" />
          <rect x="7" y="12" width="3" height="6" rx=".5" />
          <rect x="12" y="8" width="3" height="10" rx=".5" />
          <rect x="17" y="14" width="3" height="4" rx=".5" />
        </svg>
      )
    case 'play':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...props}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...props}>
          <path d="M12 3l8 3v6c0 4.5-3.2 8.3-8 9-4.8-.7-8-4.5-8-9V6l8-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      )
    case 'vault':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 8.8v.8M12 14.4v.8M15.2 12h.8M8 12h.8" />
        </svg>
      )
    case 'copyright':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9.5a4 4 0 1 0 0 5" />
        </svg>
      )
    case 'key':
      return (
        <svg {...props}>
          <circle cx="8" cy="14" r="3.5" />
          <path d="M10.5 12.5L20 3" />
          <path d="M16 7l2 2" />
        </svg>
      )
    case 'chain':
      return (
        <svg {...props}>
          <path d="M10 13a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11 6" />
          <path d="M14 11a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7L13 18" />
        </svg>
      )
    case 'legal':
      return (
        <svg {...props}>
          <path d="M12 3v18" />
          <path d="M5 7h14" />
          <path d="M8 7l-3 6a3 3 0 0 0 6 0L8 7z" />
          <path d="M16 7l-3 6a3 3 0 0 0 6 0l-3-6z" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...props}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )
    case 'check':
      return (
        <svg {...props}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      )
    case 'user':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" />
        </svg>
      )
    case 'store':
      return (
        <svg {...props}>
          <path d="M4 8l1.5-4h13L20 8" />
          <path d="M4 8v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
          <path d="M9 20v-6h6v6" />
        </svg>
      )
    case 'cube':
      return (
        <svg {...props}>
          <path d="M12 3l8 4.5v9L12 21 4 16.5v-9L12 3z" />
          <path d="M4 7.5l8 4.5 8-4.5" />
          <path d="M12 12v9" />
        </svg>
      )
    case 'gamepad':
      return (
        <svg {...props}>
          <path d="M7 8h10a5 5 0 0 1 5 5v1a4 4 0 0 1-7 2.6L13 15h-2l-2 1.6A4 4 0 0 1 2 14v-1a5 5 0 0 1 5-5z" />
          <path d="M7 11v3M5.5 12.5h3" />
          <circle cx="15.5" cy="12" r=".9" fill="currentColor" />
          <circle cx="17.5" cy="13.5" r=".9" fill="currentColor" />
        </svg>
      )
    case 'wand':
      return (
        <svg {...props}>
          <path d="M5 19L17 7" />
          <path d="M15 5l2 2M19 9l2 2M4 10l2 2M8 4l2 2" />
          <circle cx="19" cy="5" r="0.8" fill="currentColor" />
          <circle cx="5" cy="5" r="0.8" fill="currentColor" />
        </svg>
      )
    case 'route':
      return (
        <svg {...props}>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <path d="M8.5 6H14a3.5 3.5 0 0 1 0 7h-4a3.5 3.5 0 0 0 0 7h5.5" />
        </svg>
      )
    case 'menu':
      return (
        <svg {...props}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      )
    case 'close':
      return (
        <svg {...props}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )
    case 'mail':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M4 7l8 6 8-6" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...props}>
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <path d="M11 18h2" />
        </svg>
      )
    default:
      return null
  }
}

/* ------------------------------------------------------------------ */
/* Brand / social logos — 使用各家品牌色，独立组件便于着色 / 放大          */
/* ------------------------------------------------------------------ */

export function GithubLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.38-3.87-1.38-.53-1.33-1.3-1.68-1.3-1.68-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.26 3.38.96.1-.75.41-1.26.74-1.55-2.56-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.25 5.68.42.36.8 1.07.8 2.16v3.2c0 .31.21.67.8.55A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

export function WechatLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.1 4C4.9 4 1.5 6.85 1.5 10.35c0 1.99 1.11 3.76 2.85 4.95L3.6 17.5l2.55-1.28c.73.2 1.51.33 2.32.36-.15-.52-.22-1.05-.22-1.6 0-3.24 3.09-5.86 6.9-5.86.3 0 .6.02.9.05C15.28 6.07 12.5 4 9.1 4Zm-2.35 3.1a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Zm4.7 0a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Z" />
      <path d="M22.5 15c0-2.94-2.93-5.3-6.55-5.3-3.72 0-6.55 2.36-6.55 5.3 0 2.93 2.83 5.28 6.55 5.28.77 0 1.52-.1 2.21-.3l2.04 1.12-.56-1.84c1.75-1.01 2.86-2.57 2.86-4.26Zm-8.7-1.4a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Zm3.9 0a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Z" />
    </svg>
  )
}

export function QQLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c-3.3 0-6 2.7-6 6 0 1.1.3 2.1.8 3-.5.3-1 .7-1.3 1.1-.9 1.1-1.5 2.6-1.5 3.9 0 .5.3.8.8.8.3 0 .6-.2.7-.5.2-.4.5-.8.8-1.2.1.8.4 1.5.8 2.2-.5.2-.9.5-1.2.9-.3.4-.5.9-.5 1.3 0 .7.6 1.3 1.4 1.5.8.2 1.9.3 3 .3h4.4c1.1 0 2.2-.1 3-.3.8-.2 1.4-.8 1.4-1.5 0-.4-.2-.9-.5-1.3-.3-.4-.7-.7-1.2-.9.4-.7.7-1.4.8-2.2.3.4.6.8.8 1.2.1.3.4.5.7.5.5 0 .8-.3.8-.8 0-1.3-.6-2.8-1.5-3.9-.3-.4-.8-.8-1.3-1.1.5-.9.8-1.9.8-3 0-3.3-2.7-6-6-6Zm-1.8 5.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm3.6 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
    </svg>
  )
}

export function MailLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7.5l8.5 6 8.5-6" />
    </svg>
  )
}

export function PhoneLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </svg>
  )
}
