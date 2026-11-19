import { Header } from '../ui/Header'
import { EmptyState, SectionTitle } from '../ui/primitives'

export default function Progresso() {
  return (
    <>
      <Header title="Progresso" />
      <SectionTitle kicker="Metas" title="Sua meta principal" />
      <EmptyState title="Nenhuma meta" text="Peso, cintura, % de gordura, uma carga ou frequência. O VEYRO prevê quando você chega lá." />
      <div className="h-6" />
      <SectionTitle kicker="Recordes" title="Seus PRs" />
      <EmptyState title="Sem recordes ainda" text="A primeira sessão de cada exercício vira a linha de base. A partir da segunda, cada recorde é comemorado." />
    </>
  )
}
