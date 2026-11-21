-- =====================================================================
-- funções de acesso, gatilhos, RLS
-- =====================================================================

-- papel do usuário logado (null se inativo / sem perfil)
create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = public as $$
  select papel from public.perfis where user_id = auth.uid() and ativo
$$;

create or replace function public.ve_tudo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin','consultor','diretoria'), false)
$$;

create or replace function public.gestor() returns boolean   -- configura metas, premissas, cadastros
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin','consultor'), false)
$$;

create or replace function public.minha_loja(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfil_lojas where user_id = auth.uid() and loja_id = l)
$$;

create or replace function public.pode_ver(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ve_tudo() or (public.meu_papel() is not null and public.minha_loja(l))
$$;

-- lançamentos gerenciais da loja (vendas, CMV, DRE, RH, visitas, planos)
create or replace function public.pode_editar(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.gestor() or (public.meu_papel() in ('regional','gerente') and public.minha_loja(l))
$$;

-- lançamentos operacionais (rupturas, checklist de delivery): inclui colaborador autorizado
create or replace function public.pode_operar(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.pode_editar(l) or (public.meu_papel() = 'colaborador' and public.minha_loja(l))
$$;

-- exclusão: gerente de loja não exclui; regional exclui nas suas lojas
create or replace function public.pode_excluir(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.gestor() or (public.meu_papel() = 'regional' and public.minha_loja(l))
$$;

-- dados de pessoas (RH): colaborador não vê; diretoria vê indicadores e nine box
create or replace function public.ve_rh(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() <> 'colaborador', false) and public.pode_ver(l)
$$;

-- ocorrências disciplinares: só admin, consultor, regional e gerente da loja
create or replace function public.ve_ocorrencias(l text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.gestor() or (public.meu_papel() in ('regional','gerente') and public.minha_loja(l))
$$;

-- existe administrador? (tela de primeiro acesso)
create or replace function public.existe_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where papel = 'admin' and ativo)
$$;
grant execute on function public.existe_admin() to anon, authenticated;

-- novo usuário em auth.users → perfil. O primeiro vira admin; os demais ficam sem papel
-- (sem acesso a nada) até o admin definir, ou recebem o papel enviado pela função de gestão.
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_papel text;
begin
  if not exists (select 1 from public.perfis where papel = 'admin') then
    v_papel := 'admin';
  else
    v_papel := nullif(new.raw_app_meta_data->>'papel','');
  end if;
  insert into public.perfis (user_id, nome, email, papel)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email, v_papel)
  on conflict (user_id) do nothing;
  return new;
end $$;
create trigger trg_novo_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

-- updated_at
create or replace function public.tg_updated() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- auditoria genérica
create or replace function public.tg_historico() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.historico (tabela, registro, acao, antes, depois)
  values (tg_table_name,
          coalesce(r->>'id', r->>'loja_id' || coalesce('|'||(r->>'mes'),'') , r->>'chave', r->>'user_id'),
          tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

-- nine box: guarda cada mudança de quadrante
create or replace function public.tg_ninebox() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.desempenho is distinct from old.desempenho or new.potencial is distinct from old.potencial then
    insert into public.ninebox_historico (colaborador_id, desempenho, potencial, ant_desempenho, ant_potencial)
    values (new.id, new.desempenho, new.potencial,
            case when tg_op='UPDATE' then old.desempenho end, case when tg_op='UPDATE' then old.potencial end);
  end if;
  return null;
end $$;
create trigger trg_ninebox after insert or update on public.colaboradores
  for each row execute function public.tg_ninebox();

-- planos de ação: data de conclusão automática
create or replace function public.tg_plano() returns trigger language plpgsql as $$
begin
  if new.status = 'Concluído' and new.concluido_em is null then new.concluido_em := current_date; end if;
  if new.status <> 'Concluído' then new.concluido_em := null; new.verificado := false; end if;
  return new;
end $$;
create trigger trg_plano before insert or update on public.planos_acao
  for each row execute function public.tg_plano();

do $$
declare t text;
begin
  foreach t in array array['lojas','perfis','vendas_diarias','cmv_contagens','estoque_cc','dre_premissas_loja','dre_lancamentos',
    'colaboradores','ocorrencias','planos_acao','config','metas_vendas','indicadores_mensais','rh_movimentos','lideranca'] loop
    execute format('create trigger trg_upd before update on public.%I for each row execute function public.tg_updated()', t)
      ;
  end loop;
exception when others then
  -- tabelas sem updated_at não entram
  raise;
end $$;
