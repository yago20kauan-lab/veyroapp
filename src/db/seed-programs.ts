import type { Phase, Program, RoutineItem } from './schema'

/**
 * Programas prontos montados por treinador (transcritos das planilhas enviadas pelo Yago).
 *
 * Cada exercício é uma linha:  id | trabalho | descanso(s) | opções…
 *   trabalho: "2x6-10", "3x15-20", "3xmax" (máximo de repetições) ou "p:15-20,10-15,8-12" (uma faixa por série)
 *   opções:   "aq 1-2x10-15" aquecimento · "aj 1-2x4-6" ou "aj 1x4-6+1-2x2-4" séries de ajuste
 *             "rp2" 2 rest-pause · "drop" / "drop2" · "parc" parciais após a falha · "pico2" pico de contração
 *             "alt: …" alternativa de equipamento · "obs: …" observação livre
 */
const fmtRange = (s: string) => s.replace(/(\d)-(\d)/g, '$1–$2').replace(/x/g, '×').replace(/\+/g, ' + ')

function parseItem(line: string): RoutineItem {
  const [id, work, rest, ...opts] = line.split('|').map((s) => s.trim())
  const it: RoutineItem = { exerciseId: id, sets: 3, repMin: 10, repMax: 12, restSec: Number(rest) || 90 }
  if (work.startsWith('p:')) {
    const pyr = work.slice(2).split(',').map((r) => r.split('-').map(Number) as [number, number])
    it.pyramid = pyr
    it.sets = pyr.length
    it.repMin = Math.min(...pyr.map((p) => p[0]))
    it.repMax = Math.max(...pyr.map((p) => p[1]))
  } else {
    const m = /^(\d+)x(max|\d+)(?:-(\d+))?$/.exec(work)
    if (!m) throw new Error(`Trabalho inválido: ${line}`)
    it.sets = Number(m[1])
    if (m[2] === 'max') {
      it.amrap = true
      it.repMin = 10
      it.repMax = 30
    } else {
      it.repMin = Number(m[2])
      it.repMax = Number(m[3] ?? m[2])
    }
  }
  const tech: string[] = []
  for (const o of opts) {
    if (o.startsWith('aq ')) it.warmup = fmtRange(o.slice(3))
    else if (o.startsWith('aj ')) it.feeder = fmtRange(o.slice(3))
    else if (o.startsWith('alt:')) it.alt = o.slice(4).trim()
    else if (o.startsWith('obs:')) tech.push(o.slice(4).trim())
    else if (o === 'rp2') tech.push('2 rest-pause de 10 s na última série')
    else if (o === 'drop') tech.push('1 drop set na última série')
    else if (o === 'drop2') tech.push('2 drops na última série')
    else if (o === 'parc') tech.push('10 repetições parciais após a falha em todas as séries de trabalho')
    else if (/^pico\d$/.test(o)) tech.unshift(`Segure ${o.slice(4)} s no pico da contração`)
    else throw new Error(`Opção desconhecida "${o}" em: ${line}`)
  }
  if (tech.length) it.technique = tech.join(' · ')
  return it
}

type R = { name: string; days: number[]; note?: string; items: string }
function routines(list: R[]): Program['routines'] {
  return list.flatMap((r) => {
    const items = r.items.trim().split('\n').map((l) => l.trim()).filter(Boolean).map(parseItem)
    return r.days.map((weekday) => ({ name: r.name, weekday, note: r.note, items: items.map((i) => ({ ...i })) }))
  })
}

/** 4 semanas de volta gradual (55% → 90% das cargas antigas). Opcional ao ativar qualquer programa. */
export const RETURN_PHASES: NonNullable<Program['phases']> = [
  { name: 'Retorno', type: 'return', weeks: 4, rules: [
    { week: 1, pct: 0.55, sets: '2', rpeMax: 7 },
    { week: 2, pct: 0.7, sets: '3', rpeMax: 7.5 },
    { week: 3, pct: 0.8, sets: '3', rpeMax: 8.5 },
    { week: 4, pct: 0.9, sets: '3-4', rpeMax: 9 },
  ] } as Omit<Phase, 'id' | 'startDate' | 'user_id' | 'updated_at' | 'deleted_at'>,
  { name: 'Normal', type: 'normal', weeks: null, rules: [] } as Omit<Phase, 'id' | 'startDate' | 'user_id' | 'updated_at' | 'deleted_at'>,
]

const SEG = 1, TER = 2, QUA = 3, QUI = 4, SEX = 5, SAB = 6, DOM = 0
const MOB_SUP = 'Antes: mobilidade de ombros e alongamento de peito.'
const MOB_INF = 'Antes: mobilidade e alongamento de posteriores de coxa, glúteos, quadríceps e iliopsoas.'

const SERIES_TIPS = [
  'Aquecimento: cerca de 30% da carga, bem longe da falha, para preparar músculos e articulações.',
  'Ajuste: 4 a 6 repetições com carga próxima da de trabalho, sem falhar. Serve para sentir como está o dia e decidir a carga.',
  'Trabalho (série válida): vá até a falha dentro da faixa de repetições. Se não chegar ao mínimo, está pesado; se passar do máximo, está leve.',
  'Progressão: a cada semana melhore algo nas séries válidas: mais 1 ou 2 repetições, um pouco mais de carga ou execução melhor.',
]

/* ------------------------------------------------------------------ INICIANTES */

const adaptacao: Program = {
  id: 'adaptacao-muscular', name: 'Adaptação muscular', level: 'iniciante', daysPerWeek: 2, audience: 'todos', split: 'Corpo inteiro',
  description: 'Primeira etapa para quem está começando: coordenação, consciência muscular e “acordar” o físico. Não é para treinar até a falha nem ficar dolorido. Cerca de 4 semanas sem faltar e você passa para a próxima etapa (AB 2x).',
  forWho: 'Quem nunca treinou ou está parado há muito tempo',
  tips: ['Sedentário há muito tempo? Semana 1: só 1 série de cada exercício. Semana 2: 2 séries. Semanas 3 e 4: 3 séries.', 'Depois de ~4 semanas, siga para “Iniciantes AB 2x”.'],
  routines: routines([
    { name: 'Corpo inteiro', days: [SEG, QUI], items: `
      supino-reto-barra | 3x10-15 | 60 | alt: ou máquina
      leg-press | 3x10-15 | 60
      puxada-triangulo | 3x10-15 | 60
      mesa-flexora | 3x10-15 | 60
      elevacao-lateral | 3x10-15 | 60
      triceps-corda | 3x10-15 | 60
      panturrilha-pe | 3x10-15 | 60
      fx-seated-dumbbell-curl | 3x10-15 | 60` },
  ]),
}

