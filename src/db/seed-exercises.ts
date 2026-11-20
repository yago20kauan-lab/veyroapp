import type { Equipment, Exercise, ExerciseKind, Muscle } from './schema'

type Row = [
  id: string,
  name: string,
  primary: Muscle,
  secondary: Muscle[],
  equipment: Equipment,
  pattern: string,
  compound: boolean,
  opts?: { uni?: boolean; kind?: ExerciseKind; step?: number; inc?: number; rest?: number; cues?: string[]; mistakes?: string[]; aka?: string; img?: string },
]

// Padrões de movimento (usados no ⇄ Trocar): empurrar-h, empurrar-inc, empurrar-v, puxar-v, puxar-h, agachar, dobrar-quadril,
// extensao-joelho, flexao-joelho, lunge, panturrilha, elev-lateral, crucifixo, crucifixo-inv, biceps, triceps, core, cardio
const rows: Row[] = [
  // PEITO
  ['supino-reto-barra', 'Supino reto com barra', 'peito', ['triceps', 'ombros'], 'barbell', 'empurrar-h', true, {
    cues: ['Escápulas juntas e para baixo', 'Pés firmes no chão', 'Barra desce na linha do mamilo', 'Cotovelos a ~45° do tronco'],
    mistakes: ['Quicar a barra no peito', 'Tirar o quadril do banco'] }],
  ['supino-reto-halteres', 'Supino reto com halteres', 'peito', ['triceps', 'ombros'], 'dumbbell', 'empurrar-h', true, {
    cues: ['Halteres alinhados ao peito', 'Desça até alongar o peitoral', 'Suba juntando levemente os halteres'], mistakes: ['Descer pouco', 'Abrir demais os cotovelos'] }],
  ['supino-inclinado-halteres', 'Supino inclinado com halteres', 'peito', ['ombros', 'triceps'], 'dumbbell', 'empurrar-inc', true, {
    cues: ['Banco a 30°', 'Escápulas encaixadas', 'Halteres descem na parte alta do peito'], mistakes: ['Banco inclinado demais (vira ombro)'] }],
  ['supino-inclinado-barra', 'Supino inclinado com barra', 'peito', ['ombros', 'triceps'], 'barbell', 'empurrar-inc', true],
  ['supino-maquina', 'Supino na máquina', 'peito', ['triceps', 'ombros'], 'machine', 'empurrar-h', true],
  ['crucifixo-halteres', 'Crucifixo com halteres', 'peito', [], 'dumbbell', 'crucifixo', false, { cues: ['Cotovelos levemente flexionados', 'Abra até sentir alongar', 'Feche como um abraço'] }],
  ['crucifixo-maquina', 'Voador (peck deck)', 'peito', [], 'machine', 'crucifixo', false, { aka: 'crucifixo na máquina' }],
  ['crossover', 'Crossover na polia', 'peito', [], 'cable', 'crucifixo', false, { aka: 'cross over' }],
  ['flexao', 'Flexão de braço', 'peito', ['triceps', 'ombros'], 'bodyweight', 'empurrar-h', true, { kind: 'bodyweight_plus', step: 1, inc: 0 }],
  ['paralelas', 'Paralelas (mergulho)', 'peito', ['triceps', 'ombros'], 'bodyweight', 'empurrar-h', true, { kind: 'bodyweight_plus', step: 1, inc: 2.5 }],
  // COSTAS
  ['puxada-triangulo', 'Puxada frente com triângulo', 'costas', ['biceps'], 'cable', 'puxar-v', true, { aka: 'pulley frente triângulo, puxada triângulo' }],
  ['puxada-frente', 'Puxada frente', 'costas', ['biceps'], 'cable', 'puxar-v', true, { aka: 'pulley frente aberto, puxada aberta, pulldown',
    cues: ['Peito para cima', 'Puxe com os cotovelos em direção ao quadril', 'Barra até o queixo/peito alto'], mistakes: ['Jogar o tronco para trás', 'Puxar atrás da nuca'] }],
  ['barra-fixa', 'Barra fixa', 'costas', ['biceps'], 'bodyweight', 'puxar-v', true, { kind: 'bodyweight_plus', step: 1, inc: 2.5 }],
  ['remada-baixa-aberta', 'Remada baixa pegada aberta', 'costas', ['biceps', 'ombros'], 'cable', 'puxar-h', true, { img: 'remada-baixa', aka: 'remada sentada aberta' }],
  ['meio-terra', 'Meio terra', 'costas', ['posterior', 'gluteos', 'trapezio'], 'barbell', 'dobrar-quadril', true, { inc: 5, rest: 180, aka: 'rack pull, terra parcial' }],
  ['remada-baixa', 'Remada baixa', 'costas', ['biceps'], 'cable', 'puxar-h', true, { aka: 'remada baixa triângulo, remada sentada', cues: ['Coluna neutra', 'Puxe até a barriga', 'Junte as escápulas no final'] }],
  ['remada-curvada', 'Remada curvada com barra', 'costas', ['biceps', 'posterior'], 'barbell', 'puxar-h', true, {
    cues: ['Tronco a ~45°', 'Coluna neutra', 'Barra em direção ao umbigo'], mistakes: ['Arredondar a lombar', 'Usar impulso'] }],
  ['remada-unilateral', 'Serrote (remada unilateral com halter)', 'costas', ['biceps'], 'dumbbell', 'puxar-h', true, { uni: true, cues: ['Apoie joelho e mão no banco', 'Puxe o halter até o quadril'] }],
  ['remada-maquina', 'Remada na máquina', 'costas', ['biceps'], 'machine', 'puxar-h', true],
  ['pulldown-braco-reto', 'Pulldown braço reto', 'costas', [], 'cable', 'puxar-v', false],
  ['face-pull', 'Face pull', 'ombros', ['trapezio'], 'cable', 'crucifixo-inv', false, { cues: ['Corda na altura do rosto', 'Abra as mãos ao puxar', 'Cotovelos altos'] }],
  ['encolhimento', 'Encolhimento com halteres', 'trapezio', [], 'dumbbell', 'encolhimento', false],
  // OMBROS
  ['desenvolvimento-halteres', 'Desenvolvimento com halteres', 'ombros', ['triceps'], 'dumbbell', 'empurrar-v', true, { cues: ['Sentado, costas apoiadas', 'Halteres na altura das orelhas', 'Suba sem bater os halteres'] }],
  ['desenvolvimento-barra', 'Desenvolvimento com barra', 'ombros', ['triceps'], 'barbell', 'empurrar-v', true],
  ['desenvolvimento-maquina', 'Desenvolvimento na máquina', 'ombros', ['triceps'], 'machine', 'empurrar-v', true],
  ['elevacao-lateral', 'Elevação lateral', 'ombros', [], 'dumbbell', 'elev-lateral', false, { step: 1, inc: 1, cues: ['Leve inclinação à frente', 'Suba até a linha do ombro', 'Cotovelo guia o movimento'], mistakes: ['Balançar o corpo'] }],
  ['elevacao-lateral-polia', 'Elevação lateral na polia', 'ombros', [], 'cable', 'elev-lateral', false, { uni: true }],
  ['crucifixo-inverso', 'Voador inverso (crucifixo inverso)', 'ombros', ['costas'], 'machine', 'crucifixo-inv', false],
  // BRAÇOS
  ['rosca-direta', 'Rosca direta com barra', 'biceps', ['antebraco'], 'barbell', 'biceps', false, { step: 1, inc: 1, cues: ['Cotovelos colados ao tronco', 'Sem balançar', 'Desça controlando'] }],
  ['rosca-alternada', 'Rosca alternada com halteres', 'biceps', ['antebraco'], 'dumbbell', 'biceps', false, { uni: true }],
  ['rosca-martelo', 'Rosca martelo', 'biceps', ['antebraco'], 'dumbbell', 'biceps', false],
  ['rosca-scott', 'Rosca Scott', 'biceps', [], 'machine', 'biceps', false],
  ['rosca-polia', 'Rosca direta na polia', 'biceps', [], 'cable', 'biceps', false, { aka: 'rosca no cabo' }],
  ['rosca-corda', 'Rosca direta na corda', 'biceps', ['antebraco'], 'cable', 'biceps', false, { img: 'fx-cable-hammer-curls-rope-attachment' }],
  ['triceps-corda', 'Tríceps corda', 'triceps', [], 'cable', 'triceps', false, { cues: ['Cotovelos fixos', 'Abra a corda no final', 'Volte até 90°'] }],
  ['triceps-barra-polia', 'Tríceps na polia com barra', 'triceps', [], 'cable', 'triceps', false],
  ['triceps-frances', 'Tríceps francês', 'triceps', [], 'dumbbell', 'triceps', false],
  ['triceps-testa', 'Tríceps testa', 'triceps', [], 'barbell', 'triceps', false],
  // PERNAS
  ['agachamento-livre', 'Agachamento livre', 'quadriceps', ['gluteos', 'posterior'], 'barbell', 'agachar', true, {
    inc: 5, rest: 180, cues: ['Pés na largura dos ombros', 'Joelhos na direção dos pés', 'Desça até a coxa paralela ou abaixo', 'Peito aberto'], mistakes: ['Joelhos para dentro', 'Tirar o calcanhar do chão'] }],
  ['hack', 'Agachamento hack', 'quadriceps', ['gluteos'], 'machine', 'agachar', true, { inc: 5, aka: 'hack machine' }],
  ['leg-press', 'Leg press 45°', 'quadriceps', ['gluteos'], 'machine', 'agachar', true, { inc: 10, aka: 'leg 45', cues: ['Lombar sempre apoiada', 'Desça até ~90° no joelho', 'Não trave o joelho em cima'] }],
  ['agachamento-bulgaro', 'Agachamento búlgaro', 'quadriceps', ['gluteos'], 'dumbbell', 'lunge', true, { uni: true }],
  ['afundo', 'Afundo com halteres', 'quadriceps', ['gluteos'], 'dumbbell', 'lunge', true, { uni: true }],
  ['cadeira-extensora', 'Cadeira extensora', 'quadriceps', [], 'machine', 'extensao-joelho', false, { inc: 5, aka: 'extensor, extensora' }],
  ['stiff-halteres', 'Stiff com halteres', 'posterior', ['gluteos'], 'dumbbell', 'dobrar-quadril', true, { cues: ['Joelhos levemente dobrados', 'Quadril vai para trás', 'Halteres rentes à perna'] }],
  ['stiff-barra', 'Stiff com barra', 'posterior', ['gluteos'], 'barbell', 'dobrar-quadril', true, { inc: 5 }],
  ['terra-romeno', 'Levantamento terra romeno', 'posterior', ['gluteos', 'costas'], 'barbell', 'dobrar-quadril', true, {
    inc: 5, rest: 180, cues: ['Coluna neutra o tempo todo', 'Empurre o quadril para trás', 'Barra desliza pela coxa'], mistakes: ['Arredondar as costas'] }],
  ['terra', 'Levantamento terra', 'posterior', ['gluteos', 'costas', 'trapezio'], 'barbell', 'dobrar-quadril', true, { inc: 5, rest: 180 }],
  ['mesa-flexora', 'Mesa flexora', 'posterior', [], 'machine', 'flexao-joelho', false, { aka: 'flexor deitado' }],
  ['cadeira-flexora', 'Cadeira flexora', 'posterior', [], 'machine', 'flexao-joelho', false, { aka: 'flexor sentado' }],
  ['elevacao-pelvica', 'Elevação pélvica', 'gluteos', ['posterior'], 'barbell', 'dobrar-quadril', true, { inc: 5, aka: 'elevação de quadril, hip thrust' }],
  ['abdutora', 'Cadeira abdutora', 'gluteos', [], 'machine', 'abducao', false, { aka: 'abdutor' }],
  ['panturrilha-pe', 'Panturrilha em pé', 'panturrilha', [], 'machine', 'panturrilha', false, { inc: 5, rest: 60 }],
  ['panturrilha-sentado', 'Panturrilha sentado', 'panturrilha', [], 'machine', 'panturrilha', false, { inc: 5, rest: 60 }],
  // CORE
  ['prancha', 'Prancha', 'abdomen', [], 'bodyweight', 'core', false, { kind: 'time', step: 5, inc: 0, rest: 60 }],
  ['abdominal-infra', 'Abdominal infra', 'abdomen', [], 'bodyweight', 'core', false, { kind: 'bodyweight_plus', step: 1, inc: 0, rest: 60 }],
  ['abdominal-polia', 'Abdominal na polia', 'abdomen', [], 'cable', 'core', false, { rest: 60 }],
  // CARDIO
  ['esteira-inclinada', 'Esteira inclinada', 'cardio', [], 'cardio', 'cardio', false, { kind: 'cardio', step: 1, inc: 0, rest: 0 }],
  ['bike', 'Bicicleta ergométrica', 'cardio', [], 'cardio', 'cardio', false, { kind: 'cardio', step: 1, inc: 0, rest: 0 }],
  ['escada', 'Escada (simulador)', 'cardio', [], 'cardio', 'cardio', false, { kind: 'cardio', step: 1, inc: 0, rest: 0 }],
  ['caminhada', 'Caminhada', 'cardio', [], 'cardio', 'cardio', false, { kind: 'cardio', step: 1, inc: 0, rest: 0 }],
]

const defaults: Record<Equipment, { step: number; inc: number }> = {
  barbell: { step: 0.5, inc: 2.5 },
  dumbbell: { step: 1, inc: 2 },
  kettlebell: { step: 2, inc: 4 },
  other: { step: 1, inc: 1 },
  machine: { step: 1, inc: 2.5 },
  cable: { step: 1, inc: 2.5 },
  bodyweight: { step: 1, inc: 0 },
  cardio: { step: 1, inc: 0 },
}

export const seedExercises: Exercise[] = rows.map(([id, name, primary, secondary, equipment, pattern, compound, o = {}]) => ({
  id,
  user_id: null,
  name,
  primaryMuscle: primary,
  secondaryMuscles: secondary,
  equipment,
  kind: o.kind ?? 'weight',
  pattern,
  isCompound: compound,
  isUnilateral: o.uni ?? false,
  stepKg: o.step ?? defaults[equipment].step,
  incrementKg: o.inc ?? defaults[equipment].inc,
  defaultRestSec: o.rest ?? (compound ? 150 : 75),
  cues: o.cues,
  commonMistakes: o.mistakes,
  aka: o.aka,
  imagesFrom: o.img,
  updated_at: '2026-11-19T00:00:00.000Z',
}))
