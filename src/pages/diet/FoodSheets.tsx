import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type FoodLog, type MealItem } from '../../db/schema'
import { mine } from '../../db/repo'
import { BottomSheet } from '../../ui/overlays'
import { Chip, Label, PrimaryButton } from '../../ui/primitives'
import { WheelPicker } from '../../ui/WheelPicker'
import { macrosFor } from '../../domain/nutrition'
import { equivalentGrams } from '../../domain/foodlogic'
import type { FoodLike } from '../../lib/diet'

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca tolerante a acento; todas as palavras precisam aparecer; "começa com" vem primeiro. */
export function searchFoods(foods: FoodLike[], q: string, limit = 60) {
  const toks = norm(q).split(/[\s,]+/).filter(Boolean)
  if (!toks.length) return []
  const scored: [FoodLike, number][] = []
  for (const f of foods) {
    const n = norm(f.name)
    if (!toks.every((t) => n.includes(t))) continue
    let score = n.startsWith(toks[0]) ? 0 : 10
    if (f.user_id) score -= 5
    if (f.isRecipe) score -= 4
    score += n.length / 100
    scored.push([f, score])
  }
  return scored.sort((a, b) => a[1] - b[1]).slice(0, limit).map((x) => x[0])
}

export function MacroLine({ f, grams }: { f: FoodLike; grams: number }) {
  const m = macrosFor(f, grams)
  return (
    <span className="num text-xs text-muted">
      {Math.round(m.kcal)} kcal · P {Math.round(m.p)} · C {Math.round(m.c)} · G {Math.round(m.f)}
    </span>
  )
}

export function GramsPicker({ food, grams, onChange }: { food: FoodLike; grams: number; onChange: (g: number) => void }) {
  return (
    <div>
      <div className="mb-2 text-center"><MacroLine f={food} grams={grams} /></div>
      <WheelPicker min={5} max={1500} step={5} value={grams} onChange={onChange} format={(g) => `${g} g`} label="gramas" accent />
    </div>
  )
}

/** Busca + escolha de quantidade. */
export function FoodSearchSheet({ open, onClose, foods, onPick, title = 'Adicionar alimento' }: { open: boolean; onClose: () => void; foods: Map<string, FoodLike>; onPick: (item: MealItem, food: FoodLike) => void; title?: string }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<FoodLike | null>(null)
  const [grams, setGrams] = useState(100)
  const recent = useLiveQuery(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const logs = mine(await db.foodLogs.where('date').aboveOrEqual(since).toArray()) as FoodLog[]
    const count = new Map<string, { n: number; g: number }>()
    for (const l of logs) {
      const k = l.foodId ?? l.recipeId ?? ''
      const c = count.get(k) ?? { n: 0, g: l.grams }
      count.set(k, { n: c.n + 1, g: l.grams })
    }
    return [...count.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 12)
  }, [open])
  useEffect(() => {
    if (!open) { setQ(''); setSel(null) }
  }, [open])
  const all = useMemo(() => [...foods.values()], [foods])
  const results = q ? searchFoods(all, q) : []
  const mineList = all.filter((f) => f.user_id)

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={sel ? sel.name : title}
      footer={sel ? (
        <div className="flex gap-2">
          <PrimaryButton variant="ghost" onClick={() => setSel(null)}>Voltar</PrimaryButton>
          <PrimaryButton full onClick={() => { onPick(sel.isRecipe ? { recipeId: sel.id, grams } : { foodId: sel.id, grams }, sel); onClose() }}>Adicionar {grams} g</PrimaryButton>
        </div>
      ) : undefined}
    >
      {sel ? (
        <GramsPicker food={sel} grams={grams} onChange={setGrams} />
      ) : (
        <>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar (ex.: arroz cozido, frango grelhado)" className="mb-3 h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base outline-none focus:border-lime" />
          {!q && recent && recent.length > 0 && <Label className="mb-1">Recentes</Label>}
          <div className="flex flex-col divide-y divide-border">
            {(q ? results.map((f) => [f, 100] as const) : (recent ?? []).map(([id, r]) => [foods.get(id), r.g] as const).filter((x): x is readonly [FoodLike, number] => !!x[0])).map(([f, g]) => (
              <button key={f.id} onClick={() => { setSel(f); setGrams(g) }} className="flex items-center justify-between gap-3 py-3 text-left">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{f.name}{f.isRecipe ? <span className="label ml-2 text-lime">receita</span> : f.user_id ? <span className="label ml-2 text-lime">seu</span> : null}</span>
                  <span className="num text-xs text-muted">{Math.round(f.per100g.kcal)} kcal · P {f.per100g.p.toFixed(0)} · C {f.per100g.c.toFixed(0)} · G {f.per100g.f.toFixed(0)} /100 g</span>
                </span>
                <span className="text-lime">+</span>
              </button>
            ))}
          </div>
          {q && results.length === 0 && <p className="py-6 text-center text-sm text-muted">Nada encontrado. Crie em Dieta → Alimentos e receitas.</p>}
          {!q && !recent?.length && mineList.length === 0 && <p className="py-6 text-center text-sm text-muted">597 alimentos da tabela TACO. Digite para buscar.</p>}
        </>
      )}
    </BottomSheet>
  )
}

/** Trocas equivalentes em gramas (mesmo grupo). */
export function SwapSheet({ open, onClose, foods, food, grams, onPick }: { open: boolean; onClose: () => void; foods: Map<string, FoodLike>; food?: FoodLike; grams: number; onPick: (f: FoodLike, grams: number) => void }) {
  const [q, setQ] = useState('')
  const options = useMemo(() => {
    if (!food) return []
    const pool = [...foods.values()].filter((f) => f.id !== food.id && f.swapGroup === food.swapGroup && f.state !== 'raw' && f.per100g.kcal > 0)
    if (q) return searchFoods(pool, q, 60)
    return pool.sort((a, b) => Number(!!b.user_id) - Number(!!a.user_id) || a.name.length - b.name.length).slice(0, 60)
  }, [food, foods, q])
  if (!food) return null
  return (
    <BottomSheet open={open} onClose={onClose} title={`Trocar ${grams} g de ${food.name}`}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar (ex.: batata, mandioca)" className="mb-3 h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base outline-none focus:border-lime" />
      <div className="flex flex-col divide-y divide-border">
        {options.map((f) => {
          const g = equivalentGrams(food, grams, f)
          return (
            <button key={f.id} onClick={() => { onPick(f, g); onClose() }} className="flex items-center justify-between gap-3 py-3 text-left">
              <span className="min-w-0 truncate text-sm">{f.name}</span>
              <span className="num shrink-0 font-semibold text-lime">{g} g</span>
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}

export function QuickChips({ values, onPick }: { values: number[]; onPick: (v: number) => void }) {
  return <div className="flex flex-wrap gap-2">{values.map((v) => <Chip key={v} onClick={() => onPick(v)}>+{v} ml</Chip>)}</div>
}
