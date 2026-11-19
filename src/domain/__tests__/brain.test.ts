import { describe, expect, it } from 'vitest'
import { platesPerSide, roundToStep, targetForToday, warmupSets, type PastSession, type TargetInput } from '../progression'
import { detectPRs, e1rm, headline, recomputeAll, sessionVolumePR, type RecSet } from '../records'
import { effectiveSetsByMuscle, setVolume, totalVolume } from '../volume'
import { emaTrend, weeklyRate, weeksToGoal } from '../trend'

const supino = { name: 'Supino reto com barra', kind: 'weight' as const, stepKg: 0.5, incrementKg: 2.5, isCompound: true }
const item = { sets: 4, repMin: 8, repMax: 12 }
const today = new Date('2026-11-20T19:00:00')
const sess = (date: string, ...sets: [number, number, number?][]): PastSession => ({
  date,
  sets: sets.map(([kg, reps, rpe]) => ({ kg, reps, rpe, type: 'normal' })),
})
const run = (p: Partial<TargetInput>) => targetForToday({ exercise: supino, item, history: [], today, ...p })

describe('ALVO DE HOJE · Modo Retorno', () => {
  const rules = [
    [1, 0.55, 49.5],
    [2, 0.7, 63],
    [3, 0.8, 72],
    [4, 0.9, 81],
  ] as const
  for (const [week, pct, kg] of rules) {
    it(`semana ${week}: ${pct * 100}% de 90 kg = ${kg} kg`, () => {
      const t = run({ phase: { type: 'return', week, pct, sets: '3', rpeMax: 8 }, oldKg: 90 })
      expect(t.kg).toBe(kg)
      expect(t.kind).toBe('return')
      expect(t.reason).toContain(`Semana ${week} do retorno`)
    })
  }
  it('sem carga antiga: pede calibração na 1ª série', () => {
    const t = run({ phase: { type: 'return', week: 1, pct: 0.55 } })
    expect(t.kg).toBeNull()
    expect(t.kind).toBe('calibrate')
  })
  it('retorno sem carga antiga mas com histórico: progride pelo histórico com as séries da fase', () => {
    const t = run({ phase: { type: 'return', week: 2, pct: 0.7, sets: '3', rpeMax: 7.5 }, history: [sess('2026-11-17', [20, 12], [20, 12])] })
    expect(t.kind).toBe('up')
    expect(t.kg).toBe(22.5)
    expect(t.sets).toBe(3)
    expect(t.rpeMax).toBe(7.5)
  })
  it('séries da fase ("3-4" → 4)', () => {
    expect(run({ phase: { type: 'return', week: 4, pct: 0.9, sets: '3-4' }, oldKg: 90 }).sets).toBe(4)
  })
})

describe('ALVO DE HOJE · progressão dupla', () => {
  it('primeira vez: sem carga sugerida', () => {
    expect(run({}).kind).toBe('first')
  })
  it('4×12 com PSE 8 → +2,5 kg', () => {
    const t = run({ history: [sess('2026-11-17', [60, 12, 8], [60, 12, 8], [60, 12, 8], [60, 12, 8])] })
    expect(t.kg).toBe(62.5)
    expect(t.kind).toBe('up')
    expect(t.reason).toBe('+2,5 kg: você fez 4×12 da última vez')
  })
  it('topo da faixa mas PSE ≥ 9,5 → mantém', () => {
    const t = run({ history: [sess('2026-11-17', [60, 12, 10], [60, 12, 9.5], [60, 12, 9.5], [60, 12, 9.5])] })
    expect(t.kg).toBe(60)
    expect(t.kind).toBe('hold')
  })
  it('dentro da faixa → mantém e busca +1 rep', () => {
    const t = run({ history: [sess('2026-11-17', [60, 10], [60, 9], [60, 9], [60, 8])] })
    expect(t.kg).toBe(60)
    expect(t.kind).toBe('more-reps')
  })
  it('uma série abaixo de 8 → mantém', () => {
    const t = run({ history: [sess('2026-11-17', [60, 9], [60, 8], [60, 7], [60, 6])] })
    expect(t.kg).toBe(60)
    expect(t.kind).toBe('hold')
  })
  it('2 sessões seguidas abaixo da faixa → −5%', () => {
    const t = run({ history: [sess('2026-11-13', [60, 8], [60, 7]), sess('2026-11-17', [60, 8], [60, 6])] })
    expect(t.kg).toBe(57)
    expect(t.kind).toBe('deload')
  })
  it('aquecimento não conta para a decisão', () => {
    const h: PastSession = { date: '2026-11-17', sets: [{ kg: 30, reps: 5, type: 'warmup' }, ...sess('', [60, 12], [60, 12]).sets] }
    expect(run({ history: [h] }).kg).toBe(62.5)
  })
})

