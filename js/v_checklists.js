/* ---------------- checklists (itens originais, sem alteração) ---------------- */
const CK_QUAL = [
  {s:'Produção, qualidade e segurança alimentar', i:['Fichas técnicas disponíveis e seguidas','Porcionamento conforme o padrão','Temperaturas de cocção e conservação registradas','Uniforme, touca e higiene das mãos da equipe','Separação de alimentos crus e prontos','Montagem e apresentação dos pratos no padrão']},
  {s:'Estoque, validade e abastecimento', i:['Itens abertos com etiqueta de validade','PVPS/PEPS aplicado no estoque','Câmaras e freezers na temperatura correta','Nenhum produto vencido ou sem identificação','Inventário dos itens críticos em dia','Abastecimento da cozinha central conforme o pedido']},
  {s:'Delivery, embalagem e expedição', i:['Conferência do pedido antes da saída','Embalagens lacradas e com selo','Pedido completo, com itens e adicionais corretos','Tempo de expedição dentro do padrão','Área de retirada organizada','Itens quentes e frios separados']},
  {s:'Limpeza, manutenção e estrutura', i:['Cozinha e salão limpos','Cronograma de limpeza preenchido','Equipamentos funcionando','Coifa, ralos e lixeiras em ordem','Controle de pragas em dia','Banheiros limpos e abastecidos']},
  {s:'Escalas, pessoas e liderança', i:['Escala cumprida nos horários de pico','Faltas cobertas sem desfalcar a operação','Líder de turno presente','Reunião pré-turno realizada','Treinamentos registrados']},
  {s:'Cumprimento dos padrões operacionais', i:['Cardápio atualizado nas plataformas','Atendimento do salão no padrão (Brooklyn)','Uniformes e identidade visual no padrão','Planos de ação da visita anterior concluídos','Checklists de abertura e fechamento preenchidos']},
];
const CK_DEL_METAS = [
  {k:'preparo', n:'Tempo médio de preparo', u:'min'},
  {k:'cancel', n:'Cancelamentos', u:'%'},
  {k:'ifood', n:'Nota iFood', u:''},
  {k:'online', n:'Tempo online', u:'%'},
  {k:'rupturas', n:'Rupturas na semana', u:''},
];
const delMeta = (m,loja) => {const r=metaRow(m.k,loja||null,ymOf($('#dData').value||isoHoje()));const d=METAS_DEF.find(x=>x.k===m.k);const meta=r&&r.valor!=null?+r.valor:null,t=r?r.direcao:null;return Object.assign({},m,{meta,t,txt:'meta: '+metaTxt(d,meta,t)})};
const CK_DEL_ACOMP = [
  {k:'pedidos', n:'Pedidos', u:''}, {k:'ticket', n:'Ticket médio', u:'R$'},
  {k:'conversao', n:'Conversão', u:'%'}, {k:'atrasos', n:'Atrasos', u:'%'},
  {k:'comissao', n:'Comissões e taxas', u:'%'}, {k:'frete', n:'Frete subsidiado', u:'R$'},
  {k:'promo', n:'Promoções e descontos', u:'R$'}, {k:'custoPed', n:'Custo de delivery por pedido', u:'R$'},
];
const CK_DEL_ROT = ['Cardápio sem itens indisponíveis ativos','Itens em falta pausados nas plataformas','Avaliações e reclamações respondidas','Campanhas e combos ativos revisados','Raio de entrega e taxa revisados','Conferência e embalagem auditadas no pico','Motivos de cancelamento analisados'];

