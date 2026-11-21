import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { db, type DietTargets, type Profile } from '../db/schema'
import { save } from '../db/repo'
import { VeyroMark } from '../ui/brand'
import { Card, Chip, Label, PrimaryButton } from '../ui/primitives'
import { WheelPicker } from '../ui/WheelPicker'
import { ensureProfile, activateProgram } from '../lib/plan'
import { ACTIVITY, age as ageOf, calcTargets, cycleTargets, type Activity, type Goal, type Sex } from '../domain/diet'
import { localDate, nextMonday } from '../domain/plan'
import { seedPrograms } from '../db/seed-programs'
import { applySuggestion, buildSuggestion, type Suggestion } from '../lib/dietTemplates'
import { DISCLAIMER, type DietStyle } from '../domain/dietSuggest'
import { MealsSheet, StyleCards } from './diet/DietaSugerida'
import { useSession } from '../store/session'

type Equip = 'academia' | 'halteres' | 'casa'
type Pause = 'nao' | '2-4s' | '1-2m' | '3m+'

type Exp = 'iniciante' | 'intermediario' | 'avancado'

/** Sugestão entre os programas do treinador: nível, sexo e dias por semana. */
export function suggestProgram(days: number, exp: Exp, sex: Sex) {
  const f = sex === 'f'
  if (exp === 'iniciante') {
    if (days <= 3) return f ? 'mulheres-ab-2x' : 'iniciantes-ab-2x'
    return f ? 'mulheres-ab-4x' : 'iniciantes-ab-4x'
  }
  if (exp === 'intermediario') return days <= 3 ? 'ppl-abc-intermediario' : 'abcd-intermediario'
  if (f) return days <= 3 ? 'mulheres-abc-3x' : days === 4 ? 'upper-lower-feminino-4x' : days === 5 ? 'abcde-inferiores' : 'abcdef-6x'
  return days <= 3 ? 'ppl-abc-3x' : days === 4 ? 'abcd-avancado' : days === 5 ? 'abcde-superiores' : 'ppl-abc-def-6x'
}

