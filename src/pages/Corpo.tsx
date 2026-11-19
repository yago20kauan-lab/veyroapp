import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ComposedChart, Line, ResponsiveContainer, Scatter, XAxis, YAxis, ReferenceLine, Tooltip } from 'recharts'
import { db, type BodyWeight, type Measurement, type ProgressPhoto } from '../db/schema'
import { mine, remove, save } from '../db/repo'
import { Header } from '../ui/Header'
import { Card, Chip, EmptyState, Label, PrimaryButton, SectionTitle } from '../ui/primitives'
import { BottomSheet, useToast } from '../ui/overlays'
import { WheelPicker } from '../ui/WheelPicker'
import { useSession } from '../store/session'
import { emaTrend, weeklyRate, weeksToGoal } from '../domain/trend'
import { massSplit, navyBodyFat } from '../domain/bodycomp'
import { localDate } from '../domain/plan'
import { getProfile } from '../lib/plan'
import { addPhoto, deletePhoto, photoBlob, photoUrl } from '../lib/photos'
import { makeTimelapse, shareOrDownload } from '../lib/timelapse'

const fmt = (n: number) => n.toFixed(1).replace('.', ',')
const shortDate = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const POSES: { id: ProgressPhoto['pose']; label: string }[] = [{ id: 'front', label: 'Frente' }, { id: 'side', label: 'Lado' }, { id: 'back', label: 'Costas' }]

