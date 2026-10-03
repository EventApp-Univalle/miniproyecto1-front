import { createContext, useContext } from 'react'
import { supabase, authConfigurationError } from './supabase'

export const AuthContext = createContext(null)
export const SESSION_EXPIRED_EVENT = 'eventapp:session-expired'

export function useAuth() {
  return useContext(AuthContext)
}

export async function getSession() {
  if (!supabase) throw new Error(authConfigurationError)
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('No pudimos recuperar tu sesión. Inicia sesión nuevamente.')
  return data.session
}

export async function signIn(email, password) {
  if (!supabase) throw new Error(authConfigurationError)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error('No pudimos iniciar sesión. Revisa tus credenciales e inténtalo nuevamente.')
  }
  return data.session
}

export async function clearSession() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw new Error('No pudimos cerrar tu sesión. Inténtalo nuevamente.')
}

export function expireSession() {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  void clearSession().catch(() => {})
}
