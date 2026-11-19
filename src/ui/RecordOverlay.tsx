import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import type { PR } from '../domain/records'
import { IconTrophy } from './icons'
import { PrimaryButton } from './primitives'
import { haptic } from '../lib/haptics'
import { fmtKg } from '../domain/progression'

export type RecordShow = { exercise: string; pr: PR; kg?: number; reps?: number; previous?: string }

function deltaText(pr: PR) {
  if (pr.type === 'reps_at_kg') return { big: `+${pr.delta}`, unit: pr.delta > 1 ? 'reps' : 'rep' }
  if (pr.type === 'e1rm') return { big: `+${fmtKg(Math.round(pr.delta * 10) / 10)}`, unit: 'kg 1RM' }
  return { big: `+${fmtKg(Math.round(pr.delta * 10) / 10)}`, unit: 'kg' }
}

/** Imagem 1080×1920 para stories. */
async function shareImage(r: RecordShow) {
  const c = document.createElement('canvas')
  c.width = 1080
  c.height = 1920
  const g = c.getContext('2d')!
  g.fillStyle = '#0B0D10'
  g.fillRect(0, 0, 1080, 1920)
  const rad = g.createRadialGradient(540, 760, 40, 540, 760, 820)
  rad.addColorStop(0, 'rgba(255,178,26,0.45)')
  rad.addColorStop(1, 'rgba(255,178,26,0)')
  g.fillStyle = rad
  g.fillRect(0, 0, 1080, 1920)
  // símbolo
  const sym = (x: number, y: number, s: number) => {
    g.save()
    g.translate(x, y)
    g.scale(s, s)
    g.fillStyle = '#F5F7FA'
    g.beginPath(); g.moveTo(0, 30); g.lineTo(22, 30); g.lineTo(61, 100); g.lineTo(39, 100); g.closePath(); g.fill()
    g.fillStyle = '#C6FF3D'
    g.beginPath(); g.moveTo(39, 100); g.lineTo(61, 100); g.lineTo(112, 0); g.lineTo(90, 0); g.closePath(); g.fill()
    g.restore()
  }
  sym(400, 180, 0.9)
  g.font = '800 64px Unbounded, sans-serif'
  g.fillStyle = '#F5F7FA'
  g.textAlign = 'left'
  g.fillText('VEYRO', 520, 262)
  g.textAlign = 'center'
  g.fillStyle = '#FFB21A'
  g.font = '600 34px Inter, sans-serif'
  g.fillText('NOVO RECORDE', 540, 560)
  g.fillStyle = '#F5F7FA'
  g.font = '700 54px Inter, sans-serif'
  g.fillText(r.exercise.toUpperCase().slice(0, 30), 540, 640)
  const d = deltaText(r.pr)
  g.font = '800 260px Unbounded, sans-serif'
  g.fillText(d.big, 540, 940)
  g.font = '600 60px Inter, sans-serif'
  g.fillStyle = '#FFB21A'
  g.fillText(d.unit, 540, 1030)
  g.fillStyle = '#F5F7FA'
  g.font = '700 72px Unbounded, sans-serif'
  g.fillText(`${r.kg != null ? fmtKg(r.kg) + ' kg' : ''}${r.reps ? ' × ' + r.reps : ''}`, 540, 1260)
  if (r.previous) {
    g.fillStyle = '#9AA3AE'
    g.font = '500 40px Inter, sans-serif'
    g.fillText(`antes: ${r.previous}`, 540, 1340)
  }
  g.fillStyle = '#9AA3AE'
  g.font = '500 36px Inter, sans-serif'
  g.fillText(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), 540, 1760)
  g.font = '600 26px Inter, sans-serif'
  g.fillText('PERSONAL TRAINING INTELLIGENCE', 540, 1820)

  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
  const file = new File([blob], 'veyro-recorde.png', { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: 'Novo recorde no VEYRO' }).catch(() => {})
  } else {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'veyro-recorde.png'
    a.click()
  }
}

export function RecordOverlay({ show, onClose }: { show: RecordShow | null; onClose: () => void }) {
  useEffect(() => {
    if (!show) return
    haptic('strong')
    const end = Date.now() + 1200
    const colors = ['#FFB21A', '#C6FF3D', '#F5F7FA']
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, colors, zIndex: 80 })
      confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors, zIndex: 80 })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [show])

  const d = show ? deltaText(show.pr) : null
  return (
    <AnimatePresence>
      {show && d && (
        <motion.div
          className="pt-safe pb-safe fixed inset-0 z-[70] flex flex-col items-center justify-center bg-bg px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: 'radial-gradient(circle at 50% 38%, rgba(255,178,26,0.35), rgba(11,13,16,0) 62%), #0B0D10' }}
        >
          <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 10 }} className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gold text-onlime shadow-[0_0_60px_rgba(255,178,26,0.6)]">
            <IconTrophy size={44} />
          </motion.div>
          <div className="text-center text-[12px] font-semibold tracking-[0.24em] text-gold">NOVO RECORDE · {show.exercise.toUpperCase()}</div>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="mt-4 flex items-end">
            <span className="num font-display text-[96px] font-extrabold leading-none">{d.big}</span>
            <span className="mb-3 ml-2 text-2xl font-semibold text-muted">{d.unit}</span>
          </motion.div>
          <div className="mt-2 text-center text-sm text-muted">{show.pr.label}</div>
          <div className="mt-8 grid w-full max-w-sm grid-cols-3 divide-x divide-border rounded-card border border-border bg-surface/80 py-4 text-center">
            <div><div className="num text-xl font-bold">{show.kg != null ? fmtKg(show.kg) : '—'}<span className="text-xs text-muted"> kg</span></div><div className="label mt-1">Carga</div></div>
            <div><div className="num text-xl font-bold">{show.reps ?? '—'}<span className="text-xs text-muted"> reps</span></div><div className="label mt-1">Volume</div></div>
            <div><div className="num text-xl font-bold">{show.previous ?? '—'}</div><div className="label mt-1">Anterior</div></div>
          </div>
          <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
            <PrimaryButton variant="gold" full onClick={() => shareImage(show)}>Compartilhar</PrimaryButton>
            <PrimaryButton variant="ghost" full onClick={onClose}>Continuar treino</PrimaryButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
