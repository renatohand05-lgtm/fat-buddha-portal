/* ================= Qualidade · Notas do Google ================= */
let qSub='visita', GG_LO=1, GG_ST=null, GG_F={loja:'',f:'todas'}, GG_BUSCA={};
const ggMeta=()=>{const c=cfg('google_meta');return c&&+c.meta?+c.meta:4.5};
const ggCor=id=>PAL[LOJAS.findIndex(l=>l.id===id)%PAL.length];
const nf1g=v=>nf1.format(v);
// estrelas com preenchimento proporcional (texto continua legível sem cor)
const ggStars=(n,sz)=>`<span class="gg-stars" style="${sz?`font-size:${sz}px`:''}" role="img" aria-label="${n==null?'sem nota':nf1g(n)+' de 5 estrelas'}"><span class="gg-s-bg">★★★★★</span><span class="gg-s-fg" style="width:${n==null?0:Math.max(0,Math.min(100,n/5*100))}%">★★★★★</span></span>`;
const ggSt=(n,m)=>n==null?'neu':n>=m?'ok':n>=m-.3?'warn':'bad';
const ggStTxt={ok:'na meta',warn:'perto da meta',bad:'abaixo da meta',neu:'sem nota'};
function ggSerie(id){return (S.db.google_notas||[]).filter(r=>r.loja_id===id).sort((a,b)=>a.data.localeCompare(b.data))}
// posição em uma data (último registro até ela)
function ggEm(serie,data){let r=null;for(const x of serie){if(x.data<=data)r=x;else break}return r}
function ggSpark(pts,cor,meta,w=260,h=60){
  if(pts.length<2)return `<div class="gg-spark-vazio">${pts.length?'o histórico começa a aparecer a partir da 2ª atualização':'sem histórico'}</div>`;
  const vs=pts.map(p=>+p.nota).concat([meta]);let lo=Math.min(...vs),hi=Math.max(...vs);const pad=Math.max(.1,(hi-lo)*.2);lo-=pad;hi+=pad;
  const t0=new Date(pts[0].data+'T12:00')-0,t1=new Date(pts.at(-1).data+'T12:00')-0||t0+1;
  const X=d=>4+(new Date(d+'T12:00')-t0)/Math.max(1,t1-t0)*(w-8), Y=v=>h-4-(v-lo)/(hi-lo)*(h-8);
  const d=pts.map((p,i)=>(i?'L':'M')+X(p.data).toFixed(1)+' '+Y(+p.nota).toFixed(1)).join(' '), u=pts.at(-1);
  return `<svg class="cmg-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Evolução da nota">
    <line x1="0" x2="${w}" y1="${Y(meta).toFixed(1)}" y2="${Y(meta).toFixed(1)}" stroke="rgba(255,236,220,.3)" stroke-width="1" stroke-dasharray="3 3"/>
    <path d="${d}" fill="none" stroke="${cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${X(u.data).toFixed(1)}" cy="${Y(+u.nota).toFixed(1)}" r="4" fill="${cor}" stroke="#1d1715" stroke-width="2"/>
    ${pts.map(p=>`<circle cx="${X(p.data).toFixed(1)}" cy="${Y(+p.nota).toFixed(1)}" r="9" fill="transparent"><title>${fmtD(p.data)} · nota ${nf1g(+p.nota)} · ${nf0.format(p.total)} avaliações${p.fonte==='manual'?' (manual)':p.fonte==='estimada'?' (estimada)':''}</title></circle>`).join('')}
  </svg>`;
}
const ggQuando=r=>r.relativo||(r.publicado_em?fmtD(r.publicado_em.slice(0,10)):'');

function renderQualidade(){
  $$('#qNav button').forEach(b=>b.classList.toggle('on',b.dataset.s===qSub));
  $$('#tab-qualidade .qs').forEach(s=>s.classList.toggle('on',s.id==='qs-'+qSub));
  if(qSub==='google'){qSub='visita';PO.sub='voz';PO.vz='gg';setTimeout(()=>go('painel'));return}
  if(qSub==='oper'){renderRetornoOper();renderOperHist();return}
  buildQual();renderQualHist();
}

