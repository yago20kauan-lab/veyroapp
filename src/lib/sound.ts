/** Bipe de fim de descanso (Web Audio). No iPhone só toca com o app aberto. */
let ctx: AudioContext | null = null

/** Chame dentro de um toque do usuário (ex.: "Concluir série") para liberar o áudio no iOS. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!ctx) ctx = new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* sem áudio */
  }
}

export function beep(times = 3) {
  if (!ctx) return
  const t0 = ctx.currentTime
  for (let i = 0; i < times; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = i === times - 1 ? 1320 : 880
    g.gain.setValueAtTime(0.0001, t0 + i * 0.28)
    g.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.28 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.28 + 0.22)
    o.connect(g).connect(ctx.destination)
    o.start(t0 + i * 0.28)
    o.stop(t0 + i * 0.28 + 0.24)
  }
}
