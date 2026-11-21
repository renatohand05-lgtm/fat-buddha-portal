-- Carga dos dados de demonstração a partir de demo/seed.json (gerado do painel HTML original)
do $$
declare j jsonb; r record; v bigint; vids bigint[] := '{}';
begin
  select content::jsonb into j from extensions.http_get('https://raw.githubusercontent.com/renatohand05-lgtm/fat-buddha-portal/main/demo/seed.json');
  if j is null or j->'vendas_diarias' is null then raise exception 'seed.json não carregado'; end if;

  insert into public.vendas_diarias (loja_id,data,salao,delivery,pedidos_salao,pedidos_delivery,demo)
  select loja_id,data,salao,delivery,pedidos_salao,pedidos_delivery,true from jsonb_to_recordset(j->'vendas_diarias') x(loja_id text,data date,salao numeric,delivery numeric,pedidos_salao int,pedidos_delivery int)
  on conflict (loja_id,data) do nothing;
  insert into public.vendas_hora (loja_id,data,hora,salao,delivery,demo)
  select loja_id,data,hora,salao,delivery,true from jsonb_to_recordset(j->'vendas_hora') x(loja_id text,data date,hora int,salao numeric,delivery numeric)
  on conflict (loja_id,data,hora) do nothing;
  insert into public.indicadores_mensais (loja_id,mes,preparo,cancel,ifood,online,comp,folha_valor,demo)
  select loja_id,mes,preparo,cancel,ifood,online,comp,folha_valor,true from jsonb_to_recordset(j->'indicadores_mensais') x(loja_id text,mes text,preparo numeric,cancel numeric,ifood numeric,online numeric,comp numeric,folha_valor numeric)
  on conflict (loja_id,mes) do nothing;
  insert into public.metas_vendas (loja_id,mes,valor)
  select loja_id,mes,valor from jsonb_to_recordset(j->'metas_vendas') x(loja_id text,mes text,valor numeric)
  on conflict (loja_id,mes) do nothing;
  insert into public.cmv_contagens (loja_id,semana,vendas,cmv_teorico,estoque_inicial,compras,estoque_final,responsavel,demo)
  select loja_id,semana,vendas,cmv_teorico,estoque_inicial,compras,estoque_final,responsavel,true from jsonb_to_recordset(j->'cmv_contagens') x(loja_id text,semana date,vendas numeric,cmv_teorico numeric,estoque_inicial numeric,compras numeric,estoque_final numeric,responsavel text)
  on conflict (loja_id,semana) do nothing;
  insert into public.cmv_itens (loja_id,semana,item,teorico,real,demo)
  select loja_id,semana,item,teorico,real,true from jsonb_to_recordset(j->'cmv_itens') x(loja_id text,semana date,item text,teorico numeric,real numeric)
  on conflict (loja_id,semana,item) do nothing;
  insert into public.estoque_cc (item,un,atual,minimo,consumo_dia,custo,demo)
  select item,un,atual,minimo,consumo_dia,custo,true from jsonb_to_recordset(j->'estoque_cc') x(item text,un text,atual numeric,minimo numeric,consumo_dia numeric,custo numeric)
  on conflict (item) do nothing;
  insert into public.rupturas (data,loja_id,item,motivo,horas,acao,demo)
  select data,loja_id,item,motivo,horas,acao,true from jsonb_to_recordset(j->'rupturas') x(data date,loja_id text,item text,motivo text,horas numeric,acao text);
  insert into public.quadro_previsto (loja_id,cargo,previsto)
  select loja_id,cargo,previsto from jsonb_to_recordset(j->'quadro_previsto') x(loja_id text,cargo text,previsto int)
  on conflict (loja_id,cargo) do update set previsto=excluded.previsto;
  insert into public.lideranca (loja_id,mes,nota,demo)
  select loja_id,mes,nota,true from jsonb_to_recordset(j->'lideranca') x(loja_id text,mes text,nota numeric)
  on conflict (loja_id,mes) do nothing;
  insert into public.rh_movimentos (loja_id,mes,headcount,admissoes,desligamentos,faltas,dias_previstos,demo)
  select loja_id,mes,headcount,admissoes,desligamentos,faltas,dias_previstos,true from jsonb_to_recordset(j->'rh_movimentos') x(loja_id text,mes text,headcount numeric,admissoes int,desligamentos int,faltas numeric,dias_previstos numeric)
  on conflict (loja_id,mes) do nothing;

  create temp table _map(ref int, id bigint) on commit drop;
  for r in select * from jsonb_to_recordset(j->'colaboradores') x(ref int,nome text,cargo text,loja_id text,admissao date,desempenho int,potencial int) loop
    insert into public.colaboradores (nome,cargo,loja_id,admissao,desempenho,potencial,demo) values (r.nome,r.cargo,r.loja_id,r.admissao,r.desempenho,r.potencial,true) returning id into v;
    insert into _map values (r.ref, v);
  end loop;
  insert into public.ocorrencias (colaborador_id,loja_id,tipo,data,status,motivo,responsavel,demo)
  select m.id,c.loja_id,x.tipo,x.data,x.status,x.motivo,x.responsavel,true from jsonb_to_recordset(j->'ocorrencias') x(ref int,tipo text,data date,status text,motivo text,responsavel text)
  join _map m on m.ref=x.ref join public.colaboradores c on c.id=m.id;

  for r in select * from jsonb_array_elements(j->'visitas_qualidade') with ordinality e(o,i) order by i loop
    insert into public.visitas_qualidade (loja_id,data,avaliador,gerente,score,sim,nao,secoes,respostas,demo)
    values (r.o->>'loja_id',(r.o->>'data')::date,r.o->>'avaliador',r.o->>'gerente',(r.o->>'score')::numeric,(r.o->>'sim')::int,(r.o->>'nao')::int,r.o->'secoes',r.o->'respostas',true) returning id into v;
    vids := vids || v;
  end loop;
  insert into public.planos_acao (loja_id,origem,origem_id,problema,secao,acao,responsavel,prazo,prioridade,status,demo)
  select loja_id,origem,vids[vis+1],problema,secao,acao,responsavel,prazo,prioridade,status,true from jsonb_to_recordset(j->'planos_acao') x(vis int,loja_id text,origem text,problema text,secao text,acao text,responsavel text,prazo date,prioridade text,status text);
  insert into public.delivery_checklists (loja_id,data,periodo,responsavel,metas,acomp,rotina,demo)
  select loja_id,data,periodo,responsavel,metas,acomp,rotina,true from jsonb_to_recordset(j->'delivery_checklists') x(loja_id text,data date,periodo text,responsavel text,metas jsonb,acomp jsonb,rotina jsonb);

  insert into public.config (chave,valor) values ('demo_info', jsonb_build_object('carregado_em',now(),'origem','painel-operacional-fat-buddha.html'))
  on conflict (chave) do update set valor=excluded.valor;
end $$;
