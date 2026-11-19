import { db } from './schema'
import { seedExercises } from './seed-exercises'
import { seedFoods } from './seed-nutrition'
import { seedPrograms } from './seed-programs'

export const SEED_VERSION = 1

/** Dados globais (iguais para todos os usuários): exercícios, alimentos e programas. */
export async function seedGlobals() {
  const cur = await db.meta.get('seedVersion')
  if (cur && (cur.value as number) >= SEED_VERSION) return
  await db.transaction('rw', [db.exercises, db.foods, db.programs, db.meta], async () => {
    await db.exercises.bulkPut(seedExercises)
    await db.foods.bulkPut(seedFoods)
    await db.programs.bulkPut(seedPrograms)
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
  })
}
