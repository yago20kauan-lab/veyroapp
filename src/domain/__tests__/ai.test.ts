import { describe, expect, it } from 'vitest'
import { parseAdapt, parseBuild, safeKcal } from '../../ai/schemas'
import { aiAvailability } from '../../lib/ai'

const lib = new Set(['supino-reto-barra', 'agachamento-livre', 'remada-baixa'])
const ok = { name: 'Plano IA', routines: [{ name: 'A', weekday: 1, items: [{ exerciseId: 'supino-reto-barra', sets: 3, repMin: 12, repMax: 8, restSec: 120 }] }] }

describe('validação da IA', () => {
  it('aceita rotina válida e corrige repMin > repMax', () => {
    const r = parseBuild(ok, lib)
    expect(r.routines[0].items[0]).toMatchObject({ repMin: 8, repMax: 12 })
  })
  it('rejeita exercício fora da biblioteca', () => {
    const bad = { ...ok, routines: [{ ...ok.routines[0], items: [{ ...ok.routines[0].items[0], exerciseId: 'inventado' }] }] }
    expect(() => parseBuild(bad, lib)).toThrow(/fora da biblioteca/)
  })
  it('rejeita formato errado', () => {
    expect(() => parseAdapt({ items: [{ exerciseId: 'remada-baixa', sets: 20, repMin: 8, repMax: 12, restSec: 60 }] }, lib)).toThrow()
  })
  it('nunca abaixo do piso de calorias', () => {
    expect(safeKcal(1200, 'm')).toBe(1600)
    expect(safeKcal(1100, 'f')).toBe(1300)
    expect(safeKcal(2300)).toBe(2300)
  })
  it('sem conta/sem internet: IA indisponível, sem quebrar', () => {
    expect(aiAvailability().ok).toBe(false)
  })
})
