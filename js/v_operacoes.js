/* ================= Cozinha central ================= */
const RUP_MOT=['Falta na cozinha central','Atraso na entrega','Erro no pedido da loja','Problema de qualidade','Demanda acima do previsto'];
let ccSub='rup';
function renderCC(){
  $$('#ccNav button').forEach(b=>b.classList.toggle('on',b.dataset.s===ccSub));
  $$('#tab-cc .ccs').forEach(s=>s.classList.toggle('on',s.id==='cc-'+ccSub));
  ccSub==='rup'?ccRup():ccEst();
}
function ccRup(){
  const rs=S.db.rupturas||[], sems=uniq(rs.map(r=>semanaDe(r.data))).sort().slice(-6);
  const lojas=LOJAS.map(l=>l.id).filter(id=>rs.some(r=>r.loja_id===id));
  const cnt=(id,s)=>rs.filter(r=>r.loja_id===id&&semanaDe(r.data)===s).length;
  const lastS=sems.at(-1), lastRs=rs.filter(r=>semanaDe(r.data)===lastS);
  const ccRs=rs.filter(r=>sems.includes(semanaDe(r.data)));
  const horas=sum(ccRs,r=>r.horas);
  const mr=METAS(null).find(m=>m.k==='rupturas'), metaR=mr&&mr.meta!=null?mr.meta:5;
  const pctCC=ccRs.length?ccRs.filter(r=>r.motivo==='Falta na cozinha central'||r.motivo==='Atraso na entrega').length/ccRs.length*100:null;
  $('#rupKpis').innerHTML=kpi('Rupturas na última semana',rs.length?lastRs.length:null,'int',lastS?`semana de ${semTxt(lastS)}`:'nenhuma registrada')+kpi('Lojas acima da meta',rs.length?lojas.filter(id=>cnt(id,lastS)>metaR).length:null,'int',`mais de ${metaR} na semana`)+
    kpi('Horas de item indisponível',rs.length?horas:null,'int',`últimas ${sems.length} semanas`)+kpi('Causadas pela cozinha central',pctCC,'pct1','falta ou atraso de entrega',pctCC);
  animateKpis($('#rupKpis'));
  if(sems.length) mk('cRup',{type:'bar',data:{labels:sems.map(s=>'Sem. '+semTxt(s)),datasets:lojas.map((id,i)=>({label:lojaNome(id),data:sems.map(s=>cnt(id,s)),backgroundColor:PAL[i%6],borderRadius:6,maxBarThickness:34}))
    .concat([{type:'line',label:'Meta por loja',data:sems.map(()=>metaR),borderColor:'#ffffff',borderDash:[6,5],pointRadius:0,borderWidth:1.5}])},options:{scales:{y:{grid:{color:C.grid},border:{display:false},ticks:{precision:0}},x:xG}}});
  else noData('cRup','Nenhuma ruptura registrada.');
  $('#tRup').innerHTML=sems.length?`<tr><th>Loja</th>${sems.map(s=>`<th class="num">Sem. ${semTxt(s)}</th>`).join('')}<th class="num">Média</th></tr>`+lojas.map(id=>{const v=sems.map(s=>cnt(id,s));return `<tr><td><b>${esc(lojaNome(id))}</b></td>${v.map(x=>`<td class="num"><span class="sem s-${status({meta:metaR,t:'max'},x)}" style="min-width:44px">${x}</span></td>`).join('')}<td class="num"><b>${nf1.format(sum(v)/v.length)}</b></td></tr>`}).join(''):'';
  const byItem={};ccRs.forEach(r=>byItem[r.item]=(byItem[r.item]||0)+1);const top=Object.entries(byItem).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(top.length) mk('cRupItem',{type:'bar',data:{labels:top.map(t=>t[0]),datasets:[{label:'Rupturas',data:top.map(t=>t[1]),backgroundColor:'rgba(229,48,63,.85)',borderRadius:6}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{grid:{color:C.grid},border:{display:false},ticks:{precision:0}},y:{grid:{display:false},border:{display:false}}}}});
  else noData('cRupItem','Sem rupturas nas últimas semanas.');
  const mots=uniq(RUP_MOT.concat(ccRs.map(r=>r.motivo))), byMot=mots.map(m=>ccRs.filter(r=>r.motivo===m).length);
  if(ccRs.length) mk('cRupMot',{type:'doughnut',data:{labels:mots,datasets:[{data:byMot,backgroundColor:PAL,borderWidth:0}]},options:{cutout:'62%',plugins:{legend:{position:'right'}}}});
  else noData('cRupMot','Sem rupturas nas últimas semanas.');
  $('#tRupReg').innerHTML=rs.length?`<tr><th>Data</th><th>Loja</th><th>Item</th><th>Motivo</th><th class="num">Horas</th><th>Ação</th><th></th></tr>`+rs.slice().sort((a,b)=>b.data.localeCompare(a.data)||b.id-a.id).map(r=>`<tr><td>${fmtD(r.data)}</td><td><b>${esc(lojaNome(r.loja_id))}</b></td><td>${esc(r.item)}</td><td>${esc(r.motivo)}</td><td class="num">${+r.horas||'—'}</td><td style="white-space:normal">${esc(r.acao)||'<span class="muted">—</span>'}</td><td class="num">${P.editar(r.loja_id)?`<button class="btn sm" data-rac="${r.id}">Ação</button>`:''} ${P.excluir(r.loja_id)?`<button class="btn sm" data-ru="${r.id}">Excluir</button>`:''}</td></tr>`).join('')
    :'<tr><td><div class="empty">Nenhuma ruptura registrada.</div></td></tr>';
  $('#tRupReg').querySelectorAll('[data-ru]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta ruptura?'))return;if(await dbw(sb.from('rupturas').delete().eq('id',b.dataset.ru),'Ruptura excluída.')){await load(['rupturas']);ccRup()}});
  $('#tRupReg').querySelectorAll('[data-rac]').forEach(b=>b.onclick=async()=>{const r=rs.find(x=>x.id==b.dataset.rac);const a=await pedir('Ação corretiva',`${r.item} · ${lojaNome(r.loja_id)} · ${fmtD(r.data)}`,{valor:r.acao||'',placeholder:'O que foi feito para resolver'});if(a==null)return;if(await dbw(sb.from('rupturas').update({acao:a}).eq('id',r.id),'Ação registrada.')){await load(['rupturas']);ccRup()}});
}
function estStatus(i){const cob=+i.consumo_dia?i.atual/i.consumo_dia:Infinity;return +i.atual<+i.minimo?['Crítico','bad']:+i.atual<i.minimo*1.5||cob<3?['Atenção','warn']:['OK','ok']}
const repor = i => Math.max(0,Math.ceil(+i.minimo+ +i.consumo_dia*7- +i.atual));
function ccEst(){
  const es=S.db.estoque_cc||[];
  const crit=es.filter(i=>estStatus(i)[1]==='bad').length, at=es.filter(i=>estStatus(i)[1]==='warn').length;
  const val=sum(es,i=>i.atual*i.custo);
  const cobs=es.filter(i=>+i.consumo_dia>0).map(i=>i.atual/i.consumo_dia);
  $('#estKpis').innerHTML=kpi('Valor em estoque',es.length?val:null,'brl',`${es.length} itens`)+kpi('Itens críticos',es.length?crit:null,'int','abaixo do mínimo')+kpi('Itens em atenção',es.length?at:null,'int','perto do mínimo ou menos de 3 dias')+kpi('Cobertura média',cobs.length?sum(cobs)/cobs.length:null,'int','dias de consumo');
  animateKpis($('#estKpis'));
  const ord=es.map(i=>({i,st:estStatus(i)})).sort((a,b)=>({bad:0,warn:1,ok:2})[a.st[1]]-({bad:0,warn:1,ok:2})[b.st[1]]||a.i.item.localeCompare(b.i.item));
  const ed=P.editaCC;
  const inp=(id,f,v,st)=>ed?`<input class="inp ein" style="width:96px;padding:6px 8px;text-align:right" type="number" step="${st}" data-id="${id}" data-f="${f}" value="${v}">`:nf1.format(v).replace(',0','');
  $('#tEst').innerHTML=es.length?`<tr><th>Item</th><th>Un.</th><th class="num">Estoque atual</th><th class="num">Mínimo</th><th class="num">Consumo/dia</th><th class="num">Cobertura</th><th>Status</th><th class="num">Repor</th><th class="num">Custo unit.</th><th class="num">Valor</th><th></th></tr>`+
    ord.map(({i,st})=>{const cob=+i.consumo_dia?i.atual/i.consumo_dia:null;const rep=repor(i);
      return `<tr><td><b>${esc(i.item)}</b></td><td>${esc(i.un)}</td><td class="num">${inp(i.id,'atual',i.atual,1)}</td><td class="num">${inp(i.id,'minimo',i.minimo,1)}</td><td class="num">${inp(i.id,'consumo_dia',i.consumo_dia,.1)}</td><td class="num">${cob==null?'—':nf1.format(cob)+' dias'}</td><td><span class="sem s-${st[1]}" style="min-width:0">${st[0]}</span></td><td class="num">${rep?'<b>'+nf0.format(rep)+' '+esc(i.un)+'</b>':'<span class="muted">—</span>'}</td><td class="num">${ed?`<input class="inp ein" style="width:90px;padding:6px 8px;text-align:right" type="number" step="0.01" data-id="${i.id}" data-f="custo" value="${i.custo}">`:'R$ '+nf2.format(i.custo)}</td><td class="num">${brl(i.atual*i.custo)}</td><td class="num">${P.gestor?`<button class="btn sm" data-ed="${i.id}">Excluir</button>`:''}</td></tr>`}).join('')
    :'<tr><td><div class="empty">Nenhum item cadastrado no estoque da cozinha central.</div></td></tr>';
  $('#tEst').querySelectorAll('.ein').forEach(el=>el.onchange=async()=>{const v=+el.value;if(isNaN(v)||v<0){toast('Valor inválido.');return}if(await dbw(sb.from('estoque_cc').update({[el.dataset.f]:v}).eq('id',el.dataset.id),'Estoque atualizado.')){await load(['estoque_cc']);ccEst()}});
  $('#tEst').querySelectorAll('[data-ed]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este item do estoque?'))return;if(await dbw(sb.from('estoque_cc').delete().eq('id',b.dataset.ed),'Item excluído.')){await load(['estoque_cc']);ccEst()}});
}
function initCC(){
  $$('#ccNav button').forEach(b=>b.onclick=()=>{ccSub=b.dataset.s;renderCC()});
  $('#ruLoja').innerHTML=optLojas(lojasOperaveis());
  $('#ruMot').innerHTML=RUP_MOT.map(m=>`<option>${m}</option>`).join('');
  $('#ruItens').innerHTML=(S.db.estoque_cc||[]).map(i=>`<option value="${esc(i.item)}">`).join('');
  $('#ruData').value=isoHoje();
  $('#ruSave').onclick=async()=>{if(!$('#ruItem').value.trim()){toast('Informe o item em falta.');return}
    const r={data:$('#ruData').value,loja_id:$('#ruLoja').value,item:$('#ruItem').value.trim(),motivo:$('#ruMot').value,horas:+$('#ruHor').value||0,acao:$('#ruAc').value||null};
    if(!r.data||!r.loja_id){toast('Informe data e loja.');return}
    if(await dbw(sb.from('rupturas').insert(r),'Ruptura registrada.')){$('#ruItem').value='';$('#ruAc').value='';await load(['rupturas']);ccRup()}};
  $('#ruCsv').onclick=()=>csv('rupturas-fat-buddha.csv',[['Data','Loja','Item','Motivo','Horas','Ação']].concat((S.db.rupturas||[]).map(r=>[r.data,lojaNome(r.loja_id),r.item,r.motivo,r.horas,r.acao])));
  $('#esAdd').onclick=async()=>{const n=$('#esNome').value.trim();if(!n){toast('Informe o nome do item.');return}
    const r={item:n,un:$('#esUn').value||'un',atual:+$('#esAt').value||0,minimo:+$('#esMin').value||0,consumo_dia:+$('#esCons').value||0,custo:+$('#esCu').value||0};
    if(await dbw(sb.from('estoque_cc').insert(r),'Item adicionado.')){['#esNome','#esUn','#esAt','#esMin','#esCons','#esCu'].forEach(s=>$(s).value='');await load(['estoque_cc']);$('#ruItens').innerHTML=(S.db.estoque_cc||[]).map(i=>`<option value="${esc(i.item)}">`).join('');ccEst()}};
}