const INI_A = `
  supino-inclinado-halteres | 3x10-15 | 60 | alt: ou barra/máquina
  supino-reto-barra | 3x10-15 | 60 | alt: ou halteres/máquina
  puxada-frente | 3x10-15 | 60
  remada-baixa | 3x10-15 | 60
  desenvolvimento-halteres | 3x10-15 | 60 | obs: sentado
  elevacao-lateral | 3x10-15 | 60
  triceps-corda | 3x10-15 | 60
  rosca-direta | 3x10-15 | 60`
const INI_B = `
  leg-press | 3x10-15 | 60
  cadeira-extensora | 3x10-15 | 60
  cadeira-flexora | 3x10-15 | 60
  mesa-flexora | 3x10-15 | 60
  abdutora | 3x10-15 | 60
  panturrilha-pe | 3x10-15 | 60 | alt: ou no Smith com step
  fx-crunches | 3x10-15 | 60`

const iniciantes2x: Program = {
  id: 'iniciantes-ab-2x', name: 'Iniciantes AB 2x', level: 'iniciante', daysPerWeek: 2, audience: 'todos', split: 'AB',
  description: 'Segunda etapa do iniciante: superiores no A e inferiores no B, 3 séries de 10 a 15 com 1 minuto de intervalo. Para quem já fez as ~4 semanas de adaptação.',
  forWho: 'Iniciante que já fez a adaptação',
  tips: ['Também pode ser feito terça (A) e sexta (B).', 'Depois de ~4 semanas, aumente a frequência com “Iniciantes AB 4x”.'],
  routines: routines([
    { name: 'A · Superiores', days: [SEG], items: INI_A },
    { name: 'B · Inferiores', days: [QUI], items: INI_B },
  ]),
}

const iniciantes4x: Program = {
  id: 'iniciantes-ab-4x', name: 'Iniciantes AB 4x', level: 'iniciante', daysPerWeek: 4, audience: 'todos', split: 'AB',
  description: 'Terceira etapa do iniciante: o mesmo AB, agora 2 vezes por semana cada um.',
  forWho: 'Iniciante que já fez o AB 2x por ~4 semanas',
  routines: routines([
    { name: 'A · Superiores', days: [SEG, QUI], items: INI_A },
    { name: 'B · Inferiores', days: [TER, SEX], items: INI_B },
  ]),
}

/* ------------------------------------------------------------------ MULHERES */

const mulheres2x: Program = {
  id: 'mulheres-ab-2x', name: 'Mulheres AB 2x', level: 'iniciante', daysPerWeek: 2, audience: 'feminino', split: 'AB',
  description: 'Dois treinos de corpo inteiro com ênfase em pernas e glúteos. 3 séries de 10 a 15, 1 minuto de intervalo.',
  forWho: 'Mulheres que treinam 2 vezes por semana',
  tips: ['Também pode ser feito terça (A) e sexta (B).'],
  routines: routines([
    { name: 'A', days: [SEG], items: `
      leg-press | 3x10-15 | 60
      supino-reto-barra | 3x10-15 | 60
      cadeira-flexora | 3x10-15 | 60
      puxada-triangulo | 3x10-15 | 60
      fx-thigh-adductor | 3x10-15 | 60
      elevacao-lateral | 3x10-15 | 60
      abdutora | 3x10-15 | 60
      triceps-corda | 3x10-15 | 60` },
    { name: 'B', days: [QUI], items: `
      cadeira-extensora | 3x10-15 | 60
      crucifixo-maquina | 3x10-15 | 60
      mesa-flexora | 3x10-15 | 60
      remada-baixa | 3x10-15 | 60
      fx-thigh-adductor | 3x10-15 | 60
      fx-front-dumbbell-raise | 3x10-15 | 60
      abdutora | 3x10-15 | 60
      panturrilha-pe | 3x10-15 | 60` },
  ]),
}

const mulheres4x: Program = {
  id: 'mulheres-ab-4x', name: 'Mulheres AB 4x', level: 'iniciante', daysPerWeek: 4, audience: 'feminino', split: 'AB',
  description: 'Inferiores no A e superiores no B, cada um 2 vezes por semana. 3 séries de 10 a 15, 1 minuto de intervalo.',
  forWho: 'Mulheres que treinam 4 vezes por semana',
  routines: routines([
    { name: 'A · Inferiores', days: [SEG, QUI], items: `
      leg-press | 3x10-15 | 60
      cadeira-extensora | 3x10-15 | 60
      cadeira-flexora | 3x10-15 | 60
      mesa-flexora | 3x10-15 | 60
      abdutora | 3x10-15 | 60
      fx-thigh-adductor | 3x10-15 | 60
      fx-crunches | 3x15-20 | 60` },
    { name: 'B · Superiores', days: [TER, SEX], items: `
      supino-inclinado-barra | 3x10-15 | 60
      puxada-frente | 3x10-15 | 60
      remada-baixa | 3x10-15 | 60
      desenvolvimento-halteres | 3x10-15 | 60 | obs: sentado
      elevacao-lateral | 3x10-15 | 60
      triceps-corda | 3x10-15 | 60
      panturrilha-pe | 3x10-15 | 60 | alt: ou no Smith com step` },
  ]),
}

const mulheresAvancadas3x: Program = {
  id: 'mulheres-abc-3x', name: 'Mulheres avançadas ABC 3x', level: 'avancado', daysPerWeek: 3, audience: 'feminino', split: 'ABC',
  description: 'Para mulheres avançadas que treinam 3 vezes por semana: quadríceps e glúteos no A, superiores no B, posteriores e glúteos no C. Usa progressão de carga série a série, rest-pause, parciais e pico de contração.',
  forWho: 'Mulheres avançadas, 3 dias por semana',
  tips: ['Progressão de carga: cada série tem a sua faixa de repetições e a carga sobe a cada série.'],
  routines: routines([
    { name: 'A · Quadríceps e glúteos', days: [SEG], items: `
      agachamento-livre | p:15-20,10-15,8-12,6-10 | 120 | alt: ou no Smith | obs: Progressão de carga a cada série
      hack | p:10-15,8-12,8-12 | 90 | obs: Na última série, 2 rest-pause
      leg-press | p:10-15,8-12,8-12 | 90 | parc
      elevacao-pelvica | 3x10-15 | 60 | pico2 | obs: 1 rest-pause em cada série
      abdutora | 5x10-15 | 45 | pico2
      panturrilha-pe | p:15-20,10-15,8-12,6-10 | 60 | alt: ou no Smith com step | obs: Progressão de carga e drop set` },
    { name: 'B · Superiores', days: [QUA], items: `
      fx-decline-crunch | 3xmax | 45
      puxada-frente | 4x10-15 | 45 | pico2
      remada-baixa | 4x10-15 | 45 | pico2
      supino-inclinado-halteres | 4x10-15 | 45
      fx-front-dumbbell-raise | 4x10-15 | 45 | obs: sentada
      fx-seated-side-lateral-raise | 4x10-15 | 45 | parc
      triceps-corda | 4x10-15 | 45 | pico2` },
    { name: 'C · Posteriores e glúteos', days: [SEX], items: `
      mesa-flexora | p:15-20,10-15,8-12,6-10 | 120 | obs: Progressão de carga a cada série
      cadeira-flexora | p:15-20,10-15,8-12 | 90 | pico2 | obs: Na última série, 2 rest-pause
      stiff-barra | 3x8-12 | 45
      fx-smith-single-leg-split-squat | 3x8-12 | 45 | obs: Afundo no Smith com step · 45 s entre cada perna
      elevacao-pelvica | p:15-20,10-15,8-12,6-10 | 90 | obs: Nas duas últimas séries, 2 rest-pause de 10 s
      abdutora | 5x10-15 | 45 | pico3` },
  ]),
}