describe('ALVO DE HOJE · pausas e prontidão', () => {
  it('11 dias sem o exercício → −10%', () => {
    const t = run({ history: [sess('2026-11-09', [80, 10])] })
    expect(t.kg).toBe(72)
    expect(t.kind).toBe('gap')
  })
  it('25 dias sem → −15%', () => {
    expect(run({ history: [sess('2026-10-26', [80, 10])] }).kg).toBe(68)
  })
  it('prontidão < 50 → −10% e 1 série a menos', () => {
    const t = run({ history: [sess('2026-11-17', [60, 10])], readiness: 40 })
    expect(t.kg).toBe(54)
    expect(t.sets).toBe(3)
  })
  it('prontidão 50–74 → não sobe a carga', () => {
    const t = run({ history: [sess('2026-11-17', [60, 12], [60, 12])], readiness: 60 })
    expect(t.kg).toBe(60)
    expect(t.kind).toBe('hold')
  })
  it('cardio e tempo: sem carga', () => {
    expect(targetForToday({ exercise: { ...supino, kind: 'cardio' }, item, history: [] }).kg).toBeNull()
    expect(targetForToday({ exercise: { ...supino, kind: 'time' }, item, history: [] }).kg).toBeNull()
  })
})

describe('deload', () => {
  it('semana de deload: −40% de séries e sem subir carga', () => {
    const t = run({ phase: { type: 'deload', week: 1 }, history: [sess('2026-11-17', [60, 12], [60, 12], [60, 12], [60, 12])] })
    expect(t.sets).toBe(2)
    expect(t.kg).toBe(60)
    expect(t.kind).toBe('hold')
  })
})

describe('ferramentas', () => {
  it('arredonda para o passo do equipamento', () => {
    expect(roundToStep(63.24, 0.5)).toBe(63)
    expect(roundToStep(63.3, 0.5)).toBe(63.5)
    expect(roundToStep(13.4, 2)).toBe(14)
  })
  it('aquecimento 40/60/80%', () => {
    expect(warmupSets(100, 2.5, 20)).toEqual([{ kg: 40, reps: 10 }, { kg: 60, reps: 5 }, { kg: 80, reps: 2 }])
  })
  it('anilhas: 100 kg com barra de 20 → 25 + 15 por lado', () => {
    expect(platesPerSide(100)).toEqual({ plates: [25, 15], remainder: 0 })
    expect(platesPerSide(62.5)).toEqual({ plates: [20, 1.25], remainder: 0 })
  })
})

