import { useEffect, useState } from 'react'
import type { Exercise } from '../db/schema'

/** Fotos do Free Exercise DB (domínio público), servidas pelo GitHub, fixadas num commit. */
export const EX_IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/'
export const exImg = (p: string) => EX_IMG_BASE + p

/** Alterna posição inicial e final, como um GIF. */
export function ExerciseAnim({ ex, className = '' }: { ex: Pick<Exercise, 'images' | 'name'>; className?: string }) {
  const imgs = ex.images ?? []
  const [i, setI] = useState(0)
  useEffect(() => {
    if (imgs.length < 2) return
    const t = setInterval(() => setI((v) => (v + 1) % imgs.length), 1100)
    return () => clearInterval(t)
  }, [imgs.length])
  if (!imgs.length) return null
  return (
    <div className={`relative overflow-hidden rounded-btn bg-white ${className}`}>
      {imgs.map((p, k) => (
        <img key={p} src={exImg(p)} alt={k === 0 ? ex.name : ''} className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300" style={{ opacity: k === i ? 1 : 0 }} />
      ))}
    </div>
  )
}

export function ExerciseThumb({ ex, size = 44 }: { ex: Pick<Exercise, 'images' | 'name'>; size?: number }) {
  const p = ex.images?.[0]
  return p ? (
    <img src={exImg(p)} alt="" loading="lazy" decoding="async" width={size} height={size} className="shrink-0 rounded-[10px] bg-white object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="flex shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface2 font-display text-sm font-bold text-lime" style={{ width: size, height: size }}>{ex.name.charAt(0)}</div>
  )
}
