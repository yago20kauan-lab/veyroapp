import Dexie, { type EntityTable } from 'dexie'

/** Campos de sincronização presentes em toda linha do usuário (local-first, ver A6.5). */
export type SyncFields = { user_id: string; updated_at: string; deleted_at?: string | null }

export type Muscle =
  | 'peito' | 'costas' | 'ombros' | 'biceps' | 'triceps' | 'quadriceps' | 'posterior'
  | 'gluteos' | 'panturrilha' | 'abdomen' | 'antebraco' | 'trapezio' | 'cardio'
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'cardio'
export type ExerciseKind = 'weight' | 'bodyweight_plus' | 'time' | 'cardio'

/** Global (user_id null) ou criado pelo usuário. */
export type Exercise = {
  id: string
  user_id: string | null
  name: string
  primaryMuscle: Muscle
  secondaryMuscles: Muscle[]
  equipment: Equipment
  kind: ExerciseKind
  pattern: string
  isCompound: boolean
  isUnilateral: boolean
  stepKg: number
  incrementKg: number
  defaultRestSec: number
  cues?: string[]
  commonMistakes?: string[]
  videoUrl?: string
  updated_at: string
  deleted_at?: string | null
}

export type ActivePlan = { programId: string; programName: string; startDate: string }
export type ProfileSettings = {
  activePlan?: ActivePlan
  /** cargas antigas informadas no Modo Retorno (exerciseId → kg) */
  oldLoads?: Record<string, number>
  /** descanso padrão salvo por exercício (s) */
  restOverrides?: Record<string, number>
  /** notas fixas por exercício */
  exerciseNotes?: Record<string, string>
  sound?: boolean
  [k: string]: unknown
}
export type Profile = SyncFields & {
  id: string
  name: string
  sex?: 'm' | 'f'
  birthDate?: string
  heightCm?: number
  goal?: 'cut' | 'maintain' | 'bulk'
  targetWeightKg?: number
  startDate?: string
  returnMode?: boolean
  settings: ProfileSettings
}

export type RoutineItem = {
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  restSec: number
  supersetGroup?: string
  seconds?: number
  minutes?: number
}
export type Routine = SyncFields & {
  id: string
  name: string
  weekday?: number
  phaseId?: string
  order: number
  items: RoutineItem[]
  planVersion: number
  /** semana do plano a partir da qual esta rotina vale (troca de divisão) */
  fromWeek?: number
  programId?: string
}
export type Phase = SyncFields & {
  id: string
  name: string
  type: 'return' | 'normal' | 'deload'
  startDate: string
  weeks: number | null
  rules: { week: number; pct: number; sets: string; rpeMax: number }[]
}
export type SessionPhase = { type: 'return' | 'normal' | 'deload'; week: number; pct?: number; sets?: string; rpeMax?: number; name: string }
export type Session = SyncFields & {
  id: string
  routineId?: string
  routineName?: string
  phaseId?: string
  /** foto da fase no início do treino */
  phase?: SessionPhase | null
  planWeek?: number
  /** itens do treino no início (editar o plano não muda treinos passados) */
  items?: RoutineItem[]
  /** trocas feitas no treino: índice do item → exerciseId */
  swaps?: Record<number, string>
  currentIndex?: number
  restEndsAt?: number
  restTotal?: number
  startedAt: string
  endedAt?: string
  status: 'active' | 'finished' | 'abandoned'
  feeling?: 1 | 2 | 3 | 4
  note?: string
  volume?: number
  ignoreReadiness?: boolean
}
export type SetLog = SyncFields & {
  id: string
  sessionId: string
  exerciseId: string
  setIndex: number
  type: 'warmup' | 'normal' | 'drop' | 'failure'
  kg?: number
  reps?: number
  seconds?: number
  rpe?: number
  side?: 'L' | 'R' | 'both'
  completedAt: string
  isPR: boolean
}
export type PersonalRecord = SyncFields & { id: string; exerciseId: string; type: string; value: number; reps?: number; setLogId: string; achievedAt: string }
export type BodyWeight = SyncFields & { id: string; date: string; kg: number; source: 'manual' | 'health' }
export type Measurement = SyncFields & { id: string; date: string; waistCm?: number; neckCm?: number; chestCm?: number; armCm?: number; thighCm?: number; hipCm?: number }
export type ProgressPhoto = SyncFields & { id: string; date: string; pose: 'front' | 'side' | 'back'; blob?: Blob; remotePath?: string }
export type Cardio = SyncFields & { id: string; sessionId?: string; date: string; type: string; minutes: number; kcal?: number }