const goalLabel: Record<Goal, string> = { cut: 'Definição', maintain: 'Manutenção', bulk: 'Ganho de massa' }

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const user = useSession((s) => s.user)
  const profile = useLiveQuery(() => db.profiles.get(user?.id ?? ''), [user?.id])
  const hasPlan = !!profile?.settings.activePlan
  const [step, setStep] = useState(0)
  const [name, setName] = useState(user?.name ?? '')
  const [sex, setSex] = useState<Sex>('m')
  const [birth, setBirth] = useState('1996-01-01')
  const [height, setHeight] = useState(175)
  const [weight, setWeight] = useState(80)
  const [goal, setGoal] = useState<Goal>('cut')
  const [days, setDays] = useState(5)
  const [time, setTime] = useState('19:30')
  const [equip, setEquip] = useState<Equip>('academia')
  const [pause, setPause] = useState<Pause>('nao')
  const [exp, setExp] = useState<Exp>('intermediario')
  const [activity, setActivity] = useState<Activity>('moderado')
  const [programId, setProgramId] = useState<string | null>(null)
  const [start, setStart] = useState<'hoje' | 'segunda'>('hoje')
  const [busy, setBusy] = useState(false)
  const [sug, setSug] = useState<Suggestion | null>(null)
  const [dietStyle, setDietStyle] = useState<DietStyle | null>(null)
  const [applyDiet, setApplyDiet] = useState(true)
  const [mealsOpen, setMealsOpen] = useState(false)

  const suggested = suggestProgram(days, exp, sex)
  const chosen = programId ?? suggested
  const calc = useMemo(() => calcTargets({ sex, weightKg: weight, heightCm: height, age: ageOf(birth), activity, goal }), [sex, weight, height, birth, activity, goal])

  const steps = ['perfil', 'corpo', 'rotina', ...(hasPlan ? [] : ['programa']), 'dieta'] as const
  const cur = steps[step]
  useEffect(() => {
    if (cur !== 'dieta') return
    let alive = true
    buildSuggestion({ sex, weightKg: weight, heightCm: height, age: ageOf(birth), activity, goal }).then((r) => {
      if (!alive) return
      setSug(r)
      setDietStyle(r.defaultStyle)
    })
    return () => { alive = false }
  }, [cur, sex, weight, height, birth, activity, goal])
  const last = step === steps.length - 1

  async function finish() {
    setBusy(true)
    try {
      const p = await ensureProfile()
      await save('profiles', {
        ...p,
        name: name.trim() || p.name,
        sex,
        birthDate: birth,
        heightCm: height,
        goal,
        startDate: p.startDate ?? localDate(),
        returnMode: pause !== 'nao',
        settings: { ...p.settings, onboarded: true, activity, trainingDays: days, trainTime: time, equipment: equip },
      } as Profile)
      await save('bodyWeights', { date: localDate(), kg: weight, source: 'manual' })
      const cyc = cycleTargets(calc.targets, days)
      await save('dietTargets', {
        version: 1,
        base: calc.targets,
        mode: 'grams',
        trainingDay: cyc.training,
        restDay: cyc.rest,
        waterMl: Math.round((weight * 35) / 250) * 250,
        validFrom: localDate(),
        cycle: false,
      } as unknown as DietTargets)
      if (!hasPlan) {
        const prog = seedPrograms.find((x) => x.id === chosen)
        if (prog) await activateProgram(prog, start === 'hoje' ? localDate() : nextMonday(), {}, pause !== 'nao' && pause !== '2-4s')
      }
      if (applyDiet && sug && dietStyle) await applySuggestion(sug, dietStyle, { weightKg: weight, activity, goal })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const canNext = cur !== 'perfil' || name.trim().length > 0

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-md flex-col px-5">
      <div className="flex items-center justify-between pb-4 pt-5">
        <VeyroMark size={22} />
        <div className="flex gap-1.5">
          {steps.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-lime' : i < step ? 'w-3 bg-lime/50' : 'w-3 bg-border'}`} />)}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={cur} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1 pb-28">
          {cur === 'perfil' && (
            <>
              <h1 className="mb-1 font-display text-2xl font-bold">Vamos te conhecer</h1>
              <p className="mb-6 text-sm text-muted">Usamos isso para calcular cargas, calorias e metas. Dá para mudar depois.</p>
              <Label className="mb-1.5">Nome</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como quer ser chamado" className="mb-5 h-[52px] w-full rounded-btn border border-border bg-surface2 px-4 text-base outline-none focus:border-lime" />
              <Label className="mb-2">Sexo (para o cálculo de calorias)</Label>
              <div className="mb-5 flex gap-2"><Chip active={sex === 'm'} onClick={() => setSex('m')}>Masculino</Chip><Chip active={sex === 'f'} onClick={() => setSex('f')}>Feminino</Chip></div>
              <Label className="mb-1.5">Data de nascimento</Label>
              <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} className="mb-5 h-[52px] w-full rounded-btn border border-border bg-surface2 px-4 text-base text-text outline-none focus:border-lime [color-scheme:dark]" />
              <Label className="mb-2">Objetivo</Label>
              <div className="flex flex-wrap gap-2">{(Object.keys(goalLabel) as Goal[]).map((g) => <Chip key={g} active={goal === g} onClick={() => setGoal(g)}>{goalLabel[g]}</Chip>)}</div>
            </>
          )}

          {cur === 'corpo' && (
            <>
              <h1 className="mb-1 font-display text-2xl font-bold">Altura e peso</h1>
              <p className="mb-6 text-sm text-muted">O peso de hoje vira o primeiro ponto do seu gráfico.</p>
              <Card className="flex gap-3">
                <WheelPicker label="altura cm" min={140} max={215} step={1} value={height} onChange={setHeight} />
                <WheelPicker label="peso kg" min={40} max={200} step={0.5} value={weight} onChange={setWeight} format={(v) => v.toFixed(1).replace('.', ',')} accent />
              </Card>
            </>
          )}

          {cur === 'rotina' && (
            <>
              <h1 className="mb-1 font-display text-2xl font-bold">Sua rotina</h1>
              <p className="mb-6 text-sm text-muted">Para montar o treino certo e lembrar na hora certa.</p>
              <Label className="mb-2">Experiência com musculação</Label>
              <div className="mb-5 flex flex-wrap gap-2">
                <Chip active={exp === 'iniciante'} onClick={() => setExp('iniciante')}>Iniciante</Chip>
                <Chip active={exp === 'intermediario'} onClick={() => setExp('intermediario')}>Intermediário</Chip>
                <Chip active={exp === 'avancado'} onClick={() => setExp('avancado')}>Avançado</Chip>
              </div>
              <Label className="mb-2">Dias de treino por semana</Label>
              <div className="mb-5 flex flex-wrap gap-2">{[2, 3, 4, 5, 6].map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d} dias</Chip>)}</div>
              <Label className="mb-1.5">Horário do treino</Label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mb-5 h-[52px] w-full rounded-btn border border-border bg-surface2 px-4 text-base text-text outline-none [color-scheme:dark]" />
              <Label className="mb-2">Onde treina</Label>
              <div className="mb-5 flex flex-wrap gap-2">
                <Chip active={equip === 'academia'} onClick={() => setEquip('academia')}>Academia completa</Chip>
                <Chip active={equip === 'halteres'} onClick={() => setEquip('halteres')}>Só halteres</Chip>
                <Chip active={equip === 'casa'} onClick={() => setEquip('casa')}>Em casa</Chip>
              </div>
              <Label className="mb-2">Está voltando de uma pausa?</Label>
              <div className="mb-5 flex flex-wrap gap-2">
                <Chip active={pause === 'nao'} onClick={() => setPause('nao')}>Não</Chip>
                <Chip active={pause === '2-4s'} onClick={() => setPause('2-4s')}>2–4 semanas</Chip>
                <Chip active={pause === '1-2m'} onClick={() => setPause('1-2m')}>1–2 meses</Chip>
                <Chip active={pause === '3m+'} onClick={() => setPause('3m+')}>3 meses ou mais</Chip>
              </div>
              <Label className="mb-2">Nível de atividade (com os treinos)</Label>
              <div className="flex flex-col gap-2">
                {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
                  <button key={a} onClick={() => setActivity(a)} className={`rounded-btn border px-4 py-3 text-left text-sm ${activity === a ? 'border-lime bg-lime/10' : 'border-border bg-surface'}`}>{ACTIVITY[a].label}</button>
                ))}
              </div>
            </>
          )}

          {cur === 'programa' && (
            <>
              <h1 className="mb-1 font-display text-2xl font-bold">Seu treino</h1>
              <p className="mb-5 text-sm text-muted">Sugerimos um programa pelo que você contou. Tudo editável depois.</p>
              <div className="flex flex-col gap-2">
                {[...seedPrograms].filter((p) => p.audience !== (sex === 'm' ? 'feminino' : 'masculino')).sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested)).map((p) => (
                  <button key={p.id} onClick={() => setProgramId(p.id)} className={`rounded-card border p-4 text-left ${chosen === p.id ? 'border-lime bg-lime/[0.06]' : 'border-border bg-surface'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{p.name}</span>
                      <span className="num text-xs text-muted">{p.daysPerWeek}x/sem</span>
                    </div>
                    <div className="mt-1 text-sm text-muted">{p.forWho}</div>
                    {p.id === suggested && <div className="label mt-2 text-lime">Sugerido para você</div>}
                  </button>
                ))}
              </div>
              {pause !== 'nao' && pause !== '2-4s' && <p className="mt-4 rounded-btn border border-lime/30 bg-lime/5 px-3 py-2 text-sm">Como você está voltando de uma pausa, as 4 primeiras semanas serão de retorno gradual (55% → 90% das cargas).</p>}
              <Label className="mb-2 mt-5">Começar</Label>
              <div className="flex gap-2">
                <Chip active={start === 'hoje'} onClick={() => setStart('hoje')}>Hoje</Chip>
                <Chip active={start === 'segunda'} onClick={() => setStart('segunda')}>Na segunda</Chip>
              </div>
            </>
          )}

          {cur === 'dieta' && (
            <>
              <h1 className="mb-1 font-display text-2xl font-bold">Sua dieta sugerida</h1>
              <Card className="mb-3">
                <Label>Sua meta</Label>
                <div className="num font-display text-4xl font-extrabold">{(sug?.target.kcal ?? calc.targets.kcal).toLocaleString('pt-BR')}<span className="ml-1 text-base font-semibold text-muted">kcal/dia</span></div>
                <p className="mt-1 text-sm text-muted">{sug?.target.explanation ?? calc.suggestion.explanation}</p>
                {sug?.target.warnings.map((w) => <p key={w} className="mt-2 text-sm text-gold">{w}</p>)}
                {sug?.target.floored && <p className="mt-2 text-sm text-gold">Ajustamos para o mínimo seguro sem acompanhamento profissional.</p>}
              </Card>
              {sug && dietStyle ? (
                <>
                  <StyleCards s={sug} style={dietStyle} onStyle={setDietStyle} />
                  <PrimaryButton variant="ghost" full className="mt-2" onClick={() => setMealsOpen(true)}>Ver refeições</PrimaryButton>
                  <Label className="mb-2 mt-4">Aplicar ao meu plano alimentar?</Label>
                  <div className="flex gap-2">
                    <Chip active={applyDiet} onClick={() => setApplyDiet(true)}>Sim, usar esta dieta</Chip>
                    <Chip active={!applyDiet} onClick={() => setApplyDiet(false)}>Agora não</Chip>
                  </div>
                  <MealsSheet open={mealsOpen} onClose={() => setMealsOpen(false)} meals={sug.styles.find((x) => x.style === dietStyle)?.fit.meals} title="Refeições" />
                </>
              ) : <p className="py-6 text-center text-sm text-muted">Montando as opções…</p>}
              <p className="mt-4 text-[11px] leading-snug text-muted">{DISCLAIMER} Com 2 semanas de registros, o VEYRO descobre seu gasto real e ajusta a meta.</p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="pb-safe fixed inset-x-0 bottom-0 border-t border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-2 px-5 py-3">
          {step > 0 && <PrimaryButton variant="ghost" onClick={() => setStep(step - 1)}>Voltar</PrimaryButton>}
          <PrimaryButton full disabled={!canNext || busy} onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? (busy ? 'Salvando…' : 'Começar') : 'Continuar'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
