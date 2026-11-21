import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js'

/** Nenhuma requisição pode travar o app: desiste depois de 20 s. */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 20_000)
  init?.signal?.addEventListener('abort', () => ctrl.abort())
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** null = modo local (sem conta), usado só na prévia. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        // processLock: o navigator.locks do iPhone (web app na tela inicial) pode ficar preso e travar todas as chamadas
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'veyro-auth', detectSessionInUrl: true, lock: processLock },
        global: { fetch: fetchWithTimeout },
      })
    : null

export const LOCAL_USER_ID = 'local'
