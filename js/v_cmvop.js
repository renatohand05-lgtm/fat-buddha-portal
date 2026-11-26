/* =====================================================================
   CMV operacional: controle diário (bebidas, sobremesas, proteínas),
   perdas e desperdício, produção do dia (padrão por dia da semana)
   ===================================================================== */
let cmSub = 'sem';
const LISTAS = {
  bebidas:   {n:'Bebidas',    loc:['Estoque seco','Geladeira'],                   ent:'Recebido no dia'},
  sobremesas:{n:'Sobremesas', loc:['Congelador','Geladeira'],                     ent:'Recebido / preparado'},
  proteinas: {n:'Proteínas',  loc:['Congelado','Descongelado e descongelando'], ent:'Recebido da matriz'},
};
const MOTIVOS = ['Fora do padrão de qualidade','Vencido','Erro de preparo','Sobra de produção','Queda ou acidente','Temperatura fora da faixa','Devolução de cliente','Outro'];
const n0 = v => v==null||v===''?null:+v;
const fq = v => v==null?'—':nf1.format(v).replace(',0','');
const ctlTol = () => {const v=cfg('controle_tolerancia');return v==null?0:+v};

function renderCmvTab(){
  if(P.papel==='colaborador'&&cmSub==='sem') cmSub='ctl';
  $$('#cmNav button').forEach(b=>{b.classList.toggle('on',b.dataset.s===cmSub);if(b.dataset.s==='sem')b.classList.toggle('hidden',P.papel==='colaborador')});
  $$('#tab-cmv > .ccs').forEach(s=>s.classList.toggle('on',s.id==='cm-'+cmSub));
  ({sem:renderCMV,ctl:renderControle,per:renderPerdas,prod:renderProducao})[cmSub]();
}

