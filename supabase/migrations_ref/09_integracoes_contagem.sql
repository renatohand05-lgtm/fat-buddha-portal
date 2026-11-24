-- =====================================================================
-- 09 · iFood, vendas em tempo real, notas fiscais e contagem com bloqueio
-- =====================================================================

-- ---------- utilitários ----------
create or replace function public.fmt_br(x numeric) returns text language sql immutable as $$
  select regexp_replace(replace(to_char(x,'FM999999990D0'),'.',','),',0$','')
$$;
create or replace function public.contagem_limite() returns numeric language sql stable security definer set search_path=public as $$
  select coalesce((select (valor#>>'{}')::numeric from public.config where chave='contagem_limite'),10)
$$;
insert into public.config(chave,valor) values ('contagem_limite','10'::jsonb) on conflict (chave) do nothing;

-- auditoria: não registra as atualizações automáticas da venda em tempo real (evita inchar o histórico)
create or replace function public.tg_historico() returns trigger language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
  if coalesce(current_setting('fb.tr',true),'') = '1' then return null; end if;
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.historico (tabela, registro, acao, antes, depois)
  values (tg_table_name,
          coalesce(r->>'id', (r->>'loja_id') || coalesce('|'||(r->>'mes'),'') , r->>'chave', r->>'user_id'),
          tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

-- ---------- origem das vendas (manual, api, tempo_real) ----------
alter table public.vendas_diarias add column if not exists origem text not null default 'manual';
alter table public.vendas_hora    add column if not exists origem text not null default 'manual';
create or replace function public.tg_vendas_origem() returns trigger language plpgsql set search_path=public as $$
begin
  -- só a agregação automática grava "tempo_real"; qualquer outra gravação vira fechamento manual e passa a valer
  if coalesce(current_setting('fb.tr',true),'') <> '1' and new.origem = 'tempo_real' then new.origem := 'manual'; end if;
  return new;
end $$;
create trigger trg_origem before insert or update on public.vendas_diarias for each row execute function public.tg_vendas_origem();
create trigger trg_origem before insert or update on public.vendas_hora    for each row execute function public.tg_vendas_origem();

-- ---------- iFood (métricas diárias por loja) ----------
create table public.ifood_diario (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  data date not null,
  pedidos int, faturamento numeric, cancelados int, valor_cancelado numeric,
  online_min numeric, previsto_min numeric, nota numeric, avaliacoes int,
  preparo_min numeric, entrega_min numeric, atrasados int,
  comissao numeric, taxas numeric, promocoes numeric, novos_clientes int,
  origem text not null default 'manual',
  created_at timestamptz default now(), updated_at timestamptz default now(), updated_by uuid default auth.uid(),
  demo boolean not null default false,
  unique (loja_id, data)
);

-- ---------- pedidos em tempo real ----------
create table public.pedidos_tempo_real (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  origem text not null,
  externo_id text not null,
  data_hora timestamptz not null,
  data date not null,
  hora smallint not null,
  canal text not null check (canal in ('salao','delivery')),
  plataforma text,
  valor numeric not null default 0 check (valor >= 0),
  itens int,
  status text not null default 'concluido' check (status in ('concluido','cancelado')),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  demo boolean not null default false,
  unique (origem, externo_id)
);
create index pedidos_tr_loja_data on public.pedidos_tempo_real (loja_id, data);
create or replace function public.tg_pedido_data() returns trigger language plpgsql set search_path=public as $$
begin
  new.data := (new.data_hora at time zone 'America/Sao_Paulo')::date;
  new.hora := extract(hour from new.data_hora at time zone 'America/Sao_Paulo')::smallint;
  return new;
end $$;
create trigger trg_data before insert or update on public.pedidos_tempo_real for each row execute function public.tg_pedido_data();

create or replace function public.agrega_tempo_real(p_loja text, p_data date) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform set_config('fb.tr','1',true);
  insert into public.vendas_diarias as v (loja_id,data,salao,delivery,pedidos_salao,pedidos_delivery,origem)
  select p_loja, p_data,
         coalesce(sum(valor) filter (where canal='salao' and status='concluido'),0),
         coalesce(sum(valor) filter (where canal='delivery' and status='concluido'),0),
         count(*) filter (where canal='salao' and status='concluido'),
         count(*) filter (where canal='delivery' and status='concluido'), 'tempo_real'
  from public.pedidos_tempo_real where loja_id=p_loja and data=p_data and not demo
  having count(*) > 0
  on conflict (loja_id,data) do update set salao=excluded.salao, delivery=excluded.delivery,
     pedidos_salao=excluded.pedidos_salao, pedidos_delivery=excluded.pedidos_delivery
  where v.origem = 'tempo_real';
  insert into public.vendas_hora as h (loja_id,data,hora,salao,delivery,origem)
  select p_loja, p_data, hora,
         coalesce(sum(valor) filter (where canal='salao' and status='concluido'),0),
         coalesce(sum(valor) filter (where canal='delivery' and status='concluido'),0), 'tempo_real'
  from public.pedidos_tempo_real where loja_id=p_loja and data=p_data and not demo group by hora
  on conflict (loja_id,data,hora) do update set salao=excluded.salao, delivery=excluded.delivery
  where h.origem = 'tempo_real';
  update public.vendas_hora h set salao=0, delivery=0
   where h.loja_id=p_loja and h.data=p_data and h.origem='tempo_real'
     and not exists (select 1 from public.pedidos_tempo_real p where p.loja_id=p_loja and p.data=p_data and p.hora=h.hora and not p.demo);
  perform set_config('fb.tr','0',true);
end $$;

create or replace function public.tg_pedidos_agrega() returns trigger language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if tg_op in ('INSERT','UPDATE') then
    for r in select distinct loja_id, data from novos where not demo loop perform public.agrega_tempo_real(r.loja_id, r.data); end loop;
  end if;
  if tg_op in ('UPDATE','DELETE') then
    for r in select distinct loja_id, data from antigos where not demo loop perform public.agrega_tempo_real(r.loja_id, r.data); end loop;
  end if;
  return null;
end $$;
create trigger trg_agrega_ins after insert on public.pedidos_tempo_real referencing new table as novos for each statement execute function public.tg_pedidos_agrega();
create trigger trg_agrega_upd after update on public.pedidos_tempo_real referencing new table as novos old table as antigos for each statement execute function public.tg_pedidos_agrega();
create trigger trg_agrega_del after delete on public.pedidos_tempo_real referencing old table as antigos for each statement execute function public.tg_pedidos_agrega();

do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.pedidos_tempo_real;
  end if;
end $$;

-- ---------- notas fiscais ----------
create table public.notas_fiscais (
  id bigint generated always as identity primary key,
  loja_id text references public.lojas(id) on delete cascade,      -- vazio = cozinha central
  chave text not null unique,                                        -- chave de acesso (44 dígitos) ou cnpj-numero-serie
  numero text, serie text,
  emissao date not null,
  competencia text not null default '',
  fornecedor_cnpj text, fornecedor_nome text not null,
  valor_produtos numeric, frete numeric default 0, desconto numeric default 0, outras numeric default 0,
  valor_total numeric not null check (valor_total >= 0),
  categoria text check (categoria in ('cmv','cdel','man','mkt','cto','agua','energia','outros','ignorar')),
  status text not null default 'pendente',
  origem text not null default 'manual',
  obs text,
  created_at timestamptz default now(), created_by uuid default auth.uid(), updated_at timestamptz default now(),
  demo boolean not null default false
);
create index notas_comp on public.notas_fiscais (competencia, loja_id);
create table public.notas_itens (
  id bigint generated always as identity primary key,
  nota_id bigint not null references public.notas_fiscais(id) on delete cascade,
  n int, codigo text, descricao text not null, ncm text, cfop text, unidade text,
  quantidade numeric, valor_unit numeric, valor_total numeric
);
create index notas_itens_nota on public.notas_itens (nota_id);
create table public.nf_regras (
  id bigint generated always as identity primary key,
  cnpj text, termo text,
  categoria text not null check (categoria in ('cmv','cdel','man','mkt','cto','agua','energia','outros','ignorar')),
  created_at timestamptz default now(), created_by uuid default auth.uid(),
  check (cnpj is not null or termo is not null)
);
create or replace function public.nf_categoria(p_cnpj text, p_nome text) returns text language sql stable security definer set search_path=public as $$
  select categoria from (
    select categoria, 1 o from public.nf_regras where cnpj is not null and regexp_replace(cnpj,'\D','','g') = regexp_replace(coalesce(p_cnpj,''),'\D','','g')
    union all
    select categoria, 2 from public.nf_regras where termo is not null and p_nome ilike '%'||termo||'%'
  ) x order by o limit 1
$$;
create or replace function public.tg_nota() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.fornecedor_cnpj := nullif(regexp_replace(coalesce(new.fornecedor_cnpj,''),'\D','','g'),'');
  if coalesce(new.competencia,'') !~ '^\d{4}-\d{2}$' then new.competencia := to_char(new.emissao,'YYYY-MM'); end if;
  if new.categoria is null then new.categoria := public.nf_categoria(new.fornecedor_cnpj, new.fornecedor_nome); end if;
  new.status := case when new.categoria is null then 'pendente' else 'classificada' end;
  return new;
end $$;
create trigger trg_nota before insert or update on public.notas_fiscais for each row execute function public.tg_nota();
-- aplica as regras às notas ainda sem categoria
create or replace function public.nf_aplicar_regras() returns int language plpgsql security invoker set search_path=public as $$
declare n int;
begin
  update public.notas_fiscais set categoria = public.nf_categoria(fornecedor_cnpj, fornecedor_nome)
   where categoria is null and public.nf_categoria(fornecedor_cnpj, fornecedor_nome) is not null;
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.nf_ver(l text) returns boolean language sql stable security definer set search_path=public as $$
  select case when l is null then public.ve_tudo() else public.pode_ver(l) end
$$;
create or replace function public.nf_editar(l text) returns boolean language sql stable security definer set search_path=public as $$
  select case when l is null then coalesce(public.meu_papel() in ('admin','consultor','regional'),false) else public.pode_editar(l) end
$$;

-- ---------- contagem de estoque com bloqueio por divergência ----------
alter table public.estoque_cc add column if not exists limite_div numeric;
create table public.contagens_estoque (
  id bigint generated always as identity primary key,
  local text not null default 'cc',
  loja_id text references public.lojas(id) on delete cascade,
  estoque_id bigint references public.estoque_cc(id) on delete set null,
  item text not null, un text,
  esperado numeric not null, contado numeric not null,
  diferenca numeric generated always as (contado - esperado) stored,
  limite numeric not null,
  justificativa text,
  created_at timestamptz default now(), created_by uuid default auth.uid(),
  revisado_por uuid, revisado_em timestamptz, revisao_obs text,
  demo boolean not null default false
);
create index contagens_data on public.contagens_estoque (created_at);
alter table public.cmv_itens add column if not exists justificativa text;
alter table public.cmv_itens add column if not exists revisado_por uuid;
alter table public.cmv_itens add column if not exists revisado_em timestamptz;

-- bloqueio no banco: estoque da cozinha central não muda além do limite sem passar pela contagem justificada
create or replace function public.tg_estoque_bloqueio() returns trigger language plpgsql set search_path=public as $$
declare lim numeric;
begin
  if new.atual is distinct from old.atual and coalesce(current_setting('fb.contagem',true),'') <> '1' then
    lim := coalesce(old.limite_div, public.contagem_limite());
    if abs(coalesce(new.atual,0) - coalesce(old.atual,0)) > lim then
      raise exception 'BLOQUEIO: a diferença de % % em "%" passa do limite de % unidades. Registre pela contagem, com a justificativa.',
        public.fmt_br(new.atual - old.atual), coalesce(old.un,'un'), old.item, public.fmt_br(lim);
    end if;
  end if;
  return new;
end $$;
create trigger trg_bloqueio before update on public.estoque_cc for each row execute function public.tg_estoque_bloqueio();

create or replace function public.tg_cmv_itens_bloqueio() returns trigger language plpgsql set search_path=public as $$
declare lim numeric := public.contagem_limite();
begin
  if abs(coalesce(new.real,0) - coalesce(new.teorico,0)) > lim
     and length(btrim(coalesce(new.justificativa,''))) < 10
     and (tg_op = 'INSERT' or new.real is distinct from old.real or new.teorico is distinct from old.teorico or new.justificativa is distinct from old.justificativa) then
    raise exception 'BLOQUEIO: diferença de % unidades em "%" (limite de %). Justifique o motivo da divergência.',
      public.fmt_br(new.real - new.teorico), new.item, public.fmt_br(lim);
  end if;
  if tg_op = 'UPDATE' and (new.real is distinct from old.real or new.teorico is distinct from old.teorico or new.justificativa is distinct from old.justificativa) then
    new.revisado_em := null; new.revisado_por := null;
  end if;
  return new;
end $$;
create trigger trg_bloqueio before insert or update on public.cmv_itens for each row execute function public.tg_cmv_itens_bloqueio();

create or replace function public.registrar_contagem(p_itens jsonb) returns int
language plpgsql security definer set search_path=public as $$
declare r jsonb; e public.estoque_cc; c numeric; j text; lim numeric; n int := 0; faltam text[] := '{}';
begin
  if coalesce(public.meu_papel(),'') not in ('admin','consultor','regional') then
    raise exception 'Sem permissão para registrar a contagem da cozinha central.';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Nenhum item contado.'; end if;
  for r in select * from jsonb_array_elements(p_itens) loop
    select * into e from public.estoque_cc where id = (r->>'id')::bigint;
    if not found then raise exception 'Item % não encontrado no estoque.', r->>'id'; end if;
    c := (r->>'contado')::numeric;
    if c is null or c < 0 then raise exception 'Quantidade contada inválida em "%".', e.item; end if;
    lim := coalesce(e.limite_div, public.contagem_limite());
    j := btrim(coalesce(r->>'justificativa',''));
    if abs(c - e.atual) > lim and length(j) < 10 then faltam := faltam || e.item; end if;
  end loop;
  if cardinality(faltam) > 0 then
    raise exception 'BLOQUEIO: divergência acima do limite sem justificativa em: %', array_to_string(faltam, ', ');
  end if;
  perform set_config('fb.contagem','1',true);
  for r in select * from jsonb_array_elements(p_itens) loop
    select * into e from public.estoque_cc where id = (r->>'id')::bigint;
    c := (r->>'contado')::numeric;
    lim := coalesce(e.limite_div, public.contagem_limite());
    j := nullif(btrim(coalesce(r->>'justificativa','')),'');
    insert into public.contagens_estoque (local, estoque_id, item, un, esperado, contado, limite, justificativa, created_by)
    values ('cc', e.id, e.item, e.un, e.atual, c, lim, j, auth.uid());
    update public.estoque_cc set atual = c, updated_by = auth.uid() where id = e.id;
    n := n + 1;
  end loop;
  perform set_config('fb.contagem','0',true);
  return n;
end $$;

create or replace function public.revisar_divergencia(p_tipo text, p_id bigint, p_obs text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.gestor() then raise exception 'Apenas gestores revisam divergências.'; end if;
  if p_tipo = 'cc' then
    update public.contagens_estoque set revisado_por = auth.uid(), revisado_em = now(), revisao_obs = p_obs where id = p_id;
  else
    update public.cmv_itens set revisado_por = auth.uid(), revisado_em = now() where id = p_id;
  end if;
  perform public.gerar_alertas();
end $$;

-- ---------- RLS ----------
alter table public.ifood_diario enable row level security;
alter table public.pedidos_tempo_real enable row level security;
alter table public.notas_fiscais enable row level security;
alter table public.notas_itens enable row level security;
alter table public.nf_regras enable row level security;
alter table public.contagens_estoque enable row level security;

do $$ declare t text; begin
  foreach t in array array['ifood_diario','pedidos_tempo_real'] loop
    execute format('create policy sel on public.%I for select to authenticated using (public.pode_ver(loja_id))', t);
    execute format('create policy ins on public.%I for insert to authenticated with check (public.pode_editar(loja_id))', t);
    execute format('create policy upd on public.%I for update to authenticated using (public.pode_editar(loja_id)) with check (public.pode_editar(loja_id))', t);
    execute format('create policy del on public.%I for delete to authenticated using (public.pode_excluir(loja_id))', t);
  end loop;
end $$;
create policy sel on public.notas_fiscais for select to authenticated using (public.nf_ver(loja_id));
create policy ins on public.notas_fiscais for insert to authenticated with check (public.nf_editar(loja_id));
create policy upd on public.notas_fiscais for update to authenticated using (public.nf_editar(loja_id)) with check (public.nf_editar(loja_id));
create policy del on public.notas_fiscais for delete to authenticated using (case when loja_id is null then public.gestor() else public.pode_excluir(loja_id) end);
create policy sel on public.notas_itens for select to authenticated using (exists (select 1 from public.notas_fiscais n where n.id = nota_id and public.nf_ver(n.loja_id)));
create policy ins on public.notas_itens for insert to authenticated with check (exists (select 1 from public.notas_fiscais n where n.id = nota_id and public.nf_editar(n.loja_id)));
create policy del on public.notas_itens for delete to authenticated using (exists (select 1 from public.notas_fiscais n where n.id = nota_id and public.nf_editar(n.loja_id)));
create policy sel on public.nf_regras for select to authenticated using (public.meu_papel() is not null);
create policy ins on public.nf_regras for insert to authenticated with check (public.gestor());
create policy del on public.nf_regras for delete to authenticated using (public.gestor());
create policy sel on public.contagens_estoque for select to authenticated using (case when loja_id is null then public.meu_papel() is not null else public.pode_ver(loja_id) end);
-- contagens só entram pela função registrar_contagem (com validação); ninguém grava direto

-- auditoria, updated_at e alertas
do $$ declare t text; begin
  foreach t in array array['ifood_diario','notas_fiscais','nf_regras','contagens_estoque'] loop
    execute format('create trigger trg_hist after insert or update or delete on public.%I for each row execute function public.tg_historico()', t);
  end loop;
  foreach t in array array['ifood_diario','notas_fiscais','pedidos_tempo_real'] loop
    execute format('create trigger trg_upd before update on public.%I for each row execute function public.tg_updated()', t);
  end loop;
end $$;
create trigger trg_alertas after insert or update or delete on public.contagens_estoque for each statement execute function public.tg_alertas();
create trigger trg_alertas after insert or update or delete on public.cmv_itens for each statement execute function public.tg_alertas();

-- ---------- alertas: novo tipo "contagem" ----------
alter table public.alertas drop constraint alertas_tipo_check;
alter table public.alertas add constraint alertas_tipo_check check (tipo in ('temperatura','cmv','plano','ruptura','contagem'));

create or replace function public.gerar_alertas() returns integer language plpgsql security definer set search_path to 'public' as $function$
declare n int := 0; c int; lim numeric := public.contagem_limite();
  nomes text[] := array['Câmara de resfriados','Geladeiras e freezers de resfriados','Câmara de congelados','Freezers de congelados'];
  faixas text[] := array['1 °C a 4 °C','1 °C a 4 °C','−21 °C a −14 °C','−21 °C a −14 °C'];
begin
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,ref_id,chave)
  select v.loja_id,'temperatura','critico',
         nomes[(split_part(r.key,'-',2))::int+1]||' fora da faixa: '||replace(to_char((r.value->>'t')::numeric,'FM990D0'),'.',',')||' °C',
         'Visita de '||to_char(v.data,'DD/MM/YYYY')||' · faixa ideal '||faixas[(split_part(r.key,'-',2))::int+1],
         'qualidade', v.id, 'temp|'||v.id||'|'||r.key
  from public.visitas_qualidade v, jsonb_each(v.respostas) r
  where v.data >= current_date - 60 and r.key in ('6-0','6-1','6-2','6-3') and r.value->>'v' = 'nao' and r.value ? 't'
  on conflict (chave) do nothing;
  get diagnostics c = row_count; n := n + c;
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,ref_id,chave)
  select x.loja_id,'cmv', case when x.real > x.meta*1.1 then 'critico' else 'atencao' end,
         'CMV de '||replace(to_char(x.real,'FM990D0'),'.',',')||'% acima da meta de '||replace(to_char(x.meta,'FM990D0'),'.',',')||'%',
         'Semana de '||to_char(x.semana,'DD/MM')||' · teórico '||replace(to_char(x.cmv_teorico,'FM990D0'),'.',',')||'%', 'cmv', x.id, 'cmv|'||x.loja_id||'|'||x.semana
  from (select c.*, round((c.estoque_inicial+c.compras+c.transf_entrada-c.transf_saida-c.devolucoes-c.estoque_final)/c.vendas*100,1) as real,
               public.meta_vigente('cmv',c.loja_id,c.semana) as meta
        from public.cmv_contagens c where c.semana >= current_date - 60) x
  where x.meta is not null and x.real > x.meta
  on conflict (chave) do nothing;
  get diagnostics c = row_count; n := n + c;
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,ref_id,chave)
  select p.loja_id,'plano', case when p.prioridade='Alta' then 'critico' else 'atencao' end,
         'Ação atrasada: '||left(p.problema,120),
         'Prazo '||to_char(p.prazo,'DD/MM/YYYY')||coalesce(' · responsável '||p.responsavel,''), 'planos', p.id, 'plano|'||p.id||'|'||p.prazo
  from public.planos_acao p where p.status not in ('Concluído','Cancelado') and p.prazo < current_date
  on conflict (chave) do nothing;
  get diagnostics c = row_count; n := n + c;
  update public.alertas a set resolvido = true where a.tipo='plano' and not a.resolvido and not exists
    (select 1 from public.planos_acao p where p.id=a.ref_id and p.status not in ('Concluído','Cancelado') and p.prazo < current_date);
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,ref_id,chave)
  select x.loja_id,'ruptura', case when x.q > x.meta*1.1 then 'critico' else 'atencao' end,
         x.q||' rupturas na semana (meta: até '||x.meta::int||')', 'Semana de '||to_char(x.sem,'DD/MM'), 'cc', null, 'rup|'||x.loja_id||'|'||x.sem
  from (select r.loja_id, date_trunc('week',r.data)::date sem, count(*) q, public.meta_vigente('rupturas',r.loja_id,date_trunc('week',r.data)::date) meta
        from public.rupturas r where r.data >= current_date - 56 group by 1,2) x
  where x.meta is not null and x.q > x.meta
  on conflict (chave) do nothing;
  get diagnostics c = row_count; n := n + c;
  -- contagem da cozinha central com divergência acima do limite (fica aberto até um gestor revisar)
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,ref_id,chave)
  select c.loja_id,'contagem', case when abs(c.diferenca) > c.limite*3 then 'critico' else 'atencao' end,
         'Divergência na contagem: '||c.item||' '||case when c.diferenca>0 then '+' else '' end||public.fmt_br(c.diferenca)||' '||coalesce(c.un,'un'),
         'Esperado '||public.fmt_br(c.esperado)||', contado '||public.fmt_br(c.contado)||' em '||to_char(c.created_at at time zone 'America/Sao_Paulo','DD/MM')||' · motivo: '||left(coalesce(c.justificativa,'—'),160),
         'cc', c.id, 'cont|'||c.id
  from public.contagens_estoque c
  where c.created_at >= now() - interval '30 days' and abs(c.diferenca) > c.limite and c.revisado_em is null
  on conflict (chave) do nothing;
  get diagnostics c = row_count; n := n + c;
  update public.alertas a set resolvido = true where a.tipo='contagem' and a.aba='cc' and not a.resolvido and not exists
    (select 1 from public.contagens_estoque x where x.id=a.ref_id and x.revisado_em is null);
  -- consumo real x teórico por item (CMV) acima do limite
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,ref_id,chave)
  select i.loja_id,'contagem', case when abs(i.real-i.teorico) > lim*3 then 'critico' else 'atencao' end,
         'Divergência no consumo: '||i.item||' '||case when i.real>i.teorico then '+' else '' end||public.fmt_br(i.real-i.teorico)||' un.',
         'Semana de '||to_char(i.semana,'DD/MM')||' · teórico '||public.fmt_br(i.teorico)||', real '||public.fmt_br(i.real)||' · motivo: '||left(coalesce(i.justificativa,'—'),160),
         'cmv', i.id, 'cmvit|'||i.id
  from public.cmv_itens i
  where i.semana >= current_date - 60 and abs(i.real - i.teorico) > lim and i.revisado_em is null
  on conflict (chave) do nothing;
  get diagnostics c = row_count; n := n + c;
  update public.alertas a set resolvido = true where a.tipo='contagem' and a.aba='cmv' and not a.resolvido and not exists
    (select 1 from public.cmv_itens x where x.id=a.ref_id and x.revisado_em is null and abs(x.real-x.teorico) > lim);
  return n;
