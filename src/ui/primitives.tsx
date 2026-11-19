import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { VeyroMark } from './brand'
import { haptic } from '../lib/haptics'

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-card border border-border bg-surface p-4 ${onClick ? 'active:scale-[0.99] transition-transform cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`label ${className}`}>{children}</div>
}

export function BigNumber({ value, unit, sub, size = 64 }: { value: string; unit?: string; sub?: string; size?: number }) {
  return (
    <div className="flex items-end gap-2">
      <span className="num font-display font-extrabold leading-none text-text" style={{ fontSize: size }}>
        {value}
      </span>
      {(unit || sub) && (
        <div className="mb-1 flex flex-col leading-tight">
          {unit && <span className="text-lg font-semibold text-text">{unit}</span>}
          {sub && <span className="text-sm text-muted">{sub}</span>}
        </div>
      )}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'gold'; full?: boolean }
export function PrimaryButton({ variant = 'primary', full, className = '', onClick, children, ...rest }: BtnProps) {
  const styles = {
    primary: 'bg-lime text-onlime active:bg-lime-hi',
    ghost: 'bg-surface2 text-text border border-border active:bg-border',
    gold: 'bg-gold text-onlime',
  }[variant]
  return (
    <button
      {...rest}
      onClick={(e) => {
        haptic('medium')
        onClick?.(e)
      }}
      className={`min-h-[52px] rounded-btn px-5 text-base font-semibold transition active:scale-[0.98] disabled:opacity-40 ${styles} ${full ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

export function Chip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={() => {
        haptic('light')
        onClick?.()
      }}
      className={`h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium transition ${
        active ? 'bg-lime text-onlime' : 'border border-border bg-surface2 text-text'
      }`}
    >
      {children}
    </button>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-btn bg-surface2 ${className}`} />
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-10 text-center">
      <div className="opacity-60">
        <VeyroMark size={36} variant="mono" />
      </div>
      <div className="text-base font-semibold">{title}</div>
      {text && <p className="max-w-xs text-sm text-muted">{text}</p>}
      {action}
    </div>
  )
}

export function SectionTitle({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        {kicker && <Label className="mb-1 text-lime">{kicker}</Label>}
        <h2 className="font-display text-xl font-bold">{title}</h2>
      </div>
      {right}
    </div>
  )
}
