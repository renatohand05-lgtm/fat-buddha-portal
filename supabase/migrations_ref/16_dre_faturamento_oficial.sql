-- 16 · DRE: faturamento do fechamento oficial (linha 'fat') e faturamento delivery (linha 'fat_del') substituem a soma das vendas
alter table public.dre_lancamentos drop constraint if exists dre_lancamentos_linha_check;
alter table public.dre_lancamentos add constraint dre_lancamentos_linha_check
  check (linha in ('fat','fat_del','imp','cmv','folha','cdel','man','mkt','cto','agua','energia'));
-- carga: fechamento oficial jan–ago/2026 de Brooklin, Perdizes e Vila Mariana (240 lançamentos), gerada de
-- "Fat_Buddha - Fechamento_ago26.ATUALIZADO.xlsx" (abas Dashboard) e conferida contra o EBITDA de cada loja e mês.
