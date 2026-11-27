-- 19 · Escalas de colaboradores (RH › Escalas): escala por unidade/mês ou proposta, linhas por pessoa
--      com o horário de cada dia (seg..sáb + domingos do mês), vínculo com o cadastro do RH e
--      mínimos por plantão (regras da casa, editáveis em config.escala_minimos)
create table if not exists public.escalas (
  id bigint generated always as identity primary key,
  unidade text not null,
  nome text not null,
  mes text check (mes ~ '^\d{4}-\d{2}$'),
  tipo text not null default 'vigente' check (tipo in ('vigente','planejada','proposta','arquivada')),
  obs text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  demo boolean not null default false
);
create table if not exists public.escala_linhas (
  id bigint generated always as identity primary key,
  escala_id bigint not null references public.escalas(id) on delete cascade,
  setor text not null default 'Cozinha' check (setor in ('Cozinha','Expedição','Limpeza','Estoque','Produção')),
  nome text not null,
  funcao text,
  vinculo text not null default 'CLT' check (vinculo in ('CLT','Freelancer V.A','Freelancer fixo','Vaga aberta','A definir')),
  colaborador_id bigint references public.colaboradores(id) on delete set null,
  ordem int not null default 0,
  dias jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists escala_linhas_escala on public.escala_linhas (escala_id, ordem);
create index if not exists escalas_unidade on public.escalas (unidade);
alter table public.escalas enable row level security;
alter table public.escala_linhas enable row level security;
create policy sel on public.escalas for select to authenticated using (public.ve_rh(unidade));
create policy ins on public.escalas for insert to authenticated with check (public.pode_editar(unidade));
create policy upd on public.escalas for update to authenticated using (public.pode_editar(unidade)) with check (public.pode_editar(unidade));
create policy del on public.escalas for delete to authenticated using (public.pode_excluir(unidade));
create policy sel on public.escala_linhas for select to authenticated using (exists (select 1 from public.escalas e where e.id = escala_id and public.ve_rh(e.unidade)));
create policy ins on public.escala_linhas for insert to authenticated with check (exists (select 1 from public.escalas e where e.id = escala_id and public.pode_editar(e.unidade)));
create policy upd on public.escala_linhas for update to authenticated using (exists (select 1 from public.escalas e where e.id = escala_id and public.pode_editar(e.unidade))) with check (exists (select 1 from public.escalas e where e.id = escala_id and public.pode_editar(e.unidade)));
create policy del on public.escala_linhas for delete to authenticated using (exists (select 1 from public.escalas e where e.id = escala_id and public.pode_editar(e.unidade)));
create trigger trg_upd before update on public.escalas for each row execute function public.tg_updated();
create trigger trg_upd before update on public.escala_linhas for each row execute function public.tg_updated();
insert into public.config (chave, valor) values ('escala_minimos', '{
  "brooklyn":    {"Cozinha":{"alm":4,"jan":4,"dom_alm":4,"dom_jan":5}},
  "perdizes":    {"Cozinha":{"alm":3,"jan":4,"dom_alm":4,"dom_jan":5}},
  "vilamariana": {"Cozinha":{"alm":3,"jan":null,"dom_alm":3,"dom_jan":4}}
}'::jsonb) on conflict (chave) do nothing;
-- carga inicial: supabase/import/gen_escalas.py (planilha ESCALAS LOJAS E ORIENTAÇÕES, nov/2026)
