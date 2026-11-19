/** Tabelas do usuário: nome local (Dexie) → nome no Supabase. */
export const SYNC_TABLES = {
  profiles: 'profiles',
  routines: 'routines',
  phases: 'phases',
  sessions: 'sessions',
  sets: 'sets',
  records: 'records',
  bodyWeights: 'body_weights',
  measurements: 'measurements',
  photos: 'photos',
  cardio: 'cardio',
  exercises: 'exercises',
  foods: 'foods',
  recipes: 'recipes',
  favoriteMeals: 'favorite_meals',
  dietTargets: 'diet_targets',
  dietPlans: 'diet_plans',
  plannedDays: 'planned_days',
  foodLogs: 'food_logs',
  dayNotes: 'day_notes',
  water: 'water',
  supplements: 'supplements',
  supplementLogs: 'supplement_logs',
  shoppingLists: 'shopping_lists',
  goals: 'goals',
  readiness: 'readiness',
  checkins: 'checkins',
  planVersions: 'plan_versions',
} as const

export type LocalTable = keyof typeof SYNC_TABLES

/** Campos que nunca vão para o servidor (ex.: o arquivo da foto vai para o Storage, não para a tabela). */
export const LOCAL_ONLY_FIELDS: Partial<Record<LocalTable, string[]>> = { photos: ['blob'] }
