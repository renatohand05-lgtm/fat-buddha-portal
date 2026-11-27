/* =====================================================================
   CONEXÕES: iFood, vendas em tempo real, notas fiscais e contagem de estoque
   ===================================================================== */
FMTS.min = v => nf1.format(v).replace(',0','')+' min';
FMTS.nota = v => nf1.format(v);
FMTS.h = v => nf1.format(v).replace(',0','')+' h';
const pctS = (a,b) => b?a/b*100:null;

/* ---------------- iFood ---------------- */
const IF_CAMPOS = [['data','Data'],['loja','Loja'],['pedidos','Pedidos'],['faturamento','Faturamento'],['cancelados','Cancelados'],['valor_cancelado','Valor cancelado'],
  ['online_min','Minutos online'],['previsto_min','Minutos previstos'],['nota','Nota'],['avaliacoes','Avaliações'],['preparo_min','Preparo (min)'],['entrega_min','Entrega (min)'],
  ['atrasados','Pedidos atrasados'],['comissao','Comissão'],['taxas','Taxas'],['promocoes','Promoções'],['novos_clientes','Novos clientes']];
let ifSel = '';
function ifResumo(rs){
  const ped=sum(rs,r=>r.pedidos), fat=sum(rs,r=>r.faturamento), can=sum(rs,r=>r.cancelados);
  const on=rs.filter(r=>r.online_min!=null&&+r.previsto_min>0);
  const w=(f)=>{const v=rs.filter(r=>r[f]!=null&&+r.pedidos>0);const p=sum(v,r=>r.pedidos);return p?sum(v,r=>r[f]*r.pedidos)/p:null};
  const notas=rs.filter(r=>r.nota!=null);
  const custo=sum(rs,r=>(+r.comissao||0)+(+r.taxas||0)+(+r.promocoes||0));
  return {dias:rs.length,ped,fat,can,ticket:ped-can>0?fat/(ped-can):null,cancel:ped?can/(ped)*100:null,
    online:on.length?sum(on,r=>r.online_min)/sum(on,r=>r.previsto_min)*100:null, offH:on.length?Math.max(0,sum(on,r=>r.previsto_min)-sum(on,r=>r.online_min))/60:null,
    nota:notas.length?sum(notas,r=>r.nota*(+r.avaliacoes||1))/sum(notas,r=>+r.avaliacoes||1):null,
    preparo:w('preparo_min'), entrega:w('entrega_min'), atraso:ped&&rs.some(r=>r.atrasados!=null)?sum(rs,r=>r.atrasados)/ped*100:null,
    custo:fat&&custo?custo/fat*100:null, novos:rs.some(r=>r.novos_clientes!=null)?sum(rs,r=>r.novos_clientes):null};
}
function metaDe(k){const m=METAS(ifSel||null).find(x=>x.k===k);return m&&m.meta!=null?m:null}
function renderIfood(){
  const vis=LOJAS.filter(l=>l.status!=='fechada');
  $('#ifLoja').innerHTML='<option value="">Rede (todas as lojas)</option>'+optLojas(vis,ifSel);
  $('#ifLoja').onchange=()=>{ifSel=$('#ifLoja').value;renderIfood()};
  const todos=(S.db.ifood_diario||[]).filter(r=>ymOf(r.data)===S.mes);
  const rs=todos.filter(r=>!ifSel||r.loja_id===ifSel);
  const R=ifResumo(rs), lojas=uniq(todos.map(r=>r.loja_id));
  const delTot=sum((ifSel?[ifSel]:lojas),id=>lojaStats(id).del);
  $('#ifInfo').textContent=rs.length?`${R.dias} dias recebidos em ${mesLongo(S.mes)} · ${lojas.length} loja${lojas.length===1?'':'s'}`:'Nenhum dado do iFood neste mês';
  const mOn=metaDe('online'), mCa=metaDe('cancel'), mNo=metaDe('ifood'), mPr=metaDe('preparo');
  const bar=(v,m)=>m&&v!=null?(m.t==='max'?Math.max(0,Math.min(100,m.meta/v*100)):Math.min(100,v/m.meta*100)):null;
  $('#ifKpis').innerHTML=kpi('Faturamento iFood',rs.length?R.fat:null,'brlK',delTot&&rs.length?`${nf1.format(R.fat/delTot*100)}% do delivery do mês`:'no mês')+
    kpi('Pedidos',rs.length?R.ped:null,'int',R.ticket?`ticket médio R$ ${nf2.format(R.ticket)}`:'')+
    kpi('Tempo online',R.online,'pct1',R.offH!=null?`${nf1.format(R.offH).replace(',0','')} h fora do ar${mOn?' · meta '+nf1.format(mOn.meta).replace(',0','')+'%':''}`:'envie minutos online e previstos',bar(R.online,mOn))+
    kpi('Cancelamentos',R.cancel,'pct1',rs.length?`${nf0.format(R.can)} pedidos${mCa?' · meta até '+nf1.format(mCa.meta)+'%':''}`:'',bar(R.cancel,mCa));
  $('#ifKpis2').innerHTML=kpi('Nota da loja',R.nota,'nota',mNo?`meta ${nf1.format(mNo.meta)}`:'avaliação dos clientes',bar(R.nota,mNo))+
    kpi('Tempo de preparo',R.preparo,'min',mPr?`meta até ${nf1.format(mPr.meta).replace(',0','')} min`:'média ponderada',bar(R.preparo,mPr))+
    kpi('Pedidos atrasados',R.atraso,'pct1',R.entrega!=null?`entrega média ${nf1.format(R.entrega).replace(',0','')} min`:'dos pedidos')+
    kpi('Custo do iFood',R.custo,'pct1',R.custo!=null?'comissão + taxas + promoções':'envie comissão e taxas');
  animateKpis($('#ifKpis'));animateKpis($('#ifKpis2'));
  const dias=diasDoMes(S.mes).filter(d=>rs.some(r=>r.data===d));
  const porDia=d=>rs.filter(r=>r.data===d);
  if(dias.length){
    mk('cIfDia',{type:'bar',data:{labels:dias.map(d=>d.slice(8)),datasets:[{label:'Faturamento',data:dias.map(d=>sum(porDia(d),r=>r.faturamento)),backgroundColor:'rgba(229,48,63,.85)',borderRadius:6,yAxisID:'y'},
      {type:'line',label:'Pedidos',data:dias.map(d=>sum(porDia(d),r=>r.pedidos)),borderColor:C.gold,backgroundColor:C.gold,pointRadius:2,borderWidth:2,tension:.3,yAxisID:'y1'}]},
      options:{scales:{y:yR,y1:{position:'right',grid:{display:false},border:{display:false},ticks:{precision:0}},x:xG}}});
    const ls=ifSel?[ifSel]:lojas;
    mk('cIfOnline',{type:'line',data:{labels:dias.map(d=>d.slice(8)),datasets:ls.map((id,i)=>({label:lojaNome(id),data:dias.map(d=>{const r=rs.find(x=>x.loja_id===id&&x.data===d);return r&&+r.previsto_min?r.online_min/r.previsto_min*100:null}),borderColor:PAL[i%6],backgroundColor:PAL[i%6],pointRadius:2,borderWidth:2,tension:.3,spanGaps:true}))
      .concat(mOn?[{label:'Meta',data:dias.map(()=>mOn.meta),borderColor:'#ffffff',borderDash:[6,5],pointRadius:0,borderWidth:1.5}]:[])},options:{plugins:{tooltip:tipPct},scales:{y:Object.assign({},yPct,{suggestedMin:85,suggestedMax:100}),x:xG}}});
    mk('cIfCanc',{type:'bar',data:{labels:dias.map(d=>d.slice(8)),datasets:[{label:'Cancelamento',data:dias.map(d=>{const p=sum(porDia(d),r=>r.pedidos);return p?sum(porDia(d),r=>r.cancelados)/p*100:null}),backgroundColor:'rgba(242,179,61,.85)',borderRadius:5,yAxisID:'y'},
      {type:'line',label:'Nota',data:dias.map(d=>{const v=porDia(d).filter(r=>r.nota!=null);return v.length?sum(v,r=>r.nota)/v.length:null}),borderColor:C.green,backgroundColor:C.green,pointRadius:2,borderWidth:2,tension:.3,yAxisID:'y1',spanGaps:true}]},
      options:{plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+(c.dataset.yAxisID==='y'?nf1.format(c.parsed.y)+'%':nf1.format(c.parsed.y))}}},scales:{y:yPct,y1:{position:'right',min:3.5,max:5,grid:{display:false},border:{display:false},ticks:{callback:v=>nf1.format(v)}},x:xG}}});
  } else ['cIfDia','cIfOnline','cIfCanc'].forEach(c=>noData(c,'Sem dados do iFood no mês. Conecte a API ou importe o relatório.'));
  // pontos de atenção
  const at=[];
  lojas.filter(id=>!ifSel||id===ifSel).forEach(id=>{
    const r=ifResumo(todos.filter(x=>x.loja_id===id)), n=lojaNome(id);
    const mo=METAS(id).find(x=>x.k==='online'), mc=METAS(id).find(x=>x.k==='cancel'), mn=METAS(id).find(x=>x.k==='ifood'), mp=METAS(id).find(x=>x.k==='preparo');
    if(r.online!=null&&mo&&mo.meta!=null&&r.online<mo.meta) at.push(['bad',`${n} · tempo online ${nf1.format(r.online)}%`,`${nf1.format(r.offH).replace(',0','')} h fora do ar no mês · meta ${nf1.format(mo.meta).replace(',0','')}%`]);
    if(r.cancel!=null&&mc&&mc.meta!=null&&r.cancel>mc.meta) at.push(['bad',`${n} · cancelamento ${nf1.format(r.cancel)}%`,`${nf0.format(r.can)} pedidos cancelados · meta até ${nf1.format(mc.meta)}%`]);
    if(r.nota!=null&&mn&&mn.meta!=null&&r.nota<mn.meta) at.push(['warn',`${n} · nota ${nf1.format(r.nota)}`,`meta ${nf1.format(mn.meta)}`]);
    if(r.preparo!=null&&mp&&mp.meta!=null&&r.preparo>mp.meta) at.push(['warn',`${n} · preparo ${nf1.format(r.preparo).replace(',0','')} min`,`meta até ${nf1.format(mp.meta).replace(',0','')} min`]);
    const piorDia=todos.filter(x=>x.loja_id===id&&+x.previsto_min>0).map(x=>({d:x.data,p:x.online_min/x.previsto_min*100})).sort((a,b)=>a.p-b.p)[0];
    if(piorDia&&piorDia.p<90) at.push(['warn',`${n} · ${fmtD(piorDia.d)} com ${nf1.format(piorDia.p)}% online`,'pior dia do mês: vale checar queda de internet, tablet ou pausa no app']);
  });
  at.sort((a,b)=>(a[0]==='bad'?0:1)-(b[0]==='bad'?0:1));
  $('#ifAtencao').innerHTML=at.length?at.map(([c,t,d])=>`<div class="alert"><span class="dot" style="background:var(--${c==='bad'?'bad':'amber'})"></span><div><b>${esc(t)}</b><div class="small muted">${esc(d)}</div></div></div>`).join(''):`<div class="empty">${rs.length?'Nenhum indicador do iFood fora da meta.':'Sem dados no mês.'}</div>`;
  // comparativo
  $('#ifCompSub').textContent=mesLongo(S.mes);
  $('#tIfComp').innerHTML=lojas.length?`<tr><th>Loja</th><th class="num">Faturamento</th><th class="num">Pedidos</th><th class="num">Ticket</th><th class="num">Online</th><th class="num">Horas fora</th><th class="num">Cancel.</th><th class="num">Nota</th><th class="num">Preparo</th><th class="num">Atrasos</th><th class="num">Custo iFood</th><th class="num">Novos clientes</th></tr>`+
    lojas.map(id=>{const r=ifResumo(todos.filter(x=>x.loja_id===id));const st=(k,v)=>{const m=METAS(id).find(x=>x.k===k);return m&&m.meta!=null&&v!=null?`<span class="sem s-${status(m,v)}" style="min-width:0">`:'<span>'};
      return `<tr><td><b>${esc(lojaNome(id))}</b></td><td class="num">${brl(r.fat)}</td><td class="num">${nf0.format(r.ped)}</td><td class="num">${r.ticket?'R$ '+nf2.format(r.ticket):'—'}</td><td class="num">${st('online',r.online)}${r.online!=null?nf1.format(r.online)+'%':'—'}</span></td><td class="num">${r.offH!=null?nf1.format(r.offH).replace(',0','')+' h':'—'}</td><td class="num">${st('cancel',r.cancel)}${r.cancel!=null?nf1.format(r.cancel)+'%':'—'}</span></td><td class="num">${st('ifood',r.nota)}${r.nota!=null?nf1.format(r.nota):'—'}</span></td><td class="num">${st('preparo',r.preparo)}${r.preparo!=null?nf1.format(r.preparo).replace(',0','')+' min':'—'}</span></td><td class="num">${r.atraso!=null?nf1.format(r.atraso)+'%':'—'}</td><td class="num">${r.custo!=null?nf1.format(r.custo)+'%':'—'}</td><td class="num">${r.novos!=null?nf0.format(r.novos):'—'}</td></tr>`}).join('')
    :'<tr><td><div class="empty">Nenhuma loja com dados do iFood neste mês.</div></td></tr>';
  $('#tIfDias').innerHTML=rs.length?`<tr><th>Data</th><th>Loja</th><th class="num">Pedidos</th><th class="num">Faturamento</th><th class="num">Cancel.</th><th class="num">Online</th><th class="num">Nota</th><th class="num">Preparo</th><th>Origem</th><th></th></tr>`+
    rs.slice().sort((a,b)=>b.data.localeCompare(a.data)||a.loja_id.localeCompare(b.loja_id)).map(r=>`<tr><td>${fmtD(r.data)}</td><td>${esc(lojaNome(r.loja_id))}</td><td class="num">${r.pedidos??'—'}</td><td class="num">${brl(r.faturamento)}</td><td class="num">${r.cancelados??'—'}</td><td class="num">${+r.previsto_min?nf1.format(r.online_min/r.previsto_min*100)+'%':'—'}</td><td class="num">${r.nota!=null?nf1.format(r.nota):'—'}</td><td class="num">${r.preparo_min!=null?nf1.format(r.preparo_min).replace(',0',''):'—'}</td><td class="small muted">${r.origem==='api'?'API':r.origem==='csv'?'CSV':'manual'}</td><td class="num">${P.excluir(r.loja_id)?`<button class="btn sm" data-ifx="${r.id}">Excluir</button>`:''}</td></tr>`).join('')
    :'<tr><td><div class="empty">Nenhum dia recebido neste mês.</div></td></tr>';
  $('#tIfDias').querySelectorAll('[data-ifx]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este dia do iFood?'))return;if(await dbw(sb.from('ifood_diario').delete().eq('id',b.dataset.ifx),'Dia excluído.')){await load(['ifood_diario']);renderIfood()}});
}
function initIfood(){
  $('#ifModelo').onclick=()=>csv('modelo-ifood-fat-buddha.csv',[IF_CAMPOS.map(c=>c[1]),['2026-11-21','brooklyn','298','21540,50','5','312,90','690','720','4,7','41','15,5','38','9','2584,86','310,00','420,00','37']]);
  $('#ifExp').onclick=()=>csv('ifood-diario-fat-buddha.csv',[IF_CAMPOS.map(c=>c[1])].concat((S.db.ifood_diario||[]).map(r=>IF_CAMPOS.map(([k])=>k==='loja'?lojaNome(r.loja_id):r[k]))));
  $('#ifCsv').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
    const rows=parseCsv(await f.text());if(rows.length<2){toast('Arquivo vazio.');return}
    const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
    const cab=rows[0].map(norm), idx={};
    IF_CAMPOS.forEach(([k,n])=>{const i=cab.findIndex(c=>c===norm(n)||c===k);if(i>=0)idx[k]=i});
    if(idx.data==null||idx.loja==null){toast('O arquivo precisa das colunas Data e Loja (baixe o modelo).');return}
    const ok=[],erros=[];
    rows.slice(1).forEach((r,i)=>{try{
      const lv=norm(r[idx.loja]);const L=LOJAS.find(l=>l.id===lv||norm(l.nome)===lv||(l.ifood_merchant&&norm(l.ifood_merchant)===lv));if(!L)throw new Error('loja não encontrada');
      if(!P.editar(L.id))throw new Error('sem permissão para '+L.nome);
      const d=dataBR(r[idx.data]);if(!d)throw new Error('data inválida');
      const o={loja_id:L.id,data:d,origem:'csv'};
      IF_CAMPOS.slice(2).forEach(([k])=>{if(idx[k]!=null){const v=numBR(r[idx[k]]);o[k]=v==null?null:(['pedidos','cancelados','avaliacoes','atrasados','novos_clientes'].includes(k)?Math.round(v):v)}});
      ok.push(o)}catch(err){erros.push(`linha ${i+2}: ${err.message}`)}});
    if(!ok.length){toast('Nenhuma linha válida. '+(erros[0]||''));return}
    if(await dbw(sb.from('ifood_diario').upsert(ok,{onConflict:'loja_id,data'}),`${ok.length} dias importados${erros.length?` · ${erros.length} linhas ignoradas`:''}.`)){await load(['ifood_diario']);renderIfood()}};
}