describe('recordes', () => {
  let n = 0
  const s = (sessionId: string, day: string, kg: number, reps: number, type: RecSet['type'] = 'normal'): RecSet => ({
    id: `s${++n}`, sessionId, completedAt: `2026-11-${day}T19:00:00Z`, kg, reps, type,
  })

  it('1RM estimado (Epley) só de 1 a 12 reps', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1)
    expect(e1rm(100, 13)).toBeNull()
  })
  it('primeira sessão é linha de base: nenhum recorde', () => {
    const a = s('A', '10', 60, 10)
    const b = s('A', '10', 65, 10)
    expect(detectPRs(b, [a])).toEqual([])
  })
  it('segunda sessão melhor → recorde de carga', () => {
    const prs = detectPRs(s('B', '13', 70, 8), [s('A', '10', 63.5, 8)])
    expect(headline(prs)?.type).toBe('max_kg')
    expect(headline(prs)?.delta).toBeCloseTo(6.5)
  })
  it('mais reps com a mesma carga', () => {
    const prs = detectPRs(s('B', '13', 60, 11), [s('A', '10', 60, 10)])
    expect(prs.map((p) => p.type)).toContain('reps_at_kg')
  })
  it('aquecimento nunca vira recorde nem serve de base', () => {
    expect(detectPRs(s('B', '13', 200, 5, 'warmup'), [s('A', '10', 60, 10)])).toEqual([])
    expect(detectPRs(s('B', '13', 50, 10), [s('A', '10', 100, 1, 'warmup')])).toEqual([])
  })
  it('Modo Retorno: só conta acima da carga antiga', () => {
    expect(detectPRs(s('B', '13', 70, 10), [s('A', '10', 60, 10)], { returnBaselineKg: 90 })).toEqual([])
    expect(detectPRs(s('B', '13', 92.5, 5), [s('A', '10', 60, 10)], { returnBaselineKg: 90 }).length).toBeGreaterThan(0)
  })
  it('recorde por faixa de reps', () => {
    const prs = detectPRs(s('B', '13', 80, 5), [s('A', '10', 100, 1), s('A', '10', 75, 5)])
    expect(prs.find((p) => p.type === 'rep_range')?.reps).toBe(5)
  })
  it('apagar a série do recorde recalcula tudo', () => {
    const a = s('A', '10', 60, 8)
    const b = s('B', '13', 70, 8)
    const c = s('C', '16', 65, 8)
    expect([...recomputeAll([a, b, c]).keys()]).toEqual([b.id]) // c não é recorde
    const semB = recomputeAll([a, c])
    expect([...semB.keys()]).toEqual([c.id]) // sem b, c vira recorde
  })
  it('volume da sessão', () => {
    expect(sessionVolumePR(5000, [])).toBeNull()
    expect(sessionVolumePR(5000, [4000, 4500])?.delta).toBe(500)
  })
})

describe('volume', () => {
  const ex = new Map([
    ['supino', { equipment: 'barbell' as const, isUnilateral: false, primaryMuscle: 'peito' as const, secondaryMuscles: ['triceps' as const, 'ombros' as const] }],
    ['halter', { equipment: 'dumbbell' as const, isUnilateral: false, primaryMuscle: 'peito' as const, secondaryMuscles: [] }],
  ])
  it('kg × reps; halteres contam os 2; aquecimento fora', () => {
    expect(setVolume({ exerciseId: 'supino', kg: 60, reps: 10 }, ex.get('supino'))).toBe(600)
    expect(setVolume({ exerciseId: 'halter', kg: 20, reps: 10 }, ex.get('halter'))).toBe(400)
    expect(totalVolume([{ exerciseId: 'supino', kg: 40, reps: 10, type: 'warmup' }, { exerciseId: 'supino', kg: 60, reps: 10 }], ex)).toBe(600)
  })
  it('séries efetivas: principal 1, secundário 0,5', () => {
    const m = effectiveSetsByMuscle([{ exerciseId: 'supino', kg: 60, reps: 10 }, { exerciseId: 'supino', kg: 60, reps: 10 }], ex)
    expect(m.get('peito')).toBe(2)
    expect(m.get('triceps')).toBe(1)
  })
})

describe('tendência do peso', () => {
  it('EMA não pula com um dia de +1,5 kg', () => {
    const t = emaTrend([
      { date: '2026-11-01', kg: 97 },
      { date: '2026-11-02', kg: 97 },
      { date: '2026-11-03', kg: 98.5 },
    ])
    expect(t[2].trend).toBeCloseTo(97.15, 2)
  })
  it('ritmo só aparece com 14+ dias de dados', () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, kg: 98 - i * 0.1 }))
    expect(weeklyRate(emaTrend(pts))).toBeNull()
  })
  it('ritmo negativo numa perda constante e previsão da meta', () => {
    const pts = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10)
      return { date: d, kg: 98 - i * 0.1 }
    })
    const tr = emaTrend(pts, 0.3)
    const rate = weeklyRate(tr)!
    expect(rate).toBeLessThan(-0.5)
    expect(rate).toBeGreaterThan(-0.8)
    expect(weeksToGoal(tr.at(-1)!.trend, 88, rate)).toBeGreaterThan(10)
    expect(weeksToGoal(95, 100, -0.5)).toBeNull()
  })
})
