import { db, type Food } from './schema'
import { seedExercises } from './seed-exercises'
import { seedFoods } from './seed-nutrition'
import { seedPrograms } from './seed-programs'

export const SEED_VERSION = 2

/** Dados globais (iguais para todos os usuários): exercícios, alimentos e programas. */
export async function seedGlobals() {
  const cur = await db.meta.get('seedVersion')
  if (cur && (cur.value as number) >= SEED_VERSION) return
  // importar ANTES da transação: aguardar algo fora do Dexie encerra a transação
  const taco = (await import('./taco.json')).default as unknown as Food[]
  await db.transaction('rw', [db.exercises, db.foods, db.programs, db.meta], async () => {
    await db.exercises.bulkPut(seedExercises)
    await db.foods.bulkPut(seedFoods)
    await db.foods.bulkPut(taco.map((f) => ({ ...f, user_id: null, source: 'taco' as const, updated_at: '2026-11-19T00:00:00.000Z' })))
    await db.programs.bulkPut(seedPrograms)
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
  })
}
