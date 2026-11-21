-- índices de chaves estrangeiras e políticas otimizadas (aplicado em 21/11/2026)
create index if not exists avaliacoes_gerentes_colaborador_idx on public.avaliacoes_gerentes (colaborador_id);
create index if not exists expansao_cenario_idx on public.expansao (cenario_id);
create index if not exists expansao_loja_idx on public.expansao (loja_id);
create index if not exists metas_loja_idx on public.metas (loja_id);
create index if not exists ninebox_historico_colab_idx on public.ninebox_historico (colaborador_id);
create index if not exists ocorrencias_colab_idx on public.ocorrencias (colaborador_id);
create index if not exists ocorrencias_loja_idx on public.ocorrencias (loja_id, data);
create index if not exists perfil_lojas_loja_idx on public.perfil_lojas (loja_id);
drop policy sel on public.perfis;
create policy sel on public.perfis for select to authenticated using (user_id = (select auth.uid()) or (select public.meu_papel()) = 'admin');
drop policy sel on public.perfil_lojas;
create policy sel on public.perfil_lojas for select to authenticated using (user_id = (select auth.uid()) or (select public.meu_papel()) = 'admin');
