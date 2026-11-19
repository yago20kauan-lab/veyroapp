/** Timelapse no aparelho: canvas + MediaRecorder (MP4 no iPhone, WebM em outros). As fotos não saem do aparelho. */
export type Frame = { img: Blob; label: string; sub?: string }

function pickMime() {
  const opts = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
  return opts.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? ''
}

function drawSymbol(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, alpha = 1) {
  g.save()
  g.globalAlpha = alpha
  g.translate(cx - 56 * s, cy - 50 * s)
  g.scale(s, s)
  g.fillStyle = '#F5F7FA'
  g.beginPath(); g.moveTo(0, 30); g.lineTo(22, 30); g.lineTo(61, 100); g.lineTo(39, 100); g.closePath(); g.fill()
  g.fillStyle = '#C6FF3D'
  g.beginPath(); g.moveTo(39, 100); g.lineTo(61, 100); g.lineTo(112, 0); g.lineTo(90, 0); g.closePath(); g.fill()
  g.restore()
}

export async function makeTimelapse(frames: Frame[], onProgress?: (p: number) => void, secPerPhoto = 0.45): Promise<{ blob: Blob; ext: string }> {
  const W = 720
  const H = 1280
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const imgs = await Promise.all(frames.map((f) => createImageBitmap(f.img)))
  const mime = pickMime()
  if (!mime) throw new Error('Este navegador não grava vídeo')
  const stream = c.captureStream(30)
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<void>((res) => (rec.onstop = () => res()))
  rec.start(250)

  const fps = 30
  const wait = () => new Promise((r) => setTimeout(r, 1000 / fps))
  const bg = () => { g.fillStyle = '#0B0D10'; g.fillRect(0, 0, W, H) }
  const cover = (b: ImageBitmap, alpha = 1) => {
    const k = Math.max(W / b.width, H / b.height)
    const w = b.width * k
    const h = b.height * k
    g.globalAlpha = alpha
    g.drawImage(b, (W - w) / 2, (H - h) / 2, w, h)
    g.globalAlpha = 1
  }
  // abertura
  for (let i = 0; i < 20; i++) { bg(); drawSymbol(g, W / 2, H / 2 - 40, 1.6, i / 20); await wait() }
  const per = Math.round(secPerPhoto * fps)
  for (let n = 0; n < imgs.length; n++) {
    for (let i = 0; i < per; i++) {
      bg()
      if (n > 0 && i < 6) cover(imgs[n - 1])
      cover(imgs[n], n > 0 && i < 6 ? i / 6 : 1)
      const grd = g.createLinearGradient(0, H - 260, 0, H)
      grd.addColorStop(0, 'rgba(11,13,16,0)')
      grd.addColorStop(1, 'rgba(11,13,16,0.9)')
      g.fillStyle = grd
      g.fillRect(0, H - 260, W, 260)
      g.fillStyle = '#F5F7FA'
      g.font = '800 54px Unbounded, sans-serif'
      g.textAlign = 'left'
      g.fillText(frames[n].label, 40, H - 110)
      if (frames[n].sub) { g.fillStyle = '#C6FF3D'; g.font = '600 34px Inter, sans-serif'; g.fillText(frames[n].sub!, 40, H - 56) }
      drawSymbol(g, W - 80, H - 100, 0.5)
      await wait()
    }
    onProgress?.((n + 1) / imgs.length)
  }
  // fechamento
  for (let i = 0; i < 24; i++) { bg(); drawSymbol(g, W / 2, H / 2 - 60, 1.6); g.fillStyle = '#F5F7FA'; g.font = '800 60px Unbounded, sans-serif'; g.textAlign = 'center'; g.fillText('VEYRO', W / 2, H / 2 + 110); await wait() }
  rec.stop()
  await done
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.includes('mp4') ? 'mp4' : 'webm' }
}

export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file] }).catch(() => {})
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}
