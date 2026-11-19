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
- [x] Etapa 4 — Ativar programa, treino do dia, treino ativo (alvo, seletores, descanso, superséries, troca, aquecimento, anilhas, notas), recordes com tela dourada e compartilhamento, resumo
- [x] Etapa 5 — Cadastro inicial, editor do plano (versões, exercícios próprios), prontidão, fadiga muscular, deload
- [x] Etapa 6 — Dieta: calculador, metas g/%, treino×descanso, diário, TACO (597 alimentos), receitas, favoritas, plano com ajuste automático e 30 dias, trocas, calorias adaptativas, lista de compras, suplementos, água, relatório
- [x] Etapa 7 — Corpo: tendência e ritmo, meta, medidas, % de gordura (Marinha), massa magra×gorda, fotos privadas (Storage), comparador, timelapse em vídeo, comparar 30/90, check-in semanal com motor de ajuste, passos
- [x] Etapa 8 — Progresso: sequência semanal, metas com previsão (7 tipos) e comemoração, calendário 12 semanas, séries por músculo, evolução por exercício (1RM, carga, volume, recordes por faixa, platô), medalhas, ajustes (perfil, barra, som), CSV
- [x] Etapa 9 — IA: função no Supabase (chave só no servidor, limite 30/dia), montar treino, adaptar treino de hoje, análise da semana, perguntas; validação zod, revisão antes de aplicar, funciona sem IA

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

## Créditos de dados
Composição de alimentos: Tabela Brasileira de Composição de Alimentos (TACO), 4ª ed. revisada e ampliada,
NEPA/UNICAMP, 2011 — reprodução permitida citando a fonte. JSON base: github.com/marcelosanto/tabela_taco (MIT);
gerado com `scripts/build_taco.py`.

## IA (Etapa 9) — publicar a função
1. SQL Editor → cole `supabase/002b_ai_usage.sql` → Run
2. Edge Functions → Deploy a new function → Via editor → nome `veyro-ai` → cole `supabase/functions/veyro-ai/index.ts` → Deploy
3. Edge Functions → Secrets → `ANTHROPIC_API_KEY` = sua chave (console.anthropic.com). Opcional: `VEYRO_MODEL`.
