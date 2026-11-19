import { motion } from 'framer-motion'

/** Símbolo oficial VEYRO — não redesenhar (ver A0). */
export function VeyroMark({ size = 32, variant = 'dark' }: { size?: number; variant?: 'dark' | 'accent' | 'light' | 'mono' }) {
  const fills = {
    dark: ['#F5F7FA', '#C6FF3D', 1],
    accent: ['#0B0D10', '#0B0D10', 0.4],
    light: ['#B5BAC2', '#0B0D10', 1],
    mono: ['#FFFFFF', '#FFFFFF', 0.45],
  } as const
  const [a, b, op] = fills[variant]
  return (
    <svg width={size * 1.12} height={size} viewBox="0 0 112 100" role="img" aria-label="VEYRO">
      <polygon points="0,30 22,30 61,100 39,100" fill={a} fillOpacity={op} />
      <polygon points="39,100 61,100 112,0 90,0" fill={b} />
    </svg>
  )
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <VeyroMark size={size} />
      <span className="font-display font-extrabold tracking-brand text-text" style={{ fontSize: size * 0.95 }}>
        VEYRO
      </span>
    </div>
  )
}

/** Carregador: as duas barras do símbolo sobem em sequência. */
export function VeyroLoader({ size = 40, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <svg width={size * 1.12} height={size} viewBox="0 0 112 100" aria-hidden>
        <motion.polygon
          points="0,30 22,30 61,100 39,100"
          fill="#F5F7FA"
          initial={{ opacity: 0.2, y: 12 }}
          animate={{ opacity: [0.2, 1, 0.2], y: [12, 0, 12] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.polygon
          points="39,100 61,100 112,0 90,0"
          fill="#C6FF3D"
          initial={{ opacity: 0.2, y: 12 }}
          animate={{ opacity: [0.2, 1, 0.2], y: [12, 0, 12] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}
        />
      </svg>
      {label && <span className="label">{label}</span>}
    </div>
  )
}
