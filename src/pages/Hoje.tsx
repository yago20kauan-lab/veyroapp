import { useNavigate } from 'react-router-dom'
import { Header } from '../ui/Header'
import { Card, Label, PrimaryButton, EmptyState } from '../ui/primitives'
import { Ring } from '../ui/charts'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function Hoje() {
  const nav = useNavigate()
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  return (
    <>
      <Header />
      <div className="mb-5">
        <Label>{date}</Label>
        <h1 className="mt-1 font-display text-[26px] font-bold leading-tight">{greeting()}.</h1>
      </div>

      <Card className="mb-4">
        <Label className="mb-2 text-lime">Treino de hoje</Label>
        <EmptyState
          title="Nenhum plano ativo"
          text="Escolha um programa pronto ou monte o seu. O VEYRO calcula a carga de cada série."
          action={<PrimaryButton onClick={() => nav('/treinar')}>Ver programas</PrimaryButton>}
        />
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <Label>Peso</Label>
          <div className="num mt-2 font-display text-3xl font-bold">—</div>
          <div className="mt-1 text-xs text-muted">Toque para registrar</div>
        </Card>
        <Card>
          <Label>Passos</Label>
          <div className="mt-2 flex items-center gap-3">
            <Ring value={0} size={52} stroke={6}><span className="num text-[11px] font-bold">0</span></Ring>
            <span className="text-xs text-muted">meta<br />8–10 mil</span>
          </div>
        </Card>
        <Card>
          <Label>Água</Label>
          <div className="mt-2 flex items-center gap-3">
            <Ring value={0} max={3250} size={52} stroke={6} color="#3DF2FF"><span className="num text-[11px] font-bold">0 L</span></Ring>
            <span className="text-xs text-muted">+250 ml</span>
          </div>
        </Card>
        <Card>
          <Label>Dieta</Label>
          <div className="mt-3 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => <span key={i} className="h-3 w-3 rounded-full border border-border bg-surface2" />)}
          </div>
          <div className="num mt-2 text-xs text-muted">0 kcal · 0 g P</div>
        </Card>
      </div>
    </>
  )
}