/* ---------------- controle diário ---------------- */
let ctlLista='bebidas', CTL_ROWS=[], CTL_ONTEM=[], CTL_MES=[], CTL_RASC={};
async function ctlCarregar(loja,data){
  const m=ymOf(data);
  const [a,b,c,d,e]=await Promise.all([
    sb.from('controle_diario').select('*').eq('loja_id',loja).eq('data',data),
    sb.from('controle_diario').select('item_id,fin1,fin2,fin3').eq('loja_id',loja).eq('data',addDia(data,-1)),
    sb.from('controle_diario').select('id,data,item_id,diferenca,justificativa,revisado_em').eq('loja_id',loja).gte('data',m+'-01').lte('data',fimMes(m)).not('diferenca','is',null),
    sb.from('perdas').select('item_id,item,quantidade').eq('loja_id',loja).eq('data',data),
    sb.from('vendas_itens').select('item,codigo,quantidade').eq('loja_id',loja).eq('data',data)]);
  CTL_ROWS=a.data||[]; CTL_ONTEM=b.data||[]; CTL_MES=c.data||[];
  return {perdas:d.data||[], vendas:e.data||[]};
}
const normTxt = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\(.*?\)/g,'').replace(/\s+/g,' ').trim();
async function renderControle(){
  const lojas=LOJAS.filter(l=>l.status!=='fechada'&&(P.veTudo||S.minhas.includes(l.id)));
  const sel=$('#ctlLoja').value||(lojas[0]||{}).id;
  $('#ctlLoja').innerHTML=optLojas(lojas,sel); $('#ctlLoja').value=sel;
  if(!$('#ctlData').value) $('#ctlData').value=isoHoje();
  const loja=$('#ctlLoja').value, data=$('#ctlData').value;
  $$('#ctlLista button').forEach(b=>b.classList.toggle('on',b.dataset.l===ctlLista));
  if(!loja){$('#tCtl').innerHTML='<tr><td><div class="empty">Nenhuma loja disponível.</div></td></tr>';return}
  const ex=await ctlCarregar(loja,data);
  const itens=(S.db.itens_controle||[]).filter(i=>i.ativo&&i.lista===ctlLista).sort((a,b)=>a.ordem-b.ordem);
  const L=LISTAS[ctlLista], nl=L.loc.length, pode=P.operar(loja), tol=ctlTol();
  const row=id=>CTL_ROWS.find(r=>r.item_id===id)||{};
  const r0=CTL_ROWS.find(r=>itens.some(i=>i.id===r.item_id))||{};
  $('#ctlRespA').value=r0.resp_abertura||''; $('#ctlRespF').value=r0.resp_fechamento||'';
  $('#ctlTit').firstChild.textContent=`${L.n} · ${fmtD(data)} `;
  $('#ctlSub').textContent=`${lojaNome(loja)} · ${new Date(data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long'})}`;
  $('#ctlInfo').textContent=ex.vendas.length?`${ex.vendas.length} itens vendidos recebidos do PDV neste dia`:'Sem vendas por item do PDV neste dia: lance a venda à mão ou conecte o PDV';
  const perdaDe=i=>sum(ex.perdas.filter(p=>p.item_id===i.id||normTxt(p.item)===normTxt(i.item)),p=>p.quantidade);
  const vendaPdv=i=>{const v=ex.vendas.find(v=>(i.codigo_pdv&&v.codigo===i.codigo_pdv)||normTxt(v.item)===normTxt(i.item));return v?+v.quantidade:null};
  const val=(i,k)=>{const r=CTL_RASC[i.id];if(r&&k in r)return r[k];const d=row(i.id)[k];return d==null?'':d};
  const calc=i=>{const g=k=>{const v=val(i,k);return v===''||v==null?null:+v};
    const ini=[1,2,3].slice(0,nl).map(k=>g('ini'+k)), fin=[1,2,3].slice(0,nl).map(k=>g('fin'+k));
    const ti=ini.some(v=>v!=null)?sum(ini,v=>v||0):null, tf=fin.some(v=>v!=null)?sum(fin,v=>v||0):null;
    const ent=g('entradas')||0, ven=g('venda'), per=g('perdas')??perdaDe(i);
    const dif=tf==null||ven==null?null:(ti||0)+ent-tf-ven-per;
    const o=CTL_ONTEM.find(r=>r.item_id===i.id); const fo=o&&[o.fin1,o.fin2,o.fin3].some(v=>v!=null)?sum([o.fin1,o.fin2,o.fin3],v=>+v||0):null;
    return {ti,tf,ent,ven,per,dif,fo}};
  const inp=(i,k,w=62)=>`<input class="inp ctl-in" data-i="${i.id}" data-k="${k}" type="number" min="0" step="any" value="${esc(val(i,k))}" style="width:${w}px;padding:5px 6px;text-align:right" ${pode?'':'disabled'}>`;
  const cel=(i)=>{const c=calc(i),bloq=c.dif!=null&&Math.abs(c.dif)>tol;
    return `<tr data-row="${i.id}" class="${bloq?'ct-bloq':''}"><td><b>${esc(i.item)}</b><div class="small muted">${esc(i.unidade)}${i.preparado?' · preparado na loja':''}</div></td>
      ${[1,2,3].slice(0,nl).map(k=>`<td class="num">${inp(i,'ini'+k)}</td>`).join('')}
      <td class="num"><b class="c-ti">${fq(c.ti)}</b>${c.fo!=null&&c.ti!=null&&c.fo!==c.ti?`<div class="small" style="color:var(--amber)" title="Fechamento de ontem">ontem ${fq(c.fo)}</div>`:c.fo!=null?`<div class="small muted">ontem ${fq(c.fo)}</div>`:''}</td>
      <td class="num">${inp(i,'entradas')}</td>
      ${[1,2,3].slice(0,nl).map(k=>`<td class="num">${inp(i,'fin'+k)}</td>`).join('')}
      <td class="num"><b class="c-tf">${fq(c.tf)}</b></td>
      <td class="num">${inp(i,'venda')}${vendaPdv(i)!=null?`<div class="small muted">PDV ${fq(vendaPdv(i))}</div>`:''}</td>
      <td class="num">${inp(i,'perdas',54)}</td>
      <td class="num c-dif">${c.dif==null?'<span class="muted">—</span>':`<span class="sem s-${bloq?'bad':c.dif?'warn':'ok'}" style="min-width:0">${c.dif>0?'+':''}${fq(c.dif)}</span>`}</td>
      <td><input class="inp ctl-j" data-i="${i.id}" style="min-width:170px;padding:5px 8px;${bloq||val(i,'justificativa')?'':'display:none'}" placeholder="Motivo da diferença" value="${esc(val(i,'justificativa'))}" ${pode?'':'disabled'}>${row(i.id).revisado_em?'<span class="sem s-ok" style="min-width:0">revisada</span>':''}</td></tr>`};
  $('#tCtl').innerHTML=itens.length?`<tr><th rowspan="2">Item</th><th colspan="${nl+1}" style="text-align:center">Abertura</th><th rowspan="2" class="num">${esc(L.ent)}</th><th colspan="${nl+1}" style="text-align:center">Fechamento</th><th rowspan="2" class="num">Venda PDV</th><th rowspan="2" class="num">Perdas</th><th rowspan="2" class="num">Diferença</th><th rowspan="2">Justificativa</th></tr>
    <tr>${L.loc.map(l=>`<th class="num">${esc(l)}</th>`).join('')}<th class="num">Total</th>${L.loc.map(l=>`<th class="num">${esc(l)}</th>`).join('')}<th class="num">Total</th></tr>`+itens.map(cel).join('')
    :'<tr><td><div class="empty">Nenhum item cadastrado nesta lista.</div></td></tr>';
  $('#tCtl').querySelectorAll('.ctl-in,.ctl-j').forEach(el=>el.oninput=()=>{const id=+el.dataset.i;CTL_RASC[id]=CTL_RASC[id]||{};CTL_RASC[id][el.dataset.k||'justificativa']=el.value;
    const i=itens.find(x=>x.id===id),c=calc(i),tr=el.closest('tr'),bloq=c.dif!=null&&Math.abs(c.dif)>tol;
    tr.querySelector('.c-ti').textContent=fq(c.ti); tr.querySelector('.c-tf').textContent=fq(c.tf); tr.classList.toggle('ct-bloq',bloq);
    tr.querySelector('.c-dif').innerHTML=c.dif==null?'<span class="muted">—</span>':`<span class="sem s-${bloq?'bad':c.dif?'warn':'ok'}" style="min-width:0">${c.dif>0?'+':''}${fq(c.dif)}</span>`;
    const j=tr.querySelector('.ctl-j'); if(bloq) j.style.display='';});
  $('#ctlSalvar').classList.toggle('hidden',!pode); $('#ctlVendas').classList.toggle('hidden',!pode||!ex.vendas.length);
  $('#ctlVendas').onclick=()=>{let n=0;itens.forEach(i=>{const v=vendaPdv(i);if(v!=null){CTL_RASC[i.id]=CTL_RASC[i.id]||{};CTL_RASC[i.id].venda=v;n++}});toast(n?`Venda do PDV preenchida em ${n} itens.`:'Nenhum item desta lista veio do PDV.');renderControle()};
  $('#ctlSalvar').onclick=async()=>{
    const linhas=itens.filter(i=>CTL_RASC[i.id]||row(i.id).id).map(i=>{const c=calc(i),o={loja_id:loja,data,item_id:i.id,entradas:c.ent,perdas:c.per,resp_abertura:$('#ctlRespA').value.trim()||null,resp_fechamento:$('#ctlRespF').value.trim()||null};
      [1,2,3].forEach(k=>{o['ini'+k]=k<=nl?n0(val(i,'ini'+k)):null;o['fin'+k]=k<=nl?n0(val(i,'fin'+k)):null});
      o.venda=n0(val(i,'venda')); o.justificativa=String(val(i,'justificativa')||'').trim()||null; o._item=i.item; o._dif=c.dif; return o});
    if(!linhas.length){toast('Nenhuma quantidade digitada.');return}
    // bloqueio: diferença acima da tolerância sem justificativa abre a janela de justificativas
    const pend=linhas.filter(o=>o._dif!=null&&Math.abs(o._dif)>tol&&(o.justificativa||'').length<10);
    if(pend.length){
      const j=await exigirJustificativas(pend.map(o=>({item:o._item,un:'',esperado:0,contado:o._dif,limite:tol,justificativa:o.justificativa||'',rotulo:`diferença de ${o._dif>0?'+':''}${fq(o._dif)} entre o estoque contado e a venda do PDV (tolerância ${fq(tol)})`})));
      if(!j) return; j.forEach((x,k)=>{pend[k].justificativa=x.justificativa;CTL_RASC[pend[k].item_id]=Object.assign(CTL_RASC[pend[k].item_id]||{},{justificativa:x.justificativa})});
    }
    linhas.forEach(o=>{delete o._item;delete o._dif});
    if(await dbw(sb.from('controle_diario').upsert(linhas,{onConflict:'loja_id,data,item_id'}),`${L.n}: contagem salva (${linhas.length} itens).`)){CTL_RASC={};await load(['alertas']);pintarSino();renderControle()}
  };
  // resumo do mês
  const m=ymOf(data), mes=CTL_MES, comDif=mes.filter(r=>Math.abs(r.diferenca)>tol), dias=uniq(mes.map(r=>r.data));
  const itensAll=S.db.itens_controle||[], custo=id=>{const i=itensAll.find(x=>x.id===id);return i&&i.custo!=null?+i.custo:null};
  const valDif=comDif.some(r=>custo(r.item_id)!=null)?sum(comDif,r=>(custo(r.item_id)||0)*r.diferenca):null;
  $('#ctlKpis').innerHTML=kpi('Dias controlados',dias.length,'int',`${mesLongo(m)} · ${lojaNome(loja)}`)+
    kpi('Dias sem diferença',dias.length?dias.filter(d=>!comDif.some(r=>r.data===d)).length/dias.length*100:null,'pct1','todas as listas batendo com a venda')+
    kpi('Itens com diferença',comDif.length,'int',`${comDif.filter(r=>!r.revisado_em).length} aguardando revisão`)+
    kpi('Diferença valorizada',valDif,'brl',valDif==null?'cadastre o custo dos itens':'falta (−) ou sobra (+) no mês');
  animateKpis($('#ctlKpis'));
  $('#ctlMesSub').textContent=mesLongo(m);
  const porItem={};comDif.forEach(r=>{const n=(itensAll.find(x=>x.id===r.item_id)||{}).item||'?';porItem[n]=(porItem[n]||0)+ +r.diferenca});
  const top=Object.entries(porItem).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,10);
  if(top.length) mk('cCtlItens',{type:'bar',data:{labels:top.map(t=>t[0]),datasets:[{label:'Diferença acumulada',data:top.map(t=>t[1]),backgroundColor:top.map(t=>t[1]<0?'rgba(255,92,104,.85)':'rgba(242,179,61,.85)'),borderRadius:5}]},options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+(c.parsed.x>0?'+':'')+fq(c.parsed.x)+' (falta é negativo)'}}},scales:{x:{grid:{color:C.grid},border:{display:false}},y:{grid:{display:false},border:{display:false}}}}});
  else noData('cCtlItens','Nenhuma diferença no mês.');
  const ds=uniq(comDif.map(r=>r.data)).sort().reverse();
  const podeRev=P.gestor||P.editar(loja);
  $('#tCtlDias').innerHTML=ds.length?`<tr><th>Dia</th><th class="num">Itens</th><th>Situação</th></tr>`+ds.map(d=>{const rs=comDif.filter(r=>r.data===d),pend=rs.filter(r=>!r.revisado_em).length;
    return `<tr><td><a href="#" data-dia="${d}">${fmtD(d)}</a></td><td class="num">${rs.length}</td><td>${pend?(podeRev?`<button class="btn sm" data-rvd="${d}">Revisar dia</button>`:'<span class="sem s-warn" style="min-width:0">aguardando</span>'):'<span class="sem s-ok" style="min-width:0">revisado</span>'}</td></tr>`}).join('')
    :'<tr><td><div class="empty">Nenhum dia com diferença neste mês.</div></td></tr>';
  $('#tCtlDias').querySelectorAll('[data-dia]').forEach(a=>a.onclick=e=>{e.preventDefault();$('#ctlData').value=a.dataset.dia;CTL_RASC={};renderControle()});
  $('#tCtlDias').querySelectorAll('[data-rvd]').forEach(b=>b.onclick=async()=>{busy(true);const {data:n,error}=await sb.rpc('revisar_controle',{p_loja:loja,p_data:b.dataset.rvd});busy(false);if(error){toast(error.message);return}toast(`${n} diferença${n===1?'':'s'} revisada${n===1?'':'s'}.`);await load(['alertas']);pintarSino();renderControle()});
  // catálogo (gestor)
  if(P.gestor){
    $('#ctlTol').value=tol;
    const cat=itensAll.slice().sort((a,b)=>a.lista.localeCompare(b.lista)||a.ordem-b.ordem);
    $('#tCtlItens').innerHTML=`<tr><th>Lista</th><th>Item</th><th>Unidade</th><th class="num">Custo unitário</th><th>Código no PDV</th><th>Ativo</th></tr>`+cat.map(i=>`<tr><td>${esc(LISTAS[i.lista].n)}</td><td><input class="inp" data-ic="${i.id}" data-f="item" value="${esc(i.item)}" style="min-width:200px"></td><td><input class="inp" data-ic="${i.id}" data-f="unidade" value="${esc(i.unidade)}" style="width:80px"></td><td class="num"><input class="inp" type="number" step="0.01" min="0" data-ic="${i.id}" data-f="custo" value="${i.custo??''}" placeholder="R$" style="width:100px;text-align:right"></td><td><input class="inp" data-ic="${i.id}" data-f="codigo_pdv" value="${esc(i.codigo_pdv||'')}" style="width:120px"></td><td><input type="checkbox" data-ic="${i.id}" data-f="ativo" ${i.ativo?'checked':''}></td></tr>`).join('');
    $('#tCtlItens').querySelectorAll('[data-ic]').forEach(el=>el.onchange=async()=>{const f=el.dataset.f;let v=f==='ativo'?el.checked:el.value.trim();if(f==='custo')v=v===''?null:+v;if(f==='codigo_pdv'&&!v)v=null;if(f==='item'&&!v){toast('Informe o nome.');return}
      if(await dbw(sb.from('itens_controle').update({[f]:v}).eq('id',el.dataset.ic),'Item atualizado.')){await load(['itens_controle'])}});
  }
}
function initControle(){
  $('#ctlLoja').onchange=()=>{CTL_RASC={};renderControle()}; $('#ctlData').onchange=()=>{CTL_RASC={};renderControle()};
  $$('#ctlLista button').forEach(b=>b.onclick=()=>{if(Object.keys(CTL_RASC).length&&!confirm('Há quantidades digitadas e não salvas nesta lista. Trocar mesmo assim?'))return;CTL_RASC={};ctlLista=b.dataset.l;renderControle()});
  $('#ctlTol').onchange=async()=>{const v=Math.max(0,+$('#ctlTol').value||0);if(await dbw(sb.from('config').upsert({chave:'controle_tolerancia',valor:v}),'Tolerância salva.')){await load(['config']);renderControle()}};
  $('#ctlNovoItem').onclick=()=>modal(`<h3>Novo item controlado</h3><div class="form-row" style="grid-template-columns:1fr 1fr">
      <label class="f">Lista<select class="inp" id="niL">${Object.entries(LISTAS).map(([k,v])=>`<option value="${k}" ${k===ctlLista?'selected':''}>${v.n}</option>`).join('')}</select></label>
      <label class="f">Unidade<select class="inp" id="niU"><option>un</option><option>porção</option><option>kg</option></select></label>
      <label class="f" style="grid-column:span 2">Item<input class="inp" id="niI"></label>
      <label class="f">Custo unitário<input class="inp" type="number" step="0.01" min="0" id="niC" placeholder="opcional"></label>
      <label class="f">Código no PDV<input class="inp" id="niP" placeholder="opcional"></label></div>
      <div class="actions mt"><button class="btn" id="niNo">Cancelar</button><button class="btn pri" id="niOk">Adicionar</button></div>`,el=>{
      el.querySelector('#niNo').onclick=fecharModal;
      el.querySelector('#niOk').onclick=async()=>{const it=el.querySelector('#niI').value.trim();if(!it){toast('Informe o item.');return}const l=el.querySelector('#niL').value;
        const ord=Math.max(0,...(S.db.itens_controle||[]).filter(i=>i.lista===l).map(i=>i.ordem))+1;fecharModal();
        if(await dbw(sb.from('itens_controle').insert({lista:l,item:it,unidade:el.querySelector('#niU').value,custo:n0(el.querySelector('#niC').value),codigo_pdv:el.querySelector('#niP').value.trim()||null,ordem:ord}),'Item adicionado.')){await load(['itens_controle']);renderControle()}}});
}

