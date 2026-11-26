/* ================= MINHA LOJA ================= */
let mlSel=null;
function mlLojas(){return OPER.filter(l=>P.veTudo||S.minhas.includes(l.id))}
function diaRefLoja(id){
  const dias=diasDoMes(S.mes), hoje=isoHoje();
  const com=dias.filter(d=>IDX.vd.has(id+'|'+d));
  if(hoje.startsWith(S.mes)&&IDX.vd.has(id+'|'+hoje))return hoje;
  return com.at(-1)||(hoje.startsWith(S.mes)?hoje:fimMes(S.mes));
}
function renderLoja(){
  const ls=mlLojas(); if(!ls.length){$('#mlKpis').innerHTML='<div class="empty">Nenhuma loja em operação no seu acesso.</div>';return}
  if(!mlSel||!ls.some(l=>l.id===mlSel)) mlSel=(ls.find(l=>S.minhas.includes(l.id))||ls[0]).id;
  $('#mlLoja').innerHTML=optLojas(ls,mlSel); $('#mlLoja').disabled=ls.length===1;
  $('#mlLoja').onchange=()=>{mlSel=$('#mlLoja').value;$('#mlDia').value='';renderLoja();liveAtualizar()};
  const id=mlSel, L=LBYID[id];
  let ref=$('#mlDia').value; if(!ref||!ref.startsWith(S.mes)) ref=diaRefLoja(id);
  $('#mlDia').value=ref; $('#mlDia').min=iniMes(S.mes); $('#mlDia').max=fimMes(S.mes); $('#mlDia').onchange=renderLoja;
  const s=lojaStats(id), dias=diasDoMes(S.mes), ate=dias.filter(d=>d<=ref);
  const vd=d=>{const r=IDX.vd.get(id+'|'+d);return r?(+r.salao)+(+r.delivery):0};
  const vDia=vd(ref), rDia=IDX.vd.get(id+'|'+ref), pDia=rDia?rDia.pedidos_salao+rDia.pedidos_delivery:0;
  const mDia=metaDiaLoja(id,ref), acum=sum(ate,vd), mAcum=s.meta!=null?sum(ate,d=>metaDiaLoja(id,d)||0):null;
  const proj=s.meta!=null&&mAcum?acum/mAcum*s.meta:(ate.length?acum/ate.length*dias.length:null);
  const ML=METAS(id), v=s.vals, comDado=ML.filter(m=>m.meta!=null&&v[m.k]!=null), okN=comDado.filter(m=>status(m,v[m.k])==='ok').length;
  const rk=rankingRede(), pos=rk.findIndex(r=>r.l.id===id)+1;
  $('#mlInfo').textContent=`${L.canais==='salao+delivery'?'Salão + delivery':'Delivery'} · referência ${new Date(ref+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})}`;
  $('#mlKpis').innerHTML=
    kpi('Venda do dia',rDia?vDia:null,'brl',mDia?`meta do dia ${brl(mDia)} · ${rDia?nf0.format(vDia/mDia*100)+'%':'sem lançamento'}`:'sem meta do dia',mDia&&rDia?vDia/mDia*100:null)+
    kpi('Acumulado no mês',s.temVenda?acum:null,'brlK',mAcum?`${nf1.format(acum/mAcum*100)}% da meta até o dia (${brlK(mAcum)})`:'meta do mês não cadastrada',mAcum?acum/mAcum*100:null)+
    kpi('Projeção do mês',s.temVenda?proj:null,'brlK',s.meta?`meta ${brlK(s.meta)} · ${nf1.format(proj/s.meta*100)}%`:'no ritmo atual',s.meta&&proj?proj/s.meta*100:null)+
    kpi('Pedidos do dia',rDia?pDia:null,'int',pDia?`ticket ${'R$ '+nf2.format(vDia/pDia)}`:'')+
    kpi('Indicadores na meta',comDado.length?okN:null,'int',`de ${comDado.length} com dado no mês`,comDado.length?okN/comDado.length*100:null)+
    (rk.length>1?kpi('Posição no ranking',pos||null,'int',`de ${rk.length} lojas · ${mesTxt(S.mes)}`):kpi('Delivery no faturamento',s.fat?s.del/s.fat*100:null,'pct1',`${brlK(s.del)} no mês`,s.fat?s.del/s.fat*100:null));
  animateKpis($('#mlKpis'));
  const at=[];
  if(P.editar(id)) at.push(['Lançar venda',()=>{go('vendas');setTimeout(()=>{$('#vdLoja').value=id;$('#vdData').value=isoHoje();$('#vForm').scrollIntoView({behavior:'smooth'})},300)}]);
  if(P.operar(id)) at.push(['Registrar ruptura',()=>{ccSub='rup';go('cc');setTimeout(()=>{$('#ruLoja').value=id},200)}]);
  if(P.editar(id)) at.push(['Nova visita de qualidade',()=>{go('qualidade');setTimeout(()=>{$('#qLoja').value=id},200)}]);
  if(P.operar(id)) at.push(['Checklist de delivery',()=>{go('delivery');setTimeout(()=>{$('#dLoja').value=id;buildDel()},200)}]);
  if(P.editar(id)) at.push(['Novo plano de ação',()=>{go('planos');setTimeout(()=>{$('#pnLoja').value=id;$('#pnProb').focus()},200)}]);
  $('#mlAtalhos').innerHTML=at.map((a,i)=>`<button class="btn ${i===0?'pri':''}" data-at="${i}">${a[0]}</button>`).join('');
  $('#mlAtalhos').querySelectorAll('[data-at]').forEach(b=>b.onclick=at[+b.dataset.at][1]);
  // gráfico do mês
  const A=vendasPeriodo([id],iniMes(S.mes),fimMes(S.mes));
  if(s.temVenda||s.meta) mk('cMl',{type:'bar',data:{labels:A.datas.map(d=>d.slice(8,10)),datasets:[
    {type:'line',label:'Meta do dia',data:A.metaDia,borderColor:C.gold,borderWidth:2,borderDash:[5,4],pointRadius:0,tension:.3,order:0},
    {label:'Venda',data:A.dias.map(d=>d[0]+d[1]),backgroundColor:A.datas.map(d=>d===ref?'rgba(242,179,61,.95)':'rgba(229,48,63,.85)'),borderRadius:4,order:1}]},
    options:{interaction:{mode:'index',intersect:false},plugins:{tooltip:tipBrl},scales:{y:yR,x:Object.assign({ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:16}},xG)}}});
  else noData('cMl','Sem vendas nem meta no mês.');
  // semáforo
  $('#mlSemSub').textContent=mesLongo(S.mes);
  $('#mlSem').innerHTML=ML.map(m=>{const x=v[m.k],st=status(m,x);return `<div title="${esc(s.src[m.k]||'sem dado no mês')}"><span>${m.n}<br><span class="small muted">${m.txt}</span></span><b><span class="sem s-${st}" style="min-width:0">${fmt(m.f,x)}</span></b></div>`}).join('');
  // pendências
  const pa=(S.db.planos_acao||[]).filter(a=>a.loja_id===id&&!['Concluído','Cancelado'].includes(a.status)).sort((a,b)=>(atrasado(b)-atrasado(a))||(a.prazo||'9').localeCompare(b.prazo||'9'));
  $('#mlPa').innerHTML=pa.length?pa.slice(0,8).map(a=>`<div class="pa-row"><div><b>${esc(a.problema)}</b><br><span>${a.responsavel?esc(a.responsavel)+' · ':''}${a.prazo?'prazo '+fmtD(a.prazo):'sem prazo'}</span></div><span class="sem s-${atrasado(a)?'bad':a.status==='Em andamento'?'warn':'neu'}" style="min-width:0">${atrasado(a)?'Atrasada':a.status}</span></div>`).join('')+(pa.length>8?`<p class="small muted" style="margin-top:8px">+ ${pa.length-8} ações</p>`:''):'<div class="empty">Nenhuma ação em aberto.</div>';
  $('#mlVerPa').onclick=()=>{go('planos');setTimeout(()=>{$('#paLoja').value=id;renderPlanos()},100)};
  // alertas
  const al=alertasVisiveis().filter(a=>a.loja_id===id&&!a.resolvido).slice(0,12);
  $('#mlAlN').textContent=al.length?`${al.length} em aberto`:'';
  $('#mlAl').innerHTML=al.length?al.map(alertaHtml).join(''):'<div class="empty">Nenhum alerta em aberto.</div>';
  ligarAlertas($('#mlAl'));
  // última visita
  const vis=(S.db.visitas_qualidade||[]).filter(x=>x.loja_id===id).sort((a,b)=>b.data.localeCompare(a.data))[0];
  $('#mlVis').innerHTML=vis?`<div class="mini"><div class="ring">${ring(+vis.score,'nota')}</div><div class="small"><b>${fmtD(vis.data)}</b><br><span class="muted">${esc(vis.avaliador||'')}</span><br>${vis.nao} desvio${vis.nao===1?'':'s'} · ${(S.db.planos_acao||[]).filter(a=>a.origem==='visita'&&a.origem_id===vis.id&&!['Concluído','Cancelado'].includes(a.status)).length} ações abertas</div></div>`:'<div class="empty">Nenhuma visita registrada.</div>';
  // rupturas
  const sem=semanaDe(ref), semAnt=addDia(sem,-7), rs=(S.db.rupturas||[]).filter(r=>r.loja_id===id);
  const c1=rs.filter(r=>semanaDe(r.data)===sem).length, c0=rs.filter(r=>semanaDe(r.data)===semAnt).length;
  const mr=ML.find(m=>m.k==='rupturas'), metaR=mr&&mr.meta!=null?mr.meta:5;
  const top={};rs.filter(r=>r.data>=addDia(ref,-28)&&r.data<=ref).forEach(r=>top[r.item]=(top[r.item]||0)+1);
  const tp=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,3);
  $('#mlRup').innerHTML=`<div class="metas-list"><div><span>Semana de ${semTxt(sem)}</span><b><span class="sem s-${status({meta:metaR,t:'max'},c1)}" style="min-width:0">${c1}</span></b></div><div><span>Semana anterior</span><b><span class="sem s-${status({meta:metaR,t:'max'},c0)}" style="min-width:0">${c0}</span></b></div></div>${tp.length?`<p class="small muted" style="margin-top:10px">Mais faltam (4 semanas): ${tp.map(t=>esc(t[0])+' ('+t[1]+')').join(', ')}</p>`:''}`;
  // equipe
  const at_=people().filter(p=>p.loja_id===id).length, prev=sum(CARGOS,c=>quadroPrev(id,c)), rh=IDX.rh.get(id+'|'+S.mes);
  const g=people().find(p=>p.loja_id===id&&p.cargo==='Gerente de loja');
  const oc=P.veOco(id)?(S.db.ocorrencias||[]).filter(o=>o.loja_id===id&&o.data>=addDia(isoHoje(),-30)).length:null;
  $('#mlEq').innerHTML=`<div class="metas-list"><div><span>Gerente</span><b>${g?esc(g.nome):'—'}</b></div><div><span>Quadro</span><b><span class="sem s-${at_>=prev?'ok':at_>=prev*.8?'warn':'bad'}" style="min-width:0">${at_}/${prev}</span></b></div><div><span>Turnover · absenteísmo</span><b>${rh?nf1.format(turnOf(rh))+'% · '+nf1.format(absOf(rh))+'%':'—'}</b></div>${oc!=null?`<div><span>Ocorrências (30 dias)</span><b>${oc}</b></div>`:''}</div>`;
}

