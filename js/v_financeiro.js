/* ================= CMV por loja ================= */
let CM_TOL=1;
function renderCMV(){
  CM_TOL=+(cfg('cmv_tol')??1)||1; try{const l=localStorage.getItem('fb_cmv_tol');if(l&&!P.gestor)CM_TOL=+l}catch(e){}
  const regAll=S.db.cmv_contagens||[], reg=regAll.filter(r=>r.semana<=fimMes(S.mes)), sems=uniq(reg.map(r=>r.semana)).sort().slice(-12), last=sems.at(-1);
  const lojas=LOJAS.map(l=>l.id).filter(id=>reg.some(r=>r.loja_id===id));
  const lw=reg.filter(r=>r.semana===last);
  const mc=METAS(null).find(m=>m.k==='cmv'), metaCmv=mc&&mc.meta!=null?mc.meta:21;
  const V=sum(lw,r=>r.vendas), Rr=sum(lw,cmvRealR), Tt=sum(lw,r=>r.vendas*r.cmv_teorico/100);
  const acima=lw.filter(r=>cmvReal(r)>metaCmv).length, fora=lw.filter(r=>cmvReal(r)-r.cmv_teorico>CM_TOL).length;
  renderCmvGrupo(reg,sems,lojas,metaCmv);
  $('#cmTol').value=CM_TOL;
  if(sems.length) mk('cCmv',{type:'line',data:{labels:sems.map(semTxt),datasets:lojas.map((id,i)=>({label:lojaNome(id),data:sems.map(s=>{const r=reg.find(x=>x.loja_id===id&&x.semana===s);return r?cmvReal(r):null}),borderColor:PAL[i%6],backgroundColor:PAL[i%6],tension:.3,pointRadius:3,borderWidth:2,spanGaps:true}))
    .concat([{label:`Meta ${nf1.format(metaCmv).replace(',0','')}%`,data:sems.map(()=>metaCmv),borderColor:'#ffffff',borderDash:[6,5],pointRadius:0,borderWidth:1.5},
             {label:'Teórico (rede)',data:sems.map(s=>{const w=reg.filter(r=>r.semana===s);const v=sum(w,r=>r.vendas);return v?sum(w,r=>r.vendas*r.cmv_teorico/100)/v*100:null}),borderColor:C.beige,borderDash:[2,4],pointRadius:0,borderWidth:1.5}])},options:{plugins:{tooltip:tipPct},scales:{y:yPct,x:xG}}});
  else noData('cCmv','Nenhuma contagem semanal lançada.');
  const dv=lw.map(r=>({id:r.loja_id,v:cmvReal(r)-r.cmv_teorico}));
  if(dv.length) mk('cDisp',{type:'bar',data:{labels:dv.map(d=>lojaNome(d.id)),datasets:[{label:'Dispersão',data:dv.map(d=>d.v),backgroundColor:dv.map(d=>d.v<=CM_TOL?'rgba(63,197,142,.85)':d.v<=CM_TOL*2?'rgba(242,179,61,.85)':'rgba(229,48,63,.85)'),borderRadius:10,maxBarThickness:70},
    {type:'line',label:'Tolerância',data:dv.map(()=>CM_TOL),borderColor:C.gold,borderDash:[6,5],pointRadius:0,borderWidth:2}]},
    options:{plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+nf1.format(c.parsed.y)+' p.p.'}}},scales:{y:{grid:{color:C.grid},border:{display:false},ticks:{callback:v=>nf1.format(v)+' p.p.'}},x:xG}}});
  else noData('cDisp','Sem contagem na última semana.');
  $('#tCmv').innerHTML=sems.length?`<tr><th>Semana</th>${lojas.map(id=>`<th class="num" colspan="3" style="text-align:center">${esc(lojaNome(id))}</th>`).join('')}</tr><tr><th></th>${lojas.map(()=>`<th class="num">Real</th><th class="num">Teórico</th><th class="num">Disp.</th>`).join('')}</tr>`+
    sems.slice().reverse().map(s=>`<tr><td><b>${semTxt(s)}</b></td>${lojas.map(id=>{const r=reg.find(x=>x.loja_id===id&&x.semana===s);if(!r)return '<td class="num muted">—</td><td></td><td></td>';const re=cmvReal(r),d=re-r.cmv_teorico;
      return `<td class="num"><span class="sem s-${status({meta:metaCmv,t:'max'},re)}" style="min-width:54px">${nf1.format(re)}%</span></td><td class="num muted">${nf1.format(r.cmv_teorico)}%</td><td class="num"><span class="sem s-${d<=CM_TOL?'ok':d<=CM_TOL*2?'warn':'bad'}" style="min-width:0">${d>0?'+':''}${nf1.format(d)}</span></td>`}).join('')}</tr>`).join(''):'<tr><td><div class="empty">Nenhuma contagem lançada ainda.</div></td></tr>';
  const its=(S.db.cmv_itens||[]), ultSem=uniq(its.map(i=>i.semana)).sort().at(-1), li=its.filter(i=>i.semana===ultSem);
  $('#cmItSub').textContent=ultSem?`semana de ${semTxt(ultSem)}`:'nenhum item lançado';
  $('#tCmvItem').innerHTML=li.length?`<tr><th>Loja</th><th>Item</th><th class="num">Consumo teórico</th><th class="num">Consumo real</th><th class="num">Diferença</th><th>Justificativa</th><th></th></tr>`+
    li.sort((a,b)=>(b.real-b.teorico)/b.teorico-(a.real-a.teorico)/a.teorico).map(i=>{const d=(i.real-i.teorico)/i.teorico*100;return `<tr><td>${esc(lojaNome(i.loja_id))}</td><td><b>${esc(i.item)}</b></td><td class="num">${nf1.format(i.teorico)}</td><td class="num">${nf1.format(i.real)}</td><td class="num"><span class="sem s-${d<=2?'ok':d<=5?'warn':'bad'}" style="min-width:0">${d>0?'+':''}${nf1.format(d)}%</span>${Math.abs(i.real-i.teorico)>limGlobal()?`<div class="small" style="color:#ff9aa2">${i.real-i.teorico>0?'+':''}${nf1.format(i.real-i.teorico).replace(',0','')} un. · acima do limite</div>`:''}</td><td style="white-space:normal;min-width:180px" class="small">${esc(i.justificativa||'')}${Math.abs(i.real-i.teorico)>limGlobal()?(i.revisado_em?' <span class="sem s-ok" style="min-width:0">revisada</span>':P.gestor?` <button class="btn sm" data-civ="${i.id}">Revisar</button>`:' <span class="sem s-warn" style="min-width:0">aguardando revisão</span>'):''}</td><td class="num">${P.excluir(i.loja_id)?`<button class="btn sm" data-cid="${i.id}">Excluir</button>`:''}</td></tr>`}).join('')
    :'<tr><td><div class="empty">Lance o consumo teórico e real dos itens críticos para ver a dispersão por item.</div></td></tr>';
  $('#tCmvItem').querySelectorAll('[data-civ]').forEach(b=>b.onclick=async()=>{busy(true);const {error}=await sb.rpc('revisar_divergencia',{p_tipo:'cmv',p_id:+b.dataset.civ});busy(false);if(error){toast(error.message);return}toast('Divergência revisada.');await load(['cmv_itens','alertas']);pintarSino();renderCMV()});
  $('#tCmvItem').querySelectorAll('[data-cid]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este item?'))return;if(await dbw(sb.from('cmv_itens').delete().eq('id',b.dataset.cid),'Item excluído.')){await load(['cmv_itens']);renderCMV()}});
  $('#tCmvReg').innerHTML=regAll.length?`<tr><th>Semana</th><th>Loja</th><th class="num">Vendas</th><th class="num">EI</th><th class="num">Compras</th><th class="num">Transf. +/−</th><th class="num">Devol.</th><th class="num">EF</th><th class="num">CMV real</th><th>Responsável</th><th></th></tr>`+
    regAll.slice().sort((a,b)=>b.semana.localeCompare(a.semana)||a.loja_id.localeCompare(b.loja_id)).map(r=>`<tr><td>${semTxt(r.semana)}</td><td><b>${esc(lojaNome(r.loja_id))}</b></td><td class="num">${brl(r.vendas)}</td><td class="num">${brl(r.estoque_inicial)}</td><td class="num">${brl(r.compras)}</td><td class="num">${brl(r.transf_entrada)} / ${brl(r.transf_saida)}</td><td class="num">${brl(r.devolucoes)}</td><td class="num">${brl(r.estoque_final)}</td><td class="num">${nf1.format(cmvReal(r))}%</td><td>${esc(r.responsavel)||'—'}${r.obs?`<div class="small muted">${esc(r.obs)}</div>`:''}</td><td class="num">${P.editar(r.loja_id)?`<button class="btn sm" data-ce="${r.id}">Editar</button>`:''} ${P.excluir(r.loja_id)?`<button class="btn sm" data-cm="${r.id}">Excluir</button>`:''}</td></tr>`).join('')
    :'<tr><td><div class="empty">Nenhuma contagem lançada.</div></td></tr>';
  $('#tCmvReg').querySelectorAll('[data-cm]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta contagem?'))return;if(await dbw(sb.from('cmv_contagens').delete().eq('id',b.dataset.cm),'Contagem excluída.')){await load(['cmv_contagens']);renderCMV()}});
  $('#tCmvReg').querySelectorAll('[data-ce]').forEach(b=>b.onclick=()=>{const r=regAll.find(x=>x.id==b.dataset.ce);
    [['#cmLoja','loja_id'],['#cmSem','semana'],['#cmVen','vendas'],['#cmTeo','cmv_teorico'],['#cmEi','estoque_inicial'],['#cmCo','compras'],['#cmTe','transf_entrada'],['#cmTs','transf_saida'],['#cmDev','devolucoes'],['#cmEf','estoque_final'],['#cmResp','responsavel'],['#cmObs','obs']].forEach(([s,k])=>$(s).value=r[k]??'');
    $('#cmSave').scrollIntoView({behavior:'smooth',block:'center'});toast('Contagem carregada. Ao salvar, ela é atualizada.')});
}
function initCMV(){
  $('#cmLoja').innerHTML=optLojas(lojasEditaveis()); $('#ciLoja').innerHTML=optLojas(lojasEditaveis());
  const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));$('#cmSem').value=isoD(d);$('#ciSem').value=isoD(d);
  const vals=()=>({loja_id:$('#cmLoja').value,semana:$('#cmSem').value?semanaDe($('#cmSem').value):'',vendas:+$('#cmVen').value,estoque_inicial:+$('#cmEi').value||0,compras:+$('#cmCo').value||0,transf_entrada:+$('#cmTe').value||0,transf_saida:+$('#cmTs').value||0,devolucoes:+$('#cmDev').value||0,estoque_final:+$('#cmEf').value||0,cmv_teorico:+$('#cmTeo').value,responsavel:$('#cmResp').value||null,obs:$('#cmObs').value||null});
  const prev=()=>{const r=vals();if(r.vendas&&(r.estoque_inicial||r.compras||r.transf_entrada)){const re=cmvReal(r);$('#cmPrev').innerHTML=`CMV real <b>${nf1.format(re)}%</b> (${brl(cmvRealR(r))})${r.cmv_teorico?` · dispersão <b>${re-r.cmv_teorico>0?'+':''}${nf1.format(re-r.cmv_teorico)} p.p.</b>`:''}`}else $('#cmPrev').textContent='preencha os campos'};
  ['#cmVen','#cmEi','#cmCo','#cmTe','#cmTs','#cmDev','#cmEf','#cmTeo'].forEach(s=>$(s).oninput=prev);
  const sugNf=()=>{const c=comprasNfSemana($('#cmLoja').value,$('#cmSem').value?semanaDe($('#cmSem').value):'');let el=$('#cmNfSug');
    if(!el){el=document.createElement('div');el.id='cmNfSug';el.className='small';el.style.marginTop='4px';$('#cmCo').closest('label').appendChild(el)}
    el.innerHTML=c?`<a href="#" style="color:var(--gold)">Notas de insumos: ${brl(c.v)} (${c.n}) · usar</a>`:'';
    const a=el.querySelector('a');if(a)a.onclick=e=>{e.preventDefault();$('#cmCo').value=Math.round(c.v*100)/100;prev()}};
  $('#cmLoja').addEventListener('change',sugNf);$('#cmSem').addEventListener('change',sugNf);sugNf();
  const sugPer=async()=>{const c=await perdasSemana($('#cmLoja').value,$('#cmSem').value?semanaDe($('#cmSem').value):'');let el=$('#cmPerSug');
    if(!el){el=document.createElement('div');el.id='cmPerSug';el.className='small';el.style.marginTop='4px';$('#cmObs').closest('label').appendChild(el)}
    el.innerHTML=c?`<span style="color:var(--amber)">Perdas registradas na semana: ${c.n} (${brl(c.v)}${c.semValor?`, ${c.semValor} sem valor`:''}) · ver em Perdas e desperdício</span>`:''};
  $('#cmLoja').addEventListener('change',sugPer);$('#cmSem').addEventListener('change',sugPer);sugPer();
  $('#cmTol').onchange=async()=>{const v=+$('#cmTol').value||1;
    if(P.gestor){if(await dbw(sb.from('config').upsert({chave:'cmv_tol',valor:v}),'Tolerância salva para todos.')){await load(['config']);renderCMV()}}
    else{try{localStorage.setItem('fb_cmv_tol',v)}catch(e){}CM_TOL=v;renderCMV()}};
  $('#cmSave').onclick=async()=>{const r=vals();if(!r.semana||!r.vendas||!$('#cmTeo').value){toast('Preencha semana, vendas e CMV teórico.');return}
    if(r.vendas<=0){toast('Vendas precisam ser maiores que zero.');return}
    const re=cmvReal(r); if(re<0||re>100){if(!confirm(`O CMV real calculado é ${nf1.format(re)}%. Confere os valores? Salvar mesmo assim?`))return}
    if(await dbw(sb.from('cmv_contagens').upsert(r,{onConflict:'loja_id,semana'}),'Contagem salva.')){
      const re2=cmvReal(r),dp=re2-r.cmv_teorico;
      filaDrive({tipo:'cmv_semanal',loja_id:r.loja_id,ref:`cmv|${r.loja_id}|${r.semana}`,mes:ymOf(r.semana),aba:'CMV semanal',
        titulo:`Contagem do CMV · ${lojaNome(r.loja_id)} · semana de ${fmtD(r.semana)}`,
        colunas:['Semana','Loja','Vendas','Estoque inicial','Compras','Transf. recebidas','Transf. enviadas','Devoluções','Estoque final','CMV R$','CMV real %','CMV teórico %','Dispersão p.p.','Responsável','Observações'],
        linhas:[[r.semana,lojaNome(r.loja_id),r.vendas,r.estoque_inicial,r.compras,r.transf_entrada,r.transf_saida,r.devolucoes,r.estoque_final,Math.round(cmvRealR(r)*100)/100,Math.round(re2*10)/10,r.cmv_teorico,Math.round(dp*10)/10,r.responsavel||'',r.obs||'']],
        resumo:{'CMV real':nf1.format(re2)+'%','CMV teórico':nf1.format(r.cmv_teorico)+'%','Dispersão':(dp>0?'+':'')+nf1.format(dp)+' p.p.'},
        destaques:dp>0?[`CMV real ${nf1.format(dp)} p.p. acima do teórico`]:[]});['#cmVen','#cmEi','#cmCo','#cmEf','#cmObs'].forEach(s=>$(s).value='');['#cmTe','#cmTs','#cmDev'].forEach(s=>$(s).value=0);prev();await load(['cmv_contagens']);renderCMV()}};
  $('#ciSave').onclick=async()=>{const r={loja_id:$('#ciLoja').value,semana:semanaDe($('#ciSem').value),item:$('#ciItem').value.trim(),teorico:+$('#ciTeo').value,real:+$('#ciReal').value};
    if(!r.item||!r.teorico||!$('#ciReal').value){toast('Informe item, consumo teórico e real.');return}
    const lim=limGlobal();
    if(Math.abs(r.real-r.teorico)>lim){const j=await exigirJustificativas([{item:r.item,un:'un.',esperado:r.teorico,contado:r.real,limite:lim,justificativa:''}]);if(!j)return;r.justificativa=j[0].justificativa}
    else r.justificativa=null;
    if(await dbw(sb.from('cmv_itens').upsert(r,{onConflict:'loja_id,semana,item'}),'Item salvo.')){
      filaDrive({tipo:'cmv_item',loja_id:r.loja_id,ref:`cmvit|${r.loja_id}|${r.semana}|${r.item}`,mes:ymOf(r.semana),aba:'CMV por item',
        titulo:`Consumo do item ${r.item} · ${lojaNome(r.loja_id)} · semana de ${fmtD(r.semana)}`,
        colunas:['Semana','Loja','Item','Consumo teórico','Consumo real','Diferença','Justificativa'],
        linhas:[[r.semana,lojaNome(r.loja_id),r.item,r.teorico,r.real,Math.round((r.real-r.teorico)*1000)/1000,r.justificativa||'']],
        resumo:{'Teórico':r.teorico,'Real':r.real,'Diferença':Math.round((r.real-r.teorico)*1000)/1000},destaques:r.justificativa?[`Motivo: ${r.justificativa}`]:[]});['#ciItem','#ciTeo','#ciReal'].forEach(s=>$(s).value='');await load(['cmv_itens']);renderCMV()}};
  $('#cmCsv').onclick=()=>csv('cmv-semanal-fat-buddha.csv',[['Semana','Loja','Vendas','Estoque inicial','Compras','Transferências recebidas','Transferências enviadas','Devoluções','Estoque final','CMV R$','CMV real %','CMV teórico %','Dispersão p.p.','Responsável','Observações']].concat((S.db.cmv_contagens||[]).map(r=>[r.semana,lojaNome(r.loja_id),r.vendas,r.estoque_inicial,r.compras,r.transf_entrada,r.transf_saida,r.devolucoes,r.estoque_final,cmvRealR(r).toFixed(2),cmvReal(r).toFixed(1),r.cmv_teorico,(cmvReal(r)-r.cmv_teorico).toFixed(1),r.responsavel,r.obs])));
}

