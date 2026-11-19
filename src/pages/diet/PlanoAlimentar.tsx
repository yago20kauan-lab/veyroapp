import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import type { MealItem, PlanMeal } from '../../db/schema'
import { Header } from '../../ui/Header'
import { Card, Chip, EmptyState, Label, PrimaryButton } from '../../ui/primitives'
import { BottomSheet, useToast } from '../../ui/overlays'
import { applyPlanToDays, currentPlan, foodsMap, itemKey, mealMacros, saveDietPlan, targetsFor } from '../../lib/diet'
import { templateDefinicao2300 } from '../../db/seed-nutrition'
import { autoAdjustCarbs } from '../../domain/foodlogic'
import { add, ZERO } from '../../domain/nutrition'
import { localDate } from '../../domain/plan'
import { FoodSearchSheet, GramsPicker, SwapSheet } from './FoodSheets'
import { useSession } from '../../store/session'

export default function PlanoAlimentar() {
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const uid = useSession((s) => s.user?.id)
  const plan = useLiveQuery(async () => ({ p: await currentPlan() }), [uid])
  const foods = useLiveQuery(() => foodsMap(), [uid])
  const tgt = useLiveQuery(() => targetsFor(localDate()), [uid])
  const [meals, setMeals] = useState<PlanMeal[] | null>(null)
  const [name, setName] = useState('Meu plano')
  const [dirty, setDirty] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [edit, setEdit] = useState<{ m: number; i: number } | null>(null)
  const [swap, setSwap] = useState<{ m: number; i: number } | null>(null)
  const [apply, setApply] = useState(false)

  useEffect(() => {
    if (plan && meals === null) {
      setMeals(plan.p ? structuredClone(plan.p.meals) : [])
      if (plan.p) setName(plan.p.name)
    }
  }, [plan, meals])

  if (!foods || !meals || !tgt) return null
  const upd = (next: PlanMeal[]) => { setMeals(next); setDirty(true) }
  const total = meals.reduce((a, m) => add(a, mealMacros(m.items, foods)), ZERO)
  const t = tgt.targets
  const diff = (a: number, b: number) => { const d = Math.round(a - b); return `${d > 0 ? '+' : ''}${d}` }

  async function salvar() {
    const p = await saveDietPlan(name, meals!)
    setDirty(false)
    toast('Plano salvo')
    return p
  }

  return (
    <div className="pb-28">
      <Header title="Plano alimentar" subtitle="Dieta" />
      {meals.length === 0 ? (
        <EmptyState title="Plano vazio" text="Comece pelo modelo de definição (4 refeições em gramas) ou crie suas refeições." action={
          <div className="flex flex-col gap-2">
            <PrimaryButton onClick={() => { upd(structuredClone(templateDefinicao2300.meals)); setName(templateDefinicao2300.name) }}>Usar modelo 2.300 kcal</PrimaryButton>
            <PrimaryButton variant="ghost" onClick={() => upd([{ name: 'Café da manhã', time: '08:00', items: [] }])}>Criar do zero</PrimaryButton>
          </div>
        } />
      ) : (
        <>
          <Card className="mb-4">
            <Label>Total do plano vs. meta</Label>
            <div className="num mt-2 grid grid-cols-4 gap-2 text-center text-sm">
              {([['kcal', total.kcal, t.kcal], ['P', total.p, t.p], ['C', total.c, t.c], ['G', total.f, t.f]] as const).map(([l, v, g]) => (
                <div key={l} className="rounded-btn bg-surface2 py-2">
                  <div className="font-bold">{Math.round(v)}</div>
                  <div className={`text-xs ${Math.abs(v - g) / (g || 1) <= 0.05 ? 'text-lime' : 'text-gold'}`}>{g ? diff(v, g) : '—'}</div>
                  <div className="label mt-0.5">{l}</div>
                </div>
              ))}
            </div>
            {t.c > 0 && <PrimaryButton variant="ghost" full className="mt-3" onClick={() => { upd(autoAdjustCarbs(meals, foods, t.c)); toast('Carboidratos ajustados para a meta') }}>Ajustar automaticamente</PrimaryButton>}
          </Card>

          <div className="flex flex-col gap-3">
            {meals.map((m, mi) => {
              const mm = mealMacros(m.items, foods)
              return (
                <Card key={mi} className="!p-0">
                  <div className="flex items-center gap-2 px-4 pt-3">
                    <input type="time" value={m.time} onChange={(e) => upd(meals.map((x, j) => (j === mi ? { ...x, time: e.target.value } : x)))} className="num h-9 w-[88px] rounded-[10px] border border-border bg-surface2 px-2 text-sm text-lime [color-scheme:dark]" />
                    <input value={m.name} onChange={(e) => upd(meals.map((x, j) => (j === mi ? { ...x, name: e.target.value } : x)))} className="h-9 min-w-0 flex-1 rounded-[10px] border border-transparent bg-transparent px-1 font-semibold outline-none focus:border-border" />
                    <button className="text-xs text-danger" onClick={() => upd(meals.filter((_, j) => j !== mi))}>Remover</button>
                  </div>
                  <div className="num px-4 pb-2 text-xs text-muted">{Math.round(mm.kcal)} kcal · P {Math.round(mm.p)} · C {Math.round(mm.c)} · G {Math.round(mm.f)}</div>
                  <ul className="divide-y divide-border border-t border-border">
                    {m.items.map((it, i) => {
                      const f = foods.get(itemKey(it))
                      return (
                        <li key={i} className="flex items-center gap-2 px-4 py-2.5">
                          <button className="min-w-0 flex-1 text-left" onClick={() => setEdit({ m: mi, i })}>
                            <span className="block truncate text-sm">{f?.name ?? '?'}</span>
                            <span className="num text-xs text-muted">{it.grams} g</span>
                          </button>
                          {f?.swapGroup && <button className="h-8 rounded-full border border-border px-2.5 text-xs" onClick={() => setSwap({ m: mi, i })}>⇄</button>}
                          <button className="h-8 w-8 rounded-full border border-border text-danger" onClick={() => upd(meals.map((x, j) => (j === mi ? { ...x, items: x.items.filter((_, k) => k !== i) } : x)))}>×</button>
                        </li>
                      )
                    })}
                  </ul>
                  <button className="w-full border-t border-border py-2.5 text-sm text-lime" onClick={() => setAdding(mi)}>+ Alimento</button>
                </Card>
              )
            })}
          </div>
          <PrimaryButton variant="ghost" full className="mt-3" onClick={() => upd([...meals, { name: `Refeição ${meals.length + 1}`, time: '', items: [] }])}>+ Refeição</PrimaryButton>
          {plan?.p && !dirty && <PrimaryButton variant="ghost" full className="mt-2" onClick={() => setApply(true)}>Planejar próximos dias</PrimaryButton>}
        </>
      )}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          <PrimaryButton variant="ghost" onClick={() => nav('/dieta')}>Voltar</PrimaryButton>
          <PrimaryButton full disabled={!dirty || !meals.length} onClick={salvar}>Salvar plano</PrimaryButton>
        </div>
      </div>

      <FoodSearchSheet open={adding !== null} onClose={() => setAdding(null)} foods={foods} onPick={(item: MealItem) => adding !== null && upd(meals.map((x, j) => (j === adding ? { ...x, items: [...x.items, item] } : x)))} />
      <EditItem foods={foods} item={edit ? meals[edit.m]?.items[edit.i] : undefined} onClose={() => setEdit(null)} onSave={(g) => edit && upd(meals.map((x, j) => (j === edit.m ? { ...x, items: x.items.map((it, k) => (k === edit.i ? { ...it, grams: g } : it)) } : x)))} />
      <SwapSheet
        open={!!swap}
        onClose={() => setSwap(null)}
        foods={foods}
        food={swap ? foods.get(itemKey(meals[swap.m].items[swap.i])) : undefined}
        grams={swap ? meals[swap.m].items[swap.i].grams : 0}
        onPick={(f, g) => swap && upd(meals.map((x, j) => (j === swap.m ? { ...x, items: x.items.map((it, k) => (k === swap.i ? { foodId: f.id, grams: g } : it)) } : x)))}
      />
      <BottomSheet open={apply} onClose={() => setApply(false)} title="Planejar próximos dias">
        <p className="mb-4 text-sm text-muted">Copia o plano para os próximos dias. Depois dá para mudar qualquer dia no Diário sem afetar os outros.</p>
        <div className="flex flex-wrap gap-2">
          {[7, 14, 30].map((d) => <Chip key={d} onClick={async () => { if (plan?.p) await applyPlanToDays(plan.p, d); setApply(false); toast(`Plano aplicado aos próximos ${d} dias`) }}>{d} dias</Chip>)}
        </div>
      </BottomSheet>
    </div>
  )
}

function EditItem({ item, foods, onClose, onSave }: { item?: MealItem; foods: Map<string, import('../../lib/diet').FoodLike>; onClose: () => void; onSave: (g: number) => void }) {
  const [g, setG] = useState(100)
  useEffect(() => { if (item) setG(item.grams) }, [item])
  const f = item ? foods.get(itemKey(item)) : undefined
  return (
    <BottomSheet open={!!item} onClose={onClose} title={f?.name} footer={<PrimaryButton full onClick={() => { onSave(g); onClose() }}>Salvar {g} g</PrimaryButton>}>
      {f && <GramsPicker food={f} grams={g} onChange={setG} />}
    </BottomSheet>
  )
}
