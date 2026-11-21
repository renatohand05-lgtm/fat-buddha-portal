/* ================= RH ================= */
const NB = { // [desempenho][potencial]
  '3-3':['Talento','Promover ou preparar para o próximo cargo; dar projetos desafiadores.','#3fc58e'],
  '2-3':['Alto potencial','Acelerar desenvolvimento com mentoria e PDI.','#7bd3a9'],
  '1-3':['Enigma','Entender a causa do baixo desempenho; ajustar função ou treinamento.','#f2b33d'],
  '3-2':['Forte desempenho','Reconhecer e ampliar responsabilidades.','#7bd3a9'],
  '2-2':['Mantenedor','Manter engajado e treinar para evoluir.','#eedbca'],
  '1-2':['Questionável','PDI com metas claras e acompanhamento mensal.','#f2b33d'],
  '3-1':['Especialista','Valorizar como referência técnica no cargo atual.','#eedbca'],
  '2-1':['Eficaz','Manter e acompanhar.','#b9aa9e'],
  '1-1':['Insuficiente','Plano de melhoria com prazo; avaliar permanência.','#e5303f'],
};
let rhSub='quadro';
function rhIds(){const v=$('#rhLoja').value;return v==='todas'?LOJAS.map(l=>l.id):[v]}
function renderRH(){
  $$('#rhNav button').forEach(b=>b.classList.toggle('on',b.dataset.s===rhSub));
  $$('.rhs').forEach(s=>s.classList.toggle('on',s.id==='rh-'+rhSub));
  ({quadro:rhQuadro,mov:rhMov,oco:rhOco,perf:rhPerf,nine:rhNine,suc:rhSuc})[rhSub]();
}
const quadroPrev = (id,c) => {const q=(S.db.quadro_previsto||[]).find(x=>x.loja_id===id&&x.cargo===c);return q?q.previsto:0};
const quadroAtivo = (id,c) => people().filter(p=>p.loja_id===id&&p.cargo===c).length;
function rhQuadro(){
  const ids=rhIds(), ps=people().filter(p=>ids.includes(p.loja_id));
  let prev=0,at=0; ids.forEach(id=>CARGOS.forEach(c=>{prev+=quadroPrev(id,c);at+=quadroAtivo(id,c)}));
  const rg=(S.db.rh_movimentos||[]).filter(r=>ids.includes(r.loja_id)&&r.mes<=S.mes), lm=uniq(rg.map(r=>r.mes)).sort().at(-1), lr=rg.filter(r=>r.mes===lm);
  const sm=k=>sum(lr,r=>r[k]);
  const lastT=lr.length?(sm('admissoes')+sm('desligamentos'))/2/sm('headcount')*100:null;
  const lastA=lr.length?sm('faltas')/sm('dias_previstos')*100:null;
  const casa=ps.length?sum(ps,p=>mesesCasa(p.admissao))/ps.length:null;
  const tal=ps.filter(p=>p.desempenho===3&&p.potencial===3).length;
  $('#rhKpis').innerHTML=kpi('Colaboradores ativos',at,'int',`de ${prev} previstos`,prev?at/prev*100:null)+kpi('Vagas abertas',Math.max(0,prev-at),'int','para completar o quadro')+
    kpi('Turnover',lastT,'pct1',lm?mesTxt(lm)+' · seleção atual':'sem lançamento ainda')+
    kpi('Absenteísmo',lastA,'pct1',lm?mesTxt(lm)+' · seleção atual':'sem lançamento ainda')+
    kpi('Tempo médio de casa',casa,'int','meses')+kpi('Talentos no nine box',ps.length?tal:null,'int','alto desempenho e alto potencial');
  animateKpis($('#rhKpis'));
  $('#tQuadro').innerHTML=`<tr><th>Cargo</th>${ids.map(id=>`<th class="num">${esc(lojaNome(id))}</th>`).join('')}<th class="num">Total</th></tr>`+
    CARGOS.map(c=>{let tp=0,ta=0;return `<tr><td><b>${c}</b></td>${ids.map(id=>{const q={previsto:quadroPrev(id,c),ativo:quadroAtivo(id,c)};tp+=q.previsto;ta+=q.ativo;return `<td class="num"><span class="sem s-${q.ativo>=q.previsto?'ok':q.ativo>=q.previsto*.8?'warn':'bad'}">${q.ativo}/${q.previsto}</span></td>`}).join('')}<td class="num"><b>${ta}/${tp}</b></td></tr>`}).join('');
  $('#tCasa').innerHTML=ps.length?`<tr><th>Cargo</th><th class="num">Pessoas</th><th class="num">Tempo médio de casa</th><th class="num">Até 6 meses</th><th class="num">6 a 12 meses</th><th class="num">Mais de 1 ano</th></tr>`+
    CARGOS.map(c=>{const g=ps.filter(p=>p.cargo===c);if(!g.length)return '';const m=g.map(p=>mesesCasa(p.admissao));return `<tr><td><b>${c}</b></td><td class="num">${g.length}</td><td class="num">${casaTxt(Math.round(sum(m)/g.length))}</td><td class="num">${m.filter(x=>x<6).length}</td><td class="num">${m.filter(x=>x>=6&&x<12).length}</td><td class="num">${m.filter(x=>x>=12).length}</td></tr>`}).join(''):'<tr><td><div class="empty">Nenhum colaborador cadastrado nesta seleção.</div></td></tr>';
  const fil=$('#coFil').value, all=(S.db.colaboradores||[]).filter(p=>ids.includes(p.loja_id)&&(fil==='todos'||(fil==='ativos'?ativo(p):!ativo(p))));
  $('#tCol').innerHTML=all.length?`<tr><th>Nome</th><th>Cargo</th><th>Loja</th><th>Admissão</th><th>Tempo de casa</th><th>Situação</th><th></th></tr>`+
    all.sort((a,b)=>CARGOS.indexOf(a.cargo)-CARGOS.indexOf(b.cargo)||a.nome.localeCompare(b.nome)).map(p=>`<tr><td><b>${esc(p.nome)}</b></td><td>${esc(p.cargo)}</td><td>${esc(lojaNome(p.loja_id))}</td><td>${fmtD(p.admissao)}</td><td>${casaTxt(mesesCasa(p.admissao,p.desligamento&&!ativo(p)?p.desligamento:null))}</td><td>${ativo(p)?'<span class="sem s-ok" style="min-width:0">Ativo</span>':`<span class="sem s-neu" style="min-width:0">Desligado em ${fmtD(p.desligamento)}</span>`}</td><td class="num">${P.editar(p.loja_id)?`<button class="btn sm" data-coe="${p.id}">Editar</button>`:''}</td></tr>`).join('')
    :'<tr><td><div class="empty">Nenhum colaborador nesta seleção.</div></td></tr>';
  $('#tCol').querySelectorAll('[data-coe]').forEach(b=>b.onclick=()=>editarColab(+b.dataset.coe));
}
function editarColab(id){
  const p=S.db.colaboradores.find(x=>x.id===id);
  modal(`<h3>Editar colaborador <small><button class="btn sm" id="mX">Fechar</button></small></h3>
    <div class="form-row" style="grid-template-columns:1fr 1fr">
      <label class="f">Nome<input class="inp" id="mNome" value="${esc(p.nome)}"></label>
      <label class="f">Cargo<select class="inp" id="mCargo">${CARGOS.map(c=>`<option ${c===p.cargo?'selected':''}>${c}</option>`).join('')}</select></label>
      <label class="f">Loja<select class="inp" id="mLoja">${optLojas(lojasEditaveis(),p.loja_id)}</select></label>
      <label class="f">Admissão<input class="inp" type="date" id="mAdm" value="${p.admissao}"></label>
      <label class="f">Data de desligamento<input class="inp" type="date" id="mDes" value="${p.desligamento||''}"></label>
    </div>
    <p class="small muted mt">Ao informar a data de desligamento o colaborador sai do quadro ativo; o histórico é mantido. Para registrar o desligamento no turnover, lance o mês em "Turnover e absenteísmo".</p>
    <div class="actions mt">${P.gestor?'<button class="btn" id="mDel">Excluir cadastro</button>':''}<button class="btn pri" id="mOk">Salvar</button></div>`,el=>{
    el.querySelector('#mX').onclick=fecharModal;
    el.querySelector('#mOk').onclick=async()=>{const u={nome:el.querySelector('#mNome').value.trim(),cargo:el.querySelector('#mCargo').value,loja_id:el.querySelector('#mLoja').value,admissao:el.querySelector('#mAdm').value,desligamento:el.querySelector('#mDes').value||null};
      if(!u.nome||!u.admissao){toast('Nome e admissão são obrigatórios.');return}
      if(u.desligamento&&u.desligamento<u.admissao){toast('O desligamento não pode ser antes da admissão.');return}
      if(await dbw(sb.from('colaboradores').update(u).eq('id',id),'Colaborador atualizado.')){fecharModal();await load(['colaboradores','ninebox_historico']);renderRH()}};
    const d=el.querySelector('#mDel'); if(d) d.onclick=async()=>{if(!confirm('Excluir o cadastro apaga também as ocorrências e o histórico de nine box desta pessoa. Para quem saiu da empresa, prefira informar a data de desligamento. Excluir mesmo assim?'))return;
      if(await dbw(sb.from('colaboradores').delete().eq('id',id),'Cadastro excluído.')){fecharModal();await load(['colaboradores','ocorrencias','ninebox_historico']);renderRH()}};
  });
}
function gerScore(id,mes=S.mes){
  const g=people().find(p=>p.loja_id===id&&p.cargo==='Gerente de loja');
  const op=OPER.find(l=>l.id===id);
  if(!op) return {g,id,op:false};
  const s=lojaStats(id,mes), v=s.vals, ms=METAS(id,mes).filter(m=>m.meta!=null&&v[m.k]!=null), ok=ms.filter(m=>status(m,v[m.k])==='ok').length;
  const vis=(S.db.visitas_qualidade||[]).filter(x=>x.loja_id===id&&x.data<=fimMes(mes)).sort((a,b)=>b.data.localeCompare(a.data))[0];
  const lin=(x,a,b)=>x==null?null:Math.max(0,Math.min(100,(b-x)/(b-a)*100));
  const pT=lin(v.turnover,3,10), pA=lin(v.absent,2,6);
  const ld=(S.db.lideranca||[]).filter(x=>x.loja_id===id&&x.mes<=mes).sort((a,b)=>b.mes.localeCompare(a.mes))[0];
  const comp={vendas:s.pctMeta!=null?Math.min(100,s.pctMeta):null,ind:ms.length?ok/ms.length*100:null,qual:vis?+vis.score:null,pessoas:pT!=null&&pA!=null?(pT+pA)/2:null,lider:ld?ld.nota/5*100:null};
  const W={vendas:30,ind:25,qual:15,pessoas:15,lider:15};
  let sw=0,sc=0;Object.keys(W).forEach(k=>{if(comp[k]!=null){sw+=W[k];sc+=W[k]*comp[k]}});
  const score=sw?sc/sw:null;
  const rec=score==null?['Sem dados','s-neu','Lance vendas, indicadores, RH, liderança ou uma visita para calcular o score.']:score>=85&&g&&g.potencial===3?['Pronto para promoção','s-ok','Candidato a Supervisor Regional na estrutura de 10 lojas.']:score>=70?['Desenvolver (PDI)','s-neu','Manter no cargo com plano de desenvolvimento individual.']:score>=55?['Acompanhar de perto','s-warn','Plano de ação mensal nos indicadores fora da meta.']:['Plano de melhoria','s-bad','Metas claras com prazo de 90 dias e acompanhamento semanal.'];
  return {g,id,op:true,comp,score,ok,tot:ms.length,vis,ld,rec,pesos:sw};
}
let perfSel=null;
function rhPerf(){
  const ids=rhIds().filter(id=>LBYID[id]); const rows=ids.map(id=>gerScore(id));
  $('#tPerf').innerHTML=`<tr><th>Gerente</th><th>Loja</th><th>Tempo de casa</th><th class="num">Vendas x meta</th><th class="num">Indicadores</th><th class="num">Qualidade</th><th class="num">Turnover</th><th class="num">Liderança</th><th>Nine box</th><th class="num">Score</th><th>Recomendação</th></tr>`+
    rows.map(r=>{const nb=r.g?NB[r.g.desempenho+'-'+r.g.potencial]:null;const gn=r.g?`<b>${esc(r.g.nome)}</b>`:'<span class="muted">sem gerente cadastrado</span>';
      if(!r.op)return `<tr><td>${gn}</td><td>${esc(lojaNome(r.id))}</td><td>${r.g?casaTxt(mesesCasa(r.g.admissao)):'—'}</td><td colspan="5" class="muted">Loja ${LBYID[r.id].status==='inauguracao'?'em inauguração — avaliação a partir do 1º mês':'fora de operação'}</td><td>${nb?`<span class="tag">${nb[0]}</span>`:'—'}</td><td class="num">—</td><td>—</td></tr>`;
      const v=lojaStats(r.id).vals;return `<tr data-g="${r.id}" class="click ${r.id===perfSel?'sel':''}"><td>${gn}</td><td>${esc(lojaNome(r.id))}</td><td>${r.g?casaTxt(mesesCasa(r.g.admissao)):'—'}</td><td class="num">${r.comp.vendas!=null?nf0.format(lojaStats(r.id).pctMeta)+'%':'—'}</td><td class="num">${r.tot?r.ok+'/'+r.tot:'—'}</td><td class="num">${r.vis?nf0.format(r.vis.score)+'%':'—'}</td><td class="num">${v.turnover!=null?nf1.format(v.turnover)+'%':'—'}</td><td class="num">${r.ld?nf1.format(r.ld.nota):'—'}</td><td>${nb?`<span class="tag">${nb[0]}</span>`:'—'}</td><td class="num"><b style="color:${r.score==null?C.tick:r.score>=85?C.green:r.score>=70?C.beige:r.score>=55?C.gold:C.red}">${r.score==null?'—':nf0.format(r.score)}</b></td><td><span class="sem ${r.rec[1]}" style="min-width:0">${r.rec[0]}</span></td></tr>`}).join('');
  $('#tPerf').querySelectorAll('tr.click').forEach(tr=>tr.onclick=()=>{perfSel=tr.dataset.g;rhPerf()});
  let r=rows.find(x=>x.id===perfSel&&x.op)||rows.find(x=>x.op&&x.score!=null)||rows.find(x=>x.op);
  if(!r||r.score==null){$('#perfNome').textContent='Detalhe';$('#perfRec').innerHTML='<div class="empty">Sem dados suficientes para calcular o score nesta seleção.</div>';if(charts.cPerf){charts.cPerf.destroy();delete charts.cPerf}}
  else{
    perfSel=r.id;
    $('#perfNome').innerHTML=`${r.g?esc(r.g.nome):'Sem gerente cadastrado'} <small>${esc(lojaNome(r.id))}</small>`;
    const L=[['vendas','Vendas'],['ind','Indicadores'],['qual','Qualidade'],['pessoas','Pessoas'],['lider','Liderança']].filter(([k])=>r.comp[k]!=null);
    if(L.length<3) mk('cPerf',{type:'bar',data:{labels:L.map(x=>x[1]),datasets:[{label:'Componente',data:L.map(([k])=>r.comp[k]),backgroundColor:L.map(([k])=>r.comp[k]>=85?'rgba(63,197,142,.85)':r.comp[k]>=55?'rgba(242,179,61,.85)':'rgba(229,48,63,.85)'),borderRadius:8,maxBarThickness:60}]},options:{plugins:{legend:{display:false}},scales:{y:{min:0,max:100,grid:{color:C.grid},border:{display:false}},x:xG}}});
    else mk('cPerf',{type:'radar',data:{labels:L.map(x=>x[1]),datasets:[{label:'Score',data:L.map(([k])=>r.comp[k]),borderColor:C.red,backgroundColor:'rgba(229,48,63,.25)',pointBackgroundColor:C.gold,borderWidth:2}]},
      options:{plugins:{legend:{display:false}},scales:{r:{min:0,max:100,ticks:{display:false,stepSize:25},grid:{color:C.grid},angleLines:{color:C.grid},pointLabels:{color:C.tick,font:{size:12}}}}}});
    const falt=[['vendas','vendas x meta'],['ind','indicadores'],['qual','visita de qualidade'],['pessoas','turnover e absenteísmo'],['lider','nota de liderança']].filter(([k])=>r.comp[k]==null).map(x=>x[1]);
    $('#perfRec').innerHTML=`<div class="metas-list"><div><span>Score geral</span><b>${nf0.format(r.score)} de 100</b></div><div><span>Recomendação</span><b>${r.rec[0]}</b></div><div><span>Pesos com dado</span><b>${r.pesos}%</b></div></div><p class="small muted" style="margin-top:10px">${r.rec[2]}${falt.length?' Sem dado no mês (peso redistribuído): '+falt.join(', ')+'.':''}</p>`;
  }
  const h=(S.db.avaliacoes_gerentes||[]).filter(a=>ids.includes(a.loja_id)).sort((a,b)=>b.periodo.localeCompare(a.periodo)||a.loja_id.localeCompare(b.loja_id));
  $('#tPerfHist').innerHTML=h.length?`<tr><th>Período</th><th>Loja</th><th>Gerente</th><th class="num">Vendas</th><th class="num">Indicadores</th><th class="num">Qualidade</th><th class="num">Pessoas</th><th class="num">Liderança</th><th class="num">Score</th><th>Recomendação</th></tr>`+
    h.map(a=>{const c=a.componentes||{},f=v=>v==null?'—':nf0.format(v),g=(S.db.colaboradores||[]).find(x=>x.id===a.colaborador_id);return `<tr><td>${mesTxt(a.periodo)}</td><td><b>${esc(lojaNome(a.loja_id))}</b></td><td>${g?esc(g.nome):'—'}</td><td class="num">${f(c.vendas)}</td><td class="num">${f(c.ind)}</td><td class="num">${f(c.qual)}</td><td class="num">${f(c.pessoas)}</td><td class="num">${f(c.lider)}</td><td class="num"><b>${nf0.format(a.score)}</b></td><td>${esc(a.recomendacao)}</td></tr>`}).join('')
    :'<tr><td><div class="empty">Nenhuma avaliação salva. Use "Salvar avaliação do mês" para registrar o histórico.</div></td></tr>';
}
function nbFiltered(){const ids=rhIds(),c=$('#nbCargo').value;return people().filter(p=>ids.includes(p.loja_id)&&(c==='todos'||p.cargo===c))}
function rhNine(){
  const ps=nbFiltered();
  $('#nbCount').textContent=`${ps.length} pessoas`;
  let h='<div class="nb-y">Potencial</div><div class="nb-grid">';
  for(let p=3;p>=1;p--)for(let d=1;d<=3;d++){const k=d+'-'+p, nb=NB[k], g=ps.filter(x=>x.desempenho===d&&x.potencial===p);
    h+=`<div class="nb-cell" style="--c:${nb[2]}"><div class="nb-h"><b>${nb[0]}</b><span>${g.length}</span></div><div class="nb-names">${g.map(x=>`<span title="${esc(x.cargo)} · ${esc(lojaNome(x.loja_id))}">${esc(x.nome)}<i>${x.cargo.split(' ')[0]}</i></span>`).join('')}</div></div>`}
  h+='</div><div class="nb-x"><span>Baixo</span><span>Desempenho</span><span>Alto</span></div><div class="nb-yl"><span>Alto</span><span>Médio</span><span>Baixo</span></div>';
  $('#nine').innerHTML=h;
  $('#nbLeg').innerHTML=['3-3','2-3','3-2','2-2','1-3','3-1','1-2','2-1','1-1'].map(k=>`<div><span><b style="color:${NB[k][2]}">${NB[k][0]}</b><br><span class="small muted">${NB[k][1]}</span></span></div>`).join('');
  const sel=(p,f,v)=>P.editar(p.loja_id)?`<select class="inp nbsel" data-id="${p.id}" data-f="${f}">${[1,2,3].map(n=>`<option value="${n}" ${v===n?'selected':''}>${LV[n]}</option>`).join('')}</select>`:LV[v];
  $('#tNine').innerHTML=ps.length?`<tr><th>Nome</th><th>Cargo</th><th>Loja</th><th>Tempo de casa</th><th>Desempenho</th><th>Potencial</th><th>Quadrante</th></tr>`+
    ps.sort((a,b)=>CARGOS.indexOf(a.cargo)-CARGOS.indexOf(b.cargo)||a.loja_id.localeCompare(b.loja_id)).map(p=>`<tr><td><b>${esc(p.nome)}</b></td><td>${esc(p.cargo)}</td><td>${esc(lojaNome(p.loja_id))}</td><td>${casaTxt(mesesCasa(p.admissao))}</td><td>${sel(p,'desempenho',p.desempenho)}</td><td>${sel(p,'potencial',p.potencial)}</td><td><span class="tag" style="color:${NB[p.desempenho+'-'+p.potencial][2]}">${NB[p.desempenho+'-'+p.potencial][0]}</span></td></tr>`).join('')
    :'<tr><td><div class="empty">Cadastre colaboradores em "Quadro de pessoal" para avaliá-los no nine box.</div></td></tr>';
  $('#tNine').querySelectorAll('.nbsel').forEach(s=>s.onchange=async()=>{if(await dbw(sb.from('colaboradores').update({[s.dataset.f]:+s.value}).eq('id',s.dataset.id),'Avaliação atualizada.')){await load(['colaboradores','ninebox_historico']);rhNine()}});
  const ids=rhIds(), cb=Object.fromEntries((S.db.colaboradores||[]).map(c=>[c.id,c]));
  const hist=(S.db.ninebox_historico||[]).filter(x=>cb[x.colaborador_id]&&ids.includes(cb[x.colaborador_id].loja_id)&&x.ant_desempenho!=null).sort((a,b)=>b.em.localeCompare(a.em)).slice(0,200);
  $('#tNbHist').innerHTML=hist.length?`<tr><th>Quando</th><th>Colaborador</th><th>Loja</th><th>Antes</th><th>Depois</th></tr>`+hist.map(x=>{const c=cb[x.colaborador_id];return `<tr><td>${new Date(x.em).toLocaleString('pt-BR')}</td><td><b>${esc(c.nome)}</b></td><td>${esc(lojaNome(c.loja_id))}</td><td>${NB[x.ant_desempenho+'-'+x.ant_potencial][0]}</td><td><b style="color:${NB[x.desempenho+'-'+x.potencial][2]}">${NB[x.desempenho+'-'+x.potencial][0]}</b></td></tr>`}).join(''):'<tr><td><div class="empty">Nenhuma alteração registrada ainda.</div></td></tr>';
}
const TRILHAS=[
  {n:'Trilha de cozinha',c:['Auxiliar de cozinha','Chefe de cozinha','Gerente de loja','Supervisor Regional']},
  {n:'Trilha de salão e delivery',c:['Atendente','Líder de delivery','Gerente de loja','Supervisor Regional']}];
