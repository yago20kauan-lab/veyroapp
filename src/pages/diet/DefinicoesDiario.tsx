import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Label, PrimaryButton } from '../../ui/primitives'
import { BottomSheet, useToast } from '../../ui/overlays'
import { WheelPicker } from '../../ui/WheelPicker'
import { DEFAULT_MEALS, diarySettings, latestTargets, type DiaryMeal } from '../../lib/diet'
import { getProfile, updateSettings } from '../../lib/plan'
import { save } from '../../db/repo'
import type { DietTargets } from '../../db/schema'
import { useSession } from '../../store/session'

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative h-7 w-12 rounded-full transition ${on ? 'bg-lime' : 'bg-border'}`} role="switch" aria-checked={on}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

export default function DefinicoesDiario() {
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const uid = useSession((s) => s.user?.id)
  const s = useLiveQuery(() => diarySettings(), [uid])
  const t = useLiveQuery(() => latestTargets(), [uid])
  const [meals, setMeals] = useState<DiaryMeal[] | null>(null)
  const [sticky, setSticky] = useState(true)
  const [times, setTimes] = useState(true)
  const [limit, setLimit] = useState(110)
  const [countOpen, setCountOpen] = useState(false)
  const [count, setCount] = useState(5)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (s && meals === null) {
      setMeals(structuredClone(s.meals))
      setSticky(s.stickyHeader)
      setTimes(s.showTimes)
    }
  }, [s, meals])
  useEffect(() => { if (t) setLimit(Math.round((t.redAt || 1.1) * 100)) }, [t])

  if (!meals) return null
  const set = (m: DiaryMeal[]) => { setMeals(m); setDirty(true) }

  function aplicarQuantidade(n: number) {
    const next = Array.from({ length: n }, (_, i) => meals![i] ?? DEFAULT_MEALS[i] ?? { name: `Refeição ${i + 1}`, time: '' })
    set(next)
  }

  async function guardar() {
    const p = await getProfile()
    await updateSettings({ diary: { ...((p?.settings.diary as object) ?? {}), meals: meals!.map((m) => ({ name: m.name.trim() || 'Refeição', time: m.time })), stickyHeader: sticky, showTimes: times } })
    if (t && Math.round((t.redAt || 1.1) * 100) !== limit) await save('dietTargets', { ...t, redAt: limit / 100 } as DietTargets)
    setDirty(false)
    toast('Definições guardadas')
    nav(-1)
  }

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between pb-4 pt-4">
        <button className="h-10 w-10 text-2xl" onClick={() => nav(-1)} aria-label="Voltar">‹</button>
        <h1 className="font-display text-lg font-bold">Definições do diário</h1>
        <span className="w-10" />
      </div>

      <Label className="mb-2">Refeições</Label>
      <Card className="mb-4 !p-0">
        <button onClick={() => { setCount(meals.length); setCountOpen(true) }} className="flex w-full items-center justify-between border-b border-border px-4 py-3.5 text-sm">
          <span>Refeições por dia</span><span className="num font-semibold text-lime">{meals.length}</span>
        </button>
        {meals.map((m, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-border px-4 py-2 last:border-0">
            <span className="w-20 shrink-0 text-xs text-muted">Refeição {i + 1}</span>
            <input value={m.name} onChange={(e) => set(meals.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="h-10 min-w-0 flex-1 rounded-[10px] border border-border bg-surface2 px-3 text-right text-sm outline-none focus:border-lime" />
            <input type="time" value={m.time} onChange={(e) => set(meals.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} className="num h-10 w-[84px] rounded-[10px] border border-border bg-surface2 px-1 text-sm [color-scheme:dark]" />
          </div>
        ))}
      </Card>
      <button className="mb-6 w-full text-center text-sm font-semibold text-danger" onClick={() => set(structuredClone(DEFAULT_MEALS))}>Restaurar valores predefinidos</button>

      <Label className="mb-2">Exibição</Label>
      <Card className="mb-4 !p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5 text-sm"><span>Cabeçalho fixo (resumo sempre visível)</span><Toggle on={sticky} onChange={(v) => { setSticky(v); setDirty(true) }} /></div>
        <div className="flex items-center justify-between px-4 py-3.5 text-sm"><span>Mostrar hora das refeições</span><Toggle on={times} onChange={(v) => { setTimes(v); setDirty(true) }} /></div>
      </Card>

      <Label className="mb-2">Limite da meta</Label>
      <Card className="mb-6">
        <div className="flex items-center justify-between text-sm"><span>Barra fica vermelha acima de</span><span className="num font-semibold text-lime">{limit}%</span></div>
        <input type="range" min={100} max={130} step={5} value={limit} onChange={(e) => { setLimit(+e.target.value); setDirty(true) }} className="mt-3 w-full accent-[#C6FF3D]" />
      </Card>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          <PrimaryButton full disabled={!dirty} onClick={guardar}>Guardar</PrimaryButton>
        </div>
      </div>

      <BottomSheet open={countOpen} onClose={() => setCountOpen(false)} title="Refeições por dia" footer={
        <div className="flex gap-2"><PrimaryButton variant="ghost" onClick={() => setCountOpen(false)}>Cancelar</PrimaryButton><PrimaryButton full onClick={() => { aplicarQuantidade(count); setCountOpen(false) }}>Ok</PrimaryButton></div>
      }>
        <WheelPicker min={1} max={8} step={1} value={count} onChange={setCount} label="refeições" accent />
      </BottomSheet>
    </div>
  )
}
