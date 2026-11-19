// VEYRO · Etapa 9 · Função da IA (Supabase Edge Function, Deno)
// A chave da Anthropic fica SÓ aqui, como segredo ANTHROPIC_API_KEY. Nunca no app.
// O app envia só um resumo anonimizado (sem nome, e-mail, fotos ou medidas brutas).
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = Deno.env.get('VEYRO_MODEL') ?? 'claude-sonnet-5-5'
const DAILY_LIMIT = 30
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SAFETY = `Regras: você é o coach do app VEYRO (treino, dieta e evolução), em português do Brasil, direto e curto.
Nunca dê diagnóstico médico. Se houver dor aguda, lesão ou sintoma, recomende procurar um profissional e só sugira adaptações conservadoras.
Nunca sugira menos de 1600 kcal/dia para homens ou 1300 kcal/dia para mulheres sem acompanhamento profissional.
Não invente dados: use apenas o resumo enviado.`

const PROMPTS: Record<string, string> = {
  build: `${SAFETY}
Monte uma rotina semanal de musculação. Use SOMENTE exercícios da lista "biblioteca" (pelo id exato).
Responda APENAS com JSON válido, sem texto fora dele, no formato:
{"name": string, "notes": string, "routines": [{"name": string, "weekday": 0-6 (0=domingo), "items": [{"exerciseId": string, "sets": 1-6, "repMin": 1-30, "repMax": 1-30, "restSec": 30-300}]}]}`,
  adapt: `${SAFETY}
Adapte o treino de hoje à situação descrita. Use SOMENTE exercícios da "biblioteca" (id exato).
Responda APENAS com JSON: {"notes": string, "items": [{"exerciseId": string, "sets": 1-6, "repMin": 1-30, "repMax": 1-30, "restSec": 0-300}]}`,
  weekly: `${SAFETY}
Analise a semana a partir do resumo. Responda APENAS com JSON: {"good": string, "stuck": string, "adjust": string} (uma frase cada, específica e acionável).`,
  ask: `${SAFETY}
Responda à pergunta usando apenas os "fatos" calculados do histórico. Se faltar dado, diga o que falta. Máximo 4 frases.
Responda APENAS com JSON: {"answer": string}`,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    const auth = req.headers.get('Authorization') ?? ''
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await sb.auth.getUser()
    if (!u?.user) return json({ error: 'não autenticado' }, 401)

    const { kind, payload } = await req.json()
    if (!PROMPTS[kind]) return json({ error: 'tipo inválido' }, 400)
    const body = JSON.stringify(payload ?? {})
    if (body.length > 60_000) return json({ error: 'resumo grande demais' }, 413)

    const { data: count, error: e1 } = await sb.rpc('ai_bump_usage')
    if (e1) return json({ error: 'limite indisponível: rode o SQL 002b_ai_usage.sql' }, 500)
    if ((count as number) > DAILY_LIMIT) return json({ error: `Limite de ${DAILY_LIMIT} usos por dia atingido. Volta amanhã.` }, 429)

    const key = Deno.env.get('ANTHROPIC_API_KEY')
    if (!key) return json({ error: 'ANTHROPIC_API_KEY não configurada na função' }, 500)
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, system: PROMPTS[kind], messages: [{ role: 'user', content: body }] }),
    })
    if (!r.ok) return json({ error: `IA indisponível (${r.status})` }, 502)
    const out = await r.json()
    const text: string = out.content?.map((c: { text?: string }) => c.text ?? '').join('') ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return json({ error: 'resposta da IA sem JSON' }, 502)
    return json({ result: JSON.parse(match[0]), usedToday: count })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'erro' }, 500)
  }
})
