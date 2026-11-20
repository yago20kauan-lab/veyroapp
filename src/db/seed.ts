import { db, type Exercise, type Food } from './schema'
import { seedExercises } from './seed-exercises'
import { seedFoods } from './seed-nutrition'
import { seedPrograms } from './seed-programs'

export const SEED_VERSION = 4

/** Dados globais (iguais para todos os usuários): exercícios, alimentos e programas. */
export async function seedGlobals() {
  const cur = await db.meta.get('seedVersion')
  if (cur && (cur.value as number) >= SEED_VERSION) return
  // importar ANTES da transação: aguardar algo fora do Dexie encerra a transação
  const taco = (await import('./taco.json')).default as unknown as Food[]
  const lib = (await import('./exercises-lib.json')).default as unknown as (Partial<Exercise> & { id: string; patch?: boolean })[]
  const patches = new Map(lib.filter((e) => e.patch).map(({ patch: _p, ...e }) => [e.id, e]))
  const stamp = '2026-11-20T00:00:00.000Z'
  const exercises: Exercise[] = [
    ...seedExercises.map((e) => ({ ...e, ...(patches.get(e.id) ?? {}), updated_at: stamp })),
    ...lib.filter((e) => !e.patch).map((e) => ({ ...e, user_id: null, updated_at: stamp }) as Exercise),
  ]
  const byId = new Map(exercises.map((e) => [e.id, e]))
  for (const e of exercises) if (e.imagesFrom && !e.images?.length) e.images = byId.get(e.imagesFrom)?.images
  await db.transaction('rw', [db.exercises, db.foods, db.programs, db.meta], async () => {
    await db.exercises.bulkPut(exercises)
    await db.foods.bulkPut(seedFoods)
    await db.foods.bulkPut(taco.map((f) => ({ ...f, user_id: null, source: 'taco' as const, updated_at: '2026-11-19T00:00:00.000Z' })))
    await db.programs.clear()
    await db.programs.bulkPut(seedPrograms)
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
  })
}