/* ================= CHECKLIST QUALIDADE ================= */
let Q = {};
function qKey(si,ii){return si+'-'+ii}
function buildQual(){
  $('#qSecs').innerHTML = CK_QUAL.map((sec,si)=>`<div class="sec" data-s="${si}"><div class="sec-h"><b>${si+1}. ${sec.s}</b><span class="sc" id="qsc${si}"></span></div><div class="sec-b">${
    sec.i.map((it,ii)=>`<div class="item" id="qi${qKey(si,ii)}"><span>${it}</span><div class="seg" data-k="${qKey(si,ii)}"><button data-v="sim">Sim</button><button data-v="nao">Não</button><button data-v="na">N/A</button></div><input class="inp obs" placeholder="Evidência / observação" data-o="${qKey(si,ii)}"></div>`).join('')}</div></div>`).join('');
  $('#qSecs').querySelectorAll('.sec-h').forEach(h=>h.onclick=()=>h.parentElement.classList.toggle('closed'));
  $('#qSecs').querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{const k=b.parentElement.dataset.k;Q[k]=Q[k]||{};Q[k].v=Q[k].v===b.dataset.v?null:b.dataset.v;paintQual()});
  $('#qSecs').querySelectorAll('.obs').forEach(i=>{i.value=(Q[i.dataset.o]||{}).o||'';i.oninput=()=>{const k=i.dataset.o;Q[k]=Q[k]||{};Q[k].o=i.value}});
  $('#qOpenAll').onclick=()=>{const secs=$$('#qSecs .sec');const anyOpen=secs.some(s=>!s.classList.contains('closed'));secs.forEach(s=>s.classList.toggle('closed',anyOpen))};
  paintQual();
}
function qScores(){
  const per=CK_QUAL.map((sec,si)=>{let s=0,n=0,na=0;sec.i.forEach((_,ii)=>{const v=(Q[qKey(si,ii)]||{}).v;if(v==='sim')s++;if(v==='nao')n++;if(v==='na')na++});return {s,n,na,tot:sec.i.length}});
  const S_=sum(per,p=>p.s), N=sum(per,p=>p.n);
  return {per,S:S_,N,score:S_+N?S_/(S_+N)*100:null};
}
const scCol = p => {const m=metaQual(null);return p==null?'rgba(255,255,255,.2)':p>=m?C.green:p>=m-15?C.gold:C.red};
function ring(p,label){
  const r=48,c=2*Math.PI*r,off=c*(1-(p||0)/100);
  return `<svg width="110" height="110"><circle cx="55" cy="55" r="${r}" stroke="rgba(255,255,255,.08)" stroke-width="10" fill="none"/><circle cx="55" cy="55" r="${r}" stroke="${scCol(p)}" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .6s"/></svg><div class="t"><div><b>${p==null?'—':nf0.format(p)+'%'}</b><span>${label}</span></div></div>`;
}
const ST_MAP = {'Aberta':'Pendente','Em andamento':'Em andamento','Concluída':'Concluído'};
function paintQual(){
  $$('#qSecs .seg').forEach(sg=>{const v=(Q[sg.dataset.k]||{}).v;sg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));sg.parentElement.classList.toggle('no',v==='nao')});
  const sc=qScores();
  $('#qRing').innerHTML=ring(sc.score,'nota da visita');
  $('#qBars').innerHTML=sc.per.map((p,i)=>{const pct=p.s+p.n?p.s/(p.s+p.n)*100:null;return `<div class="r"><span>${CK_QUAL[i].s.split(',')[0]}</span><div class="tr"><i style="width:${pct||0}%;background:${scCol(pct)}"></i></div><span style="text-align:right">${pct==null?'—':nf0.format(pct)+'%'}</span></div>`}).join('');
  sc.per.forEach((p,i)=>$('#qsc'+i).innerHTML=`<span>${p.s+p.n+p.na}/${p.tot} avaliados</span>${p.n?`<span class="sem s-bad" style="min-width:0">${p.n} não</span>`:''}`);
  const nos=[];CK_QUAL.forEach((sec,si)=>sec.i.forEach((it,ii)=>{const k=qKey(si,ii);if((Q[k]||{}).v==='nao')nos.push({k,it,sec:sec.s})}));
  $('#qPlano').innerHTML = nos.length? `<div class="tbl-wrap"><table><tr><th>Desvio</th><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Prioridade</th><th>Status</th></tr>${nos.map(n=>{const a=(Q[n.k]||{}).a||{};return `<tr><td style="white-space:normal;min-width:200px"><b>${n.it}</b><div class="small muted">${n.sec}</div></td><td style="min-width:220px"><input class="inp" data-a="${n.k}" data-f="acao" value="${esc(a.acao)}" placeholder="O que será feito"></td><td style="min-width:150px"><input class="inp" data-a="${n.k}" data-f="resp" value="${esc(a.resp)}" placeholder="Quem"></td><td><input class="inp" type="date" data-a="${n.k}" data-f="prazo" value="${esc(a.prazo)}"></td><td><select class="inp" data-a="${n.k}" data-f="pri">${['Alta','Média','Baixa'].map(o=>`<option ${(a.pri||'Média')===o?'selected':''}>${o}</option>`).join('')}</select></td><td><select class="inp" data-a="${n.k}" data-f="st">${['Aberta','Em andamento','Concluída'].map(o=>`<option ${a.st===o?'selected':''}>${o}</option>`).join('')}</select></td></tr>`}).join('')}</table></div><p class="small muted" style="margin-top:8px">Ao salvar a visita, cada desvio vira uma ação no módulo Planos de ação, ligada a esta visita.</p>`
    : '<div class="empty">Nenhum desvio marcado. Os itens com "Não" aparecem aqui para virar plano de ação.</div>';
  $('#qPlano').querySelectorAll('[data-a]').forEach(el=>el.oninput=el.onchange=()=>{const k=el.dataset.a;Q[k]=Q[k]||{};Q[k].a=Q[k].a||{};Q[k].a[el.dataset.f]=el.value});
}
async function saveQual(){
  const sc=qScores(); if(sc.S+sc.N===0){toast('Avalie pelo menos um item antes de salvar.');return}
  const loja=$('#qLoja').value, data=$('#qData').value; if(!loja||!data){toast('Informe loja e data da visita.');return}
  const vis={loja_id:loja,data,avaliador:$('#qAval').value||null,gerente:$('#qGer').value||null,score:Math.round(sc.score*10)/10,sim:sc.S,nao:sc.N,secoes:sc.per.map(p=>p.s+p.n?p.s/(p.s+p.n)*100:null),respostas:JSON.parse(JSON.stringify(Q))};
  const r=await dbw(sb.from('visitas_qualidade').insert(vis).select('id').single()); if(!r)return;
  const acoes=[];CK_QUAL.forEach((sec,si)=>sec.i.forEach((it,ii)=>{const q=Q[qKey(si,ii)]||{};if(q.v==='nao'){const a=q.a||{};acoes.push({loja_id:loja,origem:'visita',origem_id:r.id,problema:it,secao:sec.s,acao:a.acao||null,responsavel:a.resp||null,prazo:a.prazo||null,prioridade:a.pri||'Média',status:ST_MAP[a.st]||'Pendente',obs:q.o||null})}}));
  if(acoes.length&&!await dbw(sb.from('planos_acao').insert(acoes))){toast('Visita salva, mas o plano de ação não foi gerado.')}
  else toast(`Visita salva${acoes.length?` e ${acoes.length} ação(ões) criada(s) em Planos de ação`:''}.`);
  Q={}; buildQual(); await load(['visitas_qualidade','planos_acao']); renderQualHist();
}
function renderQualHist(){
  const h=(S.db.visitas_qualidade||[]).slice().sort((a,b)=>b.data.localeCompare(a.data)||b.id-a.id);
  const pa=S.db.planos_acao||[], mq=metaQual(null);
  $('#qHist').innerHTML = h.length? `<div class="tbl-wrap" style="max-height:480px;overflow:auto"><table><tr><th>Data</th><th>Loja</th><th>Avaliador</th><th>Gerente</th><th class="num">Nota</th><th class="num">Desvios</th><th class="num">Ações abertas</th><th></th></tr>${h.map(v=>`<tr><td>${fmtD(v.data)}</td><td><b>${esc(lojaNome(v.loja_id))}</b></td><td>${esc(v.avaliador)||'—'}</td><td>${esc(v.gerente)||'—'}</td><td class="num"><span class="sem s-${v.score>=mq?'ok':v.score>=mq-15?'warn':'bad'}">${nf0.format(v.score)}%</span></td><td class="num">${v.nao}</td><td class="num">${pa.filter(a=>a.origem==='visita'&&a.origem_id===v.id&&!['Concluído','Cancelado'].includes(a.status)).length}</td><td class="num"><button class="btn sm" data-ld="${v.id}">Abrir</button> ${P.excluir(v.loja_id)?`<button class="btn sm" data-del="${v.id}">Excluir</button>`:''}</td></tr>`).join('')}</table></div>`
    : '<div class="empty">Nenhuma visita salva ainda.</div>';
  $('#qHist').querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta visita do histórico? As ações geradas por ela continuam em Planos de ação.'))return;if(await dbw(sb.from('visitas_qualidade').delete().eq('id',b.dataset.del),'Visita excluída.')){await load(['visitas_qualidade']);renderQualHist()}});
  $('#qHist').querySelectorAll('[data-ld]').forEach(b=>b.onclick=()=>{const v=h.find(x=>x.id==b.dataset.ld);Q=JSON.parse(JSON.stringify(v.respostas||{}));if([...$('#qLoja').options].some(o=>o.value===v.loja_id))$('#qLoja').value=v.loja_id;$('#qData').value=v.data;$('#qAval').value=v.avaliador||'';$('#qGer').value=v.gerente||'';buildQual();window.scrollTo({top:0,behavior:'smooth'});toast('Visita carregada. Ao salvar, ela entra como um novo registro.')});
}