/* ---------------- vendas em tempo real ---------------- */
let LIVE_CH=null, LIVE_T=null;
async function liveRender(el, ids, canvasId){
  if(!el) return;
  if(!ids.length){el.innerHTML='';return}
  const hoje=isoHoje();
  let {data:ps,error}=await sb.from('pedidos_tempo_real').select('id,loja_id,data_hora,data,hora,canal,plataforma,valor,status,demo').in('loja_id',ids).eq('data',hoje).order('data_hora',{ascending:false}).limit(5000);
  if(error){el.innerHTML='';return}
  let dia=hoje;
  if(!ps.length){
    const {data:ult}=await sb.from('pedidos_tempo_real').select('data').in('loja_id',ids).order('data',{ascending:false}).limit(1);
    if(!ult||!ult.length){
      el.innerHTML=P.gestor?`<div class="card live live-off" style="margin-bottom:16px"><div class="live-h"><span class="live-dot off"></span><b>Vendas em tempo real</b><span class="small muted">nenhum pedido recebido ainda · conecte o portal de vendas em Configurações › Integrações</span></div></div>`:'';return}
    dia=ult[0].data;
    ({data:ps}=await sb.from('pedidos_tempo_real').select('id,loja_id,data_hora,data,hora,canal,plataforma,valor,status,demo').in('loja_id',ids).eq('data',dia).order('data_hora',{ascending:false}).limit(5000));
  }
  const ok=ps.filter(p=>p.status==='concluido'), canc=ps.length-ok.length;
  const tot=sum(ok,p=>p.valor), sal=sum(ok.filter(p=>p.canal==='salao'),p=>p.valor), del=tot-sal;
  const ult=ps[0], minAtras=ult?Math.round((Date.now()-new Date(ult.data_hora).getTime())/6e4):null;
  const aoVivo=dia===hoje;
  const horas=[...Array(24).keys()].filter(h=>ok.some(p=>p.hora===h)||(aoVivo&&h<=new Date().getHours()&&h>=Math.min(...ok.map(p=>p.hora).concat([new Date().getHours()]))));
  const metaD=ids.length===1?metaDiaLoja(ids[0],dia):sum(ids,id=>metaDiaLoja(id,dia)||0)||null;
  el.innerHTML=`<div class="card live" style="margin-bottom:16px">
    <div class="live-h"><span class="live-dot ${aoVivo?'':'off'}"></span><b>Vendas em tempo real</b><span class="small muted">${aoVivo?'hoje':'último dia recebido: '+fmtD(dia)} · ${ids.length===1?esc(lojaNome(ids[0])):ids.length+' lojas'}${ult?` · último pedido ${minAtras<1?'agora':minAtras<60?'há '+minAtras+' min':'às '+new Date(ult.data_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`:''}${ps.some(p=>p.demo)?' · demonstração':''}</span></div>
    <div class="live-g">
      <div class="live-k"><div><span>Vendido</span><b>${brl(tot)}</b>${metaD?`<em>${nf0.format(tot/metaD*100)}% da meta do dia (${brl(metaD)})</em>`:''}</div>
        <div><span>Pedidos</span><b>${nf0.format(ok.length)}</b><em>ticket ${ok.length?'R$ '+nf2.format(tot/ok.length):'—'}${canc?` · ${canc} cancelado${canc>1?'s':''}`:''}</em></div>
        <div><span>Salão · Delivery</span><b>${tot?nf0.format(sal/tot*100):0}% · ${tot?nf0.format(del/tot*100):0}%</b><em>${brl(sal)} · ${brl(del)}</em></div></div>
      <div class="chart" style="height:150px"><canvas id="${canvasId}"></canvas></div>
      <div class="live-list">${ps.slice(0,6).map(p=>`<div><span>${new Date(p.data_hora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span><span>${esc(ids.length>1?lojaNome(p.loja_id):(p.plataforma||(p.canal==='salao'?'Salão':'Delivery')))}</span><b class="${p.status==='cancelado'?'down':''}">${p.status==='cancelado'?'cancelado':brl(p.valor)}</b></div>`).join('')}</div>
    </div></div>`;
  mk(canvasId,{type:'bar',data:{labels:horas.map(h=>h+'h'),datasets:[{label:'Salão',data:horas.map(h=>sum(ok.filter(p=>p.hora===h&&p.canal==='salao'),p=>p.valor)),backgroundColor:C.gold,borderRadius:4,stack:'s'},{label:'Delivery',data:horas.map(h=>sum(ok.filter(p=>p.hora===h&&p.canal==='delivery'),p=>p.valor)),backgroundColor:C.red,borderRadius:4,stack:'s'}]},
    options:{animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+brl(c.parsed.y)}}},scales:{y:{stacked:true,grid:{color:C.grid},border:{display:false},ticks:{callback:v=>brlK(v),maxTicksLimit:4}},x:Object.assign({stacked:true},xG)}}});
}
function liveAtualizar(){
  if(S.tab==='loja'&&typeof mlSel!=='undefined'&&mlSel) liveRender($('#mlLive'),[mlSel],'cLiveL');
  else if(S.tab==='geral') liveRender($('#gLive'),OPER.map(l=>l.id).filter(id=>P.veTudo||S.minhas.includes(id)),'cLiveG');
}
function liveLigar(){
  if(LIVE_CH||!P.papel||P.papel==='colaborador') return;
  LIVE_CH=sb.channel('pedidos-tr').on('postgres_changes',{event:'*',schema:'public',table:'pedidos_tempo_real'},()=>{clearTimeout(LIVE_T);LIVE_T=setTimeout(liveAtualizar,1200)}).subscribe();
  setInterval(()=>{if(document.visibilityState==='visible')liveAtualizar()},60000);
}

/* ---------------- notas fiscais ---------------- */
const CAT_NF = {cmv:'Insumos (CMV)',cdel:'Custos de delivery e embalagens',man:'Manutenção',mkt:'Marketing, royalties e escritório',cto:'Ocupação (aluguel, condomínio, IPTU)',agua:'Água',energia:'Energia',outros:'Outras despesas',ignorar:'Não entra no resultado'};
const CAT_DRE = ['cdel','man','mkt','cto','agua','energia'];
let nfSel='*';
const nfEdita = l => l?P.editar(l):P.editaCC;
const lojaNf = l => l?lojaNome(l):'Cozinha central';
function nfDoMes(){return (S.db.notas_fiscais||[]).filter(n=>n.competencia===S.mes)}
function renderNotas(){
  $('#nfLoja').innerHTML=`<option value="*">${P.veTudo||P.editaCC?'Todas as lojas e a cozinha central':'Todas as minhas lojas'}</option>${P.veTudo||P.editaCC?'<option value="cc">Cozinha central</option>':''}`+optLojas(LOJAS.filter(l=>P.veTudo||S.minhas.includes(l.id)),nfSel);
  $('#nfLoja').value=nfSel;
  const all=nfDoMes(), st=$('#nfSt').value, q=$('#nfBusca').value.trim().toLowerCase();
  const fl=all.filter(n=>(nfSel==='*'||(nfSel==='cc'?!n.loja_id:n.loja_id===nfSel)));
  const lista=fl.filter(n=>(!st||n.status===st)&&(!q||[n.fornecedor_nome,n.numero,n.fornecedor_cnpj,n.chave].some(x=>String(x||'').toLowerCase().includes(q))));
  const val=fl.filter(n=>n.categoria!=='ignorar'), tot=sum(val,n=>n.valor_total), pend=fl.filter(n=>n.status==='pendente');
  const forn={};val.forEach(n=>{const k=n.fornecedor_nome;forn[k]=(forn[k]||0)+ +n.valor_total});const top=Object.entries(forn).sort((a,b)=>b[1]-a[1]);
  $('#nfKpis').innerHTML=kpi('Compras no mês',fl.length?tot:null,'brlK',`${fl.length} nota${fl.length===1?'':'s'} · ${mesLongo(S.mes)}`)+
    kpi('Insumos (CMV)',fl.length?sum(val.filter(n=>n.categoria==='cmv'),n=>n.valor_total):null,'brlK','vão para as compras da contagem semanal')+
    kpi('Despesas para o DRE',fl.length?sum(val.filter(n=>CAT_DRE.includes(n.categoria)),n=>n.valor_total):null,'brlK','manutenção, ocupação, utilidades, marketing, delivery')+
    kpi('Sem categoria',fl.length?pend.length:null,'int',pend.length?`${brl(sum(pend,n=>n.valor_total))} aguardando classificação`:'todas classificadas');
  animateKpis($('#nfKpis'));
  const cats=Object.keys(CAT_NF).filter(k=>k!=='ignorar'&&val.some(n=>n.categoria===k)), semCat=sum(pend,n=>n.valor_total);
  $('#nfCatSub').textContent=mesLongo(S.mes);
  if(cats.length||semCat) mk('cNfCat',{type:'doughnut',data:{labels:cats.map(k=>CAT_NF[k]).concat(semCat?['Sem categoria']:[]),datasets:[{data:cats.map(k=>sum(val.filter(n=>n.categoria===k),n=>n.valor_total)).concat(semCat?[semCat]:[]),backgroundColor:PAL.concat(['#7c6f66','#a16207','#4b5563']),borderWidth:0}]},options:{cutout:'62%',plugins:{legend:{position:'right'},tooltip:{callbacks:{label:c=>' '+c.label+': '+brl(c.parsed)}}}}});
  else noData('cNfCat','Nenhuma nota no mês.');
  if(top.length) mk('cNfForn',{type:'bar',data:{labels:top.slice(0,8).map(t=>t[0].length>28?t[0].slice(0,27)+'…':t[0]),datasets:[{label:'Compras',data:top.slice(0,8).map(t=>t[1]),backgroundColor:'rgba(229,48,63,.85)',borderRadius:6}]},options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+brl(c.parsed.x)}}},scales:{x:{grid:{color:C.grid},border:{display:false},ticks:{callback:v=>brlK(v)}},y:{grid:{display:false},border:{display:false}}}}});
  else noData('cNfForn','Nenhuma nota no mês.');
  // resumo DRE
  const lojasN=uniq(all.filter(n=>n.loja_id).map(n=>n.loja_id)).filter(id=>nfSel==='*'||nfSel===id);
  const cel=(id,k)=>sum(all.filter(n=>n.loja_id===id&&n.categoria===k),n=>n.valor_total);
  $('#tNfDre').innerHTML=lojasN.length?`<tr><th>Loja</th>${['cmv'].concat(CAT_DRE).map(k=>`<th class="num">${CAT_NF[k]}</th>`).join('')}<th class="num">Já no DRE?</th></tr>`+
    lojasN.map(id=>`<tr><td><b>${esc(lojaNome(id))}</b></td>${['cmv'].concat(CAT_DRE).map(k=>{const v=cel(id,k);return `<td class="num ${k==='cmv'?'muted':''}">${v?brl(v):'—'}</td>`}).join('')}<td class="num small">${(()=>{const ks=CAT_DRE.filter(k=>cel(id,k));if(!ks.length)return '—';const n=ks.filter(k=>{const r=IDX.dl.get(id+'|'+S.mes+'|'+k);return r&&Math.abs(r.valor-cel(id,k))<1}).length;return `<span class="sem s-${n===ks.length?'ok':n?'warn':'neu'}" style="min-width:0">${n} de ${ks.length} linhas</span>`})()}</td></tr>`).join('')
    :'<tr><td><div class="empty">Nenhuma nota de loja classificada no mês.</div></td></tr>';
  // lista
  $('#nfListSub').textContent=`${lista.length} de ${fl.length} · ${mesLongo(S.mes)}`;
  const catSel=n=>nfEdita(n.loja_id)?`<select class="inp" data-nfc="${n.id}" style="min-width:170px;padding:6px 8px">${n.categoria?'':'<option value="">Escolha…</option>'}${Object.entries(CAT_NF).map(([k,v])=>`<option value="${k}" ${n.categoria===k?'selected':''}>${v}</option>`).join('')}</select>`:esc(CAT_NF[n.categoria]||'Sem categoria');
  $('#tNf').innerHTML=lista.length?`<tr><th>Emissão</th><th>Nº</th><th>Fornecedor</th><th>Destino</th><th class="num">Valor</th><th>Categoria do DRE</th><th>Origem</th><th></th></tr>`+
    lista.slice().sort((a,b)=>b.emissao.localeCompare(a.emissao)||b.id-a.id).map(n=>`<tr class="${n.status==='pendente'?'nf-pend':''}"><td>${fmtD(n.emissao)}</td><td>${esc(n.numero||'—')}${n.serie?`<span class="small muted">/${esc(n.serie)}</span>`:''}</td><td style="white-space:normal;min-width:180px"><b>${esc(n.fornecedor_nome)}</b><div class="small muted">${n.fornecedor_cnpj?fmtCnpj(n.fornecedor_cnpj):''}</div></td><td>${esc(lojaNf(n.loja_id))}</td><td class="num"><b>${brl(n.valor_total)}</b></td><td>${catSel(n)}</td><td class="small muted">${({'api':'API','api-xml':'API (XML)','xml':'XML','manual':'manual'})[n.origem]||esc(n.origem)}</td><td class="num"><button class="btn sm" data-nfi="${n.id}">Itens</button> ${(n.loja_id?P.excluir(n.loja_id):P.gestor)?`<button class="btn sm" data-nfx="${n.id}">Excluir</button>`:''}</td></tr>`).join('')
    :`<tr><td><div class="empty">${fl.length?'Nenhuma nota com esse filtro.':'Nenhuma nota neste mês. Importe os XML ou conecte o sistema de notas em Configurações › Integrações.'}</div></td></tr>`;
  $('#tNf').querySelectorAll('[data-nfc]').forEach(s=>s.onchange=async()=>{const n=all.find(x=>x.id==s.dataset.nfc);const cat=s.value||null;
    if(await dbw(sb.from('notas_fiscais').update({categoria:cat}).eq('id',n.id),'Categoria salva.')){
      const regras=S.db.nf_regras||[];
      if(cat&&P.gestor&&n.fornecedor_cnpj&&!regras.some(r=>r.cnpj&&r.cnpj.replace(/\D/g,'')===n.fornecedor_cnpj)&&confirm(`Classificar automaticamente as próximas notas de ${n.fornecedor_nome} como "${CAT_NF[cat]}"?`)){
        await dbw(sb.from('nf_regras').insert({cnpj:n.fornecedor_cnpj,categoria:cat}),'Regra criada.');await sb.rpc('nf_aplicar_regras')}
      await load(['notas_fiscais','nf_regras']);renderNotas()}});
  $('#tNf').querySelectorAll('[data-nfx]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta nota e os itens dela?'))return;if(await dbw(sb.from('notas_fiscais').delete().eq('id',b.dataset.nfx),'Nota excluída.')){await load(['notas_fiscais']);renderNotas()}});
  $('#tNf').querySelectorAll('[data-nfi]').forEach(b=>b.onclick=()=>nfItens(all.find(x=>x.id==b.dataset.nfi)));
  // regras
  const rg=S.db.nf_regras||[];
  $('#tNfReg').innerHTML=rg.length?`<tr><th>Fornecedor</th><th>Categoria</th><th></th></tr>`+rg.map(r=>`<tr><td>${r.cnpj?`CNPJ ${fmtCnpj(r.cnpj)}`:`nome contém "${esc(r.termo)}"`}${r.cnpj?`<span class="small muted"> · ${esc(((S.db.notas_fiscais||[]).find(n=>n.fornecedor_cnpj===r.cnpj.replace(/\D/g,''))||{}).fornecedor_nome||'')}</span>`:''}</td><td>${esc(CAT_NF[r.categoria])}</td><td class="num">${P.gestor?`<button class="btn sm" data-nrx="${r.id}">Excluir</button>`:''}</td></tr>`).join('')
    :'<tr><td><div class="empty">Nenhuma regra. Ao classificar uma nota, o portal oferece criar a regra do fornecedor.</div></td></tr>';
  $('#tNfReg').querySelectorAll('[data-nrx]').forEach(b=>b.onclick=async()=>{if(await dbw(sb.from('nf_regras').delete().eq('id',b.dataset.nrx),'Regra excluída.')){await load(['nf_regras']);renderNotas()}});
}
const fmtCnpj = c => {c=String(c||'').replace(/\D/g,'');return c.length===14?c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):c};
async function nfItens(n){
  const {data:its}=await sb.from('notas_itens').select('*').eq('nota_id',n.id).order('n');
  modal(`<h3>${esc(n.fornecedor_nome)} <small>NF ${esc(n.numero||'—')} · ${fmtD(n.emissao)}</small></h3>
    <div class="metas-list"><div><span>Destino</span><b>${esc(lojaNf(n.loja_id))}</b></div><div><span>Valor da nota</span><b>${brl(n.valor_total)}</b></div>${n.chave&&/^\d{44}$/.test(n.chave)?`<div><span>Chave de acesso</span><b class="small" style="user-select:all;word-break:break-all">${n.chave}</b></div>`:''}${+n.frete||+n.desconto?`<div><span>Frete · desconto</span><b>${brl(n.frete)} · ${brl(n.desconto)}</b></div>`:''}</div>
    <div class="tbl-wrap mt" style="max-height:340px;overflow:auto"><table>${(its||[]).length?`<tr><th>Item</th><th class="num">Qtde</th><th>Un.</th><th class="num">Unitário</th><th class="num">Total</th></tr>`+its.map(i=>`<tr><td style="white-space:normal">${esc(i.descricao)}<div class="small muted">${esc(i.codigo||'')}${i.ncm?' · NCM '+esc(i.ncm):''}</div></td><td class="num">${i.quantidade!=null?nf2.format(i.quantidade).replace(',00',''):'—'}</td><td>${esc(i.unidade||'')}</td><td class="num">${i.valor_unit!=null?'R$ '+nf2.format(i.valor_unit):'—'}</td><td class="num">${brl(i.valor_total)}</td></tr>`).join(''):'<tr><td><div class="empty">Nota sem itens detalhados.</div></td></tr>'}</table></div>
    <div class="actions mt"><button class="btn pri" id="nfiOk">Fechar</button></div>`,el=>el.querySelector('#nfiOk').onclick=fecharModal);
}
function lerXmlNfeBrowser(txt){
  const d=new DOMParser().parseFromString(txt,'application/xml');
  if(d.getElementsByTagName('parsererror').length) throw new Error('XML inválido');
  const T=(el,t)=>{const x=el&&el.getElementsByTagNameNS('*',t)[0];return x?x.textContent.trim():''};
  const inf=d.getElementsByTagNameNS('*','infNFe')[0]; if(!inf) throw new Error('não é uma NF-e');
  const chave=(inf.getAttribute('Id')||'').replace(/\D/g,''); if(chave.length!==44) throw new Error('chave de acesso não encontrada');
  const ide=d.getElementsByTagNameNS('*','ide')[0], emit=d.getElementsByTagNameNS('*','emit')[0], dest=d.getElementsByTagNameNS('*','dest')[0], tot=d.getElementsByTagNameNS('*','ICMSTot')[0];
  const n=(el,t)=>{const v=T(el,t);return v===''?null:+v};
  return {chave,numero:T(ide,'nNF'),serie:T(ide,'serie'),emissao:(T(ide,'dhEmi')||T(ide,'dEmi')).slice(0,10),fornecedor_cnpj:T(emit,'CNPJ')||T(emit,'CPF'),fornecedor_nome:T(emit,'xNome'),dest:T(dest,'CNPJ'),
    valor_produtos:n(tot,'vProd'),frete:n(tot,'vFrete')||0,desconto:n(tot,'vDesc')||0,outras:n(tot,'vOutro')||0,valor_total:n(tot,'vNF'),
    itens:[...d.getElementsByTagNameNS('*','det')].map((det,i)=>{const p=det.getElementsByTagNameNS('*','prod')[0];return {n:i+1,codigo:T(p,'cProd'),descricao:T(p,'xProd'),ncm:T(p,'NCM'),cfop:T(p,'CFOP'),unidade:T(p,'uCom'),quantidade:n(p,'qCom'),valor_unit:n(p,'vUnCom'),valor_total:n(p,'vProd')}})};
}
async function gravarNota(o,itens){
  const {data,error}=await sb.from('notas_fiscais').upsert(o,{onConflict:'chave'}).select('id').single();
  if(error) throw new Error(error.message);
  await sb.from('notas_itens').delete().eq('nota_id',data.id);
  if(itens&&itens.length){const {error:e2}=await sb.from('notas_itens').insert(itens.map(i=>Object.assign({},i,{nota_id:data.id})));if(e2) throw new Error(e2.message)}
  return data.id;
}
function initNotas(){
  $('#nrCat').innerHTML=Object.entries(CAT_NF).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
  $('#nfLoja').onchange=()=>{nfSel=$('#nfLoja').value;renderNotas()};
  $('#nfSt').onchange=renderNotas; $('#nfBusca').oninput=()=>{clearTimeout($('#nfBusca')._t);$('#nfBusca')._t=setTimeout(renderNotas,250)};
  $$('.only-nf').forEach(e=>e.classList.toggle('hidden',!(P.editaCC||lojasEditaveis().length)));
  $('#nfXml').onchange=async e=>{const fs=[...e.target.files];e.target.value='';if(!fs.length)return;
    const lidas=[],erros=[];
    for(const f of fs){try{lidas.push(Object.assign(lerXmlNfeBrowser(await f.text()),{arq:f.name}))}catch(err){erros.push(`${f.name}: ${err.message}`)}}
    if(!lidas.length){toast('Nenhuma NF-e válida. '+(erros[0]||''));return}
    const dest=['cc'].filter(()=>P.editaCC).map(v=>[v,'Cozinha central']).concat(lojasEditaveis().map(l=>[l.id,l.nome]));
    const auto=x=>{const l=LOJAS.find(l=>l.cnpj&&l.cnpj.replace(/\D/g,'')===x.dest);return l&&nfEdita(l.id)?l.id:null};
    modal(`<h3>Importar ${lidas.length} nota${lidas.length>1?'s':''} fiscal${lidas.length>1?'is':''}</h3>
      <div class="tbl-wrap" style="max-height:320px;overflow:auto"><table><tr><th>Fornecedor</th><th>Emissão</th><th class="num">Valor</th><th>Destino</th></tr>${lidas.map((x,i)=>`<tr><td style="white-space:normal">${esc(x.fornecedor_nome)}<div class="small muted">NF ${esc(x.numero)} · ${x.itens.length} itens</div></td><td>${fmtD(x.emissao)}</td><td class="num">${brl(x.valor_total)}</td><td><select class="inp" data-dst="${i}" style="padding:6px 8px">${dest.map(([v,t])=>`<option value="${v}" ${(auto(x)||dest[0][0])===v?'selected':''}>${esc(t)}${auto(x)===v?' (CNPJ)':''}</option>`).join('')}</select></td></tr>`).join('')}</table></div>
      ${erros.length?`<p class="small" style="color:#ffb0b6;margin-top:8px">${erros.map(esc).join('<br>')}</p>`:''}
      <p class="small muted mt">A loja é reconhecida pelo CNPJ do destinatário quando ele está cadastrado em Configurações › Lojas. A categoria do DRE segue as regras de fornecedor.</p>
      <div class="actions mt"><button class="btn" id="nxNo">Cancelar</button><button class="btn pri" id="nxOk">Importar</button></div>`,el=>{
      el.querySelector('#nxNo').onclick=fecharModal;
      el.querySelector('#nxOk').onclick=async()=>{const sel=[...el.querySelectorAll('[data-dst]')].map(s=>s.value);fecharModal();busy(true);let ok=0;const fal=[];
        for(let i=0;i<lidas.length;i++){const x=lidas[i];try{await gravarNota({loja_id:sel[i]==='cc'?null:sel[i],chave:x.chave,numero:x.numero,serie:x.serie,emissao:x.emissao,fornecedor_cnpj:x.fornecedor_cnpj,fornecedor_nome:x.fornecedor_nome,valor_produtos:x.valor_produtos,frete:x.frete,desconto:x.desconto,outras:x.outras,valor_total:x.valor_total,origem:'xml'},x.itens);ok++}catch(err){fal.push(x.arq+': '+err.message)}}
        busy(false);toast(`${ok} nota${ok===1?'':'s'} importada${ok===1?'':'s'}${fal.length?` · ${fal.length} com erro: ${fal[0]}`:''}.`);
        await load(['notas_fiscais']);const m=lidas[0]&&lidas[0].emissao.slice(0,7);if(m&&m!==S.mes&&ok){S.mes=m;$('#pMonth').value=m}renderNotas()}});
  };
  $('#nfNova').onclick=()=>{const dest=['cc'].filter(()=>P.editaCC).map(v=>[v,'Cozinha central']).concat(lojasEditaveis().map(l=>[l.id,l.nome]));
    modal(`<h3>Lançar nota fiscal</h3><div class="form-row" style="grid-template-columns:1fr 1fr">
      <label class="f">Destino<select class="inp" id="nnL">${dest.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}</select></label>
      <label class="f">Emissão<input class="inp" type="date" id="nnD" value="${isoHoje()}"></label>
      <label class="f">Fornecedor<input class="inp" id="nnF"></label><label class="f">CNPJ do fornecedor<input class="inp" id="nnC" placeholder="só números"></label>
      <label class="f">Número<input class="inp" id="nnN"></label><label class="f">Valor total<div class="inwrap"><input class="inp" type="number" step="0.01" id="nnV"><em>R$</em></div></label>
      <label class="f" style="grid-column:span 2">Categoria do DRE<select class="inp" id="nnCat"><option value="">Pelas regras do fornecedor</option>${Object.entries(CAT_NF).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label></div>
      <div class="actions mt"><button class="btn" id="nnNo">Cancelar</button><button class="btn pri" id="nnOk">Salvar</button></div>`,el=>{
      el.querySelector('#nnNo').onclick=fecharModal;
      el.querySelector('#nnOk').onclick=async()=>{const f=el.querySelector('#nnF').value.trim(),nn=el.querySelector('#nnN').value.trim(),v=+el.querySelector('#nnV').value,c=el.querySelector('#nnC').value.replace(/\D/g,''),d=el.querySelector('#nnD').value;
        if(!f||!nn||!v||!d){toast('Informe fornecedor, número, data e valor.');return}
        const l=el.querySelector('#nnL').value;fecharModal();busy(true);
        try{await gravarNota({loja_id:l==='cc'?null:l,chave:`${c||f.toLowerCase().replace(/\W+/g,'')}-${nn}-0`,numero:nn,emissao:d,fornecedor_cnpj:c||null,fornecedor_nome:f,valor_total:v,categoria:el.querySelector('#nnCat').value||null,origem:'manual'});toast('Nota lançada.')}catch(err){toast('Não foi possível salvar: '+err.message)}
        busy(false);await load(['notas_fiscais']);renderNotas()}});
  };
  $('#nfCsv').onclick=()=>csv(`notas-fiscais-${S.mes}.csv`,[['Emissão','Número','Série','Fornecedor','CNPJ','Destino','Valor','Categoria','Competência','Chave','Origem']].concat(nfDoMes().map(n=>[n.emissao,n.numero,n.serie,n.fornecedor_nome,n.fornecedor_cnpj,lojaNf(n.loja_id),n.valor_total,CAT_NF[n.categoria]||'Sem categoria',n.competencia,n.chave,n.origem])));
  $('#nrAdd').onclick=async()=>{const c=$('#nrCnpj').value.replace(/\D/g,''),t=$('#nrTermo').value.trim();if(!c&&!t){toast('Informe o CNPJ ou parte do nome do fornecedor.');return}
    if(await dbw(sb.from('nf_regras').insert({cnpj:c||null,termo:c?null:t,categoria:$('#nrCat').value}),'Regra criada.')){$('#nrCnpj').value='';$('#nrTermo').value='';const {data}=await sb.rpc('nf_aplicar_regras');if(data)toast(`Regra criada · ${data} nota${data>1?'s':''} classificada${data>1?'s':''}.`);await load(['nf_regras','notas_fiscais']);renderNotas()}};
  $('#nrAplicar').onclick=async()=>{busy(true);const {data,error}=await sb.rpc('nf_aplicar_regras');busy(false);if(error){toast(error.message);return}toast(data?`${data} nota${data>1?'s':''} classificada${data>1?'s':''}.`:'Nenhuma nota pendente bate com as regras.');await load(['notas_fiscais']);renderNotas()};
  $('#nfLancar').onclick=()=>{const all=nfDoMes().filter(n=>n.loja_id&&CAT_DRE.includes(n.categoria));
    if(!all.length){toast('Nenhuma despesa classificada para lançar neste mês.');return}
    const cats=CAT_DRE.filter(k=>all.some(n=>n.categoria===k)), padrao=['agua','energia','man'];
    modal(`<h3>Lançar notas no DRE · ${mesLongo(S.mes)}</h3>
      <p class="small muted">O total das notas de cada linha substitui o valor estimado (ou lançado) da linha no DRE de cada loja. Marque só as linhas em que as notas cobrem o custo inteiro: comissões do iFood, aluguel e royalties, por exemplo, normalmente não vêm em nota fiscal.</p>
      <div class="chk mt" style="flex-direction:column;align-items:stretch">${cats.map(k=>`<label><input type="checkbox" value="${k}" ${padrao.includes(k)?'checked':''}> <b style="margin-right:auto">${CAT_NF[k]}</b> <span class="muted">${brl(sum(all.filter(n=>n.categoria===k),n=>n.valor_total))}</span></label>`).join('')}</div>
      <div class="actions mt"><button class="btn" id="ndNo">Cancelar</button><button class="btn pri" id="ndOk">Lançar no DRE</button></div>`,el=>{
      el.querySelector('#ndNo').onclick=fecharModal;
      el.querySelector('#ndOk').onclick=async()=>{const sel=[...el.querySelectorAll('input:checked')].map(i=>i.value);if(!sel.length){toast('Marque ao menos uma linha.');return}
        const linhas=[];uniq(all.map(n=>n.loja_id)).forEach(id=>sel.forEach(k=>{const ns=all.filter(n=>n.loja_id===id&&n.categoria===k);if(ns.length)linhas.push({loja_id:id,mes:S.mes,linha:k,valor:Math.round(sum(ns,n=>n.valor_total)*100)/100,obs:`Notas fiscais (${ns.length})`})}));
        fecharModal();
        if(await dbw(sb.from('dre_lancamentos').upsert(linhas,{onConflict:'loja_id,mes,linha'}),`${linhas.length} linhas lançadas no DRE.`)){await load(['dre_lancamentos']);renderNotas()}}});
  };
}
/* compras da semana pelas notas (sugestão na contagem de CMV) */
function comprasNfSemana(loja,semana){
  if(!loja||!semana) return null;
  const fim=addDia(semana,6);
  const ns=(S.db.notas_fiscais||[]).filter(n=>n.loja_id===loja&&n.categoria==='cmv'&&n.emissao>=semana&&n.emissao<=fim);
  return ns.length?{v:sum(ns,n=>n.valor_total),n:ns.length}:null;
}

