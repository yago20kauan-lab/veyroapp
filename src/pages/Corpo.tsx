import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type BodyWeight } from '../db/schema'
import { mine, remove, save } from '../db/repo'
import { Header } from '../ui/Header'
import { Card, EmptyState, Label, PrimaryButton, SectionTitle } from '../ui/primitives'
import { BottomSheet, useToast } from '../ui/overlays'
import { WheelPicker } from '../ui/WheelPicker'
import { Sparkline } from '../ui/charts'
import { useSession } from '../store/session'

const fmt = (n: number) => n.toFixed(1).replace('.', ',')

export default function Corpo() {
  const uid = useSession((s) => s.user?.id)
  const weights = useLiveQuery(async () => mine(await db.bodyWeights.orderBy('date').toArray()) as BodyWeight[], [uid])
  const [open, setOpen] = useState(false)
  const last = weights?.at(-1)
  const [kg, setKg] = useState<number>(97.5)
  const toast = useToast((s) => s.show)

  async function registrar() {
    const date = new Date().toISOString().slice(0, 10)
    const existing = weights?.find((w) => w.date === date)
    await save('bodyWeights', { ...(existing ?? {}), date, kg: Math.round(kg * 10) / 10, source: 'manual' })
    setOpen(false)
    toast(`Peso salvo: ${fmt(kg)} kg`)
  }

  return (
    <>
      <Header title="Corpo" />
      <SectionTitle
        kicker="Peso"
        title="Seus registros"
        right={weights?.length ? <PrimaryButton className="!min-h-[40px] !px-4 text-sm" onClick={() => { setKg(last?.kg ?? 97.5); setOpen(true) }}>+ Peso</PrimaryButton> : undefined}
      />
      {!weights ? null : weights.length === 0 ? (
        <EmptyState
          title="Nenhum peso registrado"
          text="Pese-se em jejum, 3x por semana. O VEYRO vai mostrar a tendência, não o número do dia."
          action={<PrimaryButton onClick={() => setOpen(true)}>Registrar peso</PrimaryButton>}
        />
      ) : (
        <Card>
          <div className="flex items-end justify-between">
            <div>
              <Label>Último</Label>
              <div className="num font-display text-4xl font-extrabold">{fmt(last!.kg)}<span className="ml-1 text-lg font-semibold">kg</span></div>
            </div>
            <div className="text-right text-xs text-muted">{new Date(last!.date + 'T12:00').toLocaleDateString('pt-BR')}</div>
          </div>
          <div className="mt-3"><Sparkline data={weights.slice(-14).map((w) => w.kg)} /></div>
          <ul className="mt-3 divide-y divide-border">
            {[...weights].reverse().slice(0, 7).map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-muted">{new Date(w.date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                <span className="flex items-center gap-4">
                  <span className="num font-semibold">{fmt(w.kg)} kg</span>
                  <button className="text-xs text-muted" onClick={() => remove('bodyWeights', w.id)} aria-label="Apagar">Apagar</button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="h-6" />
      <SectionTitle kicker="Medidas" title="Cintura e composição" />
      <EmptyState title="Em breve" text="A cintura a cada 15 dias diz mais sobre a barriga do que a balança." />

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Peso de hoje">
        <WheelPicker min={40} max={200} step={0.1} value={kg} onChange={setKg} format={fmt} label="kg" accent />
        <PrimaryButton full className="mt-5" onClick={registrar}>Salvar {fmt(kg)} kg</PrimaryButton>
      </BottomSheet>
    </>
  )
}
