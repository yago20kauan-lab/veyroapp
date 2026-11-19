import type { Program, RoutineItem } from './schema'

const it = (exerciseId: string, sets: number, repMin: number, repMax: number, restSec?: number, extra: Partial<RoutineItem> = {}): RoutineItem => ({
  exerciseId, sets, repMin, repMax, restSec: restSec ?? 90, ...extra,
})
const C = 150 // descanso compostos
const I = 75 // descanso isoladores

/** Programa do usuário de referência (A13): Retorno + Definição 5x. */
const retorno5x: Program = {
  id: 'retorno-definicao-5x',
  name: 'Retorno + Definição 5x',
  level: 'intermediario',
  daysPerWeek: 5,
  description: '4 semanas de retorno progressivo (55% → 90% das cargas antigas) e depois Push/Pull/Pernas/Superior/Inferior com progressão dupla.',
  forWho: 'Quem está voltando de uma pausa e quer secar sem perder músculo',
  phases: [
    { name: 'Retorno', type: 'return', weeks: 4, rules: [
      { week: 1, pct: 0.55, sets: '2', rpeMax: 7 },
      { week: 2, pct: 0.7, sets: '3', rpeMax: 7.5 },
      { week: 3, pct: 0.8, sets: '3', rpeMax: 8.5 },
      { week: 4, pct: 0.9, sets: '3-4', rpeMax: 9 },
    ] },
    { name: 'Normal', type: 'normal', weeks: null, rules: [] },
  ],
  routines: [
    // Semanas 1–2
    { name: 'Superior', weekday: 1, fromWeek: 1, items: [
      it('supino-reto-halteres', 3, 10, 12, C), it('remada-baixa', 3, 10, 12, C), it('desenvolvimento-halteres', 3, 10, 12, C),
      it('puxada-frente', 3, 10, 12, C), it('rosca-direta', 3, 12, 12, I, { supersetGroup: 'A' }), it('triceps-corda', 3, 12, 12, I, { supersetGroup: 'A' }) ] },
    { name: 'Inferior', weekday: 2, fromWeek: 1, items: [
      it('hack', 3, 10, 12, C), it('stiff-halteres', 3, 10, 12, C), it('cadeira-extensora', 3, 12, 12, I), it('mesa-flexora', 3, 12, 12, I), it('panturrilha-pe', 3, 15, 15, 60) ] },
    { name: 'Cardio + Core', weekday: 3, fromWeek: 1, items: [
      it('esteira-inclinada', 1, 1, 1, 0, { minutes: 35 }), it('prancha', 3, 1, 1, 60, { seconds: 40 }), it('abdominal-infra', 3, 12, 15, 60) ] },
    { name: 'Superior', weekday: 4, fromWeek: 1, items: [
      it('supino-inclinado-halteres', 3, 10, 12, C), it('remada-unilateral', 3, 10, 12, C), it('elevacao-lateral', 3, 12, 15, I),
      it('crucifixo-halteres', 3, 12, 12, I), it('rosca-martelo', 3, 12, 12, I, { supersetGroup: 'A' }), it('triceps-corda', 3, 12, 12, I, { supersetGroup: 'A' }) ] },
    { name: 'Inferior', weekday: 5, fromWeek: 1, items: [
      it('leg-press', 3, 10, 12, C), it('terra-romeno', 3, 10, 12, C), it('afundo', 3, 10, 10, C), it('mesa-flexora', 3, 12, 12, I), it('panturrilha-pe', 3, 15, 15, 60) ] },
    // Semana 3+
    { name: 'Push', weekday: 1, fromWeek: 3, items: [
      it('supino-reto-barra', 4, 6, 8, C), it('supino-inclinado-halteres', 3, 8, 10, C), it('desenvolvimento-halteres', 3, 8, 10, C),
      it('elevacao-lateral', 4, 12, 15, I), it('triceps-corda', 3, 12, 12, I) ] },
    { name: 'Pull', weekday: 2, fromWeek: 3, items: [
      it('puxada-frente', 4, 8, 8, C), it('remada-curvada', 4, 8, 8, C), it('remada-unilateral', 3, 10, 10, C), it('face-pull', 3, 15, 15, I), it('rosca-direta', 3, 10, 12, I) ] },
    { name: 'Pernas', weekday: 3, fromWeek: 3, items: [
      it('agachamento-livre', 4, 6, 8, 180), it('terra-romeno', 3, 8, 8, 180), it('leg-press', 3, 12, 12, C), it('mesa-flexora', 3, 12, 12, I), it('panturrilha-pe', 4, 12, 15, 60) ] },
    { name: 'Superior completo', weekday: 4, fromWeek: 3, items: [
      it('supino-maquina', 3, 10, 12, C), it('puxada-frente', 3, 10, 12, C), it('desenvolvimento-maquina', 3, 10, 12, C),
      it('crucifixo-inverso', 3, 12, 15, I), it('rosca-alternada', 3, 10, 12, I, { supersetGroup: 'A' }), it('triceps-barra-polia', 3, 10, 12, I, { supersetGroup: 'A' }) ] },
    { name: 'Inferior + Core', weekday: 5, fromWeek: 3, items: [
      it('agachamento-bulgaro', 3, 10, 10, C), it('stiff-barra', 3, 10, 10, C), it('cadeira-extensora', 3, 15, 15, I), it('prancha', 3, 1, 1, 60, { seconds: 45 }), it('abdominal-infra', 3, 15, 15, 60) ] },
  ],
}

