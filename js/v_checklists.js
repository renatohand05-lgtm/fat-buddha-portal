/* ---------------- checklists (itens originais, sem alteração) ---------------- */
const CK_QUAL = [
  {s:'Produção, qualidade e segurança alimentar', i:['Fichas técnicas disponíveis e seguidas','Porcionamento conforme o padrão','Temperaturas de cocção e conservação registradas','Uniforme, touca e higiene das mãos da equipe','Separação de alimentos crus e prontos','Montagem e apresentação dos pratos no padrão']},
  {s:'Estoque, validade e abastecimento', i:['Itens abertos com etiqueta de validade','PVPS/PEPS aplicado no estoque','Câmaras e freezers na temperatura correta','Nenhum produto vencido ou sem identificação','Inventário dos itens críticos em dia','Abastecimento da cozinha central conforme o pedido']},
  {s:'Delivery, embalagem e expedição', i:['Conferência do pedido antes da saída','Embalagens lacradas e com selo','Pedido completo, com itens e adicionais corretos','Tempo de expedição dentro do padrão','Área de retirada organizada','Itens quentes e frios separados']},
  {s:'Limpeza, manutenção e estrutura', i:['Cozinha e salão limpos','Cronograma de limpeza preenchido','Equipamentos funcionando','Coifa, ralos e lixeiras em ordem','Controle de pragas em dia','Banheiros limpos e abastecidos']},
  {s:'Escalas, pessoas e liderança', i:['Escala cumprida nos horários de pico','Faltas cobertas sem desfalcar a operação','Líder de turno presente','Reunião pré-turno realizada','Treinamentos registrados']},
  {s:'Cumprimento dos padrões operacionais', i:['Cardápio atualizado nas plataformas','Atendimento do salão no padrão (Brooklyn)','Uniformes e identidade visual no padrão','Planos de ação da visita anterior concluídos','Checklists de abertura e fechamento preenchidos']},
  {s:'Equipamentos, temperaturas e estoques', i:[
    {n:'Câmara de resfriados', tipo:'temp', min:1, max:4, foto:true},
    {n:'Geladeiras e freezers de resfriados', tipo:'temp', min:1, max:4, foto:true},
    {n:'Câmara de congelados', tipo:'temp', min:-21, max:-14, foto:true},
    {n:'Freezers de congelados', tipo:'temp', min:-21, max:-14, foto:true},
    {n:'Chapa funcionando, limpa e aquecendo no padrão', foto:true},
    {n:'Fritadeira funcionando, óleo filtrado e dentro do prazo de troca', foto:true},
    {n:'Foto visual do estoque seco organizado (PVPS, etiquetas, nada no chão)', foto:true},
    {n:'Foto visual das câmaras e freezers organizados', foto:true}]},
];
/* item do checklist: texto (itens originais) ou objeto (temperatura / foto obrigatória) */
const itTxt = it => typeof it==='string'?it:(it.tipo==='temp'?`${it.n} — entre ${fmtT(it.min)} e ${fmtT(it.max)}`:it.n);
const itObj = it => typeof it==='string'?{n:it}:it;
const fmtT = v => (v<0?'−':'')+nf1.format(Math.abs(v)).replace(',0','')+' °C';
const IC_CAM='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>';
/* fotos: compressão no navegador e envio ao armazenamento privado */
async function comprimir(file){
  try{const bm=await createImageBitmap(file);const k=Math.min(1,1600/Math.max(bm.width,bm.height));const c=document.createElement('canvas');c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b||file),'image/jpeg',.8))}catch(e){return file}
}
async function enviarFoto(loja,file){
  const blob=await comprimir(file); if(blob.size>5*1024*1024){toast('Foto acima de 5 MB.');return null}
  const path=`${loja}/${ymOf($('#qData').value||isoHoje())}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
  const {error}=await sb.storage.from('checklist-fotos').upload(path,blob,{contentType:'image/jpeg',upsert:false});
  if(error){toast(/row-level|security|403/i.test(error.message)?'Sem permissão para enviar fotos desta loja.':'Falha ao enviar foto: '+error.message);return null}
  return path;
}
const URLS={};
async function urlFoto(p){if(URLS[p]&&URLS[p].t>Date.now())return URLS[p].u;const {data}=await sb.storage.from('checklist-fotos').createSignedUrl(p,3600);if(!data)return '';URLS[p]={u:data.signedUrl,t:Date.now()+3e6};return data.signedUrl}
async function pintarFotos(root){
  for(const im of root.querySelectorAll('img[data-src]')){const u=await urlFoto(im.dataset.src);if(u){im.src=u;im.removeAttribute('data-src')}}
}
function galeria(titulo,paths){
  modal(`<h3>${esc(titulo)} <small><button class="btn sm" id="mX">Fechar</button></small></h3><div class="galeria">${paths.map(p=>`<a data-full="${esc(p)}"><img data-src="${esc(p)}" alt=""></a>`).join('')||'<div class="empty">Sem fotos.</div>'}</div>`,async el=>{
    el.querySelector('#mX').onclick=fecharModal; await pintarFotos(el);
    el.querySelectorAll('[data-full]').forEach(a=>a.onclick=async()=>window.open(await urlFoto(a.dataset.full),'_blank'));
  });
}
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
    sec.i.map((it,ii)=>{const o=itObj(it),k=qKey(si,ii);return `<div class="item ${o.foto?'fobr':''}" id="qi${k}"><span>${esc(itTxt(it))}${o.foto?' <span class="tag" style="font-size:10.5px">foto obrigatória</span>':''}</span><div class="qctl">${o.tipo==='temp'?`<div class="inwrap" style="width:108px"><input class="inp tmp" type="number" step="0.1" data-t="${k}" placeholder="medido"><em>°C</em></div>`:''}<label class="btn sm fbtn" title="Adicionar foto">${IC_CAM}<input type="file" accept="image/*" capture="environment" multiple hidden data-fu="${k}"></label><div class="seg" data-k="${k}"><button data-v="sim">Sim</button><button data-v="nao">Não</button><button data-v="na">N/A</button></div></div><input class="inp obs" placeholder="Evidência / observação" data-o="${k}"><div class="fotos" data-fk="${k}"></div></div>`}).join('')}</div></div>`).join('');
  $('#qSecs').querySelectorAll('.sec-h').forEach(h=>h.onclick=()=>h.parentElement.classList.toggle('closed'));
  $('#qSecs').querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{const k=b.parentElement.dataset.k;Q[k]=Q[k]||{};Q[k].v=Q[k].v===b.dataset.v?null:b.dataset.v;paintQual()});
  $('#qSecs').querySelectorAll('.obs').forEach(i=>{i.value=(Q[i.dataset.o]||{}).o||'';i.oninput=()=>{const k=i.dataset.o;Q[k]=Q[k]||{};Q[k].o=i.value}});
  $('#qSecs').querySelectorAll('.tmp').forEach(i=>{const k=i.dataset.t;i.value=(Q[k]||{}).t??'';i.oninput=()=>{Q[k]=Q[k]||{};const [si,ii]=k.split('-').map(Number),o=itObj(CK_QUAL[si].i[ii]);
    if(i.value===''){delete Q[k].t;if(Q[k].v!=='na')Q[k].v=null}else{const t=+i.value;Q[k].t=t;Q[k].v=t>=o.min&&t<=o.max?'sim':'nao'}paintQual()}});
  $('#qSecs').querySelectorAll('[data-fu]').forEach(inp=>inp.onchange=async()=>{const k=inp.dataset.fu, loja=$('#qLoja').value;if(!loja){toast('Selecione a loja antes das fotos.');return}
    const fs=[...inp.files];inp.value='';if(!fs.length)return;busy(true);
    for(const f of fs){const p=await enviarFoto(loja,f);if(p){Q[k]=Q[k]||{};(Q[k].f=Q[k].f||[]).push(p)}}
    busy(false);paintQual();toast(fs.length>1?'Fotos adicionadas.':'Foto adicionada.')});
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
  $$('#qSecs .seg').forEach(sg=>{const k=sg.dataset.k,q=Q[k]||{},v=q.v;sg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));const item=$('#qi'+k);item.classList.toggle('no',v==='nao');
    const [si,ii]=k.split('-').map(Number),o=itObj(CK_QUAL[si].i[ii]),fs=q.f||[];
    item.classList.toggle('pend',!!o.foto&&(v==='sim'||v==='nao')&&!fs.length);
    const box=item.querySelector('.fotos');
    box.innerHTML=fs.map((p,i)=>`<span class="ft"><img data-src="${esc(p)}" alt=""><button title="Remover" data-fr="${k}|${i}">×</button></span>`).join('')+(o.tipo==='temp'&&q.t!=null?`<span class="sem s-${v==='sim'?'ok':'bad'}" style="min-width:0">${fmtT(q.t)} ${v==='sim'?'dentro da faixa':'fora da faixa'}</span>`:'')+(o.foto&&(v==='sim'||v==='nao')&&!fs.length?'<span class="small" style="color:var(--bad)">foto pendente</span>':'');
    box.querySelectorAll('[data-fr]').forEach(b=>b.onclick=()=>{const [kk,i]=b.dataset.fr.split('|');const p=Q[kk].f.splice(+i,1)[0];sb.storage.from('checklist-fotos').remove([p]).then(()=>{});paintQual()});
    box.querySelectorAll('.ft img').forEach(im=>im.onclick=()=>galeria(itTxt(CK_QUAL[si].i[ii]),fs));
  });
  pintarFotos($('#qSecs'));
  const sc=qScores();
  $('#qRing').innerHTML=ring(sc.score,'nota da visita');
  $('#qBars').innerHTML=sc.per.map((p,i)=>{const pct=p.s+p.n?p.s/(p.s+p.n)*100:null;return `<div class="r"><span>${CK_QUAL[i].s.split(',')[0]}</span><div class="tr"><i style="width:${pct||0}%;background:${scCol(pct)}"></i></div><span style="text-align:right">${pct==null?'—':nf0.format(pct)+'%'}</span></div>`}).join('');
  sc.per.forEach((p,i)=>$('#qsc'+i).innerHTML=`<span>${p.s+p.n+p.na}/${p.tot} avaliados</span>${p.n?`<span class="sem s-bad" style="min-width:0">${p.n} não</span>`:''}`);
  const nos=[];CK_QUAL.forEach((sec,si)=>sec.i.forEach((it,ii)=>{const k=qKey(si,ii),q=Q[k]||{};if(q.v==='nao')nos.push({k,it:itTxt(it)+(q.t!=null?` — medido ${fmtT(q.t)}`:''),sec:sec.s})}));
  $('#qPlano').innerHTML = nos.length? `<div class="tbl-wrap"><table><tr><th>Desvio</th><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Prioridade</th><th>Status</th></tr>${nos.map(n=>{const a=(Q[n.k]||{}).a||{};return `<tr><td style="white-space:normal;min-width:200px"><b>${n.it}</b><div class="small muted">${n.sec}</div></td><td style="min-width:220px"><input class="inp" data-a="${n.k}" data-f="acao" value="${esc(a.acao)}" placeholder="O que será feito"></td><td style="min-width:150px"><input class="inp" data-a="${n.k}" data-f="resp" value="${esc(a.resp)}" placeholder="Quem"></td><td><input class="inp" type="date" data-a="${n.k}" data-f="prazo" value="${esc(a.prazo)}"></td><td><select class="inp" data-a="${n.k}" data-f="pri">${['Alta','Média','Baixa'].map(o=>`<option ${(a.pri||(itObj(CK_QUAL[+n.k.split('-')[0]].i[+n.k.split('-')[1]]).tipo==='temp'?'Alta':'Média'))===o?'selected':''}>${o}</option>`).join('')}</select></td><td><select class="inp" data-a="${n.k}" data-f="st">${['Aberta','Em andamento','Concluída'].map(o=>`<option ${a.st===o?'selected':''}>${o}</option>`).join('')}</select></td></tr>`}).join('')}</table></div><p class="small muted" style="margin-top:8px">Ao salvar a visita, cada desvio vira uma ação no módulo Planos de ação, ligada a esta visita.</p>`
    : '<div class="empty">Nenhum desvio marcado. Os itens com "Não" aparecem aqui para virar plano de ação.</div>';
  $('#qPlano').querySelectorAll('[data-a]').forEach(el=>el.oninput=el.onchange=()=>{const k=el.dataset.a;Q[k]=Q[k]||{};Q[k].a=Q[k].a||{};Q[k].a[el.dataset.f]=el.value});
}
async function saveQual(){
  const sc=qScores(); if(sc.S+sc.N===0){toast('Avalie pelo menos um item antes de salvar.');return}
  const loja=$('#qLoja').value, data=$('#qData').value; if(!loja||!data){toast('Informe loja e data da visita.');return}
  const pend=[];CK_QUAL.forEach((sec,si)=>sec.i.forEach((it,ii)=>{const o=itObj(it),q=Q[qKey(si,ii)]||{};if(o.foto&&q.v!=='na'&&!(q.f||[]).length)pend.push({k:qKey(si,ii),n:o.n,sem:!q.v})}));
  if(pend.length){const sec=$('#qi'+pend[0].k).closest('.sec');sec.classList.remove('closed');$('#qi'+pend[0].k).scrollIntoView({behavior:'smooth',block:'center'});
    toast(`Faltam ${pend.length} item(ns) com foto obrigatória: ${pend.slice(0,3).map(p=>p.n).join('; ')}${pend.length>3?'…':''}. Responda, fotografe ou marque N/A.`);return}
  const vis={loja_id:loja,data,avaliador:$('#qAval').value||null,gerente:$('#qGer').value||null,score:Math.round(sc.score*10)/10,sim:sc.S,nao:sc.N,secoes:sc.per.map(p=>p.s+p.n?p.s/(p.s+p.n)*100:null),respostas:JSON.parse(JSON.stringify(Q))};
  const r=await dbw(sb.from('visitas_qualidade').insert(vis).select('id').single()); if(!r)return;
  const acoes=[];CK_QUAL.forEach((sec,si)=>sec.i.forEach((it,ii)=>{const q=Q[qKey(si,ii)]||{};if(q.v==='nao'){const a=q.a||{};acoes.push({loja_id:loja,origem:'visita',origem_id:r.id,problema:itTxt(it)+(q.t!=null?` — medido ${fmtT(q.t)}`:''),secao:sec.s,acao:a.acao||null,responsavel:a.resp||null,prazo:a.prazo||null,prioridade:a.pri||(itObj(it).tipo==='temp'?'Alta':'Média'),status:ST_MAP[a.st]||'Pendente',obs:[q.o,(q.f||[]).length?`${q.f.length} foto(s) na visita`:''].filter(Boolean).join(' · ')||null})}}));
  if(acoes.length&&!await dbw(sb.from('planos_acao').insert(acoes))){toast('Visita salva, mas o plano de ação não foi gerado.')}
  else toast(`Visita salva${acoes.length?` e ${acoes.length} ação(ões) criada(s) em Planos de ação`:''}.`);
  Q={}; buildQual(); await load(['visitas_qualidade','planos_acao']); renderQualHist();
}
function renderQualHist(){
  const h=(S.db.visitas_qualidade||[]).slice().sort((a,b)=>b.data.localeCompare(a.data)||b.id-a.id);
  const pa=S.db.planos_acao||[], mq=metaQual(null);
  $('#qHist').innerHTML = h.length? `<div class="tbl-wrap" style="max-height:480px;overflow:auto"><table><tr><th>Data</th><th>Loja</th><th>Avaliador</th><th>Gerente</th><th class="num">Nota</th><th class="num">Desvios</th><th class="num">Ações abertas</th><th class="num">Fotos</th><th></th></tr>${h.map(v=>{const fs=Object.values(v.respostas||{}).flatMap(q=>q&&q.f||[]);return `<tr><td>${fmtD(v.data)}</td><td><b>${esc(lojaNome(v.loja_id))}</b></td><td>${esc(v.avaliador)||'—'}</td><td>${esc(v.gerente)||'—'}</td><td class="num"><span class="sem s-${v.score>=mq?'ok':v.score>=mq-15?'warn':'bad'}">${nf0.format(v.score)}%</span></td><td class="num">${v.nao}</td><td class="num">${pa.filter(a=>a.origem==='visita'&&a.origem_id===v.id&&!['Concluído','Cancelado'].includes(a.status)).length}</td><td class="num">${fs.length?`<button class="btn sm" data-fg="${v.id}">${fs.length} ${IC_CAM}</button>`:'—'}</td><td class="num"><button class="btn sm" data-ld="${v.id}">Abrir</button> ${P.excluir(v.loja_id)?`<button class="btn sm" data-del="${v.id}">Excluir</button>`:''}</td></tr>`}).join('')}</table></div>`
    : '<div class="empty">Nenhuma visita salva ainda.</div>';
  $('#qHist').querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta visita do histórico? As ações geradas por ela continuam em Planos de ação.'))return;if(await dbw(sb.from('visitas_qualidade').delete().eq('id',b.dataset.del),'Visita excluída.')){await load(['visitas_qualidade']);renderQualHist()}});
  $('#qHist').querySelectorAll('[data-fg]').forEach(b=>b.onclick=()=>{const v=h.find(x=>x.id==b.dataset.fg);galeria(`Fotos · ${lojaNome(v.loja_id)} · ${fmtD(v.data)}`,Object.values(v.respostas||{}).flatMap(q=>q&&q.f||[]))});
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