function ggLojas(){
  // lojas em operação e as que já têm vínculo ou nota lançada
  const com=new Set((S.db.google_notas||[]).map(r=>r.loja_id));
  return LOJAS.filter(l=>l.status==='operando'||l.google_place_id||com.has(l.id));
}

// ---------- comparação de períodos (dumbbell: anterior → atual) ----------
const ggIsoD=d=>d.toISOString().slice(0,10);
function ggSemana(iso){const d=new Date(iso+'T12:00');const w=(d.getDay()+6)%7;d.setDate(d.getDate()-w);return ggIsoD(d)} // segunda-feira da semana
// referência: hoje; só usa o mês do topo quando a pessoa escolheu um mês anterior que tem nota (o portal abre no último mês com vendas)
function ggRefData(){const h=isoHoje();if(S.mesEscolhido&&S.mes<ymOf(h)&&(S.db.google_notas||[]).some(r=>ymOf(r.data)===S.mes))return fimMes(S.mes);return h}
function ggUltimo(serie,ini,fim){let r=null;for(const x of serie){if(x.data>=ini&&x.data<=fim)r=x}return r}
function ggPeriodos(tipo){
  const ref=ggRefData();
  if(tipo==='sem'){const ini=ggSemana(ref),d=new Date(ini+'T12:00');d.setDate(d.getDate()-7);const iniA=ggIsoD(d),e=new Date(ini+'T12:00');e.setDate(e.getDate()-1);const fimA=ggIsoD(e);
    const f=new Date(ini+'T12:00');f.setDate(f.getDate()+6);
    return {atual:[ini,ref],ant:[iniA,fimA],tAtual:`semana de ${fmtD(ini).slice(0,5)} a ${fmtD(ggIsoD(f)).slice(0,5)}`,tAnt:`semana de ${fmtD(iniA).slice(0,5)} a ${fmtD(fimA).slice(0,5)}`,nAtual:'Esta semana',nAnt:'Semana anterior'}}
  const m=ymOf(ref),ma=addMes(m,-1);
  return {atual:[iniMes(m),ref],ant:[iniMes(ma),fimMes(ma)],tAtual:mesLongo(m),tAnt:mesLongo(ma),nAtual:mesTxt(m),nAnt:mesTxt(ma)};
}
function ggComparar(L,meta){
  [['sem','#ggSem','#ggSemSub'],['mes','#ggMes','#ggMesSub']].forEach(([tipo,el,sub])=>{
    const P_=ggPeriodos(tipo);
    const rows=L.map(x=>{const a=ggUltimo(x.s,...P_.atual),b=ggUltimo(x.s,...P_.ant);return {x,a,b}}).filter(r=>r.a||r.b);
    // rede: média ponderada pelo total de avaliações
    const red=k=>{const v=rows.filter(r=>r[k]);const t=sum(v,r=>+r[k].total);return v.length?{nota:t?sum(v,r=>r[k].nota*r[k].total)/t:sum(v,r=>+r[k].nota)/v.length,total:t}:null};
    const ra=red('a'),rb=red('b');
    $(sub).textContent=`${P_.nAnt} → ${P_.nAtual}`;
    if(!rows.length){$(el).innerHTML='<div class="empty">Sem notas no período.</div>';return}
    const vals=rows.flatMap(r=>[r.a&&+r.a.nota,r.b&&+r.b.nota]).filter(v=>v!=null).concat([meta]);
    const lo=Math.max(1,Math.floor((Math.min(...vals)-.2)*2)/2),X=v=>(v-lo)/(5-lo)*100;
    const linha=(nome,cor,a,b,forte)=>{const r1=v=>Math.round(v*10)/10,na=a?r1(+a.nota):null,nb=b?r1(+b.nota):null,d=na!=null&&nb!=null?r1(na-nb):null,dt=a&&b?a.total-b.total:null;
      const st=d==null||d===0?'eq':d>0?'down':'up';
      return `<div class="gg-db-r ${forte?'forte':''}"><span class="gg-db-l">${cor?`<span class="cmg-dot" style="--cor:${cor}"></span>`:''}${esc(nome)}</span>
        <span class="gg-db-tr"><em style="left:${X(meta)}%" title="meta ${nf1g(meta)}"></em>${na!=null&&nb!=null?`<i class="gg-db-ln" style="left:${Math.min(X(na),X(nb))}%;width:${Math.abs(X(na)-X(nb))}%;background:${cor||'#f7eee6'}"></i>`:''}
          ${nb!=null?`<b class="gg-db-p ant" style="left:${X(nb)}%" title="${esc(P_.nAnt)}: ${nf1g(nb)}"></b>`:''}${na!=null?`<b class="gg-db-p" style="left:${X(na)}%;background:${cor||'#f7eee6'}" title="${esc(P_.nAtual)}: ${nf1g(na)}"></b>`:''}</span>
        <span class="gg-db-v">${nb!=null?nf1g(nb)+(b&&b.fonte==='estimada'?'<sup title="estimada">*</sup>':''):'—'} → <b>${na!=null?nf1g(na):'—'}</b></span>
        <span class="gg-db-d"><span class="cmg-delta ${st}">${d==null?(nb==null?'sem anterior':'sem atual'):(d>0?'+':'')+nf1.format(d===0?0:d)}</span>${dt!=null?`<small>${dt>=0?'+':''}${nf0.format(dt)} aval.</small>`:''}</span></div>`};
    $(el).innerHTML=`<div class="gg-db-head"><span></span><span class="gg-db-sc"><span>${nf1g(lo)}</span><span>5,0</span></span><span>nota</span><span>variação</span></div>`
      +(rows.length>1?linha('Rede',null,ra,rb,true):'')+rows.map(r=>linha(r.x.l.nome,ggCor(r.x.l.id),r.a,r.b)).join('')
      +`<div class="gg-db-leg"><span><b class="gg-db-p ant"></b>${esc(P_.tAnt)}</span><span><b class="gg-db-p"></b>${esc(P_.tAtual)}</span><span><i class="dash"></i>meta ${nf1g(meta)}</span></div>`
      +(rows.some(r=>(r.b&&r.b.fonte==='estimada')||(r.a&&r.a.fonte==='estimada'))?`<p class="small muted" style="margin-top:8px">* Nota estimada: reconstruída a partir da distribuição de estrelas e das datas das avaliações no Google Maps (o Google não guarda a nota de dias anteriores).</p>`:'')
      +(rows.some(r=>!r.b)?`<p class="small muted" style="margin-top:8px">A comparação completa aparece quando houver nota registrada também ${tipo==='sem'?'na semana anterior':'no mês anterior'}. A partir de agora o histórico é gravado todo dia.</p>`:'');
  });
}