/* ================= ALERTAS ================= */
const AL_ICO={temperatura:'Temperatura',cmv:'CMV',plano:'Plano de ação',ruptura:'Rupturas',contagem:'Contagem',rh:'RH'};
function alertasVisiveis(){return (S.db.alertas||[]).slice().sort((a,b)=>(a.resolvido-b.resolvido)||((a.nivel==='critico'?0:1)-(b.nivel==='critico'?0:1))||b.criado_em.localeCompare(a.criado_em))}
const lidos = () => new Set((S.db.alertas_lidos||[]).map(x=>x.alerta_id));
function alertaHtml(a){const lido=lidos().has(a.id);return `<div class="alert al-item ${lido?'lido':''}" data-al="${a.id}"><span class="dot" style="background:${a.resolvido?'var(--green)':a.nivel==='critico'?'var(--bad)':'var(--amber)'}"></span><div><b>${esc(a.loja_id?lojaNome(a.loja_id):a.tipo==='rh'?'Matriz':'Cozinha central')} · ${esc(a.titulo)}</b><br><span>${esc(a.detalhe||'')}</span><div class="when">${AL_ICO[a.tipo]} · ${new Date(a.criado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}${a.resolvido?' · resolvido':''}${lido?' · lido':''}</div></div></div>`}
async function marcarLido(ids){ids=ids.filter(i=>!lidos().has(i));if(!ids.length)return;const {error}=await sb.from('alertas_lidos').insert(ids.map(i=>({user_id:S.user.id,alerta_id:i})));if(!error){await load(['alertas_lidos']);pintarSino()}}
function ligarAlertas(root){root.querySelectorAll('[data-al]').forEach(el=>el.onclick=async()=>{const a=(S.db.alertas||[]).find(x=>x.id==el.dataset.al);await marcarLido([a.id]);fecharModal();
  if(a.aba==='planos'){go('planos');setTimeout(()=>{$('#paLoja').value=a.loja_id;$('#paSt').value='atrasados';renderPlanos()},100)}
  else if(a.aba==='cc'){ccSub=a.tipo==='contagem'?'cont':'rup';go('cc')}
  else if(a.aba==='cmv'&&(a.chave||'').startsWith('ctl|')){const [,l,d]=a.chave.split('|');cmSub='ctl';CTL_RASC={};go('cmv');$('#ctlLoja').value=l;$('#ctlData').value=d;renderControle()}
  else if(a.aba==='cmv'){cmSub='sem';go('cmv')}
  else if(a.aba==='rh'){rhSub=P.veFolha?'folha':'quadro';go('rh')} else if(a.aba) go(a.aba)})}
