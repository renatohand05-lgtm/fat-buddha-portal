/* ================= PLANOS DE AÇÃO ================= */
const ORIG={visita:'Visita de qualidade',delivery:'Checklist de delivery',indicador:'Indicador fora da meta',manual:'Manual'};
const atrasado = a => !['Concluído','Cancelado'].includes(a.status) && a.prazo && a.prazo<isoHoje();
function renderPlanos(){
  const all=S.db.planos_acao||[], hoje=isoHoje();
  const aberto=a=>!['Concluído','Cancelado'].includes(a.status);
  const lj=$('#paLoja').value||'todas', st=$('#paSt').value, or=$('#paOr').value;
  const base=all.filter(a=>lj==='todas'||a.loja_id===lj);
  const concMes=base.filter(a=>a.status==='Concluído'&&a.concluido_em&&ymOf(a.concluido_em)===S.mes);
  $('#paKpis').innerHTML=kpi('Ações em aberto',base.filter(aberto).length,'int','pendentes e em andamento')+kpi('Atrasadas',base.filter(atrasado).length,'int','prazo vencido',base.filter(aberto).length?base.filter(atrasado).length/base.filter(aberto).length*100:null)+
    kpi('Sem responsável ou prazo',base.filter(a=>aberto(a)&&(!a.responsavel||!a.prazo)).length,'int','completar o plano')+kpi('Concluídas no mês',concMes.length,'int',mesLongo(S.mes))+
    kpi('Aguardando verificação',base.filter(a=>a.status==='Concluído'&&!a.verificado).length,'int','concluídas sem verificação')+kpi('Prioridade alta abertas',base.filter(a=>aberto(a)&&a.prioridade==='Alta').length,'int','');
  animateKpis($('#paKpis'));
  $('#tPaLoja').innerHTML=`<tr><th>Loja</th><th class="num">Abertas</th><th class="num">Atrasadas</th><th class="num">Concluídas</th></tr>`+LOJAS.map(l=>{const a=all.filter(x=>x.loja_id===l.id);return `<tr><td><b>${esc(l.nome)}</b></td><td class="num">${a.filter(aberto).length}</td><td class="num">${a.filter(atrasado).length?`<span class="sem s-bad" style="min-width:0">${a.filter(atrasado).length}</span>`:'0'}</td><td class="num">${a.filter(x=>x.status==='Concluído').length}</td></tr>`}).join('');
  const lst=base.filter(a=>(or==='todos'||a.origem===or)&&(st==='todos'||(st==='abertos'?aberto(a):st==='atrasados'?atrasado(a):a.status===st)))
    .sort((a,b)=>(atrasado(b)-atrasado(a))||({Alta:0,'Média':1,Baixa:2}[a.prioridade]-{Alta:0,'Média':1,Baixa:2}[b.prioridade])||(a.prazo||'9').localeCompare(b.prazo||'9'));
  $('#paCount').textContent=`${lst.length} ação(ões)`;
  const ed=a=>P.editar(a.loja_id);
  $('#tPa').innerHTML=lst.length?`<tr><th>Loja</th><th>Origem</th><th>Problema</th><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Prioridade</th><th>Status</th><th>Evidência</th><th></th></tr>`+lst.map(a=>{const e=ed(a),d=e?'':'disabled';return `<tr ${atrasado(a)?'style="background:rgba(255,92,104,.07)"':''}>
    <td><b>${esc(lojaNome(a.loja_id))}</b></td><td><span class="tag">${ORIG[a.origem]}</span><div class="small muted">${fmtD(a.created_at.slice(0,10))}</div></td>
    <td style="white-space:normal;min-width:200px"><b>${esc(a.problema)}</b>${a.secao?`<div class="small muted">${esc(a.secao)}</div>`:''}${a.obs?`<div class="small muted">${esc(a.obs)}</div>`:''}</td>
    <td style="min-width:200px"><input class="inp" data-pa="${a.id}" data-f="acao" value="${esc(a.acao)}" placeholder="O que será feito" ${d}></td>
    <td style="min-width:130px"><input class="inp" data-pa="${a.id}" data-f="responsavel" value="${esc(a.responsavel)}" placeholder="Quem" ${d}></td>
    <td><input class="inp" type="date" data-pa="${a.id}" data-f="prazo" value="${a.prazo||''}" ${d}>${atrasado(a)?'<div class="small" style="color:var(--bad)">atrasada</div>':''}</td>
    <td><select class="inp" data-pa="${a.id}" data-f="prioridade" ${d}>${['Alta','Média','Baixa'].map(o=>`<option ${a.prioridade===o?'selected':''}>${o}</option>`).join('')}</select></td>
    <td><select class="inp" data-pa="${a.id}" data-f="status" ${d}>${['Pendente','Em andamento','Concluído','Cancelado'].map(o=>`<option ${a.status===o?'selected':''}>${o}</option>`).join('')}</select>${a.concluido_em?`<div class="small muted">em ${fmtD(a.concluido_em)}</div>`:''}</td>
    <td style="min-width:160px"><input class="inp" data-pa="${a.id}" data-f="evidencia" value="${esc(a.evidencia)}" placeholder="Foto, link, registro" ${d}></td>
    <td class="num">${a.status==='Concluído'?(a.verificado?'<span class="sem s-ok" style="min-width:0">Verificada</span>':(P.gestor||(P.papel==='regional'&&e))?`<button class="btn sm" data-ver="${a.id}">Verificar</button>`:'<span class="small muted">a verificar</span>'):''} ${P.excluir(a.loja_id)?`<button class="btn sm" data-pdel="${a.id}">Excluir</button>`:''}</td></tr>`}).join('')
    :'<tr><td><div class="empty">Nenhuma ação para este filtro.</div></td></tr>';
  $('#tPa').querySelectorAll('[data-pa]').forEach(el=>el.onchange=async()=>{const f=el.dataset.f;let v=el.value||null;
    if(f==='status'&&v==='Concluído'){const a=all.find(x=>x.id==el.dataset.pa);if(!a.acao&&!confirm('Concluir uma ação sem descrever o que foi feito?')){el.value=a.status;return}}
    if(await dbw(sb.from('planos_acao').update({[f]:v}).eq('id',el.dataset.pa),'Ação atualizada.')){await load(['planos_acao']);renderPlanos()}});
  $('#tPa').querySelectorAll('[data-ver]').forEach(b=>b.onclick=async()=>{if(!confirm('Confirmar que a ação foi verificada e está resolvida?'))return;if(await dbw(sb.from('planos_acao').update({verificado:true}).eq('id',b.dataset.ver),'Conclusão verificada.')){await load(['planos_acao']);renderPlanos()}});
  $('#tPa').querySelectorAll('[data-pdel]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta ação?'))return;if(await dbw(sb.from('planos_acao').delete().eq('id',b.dataset.pdel),'Ação excluída.')){await load(['planos_acao']);renderPlanos()}});
}
function initPlanos(){
  $('#paLoja').innerHTML='<option value="todas">Todas as lojas</option>'+optLojas(LOJAS);
  ['#paLoja','#paSt','#paOr'].forEach(s=>$(s).onchange=renderPlanos);
  $('#pnLoja').innerHTML=optLojas(lojasEditaveis());
  $('#pnSave').onclick=async()=>{const r={loja_id:$('#pnLoja').value,origem:$('#pnOr').value,problema:$('#pnProb').value.trim(),acao:$('#pnAc').value||null,responsavel:$('#pnResp').value||null,prazo:$('#pnPrazo').value||null,prioridade:$('#pnPri').value};
    if(!r.problema){toast('Descreva o problema.');return}
    if(await dbw(sb.from('planos_acao').insert(r),'Ação criada.')){['#pnProb','#pnAc','#pnResp','#pnPrazo'].forEach(s=>$(s).value='');await load(['planos_acao']);renderPlanos()}};
  $('#paCsv').onclick=()=>csv('planos-de-acao-fat-buddha.csv',[['Loja','Origem','Criada em','Problema','Seção','Ação','Responsável','Prazo','Prioridade','Status','Concluída em','Verificada','Evidência','Observações','Atrasada']].concat((S.db.planos_acao||[]).map(a=>[lojaNome(a.loja_id),ORIG[a.origem],a.created_at.slice(0,10),a.problema,a.secao,a.acao,a.responsavel,a.prazo,a.prioridade,a.status,a.concluido_em,a.verificado?'Sim':'Não',a.evidencia,a.obs,atrasado(a)?'Sim':'Não'])));
}

