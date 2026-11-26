-- 18 · Vistoria diária de operações (relatório de campo GG V6): checklist Conforme/Ajustar,
--      leitura, retorno da vistoria anterior e plano de ação (itens * entram no P.A. semanal)
create table if not exists public.vistorias_operacao (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  data date not null,
  hora time,
  turno text check (turno in ('Manhã','Tarde','Noite','Fechamento')),
  responsavel text,
  lider text,
  pessoas_cozinha int check (pessoas_cozinha >= 0),
  pessoas_expedicao int check (pessoas_expedicao >= 0),
  respostas jsonb not null default '{}'::jsonb,
  secoes jsonb,
  conforme int not null default 0,
  ajustar int not null default 0,
  score numeric,
  leitura_bom text,
  leitura_ajustar text,
  retorno jsonb,
  lider_ciente boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  demo boolean not null default false
);
create index if not exists vistorias_operacao_loja_data on public.vistorias_operacao (loja_id, data desc);
alter table public.vistorias_operacao enable row level security;
create policy sel on public.vistorias_operacao for select to authenticated using (public.pode_ver(loja_id));
create policy ins on public.vistorias_operacao for insert to authenticated with check (public.pode_editar(loja_id));
create policy upd on public.vistorias_operacao for update to authenticated using (public.pode_editar(loja_id)) with check (public.pode_editar(loja_id));
create policy del on public.vistorias_operacao for delete to authenticated using (public.pode_excluir(loja_id));
create trigger trg_hist after insert or update or delete on public.vistorias_operacao for each row execute function public.tg_historico();

alter table public.planos_acao drop constraint if exists planos_acao_origem_check;
alter table public.planos_acao add constraint planos_acao_origem_check check (origem in ('visita','delivery','indicador','manual','google','vistoria'));
alter table public.planos_acao add column if not exists pa_semanal boolean not null default false;

do $$
declare d text;
begin
  select pg_get_functiondef('public.limpar_demo()'::regprocedure) into d;
  if position('vistorias_operacao' in d) = 0 then
    d := replace(d, '''visitas_qualidade'',', '''visitas_qualidade'',''vistorias_operacao'',');
    execute d;
  end if;
end $$;
