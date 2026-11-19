import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { VeyroMark } from '../ui/brand'
import { PrimaryButton } from '../ui/primitives'
import { criarConta, entrar, esqueciSenha, novaSenha, traduzErro } from '../lib/auth'

type Mode = 'entrar' | 'criar' | 'esqueci' | 'nova-senha'

function Field({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      <input
        {...p}
        className="h-[52px] w-full rounded-btn border border-border bg-surface2 px-4 text-base text-text outline-none transition placeholder:text-muted/50 focus:border-lime"
      />
    </label>
  )
}

export default function Auth({ recovery = false }: { recovery?: boolean }) {
  const [mode, setMode] = useState<Mode>(recovery ? 'nova-senha' : 'entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setAviso(null)
    if ((mode === 'criar' || mode === 'nova-senha') && senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if ((mode === 'criar' || mode === 'nova-senha') && senha !== senha2) return setErro('As senhas não conferem.')
    if (mode === 'criar' && !nome.trim()) return setErro('Diga como quer ser chamado.')
    setBusy(true)
    try {
      if (mode === 'entrar') await entrar(email, senha)
      if (mode === 'criar') {
        const r = await criarConta(email, senha, nome)
        if (r.precisaConfirmar) setAviso('Conta criada! Enviamos um link de confirmação para o seu e-mail.')
      }
      if (mode === 'esqueci') {
        await esqueciSenha(email)
        setAviso('Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha.')
      }
      if (mode === 'nova-senha') {
        await novaSenha(senha)
        location.hash = '#/'
        location.reload()
      }
    } catch (err) {
      setErro(traduzErro(err))
    } finally {
      setBusy(false)
    }
  }

  const title = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha', 'nova-senha': 'Nova senha' }[mode]

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-md flex-col px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center pb-8 pt-16"
      >
        <VeyroMark size={56} />
        <div className="mt-5 font-display text-4xl font-extrabold tracking-brand">VEYRO</div>
        <div className="mt-3 flex items-center gap-3">
          <span className="h-[2px] w-6 bg-lime" />
          <span className="whitespace-nowrap text-[9px] font-semibold tracking-[0.22em] text-muted">PERSONAL TRAINING INTELLIGENCE</span>
          <span className="h-[2px] w-6 bg-lime" />
        </div>
      </motion.div>

      {(mode === 'entrar' || mode === 'criar') && (
        <div className="mb-6 grid grid-cols-2 rounded-btn border border-border bg-surface p-1">
          {(['entrar', 'criar'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setErro(null); setAviso(null) }}
              className={`h-11 rounded-[10px] text-sm font-semibold transition ${mode === m ? 'bg-lime text-onlime' : 'text-muted'}`}
            >
              {m === 'entrar' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>
      )}
      {(mode === 'esqueci' || mode === 'nova-senha') && <h1 className="mb-6 font-display text-2xl font-bold">{title}</h1>}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {mode === 'criar' && <Field label="Nome" autoComplete="given-name" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como quer ser chamado" />}
        {mode !== 'nova-senha' && (
          <Field label="E-mail" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
        )}
        {mode !== 'esqueci' && (
          <Field
            label={mode === 'nova-senha' ? 'Nova senha' : 'Senha'}
            type="password"
            autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={mode === 'entrar' ? '••••••••' : 'Mínimo de 8 caracteres'}
          />
        )}
        {(mode === 'criar' || mode === 'nova-senha') && (
          <Field label="Confirmar senha" type="password" autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} placeholder="Repita a senha" />
        )}

        {erro && <div role="alert" className="rounded-btn border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{erro}</div>}
        {aviso && <div role="status" className="rounded-btn border border-lime/40 bg-lime/10 px-4 py-3 text-sm text-lime">{aviso}</div>}

        <PrimaryButton type="submit" full disabled={busy} className="mt-2">
          {busy ? 'Aguarde…' : { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Enviar link', 'nova-senha': 'Salvar nova senha' }[mode]}
        </PrimaryButton>
      </form>

      <div className="mt-5 text-center text-sm">
        {mode === 'entrar' && (
          <button type="button" className="text-muted underline-offset-4 hover:underline" onClick={() => { setMode('esqueci'); setErro(null) }}>
            Esqueci minha senha
          </button>
        )}
        {mode === 'esqueci' && (
          <button type="button" className="text-muted" onClick={() => { setMode('entrar'); setAviso(null) }}>
            ← Voltar para entrar
          </button>
        )}
      </div>

      <p className="mt-auto pb-6 pt-10 text-center text-xs text-muted/70">
        Seus dados ficam na sua conta. Ninguém mais tem acesso ao seu treino, dieta ou evolução.
      </p>
    </div>
  )
}