/* ================= RELATÓRIOS ================= */
function REPORTS(){
  const M=S.mes, lojasOp=OPER.map(l=>l.nome), fx=(f,v)=>fmt(f,v);
  const L=[];
  L.push({k:'exec',t:'Executivo da rede',d:'KPIs, ranking TOP/FLOP e alertas do mês.',v:P.papel!=='colaborador',run:()=>{
    const all=OPER.map(l=>lojaStats(l.id)), fat=sum(all,s=>s.fat), meta=sum(all,s=>s.meta||0), ped=sum(all,s=>s.ped);
    return [{t:'Resumo',cab:['Indicador','Valor'],linhas:[['Faturamento da rede',brl(fat)],['Meta do mês',brl(meta)],['Vendas x meta',meta?nf1.format(fat/meta*100)+'%':'—'],['Pedidos',nf0.format(ped)],['Ticket médio',ped?'R$ '+nf2.format(fat/ped):'—'],['Delivery no faturamento',fat?nf1.format(sum(all,s=>s.del)/fat*100)+'%':'—'],['Lojas acima do piso',String(all.filter(s=>s.temVenda&&s.fat>=pisoLoja()).length)]]},
      {t:'Ranking TOP/FLOP',cab:['Posição','Loja','Indicadores na meta','% da meta de vendas'],linhas:rankingRede().map((r,i)=>[i+1,r.l.nome,r.ok+'/'+r.tot,r.pct!=null?nf1.format(r.pct)+'%':'—'])},
      {t:'Alertas',cab:['Loja','Indicador','Valor','Meta','Nível'],linhas:alertasRede().map(a=>[a.l,a.m.n,fx(a.m.f,a.v),a.m.txt,a.s==='bad'?'Crítico':'Atenção'])}]},o:'vendas diárias, metas, checklists, CMV, RH e cozinha central'});
  L.push({k:'vendas',t:'Vendas por loja',d:'Faturamento, pedidos, ticket e canais do mês.',v:P.papel!=='colaborador',run:()=>[{t:'Vendas do mês',cab:['Loja','Salão','Delivery','Total','Meta','% meta','Pedidos','Ticket','% delivery','Dias lançados'],linhas:OPER.map(l=>{const s=lojaStats(l.id);return [l.nome,brl(s.sal),brl(s.del),brl(s.fat),brl(s.meta),s.pctMeta!=null?nf1.format(s.pctMeta)+'%':'—',nf0.format(s.ped),s.ticket?'R$ '+nf2.format(s.ticket):'—',s.fat?nf1.format(s.del/s.fat*100)+'%':'—',s.nReg]})}],o:'vendas diárias e metas de vendas',csv:()=>[['Loja','Salão','Delivery','Total','Meta','% meta','Pedidos','Ticket']].concat(OPER.map(l=>{const s=lojaStats(l.id);return [l.nome,s.sal,s.del,s.fat,s.meta,s.pctMeta?.toFixed(1),s.ped,s.ticket?.toFixed(2)]}))});
  L.push({k:'metas',t:'Metas e indicadores',d:'Semáforo de todos os indicadores por loja.',v:P.papel!=='colaborador',run:()=>[{t:'Semáforo por loja',cab:['Loja',...METAS(null).map(m=>m.n)],linhas:OPER.map(l=>{const s=lojaStats(l.id);return [l.nome,...METAS(l.id).map(m=>{const v=s.vals[m.k];const st=status(m,v);return fx(m.f,v)+(st==='ok'?' ✓':st==='warn'?' !':st==='bad'?' ✗':'')})]})},{t:'Metas vigentes',cab:['Indicador','Meta'],linhas:METAS(null).map(m=>[m.n,m.txt])}],o:'metas cadastradas e indicadores calculados'});
  L.push({k:'cmv',t:'CMV',d:'Contagens semanais, real x teórico e dispersão.',v:P.papel!=='colaborador',run:()=>[{t:'Contagens do mês',cab:['Semana','Loja','Vendas','CMV R$','CMV real','CMV teórico','Dispersão','Responsável'],linhas:(S.db.cmv_contagens||[]).filter(r=>ymOf(r.semana)===M).map(r=>[semTxt(r.semana),lojaNome(r.loja_id),brl(r.vendas),brl(cmvRealR(r)),nf1.format(cmvReal(r))+'%',nf1.format(r.cmv_teorico)+'%',nf1.format(cmvReal(r)-r.cmv_teorico)+' p.p.',r.responsavel||''])}],o:'contagens semanais de CMV'});
  L.push({k:'rup',t:'Rupturas',d:'Rupturas do mês por loja, item e motivo.',v:true,run:()=>{const rs=(S.db.rupturas||[]).filter(r=>ymOf(r.data)===M);return [{t:'Por loja',cab:['Loja','Rupturas','Horas indisponíveis'],linhas:LOJAS.map(l=>[l.nome,rs.filter(r=>r.loja_id===l.id).length,sum(rs.filter(r=>r.loja_id===l.id),r=>r.horas)])},{t:'Registros',cab:['Data','Loja','Item','Motivo','Horas','Ação'],linhas:rs.map(r=>[fmtD(r.data),lojaNome(r.loja_id),r.item,r.motivo,r.horas,r.acao||''])}]},o:'registro de rupturas da cozinha central'});
  L.push({k:'est',t:'Estoque da cozinha central',d:'Posição, cobertura e reposição sugerida.',v:true,run:()=>[{t:'Posição atual',cab:['Item','Un.','Atual','Mínimo','Consumo/dia','Cobertura','Status','Repor','Valor'],linhas:(S.db.estoque_cc||[]).map(i=>[i.item,i.un,i.atual,i.minimo,i.consumo_dia,+i.consumo_dia?nf1.format(i.atual/i.consumo_dia)+' dias':'—',estStatus(i)[0],repor(i),brl(i.atual*i.custo)])}],o:'estoque da cozinha central',periodo:'Posição em '+new Date().toLocaleDateString('pt-BR')});
  L.push({k:'dre',t:'DRE',d:'DRE loja a loja e consolidado, com linhas estimadas marcadas.',v:P.papel!=='colaborador',run:()=>{const {cols,tot}=dreRede();const all=cols.concat(cols.length?[{nome:'Rede',d:tot}]:[]);return [{t:'DRE do mês',p:'(est.) = linha estimada pela premissa, sem valor realizado lançado.',cab:['Linha',...all.map(c=>c.nome)],linhas:DRE_LINES.map(([k,n])=>[n,...all.map(c=>brl(c.d[k])+(c.d.est&&c.d.est[k]?' (est.)':''))]).concat([['Margem operacional',...all.map(c=>c.d.mg!=null?nf1.format(c.d.mg)+'%':'—')]])}]},o:'vendas, contagens de CMV, lançamentos realizados do DRE e premissas'});
  L.push({k:'orc',t:'Orçamento e expansão',d:'DRE orçado, curva de maturação, cenários e plano de lojas.',v:P.veTudo,run:()=>{const d=orcDre(),c=orcCurva();return [{t:'DRE orçado (loja madura)',cab:['Linha','Mensal'],linhas:DRE_LINES.map(([k,n])=>[n,brl(d[k])]).concat([['Ponto de equilíbrio',brl(d.pe)]])},{t:'Curva de maturação',cab:['Mês','% do alvo','Faturamento','Resultado','Acumulado'],linhas:c.rd.map((x,i)=>['Mês '+(i+1),c.ramp[i]+'%',brl(x.fat),brl(x.res),brl(c.accs[i])])},{t:'Plano de inaugurações',cab:['Loja','Abertura','Resultado/mês','1º ano'],linhas:(S.db.expansao||[]).map(x=>[x.nome,x.abertura||fmtD(x.data_prevista),brl(d.res),brl(c.ano1)])},{t:'Cenários',cab:['Cenário','Faturamento','Resultado/mês','Margem'],linhas:(S.db.orc_cenarios||[]).map(cn=>{const pr=Object.assign({},ORC_DEF0,cn.premissas),x=orcDre(null,pr);return [cn.nome,brl(pr.faturamento),brl(x.res),nf1.format(x.mg)+'%']})}]},o:'premissas de orçamento (simulação atual) e plano de expansão'});
  L.push({k:'rh',t:'RH',d:'Quadro, turnover, absenteísmo e ocorrências.',v:P.veRH,run:()=>[{t:'Quadro de pessoal',cab:['Loja',...CARGOS,'Total'],linhas:LOJAS.map(l=>{let a=0,p=0;return [l.nome,...CARGOS.map(c=>{const x=quadroAtivo(l.id,c),y=quadroPrev(l.id,c);a+=x;p+=y;return x+'/'+y}),a+'/'+p]})},{t:'Turnover e absenteísmo do mês',cab:['Loja','Headcount','Admissões','Desligamentos','Turnover','Absenteísmo'],linhas:LOJAS.map(l=>{const r=IDX.rh.get(l.id+'|'+M);return r?[l.nome,r.headcount,r.admissoes,r.desligamentos,nf1.format(turnOf(r))+'%',nf1.format(absOf(r))+'%']:[l.nome,'—','—','—','—','—']})}].concat(LOJAS.some(l=>P.veOco(l.id))?[{t:'Ocorrências do mês',cab:['Data','Colaborador','Loja','Tipo','Status'],linhas:(S.db.ocorrencias||[]).filter(o=>ymOf(o.data)===M).map(o=>{const p=(S.db.colaboradores||[]).find(x=>x.id===o.colaborador_id)||{};return [fmtD(o.data),p.nome,lojaNome(o.loja_id),o.tipo,o.status]})}]:[]),o:'cadastro de colaboradores, lançamentos mensais de RH e ocorrências'});
  L.push({k:'ger',t:'Desempenho de gerentes',d:'Score por componente e recomendação.',v:P.veRH,run:()=>[{t:'Score do mês',cab:['Loja','Gerente','Vendas','Indicadores','Qualidade','Pessoas','Liderança','Score','Recomendação'],linhas:OPER.map(l=>{const r=gerScore(l.id),f=v=>v==null?'—':nf0.format(v);return [l.nome,r.g?r.g.nome:'—',f(r.comp.vendas),f(r.comp.ind),f(r.comp.qual),f(r.comp.pessoas),f(r.comp.lider),f(r.score),r.rec[0]]})}],o:'vendas, indicadores, visitas de qualidade, RH e notas de liderança'});
  L.push({k:'nine',t:'Nine Box',d:'Distribuição e avaliação individual.',v:P.veRH,run:()=>[{t:'Quadrantes',cab:['Quadrante','Pessoas','Orientação'],linhas:Object.entries(NB).map(([k,v])=>[v[0],people().filter(p=>p.desempenho+'-'+p.potencial===k).length,v[1]])},{t:'Avaliação individual',cab:['Nome','Cargo','Loja','Desempenho','Potencial','Quadrante'],linhas:people().map(p=>[p.nome,p.cargo,unidadeNome(p),LV[p.desempenho],LV[p.potencial],NB[p.desempenho+'-'+p.potencial][0]])}],o:'avaliações de nine box',periodo:'Posição em '+new Date().toLocaleDateString('pt-BR')});
  L.push({k:'suc',t:'Sucessão',d:'Mapa de sucessão dos cargos-chave.',v:P.veRH,run:()=>[{t:'Mapa de sucessão',cab:['Loja','Cargo-chave','Titular','Sucessor indicado','Prontidão'],linhas:(()=>{const v=$('#rhLoja').value;$('#rhLoja').value=LOJAS.length>1?'todas':v;const r=sucessaoRows();$('#rhLoja').value=v;return r.map(x=>[lojaNome(x.id),x.cargo,x.tit[0]?x.tit[0].nome:'vago',x.cand[0]?x.cand[0].nome+' ('+x.cand[0].cargo+')':'sem candidato',x.cand[0]?prontidao(x.cand[0])[0]:'—'])})()}],o:'nine box e cadastro de colaboradores',periodo:'Posição em '+new Date().toLocaleDateString('pt-BR')});
  L.push({k:'qual',t:'Qualidade',d:'Visitas do mês com nota e desvios.',v:P.papel!=='colaborador',run:()=>{const vs=(S.db.visitas_qualidade||[]).filter(v=>ymOf(v.data)===M);return [{t:'Visitas',cab:['Data','Loja','Avaliador','Gerente','Nota','Desvios'],linhas:vs.map(v=>[fmtD(v.data),lojaNome(v.loja_id),v.avaliador||'',v.gerente||'',nf0.format(v.score)+'%',v.nao])},{t:'Nota por seção',cab:['Loja','Data',...CK_QUAL.map(s=>s.s.split(',')[0])],linhas:vs.map(v=>[lojaNome(v.loja_id),fmtD(v.data),...CK_QUAL.map((_,i)=>{const x=(v.secoes||[])[i];return x==null?'—':nf0.format(x)+'%'})])},
    {t:'Equipamentos, temperaturas e estoques',p:'Faixas: resfriados de 1 °C a 4 °C · congelados de −21 °C a −14 °C. Fotos disponíveis no histórico de visitas do portal.',cab:['Loja','Data','Item','Medição','Resultado','Fotos'],linhas:vs.flatMap(v=>CK_QUAL[6].i.map((it,ii)=>{const q=(v.respostas||{})['6-'+ii];if(!q||!q.v)return null;return [lojaNome(v.loja_id),fmtD(v.data),itObj(it).n,q.t!=null?fmtT(q.t):'—',{sim:'Conforme',nao:'Não conforme',na:'N/A'}[q.v],(q.f||[]).length]}).filter(Boolean))}]},o:'visitas de qualidade'});
  L.push({k:'del',t:'Delivery',d:'Checklists do mês e médias por loja.',v:true,run:()=>{const cs=(S.db.delivery_checklists||[]).filter(c=>ymOf(c.data)===M);return [{t:'Média por loja',cab:['Loja','Checklists',...CK_DEL_METAS.map(m=>m.n)],linhas:LOJAS.map(l=>{const x=cs.filter(c=>c.loja_id===l.id);return [l.nome,x.length,...CK_DEL_METAS.map(m=>{const vs=x.map(c=>(c.metas||{})[m.k]).filter(v=>v!=null);return vs.length?nf1.format(sum(vs)/vs.length):'—'})]})},{t:'Registros',cab:['Data','Loja','Período','Responsável',...CK_DEL_METAS.map(m=>m.n)],linhas:cs.map(c=>[fmtD(c.data),lojaNome(c.loja_id),c.periodo,c.responsavel||'',...CK_DEL_METAS.map(m=>(c.metas||{})[m.k]??'—')])}]},o:'checklists de delivery'});
  L.push({k:'pa',t:'Planos de ação',d:'Ações abertas, atrasadas e concluídas.',v:P.papel!=='colaborador',run:()=>{const all=S.db.planos_acao||[];return [{t:'Pendências por loja',cab:['Loja','Abertas','Atrasadas','Concluídas no mês'],linhas:LOJAS.map(l=>{const a=all.filter(x=>x.loja_id===l.id);return [l.nome,a.filter(x=>!['Concluído','Cancelado'].includes(x.status)).length,a.filter(atrasado).length,a.filter(x=>x.concluido_em&&ymOf(x.concluido_em)===M).length]})},{t:'Ações em aberto',cab:['Loja','Origem','Problema','Ação','Responsável','Prazo','Prioridade','Status'],linhas:all.filter(a=>!['Concluído','Cancelado'].includes(a.status)).map(a=>[lojaNome(a.loja_id),ORIG[a.origem],a.problema,a.acao||'',a.responsavel||'',a.prazo?fmtD(a.prazo)+(atrasado(a)?' (atrasada)':''):'',a.prioridade,a.status])}]},o:'planos de ação',periodo:'Posição em '+new Date().toLocaleDateString('pt-BR')});
  return L.filter(r=>r.v);
}
function renderRelatorios(){
  const L=REPORTS();
  $('#repList').innerHTML=L.map(r=>`<div class="rep"><b>${r.t}</b><span class="small muted">${r.d}</span><div class="actions"><button class="btn sm pri" data-rp="${r.k}">Abrir PDF</button><button class="btn sm" data-rc="${r.k}">CSV</button></div></div>`).join('');
  $('#repList').querySelectorAll('[data-rp]').forEach(b=>b.onclick=()=>{const r=L.find(x=>x.k===b.dataset.rp);relatorio('Relatório · '+r.t,r.run(),{origem:r.o,periodo:r.periodo})});
  $('#repList').querySelectorAll('[data-rc]').forEach(b=>b.onclick=()=>{const r=L.find(x=>x.k===b.dataset.rc);const bl=r.run();const rows=[];bl.forEach(t=>{rows.push([t.t]);if(t.cab){rows.push(t.cab);t.linhas.forEach(l=>rows.push(l))}rows.push([])});rows.push(['Cliente','Fat Buddha']);rows.push(['Período',r.periodo||mesLongo(S.mes)]);rows.push(['Gerado em',new Date().toLocaleString('pt-BR')]);rows.push(['Origem dos dados',r.o]);csv(`relatorio-${r.k}-${S.mes}.csv`,rows)});
}

