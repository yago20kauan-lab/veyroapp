-- =====================================================================
-- VEYRO · Etapa 2 · Banco de dados com isolamento por usuário (RLS)
-- Cole TUDO no Supabase → SQL Editor → Run. Pode rodar mais de uma vez.
-- =====================================================================

-- 1) Regra de sincronização: carimba a hora do servidor e, num conflito,
--    mantém a versão mais recente (updated_at). user_id nunca muda.
create or replace function public.veyro_lww()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := now();
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id não pode ser alterado';
    end if;
    if new.updated_at < old.updated_at then
      return null; -- a versão do servidor é mais nova: ignora a antiga
    end if;
  end if;
  return new;
end;
$$;

-- 2) Tabelas do usuário. Todas com a mesma estrutura:
--    id (uuid do aparelho) · user_id (dono) · data (registro completo em jsonb)
--    updated_at (hora no aparelho) · deleted_at (exclusão lógica)
--    server_updated_at (cursor da sincronização)
do $$
declare
  t text;
  tabelas text[] := array[
    'profiles','routines','phases','sessions','sets','records','body_weights','measurements','photos','cardio',
    'exercises','foods','recipes','favorite_meals','diet_targets','diet_plans','planned_days','food_logs','day_notes',
    'water','supplements','supplement_logs','shopping_lists','goals','readiness','checkins','plan_versions'
  ];
begin
  foreach t in array tabelas loop
    execute format($f$
      create table if not exists public.%1$I (
        id uuid primary key,
        user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
        data jsonb not null,
        updated_at timestamptz not null,
        deleted_at timestamptz,
        server_updated_at timestamptz not null default now()
      );
      create index if not exists %2$I on public.%1$I (user_id, server_updated_at);
      alter table public.%1$I enable row level security;
      alter table public.%1$I force row level security;

      drop policy if exists "dono_le" on public.%1$I;
      drop policy if exists "dono_cria" on public.%1$I;
      drop policy if exists "dono_altera" on public.%1$I;
      drop policy if exists "dono_apaga" on public.%1$I;
      create policy "dono_le"     on public.%1$I for select to authenticated using ((select auth.uid()) = user_id);
      create policy "dono_cria"   on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id);
      create policy "dono_altera" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
      create policy "dono_apaga"  on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id);

      revoke all on public.%1$I from anon;
      grant select, insert, update, delete on public.%1$I to authenticated;

      drop trigger if exists veyro_lww on public.%1$I;
      create trigger veyro_lww before insert or update on public.%1$I
        for each row execute function public.veyro_lww();
    $f$, t, t || '_user_sync_idx');
  end loop;
end
$$;

-- 3) Fotos de progresso: bucket privado, cada usuário só na pasta {user_id}/...
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "fotos_dono_le" on storage.objects;
drop policy if exists "fotos_dono_cria" on storage.objects;
drop policy if exists "fotos_dono_altera" on storage.objects;
drop policy if exists "fotos_dono_apaga" on storage.objects;
create policy "fotos_dono_le" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos_dono_cria" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos_dono_altera" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos_dono_apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 4) Excluir conta (dentro do app): apaga o usuário, e o "on delete cascade"
--    leva junto todos os dados dele. As fotos são apagadas pelo app antes,
--    pela API do Storage (o Supabase não permite apagar arquivos via SQL).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