const REQ={
  'Auxiliar de cozinha':{min:12,txt:'12 meses no cargo, domínio das fichas técnicas e boas práticas, treinamento de liderança de praça.'},
  'Atendente':{min:6,txt:'6 meses no cargo, conhecimento das plataformas e da expedição, treinamento de conferência e embalagem.'},
  'Chefe de cozinha':{min:12,txt:'12 meses no cargo, CMV e rupturas na meta, treinamento de gestão (DRE, escalas e estoque).'},
  'Líder de delivery':{min:12,txt:'12 meses no cargo, preparo, cancelamentos e nota iFood na meta, treinamento de gestão.'},
  'Gerente de loja':{min:18,txt:'18 meses no cargo, loja acima de R$ 500 mil, indicadores na meta e nine box "Talento".'},
  'Supervisor Regional':{min:null,txt:'Cargo previsto na estrutura de 10 lojas (2 supervisores, 5 lojas cada).'}};
const prontos=c=>{const r=REQ[c];if(!r||r.min==null)return [];return people().filter(p=>rhIds().includes(p.loja_id)&&p.cargo===c&&p.potencial===3&&p.desempenho>=2&&mesesCasa(p.admissao)>=r.min)};
const FEED={'Gerente de loja':['Chefe de cozinha','Líder de delivery'],'Chefe de cozinha':['Auxiliar de cozinha'],'Líder de delivery':['Atendente']};
function prontidao(p){return p.desempenho===3&&p.potencial===3?['Pronto agora','s-ok']:p.potencial===3?['6 a 12 meses','s-warn']:p.potencial===2&&p.desempenho===3?['12 a 24 meses','s-neu']:null}
function sucessaoRows(){
  const ps=people(), rows=[];
  rhIds().forEach(id=>Object.keys(FEED).forEach(cargo=>{
    const tit=ps.filter(p=>p.loja_id===id&&p.cargo===cargo);
    const cand=ps.filter(p=>p.loja_id===id&&FEED[cargo].includes(p.cargo)&&prontidao(p)).sort((a,b)=>(b.potencial*3+b.desempenho)-(a.potencial*3+a.desempenho));
    rows.push({id,cargo,tit,cand});
  }));
  return rows;
}
function rhSuc(){
  $('#trilhas').innerHTML=TRILHAS.map(t=>`<div class="trilha"><div class="tr-n">${t.n}</div><div class="tr-steps">${t.c.map((c,i)=>{const pr=prontos(c);const n=c==='Supervisor Regional'?0:people().filter(p=>rhIds().includes(p.loja_id)&&p.cargo===c).length;
    return `${i?'<div class="tr-arr">→</div>':''}<div class="tr-step"><b>${c}</b><span class="small muted">${n?n+' pessoa'+(n>1?'s':''):'—'}</span><p>${REQ[c].txt}</p>${REQ[c].min!=null?`<div class="tr-ok ${pr.length?'':'zero'}">${pr.length} pronto${pr.length===1?'':'s'} para subir${pr.length?': '+pr.map(p=>esc(p.nome)).join(', '):''}</div>`:''}</div>`}).join('')}</div></div>`).join('');
  const rows=sucessaoRows();
  $('#tSuc').innerHTML=`<tr><th>Loja</th><th>Cargo-chave</th><th>Titular</th><th>Nine box do titular</th><th>Sucessor indicado</th><th>Prontidão</th><th>Risco</th></tr>`+
    rows.map(r=>{const t=r.tit[0], c=r.cand[0], pr=c&&prontidao(c);const tnb=t?NB[t.desempenho+'-'+t.potencial][0]:'—';
      const risco=!c?['Sem sucessor','s-bad']:pr[0]==='Pronto agora'?['Baixo','s-ok']:['Médio','s-warn'];
      return `<tr><td><b>${esc(lojaNome(r.id))}</b></td><td>${r.cargo}</td><td>${t?esc(t.nome)+(r.tit.length>1?` +${r.tit.length-1}`:''):'<span class="muted">vago</span>'}</td><td>${tnb}</td><td>${c?`${esc(c.nome)} <span class="small muted">(${c.cargo})</span>`+(r.cand.length>1?` <span class="small muted">+${r.cand.length-1}</span>`:''):'<span class="muted">Nenhum candidato com potencial</span>'}</td><td>${pr?`<span class="sem ${pr[1]}" style="min-width:0">${pr[0]}</span>`:'—'}</td><td><span class="sem ${risco[1]}" style="min-width:0">${risco[0]}</span></td></tr>`}).join('');
}
function initRH(){
  $('#rhLoja').innerHTML=(LOJAS.length>1?`<option value="todas">Todas as lojas</option>`:'')+optLojas(LOJAS);
  $('#rhLoja').onchange=renderRH;
  $('#nbCargo').innerHTML=`<option value="todos">Todos os cargos</option>`+CARGOS.map(c=>`<option>${c}</option>`).join('');
  $('#nbCargo').onchange=rhNine;
  $$('#rhNav button').forEach(b=>b.onclick=()=>{rhSub=b.dataset.s;renderRH()});
  $('#nbCsv').onclick=()=>csv('nine-box-fat-buddha.csv',[['Nome','Cargo','Loja','Admissão','Desempenho','Potencial','Quadrante']].concat(people().filter(p=>rhIds().includes(p.loja_id)).map(p=>[p.nome,p.cargo,lojaNome(p.loja_id),p.admissao,LV[p.desempenho],LV[p.potencial],NB[p.desempenho+'-'+p.potencial][0]])));
  // colaboradores
  $('#coCargo').innerHTML=CARGOS.map(c=>`<option>${c}</option>`).join(''); $('#coLoja').innerHTML=optLojas(lojasEditaveis()); $('#coAdm').value=isoHoje();
  $('#coFil').onchange=rhQuadro;
  $('#coSave').onclick=async()=>{const r={nome:$('#coNome').value.trim(),cargo:$('#coCargo').value,loja_id:$('#coLoja').value,admissao:$('#coAdm').value,desempenho:+$('#coDes').value,potencial:+$('#coPot').value};
    if(!r.nome||!r.admissao||!r.loja_id){toast('Informe nome, loja e admissão.');return}
    if((S.db.colaboradores||[]).some(p=>ativo(p)&&p.nome.toLowerCase()===r.nome.toLowerCase()&&p.loja_id===r.loja_id)&&!confirm('Já existe um colaborador ativo com este nome nesta loja. Cadastrar mesmo assim?'))return;
    if(await dbw(sb.from('colaboradores').insert(r),'Colaborador cadastrado.')){$('#coNome').value='';await load(['colaboradores','ninebox_historico']);initOcoPes();rhQuadro()}};
  $('#coCsv').onclick=()=>csv('colaboradores-fat-buddha.csv',[['Nome','Cargo','Loja','Admissão','Desligamento','Desempenho','Potencial']].concat((S.db.colaboradores||[]).filter(p=>rhIds().includes(p.loja_id)).map(p=>[p.nome,p.cargo,lojaNome(p.loja_id),p.admissao,p.desligamento,LV[p.desempenho],LV[p.potencial]])));
  // performance
  $('#ldLoja').innerHTML=optLojas(lojasEditaveis(true));
  $('#ldSave').onclick=async()=>{const n=num($('#ldNota').value);if(n==null||n<0||n>5){toast('A nota vai de 0 a 5.');return}
    if(await dbw(sb.from('lideranca').upsert({loja_id:$('#ldLoja').value,mes:S.mes,nota:n},{onConflict:'loja_id,mes'}),`Nota de liderança de ${mesTxt(S.mes)} salva.`)){$('#ldNota').value='';await load(['lideranca']);rhPerf()}};
  $('#pfSave').onclick=async()=>{const rows=rhIds().filter(id=>P.editar(id)).map(id=>gerScore(id)).filter(r=>r.op&&r.score!=null);
    if(!rows.length){toast('Nenhuma loja com score calculado para salvar.');return}
    if(!confirm(`Salvar a avaliação de ${mesLongo(S.mes)} para ${rows.length} loja(s)? Uma avaliação já salva no mesmo mês será substituída.`))return;
    if(await dbw(sb.from('avaliacoes_gerentes').upsert(rows.map(r=>({loja_id:r.id,colaborador_id:r.g?r.g.id:null,periodo:S.mes,score:Math.round(r.score*10)/10,componentes:r.comp,recomendacao:r.rec[0]})),{onConflict:'loja_id,periodo'}),'Avaliações salvas.')){await load(['avaliacoes_gerentes']);rhPerf()}};
  $('#pfCsv').onclick=()=>csv('avaliacao-gerentes-fat-buddha.csv',[['Período','Loja','Gerente','Vendas','Indicadores','Qualidade','Pessoas','Liderança','Score','Recomendação']].concat((S.db.avaliacoes_gerentes||[]).map(a=>{const c=a.componentes||{},g=(S.db.colaboradores||[]).find(x=>x.id===a.colaborador_id);return [a.periodo,lojaNome(a.loja_id),g?g.nome:'',c.vendas,c.ind,c.qual,c.pessoas,c.lider,a.score,a.recomendacao]})));
}

