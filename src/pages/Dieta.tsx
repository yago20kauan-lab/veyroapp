import { Header } from '../ui/Header'
import { Card, EmptyState, Label, PrimaryButton } from '../ui/primitives'
import { MacroBar, Ring } from '../ui/charts'

export default function Dieta() {
  return (
    <>
      <Header title="Diário" subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })} />
      <Card className="mb-4">
        <div className="flex items-center gap-5">
          <Ring value={0} max={2295} size={128} stroke={11}>
            <span className="num font-display text-2xl font-extrabold">—</span>
            <span className="label" style={{ fontSize: 9 }}>kcal restantes</span>
          </Ring>
          <div className="flex flex-1 flex-col gap-3">
            <MacroBar label="Proteína" value={0} target={0} />
            <MacroBar label="Carbo" value={0} target={0} />
            <MacroBar label="Gordura" value={0} target={0} />
          </div>
        </div>
      </Card>
      <Label className="mb-2">Refeições</Label>
      <EmptyState title="Defina suas metas" text="O calculador usa idade, altura, peso e objetivo. Depois é só montar o plano ou escolher um modelo." action={<PrimaryButton>Calcular metas</PrimaryButton>} />
    </>
  )
}
