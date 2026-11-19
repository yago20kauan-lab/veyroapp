import { useState } from 'react'
import { Header } from '../ui/Header'
import { BigNumber, Card, Chip, EmptyState, Label, PrimaryButton, SectionTitle, Skeleton } from '../ui/primitives'
import { WheelPicker } from '../ui/WheelPicker'
import { MacroBar, ReadinessRing, Sparkline } from '../ui/charts'
import { BottomSheet, RestTimerPill, useToast } from '../ui/overlays'
import { VeyroLoader, VeyroMark, Wordmark } from '../ui/brand'
import { IconSwap, IconPlay } from '../ui/icons'

/** Vitrine do design system (A5) — rota /_dev/ui. */
export default function DevUI() {
  const [kg, setKg] = useState(63.5)
  const [reps, setReps] = useState(8)
  const [rpe, setRpe] = useState(8)
  const [sheet, setSheet] = useState(false)
  const [endsAt, setEndsAt] = useState(() => Date.now() + 120_000)
  const [chip, setChip] = useState('Esteira')
  const toast = useToast((s) => s.show)

  return (
    <>
      <Header title="Design system" subtitle="/_dev/ui" />

      <SectionTitle kicker="Marca" title="VEYRO" />
      <Card className="mb-6 flex flex-col items-center gap-5 py-8">
        <Wordmark size={34} />
        <div className="label tracking-tag">Personal Training Intelligence</div>
        <div className="flex items-end gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-[15px] bg-bg ring-1 ring-border"><VeyroMark size={30} /></div>
          <div className="flex h-16 w-16 items-center justify-center rounded-[15px] bg-lime"><VeyroMark size={30} variant="accent" /></div>
          <div className="flex h-16 w-16 items-center justify-center rounded-[15px] bg-surface2"><VeyroMark size={30} variant="mono" /></div>
        </div>
        <VeyroLoader label="Carregando" />
      </Card>

      <SectionTitle kicker="Treino ativo" title="Card do exercício" />
      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="font-semibold">Supino reto com barra</div>
            <div className="text-xs text-muted">peito · barra</div>
          </div>
          <div className="flex gap-2">
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border" aria-label="Como fazer"><IconPlay /></button>
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border" aria-label="Trocar"><IconSwap /></button>
          </div>
        </div>
        <Label>Alvo de hoje</Label>
        <div className="mt-1">
          <BigNumber value={kg.toFixed(1).replace('.', ',')} unit="kg" sub="× 8–12 reps" />
        </div>
        <div className="mt-1 text-sm text-muted">4 séries · 2min desc.</div>
        <div className="mt-1 text-sm text-lime">+2,5 kg: você fez 4×12 da última vez</div>
        <div className="mt-5 flex items-baseline justify-between">
          <Label>Últimas 6 sessões</Label>
          <span className="num text-sm font-semibold">63,5 kg</span>
        </div>
        <Sparkline data={[55, 57.5, 57.5, 60, 61, 63.5]} />
      </Card>

      <SectionTitle kicker="Registro" title="Seletores de rolagem" />
      <Card className="mb-3">
        <div className="mb-2 flex justify-between text-sm">
          <span className="label">Set 1</span>
          <span className="text-muted">referência 63,5×8 · meta 8–12</span>
        </div>
        <div className="flex gap-2">
          <WheelPicker label="kg" min={20} max={150} step={0.5} value={kg} onChange={setKg} />
          <WheelPicker label="reps" min={1} max={30} step={1} value={reps} onChange={setReps} />
          <WheelPicker label="pse" min={6} max={10} step={0.5} value={rpe} onChange={setRpe} accent />
        </div>
        <PrimaryButton full className="mt-4" onClick={() => { toast(`Série salva: ${String(kg).replace('.', ',')} kg × ${reps}`); setEndsAt(Date.now() + 120_000) }}>
          ✓ Concluir série
        </PrimaryButton>
      </Card>
      <div className="mb-6">
        <RestTimerPill endsAt={endsAt} totalSec={120} onAdjust={(d) => setEndsAt((e) => e + d * 1000)} onSkip={() => setEndsAt(Date.now())} />
      </div>

      <SectionTitle kicker="Dados" title="Anéis e barras" />
      <Card className="mb-6 flex items-center gap-5">
        <ReadinessRing score={82} />
        <div className="flex flex-1 flex-col gap-3">
          <MacroBar label="Proteína" value={142} target={190} />
          <MacroBar label="Carbo" value={268} target={260} />
          <MacroBar label="Gordura" value={66} target={55} />
        </div>
      </Card>

      <SectionTitle kicker="Controles" title="Botões e chips" />
      <div className="mb-3 flex flex-wrap gap-2">
        {['Esteira', 'Bike', 'Escada', 'Caminhada'].map((c) => <Chip key={c} active={chip === c} onClick={() => setChip(c)}>{c}</Chip>)}
      </div>
      <div className="mb-6 flex flex-col gap-2">
        <PrimaryButton full onClick={() => setSheet(true)}>Abrir folha inferior</PrimaryButton>
        <PrimaryButton full variant="ghost" onClick={() => toast('Sincronizado há 2 min')}>Mostrar aviso</PrimaryButton>
        <PrimaryButton full variant="gold">Compartilhar recorde</PrimaryButton>
      </div>

      <SectionTitle kicker="Estados" title="Vazio e carregando" />
      <EmptyState title="Nada por aqui" text="Estado vazio padrão, sempre com uma ação sugerida." />
      <div className="mt-3 flex flex-col gap-2">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Como fazer · Supino reto">
        <div className="mb-4 flex aspect-video items-center justify-center rounded-btn border border-border bg-surface2">
          <VeyroMark size={40} variant="mono" />
        </div>
        <Label className="mb-2">Pontos-chave</Label>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Escápulas juntas e para baixo</li>
          <li>Barra desce na linha do mamilo</li>
          <li>Cotovelos a ~45° do tronco</li>
        </ul>
      </BottomSheet>
    </>
  )
}
