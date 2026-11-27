-- 12 · Novembro de demonstração e proteção de lançamentos reais
-- (1) Um registro de demonstração que recebe um lançamento real (importação, API ou edição) deixa de ser demonstração,
--     para não ser apagado pelo botão "Remover dados de demonstração".
create or replace function public.tg_demo_real()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.demo and new.demo and coalesce(current_setting('fb.demo',true),'') <> '1' and coalesce(current_setting('fb.tr',true),'') <> '1' then
    new.demo := false;
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['vendas_diarias','vendas_hora','ifood_diario','indicadores_mensais','cmv_contagens'] loop
    execute format('drop trigger if exists trg_demo_real on public.%I', t);
    execute format('create trigger trg_demo_real before update on public.%I for each row execute function public.tg_demo_real()', t);
  end loop;
end $$;

-- (2) Novembro de 2026 (1 a 25) gerado a partir do mesmo dia da semana de outubro (28 dias antes),
--     crescimento de ~3,5% com variação diária de ±7%. Tudo marcado como demonstração.
do $$
begin
  perform set_config('fb.tr','1',true);
  perform set_config('fb.demo','1',true);

  create temp table _f on commit drop as
    select v.loja_id, d::date as data, (d::date - 28) as base, 1.035*(0.93 + random()::numeric*0.14) as f
    from generate_series(date '2026-11-01', date '2026-11-25', interval '1 day') d
    join public.vendas_diarias v on v.data = d::date - 28;

  insert into public.vendas_diarias (loja_id,data,salao,delivery,pedidos_salao,pedidos_delivery,origem,demo)
  select v.loja_id, f.data, round(v.salao*f.f,2), round(v.delivery*f.f,2),
         round(v.pedidos_salao*f.f*(0.98+random()::numeric*0.04)), round(v.pedidos_delivery*f.f*(0.98+random()::numeric*0.04)), 'manual', true
  from _f f join public.vendas_diarias v on v.loja_id = f.loja_id and v.data = f.base
  on conflict (loja_id,data) do nothing;

  insert into public.vendas_hora (loja_id,data,hora,salao,delivery,origem,demo)
  select h.loja_id, f.data, h.hora, round(h.salao*f.f,2), round(h.delivery*f.f,2), 'manual', true
  from _f f join public.vendas_hora h on h.loja_id = f.loja_id and h.data = f.base
  on conflict (loja_id,data,hora) do nothing;

  insert into public.ifood_diario (loja_id,data,pedidos,faturamento,cancelados,valor_cancelado,online_min,previsto_min,nota,avaliacoes,preparo_min,entrega_min,atrasados,comissao,taxas,promocoes,novos_clientes,origem,demo)
  select i.loja_id, f.data, round(i.pedidos*f.f), round(i.faturamento*f.f,2), round(i.cancelados*(0.8+random()::numeric*0.4)), round(i.valor_cancelado*(0.8+random()::numeric*0.4),2),
         least(i.previsto_min, round(i.online_min*(0.99+random()::numeric*0.02))), i.previsto_min, least(5, round((i.nota + (random()::numeric-0.5)*0.1)::numeric,2)), round(i.avaliacoes*f.f),
         round((i.preparo_min*(0.95+random()::numeric*0.1))::numeric,1), round((i.entrega_min*(0.95+random()::numeric*0.1))::numeric,1), round(i.atrasados*(0.8+random()::numeric*0.4)),
         round(i.comissao*f.f,2), round(i.taxas*f.f,2), round(i.promocoes*(0.9+random()::numeric*0.2),2), round(i.novos_clientes*(0.85+random()::numeric*0.3)), i.origem, true
  from _f f join public.ifood_diario i on i.loja_id = f.loja_id and i.data = f.base
  on conflict (loja_id,data) do nothing;

  insert into public.indicadores_mensais (loja_id,mes,preparo,cancel,ifood,online,comp,folha_valor,demo)
  select loja_id, '2026-11', round((preparo*(0.96+random()::numeric*0.08))::numeric,1), round((cancel*(0.9+random()::numeric*0.2))::numeric,1), least(5,round((ifood+(random()::numeric-0.5)*0.1)::numeric,1)),
         least(100,round((online+(random()::numeric-0.5)*1)::numeric,1)), round((comp+(random()::numeric-0.5)*2)::numeric,1), folha_valor, true
  from public.indicadores_mensais where mes = '2026-10'
  on conflict (loja_id,mes) do nothing;

  -- CMV das semanas completas de novembro, a partir da semana de outubro 28 dias antes
  insert into public.cmv_contagens (loja_id,semana,vendas,cmv_teorico,estoque_inicial,compras,transf_entrada,transf_saida,devolucoes,estoque_final,responsavel,demo)
  select c.loja_id, c.semana + 28,
         (select sum(salao+delivery) from public.vendas_diarias v where v.loja_id = c.loja_id and v.data between c.semana + 28 and c.semana + 34),
         round((c.cmv_teorico + (random()::numeric-0.5)*0.4)::numeric,1),
         round(c.estoque_inicial*(0.97+random()::numeric*0.06)), round(c.compras*1.035*(0.95+random()::numeric*0.1)), c.transf_entrada, c.transf_saida, c.devolucoes,
         round(c.estoque_final*(0.97+random()::numeric*0.06)), c.responsavel, true
  from public.cmv_contagens c where c.semana between date '2026-10-05' and date '2026-10-19'
  on conflict (loja_id,semana) do nothing;

  insert into public.cmv_itens (loja_id,semana,item,teorico,real,justificativa,demo)
  select loja_id, date '2026-11-16', item, teorico, real, justificativa, true from public.cmv_itens where semana = date '2026-10-26'
  on conflict (loja_id,semana,item) do nothing;

  insert into public.rupturas (data,loja_id,item,motivo,horas,acao,demo)
  select data + 28, loja_id, item, motivo, horas, acao, true from public.rupturas where data between date '2026-10-04' and date '2026-10-28' and demo;

  insert into public.delivery_checklists (loja_id,data,periodo,responsavel,metas,acomp,rotina,obs,demo)
  select loja_id, data + 28, periodo, responsavel, metas, acomp, rotina, obs, true from public.delivery_checklists where data between date '2026-10-04' and date '2026-10-28' and demo;

  perform public.gerar_alertas();
end $$;
