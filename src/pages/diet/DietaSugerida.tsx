import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Chip, Label, PrimaryButton } from '../../ui/primitives'
import { BottomSheet, useToast } from '../../ui/overlays'
import { useSession } from '../../store/session'
import { applySuggestion, buildSuggestion, userDietContext, type Suggestion } from '../../lib/dietTemplates'
import { foodsMap } from '../../lib/diet'
import { DISCLAIMER, STYLE_IDEA, STYLE_LABEL, WARN_LOW, LOCK_BELOW, type DietStyle, type FitMeal } from '../../domain/dietSuggest'
import type { Goal } from '../../domain/diet'

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')
const fmtG = (label: string, g: number) => (/leite/i.test(label) ? `${Math.round(g / 1.03 / 10) * 10} ml` : /^ovo/i.test(label) ? `${g} g (${Math.round(g / 50)} un.)` : `${g} g`)

export function StyleCards({ s, style, onStyle }: { s: Suggestion; style: DietStyle; onStyle: (st: DietStyle) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {s.styles.map((x) => (
        <button key={x.style} onClick={() => onStyle(x.style)} className={`rounded-card border p-4 text-left transition ${style === x.style ? 'border-lime bg-lime/[0.06]' : 'border-border bg-surface'}`}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">{STYLE_LABEL[x.style]}</span>
            <span className="num shrink-0 font-display text-lg font-bold text-lime">{fmt(x.fit.totals.kcal)}<span className="ml-1 text-xs text-muted">kcal</span></span>
          </div>
          <div className="mt-0.5 text-xs text-muted">{STYLE_IDEA[x.style]}</div>
          <div className="num mt-2 text-xs">
            P <b className="text-prot">{x.fit.totals.p} g</b> · C <b className="text-carb">{x.fit.totals.c} g</b> · G <b className="text-fat">{x.fit.totals.f} g</b>
          </div>
          <div className="mt-2 text-[11px] leading-snug text-muted">
            {x.fit.meals.map((m) => `${m.name}: ${m.items.slice(0, 2).map((i) => i.label.split(' (')[0].toLowerCase()).join(', ')}`).join(' · ')}
          </div>
          {s.defaultStyle === x.style && <div className="label mt-2 text-lime">Sugerido para o seu objetivo</div>}
          {x.fit.proteinAdjusted === 'down' && <div className="mt-1 text-[11px] text-gold">Proteína limitada a 2,2 g/kg do seu peso, compensada com carboidrato.</div>}
          {x.fit.proteinAdjusted === 'up' && <div className="mt-1 text-[11px] text-gold">Proteína aumentada para 1,6 g/kg do seu peso.</div>}
        </button>
      ))}
    </div>
  )
}

export function MealsSheet({ open, onClose, meals, title }: { open: boolean; onClose: () => void; meals?: FitMeal[]; title: string }) {
  const foods = useLiveQuery(() => foodsMap())
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        {meals?.map((m) => {
          const kcal = m.items.reduce((a, it) => {
            const f = foods?.get(it.foodId)
            return a + (f ? ((f.per100g.p * 4 + f.per100g.c * 4 + f.per100g.f * 9) * it.grams) / 100 : 0)
          }, 0)
          return (
            <div key={m.name} className="rounded-btn border border-border bg-surface2 p-3">
              <div className="mb-1.5 flex items-baseline justify-between"><span className="font-semibold">{m.name}</span><span className="num text-xs text-muted">{fmt(kcal)} kcal</span></div>
              <ul className="space-y-1 text-sm">
                {m.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2"><span>{it.label}</span><span className="num shrink-0 text-muted">{fmtG(it.label, it.grams)}</span></li>
                ))}
              </ul>
            </div>
          )
        })}
        <p className="text-[11px] text-muted">Pesos de alimentos já cozidos/prontos.</p>
      </div>
    </BottomSheet>
  )
}

