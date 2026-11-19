import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Program, type RoutineItem } from '../db/schema'
import { save } from '../db/repo'
import { Header } from '../ui/Header'
import { Card, Chip, Label, PrimaryButton, SectionTitle } from '../ui/primitives'
import { VeyroLoader } from '../ui/brand'
import { useToast } from '../ui/overlays'
import { useSession } from '../store/session'
import { aiAvailability, anonymousSummary, callAI, libraryForAI } from '../lib/ai'
import { parseAdapt, parseBuild, AskSchema, WeeklySchema, type AdaptResult, type BuildResult } from '../ai/schemas'
import { activateProgram, getProfile, todayPlan } from '../lib/plan'
import { activeSession, startSession } from '../lib/workout'
import { localDate } from '../domain/plan'
import { weekStartOf } from './Checkin'

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
type Tab = 'montar' | 'adaptar' | 'semana' | 'perguntar'

export default function IA() {
  const avail = aiAvailability()
  const [tab, setTab] = useState<Tab>('adaptar')
  return (
    <>
      <Header title="Inteligência VEYRO" subtitle="IA" />
      {!avail.ok && <div className="mb-4 rounded-btn border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">{avail.reason}</div>}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {([['adaptar', 'Adaptar hoje'], ['montar', 'Montar treino'], ['semana', 'Análise da semana'], ['perguntar', 'Perguntar']] as [Tab, string][]).map(([k, l]) => <Chip key={k} active={tab === k} onClick={() => setTab(k)}>{l}</Chip>)}
      </div>
      {tab === 'montar' && <Montar disabled={!avail.ok} />}
      {tab === 'adaptar' && <Adaptar disabled={!avail.ok} />}
      {tab === 'semana' && <Semana disabled={!avail.ok} />}
      {tab === 'perguntar' && <Perguntar disabled={!avail.ok} />}
      <p className="mt-8 text-center text-[11px] text-muted/70">A IA recebe só um resumo anônimo (sem nome, e-mail ou fotos) e nunca altera nada sem você confirmar. Não substitui orientação profissional. Limite: 30 usos por dia.</p>
    </>
  )
}

function Thinking() {
  return <div className="py-8"><VeyroLoader label="Pensando" /></div>
}

function Montar({ disabled }: { disabled: boolean }) {
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const [days, setDays] = useState(5)
  const [minutes, setMinutes] = useState(60)
  const [equip, setEquip] = useState('academia completa')
  const [limits, setLimits] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<BuildResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const name = new Map((exercises ?? []).map((e) => [e.id, e.name]))

  async function gerar() {
    setBusy(true); setErr(null); setRes(null)
    try {
      const p = await getProfile()
      const lib = await libraryForAI()
      const raw = await callAI('build', { objetivo: p?.goal, diasPorSemana: days, minutosPorTreino: minutes, equipamento: equip, limitacoes: limits || 'nenhuma', resumo: await anonymousSummary(), biblioteca: lib })
      setRes(parseBuild(raw, new Set(lib.map((x) => x.id))))
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  async function aplicar() {
    if (!res) return
    const program: Program = { id: `ia-${Date.now()}`, name: res.name, level: 'intermediario', daysPerWeek: res.routines.length, description: res.notes, forWho: 'Gerado pela IA', routines: res.routines.map((r) => ({ name: r.name, weekday: r.weekday, items: r.items as RoutineItem[] })) }
    await activateProgram(program, localDate(), {})
    toast('Plano da IA ativado. Edite quando quiser.')
    nav('/treinar')
  }

  return (
    <>
      <Card className="mb-3 flex flex-col gap-3">
        <div><Label className="mb-1.5">Dias por semana</Label><div className="flex gap-2">{[3, 4, 5, 6].map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d}</Chip>)}</div></div>
        <div><Label className="mb-1.5">Tempo por treino</Label><div className="flex gap-2">{[40, 60, 75, 90].map((m) => <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>{m} min</Chip>)}</div></div>
        <div><Label className="mb-1.5">Equipamento</Label><div className="flex flex-wrap gap-2">{['academia completa', 'só halteres', 'em casa'].map((x) => <Chip key={x} active={equip === x} onClick={() => setEquip(x)}>{x}</Chip>)}</div></div>
        <label><Label className="mb-1.5">Limitações (opcional)</Label><input value={limits} onChange={(e) => setLimits(e.target.value)} placeholder="ex.: ombro direito sensível" className="h-11 w-full rounded-btn border border-border bg-surface2 px-3 text-base" /></label>
        <PrimaryButton full disabled={disabled || busy} onClick={gerar}>Gerar plano</PrimaryButton>
      </Card>
      {busy && <Thinking />}
      {err && <p className="text-sm text-danger">{err}</p>}
      {res && (
        <>
          <SectionTitle kicker="Revise antes de aplicar" title={res.name} />
          {res.notes && <p className="mb-3 text-sm text-muted">{res.notes}</p>}
          <div className="mb-3 flex flex-col gap-2">
            {res.routines.map((r, i) => (
              <Card key={i} className="!p-3">
                <div className="mb-1 text-sm font-semibold"><span className="label mr-2 text-lime">{weekdays[r.weekday]}</span>{r.name}</div>
                <ul className="space-y-0.5 text-sm text-muted">{r.items.map((it, j) => <li key={j} className="flex justify-between"><span>{name.get(it.exerciseId)}</span><span className="num">{it.sets}×{it.repMin}–{it.repMax}</span></li>)}</ul>
              </Card>
            ))}
          </div>
          <PrimaryButton full onClick={aplicar}>Usar este plano</PrimaryButton>
          <p className="mt-2 text-center text-xs text-muted">Substitui o plano atual. O histórico continua.</p>
        </>
      )}
    </>
  )
}

