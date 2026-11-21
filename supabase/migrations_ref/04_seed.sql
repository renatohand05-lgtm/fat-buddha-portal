insert into public.lojas (id,nome,status,canais,inauguracao,ordem) values
 ('brooklyn','Brooklyn','operando','salao+delivery',null,1),
 ('perdizes','Perdizes','operando','delivery',null,2),
 ('vilamariana','Vila Mariana','operando','delivery',null,3),
 ('tatuape','Tatuapé','operando','delivery',null,4),
 ('butanta','Butantã','inauguracao','delivery','Novembro de 2026',5);

insert into public.metas (indicador,loja_id,valor,direcao,vigente_desde) values
 ('fat',null,500000,'min','2026-01-01'),('pctMeta',null,100,'min','2026-01-01'),('comp',null,6,'min','2026-01-01'),
 ('cmv',null,21,'max','2026-01-01'),('pessoal',null,19,'max','2026-01-01'),('preparo',null,15,'max','2026-01-01'),
 ('cancel',null,2,'max','2026-01-01'),('ifood',null,4.7,'min','2026-01-01'),('online',null,97,'min','2026-01-01'),
 ('rupturas',null,5,'max','2026-01-01'),('absent',null,null,null,'2026-01-01'),('turnover',null,null,null,'2026-01-01'),
 ('qualidade',null,90,'min','2026-01-01');

insert into public.metas_vendas (loja_id,mes,valor)
select l, m, v from (values ('brooklyn',1000000),('perdizes',950000),('vilamariana',500000),('tatuape',500000),('butanta',500000)) a(l,v)
cross join (values ('2026-11'),('2026-12')) b(m);

insert into public.config (chave,valor) values
 ('dre','{"impostos":10,"delivery":28,"deliveryBase":"delivery","manutencao":1.5,"marketing":7,"cto":12000,"agua":1500,"energia":4500,"cmv":21,"pessoal":19}'),
 ('orcamento','{"faturamento":500000,"mixDelivery":100,"cmv":21,"folha":19,"impostos":10,"delivery":28,"deliveryBase":"delivery","manutencao":1.5,"marketing":7,"cto":12000,"agua":1500,"energia":4500,"curva":[70,80,90,95,100,100]}'),
 ('cmv_tol','1'),
 ('piso_loja','500000'),
 ('projecao10','{"lojasBase":["brooklyn","perdizes"],"novasLojas":8,"faturamentoMinimo":500000}'),
 ('peso_dia_semana','{"seg":0.85,"ter":0.9,"qua":0.95,"qui":1,"sex":1.25,"sab":1.35,"dom":1.15}'),
 ('horas','[11,12,13,14,15,16,17,18,19,20,21,22,23]');

insert into public.dre_premissas_loja (loja_id,valores) values ('vilamariana','{"delivery":27}');

insert into public.quadro_previsto (loja_id,cargo,previsto) values
 ('brooklyn','Gerente de loja',1),('brooklyn','Chefe de cozinha',1),('brooklyn','Líder de delivery',2),('brooklyn','Auxiliar de cozinha',13),('brooklyn','Atendente',8),
 ('perdizes','Gerente de loja',1),('perdizes','Chefe de cozinha',1),('perdizes','Líder de delivery',2),('perdizes','Auxiliar de cozinha',12),('perdizes','Atendente',7),
 ('vilamariana','Gerente de loja',1),('vilamariana','Chefe de cozinha',1),('vilamariana','Líder de delivery',1),('vilamariana','Auxiliar de cozinha',8),('vilamariana','Atendente',5),
 ('tatuape','Gerente de loja',1),('tatuape','Chefe de cozinha',1),('tatuape','Líder de delivery',1),('tatuape','Auxiliar de cozinha',6),('tatuape','Atendente',4),
 ('butanta','Gerente de loja',1),('butanta','Chefe de cozinha',1),('butanta','Líder de delivery',1),('butanta','Auxiliar de cozinha',8),('butanta','Atendente',5);

insert into public.expansao (nome,abertura,loja_id,ordem) values
 ('Butantã','Novembro de 2026','butanta',1),('Loja 6','1º semestre de 2027',null,2),('Loja 7','2º semestre de 2027',null,3),
 ('Loja 8','2º semestre de 2027',null,4),('Loja 9','1º semestre de 2028',null,5),('Loja 10','2º semestre de 2028',null,6);
