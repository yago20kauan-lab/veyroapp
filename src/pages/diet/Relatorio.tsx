import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DayNote, type FoodLog } from '../../db/schema'
import { mine } from '../../db/repo'
import { Header } from '../../ui/Header'
import { Card, Chip, EmptyState, Label } from '../../ui/primitives'
import { foodsMap, targetsFor } from '../../lib/diet'
import { localDate } from '../../domain/plan'
import { useSession } from '../../store/session'

export default function Relatorio() {
  const uid = useSession((s) => s.user?.id)
  const [days, setDays] = useState(7)
  const data = useLiveQuery(async () => {
    const from = new Date(); from.setDate(from.getDate() - (days - 1))
    const fromS = localDate(from)
    const logs = mine(await db.foodLogs.where('date').aboveOrEqual(fromS).toArray()) as FoodLog[]
    const notes = mine(await db.dayNotes.where('date').aboveOrEqual(fromS).toArray()) as DayNote[]
    const foods = await foodsMap()
    const byDay = new Map<string, { kcal: number; p: number; c: number; f: number }>()
    for (const l of logs) {
      const d = byDay.get(l.date) ?? { kcal: 0, p: 0, c: 0, f: 0 }
      byDay.set(l.date, { kcal: d.kcal + l.macros.kcal, p: d.p + l.macros.p, c: d.c + l.macros.c, f: d.f + l.macros.f })
    }
    const list: { date: string; kcal: number; p: number; target: number }[] = []
    let within = 0
    for (let i = 0; i < days; i++) {
      const d = new Date(from); d.setDate(from.getDate() + i)
      const ds = localDate(d)
      const t = (await targetsFor(ds)).targets
      const v = byDay.get(ds)
      list.push({ date: ds, kcal: v?.kcal ?? 0, p: v?.p ?? 0, target: t.kcal })
      if (v && t.kcal && Math.abs(v.kcal - t.kcal) / t.kcal <= 0.1) within++
    }
    const logged = list.filter((x) => x.kcal > 0)
    const avg = (k: 'kcal' | 'p') => (logged.length ? logged.reduce((a, x) => a + x[k], 0) / logged.length : 0)
    const contrib = (k: 'kcal' | 'p' | 'f') => {
      const m = new Map<string, number>()
      for (const l of logs) { const key = l.foodId ?? l.recipeId ?? l.mealName; m.set(key, (m.get(key) ?? 0) + l.macros[k]) }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, v]) => ({ name: foods.get(id)?.name ?? id, v }))
    }
    const t0 = (await targetsFor(localDate())).targets
    return { list, logged: logged.length, within, avgKcal: avg('kcal'), avgP: avg('p'), target: t0, kcal: contrib('kcal'), prot: contrib('p'), fat: contrib('f'), cheats: notes.filter((n) => n.isCheatMeal).length }
  }, [uid, days])

  if (!data) return null
  const max = Math.max(...data.list.map((x) => Math.max(x.kcal, x.target)), 1)
  return (
    <div className="pb-16">
      <Header title="Relatório" subtitle="Dieta" />
      <div className="mb-4 flex gap-2">{[7, 30].map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d === 7 ? 'Semana' : 'Mês'}</Chip>)}</div>
      {!data.logged ? <EmptyState title="Sem registros no período" text="Marque as refeições no Diário para ver médias e aderência." /> : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <Card><Label>Média</Label><div className="num mt-1 text-xl font-bold">{Math.round(data.avgKcal)}</div><div className="text-xs text-muted">kcal / meta {data.target.kcal}</div></Card>
            <Card><Label>Proteína</Label><div className="num mt-1 text-xl font-bold">{Math.round(data.avgP)} g</div><div className="text-xs text-muted">meta {data.target.p} g</div></Card>
            <Card><Label>Aderência</Label><div className="num mt-1 text-xl font-bold">{Math.round((data.within / days) * 100)}%</div><div className="text-xs text-muted">dias ±10%</div></Card>
          </div>
          <Card className="mb-3">
            <Label className="mb-3">Calorias por dia</Label>
            <div className="flex h-36 items-end gap-1">
              {data.list.map((x) => (
                <div key={x.date} className="relative flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
                  <div className="absolute w-full border-t border-dashed border-muted/50" style={{ bottom: `${(x.target / max) * 100}%` }} />
                  <div className={`w-full rounded-t ${x.kcal > x.target * 1.1 ? 'bg-gold' : 'bg-lime'}`} style={{ height: `${(x.kcal / max) * 100}%`, minHeight: x.kcal ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted"><span>{data.list[0].date.slice(8)}/{data.list[0].date.slice(5, 7)}</span><span>hoje</span></div>
          </Card>
          {([['Maiores fontes de calorias', data.kcal, 'kcal'], ['Maiores fontes de proteína', data.prot, 'g'], ['Maiores fontes de gordura', data.fat, 'g']] as const).map(([t, l, u]) => (
            <Card key={t} className="mb-3">
              <Label className="mb-2">{t}</Label>
              <ul className="space-y-1 text-sm">{l.map((x) => <li key={x.name} className="flex justify-between gap-2"><span className="truncate">{x.name}</span><span className="num shrink-0 text-muted">{Math.round(x.v)} {u}</span></li>)}</ul>
            </Card>
          ))}
          {data.cheats > 0 && <p className="text-sm text-muted">Refeições livres no período: {data.cheats}</p>}
        </>
      )}
    </div>
  )
}
