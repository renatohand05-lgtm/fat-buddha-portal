-- 17 · Notas do Google: vínculo da loja com o Google (Places API), histórico diário da nota,
--      últimas avaliações, alertas e agendamento diário da atualização

-- vínculo de cada loja com o local no Google
alter table public.lojas add column if not exists google_place_id text;
alter table public.lojas add column if not exists google_nome text;
alter table public.lojas add column if not exists google_endereco text;
alter table public.lojas add column if not exists google_uri text;

-- segredos de integração: só a função (service role) lê; nenhum acesso pelo portal
create table if not exists public.segredos (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table public.segredos enable row level security;
revoke all on public.segredos from anon, authenticated;

-- histórico diário da nota (uma linha por loja e dia)
create table if not exists public.google_notas (
  id bigserial primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  data date not null,
  nota numeric(2,1) not null check (nota between 1 and 5),
  total int not null check (total >= 0),
  fonte text not null default 'google' check (fonte in ('google','manual')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  demo boolean not null default false,
  unique (loja_id, data)
);
create index if not exists google_notas_loja_data on public.google_notas (loja_id, data);
alter table public.google_notas enable row level security;
create policy sel on public.google_notas for select to authenticated using (public.pode_ver(loja_id));
create policy ins on public.google_notas for insert to authenticated with check (public.gestor() and fonte = 'manual');
create policy upd on public.google_notas for update to authenticated using (public.gestor() and fonte = 'manual') with check (public.gestor() and fonte = 'manual');
create policy del on public.google_notas for delete to authenticated using (public.gestor());
create trigger trg_hist after insert or update or delete on public.google_notas for each row execute function public.tg_historico();

-- avaliações mais recentes que o Google devolve (renovadas a cada atualização)
create table if not exists public.google_reviews (
  id text primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  nota int not null check (nota between 1 and 5),
  autor text,
  texto text,
  publicado_em timestamptz,
  relativo text,
  uri text,
  atualizado_em timestamptz not null default now(),
  visto_em timestamptz not null default now()
);
create index if not exists google_reviews_loja on public.google_reviews (loja_id, publicado_em desc);
alter table public.google_reviews enable row level security;
create policy sel on public.google_reviews for select to authenticated using (public.pode_ver(loja_id));

-- plano de ação a partir de uma avaliação do Google
alter table public.planos_acao drop constraint if exists planos_acao_origem_check;
alter table public.planos_acao add constraint planos_acao_origem_check check (origem in ('visita','delivery','indicador','manual','google'));

-- alertas: nota abaixo da meta; avaliação nova de 1 ou 2 estrelas
alter table public.alertas drop constraint if exists alertas_tipo_check;
alter table public.alertas add constraint alertas_tipo_check check (tipo in ('temperatura','cmv','plano','ruptura','contagem','rh','google'));

create or replace function public.alertas_google()
returns integer language plpgsql security definer set search_path = public as $$
declare c int := 0; c2 int := 0; meta numeric := coalesce((select (valor->>'meta')::numeric from public.config where chave = 'google_meta'), 4.5);
begin
  -- nota atual (último registro de cada loja) abaixo da meta
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,ref_id,chave)
  select g.loja_id, 'google', case when g.nota < meta - 0.3 then 'critico' else 'atencao' end,
         'Nota do Google abaixo da meta: '||replace(g.nota::text,'.',','),
         'Meta '||replace(to_char(meta,'FM0.0'),'.',',')||' · '||g.total||' avaliações · posição de '||to_char(g.data,'DD/MM'),
         'qualidade', g.id, 'google|nota|'||g.loja_id
  from (select distinct on (loja_id) * from public.google_notas where not demo order by loja_id, data desc) g
  where g.nota < meta
  on conflict (chave) do update set titulo = excluded.titulo, detalhe = excluded.detalhe, nivel = excluded.nivel, ref_id = excluded.ref_id;
  get diagnostics c = row_count;
  update public.alertas a set resolvido = true where a.chave like 'google|nota|%' and not a.resolvido and not exists (
    select 1 from (select distinct on (loja_id) * from public.google_notas where not demo order by loja_id, data desc) g
    where g.nota < meta and a.chave = 'google|nota|'||g.loja_id);
  -- avaliação de 1 ou 2 estrelas publicada nos últimos 3 dias
  insert into public.alertas (loja_id,tipo,nivel,titulo,detalhe,aba,chave)
  select r.loja_id, 'google', 'critico', 'Avaliação de '||r.nota||' estrela'||case when r.nota > 1 then 's' else '' end||' no Google',
         coalesce(r.autor,'Cliente')||' · '||left(coalesce(nullif(btrim(r.texto),''),'sem comentário'),140),
         'qualidade', 'google|rev|'||r.id
  from public.google_reviews r
  where r.nota <= 2 and r.publicado_em > now() - interval '3 days'
  on conflict (chave) do nothing;
  get diagnostics c2 = row_count;
  return c + c2;
end $$;
revoke execute on function public.alertas_google() from public, anon, authenticated;

do $$
declare d text;
begin
  select pg_get_functiondef('public.gerar_alertas()'::regprocedure) into d;
  if position('alertas_google' in d) = 0 then
    d := replace(d, 'n := n + public.alertas_vagas();', 'n := n + public.alertas_vagas();' || chr(10) || '  n := n + public.alertas_google();');
    execute d;
  end if;
end $$;

-- demonstração: limpar_demo também remove notas de exemplo
do $$
declare d text;
begin
  select pg_get_functiondef('public.limpar_demo()'::regprocedure) into d;
  if position('google_notas' in d) = 0 then
    d := replace(d, '''vagas'',', '''vagas'',''google_notas'',');
    execute d;
  end if;
end $$;

-- agendamento: todo dia às 6h, 15h e 22h (Brasília = UTC-3; o pg_cron roda em UTC)
insert into public.cron_tokens (chave, valor) values ('google', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (chave) do nothing;
select cron.unschedule('google-notas') where exists (select 1 from cron.job where jobname = 'google-notas');
select cron.schedule('google-notas', '2 1,9,18 * * *', $c$
  select net.http_post(
    url := 'https://akcbpjlsfarcfzmtkdle.supabase.co/functions/v1/google-notas',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select valor from public.cron_tokens where chave='google')),
    body := '{"acao":"atualizar"}'::jsonb)
$c$);
