# VEYRO · Personal Training Intelligence

Web app (PWA) de treino, dieta e evolução. React + Vite + TypeScript + Tailwind + Dexie (IndexedDB) + Supabase.

## Rodar no computador
```bash
npm install
npm run dev        # abre em http://localhost:5173
npm test           # testes da lógica (Vitest)
npm run build      # gera a pasta dist/ para hospedar
```

## Status
- [x] Etapa 1 — Fundação + marca: design system VEYRO, 5 abas, /_dev/ui, banco local (schema completo), seed (57 exercícios, 31 alimentos, 7 programas), PWA
- [x] Etapa 2 — Contas (e-mail e senha), RLS, sincronização local-first, sair/exportar/excluir conta
- [x] Etapa 3 — Cérebro do treino: alvo de hoje, retorno, pausas, prontidão, recordes, volume, tendência do peso, aquecimento, anilhas (47 testes)
- [ ] Etapa 4 — Treino ativo
- [ ] Etapa 5 — Onboarding, Hoje, Recuperação, Programas, editor do plano
- [ ] Etapa 6 — Dieta completa
- [ ] Etapa 7 — Corpo e evolução
- [ ] Etapa 8 — Progresso, metas, polimento
- [ ] Etapa 9 — IA (opcional)

## Estrutura
- `src/ui` — design system (marca, primitivos, seletor de rolagem, gráficos, folhas, timer)
- `src/db` — schema Dexie (todas as tabelas com user_id/updated_at/deleted_at) e seed global
- `src/domain` — lógica pura testada
- `src/pages` — telas

## Supabase (uma vez)
1. SQL Editor → cole `supabase/001_veyro_init.sql` → Run
2. SQL Editor → cole `supabase/002_teste_rls.sql` → Run → deve terminar sem erro ("RLS OK")
3. Authentication → Sign In / Providers → Email → desligue "Confirm email" (opcional, uso pessoal)
4. Authentication → URL Configuration → Site URL = endereço onde o app está hospedado
5. Crie `.env.local` a partir de `.env.example`
