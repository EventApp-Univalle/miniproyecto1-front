import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim()
let configurationError = ''
let client = null

if (!url || !key) {
  configurationError = 'Falta configurar la conexión pública de Supabase para iniciar sesión.'
} else {
  try {
    // Accept only public keys: publishable or the legacy anon JWT.
    const isPublishable = key.startsWith('sb_publishable_')
    const payload = isPublishable ? null : JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!isPublishable && payload?.role !== 'anon') throw new Error('Invalid public key')
    client = createClient(url, key)
  } catch {
    configurationError = 'La configuración pública de Supabase no es válida.'
  }
}

export const supabase = client
export const authConfigurationError = configurationError
