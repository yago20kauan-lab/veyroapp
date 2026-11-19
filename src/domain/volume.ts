import type { Exercise, Muscle } from '../db/schema'

type VSet = { kg?: number; reps?: number; type?: string; exerciseId: string }
type VEx = Pick<Exercise, 'equipment' | 'isUnilateral' | 'primaryMuscle' | 'secondaryMuscles'>

const counts = (s: VSet) => (s.type ?? 'normal') !== 'warmup' && (s.reps ?? 0) > 0

/** Volume = kg × reps. Halteres bilaterais contam os 2 halteres. Aquecimento não conta. */
export function setVolume(s: VSet, ex?: VEx) {
  if (!counts(s)) return 0
  const mult = ex?.equipment === 'dumbbell' && !ex.isUnilateral ? 2 : 1
  return (s.kg ?? 0) * (s.reps ?? 0) * mult
}

export function totalVolume(sets: VSet[], exercises: Map<string, VEx>) {
  return sets.reduce((acc, s) => acc + setVolume(s, exercises.get(s.exerciseId)), 0)
}

/** Séries efetivas por grupo: principal = 1, secundário = 0,5. */
export function effectiveSetsByMuscle(sets: VSet[], exercises: Map<string, VEx>) {
  const out = new Map<Muscle, number>()
  for (const s of sets) {
    if (!counts(s)) continue
    const ex = exercises.get(s.exerciseId)
    if (!ex) continue
    out.set(ex.primaryMuscle, (out.get(ex.primaryMuscle) ?? 0) + 1)
    for (const m of ex.secondaryMuscles) out.set(m, (out.get(m) ?? 0) + 0.5)
  }
  return out
}