export default function DietaSugerida() {
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const uid = useSession((s) => s.user?.id)
  const [params] = useSearchParams()
  const bandId = params.get('faixa') ?? undefined
  const ctx = useLiveQuery(() => userDietContext(), [uid])
  const [goal, setGoal] = useState<Goal | null>(null)
  const [aggressive, setAggressive] = useState(false)
  const [fast, setFast] = useState(false)
  const [s, setS] = useState<Suggestion | null>(null)
  const [style, setStyle] = useState<DietStyle | null>(null)
  const [mealsOpen, setMealsOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const g = goal ?? ctx?.goal ?? 'cut'

  useEffect(() => {
    if (!ctx || ctx.missing.length || !ctx.profile?.sex) return
    let alive = true
    buildSuggestion({ sex: ctx.profile.sex, weightKg: ctx.weightKg!, heightCm: ctx.profile.heightCm!, age: ctx.age!, activity: ctx.activity, goal: g, realTdee: ctx.realTdee }, { aggressive, fast, bandId }).then((r) => {
      if (!alive) return
      setS(r)
      setStyle((cur) => cur ?? r.defaultStyle)
    })
    return () => { alive = false }
  }, [ctx, g, aggressive, fast, bandId])

  if (!ctx) return null
  if (ctx.missing.length) {
    return (
      <div className="pt-6">
        <h1 className="mb-2 font-display text-2xl font-bold">Sua dieta sugerida</h1>
        <Card><p className="text-sm">Para sugerir a dieta, complete: <b>{ctx.missing.join(', ')}</b>.</p>
          <PrimaryButton className="mt-3" onClick={() => nav(ctx.missing.includes('peso') ? '/corpo' : '/perfil')}>Completar</PrimaryButton></Card>
      </div>
    )
  }
  if (!s || !style) return <div className="py-20 text-center text-sm text-muted">Montando sua dieta…</div>
  const sel = s.styles.find((x) => x.style === style)!
  const locked = s.band.max <= LOCK_BELOW

  async function aplicar() {
    if (!s || !style || !ctx?.weightKg) return
    setBusy(true)
    await applySuggestion(s, style, { weightKg: ctx.weightKg, activity: ctx.activity, goal: g })
    setBusy(false)
    toast('Dieta aplicada ao seu plano')
    nav('/dieta')
  }

  return (
    <div className="pb-40">
      <div className="flex items-center justify-between pb-2 pt-4">
        <button className="h-10 w-10 text-2xl" onClick={() => nav(-1)} aria-label="Voltar">‹</button>
        <h1 className="font-display text-lg font-bold">Sua dieta sugerida</h1>
        <span className="w-10" />
      </div>

      <Card className="mb-3 border-lime/30">
        {s.manual ? (
          <>
            <Label>Faixa escolhida</Label>
            <div className="num mt-1 font-display text-3xl font-extrabold">{fmt(s.band.min)}–{fmt(s.band.max)} <span className="text-base text-muted">kcal</span></div>
            <p className="mt-1 text-sm text-muted">Sua meta calculada é {fmt(s.target.kcal)} kcal/dia (faixa recomendada: {fmt(s.recommended.min)}–{fmt(s.recommended.max)}).</p>
          </>
        ) : (
          <>
            <Label>Sua meta</Label>
            <div className="num mt-1 font-display text-4xl font-extrabold">{fmt(s.target.kcal)} <span className="text-base font-semibold text-muted">kcal/dia</span></div>
            <p className="mt-1 text-sm text-muted">{s.target.explanation}</p>
            {s.target.tdeeSource === 'real' && <p className="mt-1 text-sm text-lime">Usando o seu gasto real das últimas semanas (calorias adaptativas), não a estimativa.</p>}
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {(['cut', 'maintain', 'bulk'] as Goal[]).map((x) => <Chip key={x} active={g === x} onClick={() => setGoal(x)}>{x === 'cut' ? 'Definição' : x === 'maintain' ? 'Manutenção' : 'Ganhar massa'}</Chip>)}
        </div>
        {g === 'cut' && <div className="mt-2 flex flex-wrap gap-2"><Chip active={!aggressive} onClick={() => setAggressive(false)}>−20%</Chip><Chip active={aggressive} onClick={() => setAggressive(true)}>Agressiva −25%</Chip></div>}
        {g === 'bulk' && <div className="mt-2 flex flex-wrap gap-2"><Chip active={!fast} onClick={() => setFast(false)}>+10%</Chip><Chip active={fast} onClick={() => setFast(true)}>Rápida +15%</Chip></div>}
        {s.target.floored && <p className="mt-2 text-sm text-gold">A conta deu {fmt(s.target.raw)} kcal, abaixo do mínimo seguro. Subimos para {fmt(s.target.kcal)} kcal.</p>}
        {s.target.warnings.map((w) => <p key={w} className="mt-2 text-sm text-gold">{w}</p>)}
        {locked && <p className="mt-2 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">🔒 {WARN_LOW}</p>}
      </Card>

      <Label className="mb-2">Escolha o estilo</Label>
      <StyleCards s={s} style={style} onStyle={setStyle} />

      <div className="mt-3 flex gap-2">
        <PrimaryButton variant="ghost" full onClick={() => setMealsOpen(true)}>Ver refeições</PrimaryButton>
        <PrimaryButton variant="ghost" full onClick={() => nav('/dieta/prontas')}>Escolher outra faixa</PrimaryButton>
      </div>
      <p className="mt-4 text-center text-[11px] leading-snug text-muted/80">{DISCLAIMER}</p>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-4 py-3">
          <PrimaryButton full onClick={() => setConfirm(true)}>Aplicar ao meu plano · {fmt(sel.fit.totals.kcal)} kcal</PrimaryButton>
        </div>
      </div>

      <MealsSheet open={mealsOpen} onClose={() => setMealsOpen(false)} meals={sel.fit.meals} title={`${STYLE_LABEL[style]} · ${fmt(sel.fit.totals.kcal)} kcal`} />

      <BottomSheet open={confirm} onClose={() => setConfirm(false)} title="Aplicar ao meu plano?" footer={
        <div className="flex gap-2">
          <PrimaryButton variant="ghost" onClick={() => setConfirm(false)}>Cancelar</PrimaryButton>
          <PrimaryButton full disabled={busy} onClick={aplicar}>{busy ? 'Aplicando…' : 'Aplicar'}</PrimaryButton>
        </div>
      }>
        <p className="text-sm">Isso vai substituir seu plano atual. O histórico continua salvo.</p>
        <p className="mt-2 text-sm text-muted">Suas metas passam a ser {fmt(sel.fit.totals.kcal)} kcal · P {sel.fit.totals.p} g · C {sel.fit.totals.c} g · G {sel.fit.totals.f} g. Tudo continua editável no Plano alimentar e em Metas.</p>
      </BottomSheet>
    </div>
  )
}