export default function Corpo() {
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const uid = useSession((s) => s.user?.id)
  const weights = useLiveQuery(async () => (mine(await db.bodyWeights.orderBy('date').toArray()) as BodyWeight[]), [uid])
  const measures = useLiveQuery(async () => (mine(await db.measurements.orderBy('date').toArray()) as Measurement[]), [uid])
  const profile = useLiveQuery(() => getProfile(), [uid])
  const [period, setPeriod] = useState<30 | 90 | 0>(90)
  const [wOpen, setWOpen] = useState(false)
  const [kg, setKg] = useState(90)
  const [mOpen, setMOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)

  const trend = useMemo(() => emaTrend((weights ?? []).map((w) => ({ date: w.date, kg: w.kg }))), [weights])
  const rate = weeklyRate(trend)
  const lastT = trend.at(-1)
  const goal = profile?.targetWeightKg
  const eta = lastT && goal ? weeksToGoal(lastT.trend, goal, rate) : null
  const shown = period ? trend.filter((p) => Date.now() - Date.parse(p.date) <= period * 86400000) : trend
  const lastM = measures?.at(-1)
  const lastWaist = [...(measures ?? [])].reverse().find((m) => m.waistCm)
  const waistDue = !lastWaist || Date.now() - Date.parse(lastWaist.date) > 15 * 86400000
  const bf = lastWaist && profile?.sex && profile.heightCm
    ? navyBodyFat(profile.sex, profile.heightCm, lastWaist.waistCm!, [...(measures ?? [])].reverse().find((m) => m.neckCm)?.neckCm ?? 0, [...(measures ?? [])].reverse().find((m) => m.hipCm)?.hipCm)
    : null
  const split = bf != null && lastT ? massSplit(lastT.trend, bf) : null

  // série de composição ao longo do tempo
  const compSeries = useMemo(() => {
    if (!measures || !profile?.sex || !profile.heightCm) return []
    let neck: number | undefined
    let hip: number | undefined
    const out: { date: string; lean: number; fat: number }[] = []
    for (const m of measures) {
      neck = m.neckCm ?? neck
      hip = m.hipCm ?? hip
      if (!m.waistCm || !neck) continue
      const pct = navyBodyFat(profile.sex, profile.heightCm, m.waistCm, neck, hip)
      const t = [...trend].reverse().find((p) => p.date <= m.date) ?? trend[0]
      if (pct != null && t) out.push({ date: m.date, ...(({ leanKg, fatKg }) => ({ lean: leanKg, fat: fatKg }))(massSplit(t.trend, pct)) })
    }
    return out
  }, [measures, profile, trend])

  async function registrarPeso() {
    const date = localDate()
    const existing = weights?.find((w) => w.date === date)
    await save('bodyWeights', { ...(existing ?? {}), date, kg: Math.round(kg * 10) / 10, source: 'manual' })
    setWOpen(false)
    toast(`Peso salvo: ${fmt(kg)} kg`)
  }

  return (
    <>
      <Header title="Corpo" />
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <Chip onClick={() => nav('/checkin')}>Check-in semanal</Chip>
        <Chip onClick={() => nav('/comparar')}>Comparar 30/90 dias</Chip>
      </div>

      {/* PESO */}
      <SectionTitle kicker="Peso" title="Tendência" right={<PrimaryButton className="!min-h-[40px] !px-4 text-sm" onClick={() => { setKg(weights?.at(-1)?.kg ?? 90); setWOpen(true) }}>+ Peso</PrimaryButton>} />
      {!weights ? null : weights.length === 0 ? (
        <EmptyState title="Nenhum peso registrado" text="Pese-se em jejum, 3x por semana. O VEYRO mostra a tendência, não o número do dia." />
      ) : (
        <Card className="mb-6">
          <div className="flex items-end justify-between">
            <div>
              <Label>Tendência</Label>
              <div className="num font-display text-4xl font-extrabold">{fmt(lastT!.trend)}<span className="ml-1 text-lg font-semibold">kg</span></div>
              <div className="num text-xs text-muted">último: {fmt(weights.at(-1)!.kg)} kg em {shortDate(weights.at(-1)!.date)}</div>
            </div>
            <div className="text-right">
              <Label>Ritmo</Label>
              <div className={`num text-lg font-bold ${rate == null ? 'text-muted' : rate < 0 ? 'text-lime' : 'text-gold'}`}>{rate == null ? '—' : `${rate > 0 ? '+' : ''}${fmt(rate)} kg/sem`}</div>
              <div className="text-[11px] text-muted">{rate == null ? 'precisa de 14 dias' : eta ? `meta em ~${eta} semanas` : goal ? 'ritmo não leva à meta' : <button className="text-lime" onClick={() => setGoalOpen(true)}>definir meta</button>}</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">{([30, 90, 0] as const).map((p) => <Chip key={p} active={period === p} onClick={() => setPeriod(p)}>{p ? `${p}d` : 'Tudo'}</Chip>)}</div>
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={shown} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#9AA3AE', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: '#9AA3AE', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toFixed(1).replace('.', ',')} />
                <Tooltip contentStyle={{ background: '#1A1E24', border: '1px solid #262B33', borderRadius: 12, fontSize: 12 }} labelFormatter={(l) => shortDate(String(l))} formatter={(v, n) => [`${fmt(Number(v))} kg`, n === 'trend' ? 'tendência' : 'peso']} />
                {goal && <ReferenceLine y={goal} stroke="#C6FF3D" strokeDasharray="4 4" strokeOpacity={0.5} />}
                <Scatter dataKey="kg" fill="#5B616B" />
                <Line dataKey="trend" stroke="#C6FF3D" strokeWidth={2.5} dot={false} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 divide-y divide-border">
            {[...weights].reverse().slice(0, 5).map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted">{new Date(w.date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                <span className="flex items-center gap-4"><span className="num font-semibold">{fmt(w.kg)} kg</span><button className="text-xs text-muted" onClick={() => remove('bodyWeights', w.id)}>Apagar</button></span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* MEDIDAS */}
      <SectionTitle kicker="Medidas" title="Cintura e composição" right={<PrimaryButton className="!min-h-[40px] !px-4 text-sm" onClick={() => setMOpen(true)}>+ Medir</PrimaryButton>} />
      {waistDue && <div className="mb-3 rounded-btn border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">Hora de medir a cintura (a cada 15 dias, na altura do umbigo).</div>}
      <Card className="mb-6">
        {lastM ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {([['Cintura', 'waistCm'], ['Pescoço', 'neckCm'], ['Peito', 'chestCm'], ['Braço', 'armCm'], ['Coxa', 'thighCm'], ['Quadril', 'hipCm']] as const).map(([l, k]) => {
                const vals = (measures ?? []).filter((m) => m[k] != null)
                const v = vals.at(-1)?.[k]
                const first = vals[0]?.[k]
                return (
                  <div key={k} className="rounded-btn bg-surface2 p-2.5">
                    <div className="label">{l}</div>
                    <div className="num mt-0.5 font-bold">{v != null ? `${fmt(v)} cm` : '—'}</div>
                    {v != null && first != null && vals.length > 1 && <div className={`num text-[11px] ${v - first <= 0 ? 'text-lime' : 'text-gold'}`}>{v - first > 0 ? '+' : ''}{fmt(v - first)} cm</div>}
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <Label>% de gordura (estimativa)</Label>
                <div className="num font-display text-3xl font-extrabold">{bf != null ? `${fmt(bf)}%` : '—'}</div>
                {bf == null && <div className="text-xs text-muted">Precisa de cintura, pescoço{profile?.sex === 'f' ? ', quadril' : ''} e altura.</div>}
              </div>
              {split && <div className="num text-right text-sm"><div><span className="text-muted">magra</span> <b>{fmt(split.leanKg)} kg</b></div><div><span className="text-muted">gorda</span> <b>{fmt(split.fatKg)} kg</b></div></div>}
            </div>
            {compSeries.length >= 2 && (
              <div className="mt-3 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={compSeries} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#9AA3AE', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="l" tick={{ fill: '#9AA3AE', fontSize: 10 }} axisLine={false} tickLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                    <YAxis yAxisId="f" orientation="right" hide domain={['dataMin - 2', 'dataMax + 2']} />
                    <Line yAxisId="l" dataKey="lean" stroke="#C6FF3D" strokeWidth={2} dot name="massa magra" />
                    <Line yAxisId="f" dataKey="fat" stroke="#FFB21A" strokeWidth={2} dot name="massa gorda" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted">Estimativa pelo método da Marinha dos EUA. Use a tendência, não o número exato. Na definição: gorda cai, magra fica estável.</p>
          </>
        ) : (
          <p className="text-sm text-muted">Registre cintura e pescoço{profile?.sex === 'f' ? ' e quadril' : ''} para estimar o % de gordura.</p>
        )}
      </Card>

      {/* FOTOS */}
      <PhotosSection />

      <BottomSheet open={wOpen} onClose={() => setWOpen(false)} title="Peso de hoje" footer={<PrimaryButton full onClick={registrarPeso}>Salvar {fmt(kg)} kg</PrimaryButton>}>
        <WheelPicker min={40} max={200} step={0.1} value={kg} onChange={setKg} format={fmt} label="kg" accent />
        <p className="mt-3 text-center text-xs text-muted">Em jejum, depois de ir ao banheiro.</p>
      </BottomSheet>
      <MeasureSheet open={mOpen} onClose={() => setMOpen(false)} last={lastM} sex={profile?.sex} />
      <GoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} current={lastT?.trend ?? 90} />
    </>
  )
}

function MeasureSheet({ open, onClose, last, sex }: { open: boolean; onClose: () => void; last?: Measurement; sex?: 'm' | 'f' }) {
  const fields = [['waistCm', 'Cintura (umbigo)'], ['neckCm', 'Pescoço'], ...(sex === 'f' ? [['hipCm', 'Quadril']] : []), ['chestCm', 'Peito'], ['armCm', 'Braço'], ['thighCm', 'Coxa'], ...(sex !== 'f' ? [['hipCm', 'Quadril']] : [])] as [keyof Measurement, string][]
  const [v, setV] = useState<Record<string, string>>({})
  useEffect(() => { if (open) setV({}) }, [open])
  return (
    <BottomSheet open={open} onClose={onClose} title="Medidas de hoje" footer={
      <PrimaryButton full onClick={async () => {
        const row: Record<string, unknown> = { date: localDate() }
        for (const [k] of fields) { const n = parseFloat((v[k] ?? '').replace(',', '.')); if (n > 0) row[k] = n }
        if (Object.keys(row).length > 1) await save('measurements', row as unknown as Measurement)
        onClose()
      }}>Salvar</PrimaryButton>
    }>
      <p className="mb-3 text-sm text-muted">Fita métrica, sempre no mesmo ponto. Deixe em branco o que não mediu.</p>
      <div className="flex flex-col gap-2">
        {fields.map(([k, l]) => (
          <label key={k} className="flex items-center justify-between gap-3 rounded-btn border border-border bg-surface2 px-3 py-2">
            <span className="text-sm">{l}</span>
            <span className="flex items-center gap-1">
              <input inputMode="decimal" placeholder={last?.[k] ? String(last[k]).replace('.', ',') : '—'} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="num h-10 w-20 rounded-[10px] border border-border bg-bg text-center text-base outline-none focus:border-lime" />
              <span className="text-xs text-muted">cm</span>
            </span>
          </label>
        ))}
      </div>
    </BottomSheet>
  )
}

function GoalSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: number }) {
  const [g, setG] = useState(Math.round(current) - 8)
  return (
    <BottomSheet open={open} onClose={onClose} title="Peso-meta" footer={
      <PrimaryButton full onClick={async () => { const p = await getProfile(); if (p) await save('profiles', { ...p, targetWeightKg: g }); onClose() }}>Salvar {fmt(g)} kg</PrimaryButton>
    }>
      <WheelPicker min={40} max={200} step={0.5} value={g} onChange={setG} format={fmt} label="kg" accent />
    </BottomSheet>
  )
}

function PhotoThumb({ p, onClick, hidden }: { p: ProgressPhoto; onClick?: () => void; hidden?: boolean }) {
  const [u, setU] = useState<string | null>(null)
  useEffect(() => { photoUrl(p).then(setU) }, [p])
  return (
    <button onClick={onClick} className="relative aspect-[3/4] overflow-hidden rounded-btn border border-border bg-surface2">
      {u ? <img src={u} alt="" className={`h-full w-full object-cover ${hidden ? 'blur-xl' : ''}`} /> : <span className="text-xs text-muted">…</span>}
      <span className="num absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px]">{shortDate(p.date)}</span>
    </button>
  )
}

function PhotosSection() {
  const uid = useSession((s) => s.user?.id)
  const toast = useToast((s) => s.show)
  const photos = useLiveQuery(async () => (mine(await db.photos.orderBy('date').toArray()) as ProgressPhoto[]), [uid])
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front')
  const [hidden, setHidden] = useState(true)
  const [compare, setCompare] = useState(false)
  const [view, setView] = useState<ProgressPhoto | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = (photos ?? []).filter((p) => p.pose === pose)

  async function timelapse() {
    if (list.length < 2) return toast('Precisa de pelo menos 2 fotos desta pose')
    setBusy('Gerando vídeo… 0%')
    try {
      const weights = mine(await db.bodyWeights.toArray()) as BodyWeight[]
      const frames = []
      for (const p of list) {
        const b = await photoBlob(p)
        if (!b) continue
        const w = weights.filter((x) => x.date <= p.date).sort((a, c) => a.date.localeCompare(c.date)).at(-1)
        frames.push({ img: b, label: new Date(p.date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }), sub: w ? `${fmt(w.kg)} kg` : undefined })
      }
      const { blob, ext } = await makeTimelapse(frames, (x) => setBusy(`Gerando vídeo… ${Math.round(x * 100)}%`))
      await shareOrDownload(blob, `veyro-timelapse.${ext}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível gerar o vídeo')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <SectionTitle kicker="Fotos" title="Antes e depois" right={<button className="text-sm text-muted" onClick={() => setHidden(!hidden)}>{hidden ? 'Mostrar' : 'Ocultar'}</button>} />
      <div className="mb-3 flex gap-2">{POSES.map((p) => <Chip key={p.id} active={pose === p.id} onClick={() => setPose(p.id)}>{p.label}</Chip>)}</div>
      {list.length === 0 ? (
        <EmptyState title="Nenhuma foto" text="Mesma luz, mesma distância, mesma pose. Repita a cada 2 semanas. Ficam privadas na sua conta." />
      ) : (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[...list].reverse().map((p) => <PhotoThumb key={p.id} p={p} hidden={hidden} onClick={() => setView(p)} />)}
        </div>
      )}
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setBusy('Salvando foto…')
        try { await addPhoto(f, pose, localDate()); toast('Foto salva') } finally { setBusy(null) }
      }} />
      <div className="mb-6 flex flex-col gap-2">
        <PrimaryButton full onClick={() => input.current?.click()}>+ Foto ({POSES.find((p) => p.id === pose)?.label})</PrimaryButton>
        {list.length >= 2 && (
          <div className="flex gap-2">
            <PrimaryButton variant="ghost" full onClick={() => setCompare(true)}>Comparar</PrimaryButton>
            <PrimaryButton variant="ghost" full onClick={timelapse}>Timelapse</PrimaryButton>
          </div>
        )}
        {busy && <p className="text-center text-sm text-lime">{busy}</p>}
      </div>
      <Comparator open={compare} onClose={() => setCompare(false)} photos={list} />
      <BottomSheet open={!!view} onClose={() => setView(null)} title={view ? `${POSES.find((p) => p.id === view.pose)?.label} · ${shortDate(view.date)}` : ''}>
        {view && <><BigPhoto p={view} /><button className="mt-3 w-full py-3 text-sm text-danger" onClick={async () => { await deletePhoto(view); setView(null) }}>Apagar foto</button></>}
      </BottomSheet>
    </>
  )
}

function BigPhoto({ p }: { p: ProgressPhoto }) {
  const [u, setU] = useState<string | null>(null)
  useEffect(() => { photoUrl(p).then(setU) }, [p])
  return u ? <img src={u} alt="" className="w-full rounded-btn" /> : null
}

function Comparator({ open, onClose, photos }: { open: boolean; onClose: () => void; photos: ProgressPhoto[] }) {
  const [a, setA] = useState(0)
  const [b, setB] = useState(photos.length - 1)
  const [x, setX] = useState(50)
  const [ua, setUa] = useState<string | null>(null)
  const [ub, setUb] = useState<string | null>(null)
  useEffect(() => { setA(0); setB(Math.max(0, photos.length - 1)) }, [photos.length, open])
  useEffect(() => { if (photos[a]) photoUrl(photos[a]).then(setUa) }, [a, photos])
  useEffect(() => { if (photos[b]) photoUrl(photos[b]).then(setUb) }, [b, photos])
  return (
    <BottomSheet open={open} onClose={onClose} title="Antes × depois">
      {ua && ub && (
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-btn">
          <img src={ub} alt="depois" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${x}%` }}>
            <img src={ua} alt="antes" className="h-full max-w-none object-cover" style={{ width: `${10000 / Math.max(1, x)}%` }} />
          </div>
          <div className="absolute inset-y-0 w-0.5 bg-lime" style={{ left: `${x}%` }} />
          <span className="num absolute left-2 top-2 rounded bg-black/60 px-2 text-xs">{shortDate(photos[a].date)}</span>
          <span className="num absolute right-2 top-2 rounded bg-black/60 px-2 text-xs">{shortDate(photos[b].date)}</span>
        </div>
      )}
      <input type="range" min={0} max={100} value={x} onChange={(e) => setX(+e.target.value)} className="mt-3 w-full accent-[#C6FF3D]" />
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <label><Label className="mb-1">Antes</Label><select value={a} onChange={(e) => setA(+e.target.value)} className="h-11 w-full rounded-btn border border-border bg-surface2 px-2">{photos.map((p, i) => <option key={p.id} value={i}>{shortDate(p.date)}</option>)}</select></label>
        <label><Label className="mb-1">Depois</Label><select value={b} onChange={(e) => setB(+e.target.value)} className="h-11 w-full rounded-btn border border-border bg-surface2 px-2">{photos.map((p, i) => <option key={p.id} value={i}>{shortDate(p.date)}</option>)}</select></label>
      </div>
    </BottomSheet>
  )
}
