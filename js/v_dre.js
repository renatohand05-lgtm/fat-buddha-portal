/* ================= DRE (visão clara: rede ou loja, mês ou acumulado, realizado x ideal) ================= */
let DRE_ESC='rede', DRE_MODO='mes';
// metas ideais (% do faturamento) do modelo de fechamento da empresa; editáveis pela gestão
const DRE_IDEAL0={imp:9,cmv:31,cdel:23,mc:37,folha:10,ocup:5,mkt:6.3,res:16,prime:41};
const dreIdeal=()=>Object.assign({},DRE_IDEAL0,cfg('dre_ideal')||{});
// linhas como a empresa lê o fechamento; "ocup" agrega CTO, água, energia e manutenção
const DRE_V=[
  {k:'fat',n:'Faturamento bruto',t:'tot'},
  {k:'imp',n:'Impostos sobre vendas',t:'neg',i:'imp'},
  {k:'rl',n:'Receita líquida',t:'sub'},
  {k:'cmv',n:'CMV',d:'alimentos, bebidas e descartáveis',t:'neg',i:'cmv'},
  {k:'cdel',n:'Custos financeiros e delivery',d:'taxas de cartão, aplicativos e motoboys',t:'neg',i:'cdel'},
  {k:'mc',n:'Margem de contribuição',t:'sub',i:'mc',pos:1},
  {k:'folha',n:'Pessoal (CMO)',d:'folha, encargos e benefícios',t:'neg',i:'folha'},
  {k:'ocup',n:'Ocupação e infraestrutura',d:'aluguel (CTO), água, energia e manutenção',t:'neg',i:'ocup'},
  {k:'mkt',n:'Despesas administrativas e comerciais',d:'marketing, royalties, escritório e serviços',t:'neg',i:'mkt'},
  {k:'res',n:'Resultado operacional (EBITDA)',t:'res',i:'res',pos:1},
];
const DRE_KEYS=['fat','imp','cmv','cdel','folha','man','mkt','cto','agua','energia'];
// normaliza o resultado de dreCalc para as linhas de leitura
function dreV(d){
  if(!d)return null;
  const o={fat:d.fat,imp:d.imp,rl:d.fat-d.imp,cmv:d.cmv,cdel:d.cdel,folha:d.folha,mkt:d.mkt,ocup:d.cto+d.agua+d.energia+d.man,
    cto:d.cto,agua:d.agua,energia:d.energia,man:d.man,res:d.res,oficial:!!d.oficial,est:Object.assign({},d.est||{})};
  o.mc=o.fat-o.imp-o.cmv-o.cdel; o.prime=o.cmv+o.folha;
  o.est.ocup=['cto','agua','energia','man'].some(k=>o.est[k]); o.est.mc=o.est.imp||o.est.cmv||o.est.cdel; o.est.res=DRE_V.some(l=>l.t==='neg'&&o.est[l.k]);
  const fix=o.folha+o.ocup+o.mkt, varp=o.fat?(o.imp+o.cmv+o.cdel)/o.fat:1; o.pe=varp<1?fix/(1-varp):null;
  return o;
}
const dreSoma=a=>{a=a.filter(Boolean);if(!a.length)return null;const o={est:{}};['fat','imp','rl','cmv','cdel','folha','mkt','ocup','cto','agua','energia','man','res','mc','prime'].forEach(k=>o[k]=sum(a,x=>x[k]));
  Object.keys(a[0].est).forEach(k=>o.est[k]=a.some(x=>x.est[k]));o.oficial=a.every(x=>x.oficial);const fix=o.folha+o.ocup+o.mkt,varp=o.fat?(o.imp+o.cmv+o.cdel)/o.fat:1;o.pe=varp<1?fix/(1-varp):null;return o};