const upperLowerFeminino: Program = {
  id: 'upper-lower-feminino-4x', name: 'Superior/Inferior feminino 4x', level: 'avancado', daysPerWeek: 4, audience: 'feminino', split: 'Upper/Lower',
  description: 'Divisão avançada para mulheres que treinam 4 vezes por semana e dominam as execuções: cada grupo 2x por semana, com ênfase em membros inferiores. Controle as cargas e evolua repetições ou carga toda semana.',
  forWho: 'Mulheres avançadas, 4 dias por semana',
  tips: SERIES_TIPS,
  routines: routines([
    { name: 'Inferior 1', days: [TER], note: MOB_INF, items: `
      mesa-flexora | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      fx-smith-machine-squat | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      leg-press | 2x6-10 | 150 | aj 1x4-6+1-2x2-4
      cadeira-extensora | 2x6-10 | 150 | aj 1-2x2-4
      stiff-barra | 2x6-10 | 150 | aj 1x4-6+1-2x2-4
      abdutora | 2x6-10 | 150 | aj 1-2x2-4` },
    { name: 'Superior 1', days: [SEG], note: MOB_SUP, items: `
      supino-inclinado-halteres | 2x8-12 | 150 | aq 1-2x10-15 | aj 1x4-6 | alt: ou máquina/Smith
      puxada-frente | 2x8-12 | 90 | aq 1-2x10-15 | aj 1x4-6
      remada-baixa | 2x8-12 | 90 | aj 1x4-6
      fx-seated-side-lateral-raise | 2x6-10 | 90 | aj 1-2x4-6
      fx-cable-rope-overhead-triceps-extension | 2x8-12 | 90 | aj 1x4-6
      fx-decline-crunch | 3x15-20 | 60` },
    { name: 'Inferior 2', days: [SEX], note: MOB_INF, items: `
      mesa-flexora | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      cadeira-flexora | 2x6-10 | 150 | aj 1-2x2-4
      elevacao-pelvica | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      hack | 2x6-10 | 180 | aj 1x4-6+1-2x2-4
      leg-press | 2x6-10 | 150 | aj 1-2x2-4
      abdutora | 2x6-10 | 150 | aj 1x4-6+1-2x2-4` },
    { name: 'Superior 2', days: [QUI], note: MOB_SUP, items: `
      supino-reto-halteres | 2x8-12 | 90 | aq 1-2x10-15 | aj 1x4-6 | alt: ou máquina/Smith
      remada-curvada | 2x8-12 | 90 | aq 1-2x10-15 | aj 1-2x4-6
      puxada-triangulo | 2x6-10 | 90 | aj 1x4-6
      desenvolvimento-halteres | 2x8-12 | 90 | aj 1-2x4-6 | alt: ou máquina
      fx-cable-one-arm-tricep-extension | 2x6-10 | 90 | aj 1x4-6 | obs: com corda
      fx-knee-hip-raise-on-parallel-bars | 3x15-20 | 60` },
  ]),
}

/* ------------------------------------------------------------------ PPL / ABC */

const pplIntermediario: Program = {
  id: 'ppl-abc-intermediario', name: 'PPL (ABC) 3x · Intermediário', level: 'intermediario', daysPerWeek: 3, audience: 'todos', split: 'ABC (Push/Pull/Legs)',
  description: 'Puxar (costas e bíceps), empurrar (peito, ombros e tríceps) e pernas, com séries de aquecimento, ajuste e 1 série de trabalho até a falha na maioria dos exercícios.',
  forWho: 'Intermediário que domina a execução',
  tips: SERIES_TIPS,
  routines: routines([
    { name: 'A · Costas e bíceps', days: [SEG], items: `
      remada-curvada | 1x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      remada-baixa | 1x6-10 | 150 | aj 1-2x4-6 | pico2
      remada-baixa-aberta | 1x6-10 | 150 | aj 1x4-6 | pico2 | alt: ou máquina pegada aberta
      puxada-triangulo | 1x10-15 | 120 | aj 1-2x4-6 | pico2 | drop
      meio-terra | 1x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      rosca-scott | 2x6-10 | 120 | aj 1-2x4-6 | pico2 | rp2 | alt: ou no cabo
      fx-knee-hip-raise-on-parallel-bars | 3xmax | 60 | pico2` },
    { name: 'B · Peito, ombros e tríceps', days: [QUA], items: `
      supino-inclinado-halteres | 1x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
      supino-reto-halteres | 1x6-10 | 150 | aj 1-2x4-6 | rp2 | alt: ou máquina
      fx-decline-barbell-bench-press | 1x6-10 | 150 | aj 1x4-6 | alt: ou máquina
      crucifixo-maquina | 1x10-15 | 60 | aj 1-2x4-6 | pico2 | drop
      fx-front-dumbbell-raise | 1x6-10 | 150 | aj 1x4-6
      fx-seated-side-lateral-raise | 1x8-12 | 60 | aj 1-2x4-6 | drop
      triceps-corda | 2x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      panturrilha-pe | 3x8-12 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2` },
    { name: 'C · Pernas', days: [SEX], items: `
      cadeira-extensora | 1x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      hack | 1x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | rp2
      leg-press | 1x6-10 | 150 | aj 1-2x4-6 | parc
      mesa-flexora | 1x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2 | rp2
      stiff-barra | 1x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      elevacao-pelvica | 1x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2` },
  ]),
}

