/**
 * ALVO DE HOJE (A8). Lógica pura, sem banco: recebe o histórico e devolve a carga sugerida + o motivo.
 */
import type { Exercise, RoutineItem } from '../db/schema'

export type WorkSet = { kg?: number; reps?: number; rpe?: number; type?: 'warmup' | 'normal' | 'drop' | 'failure' }
export type PastSession = { date: string; sets: WorkSet[] }

export type PhaseRule = { type: 'return' | 'normal' | 'deload'; week: number; pct?: number; sets?: string; rpeMax?: number }

export type TargetInput = {
  exercise: Pick<Exercise, 'name' | 'kind' | 'stepKg' | 'incrementKg' | 'isCompound'>
  item: Pick<RoutineItem, 'sets' | 'repMin' | 'repMax'>
  /** sessões anteriores deste exercício, da mais antiga para a mais recente */
  history: PastSession[]
  phase?: PhaseRule | null
  /** carga antiga informada no Modo Retorno */
  oldKg?: number
  /** prontidão 0–100 de hoje */
  readiness?: number
  today?: Date
}

export type TargetKind = 'return' | 'calibrate' | 'first' | 'up' | 'hold' | 'more-reps' | 'deload' | 'gap' | 'none'

export type Target = {
  kg: number | null
  repMin: number
  repMax: number
  sets: number
  rpeMax?: number
  kind: TargetKind
  reason: string
}

const DAY = 86_400_000
export const fmtKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(n * 10 === Math.round(n * 10) ? 1 : 2)).replace('.', ',')

export function roundToStep(x: number, step: number) {
  if (!step || step <= 0) return Math.round(x * 100) / 100
  return Math.round(Math.round(x / step) * step * 100) / 100
}

const working = (s: PastSession) => s.sets.filter((x) => (x.type ?? 'normal') !== 'warmup' && x.reps != null)

/** Carga de trabalho da sessão = maior carga entre as séries válidas. */
export function workingKg(s: PastSession): number | undefined {
  const ks = working(s).map((x) => x.kg ?? 0)
  return ks.length ? Math.max(...ks) : undefined
}

function belowRange(s: PastSession, repMin: number) {
  const kg = workingKg(s)
  return working(s).some((x) => (x.kg ?? 0) >= (kg ?? 0) && (x.reps ?? 0) < repMin)
}

function avgRpe(s: PastSession) {
  const r = working(s).map((x) => x.rpe).filter((x): x is number => x != null)
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : undefined
}

/** Séries planejadas: na fase de retorno, as séries da semana (ex.: "3-4" → 4). */
export function plannedSets(item: Pick<RoutineItem, 'sets'>, phase?: Pick<PhaseRule, 'type' | 'sets'> | null) {
  return phase?.type === 'return' && phase.sets ? parseSets(phase.sets, item.sets) : item.sets
}

function parseSets(spec: string | undefined, fallback: number) {
  if (!spec) return fallback
  const n = spec.split('-').map(Number).filter((x) => !Number.isNaN(x))
  return n.length ? Math.max(...n) : fallback
}

