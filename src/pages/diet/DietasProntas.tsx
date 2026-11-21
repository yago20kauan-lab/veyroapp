import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Label, PrimaryButton } from '../../ui/primitives'
import { BottomSheet } from '../../ui/overlays'
import { useSession } from '../../store/session'
import { loadTemplates, userDietContext } from '../../lib/dietTemplates'
import { bandLevel, LOCK_BELOW, recommendedBand, STYLE_LABEL, suggestTarget, WARN_LOW, type DietBand } from '../../domain/dietSuggest'

const fmt = (n: number) => n.toLocaleString('pt-BR')
const LEVELS = ['Restrita', 'Baixa', 'Moderada', 'Alta', 'Muito alta', 'Atleta', 'Alto volume']

export default function DietasProntas() {
  const nav = useNavigate()
  const uid = useSession((s) => s.user?.id)
  const data = useLiveQuery(() => loadTemplates())
  const rec = useLiveQuery(async () => {
    const ctx = await userDietContext()
    const d = await loadTemplates()
    if (ctx.missing.length || !ctx.profile?.sex) return null
    const t = suggestTarget({ sex: ctx.profile.sex, weightKg: ctx.weightKg!, heightCm: ctx.profile.heightCm!, age: ctx.age!, activity: ctx.activity, goal: ctx.goal, realTdee: ctx.realTdee })
    return { id: recommendedBand(d.faixas, t.kcal).id, kcal: t.kcal }
  }, [uid])
  const [warn, setWarn] = useState<DietBand | null>(null)

  if (!data) return null
  const open = (b: DietBand) => (b.max <= LOCK_BELOW ? setWarn(b) : nav(b.id === rec?.id ? '/dieta/sugestao' : `/dieta/sugestao?faixa=${b.id}`))

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between pb-2 pt-4">
        <button className="h-10 w-10 text-2xl" onClick={() => nav(-1)} aria-label="Voltar">‹</button>
        <h1 className="font-display text-lg font-bold">Dietas prontas</h1>
        <span className="w-10" />
      </div>
      <p className="mb-4 text-sm text-muted">17 faixas de calorias, cada uma com 3 estilos: {Object.values(STYLE_LABEL).join(', ').toLowerCase()}.{rec ? ` Sua meta hoje: ${fmt(rec.kcal)} kcal/dia.` : ''}</p>
      {LEVELS.map((lvl) => {
        const bands = data.faixas.filter((b) => bandLevel(b.min) === lvl)
        if (!bands.length) return null
        return (
          <div key={lvl} className="mb-4">
            <Label className="mb-2">{lvl}</Label>
            <div className="flex flex-col gap-2">
              {bands.map((b) => {
                const isRec = b.id === rec?.id
                const locked = b.max <= LOCK_BELOW
                return (
                  <Card key={b.id} onClick={() => open(b)} className={`!py-3 ${isRec ? 'border-lime/60' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="num whitespace-nowrap font-semibold">{locked && '🔒 '}{fmt(b.min)}–{fmt(b.max)} kcal</div>
                        <div className="num mt-0.5 text-xs text-muted">{b.dietas.map((d) => `${fmt(d.kcal)}`).join(' · ')} kcal · 3 estilos</div>
                        {isRec && <span className="label mt-2 inline-block rounded-full bg-lime px-2.5 py-1 text-onlime">Recomendada para você</span>}
                      </div>
                      <span className="text-muted">›</span>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
      <BottomSheet open={!!warn} onClose={() => setWarn(null)} title="Atenção" footer={
        <div className="flex gap-2">
          <PrimaryButton variant="ghost" onClick={() => setWarn(null)}>Voltar</PrimaryButton>
          <PrimaryButton full onClick={() => { const b = warn!; setWarn(null); nav(`/dieta/sugestao?faixa=${b.id}`) }}>Entendi, ver mesmo assim</PrimaryButton>
        </div>
      }>
        <p className="text-sm">🔒 {WARN_LOW}</p>
        <p className="mt-2 text-sm text-muted">Essa faixa nunca é recomendada automaticamente.</p>
      </BottomSheet>
    </div>
  )
}
