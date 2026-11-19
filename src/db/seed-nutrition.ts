import type { Food, PlanMeal } from './schema'

/**
 * Alimentos iniciais (valores aproximados por 100 g, base TACO/rótulos comuns).
 * A importação completa da TACO entra na Etapa 6.
 */
type F = [id: string, name: string, kcal: number, p: number, c: number, f: number, state: Food['state'], group: Food['swapGroup'], section: Food['section'], yieldFactor?: number]
const rows: F[] = [
  ['arroz-branco-cozido', 'Arroz branco cozido', 128, 2.5, 28.1, 0.2, 'cooked', 'carb', 'mercearia', 2.5],
  ['arroz-integral-cozido', 'Arroz integral cozido', 124, 2.6, 25.8, 1.0, 'cooked', 'carb', 'mercearia', 2.4],
  ['feijao-carioca-cozido', 'Feijão carioca cozido', 76, 4.8, 13.6, 0.5, 'cooked', 'carb', 'mercearia', 2.4],
  ['batata-doce-cozida', 'Batata-doce cozida', 77, 0.6, 18.4, 0.1, 'cooked', 'carb', 'hortifruti', 1.0],
  ['batata-inglesa-cozida', 'Batata-inglesa cozida', 52, 1.2, 11.9, 0.0, 'cooked', 'carb', 'hortifruti', 1.0],
  ['mandioca-cozida', 'Mandioca cozida', 125, 0.6, 30.1, 0.3, 'cooked', 'carb', 'hortifruti', 1.0],
  ['macarrao-cozido', 'Macarrão cozido', 132, 4.5, 26.0, 0.7, 'cooked', 'carb', 'mercearia', 2.3],
  ['cuscuz-milho', 'Cuscuz de milho', 113, 2.2, 25.3, 0.7, 'cooked', 'carb', 'mercearia', 2.0],
  ['tapioca-goma', 'Tapioca (goma hidratada)', 240, 0.0, 59.0, 0.0, 'na', 'bread', 'mercearia'],
  ['pao-integral', 'Pão integral', 253, 9.4, 49.9, 3.7, 'na', 'bread', 'padaria'],
  ['pao-frances', 'Pão francês', 300, 8.0, 58.6, 3.1, 'na', 'bread', 'padaria'],
  ['aveia-flocos', 'Aveia em flocos', 394, 13.9, 66.6, 8.5, 'na', 'bread', 'mercearia'],
  ['frango-peito-grelhado', 'Peito de frango grelhado', 159, 32.0, 0.0, 2.5, 'cooked', 'protein', 'acougue', 0.75],
  ['patinho-grelhado', 'Patinho grelhado', 219, 35.9, 0.0, 7.3, 'cooked', 'protein', 'acougue', 0.7],
  ['tilapia-grelhada', 'Tilápia grelhada', 128, 26.2, 0.0, 2.7, 'cooked', 'protein', 'acougue', 0.8],
  ['atum-agua', 'Atum em água (escorrido)', 116, 25.5, 0.0, 0.8, 'na', 'protein', 'mercearia'],
  ['sobrecoxa-sem-pele', 'Sobrecoxa sem pele assada', 180, 26.0, 0.0, 8.0, 'cooked', 'protein', 'acougue', 0.75],
  ['ovo-inteiro', 'Ovo inteiro', 146, 13.3, 0.6, 9.5, 'na', 'protein', 'laticinios'],
  ['clara-ovo', 'Clara de ovo', 52, 11.0, 0.7, 0.2, 'na', 'protein', 'laticinios'],
  ['iogurte-natural', 'Iogurte natural integral', 51, 4.1, 1.9, 3.0, 'na', 'dairy', 'laticinios'],
  ['whey', 'Whey protein', 400, 80.0, 8.0, 6.0, 'na', 'protein', 'suplementos'],
  ['banana', 'Banana prata', 98, 1.3, 26.0, 0.1, 'na', 'fruit', 'hortifruti'],
  ['mamao', 'Mamão papaia', 40, 0.5, 10.4, 0.1, 'na', 'fruit', 'hortifruti'],
  ['maca', 'Maçã', 56, 0.3, 15.2, 0.0, 'na', 'fruit', 'hortifruti'],
  ['abacaxi', 'Abacaxi', 48, 0.9, 12.3, 0.1, 'na', 'fruit', 'hortifruti'],
  ['melancia', 'Melancia', 33, 0.9, 8.1, 0.0, 'na', 'fruit', 'hortifruti'],
  ['pasta-amendoim', 'Pasta de amendoim integral', 588, 25.0, 20.0, 50.0, 'na', 'fat', 'mercearia'],
  ['azeite', 'Azeite de oliva', 884, 0.0, 0.0, 100.0, 'na', 'fat', 'mercearia'],
  ['castanha-para', 'Castanha-do-pará', 643, 14.5, 15.1, 63.5, 'na', 'fat', 'mercearia'],
  ['legumes-cozidos', 'Legumes cozidos (brócolis, abobrinha, cenoura)', 30, 1.8, 5.5, 0.3, 'cooked', 'veg', 'hortifruti', 1.0],
  ['salada-folhas', 'Salada de folhas, tomate e pepino', 15, 1.0, 2.8, 0.2, 'na', 'veg', 'hortifruti'],
]

export const seedFoods: Food[] = rows.map(([id, name, kcal, p, c, f, state, swapGroup, section, yieldFactor]) => ({
  id,
  user_id: null,
  name,
  per100g: { kcal, p, c, f },
  state,
  swapGroup,
  section,
  yieldFactor,
  source: 'seed',
  updated_at: '2026-11-19T00:00:00.000Z',
}))

/** Modelo de dieta "Definição 2.300 kcal, 4 refeições" (A13). */
export const templateDefinicao2300: { name: string; targets: { kcal: number; p: number; c: number; f: number }; waterMl: number; meals: PlanMeal[] } = {
  name: 'Definição 2.300 kcal, 4 refeições',
  targets: { kcal: 2295, p: 190, c: 260, f: 55 },
  waterMl: 3250,
  meals: [
    { name: 'Café da manhã', time: '08:00', items: [
      { foodId: 'ovo-inteiro', grams: 150 }, { foodId: 'clara-ovo', grams: 100 }, { foodId: 'pao-integral', grams: 50 },
      { foodId: 'mamao', grams: 150 }, { foodId: 'aveia-flocos', grams: 20 } ] },
    { name: 'Almoço', time: '13:00', items: [
      { foodId: 'arroz-branco-cozido', grams: 200 }, { foodId: 'feijao-carioca-cozido', grams: 100 },
      { foodId: 'frango-peito-grelhado', grams: 180 }, { foodId: 'salada-folhas', grams: 100 }, { foodId: 'azeite', grams: 10 } ] },
    { name: 'Pré-treino', time: '19:00', items: [
      { foodId: 'tapioca-goma', grams: 60 }, { foodId: 'pasta-amendoim', grams: 15 }, { foodId: 'whey', grams: 30 }, { foodId: 'banana', grams: 100 } ] },
    { name: 'Jantar', time: '21:30', items: [
      { foodId: 'batata-doce-cozida', grams: 250 }, { foodId: 'patinho-grelhado', grams: 180 }, { foodId: 'legumes-cozidos', grams: 150 } ] },
  ],
}
