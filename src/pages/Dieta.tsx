import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Cardio, type DayNote, type FavoriteMeal, type FoodLog, type PlanMeal, type Supplement, type SupplementLog } from '../db/schema'
import { mine, remove, save } from '../db/repo'
import { Card, Chip, Label, PrimaryButton } from '../ui/primitives'
import { Ring } from '../ui/charts'
import { BottomSheet, useToast } from '../ui/overlays'
import { useSession } from '../store/session'
import { localDate } from '../domain/plan'
import { macrosFor } from '../domain/nutrition'
import { dayLogs, diarySettings, ensureTemplatePlan, foodsMap, itemKey, logFood, mealMacros, plannedMeals, sumLogs, targetsFor, updateLogGrams, waterToday, type FoodLike } from '../lib/diet'
import { GramsPicker, SwapSheet } from './diet/FoodSheets'
import { recalcNotice } from '../lib/dietTemplates'
import { VeyroMark } from '../ui/brand'

const addDays = (date: string, n: number) => {
  const d = new Date(date + 'T12:00')
  d.setDate(d.getDate() + n)
  return localDate(d)
}
const r0 = (n: number) => Math.round(n)
const r1 = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')

/** 4 números coloridos, como no Macros: Carboidratos · Proteína · Gordura · Calorias */
function MacroRow({ c, p, f, kcal, size = 'md' }: { c: number; p: number; f: number; kcal: number; size?: 'md' | 'sm' }) {
  const big = size === 'md' ? 'text-lg' : 'text-sm'
  return (
    <div className="grid grid-cols-4 text-center">
      {([['Carboidratos', c, 'text-carb'], ['Proteína', p, 'text-prot'], ['Gordura', f, 'text-fat'], ['Calorias', kcal, 'text-lime']] as const).map(([l, v, cls]) => (
        <div key={l}>
          <div className={`num font-bold ${big} ${cls}`}>{r0(v)}</div>
          {size === 'md' && <div className={`text-[11px] ${cls} opacity-80`}>{l}</div>}
        </div>
      ))}
    </div>
  )
}

function HeaderBar({ label, value, target, cls, bar, redAt = 1.1 }: { label: string; value: number; target: number; cls: string; bar: string; redAt?: number }) {
  const pct = target ? Math.min(1, value / target) : 0
  if (target && value > target * redAt) { bar = 'bg-danger'; cls = 'text-danger' }
  return (
    <div className="flex-1">
      <div className={`text-center text-[11px] font-semibold ${cls}`}>{label}</div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2"><div className={`h-full rounded-full ${bar}`} style={{ width: `${pct * 100}%` }} /></div>
      <div className={`num mt-1 text-center text-sm font-bold ${cls}`}>{r0(value)} / {r0(target)} g</div>
    </div>
  )
}