const fullBody3x: Program = {
  id: 'full-body-3x', name: 'Full Body 3x', level: 'iniciante', daysPerWeek: 3,
  description: 'Corpo inteiro em cada treino, alternando A e B.', forWho: 'Iniciante ou pouco tempo',
  routines: [
    { name: 'Full Body A', weekday: 1, items: [it('agachamento-livre', 3, 8, 10, 180), it('supino-reto-barra', 3, 8, 10, C), it('remada-baixa', 3, 10, 12, C), it('elevacao-lateral', 2, 12, 15, I), it('prancha', 3, 1, 1, 60, { seconds: 40 })] },
    { name: 'Full Body B', weekday: 3, items: [it('leg-press', 3, 10, 12, C), it('puxada-frente', 3, 10, 12, C), it('desenvolvimento-halteres', 3, 8, 10, C), it('stiff-halteres', 3, 10, 12, C), it('rosca-direta', 2, 12, 12, I)] },
    { name: 'Full Body A', weekday: 5, items: [it('agachamento-livre', 3, 8, 10, 180), it('supino-reto-barra', 3, 8, 10, C), it('remada-baixa', 3, 10, 12, C), it('elevacao-lateral', 2, 12, 15, I), it('prancha', 3, 1, 1, 60, { seconds: 40 })] },
  ],
}

const upperLower4x: Program = {
  id: 'upper-lower-4x', name: 'Superior/Inferior 4x', level: 'intermediario', daysPerWeek: 4,
  description: 'Cada grupo 2x por semana, com um dia mais pesado e um mais volumoso.', forWho: 'Intermediário',
  routines: [
    { name: 'Superior (força)', weekday: 1, items: [it('supino-reto-barra', 4, 5, 8, 180), it('remada-curvada', 4, 6, 8, C), it('desenvolvimento-barra', 3, 6, 8, C), it('barra-fixa', 3, 6, 10, C), it('rosca-direta', 2, 8, 10, I)] },
    { name: 'Inferior (força)', weekday: 2, items: [it('agachamento-livre', 4, 5, 8, 180), it('terra-romeno', 3, 6, 8, 180), it('leg-press', 3, 10, 12, C), it('panturrilha-pe', 4, 10, 12, 60)] },
    { name: 'Superior (volume)', weekday: 4, items: [it('supino-inclinado-halteres', 3, 8, 12, C), it('remada-unilateral', 3, 10, 12, C), it('elevacao-lateral', 4, 12, 15, I), it('crucifixo-halteres', 3, 12, 15, I), it('triceps-corda', 3, 12, 15, I)] },
    { name: 'Inferior (volume)', weekday: 5, items: [it('hack', 3, 10, 12, C), it('stiff-halteres', 3, 10, 12, C), it('agachamento-bulgaro', 3, 10, 12, C), it('mesa-flexora', 3, 12, 15, I), it('abdominal-polia', 3, 12, 15, 60)] },
  ],
}

const ppl: Program = {
  id: 'ppl', name: 'Push/Pull/Pernas', level: 'intermediario', daysPerWeek: 3,
  description: 'Empurrar, puxar e pernas. Repita 2x na semana para fazer 6 dias.', forWho: 'Intermediário/avançado',
  routines: [
    { name: 'Push', weekday: 1, items: [it('supino-reto-barra', 4, 6, 8, C), it('supino-inclinado-halteres', 3, 8, 10, C), it('desenvolvimento-halteres', 3, 8, 10, C), it('elevacao-lateral', 4, 12, 15, I), it('triceps-corda', 3, 10, 12, I)] },
    { name: 'Pull', weekday: 3, items: [it('barra-fixa', 4, 6, 10, C), it('remada-curvada', 4, 8, 10, C), it('face-pull', 3, 15, 15, I), it('rosca-direta', 3, 8, 12, I), it('rosca-martelo', 2, 10, 12, I)] },
    { name: 'Pernas', weekday: 5, items: [it('agachamento-livre', 4, 6, 8, 180), it('terra-romeno', 3, 8, 10, 180), it('leg-press', 3, 10, 12, C), it('mesa-flexora', 3, 10, 12, I), it('panturrilha-pe', 4, 12, 15, 60)] },
  ],
}

