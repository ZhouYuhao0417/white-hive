import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  acceptSessionToken as acceptSessionTokenRequest,
  clearSession,
  confirmEmailVerification as confirmEmailVerificationRequest,
  confirmPasswordReset as confirmPasswordResetRequest,
  confirmPhoneLogin as confirmPhoneLoginRequest,
  confirmPhoneVerification as confirmPhoneVerificationRequest,
  createProviderSession,
  createSession,
  deleteAccount as deleteAccountRequest,
  getAuthProviders,
  getSession,
  hasSessionToken,
  requestEmailVerification as requestEmailVerificationRequest,
  requestPasswordReset as requestPasswordResetRequest,
  requestPhoneLogin as requestPhoneLoginRequest,
  requestPhoneVerification as requestPhoneVerificationRequest,
  uploadAvatar as uploadAvatarRequest,
} from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user && user.email !== 'guest@whitehive.cn'

  // restore session on mount
  useEffect(() => {
    if (!hasSessionToken()) {
      setIsLoading(false)
      return undefined
    }

    let cancelled = false
    ;(async () => {
      try {
        const data = await getSession()
        if (!cancelled && data?.user && data.user.email !== 'guest@whitehive.cn') {
          setUser(data.user)
        }
      } catch {
        // no valid session — stay logged out
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (payload) => {
    const data = await createSession({ ...payload, action: 'signin' })
    if (data?.user) setUser(data.user)
    return data
  }, [])

  const signup = useCallback(async (payload) => {
    const data = await createSession({ ...payload, action: 'signup' })
    if (data?.user) setUser(data.user)

    if (payload?.avatarUrl?.startsWith?.('data:image/')) {
      try {
        const uploaded = await uploadAvatarRequest({
          dataUrl: payload.avatarUrl,
          fileName: 'avatar.jpg',
          contentType: 'image/jpeg',
        })
        if (uploaded?.user) setUser(uploaded.user)
        return {
          ...data,
          user: uploaded?.user || data?.user,
          avatarUpload: uploaded?.upload || null,
        }
      } catch {
        // Blob may not be configured yet; keep the compressed data URL profile for the MVP.
      }
    }

    return data
  }, [])

  const loginWithProvider = useCallback(async (provider, payload) => {
    const data = await createProviderSession(provider, payload)
    if (data?.user) setUser(data.user)
    return data
  }, [])

  const acceptSessionToken = useCallback(async (token) => {
    acceptSessionTokenRequest(token)
    const data = await getSession()
    if (data?.user && data.user.email !== 'guest@whitehive.cn') {
      setUser(data.user)
    }
    return data
  }, [])

  const getProviderStatus = useCallback(async () => {
    return getAuthProviders()
  }, [])

  const requestPhoneLogin = useCallback(async (phone) => {
    return requestPhoneLoginRequest(phone)
  }, [])

  const confirmPhoneLogin = useCallback(async (payload) => {
    const data = await confirmPhoneLoginRequest(payload)
    if (data?.user) setUser(data.user)
    return data
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const deleteAccount = useCallback(async () => {
    const data = await deleteAccountRequest()
    clearSession()
    setUser(null)
    return data
  }, [])

  const requestEmailVerification = useCallback(async () => {
    const data = await requestEmailVerificationRequest()
    if (data?.user) setUser(data.user)
    return data
  }, [])

  const confirmEmailVerification = useCallback(async (code) => {
    const data = await confirmEmailVerificationRequest(code)
    if (data?.user) setUser(data.user)
    return data
  }, [])

  const requestPhoneVerification = useCallback(async (phone) => {
    const data = await requestPhoneVerificationRequest(phone)
    if (data?.user) setUser(data.user)
    return data
  }, [])

  const confirmPhoneVerification = useCallback(async (phone, code) => {
    const data = await confirmPhoneVerificationRequest(phone, code)
    if (data?.user) setUser(data.user)
    return data
  }, [])

  const requestPasswordReset = useCallback(async (email) => {
    return requestPasswordResetRequest(email)
  }, [])

  const confirmPasswordReset = useCallback(async (payload) => {
    return confirmPasswordResetRequest(payload)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const data = await getSession()
      if (data?.user && data.user.email !== 'guest@whitehive.cn') {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        signup,
        loginWithProvider,
        acceptSessionToken,
        getProviderStatus,
        logout,
        deleteAccount,
        refreshUser,
        requestEmailVerification,
        confirmEmailVerification,
        requestPhoneLogin,
        confirmPhoneLogin,
        requestPhoneVerification,
        confirmPhoneVerification,
        requestPasswordReset,
        confirmPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>')
  return ctx
}
