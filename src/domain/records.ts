/**
 * Recordes (A8). Lógica pura.
 * - 1RM estimado (Epley) só para 1–12 reps; aquecimento nunca conta.
 * - A primeira sessão de um exercício é linha de base: nenhum recorde.
 * - No Modo Retorno, só vale recorde acima da carga antiga.
 */

export type RecSet = {
  id: string
  sessionId: string
  completedAt: string
  kg?: number
  reps?: number
  type?: 'warmup' | 'normal' | 'drop' | 'failure'
}

export type PRType = 'max_kg' | 'e1rm' | 'reps_at_kg' | 'rep_range' | 'session_volume'
export type PR = { type: PRType; value: number; previous: number; delta: number; reps?: number; label: string }

export const REP_BUCKETS = [1, 3, 5, 8, 10, 12] as const

export function e1rm(kg: number, reps: number): number | null {
  if (!kg || reps < 1 || reps > 12) return null
  return reps === 1 ? kg : kg * (1 + reps / 30)
}

const counts = (s: RecSet) => (s.type ?? 'normal') !== 'warmup' && (s.reps ?? 0) > 0

type Opts = { bodyweightKg?: number; returnBaselineKg?: number }

/** Recordes de uma série nova, comparada com todas as séries anteriores do mesmo exercício. */
export function detectPRs(set: RecSet, prior: RecSet[], opts: Opts = {}): PR[] {
  if (!counts(set)) return []
  const before = prior.filter(counts)
  // linha de base: precisa existir pelo menos uma sessão ANTERIOR
  if (!before.some((s) => s.sessionId !== set.sessionId)) return []
  const kg = (set.kg ?? 0) + (opts.bodyweightKg ?? 0)
  const reps = set.reps ?? 0
  if (opts.returnBaselineKg != null && (set.kg ?? 0) <= opts.returnBaselineKg) return []

  const prs: PR[] = []
  const load = (s: RecSet) => (s.kg ?? 0) + (opts.bodyweightKg ?? 0)

  const maxKg = Math.max(...before.map(load))
  if (kg > maxKg) prs.push({ type: 'max_kg', value: kg, previous: maxKg, delta: kg - maxKg, reps, label: `+${fmt(kg - maxKg)} kg` })

  const cur = e1rm(kg, reps)
  const prevE = before.map((s) => e1rm(load(s), s.reps ?? 0)).filter((x): x is number => x != null)
  if (cur != null && prevE.length && cur > Math.max(...prevE) + 0.05) {
    const p = Math.max(...prevE)
    prs.push({ type: 'e1rm', value: cur, previous: p, delta: cur - p, label: `+${fmt(cur - p)} kg no 1RM est.` })
  }

  const sameOrMore = before.filter((s) => load(s) >= kg)
  if (sameOrMore.length) {
    const bestReps = Math.max(...sameOrMore.map((s) => s.reps ?? 0))
    if (reps > bestReps) prs.push({ type: 'reps_at_kg', value: reps, previous: bestReps, delta: reps - bestReps, label: `+${reps - bestReps} rep${reps - bestReps > 1 ? 's' : ''} com ${fmt(kg)} kg` })
  }

  for (const b of [...REP_BUCKETS].reverse()) {
    if (reps < b) continue
    const prevAt = before.filter((s) => (s.reps ?? 0) >= b).map(load)
    if (prevAt.length && kg > Math.max(...prevAt)) {
      const p = Math.max(...prevAt)
      prs.push({ type: 'rep_range', value: kg, previous: p, delta: kg - p, reps: b, label: `Melhor marca para ${b}+ reps` })
      break
    }
  }
  return prs
}

const PRIORITY: PRType[] = ['max_kg', 'e1rm', 'reps_at_kg', 'rep_range', 'session_volume']
/** O recorde mais impactante (para a tela dourada). */
export function headline(prs: PR[]): PR | undefined {
  return [...prs].sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type))[0]
}

/** Recalcula os recordes de um exercício inteiro (após editar ou apagar uma série). */
export function recomputeAll(sets: RecSet[], opts: Opts = {}): Map<string, PR[]> {
  const sorted = [...sets].sort((a, b) => a.completedAt.localeCompare(b.completedAt))
  const out = new Map<string, PR[]>()
  sorted.forEach((s, i) => {
    const prs = detectPRs(s, sorted.slice(0, i), opts)
    if (prs.length) out.set(s.id, prs)
  })
  return out
}

/** Recorde de volume da sessão (avaliado no fim do treino). */
export function sessionVolumePR(volume: number, previousVolumes: number[]): PR | null {
  if (!previousVolumes.length) return null
  const best = Math.max(...previousVolumes)
  return volume > best ? { type: 'session_volume', value: volume, previous: best, delta: volume - best, label: `+${Math.round(volume - best)} kg de volume` } : null
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')