/* ================= DRE ================= */
function dreTable(cols){ // cols: [{nome, d}]
  const pc=(v,f)=>f?nf1.format(v/f*100)+'%':'—';
  const head=`<tr><th>Linha</th>${cols.map(c=>`<th class="num">${esc(c.nome)}</th><th class="num pc">%</th>`).join('')}</tr>`;
  const body=DRE_LINES.map(([k,n,t])=>`<tr class="l-${t}"><td>${n}</td>${cols.map(c=>{const v=c.d[k];const neg=t==='neg';const e=c.d.est&&c.d.est[k]?'<span class="est">est.</span>':'';if(v==null)return `<td class="num"><span class="muted" title="O fechamento oficial não traz essa divisão">—</span></td><td class="num pc">—</td>`;return `<td class="num ${t==='res'?(v>=0?'up':'down'):''}">${neg?'- ':''}${brl(Math.abs(v))}${e}${k==='fat'&&c.d.oficial?'<span class="est" style="background:rgba(63,197,142,.16);color:#7fe3b8" title="Faturamento do fechamento oficial">oficial</span>':''}</td><td class="num pc">${pc(v,c.d.fat)}</td>`}).join('')}</tr>`).join('');
  const pe=`<tr class="l-sub"><td>Ponto de equilíbrio</td>${cols.map(c=>`<td class="num">${ok_(c.d.pe)?brl(c.d.pe):'—'}</td><td class="num pc">${c.d.fat&&ok_(c.d.pe)?nf0.format(c.d.pe/c.d.fat*100)+'%':'—'}</td>`).join('')}</tr>`;
  return head+body+pe;
}
function prmInputs(el,P0,DEF,fields,onch,ro){
  el.innerHTML = fields.map(f=>f.t==='base'
    ? `<label class="f">${f.n}<select class="inp" data-p="${f.k}" ${ro?'disabled':''}><option value="delivery" ${P0[f.k]==='delivery'?'selected':''}>sobre a venda do delivery</option><option value="total" ${P0[f.k]==='total'?'selected':''}>sobre o faturamento total</option></select></label>`
    : `<label class="f">${f.n}<div class="inwrap"><input class="inp" type="number" step="${f.s||0.1}" data-p="${f.k}" value="${P0[f.k]}" ${ro?'disabled':''}><em>${f.u}</em></div></label>`).join('');
  el.querySelectorAll('[data-p]').forEach(i=>i.onchange=()=>{const k=i.dataset.p;P0[k]=i.tagName==='SELECT'?i.value:(i.value===''?DEF[k]:+i.value);onch(k)});
}
const FIELDS_DRE=[{k:'impostos',n:'Impostos',u:'%'},{k:'delivery',n:'Custos de delivery',u:'%'},{k:'deliveryBase',n:'Base dos custos de delivery',t:'base'},{k:'manutencao',n:'Manutenção',u:'%'},{k:'marketing',n:'Marketing, royalties, escritório e fundo',u:'%'},{k:'cto',n:'CTO por loja',u:'R$',s:100},{k:'agua',n:'Água por loja',u:'R$',s:50},{k:'energia',n:'Energia por loja',u:'R$',s:50}];
const FIELDS_DRE_EST=[{k:'cmv',n:'CMV (sem contagem no mês)',u:'%'},{k:'pessoal',n:'Folha (sem lançamento no mês)',u:'%'}];
const NOME_LINHA={fat:'Faturamento (fechamento oficial)',fat_del:'Faturamento delivery (fechamento oficial)',imp:'Impostos',cmv:'CMV',folha:'Folha de pagamento',cdel:'Custos de delivery',man:'Manutenção',mkt:'Marketing, royalties, escritório e fundo',cto:'CTO',agua:'Água',energia:'Energia'};
function dreRede(mes=S.mes){
  // mês com fechamento oficial: o DRE da rede mostra só as lojas do fechamento (as demais teriam só estimativa)
  const ofi=l=>IDX.dl.has(l.id+'|'+mes+'|fat'), temOfi=OPER.some(ofi);
  const lojas=OPER.filter(l=>temOfi?ofi(l):lojaStats(l.id,mes).temVenda);
  const cols=lojas.map(l=>({nome:l.nome,id:l.id,d:lojaDre(l.id,mes)}));
  const tot={};DRE_LINES.forEach(([k])=>tot[k]=cols.some(c=>c.d[k]==null)?null:sum(cols,c=>c.d[k]));
  const fixRede=sum(cols,c=>c.d.folha+c.d.cto+c.d.agua+c.d.energia);
  tot.mg=tot.fat?tot.res/tot.fat*100:null; tot.pe=tot.fat?fixRede/(1-(tot.imp+tot.cmv+tot.cdel+tot.man+tot.mkt)/tot.fat):null;
  return {cols,tot};
}
/* ================= ORÇAMENTO ================= */
const ORC_DEF0={faturamento:500000,mixDelivery:100,cmv:21,folha:19,impostos:10,delivery:28,deliveryBase:'delivery',manutencao:1.5,marketing:7,cto:12000,agua:1500,energia:4500,curva:[70,80,90,95,100,100]};
const orcPadrao=()=>Object.assign({},ORC_DEF0,cfg('orcamento')||{});
let ORCP=null;
const FIELDS_ORC=[{k:'faturamento',n:'Faturamento-alvo',u:'R$',s:1000},{k:'mixDelivery',n:'Delivery no faturamento',u:'%'},{k:'cmv',n:'CMV',u:'%'},{k:'folha',n:'Folha',u:'%'},...FIELDS_DRE.map(f=>Object.assign({},f,{n:f.n.replace(' por loja','')}))];
function orcDre(fat,PR=ORCP){ // fat opcional para a curva (folha fica fixa em R$)
  const f=fat??PR.faturamento;
  return dreCalc(Object.assign({},PR,{fat:f,fatDel:f*PR.mixDelivery/100,folhaR:PR.faturamento*PR.folha/100}));
}
function orcCurva(PR=ORCP){const ramp=PR.curva||ORC_DEF0.curva;const rd=ramp.map(p=>orcDre(PR.faturamento*p/100,PR));let acc=0;const accs=rd.map(x=>acc+=x.res);return {ramp,rd,accs,ano1:accs.at(-1)+orcDre(null,PR).res*(12-ramp.length)}}
function renderOrc(){
  if(!ORCP){try{ORCP=JSON.parse(localStorage.getItem('fb_orc_sim')||'null')}catch(e){} ORCP=Object.assign({},orcPadrao(),ORCP||{})}
  const DEF=orcPadrao();
  const curvaFields=(ORCP.curva||[]).map((v,i)=>({k:'c'+i,n:'Mês '+(i+1),u:'%',s:1}));
  const view=Object.assign({},ORCP,Object.fromEntries((ORCP.curva||[]).map((v,i)=>['c'+i,v])));
  prmInputs($('#orcPrm'),view,Object.assign({},DEF,Object.fromEntries((DEF.curva||[]).map((v,i)=>['c'+i,v]))),FIELDS_ORC.concat(curvaFields),k=>{
    if(/^c\d+$/.test(k)){ORCP.curva=ORCP.curva.slice();ORCP.curva[+k.slice(1)]=view[k]}else ORCP[k]=view[k];
    try{localStorage.setItem('fb_orc_sim',JSON.stringify(ORCP))}catch(e){} renderOrc()});
  $('#orcNote').textContent=JSON.stringify(ORCP)===JSON.stringify(DEF)?'Premissas padrão do portal.':'Simulação: alterações valem só para você até salvar.';
  $('#orcReset').onclick=()=>{ORCP=Object.assign({},orcPadrao());try{localStorage.removeItem('fb_orc_sim')}catch(e){}renderOrc()};
  $('#orcPadrao').onclick=async()=>{if(!confirm('Salvar estas premissas como padrão do orçamento para todos os usuários?'))return;if(await dbw(sb.from('config').upsert({chave:'orcamento',valor:ORCP}),'Premissas padrão salvas.')){await load(['config']);renderOrc()}};
  const d=orcDre();
  $('#tOrc').innerHTML=dreTable([{nome:'Mensal',d}]);
  $('#orcKpis').innerHTML=kpi('Resultado mensal por loja',d.res,'brlK',`margem de ${nf1.format(d.mg)}%`)+
    kpi('Resultado anual por loja',d.res*12,'brlK','loja madura, 12 meses')+
    kpi('Ponto de equilíbrio',d.pe,'brlK',`${nf0.format(d.pe/d.fat*100)}% do faturamento-alvo`,d.pe/d.fat*100)+
    kpi('Custos variáveis',d.varPct*100,'pct1','CMV, impostos, delivery, manutenção e marketing');
  animateKpis($('#orcKpis'));
  const {ramp,rd,accs,ano1}=orcCurva();
  mk('cRamp',{type:'bar',data:{labels:ramp.map((_,i)=>'Mês '+(i+1)),datasets:[
    {type:'line',label:'Resultado acumulado',data:accs,borderColor:C.gold,pointRadius:3,tension:.3,borderWidth:2},
    {label:'Resultado do mês',data:rd.map(x=>x.res),backgroundColor:rd.map(x=>x.res>=0?'rgba(63,197,142,.85)':'rgba(229,48,63,.85)'),borderRadius:8}
  ]},options:{interaction:{mode:'index',intersect:false},plugins:{tooltip:tipBrl},scales:{y:yR,x:xG}}});
  $('#tRamp').innerHTML=`<tr><th>Mês</th><th class="num">% do alvo</th><th class="num">Faturamento</th><th class="num">Resultado</th><th class="num">Acumulado</th></tr>`+
    rd.map((x,i)=>`<tr><td>Mês ${i+1}</td><td class="num">${ramp[i]}%</td><td class="num">${brl(x.fat)}</td><td class="num ${x.res>=0?'up':'down'}">${brl(x.res)}</td><td class="num">${brl(accs[i])}</td></tr>`).join('');
  const ex=S.db.expansao||[];
  $('#tInaug').innerHTML=`<tr><th>Loja</th><th>Abertura</th><th class="num">Resultado/mês</th><th class="num">1º ano*</th><th></th></tr>`+
    (ex.length?ex.map(x=>`<tr><td><b>${esc(x.nome)}</b>${x.loja_id?' <span class="tag">cadastrada</span>':''}</td><td>${esc(x.abertura||'')}${x.data_prevista?` <span class="small muted">${fmtD(x.data_prevista)}</span>`:''}</td><td class="num ${d.res>=0?'up':'down'}">${brl(d.res)}</td><td class="num">${brl(ano1)}</td><td class="num">${P.gestor?`<button class="btn sm" data-ex="${x.id}">Excluir</button>`:''}</td></tr>`).join(''):'<tr><td colspan="5"><div class="empty">Nenhuma inauguração planejada.</div></td></tr>');
  $('#tInaug').querySelectorAll('[data-ex]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta loja do plano de expansão?'))return;if(await dbw(sb.from('expansao').delete().eq('id',b.dataset.ex),'Removida do plano.')){await load(['expansao']);renderOrc()}});
  $('#inaugNote').innerHTML=`* 1º ano = primeiros ${ramp.length} meses pela curva de maturação + ${12-ramp.length} meses com a loja madura. O plano de expansão é separado do cadastro de lojas em operação: a loja só entra nos indicadores quando for cadastrada em Configurações.`;
  // cenários
  const cen=S.db.orc_cenarios||[];
  const atual={nome:'Simulação atual',premissas:ORCP};
  $('#tCen').innerHTML=`<tr><th>Cenário</th><th class="num">Faturamento-alvo</th><th class="num">CMV</th><th class="num">Folha</th><th class="num">Resultado/mês</th><th class="num">Margem</th><th class="num">Ponto de equilíbrio</th><th class="num">1º ano</th><th></th></tr>`+
    [atual].concat(cen).map(c=>{const pr=Object.assign({},ORC_DEF0,c.premissas);const x=orcDre(null,pr);return `<tr ${c===atual?'style="background:rgba(229,48,63,.08)"':''}><td><b>${esc(c.nome)}</b>${c.created_at?`<div class="small muted">${fmtD(c.created_at.slice(0,10))}</div>`:''}</td><td class="num">${brl(pr.faturamento)}</td><td class="num">${nf1.format(pr.cmv)}%</td><td class="num">${nf1.format(pr.folha)}%</td><td class="num ${x.res>=0?'up':'down'}">${brl(x.res)}</td><td class="num">${nf1.format(x.mg)}%</td><td class="num">${brl(x.pe)}</td><td class="num">${brl(orcCurva(pr).ano1)}</td><td class="num">${c.id?`<button class="btn sm" data-cu="${c.id}">Usar</button> <button class="btn sm" data-cx="${c.id}">Excluir</button>`:''}</td></tr>`}).join('');
  $('#tCen').querySelectorAll('[data-cu]').forEach(b=>b.onclick=()=>{ORCP=Object.assign({},ORC_DEF0,cen.find(c=>c.id==b.dataset.cu).premissas);try{localStorage.setItem('fb_orc_sim',JSON.stringify(ORCP))}catch(e){}renderOrc();window.scrollTo({top:0,behavior:'smooth'})});
  $('#tCen').querySelectorAll('[data-cx]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este cenário?'))return;if(await dbw(sb.from('orc_cenarios').delete().eq('id',b.dataset.cx),'Cenário excluído.')){await load(['orc_cenarios']);renderOrc()}});
  // rede com 10 lojas
  const p=cfg('projecao10')||{lojasBase:[],novasLojas:8};
  const baseIds=(p.lojasBase||[]).filter(id=>LBYID[id]), base=baseIds.map(id=>lojaDre(id)), novas=p.novasLojas;
  const semVenda=baseIds.filter(id=>!lojaStats(id).temVenda);
  $('#redeSub').textContent=`DRE consolidado mensal · ${baseIds.map(lojaNome).join(' e ')} com o DRE de ${mesLongo(S.mes)} + ${novas} lojas no orçamento`+(semVenda.length?` · atenção: ${semVenda.map(lojaNome).join(', ')} sem vendas no mês`:'');
  const cons={};DRE_LINES.forEach(([k])=>cons[k]=sum(base,x=>x[k])+d[k]*novas);
  $('#redeKpis').innerHTML=kpi('Faturamento mensal',cons.fat,'brlK',`${baseIds.length+novas} lojas`)+kpi('Resultado operacional mensal',cons.res,'brlK',`margem de ${cons.fat?nf1.format(cons.res/cons.fat*100):'—'}%`)+kpi('Resultado anual',cons.res*12,'brlK','rede madura')+kpi('Lojas novas no orçamento',novas,'int',`além de ${baseIds.map(lojaNome).join(' e ')}`);
  animateKpis($('#redeKpis'));
  const cols=baseIds.map((id,i)=>({nome:lojaNome(id),d:base[i]})).concat([{nome:`${novas} lojas (orçamento)`,d:Object.assign(Object.fromEntries(DRE_LINES.map(([k])=>[k,d[k]*novas])),{pe:d.pe*novas})},{nome:`Rede com ${baseIds.length+novas} lojas`,d:Object.assign(cons,{pe:sum(base,x=>ok_(x.pe)?x.pe:0)+d.pe*novas})}]);
  $('#tRede').innerHTML=dreTable(cols);
}
function initOrc(){
  $('#cnSave').onclick=async()=>{const n=$('#cnNome').value.trim();if(!n){toast('Dê um nome ao cenário.');return}
    if(await dbw(sb.from('orc_cenarios').insert({nome:n,premissas:ORCP}),'Cenário salvo.')){$('#cnNome').value='';await load(['orc_cenarios']);renderOrc()}};
  $('#exAdd').onclick=async()=>{const n=$('#exNome').value.trim();if(!n){toast('Informe o nome da loja.');return}
    if(await dbw(sb.from('expansao').insert({nome:n,abertura:$('#exAb').value||null,data_prevista:$('#exData').value||null,ordem:(S.db.expansao||[]).length+1}),'Loja adicionada ao plano.')){['#exNome','#exAb','#exData'].forEach(s=>$(s).value='');await load(['expansao']);renderOrc()}};
}
