-- 15 · Diretoria com acesso total (mesmos poderes do administrador)
create or replace function public.admin_total()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin','diretoria'), false)
$$;
revoke execute on function public.admin_total() from anon;

-- gestão (editar, excluir, aprovar, ver ocorrências e salários): admin, consultor e diretoria
create or replace function public.gestor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin','consultor','diretoria'), false)
$$;

create or replace function public.nf_editar(l text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when l is null then coalesce(public.meu_papel() in ('admin','consultor','diretoria','regional'),false) else public.pode_editar(l) end
$$;

-- políticas que eram só do administrador
drop policy if exists sel on public.api_chaves; create policy sel on public.api_chaves for select to authenticated using ((select public.admin_total()));
drop policy if exists ins on public.api_chaves; create policy ins on public.api_chaves for insert to authenticated with check ((select public.admin_total()));
drop policy if exists upd on public.api_chaves; create policy upd on public.api_chaves for update to authenticated using ((select public.admin_total())) with check ((select public.admin_total()));
drop policy if exists del on public.api_chaves; create policy del on public.api_chaves for delete to authenticated using ((select public.admin_total()));
drop policy if exists sel on public.api_logs; create policy sel on public.api_logs for select to authenticated using ((select public.gestor()));
drop policy if exists ins on public.estoque_cc; create policy ins on public.estoque_cc for insert to authenticated with check (coalesce(public.meu_papel() in ('admin','consultor','diretoria','regional'), false));
drop policy if exists upd on public.estoque_cc; create policy upd on public.estoque_cc for update to authenticated
  using (coalesce(public.meu_papel() in ('admin','consultor','diretoria','regional'), false)) with check (coalesce(public.meu_papel() in ('admin','consultor','diretoria','regional'), false));
drop policy if exists del on public.lojas; create policy del on public.lojas for delete to authenticated using (public.admin_total());
drop policy if exists sel on public.perfil_lojas; create policy sel on public.perfil_lojas for select to authenticated using (user_id = (select auth.uid()) or (select public.admin_total()));
drop policy if exists ins on public.perfil_lojas; create policy ins on public.perfil_lojas for insert to authenticated with check (public.admin_total());
drop policy if exists del on public.perfil_lojas; create policy del on public.perfil_lojas for delete to authenticated using (public.admin_total());
drop policy if exists sel on public.perfis; create policy sel on public.perfis for select to authenticated using (user_id = (select auth.uid()) or (select public.admin_total()));
drop policy if exists upd on public.perfis; create policy upd on public.perfis for update to authenticated using (public.admin_total()) with check (public.admin_total());

-- funções com checagem própria
do $$
declare d text;
begin
  select pg_get_functiondef('public.limpar_demo()'::regprocedure) into d;
  d := replace(d, 'if public.meu_papel() is distinct from ''admin'' then', 'if not public.admin_total() then');
  execute d;
  select pg_get_functiondef('public.registrar_contagem(jsonb)'::regprocedure) into d;
  d := replace(d, 'not in (''admin'',''consultor'',''regional'')', 'not in (''admin'',''consultor'',''diretoria'',''regional'')');
  execute d;
end $$;