const pplAvancado: Program = {
  id: 'ppl-abc-3x', name: 'PPL (ABC) 3x', level: 'avancado', daysPerWeek: 3, audience: 'todos', split: 'ABC (Push/Pull/Legs)',
  description: 'O mesmo PPL com mais volume: 2 séries de trabalho na maioria dos exercícios, rest-pause, drop set e parciais.',
  forWho: 'Avançado, 3 dias por semana',
  tips: SERIES_TIPS,
  routines: routines([
    { name: 'A · Costas e bíceps', days: [SEG], items: `
      remada-curvada | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      remada-baixa | 1x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      remada-baixa-aberta | 2x6-10 | 150 | aj 1x4-6 | pico2 | alt: ou máquina pegada aberta
      puxada-triangulo | 2x10-15 | 120 | aj 1-2x4-6 | pico2
      meio-terra | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      rosca-scott | 3x6-10 | 120 | aj 1-2x4-6 | pico2 | rp2 | alt: ou no cabo
      fx-knee-hip-raise-on-parallel-bars | 3xmax | 60 | pico2` },
    { name: 'B · Peito, ombros e tríceps', days: [QUA], items: `
      supino-inclinado-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
      supino-reto-halteres | 2x6-10 | 150 | aj 1x4-6 | alt: ou máquina
      fx-decline-barbell-bench-press | 2x6-10 | 150 | aj 1x4-6 | alt: ou máquina
      crucifixo-maquina | 2x10-15 | 60 | aj 1-2x4-6 | pico2 | drop
      fx-front-dumbbell-raise | 2x6-10 | 150 | aj 1x4-6
      fx-seated-side-lateral-raise | 2x8-12 | 60 | aj 1-2x4-6 | drop
      triceps-corda | 3x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      panturrilha-pe | 3x8-12 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2` },
    { name: 'C · Pernas', days: [SEX], items: `
      cadeira-extensora | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      hack | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | rp2
      leg-press | 2x6-10 | 150 | aj 1-2x4-6 | parc
      mesa-flexora | 1x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2 | rp2
      stiff-barra | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      elevacao-pelvica | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2` },
  ]),
}

const pplDef: Program = {
  id: 'ppl-abc-def-6x', name: 'PPL 6x (ABC · descanso · DEF)', level: 'avancado', daysPerWeek: 6, audience: 'todos', split: 'ABCDEF',
  description: 'Push/Pull/Legs duas vezes por semana com variações nos treinos D, E e F. A sequência sugerida é A, B, C, descanso, D, E, F, descanso, e o ciclo vai girando pelos dias da semana.',
  forWho: 'Avançado, 6 dias por semana',
  tips: [...SERIES_TIPS, 'A divisão gira: depois do F vem um descanso e recomeça no A, mesmo que caia em outro dia da semana.'],
  routines: routines([
    { name: 'A · Costas e bíceps', days: [SEG], items: `
      remada-curvada | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      remada-baixa | 1x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      remada-baixa-aberta | 2x6-10 | 150 | aj 1x4-6 | pico2 | alt: ou máquina pegada aberta
      puxada-triangulo | 2x6-10 | 120 | aj 1-2x4-6 | pico2 | drop
      meio-terra | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      rosca-scott | 2x6-10 | 120 | aj 1-2x4-6 | pico2 | rp2 | alt: ou no cabo
      fx-knee-hip-raise-on-parallel-bars | 3xmax | 60` },
    { name: 'B · Peito, ombros e tríceps', days: [TER], items: `
      supino-inclinado-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
      supino-reto-halteres | 2x6-10 | 150 | aj 1-2x4-6 | rp2 | alt: ou máquina
      fx-decline-barbell-bench-press | 2x6-10 | 150 | aj 1x4-6 | alt: ou máquina
      crucifixo-maquina | 2x10-15 | 60 | aj 1-2x4-6 | pico2 | drop
      fx-front-dumbbell-raise | 2x6-10 | 150 | aj 1x4-6
      fx-seated-side-lateral-raise | 2x8-12 | 60 | aj 1-2x4-6 | drop
      triceps-corda | 3x6-10 | 150 | aj 1-2x4-6 | rp2
      panturrilha-pe | 3x8-12 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2` },
    { name: 'C · Pernas', days: [QUA], items: `
      cadeira-extensora | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      hack | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | rp2
      leg-press | 2x6-10 | 150 | aj 1-2x4-6 | parc
      mesa-flexora | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2 | rp2
      stiff-barra | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      elevacao-pelvica | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2` },
    { name: 'D · Costas e bíceps', days: [SEX], items: `
      remada-curvada | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      remada-baixa-aberta | 2x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2 | alt: ou máquina pegada aberta
      puxada-frente | 2x8-12 | 120 | aj 1-2x4-6 | pico2
      puxada-triangulo | 2x6-10 | 120 | aj 1-2x4-6 | pico2 | drop
      fx-hyperextensions-back-extensions | 3x12-15 | 60
      rosca-scott | 3x6-10 | 120 | aj 1-2x4-6 | pico2 | rp2 | alt: ou no cabo
      fx-decline-crunch | 3xmax | 60` },
    { name: 'E · Peito, ombros e tríceps', days: [SAB], items: `
      supino-inclinado-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
      supino-reto-halteres | 2x6-10 | 150 | aj 1-2x4-6 | rp2 | alt: ou máquina
      crossover | 2x6-10 | 150 | aj 1x4-6 | pico2
      desenvolvimento-halteres | 2x6-10 | 150 | aj 1-2x4-6
      fx-front-dumbbell-raise | 2x6-10 | 60 | aj 1-2x4-6 | rp2
      fx-seated-side-lateral-raise | 2x8-12 | 60 | aj 1-2x4-6 | drop | alt: ou elevação lateral na máquina
      triceps-frances | 3x6-10 | 150 | aj 1-2x4-6 | rp2
      panturrilha-sentado | 3x8-12 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2` },
    { name: 'F · Posteriores, glúteos e quadríceps', days: [DOM], items: `
      mesa-flexora | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      cadeira-flexora | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2 | rp2
      stiff-barra | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      elevacao-pelvica | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2 | rp2
      abdutora | 2x6-10 | 150 | aj 1-2x4-6 | pico2
      cadeira-extensora | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2 | drop` },
  ]),
}

/* ------------------------------------------------------------------ ABCD */

