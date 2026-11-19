import { describe, expect, it } from 'vitest'
import { massSplit, navyBodyFat } from '../bodycomp'
import { weeklyRecommendation, type CheckinInput } from '../checkin'

describe('composição corporal (Marinha)', () => {
  it('homem 180 cm, cintura 100, pescoço 40 ≈ 25%', () => {
    expect(navyBodyFat('m', 180, 100, 40)).toBeCloseTo(25.2, 0)
  })
  it('mulher exige quadril', () => {
    expect(navyBodyFat('f', 165, 75, 33)).toBeNull()
    expect(navyBodyFat('f', 165, 75, 33, 100)).toBeGreaterThan(20)
  })
  it('massa magra e gorda', () => {
    expect(massSplit(97.5, 25)).toEqual({ fatKg: 24.4, leanKg: 73.1 })
  })
})

describe('check-in semanal', () => {
  const base: CheckinInput = { weightKg: 97, rateNow: -0.6, ratePrev: -0.6, hunger: 3, sleep: 3, energy: 3, strengthDrops: 0, goal: 'cut' }
  it('ritmo ideal → mantém', () => expect(weeklyRecommendation(base).code).toBe('manter'))
  it('parado 2 semanas → cardio primeiro', () => expect(weeklyRecommendation({ ...base, rateNow: -0.1, ratePrev: -0.1 }).code).toBe('cardio'))
  it('parado de novo após cardio → −200 kcal', () => {
    const r = weeklyRecommendation({ ...base, rateNow: -0.1, ratePrev: -0.1, lastApplied: 'cardio' })
    expect(r.code).toBe('menos-kcal')
    expect(r.kcalDelta).toBe(-200)
  })
  it('perda > 1 kg/sem 2 semanas → +150 kcal', () => expect(weeklyRecommendation({ ...base, rateNow: -1.3, ratePrev: -1.2 }).kcalDelta).toBe(150))
  it('força caindo em mais de 3 exercícios → +150 kcal', () => expect(weeklyRecommendation({ ...base, strengthDrops: 4 }).code).toBe('mais-kcal'))
  it('fome alta e sono ruim → sono antes de cortar', () => expect(weeklyRecommendation({ ...base, rateNow: -0.1, ratePrev: -0.1, hunger: 5, sleep: 1 }).code).toBe('sono'))
  it('sem dados', () => expect(weeklyRecommendation({ ...base, rateNow: null }).code).toBe('dados'))
})
