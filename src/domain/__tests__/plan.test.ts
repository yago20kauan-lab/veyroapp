import { describe, expect, it } from 'vitest'
import { currentPhase, nextMonday, planWeek, routineForDay, sequencePhases } from '../plan'

describe('plano', () => {
  it('semana do plano', () => {
    expect(planWeek('2026-11-23', new Date('2026-11-22T10:00'))).toBe(0)
    expect(planWeek('2026-11-23', new Date('2026-11-23T10:00'))).toBe(1)
    expect(planWeek('2026-11-23', new Date('2026-11-29T23:00'))).toBe(1)
    expect(planWeek('2026-11-23', new Date('2026-11-30T08:00'))).toBe(2)
  })
  it('fases em sequência: retorno 4 semanas, depois normal', () => {
    const ph = sequencePhases(
      [
        { id: 'r', name: 'Retorno', type: 'return' as const, weeks: 4, rules: [{ week: 1, pct: 0.55, sets: '2', rpeMax: 7 }, { week: 4, pct: 0.9, sets: '3-4', rpeMax: 9 }] },
        { id: 'n', name: 'Normal', type: 'normal' as const, weeks: null, rules: [] },
      ],
      '2026-11-23',
    )
    expect(ph[1].startDate).toBe('2026-12-21')
    expect(currentPhase(ph, new Date('2026-11-24T12:00'))?.rule?.pct).toBe(0.55)
    const w4 = currentPhase(ph, new Date('2026-12-15T12:00'))
    expect(w4?.phase.id).toBe('r')
    expect(w4?.week).toBe(4)
    const after = currentPhase(ph, new Date('2026-12-22T12:00'))
    expect(after?.phase.id).toBe('n')
    expect(after?.week).toBe(1)
    expect(currentPhase(ph, new Date('2026-11-20T12:00'))).toBeNull()
  })
  it('treino do dia troca de divisão na semana 3', () => {
    const rs = [
      { id: 'sup', name: 'Superior', weekday: 1, fromWeek: 1 },
      { id: 'push', name: 'Push', weekday: 1, fromWeek: 3 },
      { id: 'inf', name: 'Inferior', weekday: 2, fromWeek: 1 },
    ]
    expect(routineForDay(rs, 1, 1)?.id).toBe('sup')
    expect(routineForDay(rs, 1, 2)?.id).toBe('sup')
    expect(routineForDay(rs, 1, 3)?.id).toBe('push')
    expect(routineForDay(rs, 0, 3)).toBeNull()
    expect(routineForDay(rs, 2, 9)?.id).toBe('inf')
  })
  it('próxima segunda', () => {
    expect(nextMonday(new Date('2026-11-19T10:00'))).toBe('2026-11-23')
    expect(nextMonday(new Date('2026-11-23T10:00'))).toBe('2026-11-23')
  })
})
