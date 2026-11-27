-- 22 · Envio das contagens e checklists para o Drive e o e-mail do Lucas
--      O portal grava cada contagem/checklist salvo numa fila (envios_drive). A função drive-enviar manda cada item
--      para um script do Google (Apps Script) na conta do Lucas, que acrescenta as linhas numa planilha do Drive dele
--      (uma aba por tipo e mês) e envia o e-mail com o resultado. A fila guarda tudo até o script estar ligado.
create table if not exists public.envios_drive (
  id bigserial primary key,
  tipo text not null check (tipo in ('controle_diario','contagem_cc','cmv_semanal','cmv_item','visita_qualidade','checklist_delivery','vistoria_operacao')),
  loja_id text references public.lojas(id) on delete set null,
  ref text not null,                 -- chave do registro: ao salvar de novo, a planilha troca as linhas antigas pelas novas
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  titulo text not null,
  aba text not null,
  colunas jsonb not null,
  linhas jsonb not null,
  resumo jsonb,                      -- pares rótulo/valor mostrados no e-mail
  destaques jsonb,                   -- linhas de texto em destaque no e-mail (ex.: itens "Não")
  tabela boolean not null default true,
  autor text,
  criado_em timestamptz not null default now(),
  created_by uuid default auth.uid(),
  enviado_em timestamptz,
  tentativas int not null default 0,
  erro text,
  planilha_url text
);
create index if not exists envios_drive_pend on public.envios_drive (id) where enviado_em is null;

alter table public.envios_drive enable row level security;
create policy ins on public.envios_drive for insert to authenticated
  with check (created_by = auth.uid() and (loja_id is null or public.pode_ver(loja_id)));
create policy sel on public.envios_drive for select to authenticated using (public.gestor() or created_by = auth.uid());

insert into public.config (chave, valor) values ('drive_envio', '{"ativo":true,"url":null,"para":["lucas@fatbuddha.com.br"]}'::jsonb)
on conflict (chave) do nothing;
-- segredo compartilhado com o script do Google e token do agendamento
insert into public.cron_tokens (chave, valor) values ('drive_segredo', encode(extensions.gen_random_bytes(18), 'hex')) on conflict (chave) do nothing;
insert into public.cron_tokens (chave, valor) values ('drive', encode(extensions.gen_random_bytes(24), 'hex')) on conflict (chave) do nothing;

-- reenvio do que ficou na fila (script fora do ar, sem URL ainda etc.) a cada 10 minutos
select cron.unschedule('drive-enviar') where exists (select 1 from cron.job where jobname = 'drive-enviar');
select cron.schedule('drive-enviar', '*/10 * * * *', $c$
  select net.http_post(
    url := 'https://akcbpjlsfarcfzmtkdle.supabase.co/functions/v1/drive-enviar',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select valor from public.cron_tokens where chave='drive')),
    body := '{"acao":"enviar"}'::jsonb)
  where exists (select 1 from public.envios_drive where enviado_em is null and tentativas < 12)
    and coalesce((select valor->>'url' from public.config where chave='drive_envio'), '') <> ''
$c$);
