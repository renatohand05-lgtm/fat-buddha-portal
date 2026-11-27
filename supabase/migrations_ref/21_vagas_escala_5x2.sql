-- 21 · Vagas automáticas da escala 5x2: cada posição "Vaga aberta" da escala 5x2 da loja vira vaga aprovada no RH,
--      agrupada por cargo na folha; a vaga acompanha a escala (pessoa colocada na posição = preenchida,
--      posição removida = cancelada) e o quadro meta sobe para ativos + posições em aberto da escala
alter table public.vagas add column if not exists origem text check (origem in ('escala5x2'));
alter table public.escala_linhas add column if not exists vaga_id bigint references public.vagas(id) on delete set null;
create index if not exists escala_linhas_vaga on public.escala_linhas (vaga_id);

-- o sistema (rotina da escala) aprova e ajusta as próprias vagas
do $$
declare d text;
begin
  select pg_get_functiondef('public.tg_vaga()'::regprocedure) into d;
  if position('fb.vaga_sistema' in d) = 0 then
    d := replace(d, 'declare ap boolean := public.aprova_vaga(new.loja_id);',
                    'declare ap boolean := public.aprova_vaga(new.loja_id) or coalesce(current_setting(''fb.vaga_sistema'', true), '''') = ''1'';');
    execute d;
  end if;
end $$;

-- escala 5x2 que vale para cada loja: a vigente mais recente; sem vigente, a planejada
create or replace function public.escalas_principais()
returns table (id bigint, unidade text) language sql stable security definer set search_path = public as $$
  select distinct on (e.unidade) e.id, e.unidade from public.escalas e
  where e.modelo = 'ciclo4' and e.tipo in ('vigente','planejada') and e.unidade in (select l.id from public.lojas l)
  order by e.unidade, (e.tipo = 'vigente') desc, e.inicio desc nulls last, e.id desc
$$;
revoke execute on function public.escalas_principais() from public, anon, authenticated;

-- cargo do portal, cargo na folha e turno de cada posição da escala
create or replace function public.vaga_cargo(grupo text, posicao text, setor text)
returns table (cargo text, cargo_folha text, turno text) language sql immutable as $$
  select c, f, t from (select
    case when posicao ~* 'estoquista|auxiliar geral' or setor in ('Estoque','Limpeza') then 'Estoque e apoio'
         when setor = 'Gestão' or posicao ~* 'gerente' then 'Gerente de loja'
         when setor = 'Expedição' then 'Expedidor' else 'Cozinheiro' end c,
    case when posicao ~* 'estoquista' or setor = 'Estoque' then 'Estoquista'
         when posicao ~* 'auxiliar geral' or setor = 'Limpeza' then 'Auxiliar geral'
         when setor = 'Gestão' or posicao ~* 'gerente' then 'Gerente'
         else case when setor = 'Expedição' then
                     case when posicao ~* 'horista' then 'Expedidor horista' else 'Expedidor de mercadoria I júnior' end
                   else case when posicao ~* 'intermitente' then 'Cozinheiro intermitente' else 'Cozinheiro nível B' end end
              || case when coalesce(grupo,'') ~* 'noite' then ' noturno' else ' diurno' end end f,
    case when coalesce(grupo,'') ~* 'noite' then 'Noturno' else 'Diurno' end t) x
$$;

create or replace function public.vagas_da_escala()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; vid bigint; np int; nq int;
  pz date := greatest(coalesce((select (valor->>'implantacao')::date from public.config where chave = 'escala_politica'), '2026-12-16') - 4, current_date + 7);
begin
  if coalesce(current_setting('fb.vaga_rodando', true), '') = '1' then return 0; end if;
  perform set_config('fb.vaga_rodando', '1', true);
  perform set_config('fb.vaga_sistema', '1', true);
  -- 1) posições em aberto ainda sem vaga: soma na vaga aberta do mesmo cargo ou abre uma nova
  for r in
    select e.unidade loja, m.cargo, m.cargo_folha, m.turno, array_agg(x.id) ids, count(*)::int q,
           coalesce(min(x.grupo) filter (where x.grupo <> 'Gestão e apoio') || ': ', '')
             || string_agg(regexp_replace(coalesce(x.posicao, x.setor), '^.*· ', ''), ', ' order by x.ordem)
             || coalesce(' · ' || (select string_agg(distinct regexp_replace(t.v, '-', '–', 'g'), ' / ') from public.escala_linhas y,
                  lateral (select value v from jsonb_each_text(y.dias) where value !~* 'folga|f[ée]rias' limit 1) t where y.id = any(array_agg(x.id))), '') pos
    from public.escalas_principais() e join public.escala_linhas x on x.escala_id = e.id
    cross join lateral public.vaga_cargo(x.grupo, x.posicao, x.setor) m
    where x.vinculo = 'Vaga aberta' and x.vaga_id is null
    group by 1, 2, 3, 4
  loop
    select v.id into vid from public.vagas v where v.origem = 'escala5x2' and v.loja_id = r.loja and v.cargo_folha = r.cargo_folha
      and v.status in ('solicitada','aprovada') order by v.id desc limit 1;
    if vid is null then
      insert into public.vagas (loja_id, setor, cargo, cargo_folha, quantidade, motivo, turno, contrato, prazo, status, obs, solicitante, origem)
      values (r.loja, 'loja', r.cargo, r.cargo_folha, least(r.q, 50), 'Aumento de quadro', r.turno, 'CLT', pz, 'aprovada',
              'Escala 5x2 obrigatória · ' || r.pos, 'Escala 5x2 (automático)', 'escala5x2')
      returning id into vid;
    else
      update public.vagas set quantidade = least(quantidade + r.q, 50), obs = left(coalesce(obs, '') || ' + ' || r.pos, 500) where id = vid;
    end if;
    update public.escala_linhas set vaga_id = vid where id = any(r.ids);
    n := n + r.q;
  end loop;
  -- 2) acompanha a escala: pessoa colocada na posição conta como preenchida; posição removida reduz ou cancela a vaga
  for r in
    select v.id, v.quantidade, v.preenchidas,
           count(x.id)::int tot, (count(x.id) filter (where x.vinculo <> 'Vaga aberta'))::int atr
    from public.vagas v
    left join (select x.id, x.vaga_id, x.vinculo from public.escala_linhas x join public.escalas_principais() e on e.id = x.escala_id) x on x.vaga_id = v.id
    where v.origem = 'escala5x2' and v.status in ('solicitada','aprovada','em_selecao')
    group by v.id
  loop
    if r.tot = 0 then
      if r.preenchidas > 0 then update public.vagas set quantidade = r.preenchidas where id = r.id;
      else update public.vagas set status = 'cancelada', motivo_cancelamento = 'Posição saiu da escala 5x2' where id = r.id; end if;
    else
      np := greatest(r.preenchidas, r.atr); nq := least(greatest(r.tot, np, 1), 50);
      if np <> r.preenchidas or nq <> r.quantidade then
        update public.vagas set quantidade = nq, preenchidas = least(np, nq) where id = r.id;
      end if;
    end if;
  end loop;
  -- 3) quadro meta: no mínimo os ativos de hoje + as posições da escala 5x2 ainda em aberto
  insert into public.quadro_previsto (loja_id, cargo, previsto)
  select v.loja_id, v.cargo,
         (select count(*) from public.colaboradores c where c.loja_id = v.loja_id and c.cargo = v.cargo and c.desligamento is null)
         + sum(v.quantidade - v.preenchidas)
  from public.vagas v where v.origem = 'escala5x2' and v.status in ('solicitada','aprovada','em_selecao')
  group by v.loja_id, v.cargo
  on conflict (loja_id, cargo) do update set previsto = greatest(public.quadro_previsto.previsto, excluded.previsto);
  perform set_config('fb.vaga_sistema', '', true);
  perform set_config('fb.vaga_rodando', '', true);
  return n;
end $$;
revoke execute on function public.vagas_da_escala() from public, anon, authenticated;

-- roda sozinha a cada alteração na escala (pessoas ou situação da escala)
create or replace function public.tg_escala_vagas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  perform public.vagas_da_escala();
  return null;
end $$;
revoke execute on function public.tg_escala_vagas() from public, anon, authenticated;
drop trigger if exists trg_vagas_escala on public.escala_linhas;
create trigger trg_vagas_escala after insert or update or delete on public.escala_linhas for each statement execute function public.tg_escala_vagas();
drop trigger if exists trg_vagas_escala on public.escalas;
create trigger trg_vagas_escala after insert or update or delete on public.escalas for each statement execute function public.tg_escala_vagas();

-- obs das vagas já abertas com grupo e horário
delete from public.vagas where origem = 'escala5x2' and status = 'aprovada' and preenchidas = 0;
select public.vagas_da_escala();
select public.gerar_alertas();
