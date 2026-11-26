-- =====================================================================
-- 10 · CMV operacional: controle diário (bebidas, sobremesas, proteínas),
--      perdas e desperdício, produção padrão por dia da semana, vendas por item
-- =====================================================================

-- catálogo dos itens controlados todos os dias
create table public.itens_controle (
  id bigint generated always as identity primary key,
  lista text not null check (lista in ('bebidas','sobremesas','proteinas')),
  item text not null,
  unidade text not null default 'un',
  preparado boolean not null default false,          -- produzido na loja (cookies): entrada = preparado no dia
  custo numeric,                                     -- custo unitário para valorizar diferenças e perdas
  codigo_pdv text,                                   -- código do item no PDV (casa com as vendas por item)
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz default now(),
  unique (lista, item)
);

-- vendas por item (vindas do PDV pela API ou lançadas)
create table public.vendas_itens (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  data date not null,
  item text not null,
  codigo text,
  quantidade numeric not null default 0,
  valor numeric,
  origem text not null default 'manual',
  created_at timestamptz default now(), updated_at timestamptz default now(),
  demo boolean not null default false,
  unique (loja_id, data, item)
);
create index vendas_itens_ld on public.vendas_itens (loja_id, data);

-- controle diário: abertura (contagem antes de abrir), entradas, fechamento, venda do PDV e perdas
create table public.controle_diario (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  data date not null,
  item_id bigint not null references public.itens_controle(id) on delete cascade,
  ini1 numeric, ini2 numeric, ini3 numeric,
  entradas numeric not null default 0,
  fin1 numeric, fin2 numeric, fin3 numeric,
  venda numeric,
  perdas numeric not null default 0,
  diferenca numeric generated always as (
    case when fin1 is null and fin2 is null and fin3 is null then null
         when venda is null then null
         else coalesce(ini1,0)+coalesce(ini2,0)+coalesce(ini3,0)+entradas
              -(coalesce(fin1,0)+coalesce(fin2,0)+coalesce(fin3,0)) - venda - perdas end) stored,
  justificativa text,
  resp_abertura text, resp_fechamento text,
  revisado_por uuid, revisado_em timestamptz,
  created_at timestamptz default now(), created_by uuid default auth.uid(),
  updated_at timestamptz default now(),
  demo boolean not null default false,
  unique (loja_id, data, item_id)
);
create index controle_diario_ld on public.controle_diario (loja_id, data);