// entidades com dados no mês: lojas (com venda ou fechamento) e a rede
function dreMes(mes){
  const {cols}=dreRede(mes);
  const lojas=cols.map(c=>({id:c.id,nome:c.nome,v:dreV(c.d)}));
  return {lojas,rede:lojas.length?dreSoma(lojas.map(x=>x.v)):null};
}
const dreEscopo=(mes)=>{const m=dreMes(mes);return DRE_ESC==='rede'?m.rede:(m.lojas.find(x=>x.id===DRE_ESC)||{}).v||null};
const dreMesesAno=()=>{const y=S.mes.slice(0,4);const a=[];for(let m=y+'-01';m<=S.mes;m=addMes(m,1))a.push(m);return a};
function dreAcum(id){const ms=dreMesesAno().map(m=>{const x=dreMes(m);return id==='rede'?x.rede:(x.lojas.find(l=>l.id===id)||{}).v}).filter(Boolean);return ms.length?Object.assign(dreSoma(ms),{n:ms.length}):null}
const dreSt=(l,pct,I)=>{const id=I[l.i];if(id==null||pct==null||!isFinite(pct))return 'neu';return l.pos?(pct>=id?'ok':pct>=id-3?'warn':'bad'):(pct<=id?'ok':pct<=id+2?'warn':'bad')};
const drePct=(v,f)=>f?v/f*100:null;
const dreChip=(l,v,f,I)=>{const p=drePct(v,f);if(p==null)return '—';return `<span class="sem s-${dreSt(l,p,I)}" style="min-width:0">${nf1.format(p)}%</span>`};

