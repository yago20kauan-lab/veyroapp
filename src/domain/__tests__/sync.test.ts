import { describe, expect, it } from 'vitest'
import { compactOutbox, pullCursor, remoteWins, toLocal, toRemote } from '../../sync/merge'

describe('sincronização', () => {
  it('vence o mais recente', () => {
    expect(remoteWins({ updated_at: '2026-11-19T10:00:00Z' }, { updated_at: '2026-11-19T11:00:00Z' })).toBe(true)
    expect(remoteWins({ updated_at: '2026-11-19T12:00:00Z' }, { updated_at: '2026-11-19T11:00:00Z' })).toBe(false)
  })
  it('linha que não existe localmente sempre entra', () => {
    expect(remoteWins(undefined, { updated_at: '2020-01-01T00:00:00Z' })).toBe(true)
  })
  it('empate fica com o servidor', () => {
    expect(remoteWins({ updated_at: '2026-11-19T10:00:00Z' }, { updated_at: '2026-11-19T10:00:00Z' })).toBe(true)
  })
  it('ida e volta preserva os dados e remove campos locais', () => {
    const local = { id: 'a', user_id: 'u', updated_at: '2026-11-19T10:00:00Z', kg: 97.5, date: '2026-11-19', blob: 'x' }
    const remote = toRemote(local, 'u', ['blob'])
    expect(remote.data).toEqual({ kg: 97.5, date: '2026-11-19' })
    expect(remote.user_id).toBe('u')
    const back = toLocal({ ...remote, deleted_at: null, server_updated_at: 'x' })
    expect(back).toEqual({ id: 'a', user_id: 'u', updated_at: '2026-11-19T10:00:00Z', deleted_at: null, kg: 97.5, date: '2026-11-19' })
  })
  it('toRemote força o user_id da sessão (nunca o da linha)', () => {
    expect(toRemote({ id: 'a', user_id: 'outro', updated_at: 'x' }, 'eu').user_id).toBe('eu')
  })
  it('fila compacta mantém a última operação por linha', () => {
    const out = compactOutbox([
      { id: 1, table: 'sets', rowId: 'a' },
      { id: 2, table: 'sets', rowId: 'b' },
      { id: 3, table: 'sets', rowId: 'a' },
    ])
    expect(out.map((o) => o.id).sort()).toEqual([2, 3])
  })
  it('cursor com folga de 60s', () => {
    expect(pullCursor('2026-11-19T10:01:00.000Z')).toBe('2026-11-19T10:00:00.000Z')
    expect(pullCursor(undefined)).toBe('1970-01-01T00:00:00.000Z')
  })
})
