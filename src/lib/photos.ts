import { db, type ProgressPhoto } from '../db/schema'
import { save } from '../db/repo'
import { supabase } from './supabase'
import { currentUserId } from '../store/session'

/** Reduz para no máximo 1080 px e JPEG 0,8 (economiza espaço e upload). */
export async function compressImage(file: Blob, max = 1080): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.8))
}

/** Salva no aparelho e envia para o Storage privado (pasta do usuário). */
export async function addPhoto(file: File, pose: ProgressPhoto['pose'], date: string) {
  const blob = await compressImage(file)
  const row = await save('photos', { date, pose, blob } as unknown as ProgressPhoto)
  if (supabase) {
    const path = `${currentUserId()}/${row.id}.jpg`
    const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
    if (!error) await save('photos', { ...row, remotePath: path })
  }
  return row
}

export async function deletePhoto(p: ProgressPhoto) {
  const { remove } = await import('../db/repo')
  await remove('photos', p.id)
  if (supabase && p.remotePath) await supabase.storage.from('photos').remove([p.remotePath])
}

const urlCache = new Map<string, string>()
/** URL para exibir: blob local, ou baixa do Storage (outro aparelho) e guarda localmente. */
export async function photoUrl(p: ProgressPhoto): Promise<string | null> {
  if (urlCache.has(p.id)) return urlCache.get(p.id)!
  let blob = p.blob
  if (!blob && p.remotePath && supabase) {
    const { data } = await supabase.storage.from('photos').download(p.remotePath)
    if (data) {
      blob = data
      await db.photos.update(p.id, { blob: data })
    }
  }
  if (!blob) return null
  const u = URL.createObjectURL(blob)
  urlCache.set(p.id, u)
  return u
}

export async function photoBlob(p: ProgressPhoto): Promise<Blob | null> {
  const u = await photoUrl(p)
  if (!u) return null
  return (await fetch(u)).blob()
}
