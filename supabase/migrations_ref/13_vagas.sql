-- 13 · Vagas: requisição, aprovação, seleção e preenchimento, ligadas ao quadro meta (quadro_previsto)
create table if not exists public.vagas (
  id bigserial primary key,
  loja_id text references public.lojas(id) on delete cascade,
  setor text not null default 'loja' check (setor in ('loja','escritorio','producao')),
  cargo text not null,
  cargo_folha text,
  quantidade int not null default 1 check (quantidade between 1 and 50),
  preenchidas int not null default 0 check (preenchidas >= 0),
  motivo text not null check (motivo in ('Aumento de quadro','Substituição','Nova loja','Temporária')),
  substitui_id bigint references public.colaboradores(id) on delete set null,
  turno text check (turno in ('Diurno','Noturno','Integral')),
  contrato text check (contrato in ('CLT','PJ')),
  prazo date,
  status text not null default 'solicitada' check (status in ('solicitada','aprovada','em_selecao','preenchida','cancelada')),
  obs text,
  solicitante text,
  aprovada_por uuid,
  aprovada_em timestamptz,
  encerrada_em timestamptz,
  motivo_cancelamento text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  demo boolean not null default false,
  constraint vagas_setor_loja_chk check ((setor = 'loja') = (loja_id is not null)),
  constraint vagas_preench_chk check (preenchidas <= quantidade)
);
create index if not exists vagas_loja_status on public.vagas (loja_id, status);

-- quem aprova: administrador, consultor ou o supervisor regional da loja
create or replace function public.aprova_vaga(l text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.gestor() or (l is not null and coalesce(public.meu_papel() = 'regional', false) and public.minha_loja(l))
$$;

create or replace function public.tg_vaga()
returns trigger language plpgsql security definer set search_path = public as $$
declare ap boolean := public.aprova_vaga(new.loja_id);
begin
  if tg_op = 'INSERT' then
    if not ap then new.status := 'solicitada';
    elsif new.status not in ('solicitada','aprovada') then new.status := 'aprovada'; end if;
    if new.status = 'aprovada' then new.aprovada_por := auth.uid(); new.aprovada_em := now(); end if;
    new.preenchidas := 0;
    return new;
  end if;
  if new.status is distinct from old.status then
    if old.status in ('preenchida','cancelada') and not public.gestor() then
      raise exception 'BLOQUEIO: vaga encerrada; só administrador ou consultor reabre.';
    end if;
    if old.status = 'solicitada' and new.status in ('aprovada','em_selecao','preenchida') and not ap then
      raise exception 'BLOQUEIO: a vaga precisa ser aprovada pelo supervisor regional ou pela gestão antes de seguir.';
    end if;
    if new.status = 'aprovada' or (old.status = 'solicitada' and new.status = 'em_selecao') then new.aprovada_por := auth.uid(); new.aprovada_em := now(); end if;
    if new.status = 'cancelada' and length(btrim(coalesce(new.motivo_cancelamento,''))) < 5 then
      raise exception 'BLOQUEIO: informe o motivo do cancelamento da vaga.';
    end if;
    if new.status in ('preenchida','cancelada') then new.encerrada_em := now(); else new.encerrada_em := null; end if;
  end if;
  if new.preenchidas >= new.quantidade and new.status in ('aprovada','em_selecao') then new.status := 'preenchida'; new.encerrada_em := now(); end if;
  if new.preenchidas > 0 and old.status = 'solicitada' and not ap then
    raise exception 'BLOQUEIO: a vaga precisa ser aprovada antes de registrar contratações.';
  end if;
  if old.status <> 'solicitada' and not ap and (new.quantidade, new.cargo, new.loja_id, new.setor) is distinct from (old.quantidade, old.cargo, old.loja_id, old.setor) then
    raise exception 'BLOQUEIO: vaga aprovada; alterar cargo, unidade ou quantidade exige nova aprovação.';
  end if;
  return new;
end $$;
revoke execute on function public.tg_vaga() from public, anon, authenticated;

create trigger trg_vaga before insert or update on public.vagas for each row execute function public.tg_vaga();
create trigger trg_upd before update on public.vagas for each row execute function public.tg_updated();
create trigger trg_hist after insert or update or delete on public.vagas for each row execute function public.tg_historico();

alter table public.vagas enable row level security;
create policy sel on public.vagas for select to authenticated using (public.ve_rh(loja_id));
create policy ins on public.vagas for insert to authenticated with check (public.pode_editar(loja_id));
create policy upd on public.vagas for update to authenticated using (public.pode_editar(loja_id)) with check (public.pode_editar(loja_id));
create policy del on public.vagas for delete to authenticated using (public.gestor());

-- alertas: vaga aguardando aprovação há 2 dias ou mais; vaga com prazo vencido
create or replace function public.alertas_vagas()
returns integer language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,ref_id,chave)
  select v.loja_id, 'rh', case when v.status = 'solicitada' then 'atencao' else 'critico' end,
         case when v.status = 'solicitada' then 'Vaga aguardando aprovação: '||v.cargo||' ('||v.quantidade||')'
              else 'Vaga com prazo vencido: '||v.cargo||' ('||(v.quantidade - v.preenchidas)||' em aberto)' end,
         coalesce(l.nome, case v.setor when 'escritorio' then 'Matriz · Escritório' else 'Matriz · Produção' end)||' · '||v.motivo||
           case when v.status = 'solicitada' then ' · aberta em '||to_char(v.created_at at time zone 'America/Sao_Paulo','DD/MM') else ' · prazo '||to_char(v.prazo,'DD/MM') end,
         'rh', v.id, 'vaga|'||v.id||'|'||case when v.status = 'solicitada' then 'apr' else 'prazo' end
  from public.vagas v left join public.lojas l on l.id = v.loja_id
  where (v.status = 'solicitada' and v.created_at < now() - interval '2 days')
     or (v.status in ('aprovada','em_selecao') and v.prazo < current_date)
  on conflict (chave) do update set titulo = excluded.titulo, detalhe = excluded.detalhe, nivel = excluded.nivel;
  get diagnostics c = row_count;
  update public.alertas a set resolvido = true where a.chave like 'vaga|%' and not a.resolvido and not exists (
    select 1 from public.vagas v where (v.status = 'solicitada' and a.chave = 'vaga|'||v.id||'|apr')
       or (v.status in ('aprovada','em_selecao') and v.prazo < current_date and a.chave = 'vaga|'||v.id||'|prazo'));
  return c;
end $$;
revoke execute on function public.alertas_vagas() from public, anon, authenticated;

do $$
declare d text;
begin
  select pg_get_functiondef('public.gerar_alertas()'::regprocedure) into d;
  if position('alertas_vagas' in d) = 0 then
    d := replace(d, 'n := n + public.alertas_rh();', 'n := n + public.alertas_rh();' || chr(10) || '  n := n + public.alertas_vagas();');
    execute d;
  end if;
end $$;

-- demonstração: limpar_demo também remove vagas de exemplo
do $$
declare d text;
begin
  select pg_get_functiondef('public.limpar_demo()'::regprocedure) into d;
  if position('''vagas''' in d) = 0 then
    d := replace(d, '''controle_diario'',', '''vagas'',''controle_diario'',');
    execute d;
  end if;
end $$;
