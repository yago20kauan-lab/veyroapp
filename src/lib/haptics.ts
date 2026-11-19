/**
 * Vibração. No iPhone (Safari/PWA) a Vibration API não existe: vira no-op silencioso.
 * No Android, funciona.
 */
const patterns = { light: 8, medium: 18, strong: [30, 40, 30] as number[] }

export function haptic(kind: keyof typeof patterns = 'light') {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(patterns[kind])
  } catch {
    /* sem suporte */
  }
}