function pintarSino(){
  const b=$('#bell'); if(P.papel==='colaborador'){b.classList.add('hidden');return}
  const L=lidos(), n=alertasVisiveis().filter(a=>!a.resolvido&&!L.has(a.id)).length;
  $('#bellN').textContent=n>99?'99+':n; $('#bellN').classList.toggle('hidden',!n);
  b.title=n?`${n} alerta${n>1?'s':''} não lido${n>1?'s':''}`:'Alertas';
}
async function abrirAlertas(filtro='abertos'){
  const L=lidos(), todos=alertasVisiveis();
  const lst=filtro==='abertos'?todos.filter(a=>!a.resolvido&&!L.has(a.id)):filtro==='todos'?todos:todos.filter(a=>!a.resolvido);
  modal(`<h3>Alertas <small><button class="btn sm" id="mX">Fechar</button></small></h3>
    <div class="actions" style="justify-content:space-between;margin-bottom:12px"><div class="subnav"><button data-f="abertos" class="${filtro==='abertos'?'on':''}">Não lidos</button><button data-f="pendentes" class="${filtro==='pendentes'?'on':''}">Em aberto</button><button data-f="todos" class="${filtro==='todos'?'on':''}">Todos</button></div><button class="btn sm" id="alTodos">Marcar todos como lidos</button></div>
    <div class="alerts" style="max-height:52vh">${lst.length?lst.slice(0,150).map(alertaHtml).join(''):'<div class="empty">Nenhum alerta aqui.</div>'}</div>
    <p class="small muted" style="margin-top:10px">Os alertas são recalculados a cada hora e na hora em que uma visita, contagem de CMV, ruptura ou plano de ação é salvo: temperatura fora da faixa, CMV acima da meta, ações atrasadas e rupturas acima da meta semanal.</p>
    <label class="f" style="flex-direction:row;align-items:center;gap:8px;margin-top:6px"><input type="checkbox" id="alEmail" ${S.perfil.alerta_email!==false?'checked':''}> Receber os alertas das minhas lojas por e-mail</label>
    ${P.admin?'<div class="banner" style="margin:12px 0 0" id="alStatus">Verificando o envio de e-mails…</div>':''}`,async el=>{
    el.querySelector('#mX').onclick=fecharModal;
    el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>abrirAlertas(b.dataset.f));
    el.querySelector('#alTodos').onclick=async()=>{await marcarLido(todos.filter(a=>!a.resolvido).map(a=>a.id));abrirAlertas(filtro)};
    el.querySelector('#alEmail').onchange=async e=>{const {error}=await sb.rpc('minha_pref_alerta',{receber:e.target.checked});if(error){toast('Não foi possível salvar.');return}S.perfil.alerta_email=e.target.checked;toast(e.target.checked?'Alertas por e-mail ligados.':'Alertas por e-mail desligados.')};
    ligarAlertas(el);
    if(P.admin){const {data}=await sb.functions.invoke('alertas-enviar',{body:{acao:'status'}});const st=el.querySelector('#alStatus');if(!st)return;
      st.innerHTML=data&&data.chave_configurada?`<b>Envio por e-mail ativo.</b> Remetente: ${esc(data.remetente)}. <button class="btn sm" id="alTeste" style="margin-left:6px">Enviar e-mail de teste</button>`:'<b>Envio por e-mail ainda desligado.</b> Os alertas aparecem aqui no portal; o envio por e-mail liga quando a chave do serviço de e-mail (Resend) for cadastrada.';
      const t=el.querySelector('#alTeste');if(t)t.onclick=async()=>{const {data:r}=await sb.functions.invoke('alertas-enviar',{body:{acao:'teste'}});toast(r&&r.ok?'E-mail de teste enviado para '+r.para:'Falha no envio: '+((r&&r.erro)||'erro'))}}
  });
}

/* ================= APP INSTALÁVEL (PWA) ================= */
let promptInstalar=null;
const ehIOS=/iphone|ipad|ipod/i.test(navigator.userAgent), standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptInstalar=e;$('#btnInstalar').classList.remove('hidden')});
addEventListener('appinstalled',()=>{$('#btnInstalar').classList.add('hidden');toast('Portal instalado neste aparelho.')});
function initPWA(){
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  const b=$('#btnInstalar');
  if(!standalone&&ehIOS) b.classList.remove('hidden');
  b.onclick=async()=>{
    if(promptInstalar){promptInstalar.prompt();const r=await promptInstalar.userChoice;promptInstalar=null;if(r.outcome==='accepted')b.classList.add('hidden');return}
    modal(`<h3>Instalar no iPhone <small><button class="btn sm" id="mX">Fechar</button></small></h3><ol style="padding-left:18px;line-height:1.9"><li>No Safari, toque em <b>Compartilhar</b> (o quadrado com a seta para cima).</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li><li>Toque em <b>Adicionar</b>. O ícone da Fat Buddha aparece na tela inicial e o portal abre em tela cheia.</li></ol>`,el=>el.querySelector('#mX').onclick=fecharModal);
  };
}