const abc2x: Program = {
  id: 'abc-2x', name: 'ABC 2x', level: 'intermediario', daysPerWeek: 6,
  description: 'A: peito/ombro/tríceps · B: costas/bíceps · C: pernas. Duas voltas por semana.', forWho: 'Divisão clássica brasileira',
  routines: [
    { name: 'A · Peito, ombro, tríceps', weekday: 1, items: [it('supino-reto-barra', 4, 8, 10, C), it('supino-inclinado-halteres', 3, 10, 12, C), it('crucifixo-maquina', 3, 12, 15, I), it('desenvolvimento-halteres', 3, 10, 12, C), it('elevacao-lateral', 3, 12, 15, I), it('triceps-corda', 3, 12, 15, I)] },
    { name: 'B · Costas, bíceps', weekday: 2, items: [it('puxada-frente', 4, 8, 12, C), it('remada-baixa', 3, 10, 12, C), it('remada-unilateral', 3, 10, 12, C), it('pulldown-braco-reto', 3, 12, 15, I), it('rosca-direta', 3, 10, 12, I), it('rosca-martelo', 3, 12, 12, I)] },
    { name: 'C · Pernas', weekday: 3, items: [it('agachamento-livre', 4, 8, 10, 180), it('leg-press', 3, 10, 12, C), it('cadeira-extensora', 3, 12, 15, I), it('stiff-halteres', 3, 10, 12, C), it('mesa-flexora', 3, 12, 15, I), it('panturrilha-pe', 4, 15, 15, 60)] },
  ],
}

const abcde: Program = {
  id: 'abcde', name: 'ABCDE', level: 'avancado', daysPerWeek: 5,
  description: 'Um grupo principal por dia, foco em volume.', forWho: 'Avançado',
  routines: [
    { name: 'A · Peito', weekday: 1, items: [it('supino-reto-barra', 4, 6, 10, C), it('supino-inclinado-halteres', 4, 8, 12, C), it('crossover', 3, 12, 15, I), it('paralelas', 3, 8, 12, C)] },
    { name: 'B · Costas', weekday: 2, items: [it('barra-fixa', 4, 6, 10, C), it('remada-curvada', 4, 8, 10, C), it('remada-maquina', 3, 10, 12, C), it('pulldown-braco-reto', 3, 12, 15, I)] },
    { name: 'C · Ombros', weekday: 3, items: [it('desenvolvimento-barra', 4, 6, 10, C), it('elevacao-lateral', 5, 12, 20, I), it('crucifixo-inverso', 4, 12, 15, I), it('encolhimento', 3, 10, 15, I)] },
    { name: 'D · Pernas', weekday: 4, items: [it('agachamento-livre', 4, 6, 10, 180), it('terra-romeno', 4, 8, 10, 180), it('leg-press', 3, 12, 15, C), it('cadeira-extensora', 3, 15, 15, I), it('panturrilha-sentado', 4, 15, 20, 60)] },
    { name: 'E · Braços', weekday: 5, items: [it('rosca-direta', 4, 8, 12, I), it('triceps-testa', 4, 8, 12, I), it('rosca-scott', 3, 10, 12, I), it('triceps-corda', 3, 12, 15, I), it('rosca-martelo', 3, 12, 12, I)] },
  ],
}

const casa: Program = {
  id: 'casa-viagem', name: 'Em casa / viagem', level: 'iniciante', daysPerWeek: 3,
  description: 'Só halteres e peso do corpo.', forWho: 'Sem academia',
  routines: [
    { name: 'Casa A', weekday: 1, items: [it('afundo', 3, 10, 12, 90), it('flexao', 3, 8, 15, 90), it('remada-unilateral', 3, 10, 12, 90), it('elevacao-lateral', 3, 12, 15, 60), it('prancha', 3, 1, 1, 60, { seconds: 45 })] },
    { name: 'Casa B', weekday: 3, items: [it('agachamento-bulgaro', 3, 10, 12, 90), it('stiff-halteres', 3, 10, 12, 90), it('desenvolvimento-halteres', 3, 10, 12, 90), it('rosca-alternada', 3, 10, 12, 60), it('abdominal-infra', 3, 12, 15, 60)] },
    { name: 'Casa A', weekday: 5, items: [it('afundo', 3, 10, 12, 90), it('flexao', 3, 8, 15, 90), it('remada-unilateral', 3, 10, 12, 90), it('elevacao-lateral', 3, 12, 15, 60), it('prancha', 3, 1, 1, 60, { seconds: 45 })] },
  ],
}

export const seedPrograms: Program[] = [retorno5x, fullBody3x, upperLower4x, ppl, abc2x, abcde, casa]