export default function Dieta() {
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const uid = useSession((s) => s.user?.id)
  const [date, setDate] = useState(localDate())
  const today = localDate()
  const foods = useLiveQuery(() => foodsMap(), [uid])
  const settings = useLiveQuery(() => diarySettings(), [uid])
  const tgt = useLiveQuery(() => targetsFor(date), [uid, date])
  const plan = useLiveQuery(() => plannedMeals(date), [uid, date])
  const logs = useLiveQuery(() => dayLogs(date), [uid, date])
  const water = useLiveQuery(() => waterToday(date), [uid, date])
  const note = useLiveQuery(async () => (mine(await db.dayNotes.where('date').equals(date).toArray()) as DayNote[]).at(-1), [uid, date])
  const favorites = useLiveQuery(async () => mine(await db.favoriteMeals.toArray()) as FavoriteMeal[], [uid])
  const supplements = useLiveQuery(async () => (mine(await db.supplements.toArray()) as Supplement[]).filter((s) => s.active !== false), [uid])
  const suppLogs = useLiveQuery(async () => mine(await db.supplementLogs.where('date').equals(date).toArray()) as SupplementLog[], [uid, date])
  const exercise = useLiveQuery(async () => {
    const sess = (mine(await db.sessions.toArray()) as { startedAt: string; endedAt?: string; status: string; routineName?: string }[]).filter((s) => s.status === 'finished' && localDate(new Date(s.startedAt)) === date)
    const cardio = (mine(await db.cardio.where('date').equals(date).toArray()) as Cardio[])
    return { sess, cardio }
  }, [uid, date])

  const [menu, setMenu] = useState<string | null>(null)
  const [editLog, setEditLog] = useState<FoodLog | null>(null)
  const [swap, setSwap] = useState<FoodLog | null>(null)
  const [favFor, setFavFor] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [topMenu, setTopMenu] = useState(false)
  const notice = useLiveQuery(() => recalcNotice(), [uid, logs?.length])

  const meals = useMemo(() => {
    const out = new Map<string, { name: string; time: string; planned?: PlanMeal }>()
    for (const m of settings?.meals ?? []) out.set(m.name, { ...m })
    for (const m of plan?.meals ?? []) out.set(m.name, { name: m.name, time: out.get(m.name)?.time || m.time, planned: m })
    for (const l of logs ?? []) if (!out.has(l.mealName)) out.set(l.mealName, { name: l.mealName, time: l.time ?? '' })
    const order = new Map((settings?.meals ?? []).map((m, i) => [m.name, i]))
    return [...out.values()].sort((a, b) => (order.get(a.name) ?? 50) - (order.get(b.name) ?? 50) || (a.time || '99').localeCompare(b.time || '99'))
  }, [settings, plan, logs])

  if (!foods || !tgt || !plan || !logs || !settings) return null
  const total = sumLogs(logs)
  const t = tgt.targets
  const isFuture = date > today

  async function apagar(l: FoodLog) {
    await remove('foodLogs', l.id)
    const f = foods!.get(l.foodId ?? l.recipeId ?? '')
    toast(`${f?.name?.split(',')[0] ?? 'Alimento'} removido`, { label: 'Desfazer', fn: () => save('foodLogs', { ...l, deleted_at: null }) })
  }
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
  async function limpar(mealName: string) {
    const ls = logs!.filter((l) => l.mealName === mealName)
    for (const l of ls) await remove('foodLogs', l.id)
    toast(`${ls.length} item(ns) removido(s)`, { label: 'Desfazer', fn: () => ls.forEach((l) => save('foodLogs', { ...l, deleted_at: null })) })
  }

  const dateLabel = date === today ? 'Hoje' : date === addDays(today, -1) ? 'Ontem' : date === addDays(today, 1) ? 'Amanhã' : new Date(date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })

  return (
    <div className="-mx-4">
      {/* Topo fixo: data + resumo */}
      <div className={`${settings.stickyHeader ? 'sticky top-0' : ''} pt-safe z-20 border-b border-border bg-bg/95 px-4 pb-3 backdrop-blur-xl`}>
        <div className="flex items-center justify-between pt-3">
          <button className="h-10 w-10 rounded-full text-xl" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">‹</button>
          <button className="flex flex-col items-center" onClick={() => setDate(today)}>
            <span className="font-display text-lg font-bold">{dateLabel}</span>
            {tgt.kind !== 'base' && <span className="label text-lime">dia de {tgt.kind}</span>}
          </button>
          <div className="flex items-center">
            <button className="h-10 w-10 rounded-full text-xl" onClick={() => setDate(addDays(date, 1))} aria-label="Próximo dia">›</button>
            <button className="h-10 w-8 text-xl text-muted" onClick={() => setTopMenu(true)} aria-label="Opções">⋮</button>
          </div>
        </div>
        {t.kcal > 0 ? (
          <>
            <div className="mt-2 flex gap-3">
              <HeaderBar label="Carboidratos" value={total.c} target={t.c} cls="text-carb" bar="bg-carb" redAt={tgt.t?.redAt} />
              <HeaderBar label="Proteína" value={total.p} target={t.p} cls="text-prot" bar="bg-prot" redAt={tgt.t?.redAt} />
              <HeaderBar label="Gordura" value={total.f} target={t.f} cls="text-fat" bar="bg-fat" redAt={tgt.t?.redAt} />
            </div>
            <div className="num mt-1.5 text-center text-xs text-muted">
              <b className="text-lime">{r0(total.kcal).toLocaleString('pt-BR')}</b> / {t.kcal.toLocaleString('pt-BR')} kcal · {t.kcal - total.kcal >= 0 ? `faltam ${r0(t.kcal - total.kcal)}` : `${r0(total.kcal - t.kcal)} acima`}
            </div>
          </>
        ) : (
          <button onClick={() => nav('/dieta/metas')} className="mt-2 w-full rounded-btn border border-dashed border-border py-2 text-sm text-lime">Definir metas de calorias e macros ›</button>
        )}
      </div>

      <div className="px-4 pt-3">
        {/* Atalhos */}
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
          <Chip onClick={() => nav('/dieta/prontas')}>Dietas prontas</Chip>
          <Chip onClick={() => nav('/dieta/plano')}>Plano alimentar</Chip>
          <Chip onClick={() => nav('/dieta/metas')}>Metas</Chip>
          <Chip onClick={() => nav('/dieta/compras')}>Lista de compras</Chip>
          <Chip onClick={() => nav('/dieta/alimentos')}>Alimentos e receitas</Chip>
          <Chip onClick={() => nav('/dieta/suplementos')}>Suplementos</Chip>
          <Chip onClick={() => nav('/dieta/relatorio')}>Relatório</Chip>
        </div>

        {notice && (
          <button onClick={() => nav('/dieta/sugestao')} className="mb-3 w-full rounded-card border border-lime/40 bg-lime/[0.05] px-4 py-3 text-left text-sm">
            Sua meta mudou para <b className="num text-lime">{notice.kcal.toLocaleString('pt-BR')} kcal</b>. <span className="text-lime">Ver nova sugestão ›</span>
          </button>
        )}
        {!plan.meals.length && !logs.length && !t.kcal && (
          <button onClick={() => nav('/dieta/sugestao')} className="mb-3 w-full rounded-card border border-dashed border-lime/40 px-4 py-3 text-left text-sm">
            <span className="font-semibold text-lime">Sua dieta sugerida</span>
            <span className="block text-xs text-muted">Calculamos a meta pelo seu perfil e montamos 3 opções de cardápio.</span>
          </button>
        )}
        {!plan.meals.length && !logs.length && (
          <button onClick={async () => { await ensureTemplatePlan(); toast('Modelo aplicado. Edite em Plano alimentar.') }} className="mb-3 w-full rounded-card border border-dashed border-lime/40 px-4 py-3 text-left text-sm">
            <span className="font-semibold text-lime">Usar modelo de definição</span>
            <span className="block text-xs text-muted">4 refeições em gramas, 2.300 kcal. Edite como quiser.</span>
          </button>
        )}

        {/* Refeições */}
        <div className="flex flex-col gap-3">
          {meals.map((m) => {
            const ml = logs.filter((l) => l.mealName === m.name)
            const eaten = sumLogs(ml)
            const plannedItems = m.planned?.items ?? []
            return (
              <Card key={m.name} className="!p-0">
                <div className="flex items-center justify-between px-4 pt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold">{m.name}</span>
                    {settings.showTimes && m.time && <span className="num text-xs text-muted">{m.time}</span>}
                  </div>
                  <button className="h-8 w-8 text-xl text-muted" onClick={() => setMenu(m.name)} aria-label={`Opções de ${m.name}`}>⋮</button>
                </div>
                <div className="px-2 pb-2 pt-1"><MacroRow c={eaten.c} p={eaten.p} f={eaten.f} kcal={eaten.kcal} /></div>

                {ml.length > 0 && (
                  <ul className="divide-y divide-border border-t border-border">
                    {ml.map((l) => {
                      const f = foods.get(l.foodId ?? l.recipeId ?? '')
                      return (
                        <li key={l.id} className="flex items-center gap-2 py-2 pl-4 pr-2">
                          <button className="min-w-0 flex-1 text-left" onClick={() => setEditLog(l)}>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm">{f?.name ?? 'Alimento'}</span>
                              <span className="num shrink-0 text-xs font-semibold text-lime">{r0(l.macros.kcal)}</span>
                            </div>
                            <div className="num flex justify-between gap-2 text-[11px] text-muted">
                              <span>{l.grams} g</span>
                              <span>C: <b className="text-carb">{r1(l.macros.c)}</b> P: <b className="text-prot">{r1(l.macros.p)}</b> G: <b className="text-fat">{r1(l.macros.f)}</b></span>
                            </div>
                          </button>
                          {f?.swapGroup && <button className="h-8 w-8 shrink-0 rounded-full text-sm text-muted" onClick={() => setSwap(l)} aria-label="Trocar">⇄</button>}
                          <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-danger" onClick={() => apagar(l)} aria-label="Apagar alimento">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" /></svg>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {ml.length === 0 && plannedItems.length > 0 && !isFuture && (
                  <div className="border-t border-border px-4 py-2.5">
                    <div className="mb-2 text-[11px] text-muted">Plano: {plannedItems.map((it) => `${foods.get(itemKey(it))?.name.split(',')[0] ?? '?'} ${it.grams} g`).join(' · ')}</div>
                    <button onClick={() => m.planned && comiPlanejado(m.planned)} className="h-9 rounded-full bg-lime px-4 text-sm font-semibold text-onlime">✓ Comi como planejado</button>
                    <span className="num ml-2 text-xs text-muted">{r0(mealMacros(plannedItems, foods).kcal)} kcal</span>
                  </div>
                )}

                <button onClick={() => nav(`/dieta/adicionar/${date}/${encodeURIComponent(m.name)}`)} className="flex w-full items-center justify-center gap-2 border-t border-border py-3 text-sm font-semibold text-lime">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime text-xs text-onlime">+</span> Adicionar alimentos
                </button>
              </Card>
            )
          })}

          {/* Exercício */}
          <Card>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Exercício</span>
              <span className="num text-sm text-muted">{exercise?.sess.length ? `${exercise.sess.length} treino${exercise.sess.length > 1 ? 's' : ''}` : '—'}{exercise?.cardio.length ? ` · ${exercise.cardio.reduce((a, c) => a + c.minutes, 0)} min cardio` : ''}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{exercise?.sess.length ? exercise.sess.map((s) => s.routineName).join(', ') + '.' : 'Os treinos e o cardio registrados aparecem aqui.'} O gasto do exercício já entra no cálculo das suas metas.</p>
          </Card>

          {/* Água */}
          <Card>
            <div className="flex items-center gap-4">
              <Ring value={water ?? 0} max={tgt.t?.waterMl ?? 3000} size={60} stroke={7} color="#5AA9FF">
                <span className="num text-[11px] font-bold">{((water ?? 0) / 1000).toFixed(1).replace('.', ',')} L</span>
              </Ring>
              <div className="flex-1">
                <div className="flex items-baseline justify-between"><span className="font-semibold">Água</span><span className="num text-xs text-muted">meta {((tgt.t?.waterMl ?? 3000) / 1000).toFixed(1).replace('.', ',')} L</span></div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[250, 500, 1000].map((v) => <Chip key={v} onClick={() => save('water', { date, ml: v })}>+{v >= 1000 ? '1 L' : `${v} ml`}</Chip>)}
                  {(water ?? 0) > 0 && <Chip onClick={() => save('water', { date, ml: -250 })}>−250</Chip>}
                </div>
              </div>
            </div>
          </Card>

          {!!supplements?.length && (
            <Card>
              <span className="font-semibold">Suplementos</span>
              <div className="mt-2 flex flex-wrap gap-2">
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

          <button onClick={() => setNoteOpen(true)} className="w-full rounded-card border border-dashed border-border px-4 py-3 text-left text-sm text-muted">
            {note?.text ? <>📝 {note.text}{note.isCheatMeal ? ' · refeição livre' : ''}</> : '+ Nota do dia / refeição livre'}
          </button>
          <p className="pb-2 text-center text-[11px] text-muted/70">Alimentos: Tabela TACO, 4ª ed., NEPA/UNICAMP, 2011.</p>
        </div>
      </div>

      {/* Menu da refeição (⋮) */}
      <BottomSheet open={!!menu} onClose={() => setMenu(null)} title={menu ?? ''}>
        {menu && (() => {
          const m = meals.find((x) => x.name === menu)
          const ml = logs.filter((l) => l.mealName === menu)
          const opt = (label: string, fn: () => void, danger = false) => (
            <button key={label} onClick={() => { fn(); setMenu(null) }} className={`w-full border-b border-border py-3.5 text-left text-sm last:border-0 ${danger ? 'text-danger' : ''}`}>{label}</button>
          )
          return (
            <div>
              {opt('Adicionar alimentos', () => nav(`/dieta/adicionar/${date}/${encodeURIComponent(menu)}`))}
              {!!m?.planned?.items.length && opt('Comi como planejado', () => comiPlanejado(m.planned!))}
              {opt('Copiar de ontem', () => copiarOntem(menu))}
              {opt('Adicionar refeição favorita', () => setFavFor(menu))}
              {ml.length > 0 && opt('Salvar como favorita', async () => { await save('favoriteMeals', { name: `${menu} padrão`, items: ml.map((l) => ({ foodId: l.foodId, recipeId: l.recipeId, grams: l.grams })) }); toast('Salva como favorita') })}
              {ml.length > 0 && opt(`Apagar todos os alimentos (${ml.length})`, () => limpar(menu), true)}
            </div>
          )
        })()}
      </BottomSheet>

      {/* Menu do topo */}
      <BottomSheet open={topMenu} onClose={() => setTopMenu(false)} title="Diário">
        {[
          ['Definições do diário', () => nav('/dieta/definicoes')],
          ['Metas', () => nav('/dieta/metas')],
          ['Plano alimentar', () => nav('/dieta/plano')],
          ['Ir para hoje', () => setDate(today)],
        ].map(([l, fn]) => (
          <button key={l as string} onClick={() => { (fn as () => void)(); setTopMenu(false) }} className="w-full border-b border-border py-3.5 text-left text-sm last:border-0">{l as string}</button>
        ))}
      </BottomSheet>

      <EditLogSheet log={editLog} foods={foods} onClose={() => setEditLog(null)} onDelete={apagar} />
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
        {!favorites?.length ? <p className="text-sm text-muted">Registre uma refeição e use "Salvar como favorita" no menu ⋮.</p> : (
          <div className="flex flex-col gap-2">
            {favorites.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-btn border border-border bg-surface2 px-3 py-2.5">
                <button className="flex-1 text-left" onClick={async () => { for (const it of f.items) await logFood(date, favFor!, it, foods); setFavFor(null); toast('Favorita adicionada') }}>
                  <span className="block text-sm font-semibold">{f.name}</span>
                  <span className="num text-xs text-muted">{r0(mealMacros(f.items, foods).kcal)} kcal · {f.items.length} itens</span>
                </button>
                <button className="px-2 text-xs text-muted" onClick={() => remove('favoriteMeals', f.id)}>Apagar</button>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
      <NoteSheet open={noteOpen} onClose={() => setNoteOpen(false)} date={date} note={note} />
      {!isFuture && logs.length === 0 && plan.meals.length === 0 && settings.meals.length === 0 && <div className="py-10 text-center opacity-50"><VeyroMark size={30} variant="mono" /></div>}
    </div>
  )
}

function EditLogSheet({ log, foods, onClose, onDelete }: { log: FoodLog | null; foods: Map<string, FoodLike>; onClose: () => void; onDelete: (l: FoodLog) => void }) {
  const [g, setG] = useState(100)
  const f = log ? foods.get(log.foodId ?? log.recipeId ?? '') : undefined
  const [lastKey, setLastKey] = useState<string | undefined>()
  if (log?.id !== lastKey) {
    setLastKey(log?.id)
    if (log) setG(log.grams)
  }
  return (
    <BottomSheet open={!!log} onClose={onClose} title={f?.name ?? 'Alimento'} footer={
      <div className="flex gap-2">
        <button className="h-[52px] rounded-btn border border-danger/50 px-4 font-semibold text-danger" onClick={() => { if (log) onDelete(log); onClose() }}>Apagar</button>
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
      <Label className="mt-4">Dica</Label>
      <p className="text-xs text-muted">A refeição livre não quebra a sequência: a média da semana absorve.</p>
    </BottomSheet>
  )
}
