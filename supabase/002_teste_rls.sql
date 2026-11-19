-- =====================================================================
-- VEYRO · Teste de isolamento (RLS). Rode DEPOIS do 001.
-- Cria 2 usuários de teste, tenta ler/alterar dados de um pelo outro
-- e DESFAZ tudo no final (rollback). Resultado esperado: "RLS OK".
-- =====================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-a@veyro.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-b@veyro.local');

-- Usuário A cria um peso
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into public.body_weights (id, user_id, data, updated_at)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', '{"kg": 97.5}', now());

-- Usuário B tenta ver, alterar, apagar e criar em nome do A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.body_weights;
  if n <> 0 then raise exception 'FALHA: B consegue ler dados de A'; end if;

  update public.body_weights set data = '{"kg": 1}' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHA: B consegue alterar dados de A'; end if;

  delete from public.body_weights where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHA: B consegue apagar dados de A'; end if;

  begin
    insert into public.body_weights (id, user_id, data, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', '{"kg": 1}', now());
    raise exception 'FALHA: B consegue criar dados em nome de A';
  exception when insufficient_privilege or check_violation then
    null; -- bloqueado, como esperado
  end;
end $$;

-- A continua vendo o próprio dado, intacto
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare kg numeric;
begin
  select (data->>'kg')::numeric into kg from public.body_weights where id = '11111111-1111-1111-1111-111111111111';
  if kg is distinct from 97.5 then raise exception 'FALHA: dado de A foi alterado'; end if;

  -- versão antiga não sobrescreve a nova
  update public.body_weights set data = '{"kg": 50}', updated_at = now() - interval '1 day'
  where id = '11111111-1111-1111-1111-111111111111';
  select (data->>'kg')::numeric into kg from public.body_weights where id = '11111111-1111-1111-1111-111111111111';
  if kg is distinct from 97.5 then raise exception 'FALHA: versão antiga sobrescreveu a nova'; end if;
end $$;

reset role;
select 'RLS OK' as resultado;
rollback;
