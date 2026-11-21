import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { IconBody, IconChart, IconDumbbell, IconFood, IconHome } from './ui/icons'
import { ToastHost } from './ui/overlays'
import { haptic } from './lib/haptics'
import Hoje from './pages/Hoje'
import Treinar from './pages/Treinar'
import Corpo from './pages/Corpo'
import Dieta from './pages/Dieta'
import Progresso, { ExerciseProgress } from './pages/Progresso'
import DevUI from './pages/DevUI'
import Perfil from './pages/Perfil'
import Auth from './pages/Auth'
import Workout from './pages/Workout'
import Summary from './pages/Summary'
import Onboarding from './pages/Onboarding'
import Recuperacao from './pages/Recuperacao'
import PlanEditor, { RoutineEditor } from './pages/PlanEditor'
import Metas from './pages/diet/Metas'
import PlanoAlimentar from './pages/diet/PlanoAlimentar'
import Compras from './pages/diet/Compras'
import Suplementos from './pages/diet/Suplementos'
import Alimentos from './pages/diet/Alimentos'
import Relatorio from './pages/diet/Relatorio'
import AdicionarAlimento from './pages/diet/AdicionarAlimento'
import DietaSugerida from './pages/diet/DietaSugerida'
import DietasProntas from './pages/diet/DietasProntas'
import DefinicoesDiario from './pages/diet/DefinicoesDiario'
import Comparar from './pages/Comparar'
import Checkin from './pages/Checkin'
import IA from './pages/IA'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useSession } from './store/session'
import { clearLocalUserData, startAutoSync, syncNow } from './sync/engine'
import { db } from './db/schema'
import { VeyroLoader } from './ui/brand'

const tabs = [
  { to: '/', label: 'Hoje', Icon: IconHome },
  { to: '/treinar', label: 'Treinar', Icon: IconDumbbell },
  { to: '/corpo', label: 'Corpo', Icon: IconBody },
  { to: '/dieta', label: 'Dieta', Icon: IconFood },
  { to: '/progresso', label: 'Progresso', Icon: IconChart },
]

const isFullScreen = (path: string) => path.startsWith('/treino/') || path.startsWith('/resumo/') || path.startsWith('/plano/') || path === '/checkin' || path.startsWith('/dieta/adicionar/') || path === '/dieta/definicoes' || path === '/dieta/metas' || path === '/dieta/plano' || path === '/dieta/sugestao' || path === '/dieta/prontas'

