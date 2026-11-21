-- =====================================================================
-- FAT BUDDHA · PORTAL OPERACIONAL — schema
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- cadastro ----------
create table public.lojas (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  nome text not null,
  status text not null default 'operando' check (status in ('operando','inauguracao','fechada')),
  canais text not null default 'delivery' check (canais in ('delivery','salao+delivery','salao')),
  inauguracao text,                 -- texto livre ("Novembro de 2026")
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  papel text check (papel in ('admin','consultor','diretoria','regional','gerente','colaborador')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.perfil_lojas (
  user_id uuid not null references public.perfis(user_id) on delete cascade,
  loja_id text not null references public.lojas(id) on delete cascade,
  primary key (user_id, loja_id)
);

-- configurações gerais (premissas do DRE, orçamento, tolerância do CMV, piso por loja...)
create table public.config (
  chave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- ---------- metas ----------
-- histórico: nunca se altera uma meta; insere-se uma nova vigência
create table public.metas (
  id bigint generated always as identity primary key,
  indicador text not null,
  loja_id text references public.lojas(id) on delete cascade,   -- null = meta da rede
  valor numeric,                                                 -- null = só acompanhar
  direcao text check (direcao in ('min','max')),
  vigente_desde date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.metas (indicador, loja_id, vigente_desde desc);

create table public.metas_vendas (
  loja_id text not null references public.lojas(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  valor numeric not null check (valor >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (loja_id, mes)
);

-- ---------- vendas ----------
create table public.vendas_diarias (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  data date not null,
  salao numeric not null default 0 check (salao >= 0),
  delivery numeric not null default 0 check (delivery >= 0),
  pedidos_salao int not null default 0 check (pedidos_salao >= 0),
  pedidos_delivery int not null default 0 check (pedidos_delivery >= 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (loja_id, data)
);
create index on public.vendas_diarias (data);

create table public.vendas_hora (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  data date not null,
  hora smallint not null check (hora between 0 and 23),
  salao numeric not null default 0 check (salao >= 0),
  delivery numeric not null default 0 check (delivery >= 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (loja_id, data, hora)
);
create index on public.vendas_hora (data);

-- indicadores operacionais que não nascem de outro módulo
create table public.indicadores_mensais (
  loja_id text not null references public.lojas(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  preparo numeric, cancel numeric, ifood numeric, online numeric,
  comp numeric,                 -- usado só se não houver venda do mesmo mês do ano anterior
  folha_valor numeric,          -- custo de pessoal em R$ (pessoal % = folha / faturamento)
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (loja_id, mes)
);

-- ---------- CMV ----------
create table public.cmv_contagens (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  semana date not null,
  vendas numeric not null check (vendas > 0),
  cmv_teorico numeric not null check (cmv_teorico >= 0),
  estoque_inicial numeric not null default 0,
  compras numeric not null default 0,
  transf_entrada numeric not null default 0,
  transf_saida numeric not null default 0,
  devolucoes numeric not null default 0,
  estoque_final numeric not null default 0,
  responsavel text,
  obs text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (loja_id, semana)
);

create table public.cmv_itens (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  semana date not null,
  item text not null,
  teorico numeric not null,
  real numeric not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (loja_id, semana, item)
);

-- ---------- cozinha central ----------
create table public.estoque_cc (
  id bigint generated always as identity primary key,
  item text not null unique,
  un text not null default 'un',
  atual numeric not null default 0,
  minimo numeric not null default 0,
  consumo_dia numeric not null default 0,
  custo numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create table public.rupturas (
  id bigint generated always as identity primary key,
  data date not null,
  loja_id text not null references public.lojas(id) on delete cascade,
  item text not null,
  motivo text not null,
  horas numeric not null default 0,
  acao text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.rupturas (loja_id, data);

-- ---------- DRE ----------
create table public.dre_premissas_loja (
  loja_id text primary key references public.lojas(id) on delete cascade,
  valores jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- valores realizados (substituem a estimativa da premissa na linha correspondente)
create table public.dre_lancamentos (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  linha text not null check (linha in ('imp','cmv','folha','cdel','man','mkt','cto','agua','energia')),
  valor numeric not null,
  obs text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (loja_id, mes, linha)
);

-- ---------- orçamento e expansão ----------
create table public.orc_cenarios (
  id bigint generated always as identity primary key,
  nome text not null,
  premissas jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.expansao (
  id bigint generated always as identity primary key,
  nome text not null,
  abertura text,                -- texto ("1º semestre de 2027")
  data_prevista date,
  loja_id text references public.lojas(id) on delete set null,
  cenario_id bigint references public.orc_cenarios(id) on delete set null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ---------- RH ----------
create table public.colaboradores (
  id bigint generated always as identity primary key,
  nome text not null,
  cargo text not null,
  loja_id text not null references public.lojas(id) on delete restrict,
  admissao date not null,
  desligamento date,
  desempenho smallint not null default 2 check (desempenho between 1 and 3),
  potencial smallint not null default 2 check (potencial between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index on public.colaboradores (loja_id);

create table public.ninebox_historico (
  id bigint generated always as identity primary key,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  desempenho smallint not null, potencial smallint not null,
  ant_desempenho smallint, ant_potencial smallint,
  em timestamptz not null default now(),
  por uuid default auth.uid()
);

create table public.quadro_previsto (
  loja_id text not null references public.lojas(id) on delete cascade,
  cargo text not null,
  previsto int not null default 0 check (previsto >= 0),
  primary key (loja_id, cargo)
);

create table public.lideranca (
  loja_id text not null references public.lojas(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  nota numeric not null check (nota between 0 and 5),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (loja_id, mes)
);

create table public.rh_movimentos (
  loja_id text not null references public.lojas(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  headcount numeric not null check (headcount > 0),
  admissoes int not null default 0,
  desligamentos int not null default 0,
  faltas numeric not null default 0,
  dias_previstos numeric not null check (dias_previstos > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (loja_id, mes)
);

create table public.ocorrencias (
  id bigint generated always as identity primary key,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  loja_id text not null references public.lojas(id) on delete cascade,
  tipo text not null,
  data date not null,
  status text not null,
  motivo text not null,
  responsavel text,
  obs text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

create table public.avaliacoes_gerentes (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  colaborador_id bigint references public.colaboradores(id) on delete set null,
  periodo text not null check (periodo ~ '^\d{4}-\d{2}$'),
  score numeric not null,
  componentes jsonb not null,
  recomendacao text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (loja_id, periodo)
);

-- ---------- checklists ----------
create table public.visitas_qualidade (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  data date not null,
  avaliador text,
  gerente text,
  score numeric not null,
  sim int not null, nao int not null,
  secoes jsonb not null,
  respostas jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.visitas_qualidade (loja_id, data desc);

create table public.delivery_checklists (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  data date not null,
  periodo text not null check (periodo in ('Diário','Semanal')),
  responsavel text,
  metas jsonb not null default '{}',
  acomp jsonb not null default '{}',
  rotina jsonb not null default '{}',
  obs text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.delivery_checklists (loja_id, data desc);

-- ---------- planos de ação ----------
create table public.planos_acao (
  id bigint generated always as identity primary key,
  loja_id text not null references public.lojas(id) on delete cascade,
  origem text not null check (origem in ('visita','delivery','indicador','manual')),
  origem_id bigint,
  problema text not null,
  secao text,
  acao text,
  responsavel text,
  prazo date,
  prioridade text not null default 'Média' check (prioridade in ('Alta','Média','Baixa')),
  status text not null default 'Pendente' check (status in ('Pendente','Em andamento','Concluído','Cancelado')),
  concluido_em date,
  evidencia text,
  obs text,
  verificado boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create index on public.planos_acao (loja_id, status);

-- ---------- histórico / auditoria ----------
create table public.historico (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro text,
  acao text not null,
  antes jsonb,
  depois jsonb,
  user_id uuid default auth.uid(),
  em timestamptz not null default now()
);
create index on public.historico (tabela, em desc);
