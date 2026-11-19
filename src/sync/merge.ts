/** Regras puras da sincronização (testadas). */

export type RemoteRow = {
  id: string
  user_id: string
  data: Record<string, unknown>
  updated_at: string
  deleted_at: string | null
  server_updated_at: string
}

type LocalLike = { updated_at?: string } | undefined

/** Vence a versão mais recente. Empate: fica a do servidor (todos os aparelhos convergem). */
export function remoteWins(local: LocalLike, remote: Pick<RemoteRow, 'updated_at'>): boolean {
  if (!local?.updated_at) return true
  return Date.parse(remote.updated_at) >= Date.parse(local.updated_at)
}

/** Linha local a partir da remota. */
export function toLocal(r: RemoteRow): Record<string, unknown> {
  return { ...r.data, id: r.id, user_id: r.user_id, updated_at: r.updated_at, deleted_at: r.deleted_at }
}

/** Linha remota a partir da local, sem os campos que só existem no aparelho. */
export function toRemote(row: Record<string, unknown>, userId: string, localOnly: string[] = []) {
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id' || k === 'user_id' || k === 'updated_at' || k === 'deleted_at' || localOnly.includes(k)) continue
    if (v === undefined) continue
    data[k] = v
  }
  return {
    id: row.id as string,
    user_id: userId,
    data,
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
    deleted_at: (row.deleted_at as string | null | undefined) ?? null,
  }
}

/** Fila de saída: mantém só a última operação de cada linha. */
export function compactOutbox<T extends { table: string; rowId: string; id?: number }>(items: T[]): T[] {
  const last = new Map<string, T>()
  for (const it of items) last.set(`${it.table}:${it.rowId}`, it)
  return [...last.values()]
}

/** Cursor de leitura com folga (60 s) para não perder linhas gravadas em paralelo. */
export function pullCursor(last: string | undefined, overlapMs = 60_000): string {
  if (!last) return '1970-01-01T00:00:00.000Z'
  return new Date(Date.parse(last) - overlapMs).toISOString()
}
