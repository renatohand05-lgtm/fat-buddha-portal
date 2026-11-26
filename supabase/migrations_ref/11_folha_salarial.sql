-- 11 · Folha salarial: equipe real, matriz (escritório e produção), contrato, cargo da folha,
--      fim de experiência, valores salariais em tabela restrita e alerta de fim de experiência.
-- Chave PIX e conta bancária não são guardadas no portal.

-- ---------- colaboradores ----------
alter table public.colaboradores
  alter column loja_id drop not null,
  alter column admissao drop not null,
  add column if not exists setor text not null default 'loja',
  add column if not exists contrato text,
  add column if not exists cargo_folha text,
  add column if not exists fim_experiencia date;
alter table public.colaboradores
  add constraint colaboradores_setor_chk check (setor in ('loja','escritorio','producao')),
  add constraint colaboradores_contrato_chk check (contrato is null or contrato in ('CLT','PJ')),
  add constraint colaboradores_setor_loja_chk check ((setor = 'loja') = (loja_id is not null));
-- leitura e edição seguem as regras de RH; sem loja (matriz) = só quem vê a rede toda (ve_rh(null) = ve_tudo)

-- ---------- valores da folha (restritos) ----------
create table if not exists public.colaboradores_folha (
  colaborador_id bigint primary key references public.colaboradores(id) on delete cascade,
  salario numeric check (salario >= 0),
  vt numeric check (vt >= 0),
  tipo_vt text,
  plano numeric check (plano >= 0),
  margem numeric check (margem >= 0),
  competencia text check (competencia ~ '^\d{4}-\d{2}$'),
  demo boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.colaboradores_folha enable row level security;
-- salários: veem administrador, consultor e diretoria; alteram administrador e consultor
create policy sel on public.colaboradores_folha for select to authenticated using (public.ve_tudo());
create policy ins on public.colaboradores_folha for insert to authenticated with check (public.gestor());
create policy upd on public.colaboradores_folha for update to authenticated using (public.gestor()) with check (public.gestor());
create policy del on public.colaboradores_folha for delete to authenticated using (public.gestor());
create trigger trg_upd before update on public.colaboradores_folha for each row execute function public.tg_updated();
create trigger trg_hist after insert or update or delete on public.colaboradores_folha for each row execute function public.tg_historico();

-- histórico: registra a chave do colaborador nas tabelas sem id próprio
create or replace function public.tg_historico()
returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if coalesce(current_setting('fb.tr',true),'') = '1' then return null; end if;
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.historico (tabela, registro, acao, antes, depois)
  values (tg_table_name,
          coalesce(r->>'id', (r->>'loja_id') || coalesce('|'||(r->>'mes'),'') , r->>'chave', r->>'colaborador_id', r->>'user_id'),
          tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

-- ---------- alerta de fim de experiência (15 dias) ----------
alter table public.alertas drop constraint if exists alertas_tipo_check;
alter table public.alertas add constraint alertas_tipo_check check (tipo in ('temperatura','cmv','plano','ruptura','contagem','rh'));

create or replace function public.alertas_rh()
returns integer language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,ref_id,chave)
  select co.loja_id, 'rh', case when co.fim_experiencia - current_date <= 3 then 'critico' else 'atencao' end,
         'Fim de experiência: '||co.nome||' em '||to_char(co.fim_experiencia,'DD/MM'),
         coalesce(co.cargo_folha, co.cargo)||' · '||coalesce(l.nome, case co.setor when 'escritorio' then 'Matriz · Escritório' else 'Matriz · Produção' end)
           ||' · decidir efetivação ou desligamento até a data',
         'rh', co.id, 'exp|'||co.id||'|'||co.fim_experiencia
  from public.colaboradores co left join public.lojas l on l.id = co.loja_id
  where co.fim_experiencia between current_date and current_date + 15
    and (co.desligamento is null or co.desligamento > current_date)
    and co.contrato is distinct from 'PJ'
  on conflict (chave) do update set titulo = excluded.titulo, detalhe = excluded.detalhe, nivel = excluded.nivel;
  get diagnostics c = row_count;
  update public.alertas a set resolvido = true where a.chave like 'exp|%' and not a.resolvido and not exists (
    select 1 from public.colaboradores co where 'exp|'||co.id||'|'||co.fim_experiencia = a.chave
      and co.fim_experiencia >= current_date and (co.desligamento is null or co.desligamento > current_date));
  return c;
end $$;
revoke execute on function public.alertas_rh() from public, anon, authenticated;

do $$
declare d text;
begin
  select pg_get_functiondef('public.gerar_alertas()'::regprocedure) into d;
  if position('alertas_rh' in d) = 0 then
    d := replace(d, 'n := n + public.alertas_controle();', 'n := n + public.alertas_controle();' || chr(10) || '  n := n + public.alertas_rh();');
    execute d;
  end if;
end $$;
