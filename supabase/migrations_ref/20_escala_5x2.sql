-- 20 · Escala 5x2 obrigatória: modelo de ciclo de 4 semanas (28 dias, chaves w1seg..w4dom),
--      data de início do ciclo, grupo/posição da linha, vínculos intermitente/horista,
--      política da rede e alerta no sino para loja sem escala 5x2 ou com posições a contratar
alter table public.escalas add column if not exists modelo text not null default 'semana' check (modelo in ('semana','ciclo4'));
alter table public.escalas add column if not exists inicio date;
alter table public.escala_linhas add column if not exists grupo text;
alter table public.escala_linhas add column if not exists posicao text;
alter table public.escala_linhas drop constraint if exists escala_linhas_vinculo_check;
alter table public.escala_linhas add constraint escala_linhas_vinculo_check check (vinculo in ('CLT','Freelancer V.A','Freelancer fixo','Intermitente','Horista','Vaga aberta','A definir'));
alter table public.escala_linhas drop constraint if exists escala_linhas_setor_check;
alter table public.escala_linhas add constraint escala_linhas_setor_check check (setor in ('Cozinha','Expedição','Gestão','Limpeza','Estoque','Produção'));

insert into public.config (chave, valor) values ('escala_politica', '{"regime":"5x2","implantacao":"2026-12-16","obrigatoria":"2027-01-01","carga_semanal":44,
  "picos":[{"nome":"almoço","ini":"12:00","fim":"14:30"},{"nome":"jantar","ini":"19:00","fim":"21:30"}]}'::jsonb)
on conflict (chave) do update set valor = excluded.valor;

-- mínimos do PDF 5x2: Perdizes e Brooklin 4 por turno na cozinha (seg a qui); demais lojas 3 por turno
update public.config set valor = '{
  "brooklyn":    {"Cozinha":{"alm":4,"jan":4,"dom_alm":4,"dom_jan":5}},
  "perdizes":    {"Cozinha":{"alm":4,"jan":4,"dom_alm":4,"dom_jan":5}},
  "vilamariana": {"Cozinha":{"alm":3,"jan":3,"dom_alm":3,"dom_jan":4}},
  "tatuape":     {"Cozinha":{"alm":3,"jan":3,"dom_alm":3,"dom_jan":3}},
  "butanta":     {"Cozinha":{"alm":3,"jan":3,"dom_alm":3,"dom_jan":3}}
}'::jsonb where chave = 'escala_minimos';

create or replace function public.alertas_escala()
returns integer language plpgsql security definer set search_path = public as $$
declare c int := 0; c2 int := 0; obrig date := coalesce((select (valor->>'obrigatoria')::date from public.config where chave='escala_politica'), '2027-01-01');
begin
  -- loja em operação sem escala 5x2 lançada
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,chave)
  select l.id,'rh',case when obrig - current_date <= 15 then 'critico' else 'atencao' end,
         'Escala 5x2 obrigatória não lançada',
         'Todas as operações rodam 5x2 a partir de '||to_char(obrig,'DD/MM/YYYY')||' · lance a escala em RH › Escalas','rh','esc5x2|'||l.id
  from public.lojas l
  where l.status in ('operando','inauguracao')
    and not exists (select 1 from public.escalas e where e.unidade = l.id and e.modelo = 'ciclo4' and e.tipo in ('vigente','planejada'))
  on conflict (chave) do update set nivel = excluded.nivel, detalhe = excluded.detalhe, resolvido = false;
  get diagnostics c = row_count;
  update public.alertas a set resolvido = true where a.chave like 'esc5x2|%' and not a.resolvido
    and exists (select 1 from public.escalas e where e.unidade = split_part(a.chave,'|',2) and e.modelo = 'ciclo4' and e.tipo in ('vigente','planejada'));
  -- posições da escala 5x2 ainda sem pessoa
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,chave)
  select e.unidade,'rh','atencao',
         'Escala 5x2: '||count(*)||' '||case when count(*)>1 then 'posições' else 'posição' end||' a contratar',
         string_agg(coalesce(x.posicao,x.grupo,x.setor), ', ' order by x.ordem)||' · contratar antes de '||to_char(obrig,'DD/MM'),
         'rh','esc5x2vaga|'||e.id
  from public.escalas e join public.escala_linhas x on x.escala_id = e.id
  where e.modelo = 'ciclo4' and e.tipo in ('vigente','planejada') and x.vinculo = 'Vaga aberta'
    and e.unidade in (select id from public.lojas)
  group by e.id, e.unidade
  on conflict (chave) do update set titulo = excluded.titulo, detalhe = excluded.detalhe, resolvido = false;
  get diagnostics c2 = row_count;
  update public.alertas a set resolvido = true where a.chave like 'esc5x2vaga|%' and not a.resolvido and not exists (
    select 1 from public.escala_linhas x join public.escalas e on e.id = x.escala_id
    where 'esc5x2vaga|'||e.id = a.chave and x.vinculo = 'Vaga aberta' and e.tipo in ('vigente','planejada'));
  return c + c2;
end $$;
revoke execute on function public.alertas_escala() from public, anon, authenticated;

do $$
declare d text;
begin
  select pg_get_functiondef('public.gerar_alertas()'::regprocedure) into d;
  if position('alertas_escala' in d) = 0 then
    d := replace(d, 'n := n + public.alertas_google();', 'n := n + public.alertas_google();' || chr(10) || '  n := n + public.alertas_escala();');
    execute d;
  end if;
end $$;

-- as "propostas 5x2" da planilha de novembro ficam arquivadas: a escala 5x2 oficial é a do PDF
update public.escalas set tipo = 'arquivada', obs = 'Substituída pela escala 5x2 oficial (rodízio de 4 semanas)' where nome = 'Proposta 5x2' and tipo = 'proposta';
