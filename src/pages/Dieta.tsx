import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DayNote, type FavoriteMeal, type FoodLog, type PlanMeal, type Supplement, type SupplementLog } from '../db/schema'
import { mine, remove, save } from '../db/repo'
import { Header } from '../ui/Header'
import { Card, Chip, EmptyState, Label, PrimaryButton } from '../ui/primitives'
import { MacroBar, Ring } from '../ui/charts'
import { BottomSheet, useToast } from '../ui/overlays'
import { useSession } from '../store/session'
import { localDate } from '../domain/plan'
import { macrosFor } from '../domain/nutrition'
import { dayLogs, ensureTemplatePlan, foodsMap, itemKey, logFood, mealMacros, plannedMeals, sumLogs, targetsFor, updateLogGrams, waterToday, type FoodLike } from '../lib/diet'
import { FoodSearchSheet, GramsPicker, SwapSheet } from './diet/FoodSheets'
import { IconCheck } from '../ui/icons'

const addDays = (date: string, n: number) => {
  const d = new Date(date + 'T12:00')
  d.setDate(d.getDate() + n)
  return localDate(d)
}

export default function Dieta() {
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const uid = useSession((s) => s.user?.id)
  const [date, setDate] = useState(localDate())
  const today = localDate()
  const foods = useLiveQuery(() => foodsMap(), [uid])
  const tgt = useLiveQuery(() => targetsFor(date), [uid, date])
  const plan = useLiveQuery(() => plannedMeals(date), [uid, date])
  const logs = useLiveQuery(() => dayLogs(date), [uid, date])
  const water = useLiveQuery(() => waterToday(date), [uid, date])
  const note = useLiveQuery(async () => (mine(await db.dayNotes.where('date').equals(date).toArray()) as DayNote[]).at(-1), [uid, date])
  const favorites = useLiveQuery(async () => mine(await db.favoriteMeals.toArray()) as FavoriteMeal[], [uid])
  const supplements = useLiveQuery(async () => (mine(await db.supplements.toArray()) as Supplement[]).filter((s) => s.active !== false), [uid])
  const suppLogs = useLiveQuery(async () => mine(await db.supplementLogs.where('date').equals(date).toArray()) as SupplementLog[], [uid, date])

  const [adding, setAdding] = useState<string | null>(null)
  const [editLog, setEditLog] = useState<FoodLog | null>(null)
  const [swap, setSwap] = useState<FoodLog | null>(null)
  const [favFor, setFavFor] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)

  const meals = useMemo(() => {
    const names = new Map<string, PlanMeal>()
    for (const m of plan?.meals ?? []) names.set(m.name, m)
    for (const l of logs ?? []) if (!names.has(l.mealName)) names.set(l.mealName, { name: l.mealName, time: l.time ?? '', items: [] })
    return [...names.values()].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
  }, [plan, logs])

  if (!foods || !tgt || !plan || !logs) return null
  const total = sumLogs(logs)
  const t = tgt.targets
  const redAt = tgt.t?.redAt ?? 1.1
  const left = Math.round(t.kcal - total.kcal)
  const hasTargets = t.kcal > 0
  const waterGoal = tgt.t?.waterMl ?? 3000
  const isFuture = date > today

  async function comiPlanejado(m: PlanMeal) {
    for (const it of m.items) await logFood(date, m.name, it, foods!, true, m.time)
    toast(`${m.name} registrado`)
  }
  async function copiarOntem(mealName: string) {
    const prev = (await dayLogs(addDays(date, -1))).filter((l) => l.mealName === mealName)
    if (!prev.length) return toast('Nada registrado ontem nessa refeição')
    for (const l of prev) await logFood(date, mealName, { foodId: l.foodId, recipeId: l.recipeId, grams: l.grams }, foods!, false, l.time)
    toast('Copiado de ontem')
  }
  async function addWater(ml: number) {
    await save('water', { date, ml })
  }

  return (
    <>
      <Header title="Diário" />
      {/* Navegação de datas */}
      <div className="mb-3 flex items-center justify-between">
        <button className="h-10 w-10 rounded-full border border-border" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">‹</button>
        <button className="text-sm font-semibold" onClick={() => setDate(today)}>
          {date === today ? 'Hoje' : new Date(date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          {tgt.kind !== 'base' && <span className="label ml-2 text-lime">dia de {tgt.kind}</span>}
        </button>
        <button className="h-10 w-10 rounded-full border border-border" onClick={() => setDate(addDays(date, 1))} aria-label="Próximo dia">›</button>
      </div>

      {!hasTargets ? (
        <EmptyState title="Defina suas metas" text="O calculador usa idade, altura, peso e objetivo." action={<PrimaryButton onClick={() => nav('/dieta/metas')}>Calcular metas</PrimaryButton>} />
      ) : (
        <Card className="mb-4">
          <div className="flex items-center gap-5">
            <Ring value={Math.min(total.kcal, t.kcal)} max={t.kcal} size={124} stroke={11} color={total.kcal > t.kcal * redAt && redAt ? '#FF5A5F' : '#C6FF3D'}>
              <span className="num font-display text-2xl font-extrabold">{left >= 0 ? left.toLocaleString('pt-BR') : `+${(-left).toLocaleString('pt-BR')}`}</span>
              <span className="label" style={{ fontSize: 9 }}>{left >= 0 ? 'kcal restantes' : 'kcal acima'}</span>
            </Ring>
            <div className="flex flex-1 flex-col gap-2.5">
              <MacroBar label="Proteína" value={total.p} target={t.p} redAt={redAt || 99} />
              <MacroBar label="Carbo" value={total.c} target={t.c} redAt={redAt || 99} />
              <MacroBar label="Gordura" value={total.f} target={t.f} redAt={redAt || 99} />
            </div>
          </div>
        </Card>
      )}

      {/* Atalhos */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <Chip onClick={() => nav('/dieta/plano')}>Plano alimentar</Chip>
        <Chip onClick={() => nav('/dieta/metas')}>Metas</Chip>
        <Chip onClick={() => nav('/dieta/compras')}>Lista de compras</Chip>
        <Chip onClick={() => nav('/dieta/alimentos')}>Alimentos e receitas</Chip>
        <Chip onClick={() => nav('/dieta/suplementos')}>Suplementos</Chip>
        <Chip onClick={() => nav('/dieta/relatorio')}>Relatório</Chip>
      </div>

      {meals.length === 0 && (
        <EmptyState
          title="Sem plano alimentar"
          text="Monte suas refeições ou comece pelo modelo de definição (2.300 kcal, 4 refeições) e ajuste."
          action={<PrimaryButton onClick={async () => { await ensureTemplatePlan(); toast('Modelo aplicado. Edite em Plano alimentar.') }}>Usar modelo</PrimaryButton>}
        />
      )}

      {/* Refeições */}
      <div className="flex flex-col gap-3">
        {meals.map((m) => {
          const ml = logs.filter((l) => l.mealName === m.name)
          const eaten = sumLogs(ml)
          const planned = mealMacros(m.items, foods)
          const done = ml.length > 0
          return (
            <Card key={m.name} className="!p-0">
              <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    {m.time && <span className="num label text-lime">{m.time}</span>}
                    <span className="font-semibold">{m.name}</span>
                    {done && <IconCheck size={16} className="text-lime" />}
                  </div>
                  <div className="num text-xs text-muted">
                    {done ? `${Math.round(eaten.kcal)} kcal · P ${Math.round(eaten.p)} g` : `plano: ${Math.round(planned.kcal)} kcal · P ${Math.round(planned.p)} g`}
                  </div>
                </div>
                {!done && m.items.length > 0 && !isFuture && (
                  <button onClick={() => comiPlanejado(m)} className="h-9 rounded-full bg-lime px-4 text-sm font-semibold text-onlime">Comi</button>
                )}
              </div>
              <ul className="divide-y divide-border border-t border-border">
                {(done ? ml : []).map((l) => {
                  const f = foods.get(l.foodId ?? l.recipeId ?? '')
                  return (
                    <li key={l.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <button className="min-w-0 flex-1 text-left" onClick={() => setEditLog(l)}>
                        <span className="block truncate text-sm">{f?.name ?? 'Alimento'}</span>
                        <span className="num text-xs text-muted">{l.grams} g · {Math.round(l.macros.kcal)} kcal · P {Math.round(l.macros.p)}</span>
                      </button>
                      {f?.swapGroup && <button className="h-8 rounded-full border border-border px-2.5 text-xs" onClick={() => setSwap(l)}>⇄</button>}
                    </li>
                  )
                })}
                {!done && m.items.map((it, i) => {
                  const f = foods.get(itemKey(it))
                  return (
                    <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm text-muted">
                      <span className="truncate">{f?.name ?? '?'}</span>
                      <span className="num shrink-0">{it.grams} g</span>
                    </li>
                  )
                })}
              </ul>
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-xs">
                <button className="text-lime" onClick={() => setAdding(m.name)}>+ Alimento</button>
                <button className="text-muted" onClick={() => copiarOntem(m.name)}>Copiar de ontem</button>
                <button className="text-muted" onClick={() => setFavFor(m.name)}>Favoritas</button>
                {done && <button className="text-muted" onClick={async () => { await save('favoriteMeals', { name: `${m.name} padrão`, items: ml.map((l) => ({ foodId: l.foodId, recipeId: l.recipeId, grams: l.grams })) }); toast('Salva como favorita') }}>Salvar favorita</button>}
              </div>
            </Card>
          )
        })}
        <PrimaryButton variant="ghost" full onClick={() => setAdding('Fora do plano')}>+ Registrar fora do plano</PrimaryButton>
      </div>

      {/* Água */}
      <Card className="mt-4">
        <div className="flex items-center gap-4">
          <Ring value={water ?? 0} max={waterGoal} size={64} stroke={7} color="#3DF2FF">
            <span className="num text-[11px] font-bold">{((water ?? 0) / 1000).toFixed(1).replace('.', ',')} L</span>
          </Ring>
          <div className="flex-1">
            <Label>Água</Label>
            <div className="num text-xs text-muted">meta {(waterGoal / 1000).toFixed(1).replace('.', ',')} L</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[250, 500, 1000].map((v) => <Chip key={v} onClick={() => addWater(v)}>+{v >= 1000 ? '1 L' : `${v} ml`}</Chip>)}
              {(water ?? 0) > 0 && <Chip onClick={() => addWater(-250)}>−250</Chip>}
            </div>
          </div>
        </div>
      </Card>

      {/* Suplementos */}
      {!!supplements?.length && (
        <Card className="mt-3">
          <Label className="mb-2">Suplementos</Label>
          <div className="flex flex-wrap gap-2">
            {supplements.map((s) => {
              const taken = suppLogs?.find((l) => l.supplementId === s.id)
              return (
                <Chip key={s.id} active={!!taken} onClick={async () => {
                  if (taken) await remove('supplementLogs', taken.id)
                  else {
                    await save('supplementLogs', { supplementId: s.id, date, takenAt: new Date().toISOString() })
                    if (s.macros) await save('foodLogs', { date, mealName: 'Suplementos', grams: s.dose, macros: s.macros, planned: false } as unknown as FoodLog)
                  }
                }}>{taken ? '✓ ' : ''}{s.name} {s.dose}{s.unit}</Chip>
              )
            })}
          </div>
        </Card>
      )}

      {/* Nota do dia */}
      <button onClick={() => setNoteOpen(true)} className="mt-3 w-full rounded-card border border-dashed border-border px-4 py-3 text-left text-sm text-muted">
        {note?.text ? <>📝 {note.text}{note.isCheatMeal ? ' · refeição livre' : ''}</> : '+ Nota do dia / refeição livre'}
      </button>

      <p className="mt-6 text-center text-[11px] text-muted/70">Valores de alimentos: Tabela Brasileira de Composição de Alimentos (TACO), 4ª ed., NEPA/UNICAMP, 2011.</p>

      {/* Folhas */}
      <FoodSearchSheet open={!!adding} onClose={() => setAdding(null)} foods={foods} onPick={(item) => adding && logFood(date, adding, item, foods, false, meals.find((m) => m.name === adding)?.time)} />
      <EditLogSheet log={editLog} foods={foods} onClose={() => setEditLog(null)} />
      <SwapSheet
        open={!!swap}
        onClose={() => setSwap(null)}
        foods={foods}
        food={swap ? foods.get(swap.foodId ?? '') : undefined}
        grams={swap?.grams ?? 0}
        onPick={async (f, g) => {
          if (!swap) return
          await save('foodLogs', { ...swap, foodId: f.id, recipeId: undefined, grams: g, macros: macrosFor(f, g), planned: false })
          toast(`Trocado por ${g} g de ${f.name}`)
        }}
      />
      <BottomSheet open={!!favFor} onClose={() => setFavFor(null)} title="Refeições favoritas">
        {!favorites?.length ? <p className="text-sm text-muted">Registre uma refeição e toque em "Salvar favorita".</p> : (
          <div className="flex flex-col gap-2">
            {favorites.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-btn border border-border bg-surface2 px-3 py-2.5">
                <button className="flex-1 text-left" onClick={async () => { for (const it of f.items) await logFood(date, favFor!, it, foods); setFavFor(null); toast('Favorita adicionada') }}>
                  <span className="block text-sm font-semibold">{f.name}</span>
                  <span className="num text-xs text-muted">{Math.round(mealMacros(f.items, foods).kcal)} kcal · {f.items.length} itens</span>
                </button>
                <button className="px-2 text-xs text-muted" onClick={() => remove('favoriteMeals', f.id)}>Apagar</button>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
      <NoteSheet open={noteOpen} onClose={() => setNoteOpen(false)} date={date} note={note} />
    </>
  )
}

function EditLogSheet({ log, foods, onClose }: { log: FoodLog | null; foods: Map<string, FoodLike>; onClose: () => void }) {
  const [g, setG] = useState(100)
  const f = log ? foods.get(log.foodId ?? log.recipeId ?? '') : undefined
  const key = log?.id
  const [lastKey, setLastKey] = useState<string | undefined>()
  if (key !== lastKey) {
    setLastKey(key)
    if (log) setG(log.grams)
  }
  return (
    <BottomSheet open={!!log} onClose={onClose} title={f?.name ?? 'Alimento'} footer={
      <div className="flex gap-2">
        <button className="h-[52px] rounded-btn border border-danger/50 px-4 font-semibold text-danger" onClick={async () => { if (log) await remove('foodLogs', log.id); onClose() }}>Apagar</button>
        <PrimaryButton full onClick={async () => { if (log) await updateLogGrams(log, g, foods); onClose() }}>Salvar {g} g</PrimaryButton>
      </div>
    }>
      {f ? <GramsPicker food={f} grams={g} onChange={setG} /> : <p className="text-sm text-muted">Item avulso: {log?.grams} g</p>}
    </BottomSheet>
  )
}

function NoteSheet({ open, onClose, date, note }: { open: boolean; onClose: () => void; date: string; note?: DayNote }) {
  const [text, setText] = useState('')
  const [cheat, setCheat] = useState(false)
  const [last, setLast] = useState<string | undefined>()
  const k = `${open}:${note?.id}`
  if (k !== last) {
    setLast(k)
    setText(note?.text ?? '')
    setCheat(!!note?.isCheatMeal)
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Nota do dia" footer={
      <PrimaryButton full onClick={async () => { await save('dayNotes', { ...(note ?? {}), date, text, isCheatMeal: cheat }); onClose() }}>Salvar</PrimaryButton>
    }>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Ex.: aniversário, comi fora" className="mb-3 w-full rounded-btn border border-border bg-surface2 p-3 text-base outline-none focus:border-lime" />
      <div className="flex gap-2"><Chip active={cheat} onClick={() => setCheat(!cheat)}>{cheat ? '✓ ' : ''}Refeição livre (1 por semana)</Chip></div>
    </BottomSheet>
  )
}
