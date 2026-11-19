type P = { size?: number; className?: string }
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })

export const IconHome = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
)
export const IconDumbbell = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" /></svg>
)
export const IconBody = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3" y="4" width="18" height="16" rx="4" /><path d="M8 9a5 5 0 0 1 8 0" /><path d="m12 9 1.5-1.5" /></svg>
)
export const IconFood = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 7h3" /></svg>
)
export const IconChart = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
)
export const IconPlay = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}><path d="m7 4 13 8-13 8z" /></svg>
)
export const IconSwap = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}><path d="M7 7h13l-4-4M17 17H4l4 4" /></svg>
)
export const IconCheck = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}><path d="m5 12 5 5L20 7" /></svg>
)
export const IconPlus = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconTrophy = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></svg>
)