/* ---------------- perdas e desperdício ---------------- */
let PER_MES=[], PER_MES_REF='';
async function perdasMes(m,force){
  if(!force&&PER_MES_REF===m) return PER_MES;
  const {data}=await sb.from('perdas').select('*').gte('data',m+'-01').lte('data',fimMes(m)).order('data',{ascending:false}).limit(5000);
  PER_MES=data||[]; PER_MES_REF=m; return PER_MES;
}
async function renderPerdas(){
  const rs=(await perdasMes(S.mes)).filter(p=>P.veTudo||S.minhas.includes(p.loja_id));
  const lojasOp=lojasOperaveis().filter(l=>l.status!=='fechada');
  if(!$('#perLoja').options.length){$('#perLoja').innerHTML=optLojas(lojasOp);$('#perData').value=isoHoje();$('#perMot').innerHTML=MOTIVOS.map(m=>`<option>${m}</option>`).join('')}
  $$('#cm-per .only-op').forEach(e=>e.classList.toggle('hidden',!lojasOp.length));
  $('#perItens').innerHTML=uniq((S.db.itens_controle||[]).map(i=>i.item).concat((S.db.producao_padrao||[]).map(p=>p.item))).sort().map(i=>`<option value="${esc(i)}">`).join('');
  const tot=sum(rs.filter(p=>p.valor!=null),p=>p.valor), semValor=rs.filter(p=>p.valor==null).length;
  const vendasMes=sum(LOJAS.map(l=>l.id).filter(id=>P.veTudo||S.minhas.includes(id)),id=>lojaStats(id).fat||0);
  const mot={};rs.forEach(p=>{mot[p.motivo]=(mot[p.motivo]||0)+1});const topMot=Object.entries(mot).sort((a,b)=>b[1]-a[1])[0];
  $('#perKpis').innerHTML=kpi('Perdas no mês',rs.length?tot:null,'brl',semValor?`${semValor} registro${semValor>1?'s':''} sem valor (informe o custo)`:mesLongo(S.mes))+
    kpi('% das vendas',tot&&vendasMes?tot/vendasMes*100:null,'pct1','valor das perdas ÷ faturamento do mês')+
    kpi('Registros',rs.length,'int',`${uniq(rs.map(p=>p.loja_id)).length} loja(s)`)+
    kpi('Motivo mais comum',topMot?topMot[1]:null,'int',topMot?`${topMot[0]} (registros)`:'sem registros');
  animateKpis($('#perKpis'));
  $('#perMotSub').textContent=mesLongo(S.mes);
  const ms=Object.keys(mot);
  if(ms.length) mk('cPerMot',{type:'doughnut',data:{labels:ms,datasets:[{data:ms.map(m=>sum(rs.filter(p=>p.motivo===m),p=>p.valor??0)||rs.filter(p=>p.motivo===m).length),backgroundColor:PAL.concat(['#7c6f66','#a16207']),borderWidth:0}]},options:{cutout:'62%',plugins:{legend:{position:'right'},tooltip:{callbacks:{label:c=>' '+c.label+': '+(tot?brl(c.parsed):c.parsed+' registros')}}}}});
  else noData('cPerMot','Nenhuma perda registrada no mês.');
  const it={};rs.forEach(p=>{const k=p.item;it[k]=it[k]||{n:0,v:0};it[k].n++;it[k].v+=+p.valor||0});
  const ti=Object.entries(it).sort((a,b)=>(b[1].v-a[1].v)||(b[1].n-a[1].n)).slice(0,8);
  if(ti.length) mk('cPerItens',{type:'bar',data:{labels:ti.map(t=>t[0].length>26?t[0].slice(0,25)+'…':t[0]),datasets:[{label:tot?'Valor':'Registros',data:ti.map(t=>tot?t[1].v:t[1].n),backgroundColor:'rgba(229,48,63,.85)',borderRadius:6}]},options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+(tot?brl(c.parsed.x):c.parsed.x+' registros')+' · '+ti[c.dataIndex][1].n+' registro(s)'}}},scales:{x:{grid:{color:C.grid},border:{display:false},ticks:{callback:v=>tot?brlK(v):v}},y:{grid:{display:false},border:{display:false}}}}});
  else noData('cPerItens','Nenhuma perda registrada no mês.');
  $('#tPer').innerHTML=rs.length?`<tr><th>Data</th><th>Loja</th><th>Item</th><th class="num">Qtde</th><th>Motivo</th><th class="num">Valor</th><th>Responsável</th><th>Observação</th><th></th></tr>`+
    rs.map(p=>`<tr><td>${fmtD(p.data)}</td><td>${esc(lojaNome(p.loja_id))}</td><td><b>${esc(p.item)}</b></td><td class="num">${fq(+p.quantidade)} ${esc(p.unidade)}</td><td>${esc(p.motivo)}</td><td class="num">${p.valor!=null?brl(p.valor):'—'}</td><td>${esc(p.responsavel||'')}</td><td class="small" style="white-space:normal;min-width:160px">${esc(p.obs||'')}</td><td class="num">${P.excluir(p.loja_id)?`<button class="btn sm" data-px="${p.id}">Excluir</button>`:''}</td></tr>`).join('')
    :'<tr><td><div class="empty">Nenhuma perda registrada neste mês.</div></td></tr>';
  $('#tPer').querySelectorAll('[data-px]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este registro de perda?'))return;if(await dbw(sb.from('perdas').delete().eq('id',b.dataset.px),'Registro excluído.')){await perdasMes(S.mes,true);renderPerdas()}});
}
function initPerdas(){
  $('#perItem').onchange=()=>{const i=(S.db.itens_controle||[]).find(x=>normTxt(x.item)===normTxt($('#perItem').value));if(i){$('#perUn').value=['un','porção','kg'].includes(i.unidade)?i.unidade:'un';if(i.custo!=null&&!$('#perCusto').value)$('#perCusto').value=i.custo}};
  $('#perSalvar').onclick=async()=>{const item=$('#perItem').value.trim(),q=+$('#perQtd').value;if(!item||!(q>0)){toast('Informe o item e a quantidade.');return}
    const cat=(S.db.itens_controle||[]).find(x=>normTxt(x.item)===normTxt(item));
    const o={loja_id:$('#perLoja').value,data:$('#perData').value||isoHoje(),item,item_id:cat?cat.id:null,quantidade:q,unidade:$('#perUn').value,motivo:$('#perMot').value,custo_unit:n0($('#perCusto').value),obs:$('#perObs').value.trim()||null,responsavel:$('#perResp').value.trim()||null};
    if(await dbw(sb.from('perdas').insert(o),'Perda registrada.')){['#perItem','#perQtd','#perCusto','#perObs'].forEach(s=>$(s).value='');const m=ymOf(o.data);if(m!==S.mes){S.mes=m;$('#pMonth').value=m}await perdasMes(S.mes,true);renderPerdas()}};
  $('#perCsv').onclick=()=>csv(`perdas-${S.mes}.csv`,[['Data','Loja','Item','Quantidade','Unidade','Motivo','Custo unitário','Valor','Responsável','Observação']].concat(PER_MES.map(p=>[p.data,lojaNome(p.loja_id),p.item,p.quantidade,p.unidade,p.motivo,p.custo_unit,p.valor,p.responsavel,p.obs])));
}
/* perdas da semana (aparece no lançamento do CMV semanal) */
async function perdasSemana(loja,semana){
  if(!loja||!semana) return null;
  const {data}=await sb.from('perdas').select('valor').eq('loja_id',loja).gte('data',semana).lte('data',addDia(semana,6));
  if(!data||!data.length) return null;
  return {n:data.length,v:sum(data.filter(p=>p.valor!=null),p=>p.valor),semValor:data.filter(p=>p.valor==null).length};
}