function TabBar() {
  const loc = useLocation()
  if (isFullScreen(loc.pathname)) return null
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/90 backdrop-blur-xl" aria-label="Navegação principal">
      <div className="mx-auto flex max-w-md">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => haptic('light')}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 pb-1.5 pt-2.5 text-[10px] font-semibold transition-colors ${isActive ? 'text-lime' : 'text-muted'}`
            }
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function Screens() {
  const loc = useLocation()
  if (isFullScreen(loc.pathname)) {
    return (
      <Routes location={loc}>
        <Route path="/treino/:id" element={<Workout />} />
        <Route path="/resumo/:id" element={<Summary />} />
        <Route path="/checkin" element={<Checkin />} />
        <Route path="/dieta/adicionar/:date/:meal" element={<AdicionarAlimento />} />
        <Route path="/dieta/definicoes" element={<div className="pt-safe mx-auto max-w-md px-4"><DefinicoesDiario /></div>} />
        <Route path="/dieta/metas" element={<div className="pt-safe mx-auto max-w-md px-4"><Metas /></div>} />
        <Route path="/dieta/plano" element={<div className="pt-safe mx-auto max-w-md px-4"><PlanoAlimentar /></div>} />
        <Route path="/dieta/sugestao" element={<div className="pt-safe mx-auto max-w-md px-4"><DietaSugerida /></div>} />
        <Route path="/dieta/prontas" element={<div className="pt-safe mx-auto max-w-md px-4"><DietasProntas /></div>} />
        <Route path="/plano/:id" element={<div className="pt-safe mx-auto max-w-md px-4"><RoutineEditor /></div>} />
      </Routes>
    )
  }
  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={loc.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="pt-safe mx-auto max-w-md px-4 pb-28"
      >
        <Routes location={loc}>
          <Route path="/" element={<Hoje />} />
          <Route path="/treinar" element={<Treinar />} />
          <Route path="/corpo" element={<Corpo />} />
          <Route path="/dieta" element={<Dieta />} />
          <Route path="/progresso" element={<Progresso />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/recuperacao" element={<Recuperacao />} />
          <Route path="/plano" element={<PlanEditor />} />
          <Route path="/comparar" element={<Comparar />} />
          <Route path="/ia" element={<IA />} />
          <Route path="/progresso/ex/:id" element={<ExerciseProgress />} />
          <Route path="/dieta/compras" element={<Compras />} />
          <Route path="/dieta/suplementos" element={<Suplementos />} />
          <Route path="/dieta/alimentos" element={<Alimentos />} />
          <Route path="/dieta/relatorio" element={<Relatorio />} />
          <Route path="/checkin" element={<Checkin />} />
        <Route path="/dieta/adicionar/:date/:meal" element={<AdicionarAlimento />} />
        <Route path="/dieta/definicoes" element={<div className="pt-safe mx-auto max-w-md px-4"><DefinicoesDiario /></div>} />
        <Route path="/dieta/metas" element={<div className="pt-safe mx-auto max-w-md px-4"><Metas /></div>} />
        <Route path="/dieta/plano" element={<div className="pt-safe mx-auto max-w-md px-4"><PlanoAlimentar /></div>} />
        <Route path="/dieta/sugestao" element={<div className="pt-safe mx-auto max-w-md px-4"><DietaSugerida /></div>} />
        <Route path="/dieta/prontas" element={<div className="pt-safe mx-auto max-w-md px-4"><DietasProntas /></div>} />
        <Route path="/plano/:id" element={<RoutineEditor />} />
          <Route path="/_dev/ui" element={<DevUI />} />
        </Routes>
      </motion.main>
    </AnimatePresence>
  )
}

/** Se outra pessoa entrar neste aparelho, os dados locais do usuário anterior são apagados antes. */
async function onUserChange(id: string) {
  const last = (await db.meta.get('lastUserId'))?.value
  if (last && last !== id) await clearLocalUserData()
  await db.meta.put({ key: 'lastUserId', value: id })
}

function useAuthListener() {
  const setUser = useSession((s) => s.setUser)
  const [recovery, setRecovery] = useState(false)
  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      const u = session?.user
      if (u) {
        onUserChange(u.id).then(() => setUser({ id: u.id, email: u.email, name: (u.user_metadata as { name?: string })?.name }))
      } else {
        setUser(null)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [setUser])
  return recovery
}

export default function App() {
  const { ready, user, localMode, bootSynced } = useSession()
  const recovery = useAuthListener()
  const profileState = useLiveQuery(async () => ({ p: user ? await db.profiles.get(user.id) : undefined }), [user?.id])
  const [skipOnboarding, setSkipOnboarding] = useState(false)
  const [waitedEnough, setWaitedEnough] = useState(false)
  // nunca prender o app na tela de sincronizar: com dados no aparelho entra na hora; sem dados, espera no máximo 6 s
  useEffect(() => {
    const t = setTimeout(() => setWaitedEnough(true), 6000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (user && !localMode) return startAutoSync()
  }, [user, localMode])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <VeyroLoader size={48} />
      </div>
    )
  }
  if (recovery || !user) {
    return (
      <>
        <ToastHost />
        <Auth recovery={recovery} />
      </>
    )
  }
  if (!profileState || (!bootSynced && !profileState.p && !waitedEnough)) {
    return (
      <div className="flex h-full items-center justify-center">
        <VeyroLoader size={48} label="Sincronizando" />
      </div>
    )
  }
  if (!bootSynced && !profileState.p) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <VeyroLoader size={40} />
        <p className="text-sm text-muted">A sincronização está demorando. Verifique a internet.</p>
        <button className="h-11 rounded-full bg-lime px-6 font-semibold text-onlime" onClick={() => void syncNow()}>Tentar de novo</button>
      </div>
    )
  }
  if (!skipOnboarding && !profileState.p?.settings?.onboarded) {
    return (
      <>
        <ToastHost />
        <Onboarding onDone={() => setSkipOnboarding(true)} />
      </>
    )
  }
  return (
    <HashRouter>
      <ToastHost />
      <Screens />
      <TabBar />
    </HashRouter>
  )
}
