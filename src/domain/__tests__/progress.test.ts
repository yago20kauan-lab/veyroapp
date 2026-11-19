import { describe, expect, it } from 'vitest'
import { evaluateGoal, slopePerDay } from '../goals'
import { isPlateau, mondayOf, unlockedCodes, weeklyStreak } from '../achievements'

const pts = (n: number, start: number, perDay: number) => Array.from({ length: n }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), value: start + perDay * i }))

describe('metas', () => {
  it('inclinação', () => expect(slopePerDay(pts(20, 97, -0.1))).toBeCloseTo(-0.1))
  it('meta de peso (descer): progresso e previsão', () => {
    const p = pts(28, 97, -0.1)
    const r = evaluateGoal(97, 88, p.at(-1)!.value, p, undefined, new Date('2026-10-28T12:00'))
    expect(r.progress).toBeCloseTo(0.3, 1)
    expect(r.status).toBe('no-ritmo')
    expect(r.etaDate).toBe('2026-12-30')
  })
  it('meta de carga (subir) concluída', () => {
    expect(evaluateGoal(80, 100, 101, []).status).toBe('concluida')
  })
  it('sem 14 dias: sem previsão', () => {
    expect(evaluateGoal(97, 88, 96, pts(5, 97, -0.2)).status).toBe('sem-dados')
  })
  it('atrasada quando a previsão passa do prazo', () => {
    const p = pts(28, 97, -0.05)
    expect(evaluateGoal(97, 88, p.at(-1)!.value, p, '2026-11-15', new Date('2026-10-28T12:00')).status).toBe('atrasada')
  })
})

describe('medalhas e sequência', () => {
  it('desbloqueios', () => {
    const c = unlockedCodes({ setsCount: 5, workouts: 12, prs: 1, perfectWeeks: 0, trendDrop: 2.4, waistDrop: 1, weighIns: 10, returnDone: false })
    expect(c).toEqual(['first-set', 'w10', 'pr1', 'kg-2'])
  })
  it('segunda-feira da semana', () => {
    expect(mondayOf('2026-11-19')).toBe('2026-11-16')
    expect(mondayOf('2026-11-22')).toBe('2026-11-16')
  })
  it('sequência semanal com 80% (4 de 5)', () => {
    const dates = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16']
    const r = weeklyStreak(dates, 5, new Date('2026-11-19T12:00'))
    expect(r.streak).toBe(2) // semana atual (1 treino) ainda não conta, mas não quebra
    expect(r.perfectWeeks).toBe(1)
  })
  it('platô após 4 sessões sem subir o 1RM', () => {
    expect(isPlateau([100, 105, 108, 108, 107, 108, 106])).toBe(true)
    expect(isPlateau([100, 105, 108, 109])).toBe(false)
  })
})