/* ---------------- produção do dia ---------------- */
let PR_EDIT=false;
const DIAS_PT=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const fmtQ=(v,u)=>{if(v==null||v==='')return '—';v=+v;if(u==='kg')return v<1?nf0.format(v*1000)+' g':nf2.format(v).replace(/,?0+$/,'')+' kg';return nf1.format(v).replace(',0','')+(u==='un'?'':' '+u)};
function renderProducao(){
  const lojas=LOJAS.filter(l=>l.status!=='fechada'&&(P.veTudo||S.minhas.includes(l.id)));
  const sel=$('#prLoja').value||(lojas[0]||{}).id;
  $('#prLoja').innerHTML=optLojas(lojas,sel);$('#prLoja').value=sel;
  if(!$('#prData').value) $('#prData').value=isoHoje();
  const loja=$('#prLoja').value, data=$('#prData').value, dw=(new Date(data+'T12:00').getDay()+6)%7, q='q'+(dw+1);
  const rs=(S.db.producao_padrao||[]).filter(p=>p.loja_id===loja).sort((a,b)=>a.ordem-b.ordem);
  $('#prInfo').textContent=rs.length?`${DIAS_PT[dw]} · ${rs.length} itens no padrão de ${lojaNome(loja)}`:'';
  $('#prEditar').textContent=PR_EDIT?'Concluir edição':'Editar padrão da semana';
  $('#prCopiar').classList.toggle('hidden',!P.gestor||rs.length>0);
  if(!rs.length){$('#prLista').innerHTML=`<div class="card"><div class="empty">${esc(lojaNome(loja))} ainda não tem padrão de produção cadastrado.${P.gestor?' Use "Copiar padrão de outra loja" para começar e ajuste as quantidades.':''}</div></div>`;return}
  const secs=uniq(rs.map(r=>r.secao));
  $('#prLista').innerHTML=secs.map(s=>{const it=rs.filter(r=>r.secao===s),mont=(it.find(r=>r.montagem)||{}).montagem;
    return `<div class="card mt prod-sec"><h3>${esc(s)} <small>${mont?'montar às '+esc(mont):''}</small></h3><div class="tbl-wrap"><table>
      <tr><th>Item</th>${PR_EDIT?DIAS_PT.map((d,k)=>`<th class="num ${k===dw?'pr-hoje':''}">${d.slice(0,3)}</th>`).join(''):`<th class="num pr-hoje">Para ${DIAS_PT[dw].toLowerCase()}</th>`}<th>Validade</th><th>Recipiente</th><th>Utensílio</th></tr>
      ${it.map(r=>`<tr><td><b>${esc(r.item)}</b></td>${PR_EDIT?[1,2,3,4,5,6,7].map(k=>`<td class="num"><input class="inp pr-in" data-id="${r.id}" data-q="q${k}" type="number" step="any" min="0" value="${r['q'+k]??''}" style="width:70px;padding:5px 6px;text-align:right" title="${r.unidade}"></td>`).join(''):`<td class="num pr-hoje"><b>${fmtQ(r[q],r.unidade)}</b></td>`}<td>${esc(r.validade||'')}</td><td>${esc(r.recipiente||'')}</td><td class="small">${esc(r.utensilio||'')}</td></tr>`).join('')}
    </table></div></div>`}).join('')+(PR_EDIT?'<p class="small muted mt">Quantidades em kg para itens a granel (0,25 = 250 g) e em unidades ou porções para os demais. Cada valor salva ao sair do campo.</p>':'');
  $$('#prLista .pr-in').forEach(el=>el.onchange=async()=>{const v=el.value===''?null:+el.value;if(await dbw(sb.from('producao_padrao').update({[el.dataset.q]:v}).eq('id',el.dataset.id),null)){const r=S.db.producao_padrao.find(x=>x.id==el.dataset.id);if(r)r[el.dataset.q]=v;toast('Quantidade salva.')}});
}
function initProducao(){
  $('#prLoja').onchange=renderProducao; $('#prData').onchange=renderProducao;
  $('#prEditar').onclick=()=>{PR_EDIT=!PR_EDIT;renderProducao()};
  $('#prImprimir').onclick=()=>{const loja=$('#prLoja').value,data=$('#prData').value,dw=(new Date(data+'T12:00').getDay()+6)%7,q='q'+(dw+1);
    const rs=(S.db.producao_padrao||[]).filter(p=>p.loja_id===loja).sort((a,b)=>a.ordem-b.ordem);if(!rs.length){toast('Sem padrão para imprimir.');return}
    const w=window.open('','_blank');if(!w){toast('Libere pop-ups para imprimir.');return}
    w.document.write(`<html><head><title>Produção ${esc(lojaNome(loja))} ${fmtD(data)}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 6px;background:#eee;padding:6px 8px}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #bbb;padding:5px 6px;text-align:left}td.n{text-align:right;font-weight:bold;width:90px}td.c{width:70px}.s{color:#555;font-size:12px}</style></head><body>
      <h1>Fat Buddha · Produção do dia · ${esc(lojaNome(loja))}</h1><div class="s">${DIAS_PT[dw]}, ${fmtD(data)} · padrão da planilha de média de produtos vendidos · Responsável: ____________________</div>
      ${uniq(rs.map(r=>r.secao)).map(s=>{const it=rs.filter(r=>r.secao===s),mont=(it.find(r=>r.montagem)||{}).montagem;return `<h2>${esc(s)}${mont?' · montar às '+esc(mont):''}</h2><table><tr><th>Item</th><th>Quantidade</th><th>Produzido</th><th>Validade</th><th>Recipiente</th><th>Utensílio</th></tr>${it.map(r=>`<tr><td>${esc(r.item)}</td><td class="n">${fmtQ(r[q],r.unidade)}</td><td class="c"></td><td>${esc(r.validade||'')}</td><td>${esc(r.recipiente||'')}</td><td>${esc(r.utensilio||'')}</td></tr>`).join('')}</table>`}).join('')}
      <script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()};
  $('#prCopiar').onclick=()=>{const destino=$('#prLoja').value,orig=uniq((S.db.producao_padrao||[]).map(p=>p.loja_id)).filter(l=>l!==destino);
    if(!orig.length){toast('Nenhuma loja com padrão para copiar.');return}
    modal(`<h3>Copiar padrão de produção</h3><p class="small muted">As quantidades são copiadas como ponto de partida para ${esc(lojaNome(destino))}. Ajuste depois em "Editar padrão da semana".</p>
      <label class="f mt">Copiar de<select class="inp" id="cpO">${optLojas(LOJAS.filter(l=>orig.includes(l.id)))}</select></label>
      <div class="actions mt"><button class="btn" id="cpNo">Cancelar</button><button class="btn pri" id="cpOk">Copiar</button></div>`,el=>{
      el.querySelector('#cpNo').onclick=fecharModal;
      el.querySelector('#cpOk').onclick=async()=>{const o=el.querySelector('#cpO').value;fecharModal();
        const rows=(S.db.producao_padrao||[]).filter(p=>p.loja_id===o).map(({id,updated_at,updated_by,loja_id,...r})=>Object.assign(r,{loja_id:destino}));
        if(await dbw(sb.from('producao_padrao').insert(rows),`${rows.length} itens copiados de ${lojaNome(o)}.`)){await load(['producao_padrao']);renderProducao()}}});
  };
}
function initCmvOp(){
  $$('#cmNav button').forEach(b=>b.onclick=()=>{cmSub=b.dataset.s;renderCmvTab()});
  initControle(); initPerdas(); initProducao();
}
