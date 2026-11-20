import { RETURN_PHASES } from '../db/seed-programs'
import { db, type Phase, type Profile, type Program, type Routine } from '../db/schema'
import { mine, remove, save } from '../db/repo'
import { currentUserId, useSession } from '../store/session'
import { currentPhase, localDate, planWeek, routineForDay, sequencePhases } from '../domain/plan'

export async function getProfile(): Promise<Profile | undefined> {
  const uid = currentUserId()
  const p = await db.profiles.get(uid)
  return p && !p.deleted_at ? p : undefined
}

/** Garante que o perfil exista (id = id do usuário). */
export async function ensureProfile(): Promise<Profile> {
  const p = await getProfile()
  if (p) return p
  const u = useSession.getState().user
  const name = u?.name || (u?.email ?? '').split('@')[0] || 'Atleta'
  return save('profiles', { id: currentUserId(), name: name.charAt(0).toUpperCase() + name.slice(1), settings: {} } as Profile) as Promise<Profile>
}

export async function updateSettings(patch: Partial<Profile['settings']>) {
  const p = await ensureProfile()
  return save('profiles', { ...p, settings: { ...p.settings, ...patch } })
}

/** Ativa um programa pronto: copia rotinas e fases para o usuário (tudo editável depois). */
export async function activateProgram(program: Program, startDate: string, oldLoads: Record<string, number>, withReturn = false) {
  if (withReturn && !program.phases?.some((p) => p.type === 'return')) program = { ...program, phases: RETURN_PHASES }
  const uid = currentUserId()
  // desativa o plano anterior (exclusão lógica: o histórico de treinos continua)
  for (const r of mine(await db.routines.toArray())) await remove('routines', r.id)
  for (const ph of mine(await db.phases.toArray())) await remove('phases', ph.id)

  const phases = sequencePhases(program.phases?.length ? program.phases : [{ name: 'Normal', type: 'normal' as const, weeks: null, rules: [] }], startDate)
  for (const ph of phases) await save('phases', { ...ph, user_id: uid } as unknown as Phase)

  let order = 0
  for (const r of program.routines) {
    await save('routines', {
      name: r.name,
      weekday: r.weekday,
      fromWeek: r.fromWeek ?? 1,
      order: order++,
      items: r.items.map((i) => ({ ...i })),
      planVersion: 1,
      programId: program.id,
      note: r.note,
    } as unknown as Routine)
  }
  const p = await ensureProfile()
  await save('profiles', {
    ...p,
    returnMode: !!program.phases?.some((x) => x.type === 'return'),
    settings: { ...p.settings, activePlan: { programId: program.id, programName: program.name, startDate }, oldLoads: { ...(p.settings.oldLoads ?? {}), ...oldLoads } },
  })
}

export type TodayPlan = {
  profile?: Profile
  routine: Routine | null
  week: number
  phase: ReturnType<typeof currentPhase>
  notStarted: boolean
  startDate?: string
}

/** O que treinar hoje, segundo o plano ativo. */
export async function todayPlan(date = new Date()): Promise<TodayPlan> {
  const profile = await getProfile()
  const plan = profile?.settings.activePlan
  if (!plan) return { profile, routine: null, week: 0, phase: null, notStarted: false }
  const routines = mine(await db.routines.toArray())
  const phases = mine(await db.phases.toArray())
  const week = planWeek(plan.startDate, date)
  const phase = currentPhase(phases, date)
  const routine = week >= 1 ? routineForDay(routines, date.getDay(), week) : null
  return { profile, routine, week, phase, notStarted: week < 1, startDate: plan.startDate }
}

export { localDate }