/* ================= CHECKLIST DELIVERY ================= */
let D={m:{},a:{},r:{}};
function buildDel(){
  const loja=$('#dLoja').value;
  $('#dMetas').innerHTML = CK_DEL_METAS.map(m0=>{const m=delMeta(m0,loja);return `<div class="kin"><div class="h"><span>${m.n}</span><span class="sem s-neu" id="dst_${m.k}" style="min-width:0">—</span></div><input class="inp" type="number" step="0.1" data-dm="${m.k}" placeholder="${m.u?m.u:'valor'}" value="${D.m[m.k]??''}"><div class="m">${m.txt}</div></div>`}).join('');
  $('#dAcomp').innerHTML = CK_DEL_ACOMP.map(m=>`<div class="kin"><div class="h"><span>${m.n}</span><span class="small muted">${m.u}</span></div><input class="inp" type="number" step="0.01" data-da="${m.k}" placeholder="acompanhamento" value="${D.a[m.k]??''}"></div>`).join('');
  $('#dRot').innerHTML = CK_DEL_ROT.map((t,i)=>`<div class="item"><span>${t}</span><div class="seg" data-r="${i}"><button data-v="sim">Sim</button><button data-v="nao">Não</button><button data-v="na">N/A</button></div></div>`).join('');
  $$('[data-dm]').forEach(i=>i.oninput=()=>{D.m[i.dataset.dm]=i.value===''?null:+i.value;paintDel()});
  $$('[data-da]').forEach(i=>i.oninput=()=>{D.a[i.dataset.da]=i.value===''?null:+i.value});
  $$('#dRot .seg button').forEach(b=>b.onclick=()=>{const k=b.parentElement.dataset.r;D.r[k]=D.r[k]===b.dataset.v?null:b.dataset.v;paintDel()});
  paintDel();
}
function paintDel(){
  let ok=0,n=0; const loja=$('#dLoja').value;
  CK_DEL_METAS.forEach(m0=>{const m=delMeta(m0,loja);const v=D.m[m.k];const el=$('#dst_'+m.k);if(v==null){el.className='sem s-neu';el.textContent='—';return}n++;const s=status(m,v);if(s==='ok')ok++;el.className='sem s-'+s;el.textContent=s==='ok'?'Na meta':s==='warn'?'Atenção':s==='bad'?'Fora':'Sem meta'});
  $('#dScore').textContent = n?`${ok} de ${n} preenchidos na meta`:'preencha os valores para ver o status';
  $$('#dRot .seg').forEach(sg=>sg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',D.r[sg.dataset.r]===b.dataset.v)));
  const rs=Object.values(D.r).filter(v=>v==='sim').length, rn=Object.values(D.r).filter(v=>v==='nao').length;
  $('#dRotScore').textContent = rs+rn?`${rs} de ${rs+rn} itens ok`:'';
}
async function saveDel(){
  if(!Object.values(D.m).some(v=>v!=null)){toast('Preencha pelo menos um indicador antes de salvar.');return}
  const loja=$('#dLoja').value, data=$('#dData').value; if(!loja||!data){toast('Informe loja e data.');return}
  const r=await dbw(sb.from('delivery_checklists').insert({loja_id:loja,data,periodo:$('#dPer').value,responsavel:$('#dResp').value||null,metas:D.m,acomp:D.a,rotina:D.r,obs:$('#dObs').value||null}).select('id').single()); if(!r)return;
  let n=0;
  if($('#dPlano').checked&&P.editar(loja)){
    const acoes=[];
    CK_DEL_ROT.forEach((t,i)=>{if(D.r[i]==='nao')acoes.push({loja_id:loja,origem:'delivery',origem_id:r.id,problema:t,secao:'Rotina de delivery',prioridade:'Média',status:'Pendente'})});
    CK_DEL_METAS.forEach(m0=>{const m=delMeta(m0,loja),v=D.m[m.k];if(v!=null&&status(m,v)==='bad')acoes.push({loja_id:loja,origem:'delivery',origem_id:r.id,problema:`${m.n} fora da meta: ${nf1.format(v)}${m.u==='%'?'%':m.u==='min'?' min':''} (${m.txt})`,secao:'Indicadores de delivery',prioridade:'Alta',status:'Pendente'})});
    if(acoes.length&&await dbw(sb.from('planos_acao').insert(acoes)))n=acoes.length;
  }
  toast(`Checklist de delivery salvo${n?` e ${n} ação(ões) criada(s) em Planos de ação`:''}.`);
  clearDel(); await load(['delivery_checklists','planos_acao']); renderDelHist();
}
function clearDel(){D={m:{},a:{},r:{}};$('#dObs').value='';buildDel()}
function renderDelHist(){
  const h=(S.db.delivery_checklists||[]).slice().sort((a,b)=>b.data.localeCompare(a.data)||b.id-a.id);
  $('#dHist').innerHTML = h.length? `<div class="tbl-wrap" style="max-height:480px;overflow:auto"><table><tr><th>Data</th><th>Loja</th><th>Período</th><th>Responsável</th>${CK_DEL_METAS.map(m=>`<th class="num">${m.n}</th>`).join('')}<th class="num">Rotina</th><th></th></tr>${h.map(v=>{const rs=Object.values(v.rotina||{}).filter(x=>x==='sim').length,rn=Object.values(v.rotina||{}).filter(x=>x==='nao').length;return `<tr><td>${fmtD(v.data)}</td><td><b>${esc(lojaNome(v.loja_id))}</b></td><td>${esc(v.periodo)}</td><td>${esc(v.responsavel)||'—'}</td>${CK_DEL_METAS.map(m0=>{const m=Object.assign({},m0,(()=>{const r=metaRow(m0.k,v.loja_id,ymOf(v.data));return {meta:r&&r.valor!=null?+r.valor:null,t:r?r.direcao:null}})());const x=(v.metas||{})[m.k];return `<td class="num">${x==null?'—':`<span class="sem s-${status(m,x)}">${Number.isInteger(x)?nf0.format(x):nf1.format(x)}${m.u==='%'?'%':m.u==='min'?' min':''}</span>`}</td>`}).join('')}<td class="num">${rs+rn?rs+'/'+(rs+rn):'—'}</td><td class="num">${P.excluir(v.loja_id)?`<button class="btn sm" data-ddel="${v.id}">Excluir</button>`:''}</td></tr>`}).join('')}</table></div>`
    : '<div class="empty">Nenhum checklist salvo ainda.</div>';
  $('#dHist').querySelectorAll('[data-ddel]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este registro?'))return;if(await dbw(sb.from('delivery_checklists').delete().eq('id',b.dataset.ddel),'Registro excluído.')){await load(['delivery_checklists']);renderDelHist()}});
}
function initChecklists(){
  $('#qLoja').innerHTML=optLojas(lojasEditaveis()); $('#dLoja').innerHTML=optLojas(lojasOperaveis());
  $('#qData').value=isoHoje(); $('#dData').value=isoHoje();
  $('#qSave').onclick=saveQual; $('#qClear').onclick=()=>{Q={};buildQual()};
  $('#dSave').onclick=saveDel; $('#dClear').onclick=clearDel; $('#dLoja').onchange=buildDel; $('#dData').onchange=buildDel;
  $('#qCsv').onclick=()=>{const pa=S.db.planos_acao||[];const rows=[['Data','Loja','Avaliador','Gerente','Nota %','Desvio','Seção','Observação','Ação','Responsável','Prazo','Status']];(S.db.visitas_qualidade||[]).forEach(v=>{const ac=pa.filter(a=>a.origem==='visita'&&a.origem_id===v.id);if(!ac.length)rows.push([v.data,lojaNome(v.loja_id),v.avaliador,v.gerente,Math.round(v.score),'','','','','','','']);ac.forEach(a=>rows.push([v.data,lojaNome(v.loja_id),v.avaliador,v.gerente,Math.round(v.score),a.problema,a.secao,a.obs,a.acao,a.responsavel,a.prazo,a.status]))});csv('visitas-qualidade-fat-buddha.csv',rows)};
  $('#dCsv').onclick=()=>{const rows=[['Data','Loja','Período','Responsável',...CK_DEL_METAS.map(m=>m.n),...CK_DEL_ACOMP.map(m=>m.n),...CK_DEL_ROT,'Observações']];(S.db.delivery_checklists||[]).forEach(v=>rows.push([v.data,lojaNome(v.loja_id),v.periodo,v.responsavel,...CK_DEL_METAS.map(m=>(v.metas||{})[m.k]??''),...CK_DEL_ACOMP.map(m=>(v.acomp||{})[m.k]??''),...CK_DEL_ROT.map((_,i)=>({sim:'Sim',nao:'Não',na:'N/A'})[(v.rotina||{})[i]]||''),v.obs]));csv('checklist-delivery-fat-buddha.csv',rows)};
  buildQual(); renderQualHist(); buildDel(); renderDelHist();
}
