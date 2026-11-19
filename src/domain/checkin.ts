/** Motor de ajuste do check-in semanal (A7 item 9). Lógica pura. */
export type CheckinInput = {
  weightKg: number
  /** ritmo da tendência (kg/semana, negativo = perdendo) desta semana e da anterior */
  rateNow: number | null
  ratePrev: number | null
  /** recomendação aplicada na semana anterior */
  lastApplied?: Recommendation['code']
  hunger: number // 1–5
  sleep: number // 1–5
  energy: number // 1–5
  /** exercícios cuja carga caiu nas últimas 2 semanas */
  strengthDrops: number
  goal: 'cut' | 'maintain' | 'bulk'
}

export type Recommendation = {
  code: 'manter' | 'cardio' | 'menos-kcal' | 'mais-kcal' | 'sono' | 'dados'
  title: string
  text: string
  kcalDelta?: number
  cardioMinPerWeek?: number
}

export function weeklyRecommendation(i: CheckinInput): Recommendation {
  if (i.rateNow == null) return { code: 'dados', title: 'Faltam dados', text: 'Registre o peso pelo menos 3x por semana por 2 semanas para o VEYRO avaliar o ritmo.' }
  if (i.hunger >= 4 && i.sleep <= 2) {
    return { code: 'sono', title: 'Priorize o sono antes de cortar', text: 'Fome alta com sono ruim. Durma 7–9 h e aumente legumes e salada (à vontade) antes de mexer nas calorias.' }
  }
  if (i.goal !== 'cut') {
    return { code: 'manter', title: 'Mantém o plano', text: 'Siga as metas atuais e acompanhe a tendência.' }
  }
  const lossPct = (-i.rateNow / i.weightKg) * 100
  const tooFastNow = -i.rateNow > 1
  const tooFastPrev = i.ratePrev != null && -i.ratePrev > 1
  if ((tooFastNow && tooFastPrev) || i.strengthDrops > 3) {
    return { code: 'mais-kcal', title: 'Perda rápida demais', text: 'Some ~150 kcal em carboidrato no pré-treino para proteger músculo e força.', kcalDelta: 150 }
  }
  const stalledNow = -i.rateNow < 0.25
  const stalledPrev = i.ratePrev != null && -i.ratePrev < 0.25
  if (stalledNow && stalledPrev) {
    if (i.lastApplied === 'cardio') {
      return { code: 'menos-kcal', title: 'Tendência parada de novo', text: 'Corte ~200 kcal por dia (ex.: −75 g de arroz no jantar).', kcalDelta: -200 }
    }
    return { code: 'cardio', title: 'Tendência parada há 2 semanas', text: 'Primeiro passo: +10 min de cardio em 2 dias da semana.', cardioMinPerWeek: 20 }
  }
  if (lossPct >= 0.5 && lossPct <= 1.0) return { code: 'manter', title: 'Perfeito. Mantém tudo.', text: `Perdendo ${(-i.rateNow).toFixed(2).replace('.', ',')} kg/semana: ritmo ideal para secar sem perder músculo.` }
  return { code: 'manter', title: 'Mantém o plano', text: 'Ritmo dentro do aceitável. Reavalie na próxima semana.' }
}
