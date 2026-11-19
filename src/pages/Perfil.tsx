import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../ui/Header'
import { Card, Label, PrimaryButton, SectionTitle } from '../ui/primitives'
import { BottomSheet, useToast } from '../ui/overlays'
import { useSession } from '../store/session'
import { exportUserData, syncNow } from '../sync/engine'
import { excluirConta, sair, traduzErro } from '../lib/auth'

function tempoDesde(iso?: string) {
  if (!iso) return 'nunca'
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'agora há pouco'
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  return `há ${Math.round(s / 3600)} h`
}

export default function Perfil() {
  const { user, sync, localMode } = useSession()
  const toast = useToast((s) => s.show)
  const [confirmSair, setConfirmSair] = useState<number | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)

  const status =
    localMode ? 'Prévia local · sem conta' :
    sync.state === 'syncing' ? 'Sincronizando…' :
    sync.state === 'offline' ? `Offline · ${sync.pending} alteraç${sync.pending === 1 ? 'ão' : 'ões'} pendente${sync.pending === 1 ? '' : 's'}` :
    sync.state === 'error' ? `Erro ao sincronizar` :
    sync.pending ? `${sync.pending} alteraç${sync.pending === 1 ? 'ão' : 'ões'} pendente${sync.pending === 1 ? '' : 's'}` :
    `Sincronizado ${tempoDesde(sync.lastAt)}`
  const dot = sync.state === 'error' ? 'bg-danger' : sync.state === 'offline' || sync.pending ? 'bg-gold' : 'bg-lime'

  async function doSair(forcar = false) {
    setBusy(true)
    try {
      const r = await sair({ forcar })
      if (r.pendentes) setConfirmSair(r.pendentes)
    } catch (e) {
      toast(traduzErro(e))
    } finally {
      setBusy(false)
    }
  }

  async function doExportar() {
    if (!user) return
    const data = await exportUserData(user.id)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `veyro-dados-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  async function doExcluir() {
    if (!user) return
    setBusy(true)
    try {
      await excluirConta(user.id)
    } catch (e) {
      toast(traduzErro(e))
      setBusy(false)
    }
  }

  return (
    <>
      <Header title="Perfil" />
      <Card className="mb-4">
        <Label>Conta</Label>
        <div className="mt-1 text-lg font-semibold">{user?.email}</div>
        <button
          className="mt-3 flex items-center gap-2 text-sm text-muted"
          onClick={() => !localMode && syncNow()}
          aria-label="Sincronizar agora"
        >
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {status}
        </button>
        {sync.state === 'error' && sync.error && <div className="mt-2 text-xs text-danger/80">{sync.error}</div>}
      </Card>

      <SectionTitle kicker="Seus dados" title="Privacidade" />
      <div className="mb-6 flex flex-col gap-2">
        <PrimaryButton variant="ghost" full onClick={doExportar}>Exportar meus dados (JSON)</PrimaryButton>
        {!localMode && <PrimaryButton variant="ghost" full disabled={busy} onClick={() => doSair()}>Sair da conta</PrimaryButton>}
        {!localMode && (
          <button className="mt-2 h-12 rounded-btn text-sm font-semibold text-danger" onClick={() => setConfirmExcluir(true)}>
            Excluir conta
          </button>
        )}
      </div>

      <Link to="/_dev/ui" className="label block text-center">Design system</Link>

      <BottomSheet open={confirmSair !== null} onClose={() => setConfirmSair(null)} title="Alterações não enviadas">
        <p className="mb-5 text-sm text-muted">
          {confirmSair} alteraç{confirmSair === 1 ? 'ão ainda não foi enviada' : 'ões ainda não foram enviadas'} para a nuvem (provavelmente sem internet).
          Se sair agora, elas serão perdidas.
        </p>
        <div className="flex flex-col gap-2">
          <PrimaryButton full onClick={() => { setConfirmSair(null); syncNow() }}>Tentar sincronizar</PrimaryButton>
          <PrimaryButton variant="ghost" full onClick={() => { setConfirmSair(null); doSair(true) }}>Sair mesmo assim</PrimaryButton>
        </div>
      </BottomSheet>

      <BottomSheet open={confirmExcluir} onClose={() => setConfirmExcluir(false)} title="Excluir conta">
        <p className="mb-4 text-sm text-muted">
          Isso apaga para sempre seu treino, dieta, histórico, recordes, medidas e fotos, neste aparelho e na nuvem.
          Se quiser, exporte seus dados antes.
        </p>
        <label className="label mb-1.5 block">Digite EXCLUIR para confirmar</label>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoCapitalize="characters"
          className="mb-4 h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-text outline-none focus:border-danger"
        />
        <button
          disabled={texto.trim().toUpperCase() !== 'EXCLUIR' || busy}
          onClick={doExcluir}
          className="h-[52px] w-full rounded-btn bg-danger font-semibold text-white disabled:opacity-30"
        >
          {busy ? 'Excluindo…' : 'Excluir conta para sempre'}
        </button>
      </BottomSheet>
    </>
  )
}
