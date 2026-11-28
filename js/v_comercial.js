/* ================= VISÃO GERAL ================= */
function rankingRede(mes=S.mes){
  return OPER.map(l=>{const s=lojaStats(l.id,mes),v=s.vals;const ms=METAS(l.id,mes).filter(m=>m.meta!=null&&v[m.k]!=null);const ok=ms.filter(m=>status(m,v[m.k])==='ok').length;return {l,ok,tot:ms.length,pct:s.pctMeta}})
    .sort((a,b)=>b.ok-a.ok||(b.pct??-1)-(a.pct??-1));
}
function alertasRede(mes=S.mes){
  const al=[];
  OPER.forEach(l=>{const s=lojaStats(l.id,mes);METAS(l.id,mes).forEach(m=>{const v=s.vals[m.k];const st=status(m,v);if(st==='warn'||st==='bad')al.push({s:st,l:l.nome,id:l.id,m,v})})});
  return al.sort((a,b)=>(a.s==='bad'?0:1)-(b.s==='bad'?0:1));
}
function renderOnboard(){
  const el=$('#onboard'); let off=false; try{off=localStorage.getItem('fb_onboard_off')==='1'}catch(e){}
  if(!P.gestor||off){el.classList.add('hidden');return}
  const st=[
    {t:'Metas de vendas',d:`Cadastrar a meta de ${mesTxt(S.mes)} de cada loja`,ok:OPER.length&&OPER.every(l=>IDX.mv.has(l.id+'|'+S.mes)),go:()=>{cfSub='mv';go('config')}},
    {t:'Vendas',d:'Importar o histórico (CSV) ou lançar o dia',ok:(S.db.vendas_diarias||[]).length>0,go:()=>{go('vendas');setTimeout(()=>$('#vForm').scrollIntoView({behavior:'smooth'}),300)}},
    {t:'Colaboradores',d:'Cadastrar a equipe de cada loja',ok:(S.db.colaboradores||[]).length>0,go:()=>{rhSub='quadro';go('rh')}},
    {t:'Estoque da cozinha central',d:'Cadastrar os itens, mínimos e consumo',ok:(S.db.estoque_cc||[]).length>0,go:()=>{ccSub='est';go('cc')}},
    {t:'Equipe com acesso',d:'Criar usuários por perfil e loja',ok:false,go:()=>{cfSub='users';go('config')},adm:true}
  ].filter(s=>!s.adm||P.admin);
  const feitos=st.filter(s=>s.ok).length;
  if(feitos===st.length-(P.admin?1:0)&&feitos>=4){el.classList.add('hidden');return}
  el.classList.remove('hidden');
  el.innerHTML=`<h3>Primeiros passos <small>${feitos} de ${st.length} concluídos · <button class="btn sm" id="obX">Ocultar</button></small></h3><div class="steps">${st.map((s,i)=>`<button class="step ${s.ok?'done':''}" data-ob="${i}"><span class="n">${s.ok?'✓':i+1}</span><b>${s.t}</b><span>${s.d}</span></button>`).join('')}</div>`;
  el.querySelectorAll('[data-ob]').forEach(b=>b.onclick=()=>st[+b.dataset.ob].go());
  $('#obX').onclick=()=>{try{localStorage.setItem('fb_onboard_off','1')}catch(e){}el.classList.add('hidden')};
}
/* valor do mês da loja: fechado = realizado; em andamento = projeção pelo peso dos dias da semana */
function gMes(id,m){
  const s=lojaStats(id,m); if(!s.temVenda) return null;
  const ate=s.ate||fimMes(m), parcial=ate<fimMes(m), dias=+ate.slice(8,10);
  const pa=parcial?metaAteLoja(1,m,ate):1, proj=parcial&&pa?s.fat/pa:s.fat;
  return {fat:s.fat,val:proj,parcial,ate,dias,media:dias?s.fat/dias:null,meta:s.meta,pct:s.pctMeta};
}
function renderGeral(){
  renderOnboard();
  const M=S.mes, M1=addMes(M,-1), M2=addMes(M,-2), piso=pisoLoja();
  const G=OPER.map(l=>({l,s:lojaStats(l.id,M),g:gMes(l.id,M),g1:gMes(l.id,M1),g2:gMes(l.id,M2)})), com=G.filter(x=>x.g);
  const inaug=LOJAS.filter(l=>l.status==='inauguracao');
  // 1. vendas x meta até a data (mesma regra do Painel operacional e de Minha loja)
  const R=sum(com,x=>x.s.fat), MA=sum(com,x=>x.s.metaAte||0), abaixo=com.filter(x=>x.s.pctMeta!=null&&x.s.pctMeta<100).length;
  const ates=uniq(com.map(x=>x.g.ate)).sort(), ateTxt=ates.length?fmtD(ates.at(-1)).slice(0,5):'';
  // 2. média por dia contra o mês anterior (compara períodos de tamanhos diferentes de forma justa)
  const med=x=>x?x.media:null, mR=com.length?sum(com,x=>x.g.fat)/Math.max(...com.map(x=>x.g.dias)):null;
  const c1=G.filter(x=>x.g1), mR1=c1.length?sum(c1,x=>x.g1.fat)/Math.max(...c1.map(x=>x.g1.dias)):null, vM=mR&&mR1?(mR/mR1-1)*100:null;
  // 3. lojas que fecham o mês acima do piso
  const acima=com.filter(x=>x.g.val>=piso).length, parcial=com.some(x=>x.g.parcial);
  // 4. indicadores na meta
  const rk=rankingRede(), okI=sum(rk,r=>r.ok), totI=sum(rk,r=>r.tot);
  const kp=(lbl,val,f,sub,st,bar)=>kpi(lbl,val,f,sub,bar).replace('class="card kpi"',`class="card kpi${st?' kpi-'+st:''}"`);
  const stP=p=>p==null?'':p>=100?'ok':p>=90?'warn':'bad';
  $('#geralKpis').innerHTML=
    kp('Vendas x meta até a data',MA&&com.length?R/MA*100:null,'pct1',MA?`${brlK(R)} de ${brlK(MA)} até ${ateTxt} · ${abaixo} loja${abaixo===1?'':'s'} abaixo`:'meta do mês não cadastrada',MA?stP(R/MA*100):'',MA?R/MA*100:null)+
    kp('Média por dia',mR,'brlK',vM!=null?`${vM>=0?'+':'−'}${nf1.format(Math.abs(vM))}% contra ${mesTxt(M1).toLowerCase()} (${brlK(mR1)}/dia)`:'sem o mês anterior para comparar',vM==null?'':vM>=0?'ok':vM>=-5?'warn':'bad')+
    kp(`Lojas acima de ${brlK(piso)}`,com.length?acima:null,'int',`de ${OPER.length} em operação${parcial?' · pela projeção do mês':''}${inaug.length?' · '+inaug.map(l=>l.nome+' em inauguração').join(', '):''}`,com.length?(acima===OPER.length?'ok':acima?'warn':'bad'):'')+
    kp('Indicadores na meta',totI?okI/totI*100:null,'pct1',totI?`${okI} de ${totI} indicadores com dado nas ${OPER.length} lojas`:'sem indicadores com dado no mês',totI?(okI/totI>=.8?'ok':okI/totI>=.5?'warn':'bad'):'',totI?okI/totI*100:null);
  animateKpis($('#geralKpis'));

  // faturamento por loja nos últimos 3 meses (mês em andamento pela projeção)
  const lb=m=>{const p=G.some(x=>{const g=m===M?x.g:m===M1?x.g1:x.g2;return g&&g.parcial});return mesTxt(m)+(p?' (projeção)':'')};
  const val=(x,k)=>x[k]?x[k].val:null;
  if(G.some(x=>x.g||x.g1||x.g2)) mk('cGm3',{type:'bar',data:{labels:OPER.map(l=>l.nome),datasets:[
    {label:lb(M2),data:G.map(x=>val(x,'g2')),backgroundColor:'#6e4c43',borderRadius:4,maxBarThickness:34},
    {label:lb(M1),data:G.map(x=>val(x,'g1')),backgroundColor:'#a8574d',borderRadius:4,maxBarThickness:34},
    {label:lb(M),data:G.map(x=>val(x,'g')),backgroundColor:'#e5303f',borderRadius:4,maxBarThickness:34},
    {type:'line',label:'Piso '+brlK(piso),data:OPER.map(()=>piso),borderColor:C.gold,borderDash:[6,5],borderWidth:2,pointRadius:0}
  ]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>{if(c.parsed.y==null)return null;const x=G[c.dataIndex],g=[x.g2,x.g1,x.g][c.datasetIndex];return ' '+c.dataset.label+': '+brl(c.parsed.y)+(g&&g.parcial?` (realizado ${brlK(g.fat)} até ${fmtD(g.ate).slice(0,5)})`:'')}}}},scales:{y:yR,x:xG}}});
  else noData('cGm3','Sem vendas nos últimos 3 meses.');

  // ranking
  $('#rank').innerHTML = rk.length?rk.map((r,i)=>{const p=r.tot?r.ok/r.tot*100:0;const col=p>=80?C.green:p>=50?C.gold:C.red;
    return `<div class="row"><div class="pos" style="${i===0&&r.tot?'background:'+C.gold+';color:#2a1d0a':''}">${i+1}</div><div><div class="nm">${esc(r.l.nome)} <span class="tag" style="margin-left:6px">${r.tot?(i<Math.ceil(rk.length/2)?'TOP':'FLOP'):'sem dados'}</span></div><div class="meter"><i style="width:${p}%;background:${col}"></i></div></div><div class="small muted">${r.ok}/${r.tot}${r.pct!=null?` · ${nf0.format(r.pct)}% meta`:''}</div></div>`}).join('')
    + `<p class="small muted" style="margin-top:6px">Ordem: quantidade de indicadores dentro da meta; desempate pelo % da meta de vendas até a data. Só entram indicadores com dado no mês.</p>`:'<div class="empty">Nenhuma loja em operação.</div>';

  // comparação mês a mês (média por dia de venda)
  const cel=g=>g?`<b>${brlK(g.media)}</b><div class="small muted">${brlK(g.fat)}${g.parcial?' · '+fmtD(g.ate).slice(0,5):''}</div>`:'<span class="muted">—</span>';
  const vr=(a,b)=>a&&b&&a.media&&b.media?(a.media/b.media-1)*100:null;
  const vCel=v=>v==null?'—':`<span class="sem s-${v>=0?'ok':v>=-5?'warn':'bad'}">${v>=0?'+':'−'}${nf1.format(Math.abs(v))}%</span>`;
  const rd=k=>{const c=G.filter(x=>x[k]);return c.length?{fat:sum(c,x=>x[k].fat),media:sum(c,x=>x[k].fat)/Math.max(...c.map(x=>x[k].dias)),parcial:c.some(x=>x[k].parcial),ate:c.map(x=>x[k].ate).sort().at(-1)}:null};
  const RD={g2:rd('g2'),g1:rd('g1'),g:rd('g')};
  $('#gComp').innerHTML=`<table class="g-comp"><thead><tr><th>Loja</th><th class="num">${mesTxt(M2)}</th><th class="num">${mesTxt(M1)}</th><th class="num">${mesTxt(M)}</th><th class="num">vs ${mesTxt(M1)}</th></tr></thead><tbody>
    ${G.map(x=>`<tr><td><b>${esc(x.l.nome)}</b></td><td class="num">${cel(x.g2)}</td><td class="num">${cel(x.g1)}</td><td class="num">${cel(x.g)}</td><td class="num">${vCel(vr(x.g,x.g1))}</td></tr>`).join('')}
    ${OPER.length>1?`<tr class="po-rede-l"><td><b>Rede</b></td><td class="num">${cel(RD.g2)}</td><td class="num">${cel(RD.g1)}</td><td class="num">${cel(RD.g)}</td><td class="num">${vCel(vr(RD.g,RD.g1))}</td></tr>`:''}</tbody></table>
    <p class="small muted" style="margin-top:10px">Em negrito, a média por dia (faturamento ÷ dias até o último dado); embaixo, o total do mês. Assim o mês em andamento compara com os fechados.</p>`;

  // crescimento e expansão (mês em andamento pela projeção)
  const p=cfg('projecao10')||{lojasBase:[],novasLojas:8,faturamentoMinimo:500000};
  const vm=id=>{const g=LBYID[id]?gMes(id,M):null;return g?g.val:0};
  const hoje=sum(OPER,l=>vm(l.id)), base=sum(p.lojasBase||[],vm), proj=base+p.novasLojas*p.faturamentoMinimo;
  $('#redeHojeLbl').textContent=`Rede hoje (${OPER.length} loja${OPER.length===1?'':'s'} em operação)`;
  $('#redeHojeSub').textContent=parcial?`por mês · projeção de ${mesLongo(M).toLowerCase()}`:'por mês';
  if(com.length){countUp($('#redeHoje'),hoje,brlK);countUp($('#redeProj'),proj,brlK);
    $('#projTxt').textContent = `${(p.lojasBase||[]).map(id=>`${lojaNome(id)} (${brl(vm(id))})`).join(' + ')} + ${p.novasLojas} lojas acima de ${brlK(p.faturamentoMinimo)} (${brl(p.novasLojas*p.faturamentoMinimo)}) = ${brl(proj)} por mês${hoje?` — ${nf1.format(proj/hoje)}x o faturamento de hoje`:''}.`}
  else{$('#redeHoje').textContent='—';$('#redeProj').textContent='—';$('#projTxt').textContent='A projeção aparece quando houver vendas lançadas no mês.'}
  const ex=(S.db.expansao||[]);
  $('#timeline').innerHTML = (ex.length?`<div class="tl"><b>${esc(ex[0].abertura||fmtD(ex[0].data_prevista))}</b><span>Abertura da loja ${esc(ex[0].nome)}.</span></div>`:'')+
    `<div class="tl"><b>2027 a 2030</b><span>Média de 2 a 3 novas lojas por ano${ex.length>1?` · ${ex.length-1} no plano`:''}.</span></div><div class="tl"><b>Meta para 2030</b><span>No mínimo 10 lojas na rede.</span></div>`;

  // evolução das vendas (6 meses; mês em andamento pela projeção, trecho tracejado)
  const ms=Array.from({length:6},(_,i)=>addMes(M,i-5));
  const pend=(arr)=>({borderDash:c=>c.p1DataIndex===ms.length-1&&arr[ms.length-1]?[5,4]:undefined});
  const evol=OPER.map((l,i)=>{const gs=ms.map(m=>gMes(l.id,m));return {label:l.nome,data:gs.map(g=>g?g.val:null),borderColor:PAL[i%6],backgroundColor:PAL[i%6],tension:.3,pointRadius:3,borderWidth:2,spanGaps:true,segment:pend(gs.map(g=>g&&g.parcial))}});
  const gR=ms.map(m=>{const v=sum(OPER,l=>{const g=gMes(l.id,m);return g?g.val:0});return v||null}), pR=ms.map(m=>OPER.some(l=>{const g=gMes(l.id,m);return g&&g.parcial}));
  const metaR=ms.map(m=>{const v=sum(OPER,l=>IDX.mv.get(l.id+'|'+m)||0);return v||null});
  if(evol.some(d=>d.data.some(v=>v!=null))) mk('cEvol',{type:'line',data:{labels:ms.map((m,i)=>mesTxt(m)+(pR[i]?'*':'')),datasets:evol.concat([
    {label:'Rede',data:gR,borderColor:'#ffffff',backgroundColor:'#ffffff',borderWidth:3,pointRadius:4,tension:.3,segment:pend(pR)},
    {label:'Meta da rede',data:metaR,borderColor:'#d28e05',borderDash:[6,5],borderWidth:2,pointRadius:0,tension:.3,spanGaps:true}])},
    options:{plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.parsed.y==null?null:' '+c.dataset.label+': '+brl(c.parsed.y)+(pR[c.dataIndex]&&c.dataset.label!=='Meta da rede'?' (projeção)':'')}}},scales:{y:yR,x:xG}}});
  else noData('cEvol','Sem vendas nos últimos 6 meses.');
  // indicadores críticos (mesmo semáforo de Metas e indicadores)
  const al=alertasRede();
  const ind=METAS_DEF.filter(d=>d.k!=='fat').map(d=>({d,n:al.filter(a=>a.m.k===d.k).length,b:al.filter(a=>a.m.k===d.k&&a.s==='bad').length})).filter(x=>x.n);
  if(ind.length) mk('cCrit',{type:'bar',data:{labels:ind.map(x=>x.d.n),datasets:[{label:'Críticos',data:ind.map(x=>x.b),backgroundColor:'rgba(229,48,63,.85)',borderRadius:6,stack:'c',maxBarThickness:28},{label:'Em atenção',data:ind.map(x=>x.n-x.b),backgroundColor:'rgba(242,179,61,.85)',borderRadius:6,stack:'c',maxBarThickness:28}]},
    options:{indexAxis:'y',scales:{x:{stacked:true,grid:{color:C.grid},border:{display:false},ticks:{precision:0}},y:{stacked:true,grid:{display:false},border:{display:false}}}}});
  else noData('cCrit','Nenhum indicador fora da meta.');
}