create or replace function public.controle_tolerancia() returns numeric language sql stable security definer set search_path=public as $$
  select coalesce((select (valor#>>'{}')::numeric from public.config where chave='controle_tolerancia'),0)
$$;
insert into public.config(chave,valor) values ('controle_tolerancia','0'::jsonb) on conflict (chave) do nothing;

-- bloqueio no banco: diferença acima da tolerância só grava com justificativa
create or replace function public.tg_controle_bloqueio() returns trigger language plpgsql set search_path=public as $$
declare d numeric; tol numeric := public.controle_tolerancia(); nome text;
begin
  d := case when new.fin1 is null and new.fin2 is null and new.fin3 is null then null
            when new.venda is null then null
            else coalesce(new.ini1,0)+coalesce(new.ini2,0)+coalesce(new.ini3,0)+new.entradas
                 -(coalesce(new.fin1,0)+coalesce(new.fin2,0)+coalesce(new.fin3,0)) - new.venda - new.perdas end;
  if d is not null and abs(d) > tol and length(btrim(coalesce(new.justificativa,''))) < 10 then
    select item into nome from public.itens_controle where id = new.item_id;
    raise exception 'BLOQUEIO: diferença de % em "%" no controle de %. Justifique o motivo.', public.fmt_br(d), nome, to_char(new.data,'DD/MM');
  end if;
  if tg_op = 'UPDATE' and (new.ini1,new.ini2,new.ini3,new.entradas,new.fin1,new.fin2,new.fin3,new.venda,new.perdas,new.justificativa)
       is distinct from (old.ini1,old.ini2,old.ini3,old.entradas,old.fin1,old.fin2,old.fin3,old.venda,old.perdas,old.justificativa) then
    new.revisado_em := null; new.revisado_por := null;
  end if;
  return new;
end $$;
create trigger trg_bloqueio before insert or update on public.controle_diario for each row execute function public.tg_controle_bloqueio();

-- perdas e desperdício
create table public.perdas (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  data date not null,
  item text not null,
  item_id bigint references public.itens_controle(id) on delete set null,
  quantidade numeric not null check (quantidade > 0),
  unidade text not null default 'un',
  motivo text not null check (motivo in ('Vencido','Fora do padrão de qualidade','Erro de preparo','Queda ou acidente','Temperatura fora da faixa','Devolução de cliente','Sobra de produção','Outro')),
  custo_unit numeric,
  valor numeric,
  obs text,
  responsavel text,
  origem text not null default 'manual',
  created_at timestamptz default now(), created_by uuid default auth.uid(),
  demo boolean not null default false
);
create index perdas_ld on public.perdas (loja_id, data);
create or replace function public.tg_perda_valor() returns trigger language plpgsql set search_path=public as $$
begin
  if new.custo_unit is null and new.item_id is not null then select custo into new.custo_unit from public.itens_controle where id = new.item_id; end if;
  if new.valor is null and new.custo_unit is not null then new.valor := round(new.quantidade * new.custo_unit, 2); end if;
  return new;
end $$;
create trigger trg_valor before insert or update on public.perdas for each row execute function public.tg_perda_valor();

-- produção padrão por dia da semana (planilha "Média de produtos vendidos dia a dia")
create table public.producao_padrao (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  secao text not null,
  montagem text,
  ordem int not null default 0,
  item text not null,
  validade text, recipiente text, utensilio text,
  unidade text not null default 'kg',
  q1 numeric, q2 numeric, q3 numeric, q4 numeric, q5 numeric, q6 numeric, q7 numeric,   -- segunda a domingo
  updated_at timestamptz default now(), updated_by uuid default auth.uid(),
  unique (loja_id, secao, item)
);

-- RLS
alter table public.itens_controle enable row level security;
alter table public.vendas_itens enable row level security;
alter table public.controle_diario enable row level security;
alter table public.perdas enable row level security;
alter table public.producao_padrao enable row level security;
create policy sel on public.itens_controle for select to authenticated using (public.meu_papel() is not null);
create policy ins on public.itens_controle for insert to authenticated with check (public.gestor());
create policy upd on public.itens_controle for update to authenticated using (public.gestor()) with check (public.gestor());
create policy del on public.itens_controle for delete to authenticated using (public.gestor());
create policy sel on public.vendas_itens for select to authenticated using (public.pode_ver(loja_id));
create policy ins on public.vendas_itens for insert to authenticated with check (public.pode_editar(loja_id));
create policy upd on public.vendas_itens for update to authenticated using (public.pode_editar(loja_id)) with check (public.pode_editar(loja_id));
create policy del on public.vendas_itens for delete to authenticated using (public.pode_excluir(loja_id));
-- líderes e pacotes (colaborador) fazem as contagens; o gerente confere a venda e justifica
create policy sel on public.controle_diario for select to authenticated using (public.pode_ver(loja_id));
create policy ins on public.controle_diario for insert to authenticated with check (public.pode_operar(loja_id));
create policy upd on public.controle_diario for update to authenticated using (public.pode_operar(loja_id)) with check (public.pode_operar(loja_id));
create policy del on public.controle_diario for delete to authenticated using (public.pode_excluir(loja_id));
create policy sel on public.perdas for select to authenticated using (public.pode_ver(loja_id));
create policy ins on public.perdas for insert to authenticated with check (public.pode_operar(loja_id));
create policy upd on public.perdas for update to authenticated using (public.pode_editar(loja_id)) with check (public.pode_editar(loja_id));
create policy del on public.perdas for delete to authenticated using (public.pode_excluir(loja_id));
create policy sel on public.producao_padrao for select to authenticated using (public.pode_ver(loja_id));
create policy ins on public.producao_padrao for insert to authenticated with check (public.gestor());
create policy upd on public.producao_padrao for update to authenticated using (public.gestor()) with check (public.gestor());
create policy del on public.producao_padrao for delete to authenticated using (public.gestor());

do $$ declare t text; begin
  foreach t in array array['itens_controle','controle_diario','perdas','producao_padrao'] loop
    execute format('create trigger trg_hist after insert or update or delete on public.%I for each row execute function public.tg_historico()', t);
  end loop;
  foreach t in array array['controle_diario','vendas_itens','producao_padrao'] loop
    execute format('create trigger trg_upd before update on public.%I for each row execute function public.tg_updated()', t);
  end loop;
end $$;
create trigger trg_alertas after insert or update or delete on public.controle_diario for each statement execute function public.tg_alertas();

-- revisão do dia pelo gestor
create or replace function public.revisar_controle(p_loja text, p_data date) returns int language plpgsql security definer set search_path=public as $$
declare n int;
begin
  if not public.gestor() and not (public.meu_papel() in ('regional','gerente') and public.minha_loja(p_loja)) then
    raise exception 'Sem permissão para revisar o controle desta loja.';
  end if;
  update public.controle_diario set revisado_por = auth.uid(), revisado_em = now()
   where loja_id = p_loja and data = p_data and diferenca is not null and abs(diferenca) > public.controle_tolerancia() and revisado_em is null;
  get diagnostics n = row_count;
  perform public.gerar_alertas();
  return n;
end $$;
revoke execute on function public.revisar_controle(text,date) from public, anon;
grant execute on function public.revisar_controle(text,date), public.controle_tolerancia() to authenticated;
revoke execute on function public.controle_tolerancia() from anon;

-- alertas: um por loja e dia com diferença no controle diário ainda não revisada
create or replace function public.alertas_controle() returns int language plpgsql security definer set search_path=public as $$
declare c int;
begin
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,ref_id,chave)
  select x.loja_id,'contagem', case when x.n >= 3 then 'critico' else 'atencao' end,
         'Controle diário de '||to_char(x.data,'DD/MM')||': '||x.n||' ite'||case when x.n=1 then 'm' else 'ns' end||' com diferença',
         x.itens, 'cmv', null, 'ctl|'||x.loja_id||'|'||x.data
  from (select d.loja_id, d.data, count(*) n,
               left(string_agg(i.item||' '||case when d.diferenca>0 then '+' else '' end||public.fmt_br(d.diferenca)||coalesce(' ('||left(d.justificativa,60)||')',''), ' · ' order by abs(d.diferenca) desc),300) itens
        from public.controle_diario d join public.itens_controle i on i.id = d.item_id
        where d.data >= current_date - 30 and d.diferenca is not null and abs(d.diferenca) > public.controle_tolerancia() and d.revisado_em is null
        group by 1,2) x
  on conflict (chave) do update set titulo = excluded.titulo, detalhe = excluded.detalhe, nivel = excluded.nivel, resolvido = false;
  get diagnostics c = row_count;
  update public.alertas a set resolvido = true where a.chave like 'ctl|%' and not a.resolvido and not exists (
    select 1 from public.controle_diario d where 'ctl|'||d.loja_id||'|'||d.data = a.chave
      and d.diferenca is not null and abs(d.diferenca) > public.controle_tolerancia() and d.revisado_em is null);
  return c;
end $$;
revoke execute on function public.alertas_controle() from public, anon, authenticated;

-- liga o novo alerta na rotina geral e inclui as tabelas novas na limpeza da demonstração
do $$ declare f text; begin
  f := pg_get_functiondef('public.gerar_alertas'::regproc);
  if position('alertas_controle' in f) = 0 then
    f := regexp_replace(f, 'return n;\s*end', 'n := n + public.alertas_controle();
  return n;
end');
    execute f;
  end if;
  f := pg_get_functiondef('public.limpar_demo'::regproc);
  if position('controle_diario' in f) = 0 then
    f := replace(f, '''pedidos_tempo_real'',', '''controle_diario'',''perdas'',''vendas_itens'',''pedidos_tempo_real'',');
    execute f;
  end if;
end $$;