function abcd(id: string, name: string, level: Program['level'], w: 1 | 2): Program {
  const s = (n: number) => `${w === 2 ? Math.max(2, n) : n}`
  return {
    id, name, level, daysPerWeek: 4, audience: 'todos', split: 'ABCD',
    description: w === 1
      ? 'Peito e bíceps, costas, ombros e tríceps, pernas. Aquecimento, ajuste e 1 série de trabalho até a falha, com rest-pause e drop set nos exercícios-chave.'
      : 'A mesma divisão ABCD com 2 séries de trabalho por exercício, para quem já tem bastante experiência.',
    forWho: w === 1 ? 'Intermediário, 4 dias por semana' : 'Avançado, 4 dias por semana',
    tips: SERIES_TIPS,
    routines: routines([
      { name: 'A · Peito e bíceps', days: [SEG], items: `
        supino-inclinado-halteres | ${s(1)}x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
        supino-reto-halteres | ${s(1)}x6-10 | 150 | aj 1-2x4-6 | rp2 | alt: ou máquina
        fx-decline-barbell-bench-press | ${s(1)}x6-10 | 150 | aj 1x4-6 | alt: ou máquina
        crucifixo-maquina | ${s(1)}x10-15 | 60 | aj 1-2x4-6 | pico2 | drop
        rosca-direta | ${s(1)}x6-10 | 120 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou na polia com barra
        rosca-scott | ${s(1)}x6-10 | 120 | aj 1-2x4-6 | rp2
        rosca-corda | ${s(1)}x6-10 | 90 | aj 1x4-6 | drop
        fx-decline-crunch | 3x15-20 | 60` },
      { name: 'B · Costas e panturrilha', days: [TER], items: `
        remada-curvada | ${s(1)}x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
        remada-baixa | ${s(1)}x6-10 | 150 | aj 1-2x4-6 | pico2${w === 1 ? ' | rp2' : ''}
        remada-baixa-aberta | ${s(1)}x6-10 | 150 | aj 1x4-6 | pico2 | alt: ou máquina pegada aberta
        puxada-triangulo | ${s(1)}x6-10 | 120 | aj 1-2x4-6 | pico2${w === 1 ? ' | drop' : ''}
        meio-terra | ${s(1)}x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
        panturrilha-pe | 3x6-10 | 120 | aq 1x10-15 | aj 1-2x4-6 | alt: ou em pé no Smith` },
      { name: 'C · Ombros e tríceps', days: [QUI], items: `
        desenvolvimento-halteres | ${s(1)}x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
        fx-front-dumbbell-raise | ${s(1)}x6-10 | 120 | aj 1-2x4-6 | rp2 | alt: ou na polia com corda
        elevacao-lateral | ${s(1)}x6-10 | 120 | aj 1x4-6
        elevacao-lateral-polia | ${s(1)}x10-15 | 60 | aj 1-2x4-6 | drop
        fx-cable-lying-triceps-extension | ${s(1)}x6-10 | 120 | aq 1-2x10-15 | aj 1-2x4-6 | obs: com corda
        triceps-corda | ${s(1)}x6-10 | 120 | aj 1-2x4-6 | rp2
        triceps-frances | ${s(1)}x6-10 | 120 | aj 1x4-6 | drop
        fx-knee-hip-raise-on-parallel-bars | 3x15-20 | 60` },
      { name: 'D · Pernas', days: [SEX], items: `
        panturrilha-sentado | 3x6-10 | 120 | aq 1x10-15 | aj 1-2x4-6
        agachamento-livre | ${s(1)}x6-10 | 180 | aq 1-2x10-15 | aj 1-2x4-6
        leg-press | ${s(1)}x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | rp2
        cadeira-extensora | ${s(1)}x6-10 | 120 | aj 1-2x4-6 | drop
        mesa-flexora | ${s(1)}x6-10 | 120 | aq 1x10-15 | aj 1-2x4-6 | pico2 | rp2
        stiff-barra | ${s(1)}x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
        elevacao-pelvica | ${w === 2 ? 3 : 1}x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2` },
    ]),
  }
}

/* ------------------------------------------------------------------ ABCDE */

const abcdeInferiores: Program = {
  id: 'abcde-inferiores', name: 'ABCDE 5x · ênfase em inferiores', level: 'avancado', daysPerWeek: 5, audience: 'todos', split: 'ABCDE',
  description: 'Cinco treinos com pernas e glúteos em dois dias inteiros (quadríceps no A, posteriores e glúteos no D) e superiores distribuídos no B, C e E.',
  forWho: 'Avançado que quer priorizar pernas e glúteos',
  tips: SERIES_TIPS,
  routines: routines([
    { name: 'A · Quadríceps, posteriores e glúteos', days: [SEG], note: MOB_INF, items: `
      agachamento-livre | 2x6-10 | 180 | aq 1-2x10-15 | aj 1-2x4-6
      hack | 2x6-10 | 150 | aj 1-2x4-6 | rp2
      leg-press | 2x10-15 | 150 | aj 1-2x4-6 | parc
      cadeira-extensora | 2x6-10 | 120 | aj 1-2x4-6 | pico2 | drop2
      mesa-flexora | 2x6-10 | 150 | aj 1-2x4-6 | pico2
      abdutora | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2` },
    { name: 'B · Peito, ombros e tríceps', days: [TER], note: 'Antes: mobilidade de ombros.', items: `
      supino-inclinado-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
      supino-reto-halteres | 2x6-10 | 150 | aj 1-2x4-6 | rp2 | alt: ou máquina
      fx-decline-barbell-bench-press | 2x6-10 | 120 | aj 1x4-6 | alt: ou máquina
      crucifixo-maquina | 2x10-15 | 60 | aj 1-2x4-6 | pico2 | drop
      fx-front-dumbbell-raise | 2x6-10 | 120 | aj 1x4-6
      fx-seated-side-lateral-raise | 2x8-12 | 60 | aj 1-2x4-6 | drop
      triceps-corda | 3x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2` },
    { name: 'C · Costas, bíceps e panturrilhas', days: [QUA], note: MOB_SUP, items: `
      remada-curvada | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      remada-baixa | 2x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      remada-baixa-aberta | 2x6-10 | 150 | aj 1x4-6 | pico2 | alt: ou máquina pegada aberta
      puxada-triangulo | 2x8-12 | 120 | aj 1-2x4-6 | pico2 | drop
      meio-terra | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      fx-hyperextensions-back-extensions | 3x10-15 | 90
      rosca-scott | 3x6-10 | 120 | aj 1x4-6 | pico2
      panturrilha-pe | 3x8-12 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou no Smith` },
    { name: 'D · Posteriores, glúteos e quadríceps', days: [SEX], note: MOB_INF, items: `
      mesa-flexora | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      cadeira-flexora | 2x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      stiff-barra | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      elevacao-pelvica | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2 | rp2
      abdutora | 2x6-10 | 150 | aj 1-2x4-6 | pico2
      cadeira-extensora | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2 | drop` },
    { name: 'E · Superiores e panturrilhas', days: [SAB], items: `
      supino-inclinado-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
      supino-reto-halteres | 2x6-10 | 150 | aj 1-2x4-6 | rp2 | alt: ou máquina
      remada-baixa-aberta | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      puxada-triangulo | 2x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      desenvolvimento-halteres | 2x6-10 | 150 | aj 1-2x4-6 | rp2 | alt: ou máquina
      rosca-scott | 2x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2 | alt: ou no cabo
      fx-cable-rope-overhead-triceps-extension | 2x6-10 | 120 | aj 1-2x4-6 | drop
      panturrilha-pe | 3x8-12 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou no Smith` },
  ]),
}

