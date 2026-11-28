-- 24 · Voz do cliente: comentários das avaliações do iFood (relatório importado) e plano de ação com origem iFood
create table if not exists public.ifood_comentarios(
  id bigserial primary key,
  loja_id text not null references public.lojas(id),
  pedido text,
  data_pedido date,
  data date not null,                 -- data da avaliação
  nota numeric(3,1) check (nota between 1 and 5),
  comentario text,
  agregador text not null default 'iFood',
  origem text not null default 'csv',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create unique index if not exists ifood_comentarios_ref on public.ifood_comentarios(loja_id, coalesce(pedido,''), data, coalesce(comentario,''));
create index if not exists ifood_comentarios_data on public.ifood_comentarios(data);
alter table public.ifood_comentarios enable row level security;
drop policy if exists sel on public.ifood_comentarios; create policy sel on public.ifood_comentarios for select using (pode_ver(loja_id));
drop policy if exists ins on public.ifood_comentarios; create policy ins on public.ifood_comentarios for insert with check (pode_editar(loja_id));
drop policy if exists upd on public.ifood_comentarios; create policy upd on public.ifood_comentarios for update using (pode_editar(loja_id)) with check (pode_editar(loja_id));
drop policy if exists del on public.ifood_comentarios; create policy del on public.ifood_comentarios for delete using (pode_excluir(loja_id));
grant select, insert, update, delete on public.ifood_comentarios to authenticated;
grant usage, select on sequence public.ifood_comentarios_id_seq to authenticated;

alter table public.planos_acao drop constraint if exists planos_acao_origem_check;
alter table public.planos_acao add constraint planos_acao_origem_check check (origem = any (array['visita','delivery','indicador','manual','google','vistoria','ifood']));