export type Macros = { kcal: number; p: number; c: number; f: number; fiber?: number }
export type Food = {
  id: string
  user_id: string | null
  name: string
  brand?: string
  per100g: Macros
  state: 'raw' | 'cooked' | 'na'
  /** peso cozido ÷ peso cru (para lista de compras) */
  yieldFactor?: number
  swapGroup?: 'carb' | 'protein' | 'fruit' | 'fat' | 'veg' | 'dairy' | 'bread'
  section: 'hortifruti' | 'acougue' | 'mercearia' | 'laticinios' | 'padaria' | 'suplementos' | 'congelados'
  source: 'taco' | 'custom' | 'off' | 'seed'
  category?: string
  /** id do mesmo alimento cru (para a lista de compras) */
  rawId?: string
  updated_at: string
  deleted_at?: string | null
}
export type MealItem = { foodId?: string; recipeId?: string; grams: number }
export type Recipe = SyncFields & { id: string; name: string; ingredients: MealItem[]; cookedWeightG: number; servings: number }
export type FavoriteMeal = SyncFields & { id: string; name: string; items: MealItem[] }
export type DietTargets = SyncFields & {
  id: string
  version: number
  base: Macros
  mode: 'grams' | 'percent'
  /** ciclo de carboidrato ligado: usa trainingDay/restDay */
  cycle?: boolean
  trainingDay?: Macros
  restDay?: Macros
  waterMl: number
  /** limite para a barra ficar vermelha (1.1 = 110%); 0 = sem aviso */
  redAt?: number
  validFrom: string
  /** ritmo desejado em kg/semana (negativo = perder) */
  rateKgWeek?: number
  tdeeEstimate?: number
}
export type PlanMeal = { name: string; time: string; items: MealItem[] }
export type DietPlan = SyncFields & { id: string; version: number; name: string; validFrom: string; meals: PlanMeal[] }
export type PlannedDay = SyncFields & { id: string; date: string; meals: PlanMeal[]; fromPlanId: string }
export type FoodLog = SyncFields & { id: string; date: string; mealName: string; time?: string; foodId?: string; recipeId?: string; grams: number; macros: Macros; planned: boolean }
export type DayNote = SyncFields & { id: string; date: string; text: string; isCheatMeal: boolean; steps?: number }
export type Water = SyncFields & { id: string; date: string; ml: number }
export type Supplement = SyncFields & { id: string; name: string; dose: number; unit: string; times: string[]; macros?: Macros; active?: boolean }
export type SupplementLog = SyncFields & { id: string; supplementId: string; date: string; takenAt: string }
export type ShoppingList = SyncFields & {
  id: string
  rangeStart: string
  rangeEnd: string
  items: { foodId: string; rawGrams: number; section: string; checked: boolean; haveAtHome: boolean }[]
}
export type Goal = SyncFields & {
  id: string
  type: 'weight' | 'waist' | 'bodyfat' | 'lift' | 'frequency' | 'steps' | 'protein'
  exerciseId?: string
  target: number
  start: number
  deadline?: string
  status: 'active' | 'done' | 'archived'
  isPrimary: boolean
}
export type ReadinessLog = SyncFields & { id: string; date: string; sleep: number; soreness: number; energy: number; sleepHours?: number; restingHr?: number; hrv?: number; score: number }
export type WeeklyCheckin = SyncFields & { id: string; weekStart: string; trendKg: number; rate?: number | null; waistCm?: number; energy: number; hunger: number; sleep: number; recommendation: string; code?: string; applied: boolean }
export type PlanVersion = SyncFields & { id: string; kind: 'training' | 'diet'; version: number; snapshot: unknown; createdAt: string }
export type Program = {
  id: string
  name: string
  level: 'iniciante' | 'intermediario' | 'avancado'
  daysPerWeek: number
  description: string
  forWho: string
  phases?: Omit<Phase, keyof SyncFields | 'id' | 'startDate'>[]
  routines: { name: string; weekday?: number; items: RoutineItem[]; fromWeek?: number }[]
}
/** Fila de saída da sincronização (A6.5). */
export type Outbox = { id?: number; table: string; rowId: string; op: 'upsert' | 'delete'; at: string }

