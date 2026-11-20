import { describe, expect, it } from 'vitest'
import lib from '../../db/exercises-lib.json'
import { seedExercises } from '../../db/seed-exercises'

const MUSCLES = ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'quadriceps', 'posterior', 'gluteos', 'panturrilha', 'abdomen', 'antebraco', 'trapezio', 'cardio']
const EQUIP = ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'other', 'cardio']
type L = { id: string; patch?: boolean; name?: string; primaryMuscle?: string; secondaryMuscles?: string[]; equipment?: string; images: string[] }

describe('biblioteca ampliada de exercícios', () => {
  const all = lib as L[]
  const novos = all.filter((e) => !e.patch)
  it('tem centenas de exercícios novos, com ids e nomes únicos', () => {
    expect(novos.length).toBeGreaterThan(750)
    const ids = new Set([...seedExercises.map((e) => e.id), ...novos.map((e) => e.id)])
    expect(ids.size).toBe(seedExercises.length + novos.length)
    const names = new Set([...seedExercises.map((e) => e.name), ...novos.map((e) => e.name)])
    expect(names.size).toBe(seedExercises.length + novos.length)
  })
  it('usa só músculos e equipamentos conhecidos', () => {
    for (const e of novos) {
      expect(MUSCLES).toContain(e.primaryMuscle)
      for (const m of e.secondaryMuscles!) expect(MUSCLES).toContain(m)
      expect(EQUIP).toContain(e.equipment)
    }
    expect(novos.filter((e) => !e.images.length).length).toBeLessThan(5)
  })
  it('fotos dos exercícios VEYRO apontam para ids existentes', () => {
    const cur = new Set(seedExercises.map((e) => e.id))
    for (const e of all.filter((x) => x.patch)) expect(cur.has(e.id)).toBe(true)
  })
})
