-- =====================================================================
-- RLS
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['lojas','perfis','perfil_lojas','config','metas','metas_vendas','vendas_diarias','vendas_hora',
    'indicadores_mensais','cmv_contagens','cmv_itens','estoque_cc','rupturas','dre_premissas_loja','dre_lancamentos',
    'orc_cenarios','expansao','colaboradores','ninebox_historico','quadro_previsto','lideranca','rh_movimentos',
    'ocorrencias','avaliacoes_gerentes','visitas_qualidade','delivery_checklists','planos_acao','historico'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- auditoria em todas as tabelas de dados
do $$
declare t text;
begin
  foreach t in array array['lojas','perfis','perfil_lojas','config','metas','metas_vendas','vendas_diarias','vendas_hora',
    'indicadores_mensais','cmv_contagens','cmv_itens','estoque_cc','rupturas','dre_premissas_loja','dre_lancamentos',
    'orc_cenarios','expansao','colaboradores','quadro_previsto','lideranca','rh_movimentos',
    'ocorrencias','avaliacoes_gerentes','visitas_qualidade','delivery_checklists','planos_acao'] loop
    execute format('create trigger trg_hist after insert or update or delete on public.%I for each row execute function public.tg_historico()', t);
  end loop;
end $$;

-- lojas: todos com papel veem as lojas que podem ver; só gestor cadastra
create policy sel on public.lojas for select to authenticated using (public.pode_ver(id));
create policy ins on public.lojas for insert to authenticated with check (public.gestor());
create policy upd on public.lojas for update to authenticated using (public.gestor()) with check (public.gestor());
create policy del on public.lojas for delete to authenticated using (public.meu_papel() = 'admin');

-- perfis: cada um vê o próprio; admin vê e altera todos (papel só muda pela função de gestão ou admin)
create policy sel on public.perfis for select to authenticated using (user_id = auth.uid() or public.meu_papel() = 'admin');
create policy upd on public.perfis for update to authenticated using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');
create policy sel on public.perfil_lojas for select to authenticated using (user_id = auth.uid() or public.meu_papel() = 'admin');
create policy ins on public.perfil_lojas for insert to authenticated with check (public.meu_papel() = 'admin');
create policy del on public.perfil_lojas for delete to authenticated using (public.meu_papel() = 'admin');

-- config e metas: leitura para quem tem papel; escrita para gestor
create policy sel on public.config for select to authenticated using (public.meu_papel() is not null);
create policy ins on public.config for insert to authenticated with check (public.gestor());
create policy upd on public.config for update to authenticated using (public.gestor()) with check (public.gestor());

create policy sel on public.metas for select to authenticated using (public.meu_papel() is not null and (loja_id is null or public.pode_ver(loja_id)));
create policy ins on public.metas for insert to authenticated with check (public.gestor());

create policy sel on public.metas_vendas for select to authenticated using (public.pode_ver(loja_id));
create policy ins on public.metas_vendas for insert to authenticated with check (public.gestor());
create policy upd on public.metas_vendas for update to authenticated using (public.gestor()) with check (public.gestor());
create policy del on public.metas_vendas for delete to authenticated using (public.gestor());

-- padrão "por loja": ver = pode_ver, gravar = pode_editar, excluir = pode_excluir
do $$
declare t text;
begin
  foreach t in array array['vendas_diarias','vendas_hora','indicadores_mensais','cmv_contagens','cmv_itens',
    'dre_lancamentos','lideranca','visitas_qualidade','planos_acao','avaliacoes_gerentes'] loop
    execute format('create policy sel on public.%I for select to authenticated using (public.pode_ver(loja_id))', t);
    execute format('create policy ins on public.%I for insert to authenticated with check (public.pode_editar(loja_id))', t);
    execute format('create policy upd on public.%I for update to authenticated using (public.pode_editar(loja_id)) with check (public.pode_editar(loja_id))', t);
    execute format('create policy del on public.%I for delete to authenticated using (public.pode_excluir(loja_id))', t);
  end loop;
end $$;

-- operacionais: colaborador autorizado também lança
do $$
declare t text;
begin
  foreach t in array array['rupturas','delivery_checklists'] loop
    execute format('create policy sel on public.%I for select to authenticated using (public.pode_ver(loja_id))', t);
    execute format('create policy ins on public.%I for insert to authenticated with check (public.pode_operar(loja_id))', t);
    execute format('create policy upd on public.%I for update to authenticated using (public.pode_editar(loja_id)) with check (public.pode_editar(loja_id))', t);
    execute format('create policy del on public.%I for delete to authenticated using (public.pode_excluir(loja_id))', t);
  end loop;
end $$;

-- premissas do DRE por loja: gestor
create policy sel on public.dre_premissas_loja for select to authenticated using (public.pode_ver(loja_id));
create policy ins on public.dre_premissas_loja for insert to authenticated with check (public.gestor());
create policy upd on public.dre_premissas_loja for update to authenticated using (public.gestor()) with check (public.gestor());
create policy del on public.dre_premissas_loja for delete to authenticated using (public.gestor());

-- estoque da cozinha central (rede): todos com papel veem; gestor e regional editam
create policy sel on public.estoque_cc for select to authenticated using (public.meu_papel() is not null);
create policy ins on public.estoque_cc for insert to authenticated with check (public.meu_papel() in ('admin','consultor','regional'));
create policy upd on public.estoque_cc for update to authenticated using (public.meu_papel() in ('admin','consultor','regional')) with check (public.meu_papel() in ('admin','consultor','regional'));
create policy del on public.estoque_cc for delete to authenticated using (public.gestor());

-- orçamento e expansão: admin, consultor e diretoria
create policy sel on public.orc_cenarios for select to authenticated using (public.ve_tudo());
create policy ins on public.orc_cenarios for insert to authenticated with check (public.ve_tudo());
create policy del on public.orc_cenarios for delete to authenticated using (public.ve_tudo());
create policy sel on public.expansao for select to authenticated using (public.ve_tudo());
create policy ins on public.expansao for insert to authenticated with check (public.gestor());
create policy upd on public.expansao for update to authenticated using (public.gestor()) with check (public.gestor());
create policy del on public.expansao for delete to authenticated using (public.gestor());

-- RH
create policy sel on public.colaboradores for select to authenticated using (public.ve_rh(loja_id));
create policy ins on public.colaboradores for insert to authenticated with check (public.pode_editar(loja_id));
create policy upd on public.colaboradores for update to authenticated using (public.pode_editar(loja_id)) with check (public.pode_editar(loja_id));
create policy del on public.colaboradores for delete to authenticated using (public.gestor());
create policy sel on public.ninebox_historico for select to authenticated
  using (exists (select 1 from public.colaboradores c where c.id = colaborador_id and public.ve_rh(c.loja_id)));
create policy sel on public.quadro_previsto for select to authenticated using (public.ve_rh(loja_id));
create policy ins on public.quadro_previsto for insert to authenticated with check (public.gestor());
create policy upd on public.quadro_previsto for update to authenticated using (public.gestor()) with check (public.gestor());
create policy del on public.quadro_previsto for delete to authenticated using (public.gestor());
create policy sel on public.rh_movimentos for select to authenticated using (public.ve_rh(loja_id));
create policy ins on public.rh_movimentos for insert to authenticated with check (public.pode_editar(loja_id));
create policy upd on public.rh_movimentos for update to authenticated using (public.pode_editar(loja_id)) with check (public.pode_editar(loja_id));
create policy del on public.rh_movimentos for delete to authenticated using (public.pode_excluir(loja_id));
create policy sel on public.ocorrencias for select to authenticated using (public.ve_ocorrencias(loja_id));
create policy ins on public.ocorrencias for insert to authenticated with check (public.ve_ocorrencias(loja_id));
create policy upd on public.ocorrencias for update to authenticated using (public.ve_ocorrencias(loja_id)) with check (public.ve_ocorrencias(loja_id));
create policy del on public.ocorrencias for delete to authenticated using (public.pode_excluir(loja_id));

-- histórico: admin e consultor
create policy sel on public.historico for select to authenticated using (public.gestor());

-- consistência: ocorrência pertence à loja do colaborador
create or replace function public.tg_oc_loja() returns trigger language plpgsql security definer set search_path = public as $$
begin
  select loja_id into new.loja_id from public.colaboradores where id = new.colaborador_id;
  return new;
end $$;
create trigger trg_oc_loja before insert or update on public.ocorrencias for each row execute function public.tg_oc_loja();

-- grants básicos
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.historico, public.ninebox_historico from authenticated;