const abcdeSuperiores: Program = {
  id: 'abcde-superiores', name: 'ABCDE 5x · ênfase em superiores', level: 'avancado', daysPerWeek: 5, audience: 'todos', split: 'ABCDE',
  description: 'Cinco treinos com prioridade para tronco e braços: peito e ombros aparecem duas vezes, costas e bíceps também. Pernas num dia completo.',
  forWho: 'Avançado que quer priorizar tronco e braços',
  tips: SERIES_TIPS,
  routines: routines([
    { name: 'A · Peito, ombros e tríceps', days: [SEG], note: 'Antes: mobilidade de ombros.', items: `
      supino-inclinado-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
      supino-reto-halteres | 2x6-10 | 150 | aj 1-2x4-6 | rp2 | alt: ou máquina
      fx-decline-barbell-bench-press | 2x6-10 | 120 | aj 1x4-6 | alt: ou máquina
      crucifixo-maquina | 2x10-15 | 60 | aj 1-2x4-6 | pico2 | drop
      fx-front-dumbbell-raise | 2x6-10 | 120 | aj 1x4-6
      fx-seated-side-lateral-raise | 2x8-12 | 60 | aj 1-2x4-6 | drop
      fx-cable-rope-overhead-triceps-extension | 3x6-10 | 120 | aj 1x4-6` },
    { name: 'B · Costas e bíceps', days: [TER], note: MOB_SUP, items: `
      remada-curvada | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      remada-baixa | 2x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      remada-baixa-aberta | 2x6-10 | 120 | aj 1x4-6 | pico2 | alt: ou máquina pegada aberta
      puxada-triangulo | 2x8-12 | 120 | aj 1-2x4-6 | pico2 | drop
      meio-terra | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      fx-hyperextensions-back-extensions | 3x10-15 | 90
      rosca-scott | 3x6-10 | 120 | aj 1x4-6 | pico2` },
    { name: 'C · Membros inferiores', days: [QUA], note: MOB_INF, items: `
      agachamento-livre | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6
      leg-press | 2x8-12 | 150 | aj 1x4-6 | rp2
      cadeira-extensora | 2x10-15 | 60 | aj 1-2x4-6 | pico2
      mesa-flexora | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2
      stiff-barra | 2x8-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      elevacao-pelvica | 2x6-10 | 150 | aj 1-2x4-6 | pico2 | drop
      panturrilha-pe | 3x10-15 | 120 | aq 1-2x10-15 | aj 1-2x4-6 | pico2 | alt: ou no Smith` },
    { name: 'D · Ombros, peito e tríceps', days: [SEX], note: 'Antes: mobilidade e alongamento de ombros e tríceps.', items: `
      desenvolvimento-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6
      fx-front-dumbbell-raise | 2x10-15 | 60 | aj 1-2x4-6 | rp2
      fx-seated-side-lateral-raise | 2x8-12 | 60 | aj 1-2x4-6
      elevacao-lateral-polia | 2x8-12 | 60 | aj 1x4-6 | drop | alt: ou na máquina
      crucifixo-maquina | 3x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      triceps-corda | 3x6-10 | 120 | aj 1-2x4-6 | pico2
      fx-cable-incline-triceps-extension | 3x8-12 | 120 | aj 1-2x4-6 | rp2 | obs: Tríceps testa com corda, banco a 35°` },
    { name: 'E · Bíceps, costas e abdômen', days: [SAB], note: MOB_SUP, items: `
      rosca-polia | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      rosca-scott | 2x8-12 | 120 | aj 1-2x4-6 | pico2 | rp2 | alt: ou no cabo
      rosca-corda | 2x10-15 | 60 | aj 1-2x4-6 | drop
      puxada-frente | 3x8-12 | 120 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      puxada-triangulo | 3x8-12 | 120 | aj 1-2x4-6 | pico2 | drop
      remada-unilateral | 2x6-10 | 120 | aj 1-2x4-6 | pico2
      fx-knee-hip-raise-on-parallel-bars | 3xmax | 60 | pico2
      fx-decline-crunch | 3xmax | 60` },
  ]),
}

/* ------------------------------------------------------------------ 6x / FÍSICO */

const abcdef6x: Program = {
  id: 'abcdef-6x', name: 'ABCDEF 6x', level: 'avancado', daysPerWeek: 6, audience: 'todos', split: 'ABCDEF',
  description: 'Seis treinos: posteriores e glúteos, peito/ombros/tríceps, costas e abdômen, quadríceps, ombros com peito e panturrilha, e um dia de braços. A sequência sugerida é A, B, C, descanso, D, E, F, descanso.',
  forWho: 'Avançado, 6 dias por semana',
  tips: [...SERIES_TIPS, 'A divisão gira: depois do F vem um descanso e recomeça no A.'],
  routines: routines([
    { name: 'A · Posteriores, glúteos e quadríceps', days: [SEG], note: MOB_INF, items: `
      mesa-flexora | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      cadeira-flexora | 2x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      stiff-barra | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      elevacao-pelvica | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2 | rp2
      abdutora | 2x6-10 | 150 | aj 1-2x4-6 | pico2
      cadeira-extensora | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2 | drop` },
    { name: 'B · Peito, ombros e tríceps', days: [TER], note: 'Antes: mobilidade de ombros.', items: `
      supino-inclinado-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
      supino-reto-halteres | 2x6-10 | 150 | aj 1-2x4-6 | rp2 | alt: ou máquina
      fx-decline-barbell-bench-press | 2x6-10 | 120 | aj 1x4-6 | alt: ou máquina
      crucifixo-maquina | 2x10-15 | 60 | aj 1-2x4-6 | pico2 | drop
      fx-front-dumbbell-raise | 2x6-10 | 120 | aj 1x4-6
      fx-seated-side-lateral-raise | 2x8-12 | 60 | aj 1-2x4-6 | drop
      triceps-corda | 3x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      panturrilha-pe | 3x8-12 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou no Smith` },
    { name: 'C · Costas e abdômen', days: [QUA], note: MOB_SUP, items: `
      remada-curvada | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      remada-baixa | 2x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      remada-baixa-aberta | 2x6-10 | 150 | aj 1x4-6 | alt: ou máquina pegada aberta
      puxada-frente | 2x6-10 | 120 | aj 1-2x4-6 | pico2 | drop
      meio-terra | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6
      fx-hyperextensions-back-extensions | 3x10-15 | 90
      fx-knee-hip-raise-on-parallel-bars | 3xmax | 60 | pico2` },
    { name: 'D · Quadríceps, posteriores e glúteos', days: [SEX], note: MOB_INF, items: `
      agachamento-livre | 2x6-10 | 180 | aq 1-2x10-15 | aj 1-2x4-6
      hack | 2x6-10 | 150 | aj 1-2x4-6 | rp2
      leg-press | 2x10-15 | 150 | aj 1-2x4-6 | parc
      cadeira-extensora | 2x6-10 | 120 | aj 1-2x4-6 | pico2 | drop2
      mesa-flexora | 2x6-10 | 150 | aj 1-2x4-6 | pico2
      abdutora | 2x6-10 | 150 | aq 1x10-15 | aj 1-2x4-6 | pico2` },
    { name: 'E · Ombros, peito e panturrilhas', days: [SAB], note: 'Antes: mobilidade e alongamento de ombros e tríceps.', items: `
      desenvolvimento-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6
      fx-front-dumbbell-raise | 2x10-15 | 120 | aj 1-2x4-6 | rp2
      fx-seated-side-lateral-raise | 2x8-12 | 60 | aj 1-2x4-6
      elevacao-lateral-polia | 2x8-12 | 60 | aj 1x4-6 | drop | alt: ou na máquina
      supino-inclinado-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
      crucifixo-maquina | 2x6-10 | 150 | aj 1-2x4-6 | pico2 | rp2
      panturrilha-sentado | 3x8-12 | 150 | aq 1-2x10-15 | aj 1-2x4-6` },
    { name: 'F · Bíceps, tríceps, costas e abdômen', days: [DOM], items: `
      rosca-polia | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      rosca-scott | 2x6-10 | 120 | aj 1-2x4-6 | pico2 | rp2 | alt: ou no cabo
      rosca-corda | 2x6-10 | 120 | aj 1-2x4-6 | pico2 | drop
      triceps-corda | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      fx-cable-incline-triceps-extension | 2x6-10 | 120 | aj 1-2x4-6 | rp2 | obs: Tríceps testa com corda, banco a 35°
      fx-cable-rope-overhead-triceps-extension | 2x6-10 | 120 | aj 1-2x4-6 | drop
      puxada-triangulo | 3x6-10 | 120 | aj 1-2x4-6 | pico2 | drop
      fx-decline-crunch | 3xmax | 60` },
  ]),
}

