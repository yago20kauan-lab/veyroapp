import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DietTargets, type FoodLog, type ProgressPhoto } from '../db/schema'
import { mine } from '../db/repo'
import { Header } from '../ui/Header'
import { Card, Chip, Label, PrimaryButton } from '../ui/primitives'
import { useSession } from '../store/session'
import { localDate } from '../domain/plan'
import { bestE1rmBetween, compositionAt, exerciseMap, finishedSessions } from '../lib/progress'
import { photoUrl, photoBlob } from '../lib/photos'
import { shareOrDownload } from '../lib/timelapse'

const fmt = (n: number, d = 1) => n.toFixed(d).replace('.', ',')
type Row = { key: string; label: string; a?: number | null; b?: number | null; unit: string; better: 'down' | 'up'; d?: number; weight?: boolean }

export default function Comparar() {
  const uid = useSession((s) => s.user?.id)
  const [days, setDays] = useState<30 | 90 | 0>(30)
  const [hideWeight, setHideWeight] = useState(false)
  const data = useLiveQuery(async () => {
    const sessions = await finishedSessions()
    const firstDate = [
      ...(mine(await db.bodyWeights.toArray()) as { date: string }[]).map((w) => w.date),
      ...sessions.map((s) => s.startedAt.slice(0, 10)),
    ].sort()[0] ?? localDate()
    const start = days ? localDate(new Date(Date.now() - days * 86400000)) : firstDate
    const end = localDate()
    const A = await compositionAt(start < firstDate ? firstDate : start)
    const B = await compositionAt(end)
    const plus = (d: string, n: number) => localDate(new Date(Date.parse(d + 'T12:00') + n * 86400000))
    const e0 = await bestE1rmBetween(start, plus(start, 14))
    const e1 = await bestE1rmBetween(plus(end, -14), end)
    const ex = await exerciseMap()
    const lifts = [...e1.entries()].filter(([id]) => e0.has(id) && ex.get(id)?.isCompound).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([id, v]) => ({ key: id, label: `${ex.get(id)?.name} (1RM est.)`, a: e0.get(id)!, b: v, unit: 'kg', better: 'up' as const }))
    const workouts = sessions.filter((s) => s.startedAt.slice(0, 10) >= start).length
    const logs = (mine(await db.foodLogs.where('date').aboveOrEqual(start).toArray()) as FoodLog[])
    const loggedDays = new Set(logs.map((l) => l.date)).size
    const span = Math.max(1, Math.round((Date.now() - Date.parse(start + 'T00:00')) / 86400000))
    const t = (mine(await db.dietTargets.toArray()) as DietTargets[]).at(-1)
    const relA = A.trend && lifts.length ? lifts.slice(0, 3).reduce((s, l) => s + l.a, 0) / A.trend : null
    const relB = B.trend && lifts.length ? lifts.slice(0, 3).reduce((s, l) => s + l.b, 0) / B.trend : null
    const photos = (mine(await db.photos.toArray()) as ProgressPhoto[]).filter((p) => p.pose === 'front' && p.date >= start).sort((a, b) => a.date.localeCompare(b.date))
    const rows0: Row[] = [
      { key: 'peso', label: 'Peso (tendência)', a: A.trend, b: B.trend, unit: 'kg', better: 'down', weight: true },
      { key: 'cintura', label: 'Cintura', a: A.waist, b: B.waist, unit: 'cm', better: 'down' },
      { key: 'bf', label: '% de gordura', a: A.bf, b: B.bf, unit: '%', better: 'down' },
      { key: 'magra', label: 'Massa magra', a: A.split?.leanKg, b: B.split?.leanKg, unit: 'kg', better: 'up', weight: true },
      { key: 'gorda', label: 'Massa gorda', a: A.split?.fatKg, b: B.split?.fatKg, unit: 'kg', better: 'down', weight: true },
      ...lifts,
      { key: 'rel', label: 'Força relativa (3 principais ÷ peso)', a: relA, b: relB, unit: '×', better: 'up' },
    ]
    const rows: Row[] = rows0.map((r) => ({ ...r, d: r.a != null && r.b != null ? r.b - r.a : undefined }))
    // destaque: maior melhora relevante
    const score = (r: Row) => (r.d == null ? -1 : r.key === 'cintura' ? -r.d * 3 : r.key === 'peso' ? -r.d : r.key === 'bf' ? -r.d * 2 : r.better === 'up' && r.a ? (r.d / r.a) * 50 : 0)
    const best = [...rows].sort((x, y) => score(y) - score(x))[0]
    return { start, rows, workouts, adherence: Math.round((loggedDays / span) * 100), hasTargets: !!t, best: best && score(best) > 0 ? best : null, photos: photos.length >= 2 ? [photos[0], photos.at(-1)!] : null }
  }, [uid, days])

  async function compartilhar() {
    if (!data) return
    const c = document.createElement('canvas')
    c.width = 1080; c.height = 1920
    const g = c.getContext('2d')!
    g.fillStyle = '#0B0D10'; g.fillRect(0, 0, 1080, 1920)
    g.fillStyle = '#C6FF3D'; g.font = '600 34px Inter, sans-serif'; g.textAlign = 'center'
    g.fillText(days ? `MEUS ÚLTIMOS ${days} DIAS` : 'MINHA EVOLUÇÃO', 540, 150)
    g.fillStyle = '#F5F7FA'; g.font = '800 72px Unbounded, sans-serif'; g.fillText('VEYRO', 540, 240)
    let y = 380
    if (data.photos) {
      const [a, b] = await Promise.all(data.photos.map((p) => photoBlob(p).then((x) => (x ? createImageBitmap(x) : null))))
      const draw = (img: ImageBitmap | null, x: number) => { if (!img) return; const k = Math.max(480 / img.width, 640 / img.height); g.save(); g.beginPath(); g.roundRect(x, y, 480, 640, 24); g.clip(); g.drawImage(img, x + (480 - img.width * k) / 2, y + (640 - img.height * k) / 2, img.width * k, img.height * k); g.restore() }
      draw(a, 40); draw(b, 560)
      y += 720
    }
    g.textAlign = 'left'
    for (const r of data.rows.filter((r) => r.d != null && !(hideWeight && r.weight)).slice(0, 6)) {
      g.fillStyle = '#9AA3AE'; g.font = '500 36px Inter, sans-serif'; g.fillText(r.label, 80, y)
      const good = r.better === 'down' ? r.d! < 0 : r.d! > 0
      g.fillStyle = good ? '#C6FF3D' : '#FFB21A'; g.font = '700 44px Inter, sans-serif'; g.textAlign = 'right'
      g.fillText(`${r.d! > 0 ? '+' : ''}${fmt(r.d!, r.unit === '×' ? 2 : 1)} ${r.unit}`, 1000, y); g.textAlign = 'left'
      y += 90
    }
    g.fillStyle = '#9AA3AE'; g.font = '500 30px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(`${data.workouts} treinos no período`, 540, 1840)
    c.toBlob((b) => b && shareOrDownload(b, 'veyro-evolucao.png'), 'image/png')
  }

  return (
    <div className="pb-24">
      <Header title="Comparar" subtitle="Você hoje ×" />
      <div className="mb-4 flex gap-2">{([30, 90, 0] as const).map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d ? `${d} dias` : 'Desde o início'}</Chip>)}</div>
      {data && (
        <>
          {data.best && (
            <Card className="mb-4 border-lime/40">
              <Label className="text-lime">Maior conquista</Label>
              <div className="num mt-1 font-display text-3xl font-extrabold">{data.best.d! > 0 ? '+' : ''}{fmt(data.best.d!, data.best.unit === '×' ? 2 : 1)} {data.best.unit}</div>
              <div className="text-sm text-muted">{data.best.label}</div>
            </Card>
          )}
          {data.photos && <PhotoPair photos={data.photos} />}
          <Card className="mb-4 !p-0">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-label text-muted">
              <span>MEDIDA</span><span className="text-right">ANTES</span><span className="text-right">AGORA</span><span className="text-right">Δ</span>
            </div>
            {data.rows.map((r) => {
              const good = r.d == null || Math.abs(r.d) < 0.05 ? null : r.better === 'down' ? r.d < 0 : r.d > 0
              const dd = r.unit === '×' ? 2 : 1
              return (
                <div key={r.key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
                  <span className="truncate">{r.label}</span>
                  <span className="num text-right text-muted">{r.a != null ? fmt(r.a, dd) : '—'}</span>
                  <span className="num text-right font-semibold">{r.b != null ? fmt(r.b, dd) : '—'}</span>
                  <span className={`num text-right font-semibold ${good == null ? 'text-muted' : good ? 'text-lime' : 'text-gold'}`}>{r.d != null ? `${r.d > 0 ? '+' : ''}${fmt(r.d, dd)}` : '—'}</span>
                </div>
              )
            })}
          </Card>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Card><Label>Treinos</Label><div className="num mt-1 text-2xl font-bold">{data.workouts}</div></Card>
            <Card><Label>Dias com dieta registrada</Label><div className="num mt-1 text-2xl font-bold">{data.adherence}%</div></Card>
          </div>
          <div className="mb-3 flex gap-2"><Chip active={hideWeight} onClick={() => setHideWeight(!hideWeight)}>{hideWeight ? '✓ ' : ''}Esconder peso na imagem</Chip></div>
          <PrimaryButton full onClick={compartilhar}>Compartilhar evolução</PrimaryButton>
        </>
      )}
    </div>
  )
}

function PhotoPair({ photos }: { photos: ProgressPhoto[] }) {
  const [u, setU] = useState<(string | null)[]>([null, null])
  useEffect(() => { Promise.all(photos.map(photoUrl)).then(setU) }, [photos])
  return (
    <div className="mb-4 grid grid-cols-2 gap-2">
      {photos.map((p, i) => (
        <div key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-btn bg-surface2">
          {u[i] && <img src={u[i]!} alt="" className="h-full w-full object-cover" />}
          <span className="num absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px]">{new Date(p.date + 'T12:00').toLocaleDateString('pt-BR')}</span>
        </div>
      ))}
    </div>
  )
}
