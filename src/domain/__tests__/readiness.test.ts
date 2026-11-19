import { describe, expect, it } from 'vitest'
import { muscleFatigue, readinessAdvice, readinessScore, shouldDeload } from '../readiness'

describe('prontidão', () => {
  it('check-in perfeito = 100, péssimo = 0', () => {
    expect(readinessScore({ sleep: 5, soreness: 1, energy: 5 }).score).toBe(100)
    expect(readinessScore({ sleep: 1, soreness: 5, energy: 1 }).score).toBe(0)
  })
  it('redistribui o peso quando falta dado', () => {
    const r = readinessScore({ sleep: 3, soreness: 3, energy: 3, sleepHours: 8 })
    expect(r.parts.map((p) => p.key)).toEqual(['checkin', 'sono'])
    expect(r.parts.reduce((a, p) => a + p.w, 0)).toBeCloseTo(1)
    expect(r.score).toBe(Math.round((0.4 / 0.7) * 50 + (0.3 / 0.7) * 100))
  })
  it('carga alta reduz a nota; FC de repouso alta tira 10', () => {
    const base = readinessScore({ sleep: 5, soreness: 1, energy: 5, loadRatio: 1 }).score
    const alto = readinessScore({ sleep: 5, soreness: 1, energy: 5, loadRatio: 2 }).score
    expect(alto).toBeLessThan(base)
    expect(readinessScore({ sleep: 5, soreness: 1, energy: 5, restingHr: 70, restingHrBaseline: 60 }).score).toBe(90)
  })
  it('faixas de recomendação', () => {
    expect(readinessAdvice(80).level).toBe('alta')
    expect(readinessAdvice(60).level).toBe('media')
    expect(readinessAdvice(40).level).toBe('baixa')
  })
})

describe('fadiga muscular', () => {
  const ex = new Map([['supino', { primaryMuscle: 'peito' as const, secondaryMuscles: ['triceps' as const] }]])
  const now = Date.parse('2026-11-20T12:00:00Z')
  it('decai com meia-vida de 48 h', () => {
    const sets = Array.from({ length: 6 }, () => ({ exerciseId: 'supino', completedAt: '2026-11-20T12:00:00Z' }))
    expect(muscleFatigue(sets, ex, now).get('peito')).toBe(1)
    const old = sets.map((s) => ({ ...s, completedAt: '2026-11-18T12:00:00Z' }))
    expect(muscleFatigue(old, ex, now).get('peito')).toBe(0.5)
    expect(muscleFatigue(old, ex, now).get('triceps')).toBe(0.25)
  })
})

describe('deload', () => {
  it('sugere após 7 semanas ou 3 dias de prontidão baixa', () => {
    expect(shouldDeload(7, 0).yes).toBe(true)
    expect(shouldDeload(3, 3).yes).toBe(true)
    expect(shouldDeload(3, 1).yes).toBe(false)
  })
})
