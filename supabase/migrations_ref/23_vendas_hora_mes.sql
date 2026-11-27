-- 23 · Faturamento por hora acumulado do mês (relatório "Faturamento por hora e loja" do Colibri)
--      Usado quando a loja não tem as vendas dia a dia: faturamento do mês, pedidos, ticket, horário de pico e
--      a curva real de demanda da proposta de escala 5x2.
create table if not exists public.vendas_hora_mes (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  hora smallint not null check (hora between 0 and 23),
  valor numeric not null default 0 check (valor >= 0),          -- valor total
  servico numeric not null default 0 check (servico >= 0),      -- serviço/taxa
  total_real numeric not null default 0 check (total_real >= 0),-- valor total − serviço/taxa
  pessoas int not null default 0 check (pessoas >= 0),
  ate date,                                                     -- acumulado até este dia
  fonte text not null default 'Colibri',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (loja_id, mes, hora)
);
alter table public.vendas_hora_mes enable row level security;
create policy sel on public.vendas_hora_mes for select to authenticated using (public.pode_ver(loja_id));
create policy ins on public.vendas_hora_mes for insert to authenticated with check (public.pode_editar(loja_id));
create policy upd on public.vendas_hora_mes for update to authenticated using (public.pode_editar(loja_id)) with check (public.pode_editar(loja_id));
create policy del on public.vendas_hora_mes for delete to authenticated using (public.pode_excluir(loja_id));
