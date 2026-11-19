import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Food, type MealItem, type Recipe } from '../../db/schema'
import { mine, remove, save } from '../../db/repo'
import { Header } from '../../ui/Header'
import { Card, Chip, EmptyState, Label, PrimaryButton } from '../../ui/primitives'
import { BottomSheet, useToast } from '../../ui/overlays'
import { foodsMap, itemKey, mealMacros } from '../../lib/diet'
import { FoodSearchSheet } from './FoodSheets'
import { useSession } from '../../store/session'

const n = (s: string) => parseFloat(s.replace(',', '.')) || 0
const groups: [NonNullable<Food['swapGroup']>, string][] = [['carb', 'Carboidrato'], ['protein', 'Proteína'], ['fat', 'Gordura'], ['fruit', 'Fruta'], ['dairy', 'Laticínio'], ['bread', 'Pão/cereal'], ['veg', 'Vegetal']]

export default function Alimentos() {
  const uid = useSession((s) => s.user?.id)
  const toast = useToast((s) => s.show)
  const [tab, setTab] = useState<'alimentos' | 'receitas'>('alimentos')
  const myFoods = useLiveQuery(async () => (await db.foods.toArray()).filter((f) => f.user_id === uid && !f.deleted_at), [uid])
  const recipes = useLiveQuery(async () => mine(await db.recipes.toArray()) as Recipe[], [uid])
  const foods = useLiveQuery(() => foodsMap(), [uid, recipes?.length])
  const [foodOpen, setFoodOpen] = useState(false)
  const [recipe, setRecipe] = useState<Partial<Recipe> | null>(null)

  return (
    <div className="pb-24">
      <Header title="Alimentos e receitas" subtitle="Dieta" />
      <div className="mb-4 flex gap-2"><Chip active={tab === 'alimentos'} onClick={() => setTab('alimentos')}>Meus alimentos</Chip><Chip active={tab === 'receitas'} onClick={() => setTab('receitas')}>Receitas</Chip></div>
      {tab === 'alimentos' ? (
        <>
          {!myFoods?.length ? <EmptyState title="Nenhum alimento próprio" text="A base tem 597 alimentos da TACO. Crie os que faltam (ex.: um produto de marca) pelo rótulo." /> : (
            <div className="flex flex-col gap-2">
              {myFoods.map((f) => (
                <Card key={f.id}>
                  <div className="flex items-center justify-between">
                    <div><div className="font-semibold">{f.name}</div><div className="num text-xs text-muted">{Math.round(f.per100g.kcal)} kcal · P {f.per100g.p} · C {f.per100g.c} · G {f.per100g.f} /100 g</div></div>
                    <button className="text-xs text-muted" onClick={() => remove('foods', f.id)}>Apagar</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <PrimaryButton full className="mt-3" onClick={() => setFoodOpen(true)}>+ Criar alimento</PrimaryButton>
        </>
      ) : (
        <>
          {!recipes?.length ? <EmptyState title="Nenhuma receita" text="Junte ingredientes em gramas, informe o peso final pronto e o VEYRO calcula os macros por 100 g." /> : (
            <div className="flex flex-col gap-2">
              {recipes.map((r) => {
                const tot = foods ? mealMacros(r.ingredients, foods) : null
                return (
                  <Card key={r.id} onClick={() => setRecipe(r)}>
                    <div className="font-semibold">{r.name}</div>
                    {tot && <div className="num text-xs text-muted">{r.cookedWeightG} g pronto · {r.servings} porções · {Math.round(tot.kcal / Math.max(1, r.servings))} kcal/porção · P {Math.round(tot.p / Math.max(1, r.servings))} g</div>}
                  </Card>
                )
              })}
            </div>
          )}
          <PrimaryButton full className="mt-3" onClick={() => setRecipe({ name: '', ingredients: [], cookedWeightG: 0, servings: 1 })}>+ Criar receita</PrimaryButton>
        </>
      )}
      <p className="mt-6 text-center text-[11px] text-muted/70">Base: Tabela Brasileira de Composição de Alimentos (TACO), 4ª ed., NEPA/UNICAMP, 2011.</p>

      <CreateFoodSheet open={foodOpen} onClose={() => setFoodOpen(false)} onSaved={() => toast('Alimento criado')} />
      {foods && <RecipeSheet recipe={recipe} foods={foods} onClose={() => setRecipe(null)} />}
    </div>
  )
}

function CreateFoodSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: '', portion: '100', kcal: '', p: '', c: '', g: '' })
  const [group, setGroup] = useState<NonNullable<Food['swapGroup']> | undefined>()
  const k = 100 / (n(f.portion) || 100)
  return (
    <BottomSheet open={open} onClose={onClose} title="Novo alimento" footer={
      <PrimaryButton full disabled={!f.name.trim() || !n(f.kcal)} onClick={async () => {
        await save('foods', { name: f.name.trim(), per100g: { kcal: Math.round(n(f.kcal) * k), p: +(n(f.p) * k).toFixed(1), c: +(n(f.c) * k).toFixed(1), f: +(n(f.g) * k).toFixed(1) }, state: 'na', swapGroup: group, section: 'mercearia', source: 'custom' } as unknown as Food)
        onSaved(); onClose(); setF({ name: '', portion: '100', kcal: '', p: '', c: '', g: '' })
      }}>Salvar</PrimaryButton>
    }>
      <p className="mb-3 text-sm text-muted">Copie do rótulo. Informe a porção do rótulo; convertemos para 100 g.</p>
      {([['name', 'Nome'], ['portion', 'Porção do rótulo (g)'], ['kcal', 'Calorias'], ['p', 'Proteína (g)'], ['c', 'Carboidrato (g)'], ['g', 'Gordura (g)']] as const).map(([key, l]) => (
        <label key={key} className="mb-3 block">
          <Label className="mb-1">{l}</Label>
          <input value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} inputMode={key === 'name' ? 'text' : 'decimal'} className="h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base outline-none focus:border-lime" />
        </label>
      ))}
      <Label className="mb-2">Grupo de troca</Label>
      <div className="flex flex-wrap gap-2">{groups.map(([g, l]) => <Chip key={g} active={group === g} onClick={() => setGroup(g)}>{l}</Chip>)}</div>
    </BottomSheet>
  )
}

function RecipeSheet({ recipe, foods, onClose }: { recipe: Partial<Recipe> | null; foods: Map<string, import('../../lib/diet').FoodLike>; onClose: () => void }) {
  const [r, setR] = useState<Partial<Recipe> | null>(null)
  const [adding, setAdding] = useState(false)
  if (recipe && r?.id !== recipe.id && (r === null || recipe.id)) setR(structuredClone(recipe))
  if (!recipe && r) setR(null)
  const items: MealItem[] = r?.ingredients ?? []
  const tot = mealMacros(items, foods)
  const raw = items.reduce((a, i) => a + i.grams, 0)
  return (
    <>
      <BottomSheet open={!!recipe && !adding} onClose={onClose} title={r?.id ? 'Editar receita' : 'Nova receita'} footer={
        <div className="flex gap-2">
          {r?.id && <button className="h-[52px] rounded-btn border border-danger/50 px-4 text-danger" onClick={async () => { await remove('recipes', r.id!); onClose() }}>Apagar</button>}
          <PrimaryButton full disabled={!r?.name?.trim() || !items.length} onClick={async () => { await save('recipes', { ...r, cookedWeightG: r!.cookedWeightG || raw, servings: r!.servings || 1 } as Recipe); onClose() }}>Salvar receita</PrimaryButton>
        </div>
      }>
        {r && (
          <>
            <Label className="mb-1">Nome</Label>
            <input value={r.name ?? ''} onChange={(e) => setR({ ...r, name: e.target.value })} className="mb-3 h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base outline-none focus:border-lime" />
            <Label className="mb-1">Ingredientes</Label>
            <ul className="mb-2 divide-y divide-border rounded-btn border border-border">
              {items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{foods.get(itemKey(it))?.name}</span>
                  <input inputMode="numeric" value={it.grams} onChange={(e) => setR({ ...r, ingredients: items.map((x, j) => (j === i ? { ...x, grams: n(e.target.value) } : x)) })} className="num h-9 w-16 rounded-[10px] border border-border bg-bg text-center" />
                  <span className="text-xs text-muted">g</span>
                  <button className="text-danger" onClick={() => setR({ ...r, ingredients: items.filter((_, j) => j !== i) })}>×</button>
                </li>
              ))}
              <li><button className="w-full py-2.5 text-sm text-lime" onClick={() => setAdding(true)}>+ Ingrediente</button></li>
            </ul>
            <div className="grid grid-cols-2 gap-2">
              <label><Label className="mb-1">Peso final pronto (g)</Label><input inputMode="numeric" placeholder={String(raw)} value={r.cookedWeightG || ''} onChange={(e) => setR({ ...r, cookedWeightG: n(e.target.value) })} className="h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base" /></label>
              <label><Label className="mb-1">Porções</Label><input inputMode="numeric" value={r.servings || ''} onChange={(e) => setR({ ...r, servings: n(e.target.value) })} className="h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base" /></label>
            </div>
            <p className="num mt-3 text-sm">Total: {Math.round(tot.kcal)} kcal · P {Math.round(tot.p)} · C {Math.round(tot.c)} · G {Math.round(tot.f)}</p>
            <p className="num text-sm text-muted">Por 100 g pronto: {Math.round((tot.kcal * 100) / ((r.cookedWeightG || raw) || 1))} kcal · P {((tot.p * 100) / ((r.cookedWeightG || raw) || 1)).toFixed(1)} g</p>
          </>
        )}
      </BottomSheet>
      <FoodSearchSheet open={adding} onClose={() => setAdding(false)} foods={new Map([...foods].filter(([, f]) => !f.isRecipe))} title="Ingrediente" onPick={(item) => r && setR({ ...r, ingredients: [...items, item] })} />
    </>
  )
}
