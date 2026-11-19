import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DietTargets, type Measurement, type WeeklyCheckin } from '../db/schema'
import { mine, save } from '../db/repo'
import { Card, Chip, Label, PrimaryButton } from '../ui/primitives'
import { WheelPicker } from '../ui/WheelPicker'
import { useToast } from '../ui/overlays'
import { useSession } from '../store/session'
import { localDate } from '../domain/plan'
import { weeklyRecommendation, type Recommendation } from '../domain/checkin'
import { rescaleToKcal } from '../domain/foodlogic'
import { getProfile, updateSettings } from '../lib/plan'
import { latestTargets } from '../lib/diet'
import { ratesNowPrev, strengthDrops } from '../lib/progress'
import { addPhoto } from '../lib/photos'

const fmt = (n: number) => n.toFixed(1).replace('.', ',')

export function weekStartOf(d = new Date()) {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return localDate(x)
}

export default function Checkin() {
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const uid = useSession((s) => s.user?.id)
  const [step, setStep] = useState(0)
  const [kg, setKg] = useState<number | null>(null)
  const [waist, setWaist] = useState<number | null>(null)
  const [scores, setScores] = useState({ energy: 3, hunger: 3, sleep: 3 })
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [busy, setBusy] = useState(false)
  const info = useLiveQuery(async () => {
    const r = await ratesNowPrev()
    const last = (mine(await db.checkins.toArray()) as WeeklyCheckin[]).sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0]
    const ms = mine(await db.measurements.orderBy('date').toArray()) as Measurement[]
    const lastWaist = [...ms].reverse().find((m) => m.waistCm)
    const ws = mine(await db.bodyWeights.orderBy('date').toArray())
    return { ...r, last, lastWaist, lastWeight: ws.at(-1)?.kg, profile: await getProfile(), drops: await strengthDrops() }
  }, [uid])
  const waistRequired = !info?.lastWaist || Date.now() - Date.parse(info.lastWaist.date) > 13 * 86400000

  const steps = ['peso', 'cintura', 'foto', 'semana', 'resultado'] as const
  const cur = steps[step]
  const trendNow = info?.trend.at(-1)?.trend

  const photoInput = useMemo(() => {
    const el = document.createElement('input')
    el.type = 'file'; el.accept = 'image/*'; el.setAttribute('capture', 'environment')
    return el
  }, [])

  async function avançar() {
    if (cur === 'peso' && kg != null) await save('bodyWeights', { date: localDate(), kg, source: 'manual' })
    if (cur === 'cintura' && waist != null) await save('measurements', { date: localDate(), waistCm: waist } as unknown as Measurement)
    if (cur === 'semana' && info) {
      const r2 = await ratesNowPrev()
      setRec(weeklyRecommendation({
        weightKg: r2.trend.at(-1)?.trend ?? kg ?? 90, rateNow: r2.now, ratePrev: r2.prev,
        lastApplied: info.last?.applied ? (info.last.code as Recommendation['code']) : undefined,
        hunger: scores.hunger, sleep: scores.sleep, energy: scores.energy, strengthDrops: info.drops, goal: info.profile?.goal ?? 'cut',
      }))
    }
    setStep(step + 1)
  }

  async function concluir(apply: boolean) {
    if (!rec || !info) return
    setBusy(true)
    try {
      if (apply && rec.cardioMinPerWeek) {
        const p = await getProfile()
        await updateSettings({ cardioExtraMin: Number(p?.settings.cardioExtraMin ?? 0) + rec.cardioMinPerWeek })
      }
      if (apply && rec.kcalDelta) {
        const t = await latestTargets()
        if (t) {
          const base = rescaleToKcal(t.base, t.base.kcal + rec.kcalDelta)
          await save('dietTargets', { ...t, id: undefined, version: t.version + 1, base, validFrom: localDate(), trainingDay: undefined, restDay: undefined } as unknown as DietTargets)
        }
      }
      await save('checkins', {
        weekStart: weekStartOf(), trendKg: trendNow ?? kg ?? 0, rate: info.now, waistCm: waist ?? undefined,
        ...scores, recommendation: `${rec.title}: ${rec.text}`, code: rec.code, applied: apply,
      } as unknown as WeeklyCheckin)
      toast(apply ? 'Ajuste aplicado' : 'Check-in salvo')
      nav('/')
    } finally {
      setBusy(false)
    }
  }

  if (!info) return null
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-md flex-col px-5">
      <div className="flex items-center justify-between pb-4 pt-5">
        <button className="text-sm text-muted" onClick={() => nav(-1)}>Fechar</button>
        <div className="flex gap-1.5">{steps.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i === step ? 'w-6 bg-lime' : i < step ? 'w-3 bg-lime/50' : 'w-3 bg-border'}`} />)}</div>
      </div>
      <div className="flex-1 pb-28">
        {cur === 'peso' && (
          <>
            <h1 className="mb-1 font-display text-2xl font-bold">Check-in da semana</h1>
            <p className="mb-5 text-sm text-muted">2 minutos. Peso em jejum de hoje (ou pule se já registrou).</p>
            <Card className="mb-3"><Label>Tendência atual</Label><div className="num font-display text-3xl font-extrabold">{trendNow ? `${fmt(trendNow)} kg` : '—'}</div><div className="num text-sm text-muted">{info.now != null ? `${info.now > 0 ? '+' : ''}${fmt(info.now)} kg/semana` : 'ritmo após 14 dias de dados'}</div></Card>
            {kg == null ? <PrimaryButton variant="ghost" full onClick={() => setKg(info.lastWeight ?? 90)}>Registrar peso de hoje</PrimaryButton> : <WheelPicker min={40} max={200} step={0.1} value={kg} onChange={setKg} format={fmt} label="kg" accent />}
          </>
        )}
        {cur === 'cintura' && (
          <>
            <h1 className="mb-1 font-display text-2xl font-bold">Cintura</h1>
            <p className="mb-5 text-sm text-muted">{waistRequired ? 'Obrigatória a cada 2 semanas: na altura do umbigo, sem apertar.' : `Última: ${fmt(info.lastWaist!.waistCm!)} cm. Opcional esta semana.`}</p>
            {waist == null ? <PrimaryButton variant="ghost" full onClick={() => setWaist(info.lastWaist?.waistCm ?? 95)}>Informar cintura</PrimaryButton> : <WheelPicker min={50} max={160} step={0.5} value={waist} onChange={setWaist} format={fmt} label="cm" accent />}
          </>
        )}
        {cur === 'foto' && (
          <>
            <h1 className="mb-1 font-display text-2xl font-bold">Foto (opcional)</h1>
            <p className="mb-5 text-sm text-muted">De frente, mesma luz e distância de sempre.</p>
            <PrimaryButton variant="ghost" full onClick={() => { photoInput.onchange = async () => { const f = photoInput.files?.[0]; if (f) { await addPhoto(f, 'front', localDate()); toast('Foto salva') } }; photoInput.click() }}>Tirar foto de frente</PrimaryButton>
          </>
        )}
        {cur === 'semana' && (
          <>
            <h1 className="mb-1 font-display text-2xl font-bold">Como foi a semana?</h1>
            <p className="mb-5 text-sm text-muted">1 = muito baixo · 5 = muito alto</p>
            {([['energy', 'Energia'], ['hunger', 'Fome'], ['sleep', 'Qualidade do sono']] as const).map(([k, l]) => (
              <div key={k} className="mb-4">
                <Label className="mb-2">{l}</Label>
                <div className="flex gap-2">{[1, 2, 3, 4, 5].map((n) => <Chip key={n} active={scores[k] === n} onClick={() => setScores({ ...scores, [k]: n })}>{n}</Chip>)}</div>
              </div>
            ))}
          </>
        )}
        {cur === 'resultado' && rec && (
          <>
            <h1 className="mb-4 font-display text-2xl font-bold">Recomendação</h1>
            <Card className={rec.code === 'manter' ? 'border-lime/40' : 'border-gold/40'}>
              <div className="font-display text-xl font-bold">{rec.title}</div>
              <p className="mt-2 text-sm text-muted">{rec.text}</p>
            </Card>
            <p className="mt-3 text-xs text-muted">Base: tendência {info.now != null ? `${fmt(info.now)} kg/sem` : 'sem dados'}{info.prev != null ? ` (semana anterior ${fmt(info.prev)})` : ''} · {info.drops} exercício(s) com queda de força.</p>
          </>
        )}
      </div>
      <div className="pb-safe fixed inset-x-0 bottom-0 border-t border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-2 px-5 py-3">
          {cur === 'resultado' && rec ? (
            (rec.kcalDelta || rec.cardioMinPerWeek) ? (
              <>
                <PrimaryButton variant="ghost" disabled={busy} onClick={() => concluir(false)}>Agora não</PrimaryButton>
                <PrimaryButton full disabled={busy} onClick={() => concluir(true)}>Aplicar</PrimaryButton>
              </>
            ) : <PrimaryButton full disabled={busy} onClick={() => concluir(false)}>Concluir</PrimaryButton>
          ) : (
            <>
              {step > 0 && <PrimaryButton variant="ghost" onClick={() => setStep(step - 1)}>Voltar</PrimaryButton>}
              <PrimaryButton full disabled={cur === 'cintura' && waistRequired && waist == null} onClick={avançar}>Continuar</PrimaryButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
