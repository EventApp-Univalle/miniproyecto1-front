import { useEffect, useState } from 'react'
import { AuthContext, getSession, SESSION_EXPIRED_EVENT } from './auth'
import { supabase, authConfigurationError } from './supabase'

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [authError, setAuthError] = useState(authConfigurationError)

  useEffect(() => {
    if (!supabase) return
    let active = true
    let sessionChanged = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      sessionChanged = true
      setSession(nextSession)
      setLoading(false)
      if (nextSession) setAuthError('')
    })
    const handleExpired = () => {
      sessionChanged = true
      setSession(null)
      setLoading(false)
      setAuthError('Tu sesión venció o dejó de ser válida. Inicia sesión nuevamente.')
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired)
    getSession().then(nextSession => {
      if (active && !sessionChanged) setSession(nextSession)
    }).catch(error => {
      if (active && !sessionChanged) setAuthError(error.message)
    }).finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
      subscription.unsubscribe()
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, authError }}>
      {children}
    </AuthContext.Provider>
  )
}
