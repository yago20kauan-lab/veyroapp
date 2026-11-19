import { db, nowIso, uuid } from './schema'
import type { LocalTable } from '../sync/tables'
import { currentUserId } from '../store/session'
import { scheduleSync } from '../sync/engine'

type AnyRow = { id?: string; [k: string]: unknown }

/**
 * Toda gravação de dado do usuário passa por aqui:
 * carimba user_id e updated_at, grava local e coloca na fila de saída.
 */
export async function save<T extends AnyRow>(table: LocalTable, row: T): Promise<T & { id: string }> {
  const full = { ...row, id: row.id ?? uuid(), user_id: currentUserId(), updated_at: nowIso(), deleted_at: row.deleted_at ?? null }
  const t = db.table(table)
  await db.transaction('rw', [t, db.outbox], async () => {
    await t.put(full)
    await db.outbox.add({ table, rowId: full.id, op: 'upsert', at: full.updated_at })
  })
  scheduleSync()
  return full as T & { id: string }
}

/** Exclusão lógica (sincroniza a exclusão para os outros aparelhos). */
export async function remove(table: LocalTable, id: string) {
  const t = db.table(table)
  const at = nowIso()
  await db.transaction('rw', [t, db.outbox], async () => {
    await t.update(id, { deleted_at: at, updated_at: at })
    await db.outbox.add({ table, rowId: id, op: 'delete', at })
  })
  scheduleSync()
}

/** Leitura padrão: só linhas do usuário atual e não excluídas. */
export function mine<T extends { user_id?: string | null; deleted_at?: string | null }>(rows: T[]): T[] {
  const uid = currentUserId()
  return rows.filter((r) => r.user_id === uid && !r.deleted_at)
}