/* ================= VENDAS ================= */
function vendasPeriodo(ids,ini,fim){
  const datas=[];for(let d=ini;d<=fim;d=addDia(d,1))datas.push(d);
  const dias=datas.map(d=>[0,1,2,3].map(k=>sum(ids,id=>{const r=IDX.vd.get(id+'|'+d);return r?[+r.salao,+r.delivery,+r.pedidos_salao,+r.pedidos_delivery][k]:0})));
  const metaDia=datas.map(d=>{const v=ids.map(id=>metaDiaLoja(id,d)).filter(x=>x!=null);return v.length?sum(v):null});
  const hr=(S.db.vendas_hora||[]).filter(r=>ids.includes(r.loja_id)&&r.data>=ini&&r.data<=fim);
  const horas=uniq((cfg('horas')||[]).concat(hr.map(r=>r.hora))).sort((a,b)=>a-b);
  const diasH=uniq(hr.map(r=>r.data)).length;
  const hs=horas.map(h=>sum(hr.filter(r=>r.hora===h),r=>r.salao)), hd=horas.map(h=>sum(hr.filter(r=>r.hora===h),r=>r.delivery));
  const meta=metaDia.some(v=>v!=null)?sum(metaDia.filter(v=>v!=null)):null;
  // lojas sem venda dia a dia no mês: entra o acumulado por hora do mês (relatório do sistema de caixa), quando o período cobre o mês
  const ac={fat:0,ped:0,sal:0,del:0,ps:0,pd:0,sm:0,horas:{},lojas:[],ate:null,dias:0};
  uniq(datas.map(ymOf)).forEach(m=>{if(ini>iniMes(m))return;ids.forEach(id=>{const a=IDX.vhm.get(id+'|'+m);if(!a||diasDoMes(m).some(d=>IDX.vd.has(id+'|'+d)))return;
    if(a.ate&&fim<a.ate&&fim<fimMes(m))return;
    const dv=(LBYID[id]||{}).canais==='delivery';ac.fat+=a.valor;ac.ped+=a.pessoas;if(dv){ac.del+=a.valor;ac.pd+=a.pessoas}else{ac.sal+=a.valor;ac.ps+=a.pessoas;ac.sm+=a.valor}
    Object.entries(a.horas).forEach(([h,v])=>ac.horas[h]=(ac.horas[h]||0)+v);ac.lojas.push(id);if(a.ate&&(!ac.ate||a.ate>ac.ate))ac.ate=a.ate;ac.dias=Math.max(ac.dias,a.ate?+a.ate.slice(8,10):diasDoMes(m).length)})});
  let temHora=hr.length>0,hs2=hs,hd2=hd,horas2=horas,diasH2=diasH;
  // sem venda por hora lançada: mostra exatamente o relatório do caixa (total de cada hora no período), sem estimar média
  let horaCaixa=false;
  if(!temHora&&ac.lojas.length){horas2=Object.keys(ac.horas).map(Number).sort((a,b)=>a-b);hs2=horas2.map(h=>ac.horas[h]-0);hd2=horas2.map(()=>0);
    const dv=ac.del>=ac.sal&&!ac.sm;if(dv){hd2=hs2;hs2=horas2.map(()=>0)}diasH2=1;temHora=true;horaCaixa=true}
  return {datas,dias,metaDia,horas:horas2,hs:hs2,hd:hd2,diasH:diasH2,meta,temHora,horaCaixa,ac:ac.lojas.length?ac:null};
}
function renderVendas(){
  const sel=$('#vLoja').value||'rede', ids = sel==='rede'?OPER.map(l=>l.id):[sel];
  let ini=$('#vIni').value||iniMes(S.mes), fim=$('#vFim').value||fimMes(S.mes); if(fim<ini)[ini,fim]=[fim,ini];
  garantirHora(ini,fim).then(novo=>{if(novo&&S.tab==='vendas')renderVendas()});
  const A=vendasPeriodo(ids,ini,fim), N=A.datas.length;
  const AC=A.ac||{sal:0,del:0,ps:0,pd:0};
  const sal=sum(A.dias,d=>d[0])+AC.sal, del=sum(A.dias,d=>d[1])+AC.del, ps=sum(A.dias,d=>d[2])+AC.ps, pd=sum(A.dias,d=>d[3])+AC.pd, fat=sal+del;
  const tot=A.dias.map(d=>d[0]+d[1]); const best=tot.indexOf(Math.max(...tot));
  const hTot=A.hs.map((v,i)=>v+A.hd[i]); const pico=hTot.indexOf(Math.max(...hTot));
  const nDias=A.datas.filter((d,i)=>tot[i]>0).length;
  $('#vKpis').innerHTML =
    kpi('Faturamento',fat||null,'brlK',A.meta?`${nf1.format(fat/A.meta*100)}% da meta de ${brlK(A.meta)}`:'sem meta cadastrada no período',A.meta?fat/A.meta*100:null)+
    kpi('Média por dia',(nDias+(A.ac?A.ac.dias:0))?fat/Math.max(nDias,A.ac?A.ac.dias:0):null,'brl',A.ac?`acumulado do caixa${A.ac.ate?' até '+fmtD(A.ac.ate).slice(0,5):''} · ${A.ac.lojas.map(lojaNome).join(', ')}`:`${nDias} dia${nDias===1?'':'s'} com venda de ${N}`)+
    kpi('Pedidos',(ps+pd)||null,'int',A.ac&&A.ac.lojas.some(id=>(LBYID[id]||{}).canais!=='delivery')?'caixa sem divisão salão/delivery':`${nf0.format(ps)} salão · ${nf0.format(pd)} delivery`)+
    kpi('Ticket médio',(ps+pd)?fat/(ps+pd):null,'ticket',A.ac&&A.ac.lojas.some(id=>(LBYID[id]||{}).canais!=='delivery')?'por pedido · caixa':ps?`salão R$ ${nf2.format(sal/ps)} · delivery ${pd?'R$ '+nf2.format(del/pd):'—'}`:(pd?'100% delivery':''))+
    kpi('Melhor dia',tot[best]>0?tot[best]:null,'brl',tot[best]>0?new Date(A.datas[best]+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'}):'')+
    kpi('Horário de pico',A.temHora?hTot[pico]/A.diasH:null,'brl',A.temHora?(A.horaCaixa?`${A.horas[pico]}h · total no período (relatório do caixa${A.ac.ate?' até '+fmtD(A.ac.ate).slice(0,5):''})`:`${A.horas[pico]}h · média por dia`):'sem vendas por hora lançadas');
  animateKpis($('#vKpis'));

  const labs=A.datas.map(d=>d.slice(8,10)+(N<=62?' '+wkOfIso(d):'/'+d.slice(5,7)));
  const soCaixa=!!A.ac&&!tot.some(v=>v>0);
  if(soCaixa) noData('cDaily',`O relatório do caixa traz o acumulado do mês por hora${A.ac.ate?' (01 a '+fmtD(A.ac.ate).slice(0,5)+')':''}, sem a venda dia a dia.`);
  else if(fat||A.meta) mk('cDaily',{type:'bar',data:{labels:labs,datasets:[
    {type:'line',label:'Meta do dia',data:A.metaDia,borderColor:C.gold,borderWidth:2,borderDash:[5,4],pointRadius:0,tension:.3,order:0},
    {label:'Salão',data:A.dias.map(d=>d[0]),backgroundColor:'rgba(238,219,202,.75)',borderRadius:4,stack:'s',order:1},
    {label:'Delivery',data:A.dias.map(d=>d[1]),backgroundColor:'rgba(229,48,63,.85)',borderRadius:4,stack:'s',order:1}
  ]},options:{interaction:{mode:'index',intersect:false},plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+brl(c.parsed.y),footer:it=>'Total: '+brl(it.filter(i=>i.dataset.stack).reduce((a,i)=>a+i.parsed.y,0))}}},
    scales:{y:Object.assign({stacked:true},yR),x:Object.assign({stacked:true,ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:16}},xG)}}});
  else noData('cDaily','Sem vendas nem meta no período.');

  const hH=$('#cHora').closest('.card').querySelector('h3');
  hH.innerHTML=A.horaCaixa?`Venda hora a hora <small>total de cada hora · relatório do caixa${A.ac.ate?' até '+fmtD(A.ac.ate).slice(0,5):''}${A.ac.sm?' · salão e delivery juntos no Brooklin':''}</small>`:'Venda hora a hora <small>média por dia</small>';
  if(A.horaCaixa){const tv=A.horas.map((h,i)=>A.hs[i]+A.hd[i]),mx=Math.max(...tv),tt=sum(tv);
    mk('cHora',{type:'bar',data:{labels:A.horas.map(h=>h+'h'),datasets:[{label:'Faturamento',data:tv,backgroundColor:tv.map(v=>v===mx?'rgba(242,179,61,.95)':'rgba(229,48,63,.85)'),borderRadius:5}]},
      options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${brl(c.raw)} · ${nf1.format(c.raw/tt*100)}% do período`}}},scales:{y:yR,x:xG}}})}
  else if(A.temHora) mk('cHora',{type:'bar',data:{labels:A.horas.map(h=>h+'h'),datasets:[
    {label:'Salão',data:A.hs.map(v=>v/A.diasH),backgroundColor:'rgba(238,219,202,.75)',borderRadius:5,stack:'h'},
    {label:'Delivery',data:A.hd.map(v=>v/A.diasH),backgroundColor:'rgba(229,48,63,.85)',borderRadius:5,stack:'h'}
  ]},options:{interaction:{mode:'index',intersect:false},plugins:{tooltip:tipBrl},scales:{y:Object.assign({stacked:true},yR),x:Object.assign({stacked:true},xG)}}});
  else noData('cHora','Sem venda por hora lançada neste período. Mande o relatório "Faturamento por hora e loja" do caixa para preencher.');

  let ac=0, am=0;
  if(fat||A.meta) mk('cAcum',{type:'line',data:{labels:labs,datasets:[
    {label:'Realizado',data:soCaixa?A.datas.map(d=>d===A.ac.ate?fat:null):tot.map((v,i)=>A.datas[i]<=isoHoje()||v?ac+=v:null),pointRadius:soCaixa?6:0,pointBackgroundColor:C.red,borderColor:C.red,backgroundColor:'rgba(229,48,63,.15)',fill:true,tension:.3,pointRadius:0,borderWidth:2.5},
    {label:'Meta acumulada',data:A.metaDia.map(v=>am+=(v||0)),borderColor:C.gold,borderDash:[6,5],pointRadius:0,borderWidth:2}
  ]},options:{interaction:{mode:'index',intersect:false},plugins:{tooltip:tipBrl},scales:{y:yR,x:Object.assign({ticks:{maxRotation:0,maxTicksLimit:8}},xG)}}});
  else noData('cAcum','Sem vendas nem meta no período.');

  const sm=A.ac?A.ac.sm:0, salR=sal-sm;
  if(fat) mk('cCanal',{type:'doughnut',data:{labels:sm?['Salão','Delivery','Sem divisão (caixa)']:['Salão','Delivery'],datasets:[{data:sm?[salR,del,sm]:[sal,del],backgroundColor:['rgba(238,219,202,.85)','rgba(229,48,63,.9)','rgba(150,140,132,.6)'],borderWidth:0,hoverOffset:8}]},
    options:{cutout:'68%',plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>' '+c.label+': '+brl(c.parsed)+' ('+nf1.format(c.parsed/fat*100)+'%)'}}}}});
  else noData('cCanal','Sem vendas no período.');
  $('#canalInfo').innerHTML = `<div><span>Salão</span><b>${brl(salR)} · ${fat?nf1.format(salR/fat*100):'0'}%</b></div><div><span>Delivery</span><b>${brl(del)} · ${fat?nf1.format(del/fat*100):'0'}%</b></div>${sm?`<div><span>Sem divisão (caixa)</span><b>${brl(sm)} · ${nf1.format(sm/fat*100)}%</b></div>`:''}`;

  $('#tCanal').innerHTML = `<tr><th>Loja</th><th class="num">Salão</th><th class="num">Delivery</th><th class="num">Total</th><th class="num">% delivery</th><th class="num">Ticket salão</th><th class="num">Ticket delivery</th></tr>`+
    OPER.map(l=>{const B=vendasPeriodo([l.id],ini,fim);const X=B.ac||{sal:0,del:0,ps:0,pd:0},sm=!!B.ac&&l.canais!=='delivery';const s={sal:sum(B.dias,d=>d[0])+X.sal,del:sum(B.dias,d=>d[1])+X.del,ps:sum(B.dias,d=>d[2])+X.ps,pd:sum(B.dias,d=>d[3])+X.pd};s.fat=s.sal+s.del;
      if(sm)return `<tr><td><b>${esc(l.nome)}</b></td><td colspan="2" class="muted">caixa sem divisão salão/delivery</td><td class="num"><b>${brl(s.fat)}</b></td><td class="num">—</td><td colspan="2" class="num">ticket R$ ${nf2.format(s.fat/(s.ps+s.pd||1))}</td></tr>`;
      return `<tr style="${ids.length===1&&ids[0]===l.id?'background:rgba(229,48,63,.12)':''}"><td><b>${esc(l.nome)}</b></td><td class="num">${brl(s.sal)}</td><td class="num">${brl(s.del)}</td><td class="num"><b>${brl(s.fat)}</b></td><td class="num">${s.fat?nf1.format(s.del/s.fat*100)+'%':'—'}</td><td class="num">${s.ps?"R$ "+nf2.format(s.sal/s.ps):"<span class=\"muted\">"+(l.canais==='delivery'?'só delivery':'—')+"</span>"}</td><td class="num">${s.pd?'R$ '+nf2.format(s.del/s.pd):'—'}</td></tr>`}).join('')+
    LOJAS.filter(l=>l.status==='inauguracao').map(l=>`<tr><td><b>${esc(l.nome)}</b></td><td colspan="6" class="muted">Inauguração em ${esc(l.inauguracao||'data a definir')}</td></tr>`).join('');

  // lançamentos do período
  const regs=(S.db.vendas_diarias||[]).filter(r=>ids.includes(r.loja_id)&&r.data>=ini&&r.data<=fim).sort((a,b)=>b.data.localeCompare(a.data)||a.loja_id.localeCompare(b.loja_id));
  $('#tVendasReg').innerHTML = regs.length?`<tr><th>Data</th><th>Loja</th><th class="num">Salão</th><th class="num">Delivery</th><th class="num">Total</th><th class="num">Pedidos salão</th><th class="num">Pedidos delivery</th><th class="num">Ticket</th><th></th></tr>`+
    regs.map(r=>{const t=+r.salao+ +r.delivery, p=r.pedidos_salao+r.pedidos_delivery;return `<tr><td>${fmtD(r.data)} <span class="muted small">${wkOfIso(r.data)}</span></td><td><b>${esc(lojaNome(r.loja_id))}</b></td><td class="num">${brl(r.salao)}</td><td class="num">${brl(r.delivery)}</td><td class="num"><b>${brl(t)}</b></td><td class="num">${r.pedidos_salao}</td><td class="num">${r.pedidos_delivery}</td><td class="num">${p?'R$ '+nf2.format(t/p):'—'}</td><td class="num">${P.editar(r.loja_id)?`<button class="btn sm" data-ved="${r.id}">Editar</button>`:''} ${P.excluir(r.loja_id)?`<button class="btn sm" data-vdel="${r.id}">Excluir</button>`:''}</td></tr>`}).join('')
    :'<tr><td><div class="empty">Nenhuma venda lançada neste período.</div></td></tr>';
  $('#tVendasReg').querySelectorAll('[data-ved]').forEach(b=>b.onclick=()=>{const r=S.db.vendas_diarias.find(x=>x.id==b.dataset.ved);$('#vdData').value=r.data;$('#vdLoja').value=r.loja_id;$('#vdSal').value=r.salao;$('#vdDel').value=r.delivery;$('#vdPs').value=r.pedidos_salao;$('#vdPd').value=r.pedidos_delivery;$('#vForm').scrollIntoView({behavior:'smooth',block:'center'})});
  $('#tVendasReg').querySelectorAll('[data-vdel]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este lançamento de venda?'))return;if(await dbw(sb.from('vendas_diarias').delete().eq('id',b.dataset.vdel),'Lançamento excluído.')){await load(['vendas_diarias']);renderVendas()}});
}
function initVendas(){
  $('#vLoja').innerHTML=`<option value="rede">Rede (todas as lojas)</option>`+optLojas(OPER);
  $('#vLoja').onchange=renderVendas; $('#vIni').onchange=renderVendas; $('#vFim').onchange=renderVendas;
  $('#vdLoja').innerHTML=optLojas(lojasEditaveis()); $('#vdData').value=isoHoje();
  $('#vdSave').onclick=async()=>{
    const r={loja_id:$('#vdLoja').value,data:$('#vdData').value,salao:+$('#vdSal').value||0,delivery:+$('#vdDel').value||0,pedidos_salao:+$('#vdPs').value||0,pedidos_delivery:+$('#vdPd').value||0};
    if(!r.loja_id||!r.data){toast('Informe a data e a loja.');return}
    if(r.salao<0||r.delivery<0||r.pedidos_salao<0||r.pedidos_delivery<0){toast('Os valores não podem ser negativos.');return}
    if((r.salao&&!r.pedidos_salao)||(r.delivery&&!r.pedidos_delivery)){if(!confirm('Há venda sem quantidade de pedidos. Salvar assim mesmo? (o ticket médio ficará distorcido)'))return}
    if(await dbw(sb.from('vendas_diarias').upsert(r,{onConflict:'loja_id,data'}),'Venda salva.')){['#vdSal','#vdDel','#vdPs','#vdPd'].forEach(s=>$(s).value=0);await load(['vendas_diarias']);renderVendas()}
  };
  const lojaDe = v => {v=String(v||'').trim();const l=LOJAS.find(x=>x.id===v.toLowerCase()||x.nome.toLowerCase()===v.toLowerCase()||x.nome.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()===v.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase());return l?l.id:null};
  const importar=async(file,tipo)=>{
    const rows=parseCsv(await file.text()); if(rows.length<2){toast('Arquivo sem linhas.');return}
    const h=rows[0].map(c=>c.trim().toLowerCase()), ix=k=>h.indexOf(k);
    const need=tipo==='d'?['data','loja','salao','delivery','pedidos_salao','pedidos_delivery']:['data','loja','hora','salao','delivery'];
    const falta=need.filter(k=>ix(k)<0); if(falta.length){toast('Colunas ausentes: '+falta.join(', '));return}
    const out=[],err=[];
    rows.slice(1).forEach((r,i)=>{const d=dataBR(r[ix('data')]), l=lojaDe(r[ix('loja')]);
      if(!d||!l){err.push(i+2);return} if(!P.editar(l)){err.push(i+2);return}
      if(tipo==='d'){const o={loja_id:l,data:d,salao:numBR(r[ix('salao')])||0,delivery:numBR(r[ix('delivery')])||0,pedidos_salao:Math.round(numBR(r[ix('pedidos_salao')])||0),pedidos_delivery:Math.round(numBR(r[ix('pedidos_delivery')])||0)};
        if([o.salao,o.delivery,o.pedidos_salao,o.pedidos_delivery].some(v=>isNaN(v)||v<0)){err.push(i+2);return} out.push(o)}
      else{const hh=parseInt(String(r[ix('hora')]).replace(/\D/g,''),10);const o={loja_id:l,data:d,hora:hh,salao:numBR(r[ix('salao')])||0,delivery:numBR(r[ix('delivery')])||0};
        if(isNaN(hh)||hh<0||hh>23||isNaN(o.salao)||isNaN(o.delivery)){err.push(i+2);return} out.push(o)}});
    // sem duplicidade: a última linha de cada chave vence; o banco faz upsert pela chave única
    const key=o=>o.loja_id+'|'+o.data+(tipo==='h'?'|'+o.hora:''); const uniqRows=[...new Map(out.map(o=>[key(o),o])).values()];
    if(!uniqRows.length){toast('Nenhuma linha válida. Linhas com erro: '+err.slice(0,10).join(', '));return}
    if(!confirm(`Importar ${uniqRows.length} lançamento(s)${err.length?` (${err.length} linha(s) ignoradas por erro ou loja sem permissão: ${err.slice(0,8).join(', ')}${err.length>8?'…':''})`:''}? Lançamentos já existentes para a mesma loja e ${tipo==='d'?'data':'data e hora'} serão atualizados, sem duplicar.`))return;
    const tb=tipo==='d'?'vendas_diarias':'vendas_hora', oc=tipo==='d'?'loja_id,data':'loja_id,data,hora';
    for(let i=0;i<uniqRows.length;i+=500){if(!await dbw(sb.from(tb).upsert(uniqRows.slice(i,i+500),{onConflict:oc})))return}
    toast(`${uniqRows.length} lançamento(s) importado(s).`); if(tb==='vendas_hora'){HORA_MESES.clear();S.db.vendas_hora=[]}else await load([tb]); renderVendas();
  };
  $('#vdCsvIn').onchange=e=>{if(e.target.files[0])importar(e.target.files[0],'d');e.target.value=''};
  $('#vhCsvIn').onchange=e=>{if(e.target.files[0])importar(e.target.files[0],'h');e.target.value=''};
  $('#vdModelo').onclick=()=>{csv('modelo-vendas-diarias.csv',[['data','loja','salao','delivery','pedidos_salao','pedidos_delivery'],[isoHoje(),OPER[0]?OPER[0].id:'brooklyn','6611,00','23038,00','103','303']]);setTimeout(()=>csv('modelo-vendas-por-hora.csv',[['data','loja','hora','salao','delivery'],[isoHoje(),OPER[0]?OPER[0].id:'brooklyn','12','1500,00','4200,00']]),400)};
  $('#vdCsv').onclick=()=>{const sel=$('#vLoja').value, ids=sel==='rede'?OPER.map(l=>l.id):[sel];const ini=$('#vIni').value||iniMes(S.mes), fim=$('#vFim').value||fimMes(S.mes);
    csv(`vendas-${ini}-a-${fim}.csv`,[['Data','Loja','Salão','Delivery','Total','Pedidos salão','Pedidos delivery','Ticket médio']].concat((S.db.vendas_diarias||[]).filter(r=>ids.includes(r.loja_id)&&r.data>=ini&&r.data<=fim).map(r=>{const t=+r.salao+ +r.delivery,p=r.pedidos_salao+r.pedidos_delivery;return [r.data,lojaNome(r.loja_id),r.salao,r.delivery,t,r.pedidos_salao,r.pedidos_delivery,p?(t/p).toFixed(2):'']})))};
}

/* ================= METAS ================= */
const CAT_IC = {
 'Comercial':'<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
 'Financeiro':'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M16 15h2"/>',
 'Delivery e qualidade':'<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h6l-3-8H8"/><path d="M14 6h3l3 6"/>',
 'Pessoas':'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18.5 14.8c1.7.8 2.7 2.5 3 5.2"/>'};
function renderMetas(){
  const gs=['Comercial','Financeiro','Delivery e qualidade','Pessoas'], MR=METAS(null);
  $('#metasCats').innerHTML = gs.map(g=>`<div class="card"><div class="cat-h"><span class="cat-ic"><svg viewBox="0 0 24 24">${CAT_IC[g]}</svg></span>${g}</div><div class="metas-list">${
    MR.filter(m=>m.g===g).map(m=>`<div><span>${m.n}</span><b>${m.txt}</b></div>`).join('')+
    (g==='Delivery e qualidade'?`<div><span>${META_EXTRA_DEF.n}</span><b>pelo menos ${nf0.format(metaQual(null))}%</b></div>`:'')+
    METAS_EXTRA[g].map(([n,t])=>`<div><span>${n}</span><b>${t}</b></div>`).join('')}</div></div>`).join('');
  $('#tSem').innerHTML = `<tr><th>Loja</th>${MR.map(m=>`<th class="num" title="${m.txt}">${m.n}<br><span style="font-weight:500;color:var(--dim)">${m.meta==null?'acompanhar':(m.t==='min'?'≥ ':'≤ ')+(m.f==='brl'?brlK(m.meta):m.f==='pctS'?(m.meta>0?'+':'')+nf1.format(m.meta).replace(',0','')+'%':fmt(m.f==='pct0'?'pct0':m.f,m.meta).replace(',0',''))}</span></th>`).join('')}</tr>`+
    OPER.map(l=>{const s=lojaStats(l.id), ML=METAS(l.id);return `<tr><td><b>${esc(l.nome)}</b></td>${ML.map(m=>{const v=s.vals[m.k];return `<td class="num" title="${esc(s.src[m.k]||'sem dado no mês')}"><span class="sem s-${status(m,v)}">${fmt(m.f,v)}</span></td>`}).join('')}</tr>`}).join('')+
    LOJAS.filter(l=>l.status==='inauguracao').map(l=>`<tr><td><b>${esc(l.nome)}</b></td><td colspan="${MR.length}" class="muted">Inauguração em ${esc(l.inauguracao||'data a definir')} — indicadores a partir do primeiro mês de operação</td></tr>`).join('');
  const rot=[['Diariamente','Vendas, pedidos, ticket, delivery e qualidade.'],['Semanalmente','Comp, Traffic, CMV, produtividade, absenteísmo e planos de ação.'],['Mensalmente','DRE, margem, turnover e desempenho dos gestores.']];
  $('#rotina').innerHTML = rot.map(r=>`<div class="card"><h3>${r[0]}</h3><p class="muted">${r[1]}</p></div>`).join('');
  $('#comp90').innerHTML = ['100% das lojas com painel gerencial','100% das lojas com checklist operacional','Planos de ação acompanhados','Evolução das lojas abaixo de R$ 500 mil','Melhorias verificáveis em produtividade, qualidade e margem'].map(t=>`<div class="tl"><span>${t}</span></div>`).join('');
  fillInd();
}
function fillInd(){
  const id=$('#imLoja').value; const r=IDX.im.get(id+'|'+S.mes)||{};
  [['#imPreparo','preparo'],['#imCancel','cancel'],['#imIfood','ifood'],['#imOnline','online'],['#imComp','comp'],['#imFolha','folha_valor']].forEach(([s,k])=>$(s).value=r[k]??'');
}
function initMetas(){
  $('#imLoja').innerHTML=optLojas(lojasEditaveis(true)); $('#imLoja').onchange=fillInd;
  $('#imSave').onclick=async()=>{
    const r={loja_id:$('#imLoja').value,mes:S.mes,preparo:num($('#imPreparo').value),cancel:num($('#imCancel').value),ifood:num($('#imIfood').value),online:num($('#imOnline').value),comp:num($('#imComp').value),folha_valor:num($('#imFolha').value)};
    if(!r.loja_id){toast('Selecione a loja.');return}
    if(r.ifood!=null&&(r.ifood<0||r.ifood>5)){toast('A nota iFood vai de 0 a 5.');return}
    if([r.cancel,r.online].some(v=>v!=null&&(v<0||v>100))){toast('Percentuais entre 0 e 100.');return}
    if(await dbw(sb.from('indicadores_mensais').upsert(r,{onConflict:'loja_id,mes'}),`Indicadores de ${mesTxt(S.mes)} salvos.`)){await load(['indicadores_mensais']);renderMetas()}
  };
}
