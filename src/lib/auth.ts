import { supabase } from './supabase'
import { clearLocalUserData, syncNow } from '../sync/engine'
import { db } from '../db/schema'

const msgs: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).'],
  [/user already registered/i, 'Já existe uma conta com esse e-mail.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 8 caracteres.'],
  [/rate limit|too many/i, 'Muitas tentativas. Espere um pouco e tente de novo.'],
  [/failed to fetch|network/i, 'Sem conexão com o servidor. Verifique a internet.'],
  [/invalid email|unable to validate email/i, 'E-mail inválido.'],
]
export function traduzErro(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return msgs.find(([r]) => r.test(m))?.[1] ?? m
}

function sb() {
  if (!supabase) throw new Error('Login indisponível na prévia local.')
  return supabase
}

export async function entrar(email: string, senha: string) {
  const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password: senha })
  if (error) throw error
}

export async function criarConta(email: string, senha: string, nome: string) {
  const { data, error } = await sb().auth.signUp({
    email: email.trim(),
    password: senha,
    options: { data: { name: nome.trim() }, emailRedirectTo: location.origin + location.pathname },
  })
  if (error) throw error
  return { precisaConfirmar: !data.session }
}

export async function esqueciSenha(email: string) {
  const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname })
  if (error) throw error
}

export async function novaSenha(senha: string) {
  const { error } = await sb().auth.updateUser({ password: senha })
  if (error) throw error
}

/** Sair: tenta enviar pendências e limpa os dados deste aparelho. */
export async function sair({ forcar = false } = {}) {
  await syncNow().catch(() => {})
  const pend = await db.outbox.count()
  if (pend > 0 && !forcar) return { pendentes: pend }
  await clearLocalUserData()
  await sb().auth.signOut()
  return { pendentes: 0 }
}

/** Excluir conta: apaga as fotos no Storage, depois o usuário (e, em cascata, todos os dados). */
export async function excluirConta(userId: string) {
  const client = sb()
  const { data: files } = await client.storage.from('photos').list(userId, { limit: 1000 })
  if (files?.length) await client.storage.from('photos').remove(files.map((f) => `${userId}/${f.name}`))
  const { error } = await client.rpc('delete_my_account')
  if (error) throw error
  await clearLocalUserData()
  await client.auth.signOut({ scope: 'local' })
}
