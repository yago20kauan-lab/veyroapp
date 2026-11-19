import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type BodyWeight, type DietTargets, type FoodLog, type Macros } from '../../db/schema'
import { mine, save } from '../../db/repo'
import { Header } from '../../ui/Header'
import { Card, Chip, Label, PrimaryButton, SectionTitle } from '../../ui/primitives'
import { useToast } from '../../ui/overlays'
import { latestTargets } from '../../lib/diet'
import { getProfile } from '../../lib/plan'
import { ACTIVITY, age, calcTargets, cycleTargets, gramsToPercent, percentToGrams, type Activity, type Goal } from '../../domain/diet'
import { kcalFromMacros } from '../../domain/nutrition'
import { adaptiveTdee, rescaleToKcal, targetForRate } from '../../domain/foodlogic'
import { localDate } from '../../domain/plan'
import { useSession } from '../../store/session'

function Num({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-btn border border-border bg-surface2 px-3 py-2">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-1">
        <input inputMode="numeric" value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(parseInt(e.target.value || '0', 10))} className="num h-10 w-20 rounded-[10px] border border-border bg-bg text-center text-base outline-none focus:border-lime" />
        <span className="w-6 text-xs text-muted">{suffix}</span>
      </span>
    </label>
  )
}

export default function Metas() {
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const uid = useSession((s) => s.user?.id)
  const current = useLiveQuery(() => latestTargets(), [uid])
  const profile = useLiveQuery(() => getProfile(), [uid])
  const lastWeight = useLiveQuery(async () => (mine(await db.bodyWeights.orderBy('date').toArray()) as BodyWeight[]).at(-1)?.kg, [uid])
  const adaptive = useLiveQuery(async () => {
    const since = new Date(Date.now() - 28 * 86400000)
    const from = localDate(since)
    const logs = mine(await db.foodLogs.where('date').aboveOrEqual(from).toArray()) as FoodLog[]
    const ws = mine(await db.bodyWeights.where('date').aboveOrEqual(from).toArray()) as BodyWeight[]
    const byDay = new Map<string, { intakeKcal?: number; weightKg?: number }>()
    for (const l of logs) byDay.set(l.date, { ...byDay.get(l.date), intakeKcal: (byDay.get(l.date)?.intakeKcal ?? 0) + l.macros.kcal })
    for (const w of ws) byDay.set(w.date, { ...byDay.get(w.date), weightKg: w.kg })
    const days = [...byDay.entries()].map(([date, v]) => ({ date, ...v }))
    return adaptiveTdee(days, current?.tdeeEstimate)
  }, [uid, current?.tdeeEstimate])

  const [mode, setMode] = useState<'grams' | 'percent'>('grams')
  const [m, setM] = useState<Macros>({ kcal: 0, p: 0, c: 0, f: 0 })
  const [pct, setPct] = useState({ p: 30, c: 45, f: 25 })
  const [kcalPct, setKcalPct] = useState(2000)
  const [cycle, setCycle] = useState(false)
  const [water, setWater] = useState(3000)
  const [redAt, setRedAt] = useState(1.1)
  const [activity, setActivity] = useState<Activity>('moderado')
  const [goal, setGoal] = useState<Goal>('cut')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (loaded || current === undefined || profile === undefined) return
    if (current) {
      setM(current.base)
      setMode(current.mode)
      setPct(gramsToPercent(current.base))
      setKcalPct(current.base.kcal)
      setCycle(!!current.cycle)
      setWater(current.waterMl)
      setRedAt(current.redAt ?? 1.1)
    }
    setActivity((profile?.settings.activity as Activity) ?? 'moderado')
    setGoal(profile?.goal ?? 'cut')
    setLoaded(true)
  }, [current, profile, loaded])

  const final: Macros = mode === 'grams' ? { ...m, kcal: kcalFromMacros(m.p, m.c, m.f) } : percentToGrams(kcalPct, pct)
  const days = Number(profile?.settings.trainingDays ?? 5)
  const cyc = cycleTargets(final, days)

  function recalcular() {
    if (!profile?.sex || !profile.heightCm || !profile.birthDate || !lastWeight) return toast('Complete o perfil e registre o peso primeiro')
    const r = calcTargets({ sex: profile.sex, weightKg: lastWeight, heightCm: profile.heightCm, age: age(profile.birthDate), activity, goal })
    setM(r.targets)
    setPct(gramsToPercent(r.targets))
    setKcalPct(r.targets.kcal)
    toast(`Gasto estimado ${r.tdee} kcal · meta ${r.targets.kcal} kcal`)
  }

  async function salvar(extra: Partial<DietTargets> = {}, base: Macros = final) {
    const c2 = cycleTargets(base, days)
    await save('dietTargets', {
      version: (current?.version ?? 0) + 1,
      base,
      mode,
      cycle,
      trainingDay: c2.training,
      restDay: c2.rest,
      waterMl: water,
      redAt,
      validFrom: localDate(),
      rateKgWeek: current?.rateKgWeek,
      tdeeEstimate: current?.tdeeEstimate,
      ...extra,
    } as unknown as DietTargets)
    toast('Metas salvas')
    nav('/dieta')
  }

  if (!loaded) return null
  return (
    <div className="pb-28">
      <Header title="Metas" subtitle="Dieta" />

      {adaptive?.ok ? (
        <Card className="mb-4 border-lime/40">
          <Label className="text-lime">Gasto real estimado</Label>
          <div className="num mt-1 font-display text-3xl font-extrabold">{adaptive.tdee.toLocaleString('pt-BR')} <span className="text-base text-muted">kcal/dia</span></div>
          <p className="mt-1 text-sm text-muted">Média ingerida {adaptive.avgIntake} kcal · tendência {adaptive.trendDeltaKg > 0 ? '+' : ''}{String(adaptive.trendDeltaKg).replace('.', ',')} kg em {adaptive.days} dias.</p>
          <PrimaryButton className="mt-3" onClick={() => {
            const rate = current?.rateKgWeek ?? (goal === 'cut' ? -0.6 : goal === 'bulk' ? 0.25 : 0)
            const kcal = targetForRate(adaptive.tdee, rate)
            const base = rescaleToKcal(final, Math.max(profile?.sex === 'f' ? 1300 : 1600, kcal))
            salvar({ tdeeEstimate: adaptive.tdee, rateKgWeek: rate, base }, base)
          }}>Aplicar meta para {goal === 'cut' ? 'perder ~0,6 kg/sem' : goal === 'bulk' ? 'ganhar ~0,25 kg/sem' : 'manter'}</PrimaryButton>
        </Card>
      ) : adaptive ? (
        <Card className="mb-4"><Label>Calorias adaptativas</Label><p className="mt-1 text-sm text-muted">Registre comida e peso por mais {adaptive.missingDays} dia(s) para o VEYRO descobrir seu gasto real.</p></Card>
      ) : null}

      <SectionTitle kicker="Calculador" title="Recalcular pelo perfil" />
      <Card className="mb-5">
        <Label className="mb-2">Objetivo</Label>
        <div className="mb-3 flex flex-wrap gap-2">{(['cut', 'maintain', 'bulk'] as Goal[]).map((g) => <Chip key={g} active={goal === g} onClick={() => setGoal(g)}>{{ cut: 'Definição', maintain: 'Manutenção', bulk: 'Ganho' }[g]}</Chip>)}</div>
        <Label className="mb-2">Atividade</Label>
        <div className="mb-3 flex flex-col gap-1.5">{(Object.keys(ACTIVITY) as Activity[]).map((a) => <button key={a} onClick={() => setActivity(a)} className={`rounded-btn border px-3 py-2 text-left text-sm ${activity === a ? 'border-lime bg-lime/10' : 'border-border'}`}>{ACTIVITY[a].label}</button>)}</div>
        <PrimaryButton variant="ghost" full onClick={recalcular}>Recalcular metas</PrimaryButton>
      </Card>

      <SectionTitle kicker="Metas diárias" title={`${final.kcal.toLocaleString('pt-BR')} kcal`} right={<div className="flex gap-1.5"><Chip active={mode === 'grams'} onClick={() => setMode('grams')}>g</Chip><Chip active={mode === 'percent'} onClick={() => { setMode('percent'); setKcalPct(final.kcal); setPct(gramsToPercent(final)) }}>%</Chip></div>} />
      <div className="mb-2 flex flex-col gap-2">
        {mode === 'grams' ? (
          <>
            <Num label="Proteína" value={m.p} onChange={(v) => setM({ ...m, p: v })} suffix="g" />
            <Num label="Carboidrato" value={m.c} onChange={(v) => setM({ ...m, c: v })} suffix="g" />
            <Num label="Gordura" value={m.f} onChange={(v) => setM({ ...m, f: v })} suffix="g" />
          </>
        ) : (
          <>
            <Num label="Calorias" value={kcalPct} onChange={setKcalPct} suffix="kcal" />
            <Num label="Proteína" value={pct.p} onChange={(v) => setPct({ ...pct, p: v })} suffix="%" />
            <Num label="Carboidrato" value={pct.c} onChange={(v) => setPct({ ...pct, c: v })} suffix="%" />
            <Num label="Gordura" value={pct.f} onChange={(v) => setPct({ ...pct, f: v })} suffix="%" />
            {pct.p + pct.c + pct.f !== 100 && <p className="text-sm text-gold">A soma está em {pct.p + pct.c + pct.f}% (ideal 100%).</p>}
          </>
        )}
      </div>
      <p className="num mb-5 text-xs text-muted">= P {final.p} g · C {final.c} g · G {final.f} g · {final.kcal} kcal (4/4/9)</p>

      <Card className="mb-3">
        <div className="flex items-center justify-between">
          <div><Label>Treino × descanso</Label><p className="text-xs text-muted">Mais carboidrato nos dias de treino, mesma média na semana</p></div>
          <Chip active={cycle} onClick={() => setCycle(!cycle)}>{cycle ? 'Ligado' : 'Desligado'}</Chip>
        </div>
        {cycle && <p className="num mt-3 text-sm">Treino: <b>{cyc.training.kcal}</b> kcal (C {cyc.training.c} g) · Descanso: <b>{cyc.rest.kcal}</b> kcal (C {cyc.rest.c} g)</p>}
      </Card>

      <div className="mb-3 flex flex-col gap-2">
        <Num label="Água" value={water} onChange={setWater} suffix="ml" />
      </div>
      <Card className="mb-3">
        <Label className="mb-2">Barra fica vermelha acima de</Label>
        <div className="flex flex-wrap gap-2">{[1.05, 1.1, 1.2, 0].map((v) => <Chip key={v} active={redAt === v} onClick={() => setRedAt(v)}>{v ? `${Math.round(v * 100)}%` : 'Sem aviso'}</Chip>)}</div>
      </Card>
      <p className="text-xs text-muted">Sem acompanhamento profissional, não use menos de ~1.600 kcal (homens) ou ~1.300 kcal (mulheres).</p>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          <PrimaryButton variant="ghost" onClick={() => nav('/dieta')}>Cancelar</PrimaryButton>
          <PrimaryButton full onClick={() => salvar()}>Salvar metas</PrimaryButton>
        </div>
      </div>
    </div>
  )
}
