-- VEYRO · Etapa 9 · Limite de uso da IA (30 chamadas por dia por usuário)
-- Cole no Supabase → SQL Editor → Run.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
drop policy if exists "dono_le_uso" on public.ai_usage;
create policy "dono_le_uso" on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.ai_usage from anon;
grant select on public.ai_usage to authenticated;

-- incrementa e devolve o total do dia (chamada pela função, com a identidade do usuário)
create or replace function public.ai_bump_usage()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  insert into public.ai_usage (user_id, day, count) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into n;
  return n;
end;
$$;
revoke all on function public.ai_bump_usage() from public, anon;
grant execute on function public.ai_bump_usage() to authenticated;
