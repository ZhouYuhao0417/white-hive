import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { acceptSessionToken } = useAuth()
  const [message, setMessage] = useState('正在完成第三方登录...')

  const params = useMemo(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    return {
      token: hash.get('token') || '',
      returnTo: hash.get('returnTo') || '/dashboard',
      error: search.get('error') || '',
    }
  }, [search])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (params.error) {
        setMessage('第三方登录未完成，请返回后重试。')
        setTimeout(() => !cancelled && navigate('/', { replace: true }), 1200)
        return
      }

      if (!params.token) {
        setMessage('登录凭据缺失，请返回后重试。')
        setTimeout(() => !cancelled && navigate('/', { replace: true }), 1200)
        return
      }

      try {
        await acceptSessionToken(params.token)
        if (!cancelled) navigate(sanitizeReturnTo(params.returnTo), { replace: true })
      } catch {
        if (!cancelled) {
          setMessage('登录状态同步失败，请返回后重试。')
          setTimeout(() => !cancelled && navigate('/', { replace: true }), 1200)
        }
      }
    })()
    return () => { cancelled = true }
  }, [acceptSessionToken, navigate, params])

  return (
    <section className="min-h-[60vh] px-6 py-24 grid place-items-center">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="mono-label">OAUTH</div>
        <h1 className="mt-3 text-2xl font-semibold text-white">登录处理中</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">{message}</p>
      </div>
    </section>
  )
}

function sanitizeReturnTo(value) {
  const text = String(value || '/dashboard')
  if (!text.startsWith('/') || text.startsWith('//')) return '/dashboard'
  return text
}