const classicPhysique: Program = {
  id: 'classic-physique-6x', name: 'Classic Physique 6x · nível Olympia', level: 'avancado', daysPerWeek: 6, audience: 'masculino', split: 'ABCDEF',
  description: 'Divisão no estilo dos atletas de Classic Physique do Olympia: costas, peito e ombros, pernas, repetidos com variações. Sequência A, B, C, descanso, D, E, F, descanso.',
  forWho: 'Avançado com bastante experiência, 6 dias',
  tips: [...SERIES_TIPS, 'A divisão gira: depois do F vem um descanso e recomeça no A.'],
  routines: routines([
    { name: 'A · Costas', days: [SEG], note: 'Antes: mobilidade e alongamento de peito, posteriores de coxa, glúteos, quadríceps e iliopsoas.', items: `
      remada-curvada | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | pico2
      remada-baixa | 2x6-10 | 150 | aj 1-2x4-6 | pico2
      remada-unilateral | 2x6-10 | 150 | aj 1-2x4-6
      puxada-triangulo | 2x6-10 | 150 | aj 1-2x4-6
      fx-hyperextensions-back-extensions | 2x6-10 | 120 | aj 1-2x4-6
      rosca-scott | 2x6-10 | 120 | aj 1-2x4-6 | rp2 | alt: ou no cabo` },
    { name: 'B · Peito e ombros', days: [TER], note: 'Antes: mobilidade e alongamento de peito e ombros.', items: `
      supino-inclinado-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
      supino-reto-halteres | 2x6-10 | 150 | aj 1-2x4-6 | rp2 | alt: ou máquina
      fx-decline-barbell-bench-press | 2x6-10 | 150 | aj 1-2x4-6 | alt: ou máquina ou crossover
      crucifixo-maquina | 2x6-10 | 120 | aj 1-2x4-6 | drop2
      fx-front-cable-raise | 2x6-10 | 120 | aj 1-2x4-6 | obs: com corda
      fx-seated-side-lateral-raise | 2x6-10 | 120 | aj 1-2x4-6 | rp2
      triceps-corda | 2x6-10 | 120 | aj 1-2x4-6` },
    { name: 'C · Pernas', days: [QUA], note: MOB_INF, items: `
      panturrilha-sentado | 2x6-10 | 120 | aq 1-2x10-15 | aj 1-2x4-6
      cadeira-extensora | 2x6-10 | 120 | aq 1-2x10-15 | aj 1-2x4-6
      hack | 2x8-12 | 150 | aj 1-2x4-6 | rp2
      leg-press | 2x10-15 | 150 | aj 1-2x4-6 | parc
      cadeira-flexora | 2x6-10 | 120 | aj 1-2x4-6
      fx-thigh-adductor | 2x6-10 | 60 | aj 1-2x4-6` },
    { name: 'D · Costas', days: [SEX], note: 'Antes: mobilidade e alongamento de peito, posteriores de coxa, glúteos, quadríceps e iliopsoas.', items: `
      fx-rope-straight-arm-pulldown | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6
      puxada-frente | 2x6-10 | 150 | aj 1-2x4-6
      remada-baixa-aberta | 2x6-10 | 150 | aj 1-2x4-6
      remada-unilateral | 2x6-10 | 150 | aj 1-2x4-6
      fx-hyperextensions-back-extensions | 2x6-10 | 120 | aj 1-2x4-6
      rosca-polia | 2x6-10 | 120 | aj 1-2x4-6 | rp2` },
    { name: 'E · Peito e ombros', days: [SAB], note: 'Antes: mobilidade e alongamento de peito e ombros.', items: `
      supino-inclinado-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | alt: ou máquina
      supino-reto-halteres | 2x6-10 | 150 | aj 1-2x4-6 | alt: ou máquina
      crucifixo-maquina | 2x6-10 | 120 | aj 1-2x4-6
      fx-front-cable-raise | 2x6-10 | 120 | aj 1-2x4-6 | obs: com corda
      fx-seated-side-lateral-raise | 2x6-10 | 120 | aj 1-2x4-6 | rp2
      elevacao-lateral-polia | 2x6-10 | 150 | aj 1-2x4-6
      paralelas | 3xmax | 120 | obs: Só com o peso do corpo` },
    { name: 'F · Pernas', days: [DOM], note: MOB_INF, items: `
      panturrilha-pe | 2x6-10 | 120 | aq 1-2x10-15 | aj 1-2x4-6
      mesa-flexora | 2x6-10 | 120 | aq 1-2x10-15 | aj 1-2x4-6
      stiff-barra | 2x10-15 | 150 | aj 1-2x4-6
      abdutora | 2x6-10 | 120 | aj 1-2x4-6
      elevacao-pelvica | 2x8-12 | 150 | aj 1-2x4-6 | rp2
      cadeira-extensora | 2x6-10 | 60 | aj 1-2x4-6` },
  ]),
}