/* ================= RH: turnover e absenteísmo ================= */
function rhMov(){
  const reg=S.db.rh_movimentos||[];
  const ids=rhIds().filter(id=>OPER.some(l=>l.id===id)||reg.some(r=>r.loja_id===id));
  const meses=uniq(reg.filter(r=>ids.includes(r.loja_id)).map(r=>r.mes)).sort().slice(-12);
  const cell=(id,m,f)=>{const r=reg.find(x=>x.loja_id===id&&x.mes===m);return r?f(r):null};
  const rede=(m,f)=>{const rs=reg.filter(x=>x.mes===m&&ids.includes(x.loja_id));if(!rs.length)return null;const s=k=>sum(rs,r=>r[k]);return f({headcount:s('headcount'),admissoes:s('admissoes'),desligamentos:s('desligamentos'),faltas:s('faltas'),dias_previstos:s('dias_previstos')})};
  const tbl=(f,lim)=>meses.length?`<tr><th>Loja</th>${meses.map(m=>`<th class="num">${mesTxt(m)}</th>`).join('')}<th class="num">Média</th></tr>`+
    ids.concat(['__rede']).map(id=>{const vals=meses.map(m=>id==='__rede'?rede(m,f):cell(id,m,f));const ok=vals.filter(v=>v!=null);const md=ok.length?sum(ok)/ok.length:null;
      return `<tr ${id==='__rede'?'style="background:rgba(255,255,255,.04)"':''}><td><b>${id==='__rede'?'Rede':esc(lojaNome(id))}</b></td>${vals.map(v=>`<td class="num">${v==null?'<span class="muted">—</span>':`<span class="sem s-${v<=lim[0]?'ok':v<=lim[1]?'warn':'bad'}" style="min-width:58px">${nf1.format(v)}%</span>`}</td>`).join('')}<td class="num"><b>${md==null?'—':nf1.format(md)+'%'}</b></td></tr>`}).join('')
    :'<tr><td><div class="empty">Nenhum mês lançado ainda.</div></td></tr>';
  $('#tTurnLoja').innerHTML=tbl(turnOf,[4,7]);
  $('#tAbsLoja').innerHTML=tbl(absOf,[2.5,4]);
  const ds=f=>ids.map((id,i)=>({label:lojaNome(id),data:meses.map(m=>cell(id,m,f)),borderColor:PAL[i%6],backgroundColor:PAL[i%6],tension:.35,pointRadius:3,borderWidth:1.6,spanGaps:true}))
    .concat([{label:'Rede',data:meses.map(m=>rede(m,f)),borderColor:'#ffffff',backgroundColor:'#ffffff',borderWidth:3,pointRadius:4,tension:.35}]);
  if(meses.length){mk('cTurn',{type:'line',data:{labels:meses.map(mesTxt),datasets:ds(turnOf)},options:{plugins:{tooltip:tipPct},scales:{y:yPct,x:xG}}});
    mk('cAbs',{type:'line',data:{labels:meses.map(mesTxt),datasets:ds(absOf)},options:{plugins:{tooltip:tipPct},scales:{y:yPct,x:xG}}})}
  else{noData('cTurn','Sem histórico de turnover.');noData('cAbs','Sem histórico de absenteísmo.')}
  const lst=reg.filter(r=>ids.includes(r.loja_id)).sort((a,b)=>b.mes.localeCompare(a.mes)||a.loja_id.localeCompare(b.loja_id));
  $('#tMov').innerHTML=lst.length?`<tr><th>Mês</th><th>Loja</th><th class="num">Headcount</th><th class="num">Admissões</th><th class="num">Desligamentos</th><th class="num">Dias de falta</th><th class="num">Dias previstos</th><th class="num">Turnover</th><th class="num">Absenteísmo</th><th></th></tr>`+
    lst.map(r=>`<tr><td>${mesTxt(r.mes)}</td><td><b>${esc(lojaNome(r.loja_id))}</b></td><td class="num">${nf1.format(r.headcount).replace(',0','')}</td><td class="num">${r.admissoes}</td><td class="num">${r.desligamentos}</td><td class="num">${nf1.format(r.faltas).replace(',0','')}</td><td class="num">${nf0.format(r.dias_previstos)}</td><td class="num">${nf1.format(turnOf(r))}%</td><td class="num">${nf1.format(absOf(r))}%</td><td class="num">${P.excluir(r.loja_id)?`<button class="btn sm" data-mv="${r.loja_id}|${r.mes}">Excluir</button>`:''}</td></tr>`).join('')
    :'<tr><td><div class="empty">Nenhum lançamento.</div></td></tr>';
  $('#tMov').querySelectorAll('[data-mv]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este lançamento?'))return;const [l,m]=b.dataset.mv.split('|');if(await dbw(sb.from('rh_movimentos').delete().eq('loja_id',l).eq('mes',m),'Lançamento excluído.')){await load(['rh_movimentos']);rhMov()}});
}
function initMov(){
  $('#mvLoja').innerHTML=optLojas(lojasEditaveis());
  $('#mvMes').value=S.mes;
  const prev=()=>{const hc=+$('#mvHc').value,ad=+$('#mvAd').value,de=+$('#mvDe').value,fa=+$('#mvFa').value,pr=+$('#mvPr').value;if(hc&&pr)$('#mvPrev').textContent=`Turnover: ${nf1.format((ad+de)/2/hc*100)}% · Absenteísmo: ${nf1.format(fa/pr*100)}%`};
  const fillHc=()=>{const id=$('#mvLoja').value;const r=IDX.rh.get(id+'|'+$('#mvMes').value);
    if(r){$('#mvHc').value=r.headcount;$('#mvAd').value=r.admissoes;$('#mvDe').value=r.desligamentos;$('#mvFa').value=r.faltas;$('#mvPr').value=r.dias_previstos}
    else{const hc=people().filter(p=>p.loja_id===id).length;$('#mvHc').value=hc||'';$('#mvPr').value=hc?hc*26:'';$('#mvAd').value=0;$('#mvDe').value=0;$('#mvFa').value=0}prev()};
  $('#mvLoja').onchange=fillHc; $('#mvMes').onchange=fillHc; ['#mvHc','#mvAd','#mvDe','#mvFa','#mvPr'].forEach(s=>$(s).oninput=prev); $('#mvHc').addEventListener('input',()=>{$('#mvPr').value=(+$('#mvHc').value||0)*26;prev()});
  fillHc();
  $('#mvSave').onclick=async()=>{const r={loja_id:$('#mvLoja').value,mes:$('#mvMes').value,headcount:+$('#mvHc').value,admissoes:+$('#mvAd').value||0,desligamentos:+$('#mvDe').value||0,faltas:+$('#mvFa').value||0,dias_previstos:+$('#mvPr').value};
    if(!r.mes||!r.headcount||!r.dias_previstos){toast('Preencha mês, headcount e dias previstos.');return}
    if(r.faltas>r.dias_previstos){toast('Dias de falta não podem passar dos dias previstos.');return}
    if(await dbw(sb.from('rh_movimentos').upsert(r,{onConflict:'loja_id,mes'}),'Mês salvo.')){await load(['rh_movimentos']);rhMov()}};
  $('#mvCsv').onclick=()=>csv('turnover-absenteismo-fat-buddha.csv',[['Mês','Loja','Headcount médio','Admissões','Desligamentos','Dias de falta','Dias previstos','Turnover %','Absenteísmo %']].concat((S.db.rh_movimentos||[]).map(r=>[r.mes,lojaNome(r.loja_id),r.headcount,r.admissoes,r.desligamentos,r.faltas,r.dias_previstos,turnOf(r).toFixed(1),absOf(r).toFixed(1)])));
}