end $function$;

-- ---------- limpar demonstração inclui os novos módulos ----------
create or replace function public.limpar_demo() returns integer language plpgsql security definer set search_path to 'public' as $function$
declare n int := 0; c int; t text;
begin
  if public.meu_papel() is distinct from 'admin' then raise exception 'Apenas o administrador remove os dados de demonstração.'; end if;
  foreach t in array array['planos_acao','ocorrencias','avaliacoes_gerentes','visitas_qualidade','delivery_checklists','pedidos_tempo_real','vendas_hora','vendas_diarias',
    'indicadores_mensais','ifood_diario','notas_fiscais','contagens_estoque','cmv_itens','cmv_contagens','rupturas','estoque_cc','rh_movimentos','lideranca','dre_lancamentos','colaboradores'] loop
    execute format('delete from public.%I where demo', t); get diagnostics c = row_count; n := n + c;
  end loop;
  delete from public.alertas;
  delete from public.config where chave = 'demo_info';
  perform public.gerar_alertas();
  return n;
end $function$;

revoke execute on function public.agrega_tempo_real(text,date) from public, anon, authenticated;
revoke execute on function public.registrar_contagem(jsonb) from public, anon;
revoke execute on function public.revisar_divergencia(text,bigint,text) from public, anon;
revoke execute on function public.limpar_demo() from public, anon;

-- escopos padrão das chaves novas
alter table public.api_chaves alter column escopos set default array['vendas','vendas_hora','rupturas','delivery','indicadores','cmv','ifood','pedidos','notas'];

-- códigos externos da loja (iFood, PDV/portal de vendas e CNPJ para reconhecer as notas)
alter table public.lojas add column if not exists ifood_merchant text unique;
alter table public.lojas add column if not exists codigo_pdv text unique;
alter table public.lojas add column if not exists cnpj text;
