const defaultFrom = 'WhiteHive <no-reply@whitehive.cn>'

function siteUrl() {
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || ''
  return (
    process.env.WHITEHIVE_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (vercelProductionUrl
      ? vercelProductionUrl.startsWith('http')
        ? vercelProductionUrl
        : `https://${vercelProductionUrl}`
      : '') ||
    'https://www.whitehive.cn'
  )
}

export async function sendEmailVerification({ to, code }) {
  const resendApiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || defaultFrom
  const verificationUrl = `${siteUrl()}/?emailVerificationCode=${encodeURIComponent(code)}`
  const allowMockEmail = process.env.WHITEHIVE_EMAIL_MOCK === '1'

  if (!resendApiKey) {
    if (!allowMockEmail) {
      return {
        provider: 'not_configured',
        delivered: false,
        mock: false,
        verificationUrl: null,
        message: '真实邮件服务尚未配置，请在 Vercel 添加 RESEND_API_KEY 和 EMAIL_FROM。',
      }
    }

    return {
      provider: 'mock',
      delivered: false,
      mock: true,
      verificationUrl,
      message: '本地开发邮件 mock 已开启；线上请配置真实邮件服务。',
    }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: 'WhiteHive 邮箱验证码',
      html: verificationEmailHtml({ code, verificationUrl }),
      text: `你的 WhiteHive 邮箱验证码是：${code}。20 分钟内有效。\n\n也可以打开：${verificationUrl}`,
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    return {
      provider: 'resend',
      delivered: false,
      mock: false,
      verificationUrl,
      message: payload?.message || '邮件服务暂时不可用，请稍后重试。',
    }
  }

  return {
    provider: 'resend',
    delivered: true,
    mock: false,
    verificationUrl,
    message: '验证码邮件已发送。',
    id: payload?.id,
  }
}

function verificationEmailHtml({ code, verificationUrl }) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #07111f; color: #e6f6ff; padding: 32px;">
      <div style="max-width: 560px; margin: 0 auto; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 28px;">
        <p style="margin: 0 0 8px; color: #7fd3ff; letter-spacing: .12em; font-size: 12px;">WHITEHIVE EMAIL VERIFY</p>
        <h1 style="margin: 0 0 16px; font-size: 24px;">验证你的邮箱</h1>
        <p style="line-height: 1.7; color: rgba(230,246,255,.76);">请在 WhiteHive 页面输入下面的 6 位验证码。验证码 20 分钟内有效。</p>
        <div style="margin: 24px 0; padding: 18px 22px; border-radius: 16px; background: #bee6ff; color: #04131f; font-size: 32px; font-weight: 700; letter-spacing: .28em; text-align: center;">${code}</div>
        <p style="line-height: 1.7; color: rgba(230,246,255,.6);">如果页面支持自动填充，也可以点击：<a href="${verificationUrl}" style="color: #7fd3ff;">验证邮箱</a></p>
        <p style="margin-top: 28px; font-size: 12px; color: rgba(230,246,255,.42);">如果不是你本人操作，可以忽略这封邮件。</p>
      </div>
    </div>
  `
}