/* ================= RH: ocorrências e advertências ================= */
const OC_TIPOS=['Advertência verbal','Advertência escrita','Suspensão','Falta injustificada','Atraso','Atestado médico','Feedback','Elogio','Treinamento','Desligamento'];
const OC_COR={'Advertência verbal':'warn','Advertência escrita':'bad','Suspensão':'bad','Falta injustificada':'bad','Atraso':'warn','Atestado médico':'neu','Feedback':'neu','Elogio':'ok','Treinamento':'ok','Desligamento':'bad'};
const OC_ST=['Registrada','Aguardando assinatura','Assinada','Recusou assinar (com testemunhas)','Concluída'];
function rhOco(){
  const ids=rhIds().filter(id=>P.veOco(id));
  if(!ids.length){$('#ocKpis').innerHTML='';$('#ocAlert').innerHTML='';$('#tOcRes').innerHTML='';$('#tOc').innerHTML='<tr><td><div class="empty">Ocorrências disciplinares são restritas a administrador, consultor, regional e gerente da loja.</div></td></tr>';return}
  const cb=Object.fromEntries((S.db.colaboradores||[]).map(p=>[p.id,p]));
  const all=(S.db.ocorrencias||[]).filter(o=>ids.includes(o.loja_id));
  const seis=addDia(isoHoje(),-183);const rec=all.filter(o=>o.data>=seis);
  const n=t=>rec.filter(o=>o.tipo===t).length;
  $('#ocKpis').innerHTML=kpi('Advertências',n('Advertência verbal')+n('Advertência escrita'),'int','verbais e escritas · 6 meses')+kpi('Suspensões',n('Suspensão'),'int','6 meses')+kpi('Faltas injustificadas',n('Falta injustificada'),'int','6 meses')+kpi('Atrasos',n('Atraso'),'int','6 meses')+kpi('Atestados',n('Atestado médico'),'int','6 meses')+kpi('Elogios e treinamentos',n('Elogio')+n('Treinamento'),'int','6 meses');
  animateKpis($('#ocKpis'));
  const por={};rec.forEach(o=>{(por[o.colaborador_id]=por[o.colaborador_id]||[]).push(o)});
  const al=Object.entries(por).map(([pid,os])=>{const adv=os.filter(o=>/Advertência/.test(o.tipo)).length,sus=os.filter(o=>o.tipo==='Suspensão').length,fal=os.filter(o=>o.tipo==='Falta injustificada').length;const p=cb[pid]||{nome:'—',cargo:'',loja_id:os[0].loja_id};
    if(sus>=1&&adv+fal>=1)return {s:'bad',p,t:`${sus} suspensão e ${adv+fal} outras ocorrências — avaliar desligamento com o jurídico/RH.`};
    if(adv>=2)return {s:'bad',p,t:`${adv} advertências — próximo passo previsto: suspensão.`};
    if(fal>=2)return {s:'warn',p,t:`${fal} faltas injustificadas — conversar e registrar advertência.`};
    if(adv===1)return {s:'warn',p,t:'1 advertência — acompanhar.'};return null}).filter(Boolean).sort((a,b)=>(a.s==='bad'?0:1)-(b.s==='bad'?0:1));
  $('#ocAlert').innerHTML=al.length?al.map(a=>`<div class="alert"><span class="dot" style="background:${a.s==='bad'?'var(--bad)':'var(--amber)'}"></span><div><b>${esc(a.p.nome)}</b> <span>${a.p.cargo?esc(a.p.cargo)+' · ':''}${esc(lojaNome(a.p.loja_id))}</span><br><span>${a.t}</span></div></div>`).join(''):'<div class="empty">Nenhum colaborador em atenção.</div>';
  const tiposUsados=OC_TIPOS.filter(t=>all.some(o=>o.tipo===t));
  $('#tOcRes').innerHTML=tiposUsados.length?`<tr><th>Loja</th>${tiposUsados.map(t=>`<th class="num">${t}</th>`).join('')}<th class="num">Total</th></tr>`+ids.map(id=>{const os=all.filter(o=>o.loja_id===id);return `<tr><td><b>${esc(lojaNome(id))}</b></td>${tiposUsados.map(t=>`<td class="num">${os.filter(o=>o.tipo===t).length||'<span class="muted">—</span>'}</td>`).join('')}<td class="num"><b>${os.length}</b></td></tr>`}).join(''):'<tr><td><div class="empty">Nenhuma ocorrência registrada ainda.</div></td></tr>';
  const fil=$('#ocFil').value||'todos';
  const lst=all.filter(o=>fil==='todos'||o.tipo===fil).sort((a,b)=>b.data.localeCompare(a.data));
  $('#tOc').innerHTML=lst.length?`<tr><th>Data</th><th>Colaborador</th><th>Loja</th><th>Tipo</th><th>Motivo</th><th>Responsável</th><th>Status</th><th></th></tr>`+lst.map(o=>{const p=cb[o.colaborador_id]||{};return `<tr><td>${fmtD(o.data)}</td><td><b>${esc(p.nome)}</b><div class="small muted">${esc(p.cargo)}</div></td><td>${esc(lojaNome(o.loja_id))}</td><td><span class="sem s-${OC_COR[o.tipo]||'neu'}" style="min-width:0">${esc(o.tipo)}</span></td><td style="white-space:normal;min-width:220px">${esc(o.motivo)}${o.obs?`<div class="small muted">${esc(o.obs)}</div>`:''}</td><td>${esc(o.responsavel)||'—'}</td><td><select class="inp" data-ost="${o.id}" style="width:auto">${OC_ST.map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></td><td class="num">${P.excluir(o.loja_id)?`<button class="btn sm" data-oc="${o.id}">Excluir</button>`:''}</td></tr>`}).join(''):'<tr><td><div class="empty">Nenhuma ocorrência para este filtro.</div></td></tr>';
  $('#tOc').querySelectorAll('[data-oc]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta ocorrência?'))return;if(await dbw(sb.from('ocorrencias').delete().eq('id',b.dataset.oc),'Ocorrência excluída.')){await load(['ocorrencias']);rhOco()}});
  $('#tOc').querySelectorAll('[data-ost]').forEach(s=>s.onchange=async()=>{if(await dbw(sb.from('ocorrencias').update({status:s.value}).eq('id',s.dataset.ost),'Status atualizado.')){await load(['ocorrencias']);rhOco()}});
}
function initOcoPes(){
  const ps=people().filter(p=>P.veOco(p.loja_id)).sort((a,b)=>a.loja_id.localeCompare(b.loja_id)||a.nome.localeCompare(b.nome));
  $('#ocPes').innerHTML=LOJAS.filter(l=>ps.some(p=>p.loja_id===l.id)).map(l=>`<optgroup label="${esc(l.nome)}">${ps.filter(p=>p.loja_id===l.id).map(p=>`<option value="${p.id}">${esc(p.nome)} — ${esc(p.cargo)}</option>`).join('')}</optgroup>`).join('')||'<option value="">Cadastre colaboradores no quadro de pessoal</option>';
}
function initOco(){
  initOcoPes();
  $('#ocTipo').innerHTML=OC_TIPOS.map(t=>`<option>${t}</option>`).join('');
  $('#ocFil').innerHTML='<option value="todos">Todos os tipos</option>'+OC_TIPOS.map(t=>`<option>${t}</option>`).join('');
  $('#ocFil').onchange=rhOco; $('#ocData').value=isoHoje();
  $('#ocSave').onclick=async()=>{const pid=+$('#ocPes').value;if(!pid){toast('Selecione o colaborador.');return}if(!$('#ocMot').value.trim()){toast('Descreva o motivo da ocorrência.');return}
    const p=S.db.colaboradores.find(x=>x.id===pid);
    if(await dbw(sb.from('ocorrencias').insert({colaborador_id:pid,loja_id:p.loja_id,tipo:$('#ocTipo').value,data:$('#ocData').value,status:$('#ocSt').value,motivo:$('#ocMot').value.trim(),responsavel:$('#ocResp').value||null,obs:$('#ocObs').value||null}),'Ocorrência registrada.')){$('#ocMot').value='';$('#ocObs').value='';await load(['ocorrencias']);rhOco()}};
  $('#ocCsv').onclick=()=>{const cb=Object.fromEntries((S.db.colaboradores||[]).map(p=>[p.id,p]));csv('ocorrencias-rh-fat-buddha.csv',[['Data','Colaborador','Cargo','Loja','Tipo','Motivo','Responsável','Status','Observação']].concat((S.db.ocorrencias||[]).map(o=>{const p=cb[o.colaborador_id]||{};return [o.data,p.nome,p.cargo,lojaNome(o.loja_id),o.tipo,o.motivo,o.responsavel,o.status,o.obs]})))};
}
