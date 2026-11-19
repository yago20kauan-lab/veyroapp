import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase, LOCAL_USER_ID } from '../lib/supabase'

type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

type Session = {
  ready: boolean
  user: (Pick<User, 'id' | 'email'> & { name?: string }) | null
  localMode: boolean
  /** primeira sincronização após entrar já terminou (para não mostrar o cadastro antes de baixar o perfil) */
  bootSynced: boolean
  sync: { state: SyncState; lastAt?: string; pending: number; error?: string }
  setUser: (u: (Pick<User, 'id' | 'email'> & { name?: string }) | null) => void
  setSync: (s: Partial<Session['sync']>) => void
}

export const useSession = create<Session>((set) => ({
  ready: !supabase,
  user: supabase ? null : { id: LOCAL_USER_ID, email: 'prévia local', name: 'Atleta' },
  localMode: !supabase,
  bootSynced: !supabase,
  sync: { state: 'idle', pending: 0 },
  setUser: (u) => set({ user: u, ready: true }),
  setSync: (s) => set((st) => ({ sync: { ...st.sync, ...s } })),
}))

export const currentUserId = () => useSession.getState().user?.id ?? LOCAL_USER_ID