function renderGoogle(){
  const meta=ggMeta(), hoje=isoHoje(), d30=new Date(Date.now()-30*864e5).toISOString().slice(0,10), d90=new Date(Date.now()-90*864e5).toISOString().slice(0,10);
  const ls=ggLojas(), revs=(S.db.google_reviews||[]);
  const L=ls.map(l=>{const s=ggSerie(l.id),u=s.at(-1)||null,a=ggEm(s,d30);
    return {l,s,u,nota:u?+u.nota:null,total:u?+u.total:null,dN:u&&a&&a!==u?+u.nota-(+a.nota):null,dT:u&&a&&a!==u?u.total-a.total:null,
      rv:revs.filter(r=>r.loja_id===l.id).sort((x,y)=>(y.publicado_em||'').localeCompare(x.publicado_em||''))}});
  const com=L.filter(x=>x.nota!=null);
  // status da integração
  const ult=cfg('google_ultima'), semChave=GG_ST&&!GG_ST.chave;
  $('#ggStatus').innerHTML=`<span class="gg-live ${semChave?'off':''}"></span><div><b>${semChave?'Atualização automática aguardando a chave do Google':'Atualização automática todo dia às 6h, 15h e 22h'}</b><div class="small muted">${ult&&ult.em?`última busca ${new Date(ult.em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · ${ult.por==='agendamento'?'automática':'pelo portal'}`:'nenhuma busca no Google ainda'}${semChave&&P.gestor?' · enquanto isso, a nota pode ser lançada à mão na configuração':''}</div></div>`;
  $('#ggAtualizar').style.display=P.gestor?'':'none';
  // destaque da rede
  if(!com.length){
    $('#ggHero').innerHTML=`<div class="gg-empty"><div class="gg-empty-ic">${ggStars(0,30)}</div><div><b>Nenhuma nota do Google ainda</b><p class="small muted">${P.gestor?'Abra a configuração no fim da página: cadastre a chave do Google para a busca automática, ou lance a nota de cada loja à mão.':'Assim que a gestão ligar a integração, a nota de cada loja aparece aqui e é atualizada todo dia às 6h, 15h e 22h.'}</p></div></div>`;
  } else {
    const tot=sum(com,x=>x.total), rede=tot?sum(com,x=>x.nota*x.total)/tot:sum(com,x=>x.nota)/com.length;
    const ant=com.filter(x=>x.dN!=null), redeAnt=ant.length&&sum(ant,x=>x.total-x.dT)?sum(ant,x=>(x.nota-x.dN)*(x.total-x.dT))/sum(ant,x=>x.total-x.dT):null;
    const novas=sum(com.filter(x=>x.dT!=null),x=>x.dT), neg=revs.filter(r=>r.nota<=2&&(r.publicado_em||'')>=d30).length;
    const st=ggSt(rede,meta), dd=redeAnt!=null?rede-redeAnt:null;
    $('#ggHero').innerHTML=`<div class="gg-hero">
      <div><div class="cmg-eyebrow">Nota da rede no Google</div>
        <div class="gg-big">${nf1g(rede)}<span class="gg-big-st">${ggStars(rede,24)}</span></div>
        <div class="cmg-sub"><span class="sem s-${st}" style="min-width:0">${ggStTxt[st]}</span> meta ${nf1g(meta)} · média ponderada por <b>${nf0.format(tot)}</b> avaliações${dd!=null?` · <span class="cmg-delta ${dd>0.005?'down':dd<-0.005?'up':'eq'}">${dd>0?'+':''}${nf1.format(dd)} em 30 dias</span>`:''}</div></div>
      <div class="gg-rank">${(()=>{const lo=Math.max(1,Math.floor((Math.min(meta,...com.map(x=>x.nota))-.3)*2)/2);GG_LO=lo;return ''})()}${com.slice().sort((a,b)=>b.nota-a.nota||b.total-a.total).map((x,i)=>`<div class="gg-rank-r"><span class="gg-rank-n">${i+1}º</span><span class="cmg-dot" style="--cor:${ggCor(x.l.id)}"></span><span class="gg-rank-l">${esc(x.l.nome)}</span><span class="gg-rank-bar"><i style="width:${Math.max(3,(x.nota-GG_LO)/(5-GG_LO)*100)}%;background:${ggCor(x.l.id)}"></i><em style="left:${(meta-GG_LO)/(5-GG_LO)*100}%"></em></span><b>${nf1g(x.nota)}</b></div>`).join('')}<div class="small muted" style="margin-top:4px">escala de ${nf1g(GG_LO)} a 5 estrelas · traço = meta ${nf1g(meta)}</div></div>
      <div class="cmg-hero-r">
        <div class="cmg-stat"><span>Lojas na meta</span><b>${com.filter(x=>x.nota>=meta).length} de ${com.length}</b></div>
        <div class="cmg-stat"><span>Avaliações novas em 30 dias</span><b>${com.some(x=>x.dT!=null)?'+'+nf0.format(novas):'—'}</b></div>
        <div class="cmg-stat"><span>Avaliações de 1–2★ em 30 dias</span><b class="${neg?'gg-neg':''}">${neg}</b></div>
      </div></div>`;
  }
  // cartões por loja
  $('#ggLojas').innerHTML=L.map(x=>{const st=ggSt(x.nota,meta), cor=ggCor(x.l.id), r0=x.rv[0];
    return `<div class="card cmg-loja gg-loja" style="--cor:${cor}">
      <div class="cmg-l-head"><span class="cmg-dot"></span><b>${esc(x.l.nome)}</b>${x.nota!=null?`<span class="sem s-${st}" style="min-width:0;margin-left:auto">${ggStTxt[st]}</span>`:''}</div>
      ${x.nota!=null?`<div class="gg-l-big">${nf1g(x.nota)} ${ggStars(x.nota,17)}</div>
      <div class="cmg-sub"><b>${nf0.format(x.total)}</b> avaliações${x.dT!=null?` · <span class="gg-pos">+${nf0.format(x.dT)}</span> em 30 dias`:''}${x.dN!=null&&Math.abs(x.dN)>=.05?` · nota <span class="cmg-delta ${x.dN>0?'down':'up'}">${x.dN>0?'+':''}${nf1.format(x.dN)}</span>`:''}</div>
      ${ggSpark(x.s.filter(p=>p.data>=d90),cor,meta)}
      <div class="gg-l-foot">${r0?`<span title="${esc(r0.texto||'')}">última avaliação: <b>${r0.nota}★</b> ${esc(ggQuando(r0))}</span>`:`<span class="muted">posição de ${fmtD(x.u.data)}${x.u.fonte==='manual'?' · lançada à mão':''}</span>`}${x.l.google_uri?`<a href="${esc(x.l.google_uri)}" target="_blank" rel="noopener">Abrir no Google ↗</a>`:''}</div>`
      :`<div class="gg-l-vazio">${x.l.google_place_id?'Vinculada ao Google · a nota entra na próxima atualização':'Ainda sem nota do Google'}</div>`}
    </div>`}).join('')||'<div class="card empty">Nenhuma loja.</div>';
  // evolução: semana vs semana e mês vs mês
  ggComparar(L,meta);
  // avaliações
  $('#ggRvLoja').innerHTML='<option value="">Todas as lojas</option>'+ls.map(l=>`<option value="${l.id}" ${GG_F.loja===l.id?'selected':''}>${esc(l.nome)}</option>`).join('');
  $$('#ggRvF button').forEach(b=>b.classList.toggle('on',b.dataset.f===GG_F.f));
  const pa=S.db.planos_acao||[];
  const rv=revs.filter(r=>(!GG_F.loja||r.loja_id===GG_F.loja)&&(GG_F.f==='todas'||(GG_F.f==='neg'?r.nota<=3:r.nota>=4))&&ls.some(l=>l.id===r.loja_id)).sort((a,b)=>(b.publicado_em||'').localeCompare(a.publicado_em||''));
  $('#ggRvN').textContent=revs.length?`${rv.length} de ${revs.length}`:'';
  $('#ggRevs').innerHTML=rv.length?rv.map(r=>{const ref=r.id.split('/').pop(), tem=pa.some(a=>a.origem==='google'&&(a.obs||'').includes(ref));
    return `<div class="gg-rv ${r.nota<=2?'neg':r.nota===3?'mid':''}">
      <div class="gg-rv-h">${ggStars(r.nota,14)}<b>${esc(r.autor||'Cliente do Google')}</b><span class="tag"><span class="cmg-dot" style="--cor:${ggCor(r.loja_id)}"></span>${esc(lojaNome(r.loja_id))}</span><span class="muted small">${esc(ggQuando(r))}</span>
        <span class="gg-rv-a">${r.uri?`<a class="btn sm" href="${esc(r.uri)}" target="_blank" rel="noopener">Abrir no Google ↗</a>`:''}${r.nota<=3&&P.editar(r.loja_id)?(tem?'<span class="sem s-ok" style="min-width:0">plano de ação criado</span>':`<button class="btn sm" data-ggpa="${esc(r.id)}">Criar plano de ação</button>`):''}</span></div>
      ${r.texto?`<p class="gg-rv-t">${esc(r.texto)}</p>`:'<p class="gg-rv-t muted">Sem comentário, só a nota.</p>'}
    </div>`}).join(''):`<div class="empty">${revs.length?'Nenhuma avaliação neste filtro.':'Nenhuma avaliação carregada ainda.'}</div>`;
  $('#ggRevs').querySelectorAll('.gg-rv-t').forEach(p=>p.onclick=()=>p.classList.toggle('full'));
  $('#ggRevs').querySelectorAll('[data-ggpa]').forEach(b=>b.onclick=async()=>{const r=revs.find(x=>x.id===b.dataset.ggpa);if(!r)return;const ref=r.id.split('/').pop();
    const ok=await dbw(sb.from('planos_acao').insert({loja_id:r.loja_id,origem:'google',problema:`Avaliação de ${r.nota}★ no Google${r.texto?': "'+r.texto.slice(0,220)+(r.texto.length>220?'…':'')+'"':''}`,secao:'Avaliações do Google',prioridade:r.nota<=2?'Alta':'Média',status:'Pendente',obs:`${r.autor||'Cliente'} · ${ggQuando(r)} · ref ${ref}`}),'Plano de ação criado em Planos de ação.');
    if(ok){await load(['planos_acao']);renderGoogle()}});
  ggConfig(ls);
}

async function ggChamar(body,msg){
  busy(true);const {data,error}=await sb.functions.invoke('google-notas',{body});busy(false);
  if(error){toast('Não foi possível falar com o Google: '+error.message);return null}
  if(data&&data.motivo==='sem_chave'){toast('Falta cadastrar a chave do Google na configuração.');GG_ST={chave:false};return null}
  if(!data||data.ok===false){toast(data&&data.erro?data.erro:'Falha na busca.');return null}
  if(msg)toast(typeof msg==='function'?msg(data):msg);
  return data;
}
async function ggStatus(){
  if(!P.papel)return;
  const {data}=await sb.functions.invoke('google-notas',{body:{acao:'status'}});
  if(data){GG_ST=data;if(S.tab==='painel'&&PO.sub==='voz'&&PO.vz==='gg')renderGoogle()}
}

function ggConfig(ls){
  const box=$('#ggCfgBody'); if(!P.gestor){$('#ggCfg').style.display='none';return} $('#ggCfg').style.display='';
  const meta=ggMeta(), man=(S.db.google_notas||[]).filter(r=>r.fonte==='manual').sort((a,b)=>b.data.localeCompare(a.data)).slice(0,8);
  box.innerHTML=`
  <div class="gg-cfg-sec"><h4>1. Chave do Google <span class="sem s-${GG_ST&&GG_ST.chave?'ok':'warn'}" style="min-width:0">${GG_ST==null?'verificando…':GG_ST.chave?'configurada'+(GG_ST.desde?' em '+fmtD(GG_ST.desde.slice(0,10)):''):'não configurada'}</span></h4>
    ${P.admin?`<div class="form-row" style="grid-template-columns:1fr auto auto"><label class="f">Chave da API (Places API New)<input class="inp" id="ggKey" type="password" autocomplete="off" placeholder="${GG_ST&&GG_ST.chave?'•••••••• (cole uma nova para trocar)':'AIza…'}"></label><button class="btn pri" id="ggKeySave" style="align-self:end">Salvar e testar</button>${GG_ST&&GG_ST.chave?'<button class="btn" id="ggKeyDel" style="align-self:end">Remover</button>':''}</div>
    <p class="small muted">A chave fica guardada no servidor e não aparece no portal depois de salva. Ao salvar, o portal testa a chave, encontra sozinho as lojas Fat Buddha no Google e já busca as notas.</p>
    ${GG_ST&&GG_ST.chave?'':`<div class="gg-guia"><b>Como gerar a chave (uma vez só, uns 10 minutos)</b><ol>
      <li>Entre em <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> com a conta Google da empresa e crie um projeto (ex.: "Fat Buddha Portal").</li>
      <li>Em <i>Faturamento</i>, vincule um cartão. O Google exige, mas a busca diária das lojas fica dentro da cota gratuita mensal.</li>
      <li>Em <i>APIs e serviços › Biblioteca</i>, ative a <b>Places API (New)</b>.</li>
      <li>Em <i>APIs e serviços › Credenciais</i>, clique em <i>Criar credenciais › Chave de API</i>. Em <i>Restrições de API</i>, deixe só a Places API (New).</li>
      <li>Copie a chave (começa com AIza…), cole acima e clique em Salvar e testar.</li></ol></div>`}`:'<p class="small muted">Só o administrador ou a diretoria cadastra a chave.</p>'}
  </div>
  <div class="gg-cfg-sec"><h4>2. Lojas no Google</h4>
    <div class="tbl-wrap"><table><tr><th>Loja</th><th>Local no Google</th><th></th></tr>${ls.map(l=>`<tr><td><b>${esc(l.nome)}</b></td><td style="white-space:normal">${l.google_place_id?`${esc(l.google_nome||'')}<div class="small muted">${esc(l.google_endereco||'')}</div>`:'<span class="muted">não vinculada</span>'}</td>
      <td class="num" style="white-space:nowrap"><button class="btn sm" data-ggb="${l.id}">Buscar no Google</button> ${l.google_place_id?`<button class="btn sm" data-ggd="${l.id}">Desvincular</button>`:''}</td></tr>
      ${GG_BUSCA[l.id]?`<tr><td></td><td colspan="2" style="white-space:normal">${GG_BUSCA[l.id].length?GG_BUSCA[l.id].map(p=>`<div class="gg-cand"><div><b>${esc(p.nome)}</b> ${p.nota!=null?`· ${nf1g(p.nota)}★ (${nf0.format(p.total)})`:''}<div class="small muted">${esc(p.endereco)}</div></div><button class="btn sm pri" data-ggv="${l.id}|${esc(p.id)}">Vincular</button></div>`).join(''):'<span class="muted">Nada encontrado. Tente outro termo:</span>'}
        <div class="form-row" style="grid-template-columns:1fr auto;margin-top:8px"><input class="inp" id="ggQ_${l.id}" placeholder="ex.: Fat Buddha Rice & Deli ${esc(l.nome)}"><button class="btn sm" data-ggq="${l.id}">Buscar</button></div></td></tr>`:''}`).join('')}</table></div>
  </div>
  <div class="gg-cfg-sec"><h4>3. Meta e lançamento manual</h4>
    <div class="form-row" style="grid-template-columns:repeat(5,1fr) auto">
      <label class="f">Meta de nota<input class="inp" id="ggMeta" type="number" step="0.1" min="1" max="5" value="${meta}"></label>
      <label class="f">Loja<select class="inp" id="ggMLoja">${ls.map(l=>`<option value="${l.id}">${esc(l.nome)}</option>`).join('')}</select></label>
      <label class="f">Data<input class="inp" id="ggMData" type="date" value="${isoHoje()}"></label>
      <label class="f">Nota<input class="inp" id="ggMNota" type="number" step="0.1" min="1" max="5" placeholder="4,7"></label>
      <label class="f">Total de avaliações<input class="inp" id="ggMTot" type="number" min="0" placeholder="1.250"></label>
      <button class="btn pri" id="ggMSave" style="align-self:end">Lançar</button>
    </div>
    <p class="small muted">Use o lançamento manual enquanto a chave não estiver cadastrada, ou para registrar o histórico de meses anteriores. No mesmo dia, a busca automática não sobrescreve um lançamento manual.</p>
    ${man.length?`<div class="tbl-wrap"><table><tr><th>Data</th><th>Loja</th><th class="num">Nota</th><th class="num">Avaliações</th><th></th></tr>${man.map(r=>`<tr><td>${fmtD(r.data)}</td><td>${esc(lojaNome(r.loja_id))}</td><td class="num">${nf1g(+r.nota)}</td><td class="num">${nf0.format(r.total)}</td><td class="num"><button class="btn sm" data-ggx="${r.id}">Excluir</button></td></tr>`).join('')}</table></div>`:''}
  </div>`;
  const ks=$('#ggKeySave'); if(ks) ks.onclick=async()=>{const k=$('#ggKey').value.trim();if(!k){toast('Cole a chave do Google.');return}
    const r=await ggChamar({acao:'chave',key:k},d=>`Chave salva. ${d.vinculadas&&d.vinculadas.length?'Lojas encontradas no Google: '+d.vinculadas.join(', ')+'. ':''}${d.lojas?d.lojas.length+' loja(s) atualizada(s).':''}`);
    if(r){GG_ST={chave:true,desde:new Date().toISOString()};await load(['lojas','google_notas','google_reviews','config','alertas']);renderGoogle()}};
  const kd=$('#ggKeyDel'); if(kd) kd.onclick=async()=>{if(!confirm('Remover a chave do Google? A busca automática para até uma nova chave ser cadastrada.'))return;if(await ggChamar({acao:'chave',key:''},'Chave removida.')){GG_ST={chave:false};renderGoogle()}};
  box.querySelectorAll('[data-ggb]').forEach(b=>b.onclick=async()=>{const id=b.dataset.ggb;if(GG_BUSCA[id]){delete GG_BUSCA[id];renderGoogle();return}const r=await ggChamar({acao:'buscar',loja_id:id});if(r){GG_BUSCA[id]=r.resultados||[];renderGoogle()}});
  box.querySelectorAll('[data-ggq]').forEach(b=>b.onclick=async()=>{const id=b.dataset.ggq,q=$('#ggQ_'+id).value.trim();if(!q)return;const r=await ggChamar({acao:'buscar',loja_id:id,q});if(r){GG_BUSCA[id]=r.resultados||[];renderGoogle()}});
  box.querySelectorAll('[data-ggv]').forEach(b=>b.onclick=async()=>{const [id,pid]=b.dataset.ggv.split('|');const r=await ggChamar({acao:'vincular',loja_id:id,place_id:pid},'Loja vinculada e nota atualizada.');if(r){delete GG_BUSCA[id];await load(['lojas','google_notas','google_reviews','config','alertas']);renderGoogle()}});
  box.querySelectorAll('[data-ggd]').forEach(b=>b.onclick=async()=>{if(!confirm('Desvincular esta loja do Google? O histórico de notas continua salvo.'))return;const r=await ggChamar({acao:'desvincular',loja_id:b.dataset.ggd},'Loja desvinculada.');if(r){await load(['lojas','google_reviews']);renderGoogle()}});
  box.querySelectorAll('[data-ggx]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este lançamento?'))return;if(await dbw(sb.from('google_notas').delete().eq('id',b.dataset.ggx),'Lançamento excluído.')){await load(['google_notas']);renderGoogle()}});
  $('#ggMeta').onchange=async()=>{const v=+$('#ggMeta').value;if(!(v>=1&&v<=5)){toast('A meta vai de 1 a 5.');return}if(await dbw(sb.from('config').upsert({chave:'google_meta',valor:{meta:v}}),'Meta salva.')){await load(['config']);renderGoogle()}};
  $('#ggMSave').onclick=async()=>{const n=+String($('#ggMNota').value).replace(',','.'),t=+String($('#ggMTot').value).replace(/\./g,''),d=$('#ggMData').value,l=$('#ggMLoja').value;
    if(!(n>=1&&n<=5)){toast('Informe a nota entre 1 e 5.');return}if(!(t>=0)||$('#ggMTot').value===''){toast('Informe o total de avaliações.');return}if(!d){toast('Informe a data.');return}
    const ex=(S.db.google_notas||[]).find(r=>r.loja_id===l&&r.data===d);if(ex&&ex.fonte==='google'){toast('Já existe a nota buscada no Google nesse dia.');return}
    if(await dbw(sb.from('google_notas').upsert({loja_id:l,data:d,nota:Math.round(n*10)/10,total:Math.round(t),fonte:'manual'},{onConflict:'loja_id,data'}),'Nota lançada.')){await load(['google_notas']);renderGoogle()}};
}

function initGoogle(){
  $$('#qNav button').forEach(b=>b.onclick=()=>{qSub=b.dataset.s;renderQualidade()});
  $('#ggRvLoja').onchange=e=>{GG_F.loja=e.target.value;renderGoogle()};
  $$('#ggRvF button').forEach(b=>b.onclick=()=>{GG_F.f=b.dataset.f;renderGoogle()});
  $('#ggAtualizar').onclick=async()=>{const r=await ggChamar({acao:'atualizar'},d=>{const e=(d.lojas||[]).filter(x=>x.erro);return e.length?`Atualizado com ${e.length} erro(s): ${e.map(x=>x.loja+' — '+x.erro).join('; ')}`:`Notas atualizadas: ${(d.lojas||[]).map(x=>x.loja+' '+(x.nota!=null?nf1g(x.nota):'—')).join(' · ')||'nenhuma loja vinculada'}.`});
    if(r){await load(['google_notas','google_reviews','config','lojas','alertas']);renderGoogle()}};
  ggStatus();
}