function renderDRE(){
  const I=dreIdeal(), ano=DRE_MODO==='ano', mm=dreMes(S.mes);
  // seletor de escopo
  const escs=[{id:'rede',n:'Rede'}].concat(OPER.filter(l=>P.veTudo||S.minhas.includes(l.id)).map(l=>({id:l.id,n:l.nome})));
  if(!P.veTudo&&DRE_ESC==='rede'&&escs.length>1&&!mm.lojas.length)DRE_ESC=escs[1].id;
  if(!escs.some(e=>e.id===DRE_ESC))DRE_ESC=escs[0].id;
  $('#dreEsc').innerHTML=escs.map(e=>`<button data-e="${e.id}" class="${e.id===DRE_ESC?'on':''}">${e.id!=='rede'?`<span class="cmg-dot" style="--cor:${PAL[LOJAS.findIndex(l=>l.id===e.id)%PAL.length]}"></span>`:''}${esc(e.n)}</button>`).join('');
  $$('#dreEsc button').forEach(b=>b.onclick=()=>{DRE_ESC=b.dataset.e;renderDRE()});
  $$('#dreModo button').forEach(b=>{b.classList.toggle('on',b.dataset.m===DRE_MODO);b.onclick=()=>{DRE_MODO=b.dataset.m;renderDRE()}});
  const nomeEsc=DRE_ESC==='rede'?'Rede':lojaNome(DRE_ESC), per=ano?`${mesTxt(S.mes.slice(0,4)+'-01')} a ${mesTxt(S.mes)}`:mesLongo(S.mes);
  const cur=ano?dreAcum(DRE_ESC):dreEscopo(S.mes), prevM=addMes(S.mes,-1), prv=ano?null:dreEscopo(prevM);
  const ofi=cur&&cur.oficial, temEst=cur&&DRE_V.some(l=>cur.est[l.k]);
  $('#dreBadge').innerHTML=!cur?'':ofi?'<span class="dre-tag ok">Fechamento oficial</span>':temEst?'<span class="dre-tag warn">Inclui estimativas</span>':'<span class="dre-tag">Realizado</span>';
  $('#drePer').textContent=`${nomeEsc} · ${per}`;
  // KPIs
  const pc=(v,f)=>f?v/f*100:null, dl=(a,b,u)=>a==null||b==null?'':` · ${a-b>=0?'▲':'▼'} ${u==='%'?nf1.format(Math.abs(a-b))+' p.p.':brlK(Math.abs(a-b))} vs ${mesTxt(prevM)}`;
  if(!cur){
    $('#dreKpis').innerHTML=['Faturamento','Resultado operacional','Margem operacional','CMV','Prime cost (CMV + pessoal)'].map(t=>kpi(t,null,'brl','sem dados no período')).join('');animateKpis($('#dreKpis'));
    ['#dreIdeal','#tDre'].forEach(s=>$(s).innerHTML='<tr><td><div class="empty">Sem vendas nem fechamento lançados neste período.</div></td></tr>');noData('cDreCasc');
  } else {
    const mg=pc(cur.res,cur.fat), cm=pc(cur.cmv,cur.fat), pr=pc(cur.prime,cur.fat);
    $('#dreKpis').innerHTML=kpi('Faturamento',cur.fat,'brlK',(ano?`${cur.n} ${cur.n===1?'mês':'meses'}`:mesLongo(S.mes))+(prv?dl(cur.fat,prv.fat):''))+
      kpi('Resultado operacional',cur.res,'brlK',cur.res>=0?'lucro operacional (EBITDA)':'prejuízo operacional')+
      kpi('Margem operacional',mg,'pct1',`ideal ${nf1.format(I.res)}%`+(prv?dl(mg,pc(prv.res,prv.fat),'%'):''),mg!=null?Math.max(0,Math.min(100,mg/I.res*100)):null)+
      kpi('CMV',cm,'pct1',`ideal até ${nf1.format(I.cmv)}%`+(prv?dl(cm,pc(prv.cmv,prv.fat),'%'):''))+
      kpi('Prime cost (CMV + pessoal)',pr,'pct1',`ideal até ${nf1.format(I.prime)}%`+(cur.pe?` · equilíbrio ${brlK(cur.pe)}`:''));
    animateKpis($('#dreKpis'));
    $$('#dreKpis .kpi').forEach((el,i)=>{const s=[null,cur.res>=0?'ok':'bad',dreSt(DRE_V[9],mg,I),dreSt(DRE_V[3],cm,I),pr==null?null:pr<=I.prime?'ok':pr<=I.prime+3?'warn':'bad'][i];if(s)el.classList.add('kpi-'+s)});
    // cascata: do faturamento ao resultado
    const passos=[['Faturamento',cur.fat,'tot'],['Impostos',-cur.imp],['CMV',-cur.cmv],['Financeiros e delivery',-cur.cdel],['Margem de contribuição',cur.mc,'sub'],['Pessoal',-cur.folha],['Ocupação',-cur.ocup],['Adm. e comerciais',-cur.mkt],['Resultado',cur.res,'res']];
    let acc=0;const bars=passos.map(([n,v,t])=>{if(t){acc=v;return [0,v]}const a=acc;acc+=v;return [a,acc]});
    const cores=passos.map(([n,v,t])=>t==='tot'?'rgba(185,170,158,.55)':t==='sub'?'rgba(238,219,202,.35)':t==='res'?(v>=0?'#2c9f73':'#d93a48'):'rgba(217,58,72,.62)');
    mk('cDreCasc',{type:'bar',data:{labels:passos.map(p=>p[0]),datasets:[{label:'Valor',data:bars,backgroundColor:cores,borderRadius:4,borderSkipped:false,maxBarThickness:56}]},
      options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>{const p=passos[c.dataIndex];return ` ${brl(p[1])} · ${nf1.format(pc(Math.abs(p[1]),cur.fat))}% do faturamento`}}}},
        scales:{y:{...yR,beginAtZero:true},x:{...xG,ticks:{autoSkip:false,maxRotation:0,font:{size:11},callback:function(v){const s=this.getLabelForValue(v);return s.length>12?s.split(' ').reduce((a,w)=>{const l=a[a.length-1];if((l+' '+w).trim().length>12)a.push(w);else a[a.length-1]=(l+' '+w).trim();return a},['']):s}}}}}});
    // realizado x ideal
    $('#dreIdeal').innerHTML=DRE_V.filter(l=>l.i).map(l=>{const p=pc(cur[l.k],cur.fat), id=I[l.i], st=dreSt(l,p,I), mx=Math.max(id*1.8,p||0,1);
      const imp=p==null?null:(l.pos?(p-id):(id-p))*cur.fat/100;
      return `<div class="dri"><div class="dri-h"><span>${l.n}</span><b class="sem s-${st}" style="min-width:0">${p==null?'—':nf1.format(p)+'%'}</b></div>
        <div class="dri-bar"><i class="s-${st}" style="width:${Math.max(0,Math.min(100,(p||0)/mx*100))}%"></i><em style="left:${id/mx*100}%" title="ideal ${nf1.format(id)}%"></em></div>
        <div class="dri-f"><span>ideal ${l.pos?'a partir de':'até'} ${nf1.format(id)}%</span><span class="${imp==null?'':imp>=0?'pos':'neg'}">${imp==null?'':(imp>=0?'+':'−')+brlK(Math.abs(imp))+(l.pos?' vs ideal':imp>=0?' abaixo do ideal':' acima do ideal')}</span></div></div>`}).join('');
    // tabela principal
    const cols=DRE_ESC==='rede'?(ano?mm.lojas.map(l=>({nome:l.nome,cor:PAL[LOJAS.findIndex(x=>x.id===l.id)%PAL.length],v:dreAcum(l.id)})).filter(c=>c.v):mm.lojas.map(l=>({nome:l.nome,cor:PAL[LOJAS.findIndex(x=>x.id===l.id)%PAL.length],v:l.v}))).concat([{nome:'Rede',v:cur,rede:1}]):[{nome:nomeEsc,v:cur}];
    const zero=k=>['ocup'].includes(k)&&false;
    $('#tDre').innerHTML=`<tr><th>Linha</th>${cols.map(c=>`<th class="num" colspan="2">${c.cor?`<span class="cmg-dot" style="--cor:${c.cor}"></span>`:''}${esc(c.nome)}</th>`).join('')}<th class="num">Ideal</th>${cols.length===1?'<th class="num">vs ideal</th>':''}</tr>`+
      DRE_V.map(l=>`<tr class="l-${l.t}"><td>${l.t==='neg'?'<span class="dre-op">−</span>':l.t==='sub'||l.t==='res'?'<span class="dre-op">=</span>':''}${l.n}${l.d?`<div class="small muted">${l.d}</div>`:''}</td>${cols.map(c=>{const v=c.v[l.k],e=c.v.est&&c.v.est[l.k]?'<span class="est" title="estimado pela premissa">est.</span>':'';
        return `<td class="num ${l.t==='res'?(v>=0?'up':'down'):''}">${l.t==='neg'||v<0?'− ':''}${brl(Math.abs(v))}${e}</td><td class="num pc">${l.k==='fat'?'100%':l.i?dreChip(l,v,c.v.fat,I):nf1.format(drePct(v,c.v.fat))+'%'}</td>`}).join('')}
        <td class="num pc">${l.i?(l.pos?'≥ ':'≤ ')+nf1.format(I[l.i])+'%':''}</td>${cols.length===1?`<td class="num">${l.i&&cur.fat?(()=>{const p=drePct(cur[l.k],cur.fat),d=l.pos?p-I[l.i]:I[l.i]-p;return `<span class="${d>=0?'pos':'neg'}">${d>=0?'+':'−'}${brlK(Math.abs(d)*cur.fat/100)}</span>`})():''}</td>`:''}</tr>`).join('')+
      `<tr class="l-sub"><td>Ponto de equilíbrio<div class="small muted">faturamento que zera o resultado, com os custos fixos do período</div></td>${cols.map(c=>`<td class="num">${c.v.pe?brl(c.v.pe):'—'}</td><td class="num pc">${c.v.pe?(c.v.fat>=c.v.pe?`<span class="pos">folga de ${brlK(c.v.fat-c.v.pe)}</span>`:`<span class="neg">faltam ${brlK(c.v.pe-c.v.fat)}</span>`):'<span class="neg" title="Impostos, CMV e custos financeiros passam do faturamento">custos variáveis acima da venda</span>'}</td>`).join('')}<td></td>${cols.length===1?'<td></td>':''}</tr>`;
    const notas=[];
    if(ofi)notas.push('Valores do fechamento oficial. Água, energia e manutenção estão dentro de Ocupação e infraestrutura; despesas administrativas, comerciais e tarifas bancárias estão em Despesas administrativas e comerciais.');
    if(temEst)notas.push('"est." = linha sem valor realizado, calculada pela premissa (veja Premissas no fim da página).');
    notas.push('Ideal: metas do modelo de fechamento da empresa, em % do faturamento. A coluna "vs ideal" mostra quanto a linha ganha (+) ou custa (−) em relação ao ideal.');
    $('#dreNota').textContent=notas.join(' ');
  }
  $('#dreTabTit').firstChild.textContent=DRE_ESC==='rede'?'DRE por loja ':'DRE · '+nomeEsc+' ';
  $('#dreTabSub').textContent=per;
  // mês a mês
  const ms=dreMesesAno(), serie=ms.map(m=>({m,v:DRE_ESC==='rede'?dreMes(m).rede:(dreMes(m).lojas.find(l=>l.id===DRE_ESC)||{}).v})).filter(x=>x.v);
  $('#dreMmSub').textContent=`${nomeEsc} · ${S.mes.slice(0,4)}`;
  const acc=dreSoma(serie.map(x=>x.v));
  $('#tDreMm').innerHTML=serie.length?`<tr><th>Linha</th>${serie.map(x=>`<th class="num ${x.m===S.mes?'cur':''}">${mesTxt(x.m)}${x.v.oficial?'':'<div class="est" style="margin:2px 0 0">est.</div>'}</th>`).join('')}<th class="num acc">Acumulado</th></tr>`+
    DRE_V.map(l=>`<tr class="l-${l.t}"><td>${l.n}</td>${serie.map(x=>`<td class="num ${x.m===S.mes?'cur':''} ${l.t==='res'?(x.v[l.k]>=0?'up':'down'):''}">${l.t==='neg'?'− ':''}${brlK(l.t==='neg'?Math.abs(x.v[l.k]):x.v[l.k])}<div class="pcs">${l.k==='fat'?'':l.i?dreChip(l,x.v[l.k],x.v.fat,I):nf1.format(drePct(x.v[l.k],x.v.fat))+'%'}</div></td>`).join('')}<td class="num acc ${l.t==='res'?(acc[l.k]>=0?'up':'down'):''}"><b>${l.t==='neg'?'− ':''}${brlK(l.t==='neg'?Math.abs(acc[l.k]):acc[l.k])}</b><div class="pcs">${l.k==='fat'?'':l.i?dreChip(l,acc[l.k],acc.fat,I):nf1.format(drePct(acc[l.k],acc.fat))+'%'}</div></td></tr>`).join('')
    :'<tr><td><div class="empty">Sem meses com dados neste ano.</div></td></tr>';
  // evolução: faturamento (empilhado por loja na rede) e margem operacional
  if(serie.length){
    const labs=serie.map(x=>mesTxt(x.m));
    const dsF=DRE_ESC==='rede'?OPER.filter(l=>serie.some(x=>dreMes(x.m).lojas.some(y=>y.id===l.id))).map(l=>({label:l.nome,data:serie.map(x=>{const y=dreMes(x.m).lojas.find(z=>z.id===l.id);return y?y.v.fat:null}),backgroundColor:PAL[LOJAS.findIndex(z=>z.id===l.id)%PAL.length],borderRadius:4,stack:'f',borderColor:'#1d1715',borderWidth:{top:2}}))
      :[{label:'Faturamento',data:serie.map(x=>x.v.fat),backgroundColor:PAL[LOJAS.findIndex(z=>z.id===DRE_ESC)%PAL.length],borderRadius:4}];
    mk('cDreFat',{type:'bar',data:{labels:labs,datasets:dsF},options:{plugins:{legend:{display:dsF.length>1},tooltip:tipBrl},scales:{y:{...yR,stacked:true},x:{...xG,stacked:true}}}});
    mk('cDreMg',{type:'line',data:{labels:labs,datasets:[{label:'Margem operacional',data:serie.map(x=>drePct(x.v.res,x.v.fat)),borderColor:'#f7eee6',backgroundColor:serie.map(x=>x.v.res>=0?'#2c9f73':'#d93a48'),pointRadius:5,pointHoverRadius:7,borderWidth:2,tension:.25},
      {label:`Ideal ${nf1.format(I.res)}%`,data:serie.map(()=>I.res),borderColor:'rgba(255,236,220,.5)',borderDash:[6,5],pointRadius:0,borderWidth:1.5}]},options:{interaction:{mode:'index',intersect:false},plugins:{tooltip:tipPct},scales:{y:yPct,x:xG}}});
  } else {noData('cDreFat');noData('cDreMg')}
  // premissas, metas ideais e lançamentos
  const base=dreBase(), DEF=Object.assign({},base);
  prmInputs($('#drePrm'),base,DEF,FIELDS_DRE.concat(FIELDS_DRE_EST),async()=>{if(await dbw(sb.from('config').upsert({chave:'dre',valor:base}),'Premissas salvas.')){await load(['config']);renderDRE()}},!P.gestor);
  const exc=OPER.filter(l=>IDX.prem[l.id]&&Object.keys(IDX.prem[l.id]).length).map(l=>`${l.nome}: ${Object.entries(IDX.prem[l.id]).map(([k,v])=>({delivery:'custos de delivery',impostos:'impostos',manutencao:'manutenção',marketing:'marketing',cto:'CTO',agua:'água',energia:'energia',cmv:'CMV',pessoal:'folha'}[k]||k)+' '+(['cto','agua','energia'].includes(k)?brl(v):nf1.format(v).replace(',0','')+'%')).join(', ')}`);
  $('#drePrmNote').textContent=(exc.length?'Exceções por loja: '+exc.join(' · ')+'. ':'')+'As premissas só entram quando a linha não tem valor realizado no mês (aparecem como "est.").';
  const IDF=[{k:'imp',n:'Impostos (até)',u:'%'},{k:'cmv',n:'CMV (até)',u:'%'},{k:'cdel',n:'Custos financeiros e delivery (até)',u:'%'},{k:'mc',n:'Margem de contribuição (a partir de)',u:'%'},{k:'folha',n:'Pessoal (até)',u:'%'},{k:'prime',n:'Prime cost (até)',u:'%'},{k:'ocup',n:'Ocupação e infraestrutura (até)',u:'%'},{k:'mkt',n:'Adm. e comerciais (até)',u:'%'},{k:'res',n:'Resultado operacional (a partir de)',u:'%'}];
  const II=dreIdeal();
  prmInputs($('#dreIdealPrm'),II,Object.assign({},DRE_IDEAL0),IDF,async()=>{if(await dbw(sb.from('config').upsert({chave:'dre_ideal',valor:II}),'Metas ideais salvas.')){await load(['config']);renderDRE()}},!P.gestor);
  const lanc=(S.db.dre_lancamentos||[]).filter(r=>r.mes===S.mes&&(DRE_ESC==='rede'||r.loja_id===DRE_ESC)).sort((a,b)=>a.loja_id.localeCompare(b.loja_id)||DRE_KEYS.indexOf(a.linha)-DRE_KEYS.indexOf(b.linha));
  $('#dreLancN').textContent=lanc.length?`${lanc.length} lançamento${lanc.length===1?'':'s'} em ${mesTxt(S.mes)}`:`nenhum lançamento em ${mesTxt(S.mes)}`;
  $('#tDreLanc').innerHTML=lanc.length?`<tr><th>Loja</th><th>Linha</th><th class="num">Valor</th><th>Observação</th><th></th></tr>`+lanc.map(r=>`<tr><td><b>${esc(lojaNome(r.loja_id))}</b></td><td>${NOME_LINHA[r.linha]}</td><td class="num">${brl(r.valor)}</td><td class="small" style="white-space:normal;min-width:260px">${esc(r.obs)||'—'}</td><td class="num">${P.excluir(r.loja_id)?`<button class="btn sm" data-dl="${r.id}">Excluir</button>`:''}</td></tr>`).join(''):`<tr><td><div class="empty">Nenhum valor realizado lançado em ${mesLongo(S.mes)}.</div></td></tr>`;
  $('#tDreLanc').querySelectorAll('[data-dl]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este lançamento? A linha volta a usar a estimativa.'))return;if(await dbw(sb.from('dre_lancamentos').delete().eq('id',b.dataset.dl),'Lançamento excluído.')){await load(['dre_lancamentos']);renderDRE()}});
  if(DRE_ESC!=='rede'&&[...$('#drLoja').options].some(o=>o.value===DRE_ESC))$('#drLoja').value=DRE_ESC;
}
function initDRE(){
  $('#drLoja').innerHTML=optLojas(lojasEditaveis(true));
  $('#drSave').onclick=async()=>{const r={loja_id:$('#drLoja').value,mes:S.mes,linha:$('#drLinha').value,valor:num($('#drValor').value),obs:$('#drObs').value||null};
    if(r.valor==null||r.valor<0){toast('Informe um valor válido.');return}
    if(await dbw(sb.from('dre_lancamentos').upsert(r,{onConflict:'loja_id,mes,linha'}),`${NOME_LINHA[r.linha]} de ${mesTxt(S.mes)} salvo.`)){$('#drValor').value='';$('#drObs').value='';await load(['dre_lancamentos']);renderDRE()}};
}