export class VeyroDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  profiles!: EntityTable<Profile, 'id'>
  routines!: EntityTable<Routine, 'id'>
  phases!: EntityTable<Phase, 'id'>
  sessions!: EntityTable<Session, 'id'>
  sets!: EntityTable<SetLog, 'id'>
  records!: EntityTable<PersonalRecord, 'id'>
  bodyWeights!: EntityTable<BodyWeight, 'id'>
  measurements!: EntityTable<Measurement, 'id'>
  photos!: EntityTable<ProgressPhoto, 'id'>
  cardio!: EntityTable<Cardio, 'id'>
  foods!: EntityTable<Food, 'id'>
  recipes!: EntityTable<Recipe, 'id'>
  favoriteMeals!: EntityTable<FavoriteMeal, 'id'>
  dietTargets!: EntityTable<DietTargets, 'id'>
  dietPlans!: EntityTable<DietPlan, 'id'>
  plannedDays!: EntityTable<PlannedDay, 'id'>
  foodLogs!: EntityTable<FoodLog, 'id'>
  dayNotes!: EntityTable<DayNote, 'id'>
  water!: EntityTable<Water, 'id'>
  supplements!: EntityTable<Supplement, 'id'>
  supplementLogs!: EntityTable<SupplementLog, 'id'>
  shoppingLists!: EntityTable<ShoppingList, 'id'>
  goals!: EntityTable<Goal, 'id'>
  readiness!: EntityTable<ReadinessLog, 'id'>
  checkins!: EntityTable<WeeklyCheckin, 'id'>
  planVersions!: EntityTable<PlanVersion, 'id'>
  programs!: EntityTable<Program, 'id'>
  outbox!: EntityTable<Outbox, 'id'>
  meta!: EntityTable<{ key: string; value: unknown }, 'key'>

  constructor() {
    super('veyro')
    this.version(1).stores({
      exercises: 'id, user_id, name, primaryMuscle, pattern',
      profiles: 'id, user_id',
      routines: 'id, user_id, weekday, phaseId',
      phases: 'id, user_id, startDate',
      sessions: 'id, user_id, startedAt, status, routineId',
      sets: 'id, user_id, sessionId, exerciseId, completedAt, [exerciseId+completedAt]',
      records: 'id, user_id, exerciseId, type',
      bodyWeights: 'id, user_id, date',
      measurements: 'id, user_id, date',
      photos: 'id, user_id, date, pose',
      cardio: 'id, user_id, date, sessionId',
      foods: 'id, user_id, name, swapGroup',
      recipes: 'id, user_id, name',
      favoriteMeals: 'id, user_id',
      dietTargets: 'id, user_id, validFrom',
      dietPlans: 'id, user_id, validFrom',
      plannedDays: 'id, user_id, date',
      foodLogs: 'id, user_id, date, mealName',
      dayNotes: 'id, user_id, date',
      water: 'id, user_id, date',
      supplements: 'id, user_id',
      supplementLogs: 'id, user_id, date, supplementId',
      shoppingLists: 'id, user_id',
      goals: 'id, user_id, status',
      readiness: 'id, user_id, date',
      checkins: 'id, user_id, weekStart',
      planVersions: 'id, user_id, kind',
      programs: 'id',
      outbox: '++id, table, rowId',
      meta: 'key',
    })
  }
}

export const db = new VeyroDB()

export const nowIso = () => new Date().toISOString()
export const uuid = () => crypto.randomUUID()
