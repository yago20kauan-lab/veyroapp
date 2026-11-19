import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { Ring } from './charts'

/**
 * Folha inferior.
 * - Só a alça/título arrastam (no iPhone, drag no corpo inteiro bloqueava a rolagem).
 * - O conteúdo rola por dentro; `footer` fica fixo embaixo (ex.: botão principal).
 * - Trava a rolagem da página por trás enquanto está aberta.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const controls = useDragControls()
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

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
            aria-modal="true"
            aria-label={title}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] max-w-md flex-col rounded-t-[24px] border-t border-border bg-surface"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => (i.offset.y > 110 || i.velocity.y > 600) && onClose()}
          >
            <div
              className="shrink-0 cursor-grab touch-none px-5 pt-3"
              onPointerDown={(e) => controls.start(e)}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
              {title && <h3 className="pb-3 font-display text-lg font-bold">{title}</h3>}
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            >
              {children}
            </div>
            {footer && (
              <div className="pb-safe shrink-0 border-t border-border bg-surface px-5 pt-3">
                <div className="pb-3">{footer}</div>
              </div>
            )}
            {!footer && <div className="pb-safe shrink-0" />}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ---------- Toast ---------- */
type ToastAction = { label: string; fn: () => void }
type ToastState = { msg: string | null; action?: ToastAction; seq: number; show: (m: string, action?: ToastAction) => void; hide: () => void }
export const useToast = create<ToastState>((set, get) => ({
  msg: null,
  seq: 0,
  show: (m, action) => {
    const seq = get().seq + 1
    set({ msg: m, action, seq })
    setTimeout(() => get().seq === seq && set({ msg: null, action: undefined }), action ? 4500 : 2400)
  },
  hide: () => set({ msg: null, action: undefined }),
}))

export function ToastHost() {
  const { msg, action, hide } = useToast()
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          className="pt-safe fixed inset-x-0 top-3 z-[60] flex justify-center px-4"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
        >
          <div className="flex items-center gap-3 rounded-full border border-border bg-surface2 px-4 py-2.5 text-sm font-medium shadow-lg">
            <span>{msg}</span>
            {action && (
              <button className="font-semibold text-lime" onClick={() => { action.fn(); hide() }}>
                {action.label}
              </button>
            )}
          </div>
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
