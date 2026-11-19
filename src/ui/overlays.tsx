import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { Ring } from './charts'

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label={title}
            className="pb-safe fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[24px] border-t border-border bg-surface px-5 pt-3"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, i) => i.offset.y > 120 && onClose()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
            {title && <h3 className="mb-4 font-display text-lg font-bold">{title}</h3>}
            <div className="pb-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ---------- Toast ---------- */
type ToastState = { msg: string | null; show: (m: string) => void }
export const useToast = create<ToastState>((set) => ({
  msg: null,
  show: (m) => {
    set({ msg: m })
    setTimeout(() => set({ msg: null }), 2400)
  },
}))

export function ToastHost() {
  const msg = useToast((s) => s.msg)
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          className="pt-safe fixed inset-x-0 top-3 z-[60] flex justify-center px-4"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
        >
          <div className="rounded-full border border-border bg-surface2 px-4 py-2.5 text-sm font-medium shadow-lg">{msg}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------- Timer de descanso ---------- */
/** Usa a hora de término (endsAt): continua certo mesmo se a aba dormir. */
export function RestTimerPill({ endsAt, totalSec, onAdjust, onSkip }: { endsAt: number; totalSec: number; onAdjust: (d: number) => void; onSkip: () => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000))
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface2 p-3">
      <Ring value={left} max={totalSec} size={56} stroke={5}>
        <span className="num text-xs font-bold">{mm}:{ss}</span>
      </Ring>
      <div className="flex-1">
        <div className="label">Descanso</div>
        <div className="num font-display text-2xl font-bold">
          {mm}:{ss}
        </div>
      </div>
      <button className="h-10 rounded-btn border border-border px-3 text-sm" onClick={() => onAdjust(-15)}>
        −15s
      </button>
      <button className="h-10 rounded-btn border border-border px-3 text-sm" onClick={() => onAdjust(15)}>
        +15s
      </button>
      <button className="h-10 rounded-btn bg-lime px-3 text-sm font-semibold text-onlime" onClick={onSkip}>
        Pular
      </button>
    </div>
  )
}