function Adaptar({ disabled }: { disabled: boolean }) {
  const nav = useNavigate()
  const uid = useSession((s) => s.user?.id)
  const plan = useLiveQuery(() => todayPlan(), [uid])
  const active = useLiveQuery(() => activeSession(), [uid])
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<AdaptResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const name = new Map((exercises ?? []).map((e) => [e.id, e.name]))
  const items = active?.items ?? plan?.routine?.items
  const routineName = active?.routineName ?? plan?.routine?.name

  async function gerar() {
    if (!items) return
    setBusy(true); setErr(null); setRes(null)
    try {
      const lib = await libraryForAI()
      const raw = await callAI('adapt', { situacao: text, treinoDeHoje: items.map((i) => ({ ...i, nome: name.get(i.exerciseId) })), biblioteca: lib })
      setRes(parseAdapt(raw, new Set(lib.map((x) => x.id))))
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  async function aplicar() {
    if (!res) return
    if (active) {
      await save('sessions', { ...active, items: res.items as RoutineItem[], swaps: {}, currentIndex: 0, routineName: `${active.routineName} (adaptado)` })
      nav(`/treino/${active.id}`)
    } else if (plan?.routine) {
      const s = await startSession({ ...plan.routine, name: `${plan.routine.name} (adaptado)`, items: res.items as RoutineItem[] }, plan)
      nav(`/treino/${s.id}`)
    }
  }

  if (!items) return <Card><p className="text-sm text-muted">Sem treino hoje no seu plano. Use "Montar treino" ou escolha um treino em Treinar.</p></Card>
  return (
    <>
      <Card className="mb-3">
        <Label className="mb-1">Treino de hoje</Label>
        <div className="mb-3 font-semibold">{routineName}</div>
        <div className="mb-2 flex flex-wrap gap-2">{['Estou com dor no ombro', 'Só tenho 40 min', 'Academia lotada, sem banco livre', 'Estou muito cansado'].map((x) => <Chip key={x} active={text === x} onClick={() => setText(x)}>{x}</Chip>)}</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Ou descreva a situação" className="mb-3 w-full rounded-btn border border-border bg-surface2 p-3 text-base outline-none focus:border-lime" />
        <PrimaryButton full disabled={disabled || busy || !text.trim()} onClick={gerar}>Adaptar treino</PrimaryButton>
      </Card>
      {busy && <Thinking />}
      {err && <p className="text-sm text-danger">{err}</p>}
      {res && (
        <>
          <SectionTitle kicker="Revise antes de aplicar" title="Treino adaptado" />
          {res.notes && <p className="mb-3 text-sm text-muted">{res.notes}</p>}
          <Card className="mb-3 !p-3"><ul className="space-y-1 text-sm">{res.items.map((it, j) => <li key={j} className="flex justify-between"><span>{name.get(it.exerciseId)}</span><span className="num text-muted">{it.sets}×{it.repMin}–{it.repMax}</span></li>)}</ul></Card>
          <PrimaryButton full onClick={aplicar}>{active ? 'Aplicar no treino em andamento' : 'Começar treino adaptado'}</PrimaryButton>
          <p className="mt-2 text-center text-xs text-muted">Só vale para hoje. Seu plano não muda.</p>
        </>
      )}
    </>
  )
}

function Semana({ disabled }: { disabled: boolean }) {
  const uid = useSession((s) => s.user?.id)
  const key = `ai-weekly:${uid}:${weekStartOf()}`
  const cached = useLiveQuery(async () => (await db.meta.get(key))?.value as { good: string; stuck: string; adjust: string } | undefined, [key])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function gerar() {
    setBusy(true); setErr(null)
    try {
      const raw = await callAI('weekly', { resumo: await anonymousSummary() })
      await db.meta.put({ key, value: WeeklySchema.parse(raw) })
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return (
    <>
      {cached ? (
        <div className="flex flex-col gap-2">
          {([['O que foi bem', cached.good, 'text-lime'], ['O que travou', cached.stuck, 'text-gold'], ['Ajuste da semana', cached.adjust, 'text-text']] as const).map(([t, v, c]) => (
            <Card key={t}><Label className={c}>{t}</Label><p className="mt-1 text-sm">{v}</p></Card>
          ))}
          <button className="mt-2 text-sm text-muted" disabled={disabled || busy} onClick={gerar}>Gerar de novo</button>
        </div>
      ) : (
        <Card><p className="mb-3 text-sm text-muted">3 pontos sobre sua semana: o que foi bem, o que travou e um ajuste.</p><PrimaryButton full disabled={disabled || busy} onClick={gerar}>Analisar minha semana</PrimaryButton></Card>
      )}
      {busy && <Thinking />}
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
    </>
  )
}

function Perguntar({ disabled }: { disabled: boolean }) {
  const [q, setQ] = useState('')
  const [chat, setChat] = useState<{ q: string; a: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [facts, setFacts] = useState<unknown>(null)
  useEffect(() => { anonymousSummary().then(setFacts) }, [])
  async function enviar() {
    const pergunta = q.trim()
    if (!pergunta) return
    setBusy(true); setQ('')
    try {
      const raw = await callAI('ask', { pergunta, fatos: facts })
      setChat((c) => [...c, { q: pergunta, a: AskSchema.parse(raw).answer }])
    } catch (e) {
      setChat((c) => [...c, { q: pergunta, a: `⚠️ ${e instanceof Error ? e.message : String(e)}` }])
    } finally { setBusy(false) }
  }
  return (
    <>
      <div className="mb-3 flex flex-col gap-3">
        {chat.length === 0 && <div className="flex flex-wrap gap-2">{['Quanto meu supino subiu?', 'Estou perdendo peso no ritmo certo?', 'Qual exercício mais evoluiu?'].map((x) => <Chip key={x} onClick={() => setQ(x)}>{x}</Chip>)}</div>}
        {chat.map((m, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="ml-auto max-w-[85%] rounded-[16px] rounded-br-sm bg-lime px-3 py-2 text-sm text-onlime">{m.q}</div>
            <div className="max-w-[85%] rounded-[16px] rounded-bl-sm border border-border bg-surface px-3 py-2 text-sm">{m.a}</div>
          </div>
        ))}
        {busy && <Thinking />}
      </div>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} placeholder="Pergunte sobre seu histórico" className="h-12 flex-1 rounded-btn border border-border bg-surface2 px-3 text-base outline-none focus:border-lime" />
        <PrimaryButton disabled={disabled || busy || !q.trim()} onClick={enviar}>Enviar</PrimaryButton>
      </div>
    </>
  )
}
