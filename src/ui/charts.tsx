import { motion } from 'framer-motion'

/** Linha simples em SVG (sem eixo) — para "Últimas 6 sessões" e cards. */
export function Sparkline({ data, height = 64, highlightLast = true }: { data: number[]; height?: number; highlightLast?: boolean }) {
  if (data.length < 2) return <div style={{ height }} className="flex items-center text-sm text-muted">Sem dados suficientes</div>
  const w = 300
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (w - 12) + 6, height - 8 - ((v - min) / span) * (height - 16)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${d} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#C6FF3D" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#C6FF3D" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={d} fill="none" stroke="#C6FF3D" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 && highlightLast ? 5 : 2.5} fill={i === pts.length - 1 ? '#C6FF3D' : '#9AA3AE'} />
      ))}
      {highlightLast && <circle cx={last[0]} cy={last[1]} r={9} fill="#C6FF3D" fillOpacity={0.2} />}
    </svg>
  )
}

/** Anel genérico (prontidão, calorias, passos, água). */
export function Ring({
  value,
  max = 100,
  size = 120,
  stroke = 10,
  color = '#C6FF3D',
  children,
}: {
  value: number
  max?: number
  size?: number
  stroke?: number
  color?: string
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value / max))
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#262B33" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

export function ReadinessRing({ score, size = 120 }: { score: number; size?: number }) {
  const color = score >= 75 ? '#C6FF3D' : score >= 50 ? '#FFB21A' : '#FF5A5F'
  return (
    <Ring value={score} size={size} color={color}>
      <span className="num font-display font-extrabold" style={{ fontSize: size * 0.28 }}>
        {score}
      </span>
      <span className="label" style={{ fontSize: 9 }}>
        Prontidão
      </span>
    </Ring>
  )
}

/** Barra de macro com cores lime / âmbar / vermelho (limite configurável). */
export function MacroBar({ label, value, target, unit = 'g', redAt = 1.1 }: { label: string; value: number; target: number; unit?: string; redAt?: number }) {
  const pct = target ? value / target : 0
  const color = pct <= 1 ? 'bg-lime' : pct <= redAt ? 'bg-gold' : 'bg-danger'
  const left = Math.round(target - value)
  return (
    <div className="flex-1">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="num text-xs text-muted">
          {left >= 0 ? `faltam ${left}${unit}` : `+${-left}${unit}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface2">
        <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct * 100)}%` }} transition={{ duration: 0.6 }} />
      </div>
      <div className="num mt-1 text-sm font-semibold">
        {Math.round(value)}
        <span className="text-muted"> / {target}{unit}</span>
      </div>
    </div>
  )
}