const mensPhysique: Program = {
  id: 'mens-physique-5x', name: "Men's Physique 5x · nível Olympia", level: 'avancado', daysPerWeek: 5, audience: 'masculino', split: 'ABCDE',
  description: "Divisão no estilo dos atletas de Men's Physique do Olympia: costas larga em dois dias, peito e ombros, pernas e um dia de ombros com tríceps. Ajustes em duas etapas (4–6 e depois 2–4 repetições) antes das séries de trabalho.",
  forWho: 'Avançado com foco em V-taper, 5 dias',
  tips: [...SERIES_TIPS, 'Ajuste em duas etapas: primeiro 4–6 repetições e depois 2–4 repetições com a carga já perto da de trabalho.'],
  routines: routines([
    { name: 'A · Costas', days: [SEG], note: 'Antes: mobilidade e alongamento de peito e ombros.', items: `
      remada-curvada | 2x6-10 | 180 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      remada-baixa | 2x6-10 | 150 | aj 1x4-6+1x2-4
      remada-unilateral | 2x6-10 | 150 | aj 1x4-6
      remada-baixa-aberta | 2x8-12 | 120 | aj 1x4-6
      puxada-frente | 2x8-12 | 120 | aj 1x4-6 | pico2
      fx-hyperextensions-back-extensions | 3x10-15 | 60
      panturrilha-pe | 2x6-10 | 180 | aq 1-2x10-15 | aj 1-2x4-6` },
    { name: 'B · Peito, ombros e abdômen', days: [TER], note: 'Antes: mobilidade e alongamento de ombros e peito.', items: `
      supino-inclinado-halteres | 2x6-10 | 180 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4 | alt: ou máquina
      supino-reto-halteres | 2x6-10 | 150 | aj 1-2x4-6 | alt: ou máquina
      supino-maquina | 2x6-10 | 150 | aj 1-2x6-10 | alt: ou halteres · use o equipamento que não usou no supino anterior
      crucifixo-maquina | 1x8-12 | 120 | aj 1x4-6 | drop
      fx-seated-side-lateral-raise | 1x8-12 | 120 | aj 1x4-6 | drop
      fx-decline-crunch | 3x15-20 | 60` },
    { name: 'C · Pernas', days: [QUA], note: MOB_INF, items: `
      cadeira-extensora | 2x6-10 | 180 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      hack | 2x6-10 | 150 | aq 1-2x10-15 | aj 1-2x4-6 | rp2
      leg-press | 2x6-10 | 120 | aj 1-2x4-6
      cadeira-flexora | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1x2-4
      abdutora | 2x6-10 | 120 | aj 1-2x4-6
      fx-thigh-adductor | 2x8-12 | 120 | aj 1-2x4-6` },
    { name: 'D · Costas e panturrilhas', days: [SEX], note: 'Antes: mobilidade e alongamento de peito e ombros.', items: `
      puxada-frente | 2x6-10 | 180 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      puxada-triangulo | 2x6-10 | 150 | aj 1x4-6+1x2-4
      remada-unilateral | 2x6-10 | 120 | aj 1x4-6
      remada-baixa-aberta | 2x8-12 | 120 | aj 1x4-6
      crucifixo-inverso | 2x8-12 | 120 | aj 1x4-6 | pico2
      panturrilha-sentado | 2x6-10 | 180 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4` },
    { name: 'E · Ombros, tríceps, peito e abdômen', days: [SAB], items: `
      desenvolvimento-halteres | 2x6-10 | 180 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4 | alt: ou máquina
      fx-front-dumbbell-raise | 2x8-12 | 150 | aj 1-2x4-6 | rp2
      fx-seated-side-lateral-raise | 2x8-12 | 120 | aj 1-2x4-6
      fx-cable-rope-overhead-triceps-extension | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      crucifixo-maquina | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1x2-4
      fx-knee-hip-raise-on-parallel-bars | 3x15-20 | 60` },
  ]),
}

const upperLower4x: Program = {
  id: 'upper-lower-4x', name: 'Superior/Inferior 4x', level: 'avancado', daysPerWeek: 4, audience: 'todos', split: 'Upper/Lower',
  description: 'Divisão avançada para quem treina 4 vezes por semana e domina as execuções: cada grupo muscular recebe estímulo 2x por semana. O resultado depende de controlar as cargas e evoluir repetições ou carga toda semana.',
  forWho: 'Avançado, 4 dias por semana',
  tips: SERIES_TIPS,
  routines: routines([
    { name: 'Superior 1', days: [SEG], note: MOB_SUP, items: `
      supino-inclinado-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4 | alt: ou máquina/Smith
      crucifixo-maquina | 2x6-10 | 150 | aj 1x4-6+1-2x2-4
      puxada-frente | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      remada-baixa | 2x6-10 | 150 | aj 1x4-6+1x2-4
      fx-seated-side-lateral-raise | 2x6-10 | 150 | aj 1x4-6+1x2-4
      fx-incline-dumbbell-curl | 2x6-10 | 150 | aj 1x4-6+1x2-4 | obs: banco a 45°
      fx-cable-rope-overhead-triceps-extension | 2x6-10 | 150 | aj 1x4-6+1x2-4` },
    { name: 'Inferior 1', days: [TER], note: MOB_INF, items: `
      mesa-flexora | 2x6-10 | 180 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      hack | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      leg-press | 2x6-10 | 150 | aj 1x4-6+1-2x2-4
      cadeira-extensora | 2x6-10 | 150 | aj 1x4-6+1-2x2-4
      stiff-barra | 2x6-10 | 150 | aj 1x4-6+1-2x2-4` },
    { name: 'Superior 2', days: [QUI], note: MOB_SUP, items: `
      supino-reto-halteres | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4 | alt: ou máquina/Smith
      crossover | 2x6-10 | 150 | aj 1x4-6+1-2x2-4
      remada-curvada | 2x6-10 | 180 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      puxada-triangulo | 2x6-10 | 150 | aj 1x4-6+1x2-4
      desenvolvimento-halteres | 2x6-10 | 150 | aj 1x4-6+1-2x2-4 | alt: ou máquina
      rosca-scott | 2x6-10 | 150 | aj 1x4-6+1x2-4 | alt: ou no cabo
      triceps-corda | 2x6-10 | 150 | aj 1x4-6+1x2-4` },
    { name: 'Inferior 2', days: [SEX], note: MOB_INF, items: `
      cadeira-flexora | 2x6-10 | 150 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      mesa-flexora | 2x6-10 | 150 | aj 1x4-6+1-2x2-4
      elevacao-pelvica | 2x6-10 | 180 | aq 1-2x10-15 | aj 1x4-6+1-2x2-4
      hack | 2x6-10 | 150 | aj 1x4-6+1-2x2-4
      leg-press | 2x6-10 | 150 | aj 1x4-6+1-2x2-4` },
  ]),
}

export const seedPrograms: Program[] = [
  adaptacao, iniciantes2x, iniciantes4x,
  mulheres2x, mulheres4x, mulheresAvancadas3x, upperLowerFeminino,
  pplIntermediario, abcd('abcd-intermediario', 'ABCD 4x · Intermediário', 'intermediario', 1),
  pplAvancado, abcd('abcd-avancado', 'ABCD 4x · Avançado', 'avancado', 2), upperLower4x,
  abcdeInferiores, abcdeSuperiores, mensPhysique,
  pplDef, abcdef6x, classicPhysique,
]
