/** Composição corporal pelo método da Marinha dos EUA (U.S. Navy). Estimativa. */
export function navyBodyFat(sex: 'm' | 'f', heightCm: number, waistCm: number, neckCm: number, hipCm?: number): number | null {
  const log10 = Math.log10
  if (sex === 'm') {
    if (waistCm - neckCm <= 0) return null
    const bf = 495 / (1.0324 - 0.19077 * log10(waistCm - neckCm) + 0.15456 * log10(heightCm)) - 450
    return Math.round(bf * 10) / 10
  }
  if (!hipCm || waistCm + hipCm - neckCm <= 0) return null
  const bf = 495 / (1.29579 - 0.35004 * log10(waistCm + hipCm - neckCm) + 0.221 * log10(heightCm)) - 450
  return Math.round(bf * 10) / 10
}

export function massSplit(weightKg: number, bodyFatPct: number) {
  const fat = Math.round(weightKg * (bodyFatPct / 100) * 10) / 10
  return { fatKg: fat, leanKg: Math.round((weightKg - fat) * 10) / 10 }
}
