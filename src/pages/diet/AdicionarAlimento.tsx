import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type FoodLog } from '../../db/schema'
import { mine } from '../../db/repo'
import { PrimaryButton } from '../../ui/primitives'
import { BottomSheet, useToast } from '../../ui/overlays'
import { foodsMap, logFood, diarySettings, type FoodLike } from '../../lib/diet'
import { macrosFor } from '../../domain/nutrition'
import { GramsPicker, norm, searchFoods } from './FoodSheets'
import { useSession } from '../../store/session'

type Tab = 'meus' | 'receitas' | 'biblioteca'
const r1 = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')

function Row({ f, grams, selected, onToggle, onOpen }: { f: FoodLike; grams: number; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const m = macrosFor(f, grams)
  return (
    <li className="flex items-center gap-3 border-b border-border py-2.5 pl-4 pr-4">
      <button onClick={onToggle} aria-label={selected ? 'Desmarcar' : 'Selecionar'} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${selected ? 'border-lime bg-lime text-onlime' : 'border-border'}`}>
        {selected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5L20 7" /></svg>}
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm">{f.name}</span>
          <span className="num shrink-0 text-sm font-semibold text-lime">{Math.round(m.kcal)}</span>
        </div>
        <div className="num flex justify-between gap-2 text-[11px] text-muted">
          <span className="truncate">{f.isRecipe ? 'Receita' : f.category ?? (f.user_id ? 'Meu alimento' : '')}{(f.isRecipe || f.category || f.user_id) ? ', ' : ''}{grams} g</span>
          <span className="shrink-0">C: <b className="text-carb">{r1(m.c)}</b> P: <b className="text-prot">{r1(m.p)}</b> G: <b className="text-fat">{r1(m.f)}</b></span>
        </div>
      </button>
    </li>
  )
}

export default function AdicionarAlimento() {
  const { date = '', meal = '' } = useParams()
  const mealName = decodeURIComponent(meal)
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const uid = useSession((s) => s.user?.id)
  const foods = useLiveQuery(() => foodsMap(), [uid])
  const settings = useLiveQuery(() => diarySettings(), [uid])
  const recent = useLiveQuery(async () => {
    const since = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10)
    const logs = mine(await db.foodLogs.where('date').aboveOrEqual(since).toArray()) as FoodLog[]
    const m = new Map<string, { n: number; g: number; last: string }>()
    for (const l of logs) {
      const k = l.foodId ?? l.recipeId
      if (!k) continue
      const c = m.get(k)
      m.set(k, { n: (c?.n ?? 0) + 1, g: !c || l.date >= c.last ? l.grams : c.g, last: c && c.last > l.date ? c.last : l.date })
    }
    return [...m.entries()].sort((a, b) => b[1].last.localeCompare(a[1].last) || b[1].n - a[1].n).slice(0, 15)
  }, [uid])
  const [tab, setTab] = useState<Tab>('meus')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Map<string, number>>(new Map())
  const [showRecent, setShowRecent] = useState(true)
  const [open, setOpen] = useState<{ f: FoodLike; g: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const all = useMemo(() => [...(foods?.values() ?? [])], [foods])
  const defaultG = (id: string) => sel.get(id) ?? recent?.find(([k]) => k === id)?.[1].g ?? 100
  const toggle = (f: FoodLike) => setSel((s) => { const n = new Map(s); if (n.has(f.id)) n.delete(f.id); else n.set(f.id, defaultG(f.id)); return n })

  const mineFoods = all.filter((f) => f.user_id && !f.isRecipe).sort((a, b) => a.name.localeCompare(b.name))
  const recipes = all.filter((f) => f.isRecipe).sort((a, b) => a.name.localeCompare(b.name))
  const library = all.filter((f) => !f.user_id)

  const filt = (list: FoodLike[]) => (q ? searchFoods(list, q, 80) : list)
  const groups = (list: FoodLike[]) => {
    const g = new Map<string, FoodLike[]>()
    for (const f of list) { const k = norm(f.name.charAt(0)).toUpperCase(); g.set(k, [...(g.get(k) ?? []), f]) }
    return [...g.entries()]
  }

  async function adicionar(items: [string, number][]) {
    if (!foods) return
    setBusy(true)
    const time = settings?.meals.find((m) => m.name === mealName)?.time
    for (const [id, g] of items) {
      const f = foods.get(id)
      if (!f) continue
      await logFood(date, mealName, f.isRecipe ? { recipeId: id, grams: g } : { foodId: id, grams: g }, foods, false, time)
    }
    setBusy(false)
    toast(`${items.length} alimento${items.length > 1 ? 's' : ''} em ${mealName}`)
    nav(-1)
  }

  if (!foods) return null
  const renderList = (list: FoodLike[]) => list.map((f) => <Row key={f.id} f={f} grams={defaultG(f.id)} selected={sel.has(f.id)} onToggle={() => toggle(f)} onOpen={() => setOpen({ f, g: defaultG(f.id) })} />)

  return (
    <div className="pt-safe mx-auto flex min-h-full max-w-md flex-col pb-28">
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-2 pt-2">
          <button className="h-11 w-11 text-2xl" onClick={() => nav(-1)} aria-label="Voltar">‹</button>
          <div className="text-center"><div className="font-display text-base font-bold">Adicionar</div><div className="text-[11px] text-muted">{mealName}</div></div>
          <button className="h-11 w-11 text-2xl text-lime" onClick={() => nav('/dieta/alimentos')} aria-label="Criar alimento">+</button>
        </div>
        <div className="px-4 pb-2 pt-1">
          <div className="flex h-11 items-center gap-2 rounded-btn border border-border bg-surface2 px-3 focus-within:border-lime">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AA3AE" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar" className="h-full flex-1 bg-transparent text-base outline-none" />
            {q && <button className="text-muted" onClick={() => setQ('')}>×</button>}
          </div>
        </div>
        <div className="grid grid-cols-3 border-b border-border">
          {([['meus', 'Meus alimentos'], ['receitas', 'Minhas receitas'], ['biblioteca', 'Biblioteca']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`pb-2.5 pt-1 text-sm font-semibold ${tab === k ? 'border-b-2 border-lime text-lime' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'meus' && (
        <>
          {!q && !!recent?.length && (
            <>
              <button onClick={() => setShowRecent(!showRecent)} className="flex items-center justify-between bg-surface px-4 py-2.5 text-left text-sm font-semibold">
                Alimentos recentes <span className="text-muted">{showRecent ? '⌃' : '⌄'}</span>
              </button>
              {showRecent && <ul>{renderList(recent.map(([id]) => foods.get(id)).filter((x): x is FoodLike => !!x))}</ul>}
            </>
          )}
          <div className="bg-surface px-4 py-2.5 text-sm font-semibold">Meus alimentos</div>
          {filt(mineFoods).length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted">
              {q ? 'Nenhum alimento seu com esse nome. Veja na Biblioteca.' : 'Você ainda não criou alimentos.'}
              <button className="mt-2 block w-full text-lime" onClick={() => nav('/dieta/alimentos')}>+ Criar alimento pelo rótulo</button>
            </div>
          ) : groups(filt(mineFoods)).map(([letter, list]) => (
            <div key={letter}><div className="px-4 pb-1 pt-3 text-xs font-semibold text-muted">{letter}</div><ul>{renderList(list)}</ul></div>
          ))}
          {q && <button onClick={() => setTab('biblioteca')} className="mx-4 mt-3 rounded-btn border border-border py-3 text-sm text-lime">Buscar "{q}" na Biblioteca (597 alimentos)</button>}
        </>
      )}

      {tab === 'receitas' && (
        filt(recipes).length === 0
          ? <div className="px-4 py-8 text-center text-sm text-muted">Nenhuma receita.<button className="mt-2 block w-full text-lime" onClick={() => nav('/dieta/alimentos')}>+ Criar receita</button></div>
          : <ul>{renderList(filt(recipes))}</ul>
      )}

      {tab === 'biblioteca' && (
        q ? <ul>{renderList(filt(library))}</ul>
          : <div className="px-4 py-8 text-center text-sm text-muted">Digite para buscar entre os 597 alimentos da Tabela TACO.<div className="mt-1 text-xs">Ex.: "arroz cozido", "frango grelhado", "banana".</div></div>
      )}

      {sel.size > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
            <PrimaryButton variant="ghost" onClick={() => setSel(new Map())}>Limpar</PrimaryButton>
            <PrimaryButton full disabled={busy} onClick={() => adicionar([...sel.entries()])}>Adicionar {sel.size} alimento{sel.size > 1 ? 's' : ''}</PrimaryButton>
          </div>
        </div>
      )}

      <BottomSheet open={!!open} onClose={() => setOpen(null)} title={open?.f.name} footer={open && (
        <div className="flex gap-2">
          <PrimaryButton variant="ghost" onClick={() => { setSel((s) => new Map(s).set(open.f.id, open.g)); setOpen(null) }}>Selecionar</PrimaryButton>
          <PrimaryButton full onClick={() => adicionar([[open.f.id, open.g]])}>Adicionar {open.g} g</PrimaryButton>
        </div>
      )}>
        {open && <GramsPicker food={open.f} grams={open.g} onChange={(g) => setOpen({ ...open, g })} />}
      </BottomSheet>
    </div>
  )
}
