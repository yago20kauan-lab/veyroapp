import { supabase } from '../lib/supabase'
import { db } from '../db/schema'
import { useSession } from '../store/session'
import { compactOutbox, pullCursor, remoteWins, toLocal, toRemote, type RemoteRow } from './merge'
import { LOCAL_ONLY_FIELDS, SYNC_TABLES, type LocalTable } from './tables'

const BATCH = 500
let running: Promise<void> | null = null
let timer: ReturnType<typeof setTimeout> | null = null

async function refreshPending() {
  useSession.getState().setSync({ pending: await db.outbox.count() })
}

/** Agenda uma sincronização logo após uma gravação (agrupa várias em 2 s). */
export function scheduleSync(delayMs = 2000) {
  refreshPending()
  if (!supabase) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delayMs)
}

export function syncNow(): Promise<void> {
  if (!supabase) return Promise.resolve()
  if (running) return running
  running = (async () => {
    const st = useSession.getState()
    const uid = st.user?.id
    if (!uid) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      st.setSync({ state: 'offline' })
      useSession.setState({ bootSynced: true })
      return
    }
    st.setSync({ state: 'syncing', error: undefined })
    try {
      await push(uid)
      await pull(uid)
      st.setSync({ state: 'idle', lastAt: new Date().toISOString() })
    } catch (e) {
      st.setSync({ state: navigator.onLine ? 'error' : 'offline', error: e instanceof Error ? e.message : String(e) })
    } finally {
      await refreshPending()
      if (!useSession.getState().bootSynced) useSession.setState({ bootSynced: true })
    }
  })().finally(() => {
    running = null
  })
  return running
}

async function push(uid: string) {
  const items = await db.outbox.toArray()
  if (!items.length) return
  const maxId = Math.max(...items.map((i) => i.id ?? 0))
  const byTable = new Map<LocalTable, string[]>()
  for (const it of compactOutbox(items)) {
    const t = it.table as LocalTable
    if (!(t in SYNC_TABLES)) continue
    byTable.set(t, [...(byTable.get(t) ?? []), it.rowId])
  }
  for (const [t, ids] of byTable) {
    const rows = (await db.table(t).bulkGet(ids)).filter(Boolean) as Record<string, unknown>[]
    // exercícios/alimentos globais (user_id null) nunca sobem
    const own = rows.filter((r) => r.user_id === uid)
    const payload = own.map((r) => toRemote(r, uid, LOCAL_ONLY_FIELDS[t]))
    for (let i = 0; i < payload.length; i += BATCH) {
      const { error } = await supabase!.from(SYNC_TABLES[t]).upsert(payload.slice(i, i + BATCH), { onConflict: 'id' })
      if (error) throw new Error(`${t}: ${error.message}`)
    }
  }
  await db.outbox.where('id').belowOrEqual(maxId).delete()
}

async function pull(uid: string) {
  for (const t of Object.keys(SYNC_TABLES) as LocalTable[]) {
    const key = `cursor:${uid}:${t}`
    const last = (await db.meta.get(key))?.value as string | undefined
    let since = pullCursor(last)
    let newest = last
    for (;;) {
      const { data, error } = await supabase!
        .from(SYNC_TABLES[t])
        .select('*')
        .gt('server_updated_at', since)
        .order('server_updated_at', { ascending: true })
        .limit(BATCH)
      if (error) throw new Error(`${t}: ${error.message}`)
      const rows = (data ?? []) as RemoteRow[]
      if (!rows.length) break
      const table = db.table(t)
      await db.transaction('rw', [table], async () => {
        const locals = await table.bulkGet(rows.map((r) => r.id))
        const toPut = rows.filter((r, i) => remoteWins(locals[i] as { updated_at?: string }, r)).map(toLocal)
        if (toPut.length) await table.bulkPut(toPut)
      })
      newest = rows[rows.length - 1].server_updated_at
      since = newest
      if (rows.length < BATCH) break
    }
    if (newest) await db.meta.put({ key, value: newest })
  }
}

/** Apaga todos os dados do usuário deste aparelho (ao sair da conta). Mantém os dados globais. */
export async function clearLocalUserData() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of Object.keys(SYNC_TABLES) as LocalTable[]) {
      const table = db.table(t)
      if (t === 'exercises' || t === 'foods') await table.filter((r: { user_id: string | null }) => r.user_id !== null).delete()
      else await table.clear()
    }
    await db.outbox.clear()
    await db.meta.filter((m) => String(m.key).startsWith('cursor:')).delete()
  })
  await refreshPending()
}

/** Exporta todos os dados do usuário (JSON). */
export async function exportUserData(uid: string) {
  const out: Record<string, unknown[]> = {}
  for (const t of Object.keys(SYNC_TABLES) as LocalTable[]) {
    const rows = (await db.table(t).toArray()) as Record<string, unknown>[]
    out[t] = rows.filter((r) => r.user_id === uid).map((r) => {
      const { blob: _b, ...rest } = r
      void _b
      return rest
    })
  }
  return { app: 'VEYRO', exportedAt: new Date().toISOString(), userId: uid, data: out }
}

/** Liga a sincronização automática: ao voltar a internet, ao voltar para o app e a cada 5 min. */
export function startAutoSync() {
  if (!supabase) return () => {}
  const onOnline = () => void syncNow()
  const onVisible = () => document.visibilityState === 'visible' && void syncNow()
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  const iv = setInterval(() => document.visibilityState === 'visible' && void syncNow(), 5 * 60_000)
  void syncNow()
  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(iv)
  }
}