/* ---------------- contagem de estoque (cozinha central) ---------------- */
const limGlobal = () => {const v=cfg('contagem_limite');return v==null?10:+v};
const limItem = i => i.limite_div!=null?+i.limite_div:limGlobal();
let CT_RASC={};
function ccCont(){
  const es=(S.db.estoque_cc||[]).slice().sort((a,b)=>a.item.localeCompare(b.item));
  const hist=S.db.contagens_estoque||[], mesH=hist.filter(c=>Date.now()-new Date(c.created_at)<30*864e5);
  const div=hist.filter(c=>Math.abs(c.diferenca)>c.limite), pend=div.filter(c=>!c.revisado_em);
  const custo=Object.fromEntries(es.map(i=>[i.item,+i.custo||0]));
  $('#ctKpis').innerHTML=kpi('Itens contados',mesH.length,'int',`${uniq(mesH.map(c=>c.created_at.slice(0,10))).length} contagens nos últimos 30 dias`)+
    kpi('Divergências (30 dias)',mesH.filter(c=>Math.abs(c.diferenca)>c.limite).length,'int',`acima de ${nf0.format(limGlobal())} un. (ou do limite do item)`)+
    kpi('Aguardando revisão',pend.length,'int','divergências justificadas que o gestor ainda não revisou')+
    kpi('Valor das diferenças',mesH.length?sum(mesH,c=>c.diferenca*(custo[c.item]||0)):null,'brl','sobra (+) ou falta (−) em 30 dias, a custo');
  animateKpis($('#ctKpis'));
  $('#ctLim').value=limGlobal(); $('#ctSub').textContent=`${es.length} itens · limite padrão ${nf0.format(limGlobal())} un.`;
  const linha=i=>{const v=CT_RASC[i.id];const c=v&&v.c!==''?+v.c:null;const d=c==null?null:c-i.atual;const bloq=d!=null&&Math.abs(d)>limItem(i);
    return `<tr data-ct="${i.id}" class="${bloq?'ct-bloq':''}"><td><b>${esc(i.item)}</b></td><td>${esc(i.un)}</td><td class="num">${nf1.format(i.atual).replace(',0','')}</td>
      <td class="num"><input class="inp ct-c" type="number" min="0" step="0.1" style="width:100px;padding:6px 8px;text-align:right" value="${v?esc(v.c):''}" placeholder="—"></td>
      <td class="num ct-d">${d==null?'<span class="muted">—</span>':`<span class="sem s-${bloq?'bad':Math.abs(d)>0?'warn':'ok'}" style="min-width:0">${d>0?'+':''}${nf1.format(d).replace(',0','')}</span>`}</td>
      <td class="num muted">${nf0.format(limItem(i))}</td>
      <td><input class="inp ct-j" style="min-width:220px;padding:6px 8px;${bloq?'':'display:none'}" placeholder="Motivo da divergência (obrigatório)" value="${v&&v.j?esc(v.j):''}"></td></tr>`};
  $('#tCtNova').innerHTML=es.length?`<tr><th>Item</th><th>Un.</th><th class="num">No sistema</th><th class="num">Contado</th><th class="num">Diferença</th><th class="num">Limite</th><th>Justificativa</th></tr>`+es.map(linha).join('')
    :'<tr><td><div class="empty">Cadastre os itens no Estoque da cozinha central primeiro.</div></td></tr>';
  $('#tCtNova').querySelectorAll('tr[data-ct]').forEach(tr=>{const id=tr.dataset.ct, i=es.find(x=>x.id==id);
    const c=tr.querySelector('.ct-c'), j=tr.querySelector('.ct-j'), dd=tr.querySelector('.ct-d');
    const upd=()=>{CT_RASC[id]={c:c.value,j:j.value};const v=c.value===''?null:+c.value;const d=v==null?null:v-i.atual;const bloq=d!=null&&Math.abs(d)>limItem(i);
      tr.classList.toggle('ct-bloq',bloq);j.style.display=bloq?'':'none';
      dd.innerHTML=d==null?'<span class="muted">—</span>':`<span class="sem s-${bloq?'bad':Math.abs(d)>0?'warn':'ok'}" style="min-width:0">${d>0?'+':''}${nf1.format(d).replace(',0','')}</span>`};
    c.oninput=upd; j.oninput=()=>{CT_RASC[id]={c:c.value,j:j.value}};
  });
  const nomeDe=u=>u&&S.user&&u===S.user.id?'você':'';
  $('#ctDivSub').textContent=`${pend.length} aguardando revisão · últimos 30 dias`;
  const div30=div.filter(c=>Date.now()-new Date(c.created_at)<30*864e5);
  $('#tCtDiv').innerHTML=div30.length?`<tr><th>Data</th><th>Item</th><th class="num">Sistema</th><th class="num">Contado</th><th class="num">Diferença</th><th class="num">A custo</th><th>Justificativa</th><th>Revisão</th></tr>`+
    div30.slice().sort((a,b)=>(!!a.revisado_em-!!b.revisado_em)||b.created_at.localeCompare(a.created_at)).map(c=>`<tr><td>${new Date(c.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td><b>${esc(c.item)}</b></td><td class="num">${nf1.format(c.esperado).replace(',0','')}</td><td class="num">${nf1.format(c.contado).replace(',0','')}</td><td class="num"><span class="sem s-bad" style="min-width:0">${c.diferenca>0?'+':''}${nf1.format(c.diferenca).replace(',0','')} ${esc(c.un||'')}</span></td><td class="num">${brl(c.diferenca*(custo[c.item]||0))}</td><td style="white-space:normal;min-width:220px">${esc(c.justificativa||'—')}</td><td>${c.revisado_em?`<span class="sem s-ok" style="min-width:0">revisada</span>${c.revisao_obs?`<div class="small muted">${esc(c.revisao_obs)}</div>`:''}`:P.gestor?`<button class="btn sm" data-rv="${c.id}">Revisar</button>`:'<span class="sem s-warn" style="min-width:0">aguardando</span>'}</td></tr>`).join('')
    :'<tr><td><div class="empty">Nenhuma divergência acima do limite nos últimos 30 dias.</div></td></tr>';
  $('#tCtDiv').querySelectorAll('[data-rv]').forEach(b=>b.onclick=async()=>{const o=await pedir('Revisar divergência','Parecer do gestor (opcional)',{placeholder:'Ex.: conferido com a produção; ajuste aceito',ok:'Marcar como revisada'});if(o==null)return;
    busy(true);const {error}=await sb.rpc('revisar_divergencia',{p_tipo:'cc',p_id:+b.dataset.rv,p_obs:o||null});busy(false);if(error){toast(error.message);return}toast('Divergência revisada.');await load(['contagens_estoque','alertas']);pintarSino();ccCont()});
  $('#tCtHist').innerHTML=hist.length?`<tr><th>Data</th><th>Item</th><th class="num">Sistema</th><th class="num">Contado</th><th class="num">Diferença</th><th>Justificativa</th></tr>`+
    hist.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,400).map(c=>`<tr><td>${new Date(c.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td>${esc(c.item)}</td><td class="num">${nf1.format(c.esperado).replace(',0','')}</td><td class="num">${nf1.format(c.contado).replace(',0','')}</td><td class="num">${c.diferenca?`<span class="sem s-${Math.abs(c.diferenca)>c.limite?'bad':'warn'}" style="min-width:0">${c.diferenca>0?'+':''}${nf1.format(c.diferenca).replace(',0','')}</span>`:'<span class="muted">0</span>'}</td><td style="white-space:normal" class="small">${esc(c.justificativa||'')}</td></tr>`).join('')
    :'<tr><td><div class="empty">Nenhuma contagem registrada.</div></td></tr>';
}
/* bloqueio: abre a janela que exige a justificativa de cada divergência; devolve a lista completa ou null */
function exigirJustificativas(itens){
  const bloq=itens.filter(x=>Math.abs(x.contado-x.esperado)>x.limite&&(x.justificativa||'').trim().length<10);
  if(!bloq.length) return Promise.resolve(itens);
  return new Promise(res=>{
    modal(`<h3 style="color:#ffb0b6">Contagem bloqueada</h3>
      <p class="small muted" style="margin-bottom:10px">${bloq.length===1?'Este item tem':'Estes itens têm'} diferença acima do limite. Para liberar, escreva o motivo de cada divergência (pelo menos 10 caracteres). Os gestores recebem um alerta para revisar.</p>
      ${bloq.map((x,k)=>`<div class="ct-modal"><div><b>${esc(x.item)}</b><span class="small muted"> · ${x.rotulo?esc(x.rotulo):`sistema ${nf1.format(x.esperado).replace(',0','')} · contado ${nf1.format(x.contado).replace(',0','')} · <b style="color:#ff9aa2">${x.contado-x.esperado>0?'+':''}${nf1.format(x.contado-x.esperado).replace(',0','')} ${esc(x.un||'')}</b> (limite ${nf0.format(x.limite)})`}</span></div>
        <textarea class="inp" data-k="${k}" rows="2" placeholder="Ex.: perda no porcionamento, erro de lançamento da transferência, recebimento sem nota…">${esc(x.justificativa||'')}</textarea></div>`).join('')}
      <div class="actions mt"><button class="btn" id="jjNo">Voltar</button><button class="btn pri" id="jjOk" disabled>Justificar e salvar</button></div>`,el=>{
      const ts=[...el.querySelectorAll('textarea')], ok=el.querySelector('#jjOk');
      const chk=()=>{ok.disabled=!ts.every(t=>t.value.trim().length>=10)};ts.forEach(t=>t.oninput=chk);chk();setTimeout(()=>ts[0]&&ts[0].focus(),50);
      el.querySelector('#jjNo').onclick=()=>{fecharModal();res(null)};
      ok.onclick=()=>{ts.forEach(t=>bloq[+t.dataset.k].justificativa=t.value.trim());fecharModal();res(itens)};
    });
  });
}
async function salvarContagem(itens){
  const lista=await exigirJustificativas(itens); if(!lista) return false;
  busy(true);const {data,error}=await sb.rpc('registrar_contagem',{p_itens:lista.map(x=>({id:x.id,contado:x.contado,justificativa:x.justificativa||null}))});busy(false);
  if(error){toast(error.message.replace(/^BLOQUEIO: /,'Bloqueado: '));return false}
  const nd=lista.filter(x=>Math.abs(x.contado-x.esperado)>x.limite).length;
  const hj=isoHoje(),hr=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
  filaDrive({tipo:'contagem_cc',loja_id:null,ref:`cc|${hj}|${Date.now()}`,mes:ymOf(hj),aba:'Contagem cozinha central',
    titulo:`Contagem da cozinha central · ${fmtD(hj)} ${hr} · ${lista.length} ite${lista.length===1?'m':'ns'}`,
    colunas:['Data','Hora','Item','Unidade','Sistema','Contado','Diferença','Limite','Justificativa'],
    linhas:lista.map(x=>[hj,hr,x.item,x.un||'',+x.esperado,+x.contado,Math.round((x.contado-x.esperado)*1000)/1000,+x.limite,x.justificativa||'']),
    resumo:{'Itens contados':lista.length,'Divergências':nd},
    destaques:lista.filter(x=>Math.abs(x.contado-x.esperado)>x.limite).map(x=>`${x.item}: sistema ${x.esperado}, contado ${x.contado} ${x.un||''}${x.justificativa?' · motivo: '+x.justificativa:''}`)});
  toast(`Contagem salva: ${data} ite${data===1?'m':'ns'}${nd?` · ${nd} divergência${nd>1?'s':''} enviada${nd>1?'s':''} para revisão`:''}.`);
  await load(['estoque_cc','contagens_estoque','alertas']);pintarSino();return true;
}
function initCont(){
  $('#ctLimpar').onclick=()=>{CT_RASC={};ccCont()};
  $('#ctSalvar').onclick=async()=>{const es=S.db.estoque_cc||[];
    const itens=Object.entries(CT_RASC).filter(([,v])=>v.c!==''&&v.c!=null).map(([id,v])=>{const i=es.find(x=>x.id==id);return i?{id:i.id,item:i.item,un:i.un,esperado:+i.atual,contado:+v.c,limite:limItem(i),justificativa:v.j}:null}).filter(Boolean);
    if(!itens.length){toast('Digite a quantidade contada de pelo menos um item.');return}
    if(itens.some(x=>isNaN(x.contado)||x.contado<0)){toast('Há quantidade inválida.');return}
    if(await salvarContagem(itens)){CT_RASC={};ccCont()}};
  $('#ctLim').onchange=async()=>{const v=Math.max(0,+$('#ctLim').value||0);if(await dbw(sb.from('config').upsert({chave:'contagem_limite',valor:v}),'Limite de divergência salvo.')){await load(['config']);ccCont()}};
  $('#ctCsv').onclick=()=>csv('contagens-estoque-fat-buddha.csv',[['Data','Item','Unidade','Sistema','Contado','Diferença','Limite','Justificativa','Revisada em','Parecer']].concat((S.db.contagens_estoque||[]).map(c=>[c.created_at,c.item,c.un,c.esperado,c.contado,c.diferenca,c.limite,c.justificativa,c.revisado_em,c.revisao_obs])));
}