export function targetForToday(input: TargetInput): Target {
  const { exercise: ex, item, history, phase, oldKg, readiness, today = new Date() } = input
  const base = { repMin: item.repMin, repMax: item.repMax, sets: plannedSets(item, phase), rpeMax: phase?.rpeMax }
  const step = ex.stepKg || 0.5

  if (ex.kind === 'cardio') return { ...base, kg: null, kind: 'none', reason: 'Cardio: siga o tempo planejado' }
  if (ex.kind === 'time') return { ...base, kg: null, kind: 'none', reason: 'Segure o tempo planejado com boa postura' }

  let t: Target

  // 1) Modo Retorno: percentual da carga antiga
  const hasHistory = history.some((s) => working(s).length > 0)
  if (phase?.type === 'return' && phase.pct && (oldKg || !hasHistory)) {
    const sets = parseSets(phase.sets, item.sets)
    if (!oldKg) {
      t = { ...base, sets, kg: null, kind: 'calibrate', reason: 'Quanto você usava antes? Informe na 1ª série' }
    } else {
      const kg = roundToStep(oldKg * phase.pct, step)
      t = { ...base, sets, kg, kind: 'return', reason: `Semana ${phase.week} do retorno: ${Math.round(phase.pct * 100)}% dos seus ${fmtKg(oldKg)} kg` }
    }
    return applyReadiness(t, readiness, step)
  }

  const valid = history.filter((s) => working(s).length > 0)
  const last = valid.at(-1)
  if (!last) {
    return { ...base, kg: null, kind: 'first', reason: 'Primeira vez: escolha uma carga confortável' }
  }
  const lastKg = workingKg(last) ?? 0
  const isBodyweightOnly = ex.kind === 'bodyweight_plus' && !ex.incrementKg

  // 2) Pausa longa
  const daysOff = Math.floor((today.getTime() - Date.parse(last.date)) / DAY)
  if (!isBodyweightOnly && lastKg > 0 && daysOff > 21) {
    t = { ...base, kg: roundToStep(lastKg * 0.85, step), kind: 'gap', reason: `${daysOff} dias sem este exercício: −15%` }
    return applyReadiness(t, readiness, step)
  }
  if (!isBodyweightOnly && lastKg > 0 && daysOff > 10) {
    t = { ...base, kg: roundToStep(lastKg * 0.9, step), kind: 'gap', reason: `${daysOff} dias sem este exercício: −10%` }
    return applyReadiness(t, readiness, step)
  }

  const sets = working(last)
  const allTop = sets.length > 0 && sets.every((x) => (x.reps ?? 0) >= item.repMax)
  const anyBelow = belowRange(last, item.repMin)
  const rpe = avgRpe(last)
  const rpeHigh = rpe != null && rpe >= 9.5
  const best = `${sets.length}×${Math.min(...sets.map((x) => x.reps ?? 0))}`

  // 3) Exercícios só com peso corporal (flexão, abdominal): progride em reps
  if (isBodyweightOnly) {
    return { ...base, kg: lastKg || null, kind: 'more-reps', reason: allTop ? 'Topo da faixa: suba a meta de reps' : 'Tente +1 rep por série' }
  }

  // 4) Progressão dupla
  if (allTop && !rpeHigh) {
    const inc = ex.incrementKg || step
    t = { ...base, kg: roundToStep(lastKg + inc, step), kind: 'up', reason: `+${fmtKg(inc)} kg: você fez ${best} da última vez` }
  } else if (allTop && rpeHigh) {
    t = { ...base, kg: lastKg, kind: 'hold', reason: `Mantém: bateu as reps, mas no limite (PSE ${fmtKg(Math.round(rpe! * 10) / 10)})` }
  } else if (anyBelow) {
    const prev = valid.at(-2)
    const prevBelow = prev && (workingKg(prev) ?? 0) >= lastKg && belowRange(prev, item.repMin)
    if (prevBelow) {
      t = { ...base, kg: roundToStep(lastKg * 0.95, step), kind: 'deload', reason: 'Ajuste −5% para voltar a progredir' }
    } else {
      t = { ...base, kg: lastKg, kind: 'hold', reason: `Mantém: buscar ${item.repMin}+ reps em todas` }
    }
  } else {
    t = { ...base, kg: lastKg, kind: 'more-reps', reason: 'Mantém: tente +1 rep por série' }
  }
  return applyReadiness(t, readiness, step, lastKg)
}

/** Prontidão (A7 item 13): <50 → −10% e −1 série; 50–74 → não sobe carga hoje. */
function applyReadiness(t: Target, readiness: number | undefined, step: number, lastKg?: number): Target {
  if (readiness == null || t.kg == null) return t
  if (readiness < 50) {
    return {
      ...t,
      kg: roundToStep(t.kg * 0.9, step),
      sets: Math.max(1, t.sets - 1),
      rpeMax: Math.min(t.rpeMax ?? 8, 8),
      reason: `Prontidão baixa (${readiness}): treino leve, −10% e 1 série a menos`,
    }
  }
  if (readiness < 75 && t.kind === 'up') {
    return { ...t, kg: lastKg ?? t.kg, kind: 'hold', rpeMax: Math.min(t.rpeMax ?? 8, 8), reason: `Prontidão moderada (${readiness}): hoje sem subir carga` }
  }
  return t
}

/** Aquecimento automático: 40%×10, 60%×5, 80%×2 do alvo (só compostos). */
export function warmupSets(targetKg: number, step: number, barKg = 0) {
  return [
    [0.4, 10],
    [0.6, 5],
    [0.8, 2],
  ].map(([p, reps]) => ({ kg: Math.max(barKg, roundToStep(targetKg * p, step)), reps }))
}

/** Calculadora de anilhas: anilhas por lado para chegar na carga total. */
export function platesPerSide(totalKg: number, barKg = 20, available = [25, 20, 15, 10, 5, 2.5, 1.25]) {
  let side = Math.round(((totalKg - barKg) / 2) * 100) / 100
  const plates: number[] = []
  if (side <= 0) return { plates, remainder: 0 }
  for (const p of [...available].sort((a, b) => b - a)) {
    while (side + 1e-9 >= p) {
      plates.push(p)
      side = Math.round((side - p) * 100) / 100
    }
  }
  return { plates, remainder: side }
}
