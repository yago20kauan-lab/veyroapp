/**
 * Nome do alimento nas dietas prontas → id do alimento no app (TACO, versão cozida/pronta, ou alimento do sistema).
 * Tabela única: se um mapeamento fizer os macros divergirem do JSON, corrija aqui (o teste confere as 51 dietas).
 */
export const DIET_FOOD_MAP: Record<string, string> = {
  'Abacate': 'taco-163',
  'Arroz branco cozido': 'taco-3',
  'Atum em conserva (água)': 'atum-agua',
  'Aveia em flocos': 'taco-7',
  'Azeite de oliva': 'taco-260',
  'Banana': 'taco-182',
  'Batata-doce cozida': 'taco-88',
  'Brócolis cozido': 'taco-100',
  'Castanha-de-caju': 'taco-588',
  'Cuscuz de milho cozido': 'taco-533',
  'Feijão carioca cozido': 'taco-561',
  'Frango desfiado': 'taco-408',
  'Iogurte natural desnatado': 'taco-449',
  'Leite desnatado': 'leite-desnatado',
  'Macarrão cozido': 'macarrao-cozido',
  'Mamão': 'taco-226',
  'Mel': 'taco-507',
  'Morango': 'taco-239',
  'Ovo inteiro cozido': 'taco-488',
  'Pasta de amendoim': 'pasta-amendoim',
  'Patinho moído refogado': 'taco-377',
  'Peito de frango grelhado': 'taco-410',
  'Pão francês': 'taco-53',
  'Pão integral': 'taco-52',
  'Queijo minas frescal': 'taco-461',
  'Requeijão light': 'requeijao-light',
  'Salada de folhas e legumes': 'salada-folhas',
  'Salmão grelhado': 'taco-317',
  'Tapioca (goma)': 'tapioca-goma',
  'Whey protein': 'whey',
  'Wrap/rap10 integral': 'wrap-integral',
}

/** Leite vem em ml nas dietas: 1 ml ≈ 1,03 g. */
export const ML_TO_G = 1.03