/* ---------------- conexões (Configurações › Integrações) ---------------- */
const CONEXOES = [
  {k:'ifood',n:'iFood',esc:['ifood','delivery','indicadores'],rec:'ifood',d:'Métricas diárias por loja: pedidos, faturamento, cancelamentos, tempo online, nota, preparo e custos. Alimenta a aba iFood e os indicadores de delivery das metas.',
   passos:['Cadastre o merchant id do iFood de cada loja em Configurações › Lojas.','Gere a chave abaixo e entregue ao integrador (ou ao parceiro que lê a API do iFood).','Sem integrador ainda? Importe o relatório diário em CSV na aba iFood.']},
  {k:'pedidos',n:'Portal de vendas · tempo real',esc:['pedidos','vendas','vendas_hora','vendas_itens'],rec:'pedidos',d:'Cada pedido enviado atualiza na hora a venda do dia e da hora da loja (cartão "Vendas em tempo real" na Visão geral e em Minha loja).',
   passos:['Cadastre o código de cada loja no seu portal em Configurações › Lojas (ou use o código do portal Fat Buddha).','O outro portal envia um POST a cada pedido (ou em lotes a cada minuto).','No fim do dia, um fechamento em "vendas" tem prioridade sobre a soma dos pedidos.']},
  {k:'notas',n:'Notas fiscais',esc:['notas'],rec:'notas',d:'O sistema que recebe as NF-e envia o XML (ou os campos) de cada nota. O portal reconhece a loja, classifica no DRE pelas regras e sugere as compras do CMV.',
   passos:['Cadastre o CNPJ de cada loja em Configurações › Lojas.','Gere a chave e configure o envio do XML no sistema de notas.','Classifique os fornecedores uma vez na aba Notas fiscais; as próximas notas entram classificadas.']},
];
async function cfConexoes(){
  const el=$('#conexoes'); if(!el) return;
  cfDrive();
  const [{data:ks},{data:lg}]=await Promise.all([sb.from('api_chaves').select('id,nome,escopos,ativo,ultimo_uso'),sb.from('api_logs').select('recurso,status,registros,em').in('recurso',['ifood','pedidos','notas','vendas']).order('em',{ascending:false}).limit(300)]);
  el.innerHTML=CONEXOES.map(c=>{const chaves=(ks||[]).filter(k=>k.ativo&&k.escopos.includes(c.rec));const ult=(lg||[]).find(l=>l.recurso===c.rec&&l.status<300);
    const on=!!ult&&Date.now()-new Date(ult.em)<3*864e5;
    return `<div class="card conx"><h3>${esc(c.n)} <small><span class="sem s-${on?'ok':chaves.length?'warn':'neu'}" style="min-width:0">${on?'recebendo':chaves.length?'aguardando dados':'não conectado'}</span></small></h3>
      <p class="small muted">${esc(c.d)}</p>
      <ol class="small conx-p">${c.passos.map(p=>`<li>${esc(p)}</li>`).join('')}</ol>
      <div class="metas-list mt"><div><span>Endereço</span><b class="small" style="user-select:all;word-break:break-all">${API_BASE}/${c.rec}</b></div><div><span>Último envio</span><b>${ult?new Date(ult.em).toLocaleString('pt-BR')+' · '+ult.registros+' registros':'—'}</b></div><div><span>Chaves ativas</span><b>${chaves.length?chaves.map(k=>esc(k.nome)).join(', '):'nenhuma'}</b></div></div>
      <div class="actions mt"><button class="btn sm" data-cxex="${c.rec}">Ver exemplo</button>${P.admin?`<button class="btn pri sm" data-cx="${c.k}">Gerar chave</button>`:''}</div></div>`}).join('');
  el.querySelectorAll('[data-cxex]').forEach(b=>b.onclick=()=>{$('#apiExRec').value=b.dataset.cxex;$('#apiExRec').onchange();$('#apiEx').scrollIntoView({behavior:'smooth',block:'center'})});
  el.querySelectorAll('[data-cx]').forEach(b=>b.onclick=async()=>{const c=CONEXOES.find(x=>x.k===b.dataset.cx);
    const nome=await pedir(`Gerar chave · ${c.n}`,'Nome da chave (quem vai usar)',{valor:c.n,ok:'Gerar chave',ajuda:`Permissões: ${c.esc.map(e=>API_REC[e]?API_REC[e].n:e).join(', ')}. A chave aparece uma única vez.`});
    if(!nome) return;
    const k=novaChave();
    if(await dbw(sb.from('api_chaves').insert({nome,prefixo:k.slice(0,12),hash:await sha256hex(k),escopos:c.esc}),'Chave gerada.')){
      modal(`<h3>Chave de ${esc(c.n)}</h3><p class="small muted">Copie agora e entregue a quem vai integrar. Ela não será mostrada de novo; se perder, revogue e gere outra.</p>
        <div class="banner mt" style="margin-bottom:0"><code style="user-select:all;font-size:13px;word-break:break-all">${k}</code></div>
        <div class="metas-list mt"><div><span>Endereço</span><b class="small" style="user-select:all;word-break:break-all">${API_BASE}/${c.rec}</b></div><div><span>Cabeçalho</span><b>x-api-key: (a chave acima)</b></div></div>
        <div class="actions mt"><button class="btn" id="ckCopy">Copiar chave</button><button class="btn pri" id="ckOk">Pronto</button></div>`,m=>{m.querySelector('#ckCopy').onclick=()=>navigator.clipboard.writeText(k).then(()=>toast('Chave copiada.'));m.querySelector('#ckOk').onclick=fecharModal});
      listarChaves();cfConexoes();
    }});
}