/* ================= CONFIGURAÇÕES ================= */
let cfSub='lojas';
const PAPEL_TXT={admin:'Administrador do portal',consultor:'Consultor',diretoria:'Diretoria',regional:'Gerente regional',gerente:'Gerente de loja',colaborador:'Colaborador autorizado'};
const PAPEL_DESC={admin:'Acesso total, usuários, permissões, metas e configurações.',consultor:'Todas as lojas: lançamentos, metas, premissas, relatórios e planos de ação.',diretoria:'Acesso total, igual ao administrador: todas as lojas, lançamentos, aprovações, RH e salários, usuários e configurações.',regional:'Lojas atribuídas: lançamentos, checklists, RH, planos de ação e exclusões.',gerente:'Própria loja: lançamentos, checklists, RH e planos de ação (sem excluir).',colaborador:'Própria loja: registrar rupturas e checklist de delivery.'};
function renderConfig(){
  $$('#cfNav button').forEach(b=>{b.classList.toggle('on',b.dataset.s===cfSub);b.classList.toggle('hidden',(b.dataset.s==='users'||b.dataset.s==='integ')&&!P.admin)});
  $$('#tab-config .ccs').forEach(s=>s.classList.toggle('on',s.id==='cf-'+cfSub));
  ({lojas:cfLojas,metas:cfMetas,mv:cfMv,prem:cfPrem,quadro:cfQuadro,users:cfUsers,integ:()=>{cfInteg();cfConexoes()},hist:cfHist})[cfSub]();
  if(cfSub==='lojas')aplicarDemo();
}
function cfLojas(){
  $('#tCfLojas').innerHTML=`<tr><th>Código</th><th>Nome</th><th>Status</th><th>Canais</th><th>Inauguração</th><th title="Reconhece as notas fiscais pelo destinatário">CNPJ</th><th title="Identificador da loja no iFood">Merchant iFood</th><th title="Código da loja no PDV/portal de vendas">Código PDV</th><th class="num">Ordem</th><th></th></tr>`+LOJAS.map(l=>`<tr><td class="muted">${l.id}</td><td><input class="inp" data-lj="${l.id}" data-f="nome" value="${esc(l.nome)}"></td>
    <td><select class="inp" data-lj="${l.id}" data-f="status">${[['operando','Em operação'],['inauguracao','Em inauguração'],['fechada','Fechada']].map(([v,t])=>`<option value="${v}" ${l.status===v?'selected':''}>${t}</option>`).join('')}</select></td>
    <td><select class="inp" data-lj="${l.id}" data-f="canais">${[['delivery','Delivery'],['salao+delivery','Salão + delivery'],['salao','Salão']].map(([v,t])=>`<option value="${v}" ${l.canais===v?'selected':''}>${t}</option>`).join('')}</select></td>
    <td><input class="inp" data-lj="${l.id}" data-f="inauguracao" value="${esc(l.inauguracao)}"></td><td><input class="inp" style="min-width:150px" data-lj="${l.id}" data-f="cnpj" value="${esc(l.cnpj)}" placeholder="00.000.000/0000-00"></td><td><input class="inp" style="min-width:150px" data-lj="${l.id}" data-f="ifood_merchant" value="${esc(l.ifood_merchant)}"></td><td><input class="inp" style="min-width:110px" data-lj="${l.id}" data-f="codigo_pdv" value="${esc(l.codigo_pdv)}"></td><td class="num"><input class="inp einp" style="width:70px" type="number" data-lj="${l.id}" data-f="ordem" value="${l.ordem}"></td><td class="num">${P.admin?`<button class="btn sm" data-ljx="${l.id}">Excluir</button>`:''}</td></tr>`).join('');
  $('#tCfLojas').querySelectorAll('[data-lj]').forEach(el=>el.onchange=async()=>{const f=el.dataset.f;const v=f==='ordem'?+el.value:(el.value||null);if(f==='nome'&&!v){toast('O nome é obrigatório.');return}if(await dbw(sb.from('lojas').update({[f]:v}).eq('id',el.dataset.lj),'Loja atualizada.')){await load(['lojas']);aplicarLojas();cfLojas()}});
  $('#tCfLojas').querySelectorAll('[data-ljx]').forEach(b=>b.onclick=async()=>{if(!confirm(`Excluir a loja ${lojaNome(b.dataset.ljx)} apaga TODOS os lançamentos dela (vendas, CMV, checklists, RH). Para encerrar a operação prefira o status "Fechada". Excluir mesmo assim?`))return;if(await pedir('Confirmar exclusão da loja','Digite EXCLUIR para confirmar',{ok:'Excluir definitivamente'})!=='EXCLUIR')return;if(await dbw(sb.from('lojas').delete().eq('id',b.dataset.ljx),'Loja excluída.')){await load();aplicarLojas();cfLojas()}});
}
function cfMetas(){
  const lista=METAS_DEF.concat([META_EXTRA_DEF]);
  $('#mtInd').innerHTML=lista.map(d=>`<option value="${d.k}">${d.n}</option>`).join('');
  $('#mtLoja').innerHTML='<option value="">Rede (todas as lojas)</option>'+optLojas(LOJAS);
  if(!$('#mtDesde').value)$('#mtDesde').value=iniMes(S.mes);
  const sync=()=>{const r=metaRow($('#mtInd').value,$('#mtLoja').value||null,S.mes);$('#mtVal').value=r&&r.valor!=null?r.valor:'';if(r&&r.direcao)$('#mtDir').value=r.direcao};
  $('#mtInd').onchange=sync;$('#mtLoja').onchange=sync;sync();
  const linha=(d,l)=>{const r=metaRow(d.k,l,S.mes);const own=r&&(r.loja_id||null)===(l||null);return {r,own}};
  $('#tCfMetas').innerHTML=`<tr><th>Indicador</th><th>Rede</th>${LOJAS.map(l=>`<th>${esc(l.nome)}</th>`).join('')}</tr>`+lista.map(d=>`<tr><td><b>${d.n}</b></td>${[null].concat(LOJAS.map(l=>l.id)).map(l=>{const {r,own}=linha(d,l);return `<td>${r?(own?`<b>${r.valor==null?'acompanhar':metaTxt(Object.assign({fr:'Mensal'},d),+r.valor,r.direcao)}</b>`:'<span class="muted small">= rede</span>'):'—'}</td>`}).join('')}</tr>`).join('');
  const h=(S.db.metas||[]).slice().sort((a,b)=>b.created_at.localeCompare(a.created_at));
  $('#tCfMetasHist').innerHTML=`<tr><th>Registrada em</th><th>Indicador</th><th>Aplicação</th><th class="num">Meta</th><th>Direção</th><th>Vigente desde</th></tr>`+h.map(m=>`<tr><td>${new Date(m.created_at).toLocaleString('pt-BR')}</td><td>${(lista.find(d=>d.k===m.indicador)||{n:m.indicador}).n}</td><td>${m.loja_id?esc(lojaNome(m.loja_id)):'Rede'}</td><td class="num">${m.valor==null?'acompanhar':nf2.format(m.valor).replace(',00','')}</td><td>${m.direcao==='min'?'maior é melhor':m.direcao==='max'?'menor é melhor':'—'}</td><td>${fmtD(m.vigente_desde)}</td></tr>`).join('');
}
function cfMv(){
  const anos=uniq([S.mes.slice(0,4),String(+S.mes.slice(0,4)+1),...(S.db.metas_vendas||[]).map(r=>r.mes.slice(0,4))]).sort();
  const sel=$('#mvAno').value||S.mes.slice(0,4); $('#mvAno').innerHTML=anos.map(a=>`<option ${a===sel?'selected':''}>${a}</option>`).join(''); $('#mvAno').onchange=cfMv;
  const ms=Array.from({length:12},(_,i)=>sel+'-'+String(i+1).padStart(2,'0'));
  $('#tCfMv').innerHTML=`<tr><th>Loja</th>${ms.map(m=>`<th class="num">${mesTxt(m)}</th>`).join('')}</tr>`+LOJAS.map(l=>`<tr><td><b>${esc(l.nome)}</b></td>${ms.map(m=>`<td class="num"><input class="inp einp" type="number" step="1000" data-mvl="${l.id}" data-mvm="${m}" value="${IDX.mv.get(l.id+'|'+m)??''}"></td>`).join('')}</tr>`).join('')+
    `<tr><td class="muted small">Copiar</td><td colspan="12"><button class="btn sm" id="mvCopia">Repetir a meta de ${mesTxt(S.mes)} nos meses vazios do ano</button></td></tr>`;
  $('#tCfMv').querySelectorAll('[data-mvl]').forEach(el=>el.onchange=async()=>{const v=num(el.value);const q=v==null?sb.from('metas_vendas').delete().eq('loja_id',el.dataset.mvl).eq('mes',el.dataset.mvm):sb.from('metas_vendas').upsert({loja_id:el.dataset.mvl,mes:el.dataset.mvm,valor:v},{onConflict:'loja_id,mes'});if(await dbw(q,'Meta de vendas salva.')){await load(['metas_vendas'])}});
  $('#mvCopia').onclick=async()=>{const rows=[];LOJAS.forEach(l=>{const v=IDX.mv.get(l.id+'|'+S.mes);if(v!=null)ms.forEach(m=>{if(!IDX.mv.has(l.id+'|'+m))rows.push({loja_id:l.id,mes:m,valor:v})})});if(!rows.length){toast('Nada a copiar.');return}if(await dbw(sb.from('metas_vendas').insert(rows),`${rows.length} metas criadas.`)){await load(['metas_vendas']);cfMv()}};
}
function cfPrem(){
  const F=FIELDS_DRE.filter(f=>f.t!=='base').concat(FIELDS_DRE_EST), base=dreBase();
  $('#tCfPrem').innerHTML=`<tr><th>Loja</th>${F.map(f=>`<th class="num">${f.n}<br><span style="font-weight:500;color:var(--dim)">geral: ${f.u==='R$'?brl(base[f.k]):nf1.format(base[f.k])+'%'}</span></th>`).join('')}</tr>`+LOJAS.map(l=>{const v=IDX.prem[l.id]||{};return `<tr><td><b>${esc(l.nome)}</b></td>${F.map(f=>`<td class="num"><input class="inp einp" type="number" step="${f.s||0.1}" data-pl="${l.id}" data-pk="${f.k}" value="${v[f.k]??''}" placeholder="—"></td>`).join('')}</tr>`}).join('');
  $('#tCfPrem').querySelectorAll('[data-pl]').forEach(el=>el.onchange=async()=>{const id=el.dataset.pl, v=Object.assign({},IDX.prem[id]||{});const n=num(el.value);if(n==null)delete v[el.dataset.pk];else v[el.dataset.pk]=n;
    if(await dbw(sb.from('dre_premissas_loja').upsert({loja_id:id,valores:v},{onConflict:'loja_id'}),'Premissa da loja salva.')){await load(['dre_premissas_loja'])}});
}
function cfQuadro(){
  $('#tCfQuadro').innerHTML=`<tr><th>Cargo</th>${LOJAS.map(l=>`<th class="num">${esc(l.nome)}</th>`).join('')}</tr>`+CARGOS.map(c=>`<tr><td><b>${c}</b></td>${LOJAS.map(l=>`<td class="num"><input class="inp einp" style="width:80px" type="number" min="0" data-ql="${l.id}" data-qc="${c}" value="${quadroPrev(l.id,c)}"></td>`).join('')}</tr>`).join('');
  $('#tCfQuadro').querySelectorAll('[data-ql]').forEach(el=>el.onchange=async()=>{const v=Math.max(0,+el.value||0);if(await dbw(sb.from('quadro_previsto').upsert({loja_id:el.dataset.ql,cargo:el.dataset.qc,previsto:v},{onConflict:'loja_id,cargo'}),'Quadro previsto salvo.')){await load(['quadro_previsto'])}});
}
async function admUsers(body){
  busy(true);const {data,error}=await sb.functions.invoke('admin-usuarios',{body});busy(false);
  if(error){let m=error.message;try{const j=await error.context.json();m=j.error||m}catch(e){}toast(m);return null}
  if(data&&data.error){toast(data.error);return null}
  return data;
}
async function cfUsers(){
  $('#usPapel').innerHTML=Object.entries(PAPEL_TXT).map(([k,v])=>`<option value="${k}" ${k==='gerente'?'selected':''}>${v}</option>`).join('');
  $('#usPapel').onchange=()=>$('#usPapelTxt').textContent=PAPEL_DESC[$('#usPapel').value]; $('#usPapel').onchange();
  $('#usLojas').innerHTML=LOJAS.map(l=>`<label><input type="checkbox" value="${l.id}"> ${esc(l.nome)}</label>`).join('');
  $('#tCfUsers').innerHTML='<tr><td><div class="empty">Carregando usuários…</div></td></tr>';
  const r=await admUsers({acao:'listar'}); if(!r)return;
  $('#tCfUsers').innerHTML=`<tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Lojas</th><th>Situação</th><th></th></tr>`+r.usuarios.map(u=>`<tr><td><b>${esc(u.nome)}</b></td><td>${esc(u.email)}</td><td>${u.papel?PAPEL_TXT[u.papel]:'<span class="sem s-warn" style="min-width:0">aguardando liberação</span>'}</td><td style="white-space:normal">${['admin','consultor','diretoria'].includes(u.papel)?'<span class="muted">todas</span>':u.lojas.map(lojaNome).join(', ')||'—'}</td><td>${u.ativo?'<span class="sem s-ok" style="min-width:0">Ativo</span>':'<span class="sem s-bad" style="min-width:0">Bloqueado</span>'}</td><td class="num"><button class="btn sm" data-us="${u.user_id}">Editar</button></td></tr>`).join('');
  $('#tCfUsers').querySelectorAll('[data-us]').forEach(b=>b.onclick=()=>{const u=r.usuarios.find(x=>x.user_id===b.dataset.us);
    modal(`<h3>${esc(u.nome)} <small>${esc(u.email)} <button class="btn sm" id="mX">Fechar</button></small></h3>
      <div class="form-row" style="grid-template-columns:1fr 1fr"><label class="f">Nome<input class="inp" id="mN" value="${esc(u.nome)}"></label><label class="f">Perfil<select class="inp" id="mP">${Object.entries(PAPEL_TXT).map(([k,v])=>`<option value="${k}" ${u.papel===k?'selected':''}>${v}</option>`).join('')}</select></label>
      <label class="f">Situação<select class="inp" id="mA"><option value="1" ${u.ativo?'selected':''}>Ativo</option><option value="0" ${u.ativo?'':'selected'}>Bloqueado</option></select></label><label class="f">Nova senha (opcional)<input class="inp" id="mS" placeholder="mínimo 8 caracteres"></label></div>
      <div class="mt"><span class="small muted">Lojas autorizadas</span><div class="chk mt" id="mL">${LOJAS.map(l=>`<label><input type="checkbox" value="${l.id}" ${u.lojas.includes(l.id)?'checked':''}> ${esc(l.nome)}</label>`).join('')}</div></div>
      <div class="actions mt"><button class="btn pri" id="mOk">Salvar</button></div>`,el=>{
      el.querySelector('#mX').onclick=fecharModal;
      el.querySelector('#mOk').onclick=async()=>{const body={acao:'atualizar',user_id:u.user_id,nome:el.querySelector('#mN').value,papel:el.querySelector('#mP').value,ativo:el.querySelector('#mA').value==='1',lojas:[...el.querySelectorAll('#mL input:checked')].map(i=>i.value)};const s=el.querySelector('#mS').value;if(s)body.senha=s;
        if(['regional','gerente','colaborador'].includes(body.papel)&&!body.lojas.length&&!confirm('Este perfil precisa de pelo menos uma loja para enxergar dados. Salvar sem lojas?'))return;
        if(await admUsers(body)){toast('Usuário atualizado.');fecharModal();cfUsers()}};
    })});
}
function initConfig(){
  $$('#cfNav button').forEach(b=>b.onclick=()=>{cfSub=b.dataset.s;renderConfig()});
  $('#lgAdd').onclick=async()=>{const r={id:$('#lgId').value.trim().toLowerCase(),nome:$('#lgNome').value.trim(),status:$('#lgSt').value,canais:$('#lgCan').value,inauguracao:$('#lgInau').value||null,ordem:LOJAS.length+1};
    if(!/^[a-z0-9_-]+$/.test(r.id)){toast('Código: só letras minúsculas, números, - ou _ (ex.: moema).');return} if(!r.nome){toast('Informe o nome.');return}
    if(await dbw(sb.from('lojas').insert(r),'Loja cadastrada.')){['#lgId','#lgNome','#lgInau'].forEach(s=>$(s).value='');await load(['lojas']);aplicarLojas();cfLojas()}};
  $('#mtSave').onclick=async()=>{const r={indicador:$('#mtInd').value,loja_id:$('#mtLoja').value||null,valor:num($('#mtVal').value),direcao:$('#mtVal').value===''?null:$('#mtDir').value,vigente_desde:$('#mtDesde').value||isoHoje()};
    if(await dbw(sb.from('metas').insert(r),'Nova meta registrada. O semáforo já usa o novo valor.')){await load(['metas']);cfMetas()}};
  $('#usAdd').onclick=async()=>{const body={acao:'criar',nome:$('#usNome').value.trim(),email:$('#usEmail').value.trim(),senha:$('#usSenha').value,papel:$('#usPapel').value,lojas:$$('#usLojas input:checked').map(i=>i.value)};
    if(!body.nome||!body.email){toast('Informe nome e e-mail.');return}
    if(['regional','gerente','colaborador'].includes(body.papel)&&!body.lojas.length){toast('Selecione pelo menos uma loja para este perfil.');return}
    if(await admUsers(body)){toast('Usuário criado. Envie o e-mail e a senha inicial para a pessoa.');['#usNome','#usEmail','#usSenha'].forEach(s=>$(s).value='');cfUsers()}};
  $('#hsTab').onchange=cfHist;
}
async function cfHist(){
  const t=$('#hsTab').value;
  if(!$('#hsTab').options.length){$('#hsTab').innerHTML='<option value="">Todas as tabelas</option>'+Object.keys(TABLES).concat(['perfis','perfil_lojas']).filter(x=>x!=='ninebox_historico').map(x=>`<option>${x}</option>`).join('')}
  let q=sb.from('historico').select('*').order('em',{ascending:false}).limit(300); if(t)q=q.eq('tabela',t);
  const {data,error}=await q; if(error){$('#tHist').innerHTML=`<tr><td><div class="empty">${esc(error.message)}</div></td></tr>`;return}
  const resumo=h=>{const o=h.depois||h.antes||{};if(h.acao==='UPDATE'&&h.antes&&h.depois){const ch=Object.keys(h.depois).filter(k=>!['updated_at','updated_by'].includes(k)&&JSON.stringify(h.depois[k])!==JSON.stringify(h.antes[k]));return ch.map(k=>`${k}: ${JSON.stringify(h.antes[k])} → ${JSON.stringify(h.depois[k])}`).join(' · ')}
    return ['loja_id','data','mes','semana','nome','item','problema','indicador','valor','chave'].filter(k=>o[k]!=null).map(k=>`${k}: ${typeof o[k]==='object'?'…':o[k]}`).join(' · ')};
  $('#tHist').innerHTML=(data||[]).length?`<tr><th>Quando</th><th>Tabela</th><th>Ação</th><th>Registro</th><th>Detalhe</th></tr>`+data.map(h=>`<tr><td>${new Date(h.em).toLocaleString('pt-BR')}</td><td>${h.tabela}</td><td><span class="sem s-${h.acao==='DELETE'?'bad':h.acao==='INSERT'?'ok':'neu'}" style="min-width:0">${{INSERT:'Inclusão',UPDATE:'Alteração',DELETE:'Exclusão'}[h.acao]}</span></td><td class="muted">${esc(h.registro)}</td><td style="white-space:normal;max-width:620px" class="small">${esc(resumo(h))}</td></tr>`).join(''):'<tr><td><div class="empty">Sem registros.</div></td></tr>';
}
