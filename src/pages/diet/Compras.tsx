import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type MealItem, type PlanMeal, type ShoppingList } from '../../db/schema'
import { mine, save } from '../../db/repo'
import { Header } from '../../ui/Header'
import { Card, Chip, EmptyState, Label, PrimaryButton } from '../../ui/primitives'
import { useToast } from '../../ui/overlays'
import { foodsMap, itemKey, plannedMeals, type FoodLike } from '../../lib/diet'
import { buildShoppingList } from '../../domain/foodlogic'
import { localDate } from '../../domain/plan'
import { useSession } from '../../store/session'

const SECTIONS: Record<string, string> = { hortifruti: 'Hortifruti', acougue: 'Açougue e peixaria', mercearia: 'Mercearia', laticinios: 'Laticínios e ovos', padaria: 'Padaria', suplementos: 'Suplementos', congelados: 'Prontos e congelados' }
const fmtG = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1).replace('.', ',')} kg` : `${g} g`)

/** Receitas viram seus ingredientes na lista. */
function expandRecipes(meals: PlanMeal[], recipes: Map<string, { ingredients: MealItem[]; cookedWeightG: number }>): PlanMeal[] {
  return meals.map((m) => ({
    ...m,
    items: m.items.flatMap((it) => {
      const r = recipes.get(itemKey(it))
      if (!r || !r.cookedWeightG) return [it]
      const k = it.grams / r.cookedWeightG
      return r.ingredients.map((x) => ({ ...x, grams: x.grams * k }))
    }),
  }))
}

export default function Compras() {
  const toast = useToast((s) => s.show)
  const uid = useSession((s) => s.user?.id)
  const [days, setDays] = useState(7)
  const foods = useLiveQuery(() => foodsMap(), [uid])
  const data = useLiveQuery(async () => {
    const recipes = new Map(mine(await db.recipes.toArray()).map((r) => [r.id, r]))
    const out: PlanMeal[][] = []
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      out.push(expandRecipes((await plannedMeals(localDate(d))).meals, recipes))
    }
    return out
  }, [uid, days])
  const saved = useLiveQuery(async () => (mine(await db.shoppingLists.toArray()) as ShoppingList[]).at(-1), [uid])
  const checked = useMemo(() => new Map((saved?.items ?? []).map((i) => [i.foodId, i])), [saved])
  const list = useMemo(() => {
    if (!foods || !data) return []
    const home: Record<string, number> = {}
    for (const i of saved?.items ?? []) if (i.haveAtHome) home[i.foodId] = 1e9
    return buildShoppingList(data, foods as Map<string, FoodLike>, home)
  }, [foods, data, saved])

  async function toggle(foodId: string, field: 'checked' | 'haveAtHome') {
    const items = [...(saved?.items ?? [])]
    const idx = items.findIndex((i) => i.foodId === foodId)
    const base = idx >= 0 ? items[idx] : { foodId, rawGrams: 0, section: '', checked: false, haveAtHome: false }
    const next = { ...base, [field]: !base[field] }
    if (idx >= 0) items[idx] = next
    else items.push(next)
    await save('shoppingLists', { ...(saved ?? {}), rangeStart: localDate(), rangeEnd: localDate(), items })
  }

  function texto() {
    const by = new Map<string, string[]>()
    for (const i of list) by.set(i.section, [...(by.get(i.section) ?? []), `• ${i.name}: ${i.units ? `${i.units} un.` : fmtG(i.grams)}`])
    return `🛒 Lista VEYRO (${days} dias)\n\n` + [...by.entries()].map(([s, l]) => `${SECTIONS[s] ?? s}\n${l.join('\n')}`).join('\n\n')
  }
  async function compartilhar() {
    const t = texto()
    const nav = navigator as Navigator
    if (nav.share) await nav.share({ text: t }).catch(() => {})
    else {
      await navigator.clipboard?.writeText(t).catch(() => {})
      toast('Lista copiada')
    }
  }

  const sections = [...new Set(list.map((i) => i.section))]
  return (
    <div className="pb-28">
      <Header title="Lista de compras" subtitle="Dieta" />
      <div className="mb-4 flex gap-2">{[7, 14].map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d} dias</Chip>)}</div>
      {!list.length ? (
        <EmptyState title="Nada para comprar" text="Monte seu plano alimentar: a lista sai dele, já em peso cru." />
      ) : (
        sections.map((s) => (
          <div key={s} className="mb-4">
            <Label className="mb-2">{SECTIONS[s] ?? s}</Label>
            <Card className="!p-0">
              <ul className="divide-y divide-border">
                {list.filter((i) => i.section === s).map((i) => {
                  const st = checked.get(i.foodId)
                  return (
                    <li key={i.foodId} className="flex items-center gap-3 px-4 py-3">
                      <button onClick={() => toggle(i.foodId, 'checked')} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${st?.checked ? 'border-lime bg-lime text-onlime' : 'border-border'}`} aria-label="Marcar">{st?.checked ? '✓' : ''}</button>
                      <div className={`min-w-0 flex-1 ${st?.checked ? 'text-muted line-through' : ''}`}>
                        <div className="truncate text-sm">{i.name}</div>
                        {i.note && <div className="text-[11px] text-muted">{i.note}</div>}
                      </div>
                      <span className="num shrink-0 text-sm font-semibold">{i.units ? `${i.units} un.` : fmtG(i.grams)}</span>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </div>
        ))
      )}
      {!!(saved?.items ?? []).some((i) => i.haveAtHome) && <p className="text-xs text-muted">Itens marcados como "já tenho" foram removidos.</p>}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          <PrimaryButton full disabled={!list.length} onClick={compartilhar}>Enviar lista (WhatsApp)</PrimaryButton>
        </div>
      </div>
    </div>
  )
}