/* ---------------- Drive e e-mail das contagens e checklists ---------------- */
const DRV_TIPOS='Controle diário das lojas, contagem da cozinha central, CMV semanal e por item, visitas de qualidade, checklist de delivery e vistoria de operações';
async function cfDrive(){
  const el=$('#cxDrive'); if(!el) return;
  if(!(P.admin||P.papel==='diretoria')){el.innerHTML='';return}
  const {data:st,error}=await sb.functions.invoke('drive-enviar',{body:{acao:'status'}});
  if(error||!st){el.innerHTML='';return}
  const c=st.config||{}, lig=!!c.url&&c.ativo!==false, ok=lig&&st.ultimo&&!st.erro;
  const chip=!c.url?['neu','aguardando o script do Google']:c.ativo===false?['neu','desligado']:st.erro?['bad','com erro']:st.ultimo?['ok','enviando']:['warn','ligado · sem envio ainda'];
  el.innerHTML=`<div class="card conx"><h3>Drive e e-mail das contagens <small><span class="sem s-${chip[0]}" style="min-width:0">${chip[1]}</span></small></h3>
    <p class="small muted">Cada contagem ou checklist salvo no portal entra numa planilha no Drive de ${esc((c.para||[]).join(', ')||'—')} (uma aba por tipo e por mês) e gera um e-mail com o resultado. Vale para: ${DRV_TIPOS}. O que for salvo antes de ligar fica guardado e é enviado assim que o script estiver no ar.</p>
    <div class="metas-list mt"><div><span>Aguardando envio</span><b>${st.pendentes}</b></div><div><span>Último envio</span><b>${st.ultimo?`${new Date(st.ultimo.enviado_em).toLocaleString('pt-BR')} · ${esc(st.ultimo.titulo)}${st.ultimo.planilha_url?` · <a href="${esc(st.ultimo.planilha_url)}" target="_blank" rel="noopener">abrir planilha</a>`:''}`:'—'}</b></div>${st.erro?`<div><span>Último erro</span><b style="color:#ff9aa2">${esc(st.erro.erro)}</b></div>`:''}</div>
    <details class="mt" ${c.url?'':'open'}><summary class="small" style="cursor:pointer;font-weight:650">Como ligar na conta do Lucas (5 minutos, uma vez)</summary>
      <ol class="small conx-p" style="margin-top:8px">
        <li>Entre em <b>script.google.com</b> com a conta do Lucas e clique em <b>Novo projeto</b>.</li>
        <li>Apague o código que aparece, clique em <b>Copiar o script</b> aqui embaixo e cole lá. Salve (Ctrl+S).</li>
        <li>Em cima, escolha a função <b>autorizar</b> e clique em <b>Executar</b>. Aceite as permissões (Drive, Planilhas e envio de e-mail). A pasta "Fat Buddha · Portal Operacional" e a planilha são criadas no Drive dele.</li>
        <li><b>Implantar › Nova implantação</b> › tipo <b>App da Web</b> › Executar como: <b>Eu</b> · Quem pode acessar: <b>Qualquer pessoa</b> › Implantar.</li>
        <li>Copie o <b>URL do app da Web</b> (termina em /exec), cole no campo abaixo, clique em <b>Salvar</b> e depois em <b>Enviar teste</b>.</li></ol></details>
    <div class="form-row mt" style="grid-template-columns:2fr 1fr"><label class="f">URL do app da Web (Google)<input class="inp" id="drvUrl" value="${esc(c.url||'')}" placeholder="https://script.google.com/macros/s/…/exec"></label>
      <label class="f">Enviar e-mail para<input class="inp" id="drvPara" value="${esc((c.para||[]).join(', '))}" placeholder="lucas@fatbuddha.com.br"></label></div>
    <div class="actions mt"><button class="btn sm" id="drvScript">Copiar o script</button><button class="btn sm" id="drvBaixar">Baixar o script</button>
      ${c.url?`<button class="btn sm" id="drvTeste">Enviar teste</button>`:''}${st.pendentes&&c.url?`<button class="btn sm" id="drvRe">Enviar a fila agora (${st.pendentes})</button>`:''}
      ${c.url?`<button class="btn sm" id="drvOnOff">${c.ativo===false?'Ligar envio':'Pausar envio'}</button>`:''}<button class="btn pri sm" id="drvSalvar">Salvar</button></div></div>`;
  const inv=async b=>{busy(true);const r=await sb.functions.invoke('drive-enviar',{body:b});busy(false);if(r.error){toast('Não foi possível falar com o servidor.');return null}return r.data};
  const pegar=async()=>{const r=await inv({acao:'script'});return r&&r.script};
  $('#drvScript').onclick=async()=>{const t=await pegar();if(t)navigator.clipboard.writeText(t).then(()=>toast('Script copiado. Cole no script.google.com.'),()=>toast('Não deu para copiar; use "Baixar o script".'))};
  $('#drvBaixar').onclick=async()=>{const t=await pegar();if(!t)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain'}));a.download='fat-buddha-drive.gs';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
  $('#drvSalvar').onclick=async()=>{const r=await inv({acao:'salvar',url:$('#drvUrl').value.trim(),para:$('#drvPara').value});if(!r)return;if(!r.ok){toast(r.erro||'Não foi possível salvar.');return}toast('Configuração salva.');cfDrive()};
  const t=$('#drvTeste');if(t)t.onclick=async()=>{const r=await inv({acao:'teste'});if(!r)return;if(r.ok){toast(`Funcionando: planilha criada e e-mail de teste enviado.${r.cota!=null?` Cota de e-mails hoje: ${r.cota}.`:''}`);cfDrive()}else toast('O Google respondeu com erro: '+(r.erro||r.mensagem||'verifique o URL e o acesso "Qualquer pessoa".'))};
  const re=$('#drvRe');if(re)re.onclick=async()=>{const r=await inv({acao:'reenviar'});if(r)toast(r.ok?`${r.enviados} enviado(s)${r.falhas?`, ${r.falhas} com erro`:''}.`:(r.mensagem||'Não enviado.'));cfDrive()};
  const oo=$('#drvOnOff');if(oo)oo.onclick=async()=>{const r=await inv({acao:'salvar',url:c.url,para:c.para,ativo:c.ativo===false});if(r&&r.ok){toast(c.ativo===false?'Envio ligado.':'Envio pausado.');cfDrive()}};
}
