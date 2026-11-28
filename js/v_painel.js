/* =====================================================================
   PAINEL OPERACIONAL — no formato do painel regional que as operações do BK recebem
   D-1 · acumulado · projeção · meta (ponderada pelo dia da semana) por loja,
   produtividade (venda por hora trabalhada), voz do cliente e situação das bases
   ===================================================================== */
FMTS.dec1=v=>nf1.format(v);
const poYR={grid:{color:C.grid},border:{display:false},ticks:{callback:v=>Math.abs(v)>=1000?brlK(v):'R$ '+nf0.format(v)}};
let PO={sub:'res',loja:'rede',prLoja:null,vcPer:'mes',vcFonte:'todas',vcLoja:'',vcTema:'',vcNeg:true};

const poLojas=()=>OPER.filter(l=>P.veTudo||S.minhas.includes(l.id));
const poFaixas=hs=>{const g=[];hs.forEach(h=>{const u=g.at(-1);if(u&&h===u[1]+1)u[1]=h;else g.push([h,h])});const f=h=>String(h%24).padStart(2,'0')+'h';return g.map(([a,b])=>a===b?f(a):f(a)+'–'+f(b)).join(', ')};
const poPct=v=>v==null||!isFinite(v)?'—':nf1.format(v).replace(',0','')+'%';
const poVar=v=>v==null||!isFinite(v)?'—':(v>0?'+':v<0?'−':'')+nf1.format(Math.abs(v)).replace(',0','')+'%';
const poSt=p=>p==null||!isFinite(p)?'neu':p>=100?'ok':p>=90?'warn':'bad';
const poCel=(txt,st)=>`<span class="sem s-${st||'neu'}">${txt}</span>`;
const poDM=iso=>iso?iso.slice(8,10)+'/'+iso.slice(5,7):'—';
const poDiaSem=iso=>({dom:'domingo',seg:'segunda',ter:'terça',qua:'quarta',qui:'quinta',sex:'sexta',sab:'sábado'})[wkOfIso(iso)];
/* dia de referência do D-1: ontem no mês corrente; último dia do mês nos meses fechados */
function poRef(mes=S.mes){const h=isoHoje(),m=ymOf(h);let r=mes===m?addDia(h,-1):mes<m?fimMes(mes):null;if(r&&ymOf(r)!==mes)r=null;return r}
/* meta ponderada: o peso do dia da semana (configurado) define quanto da meta do mês cabe a cada dia */
function poPesoAte(mes,ate){const pw=pesoDia();return sum(diasDoMes(mes).filter(d=>d<=ate),d=>pw[wkOfIso(d)])}
const poPesoMes=mes=>poPesoAte(mes,fimMes(mes));

/* ---------- linha de uma loja (todos os indicadores do painel) ---------- */
function poLinha(id,mes=S.mes){
  const k='po|'+id+'|'+mes; if(CACHE[k]) return CACHE[k];
  const s=lojaStats(id,mes), ref=poRef(mes), pm=poPesoMes(mes);
  let ate=null, fonte='';
  if(s.nReg){ate=diasDoMes(mes).filter(d=>IDX.vd.has(id+'|'+d)).at(-1);fonte='venda diária lançada'}
  else if(s.acum){ate=s.acum.ate&&ymOf(s.acum.ate)===mes?s.acum.ate:fimMes(mes);fonte=(s.acum.fonte||'caixa')+' · acumulado'}
  const real=s.temVenda?s.fat:null, meta=s.meta;
  const pa=ate?poPesoAte(mes,ate):null;
  const metaAte=meta!=null&&ate?meta*pa/pm:null;
  const proj=real!=null&&pa?real*pm/pa:null;
  const r1=ref?IDX.vd.get(id+'|'+ref):null;
  const d1=r1?(+r1.salao)+(+r1.delivery):null, d1p=r1?(+r1.pedidos_salao)+(+r1.pedidos_delivery):null;
  const m1=ref?metaDiaLoja(id,ref):null;
  // indicadores com meta (mesma regra do semáforo de Metas e indicadores)
  const ms=Object.fromEntries(METAS(id,mes).map(m=>[m.k,m])), v=s.vals;
  const ind=k=>({v:v[k]??null,st:ms[k]?status(ms[k],v[k]):'neu',src:s.src[k]||''});
  // Google: posição no fim do mês (ou hoje)
  const gs=typeof ggSerie==='function'?ggSerie(id):[], gr=gs.length?ggEm(gs,fimMes(mes)<isoHoje()?fimMes(mes):isoHoje()):null;
  const gm=typeof ggMeta==='function'?ggMeta():4.5;
  const google={v:gr?+gr.nota:null,st:gr?(+gr.nota>=gm?'ok':+gr.nota>=gm-.3?'warn':'bad'):'neu',total:gr?gr.total:null,data:gr?gr.data:null};
  // visita de qualidade: média do mês; na falta, a última antes do fim do mês
  const vq=(S.db.visitas_qualidade||[]).filter(x=>x.loja_id===id&&x.data<=fimMes(mes)).sort((a,b)=>a.data.localeCompare(b.data));
  const vm=vq.filter(x=>ymOf(x.data)===mes), mq=metaQual(id,mes);
  const visita=vm.length?{v:sum(vm,x=>x.score)/vm.length,data:vm.at(-1).data,mes:true}:vq.length?{v:+vq.at(-1).score,data:vq.at(-1).data,mes:false}:{v:null};
  visita.st=visita.v==null?'neu':visita.v>=mq?'ok':visita.v>=mq-10?'warn':'bad';
  // pessoas
  const prev=sum((S.db.quadro_previsto||[]).filter(q=>q.loja_id===id),q=>q.previsto), atv=people().filter(p=>p.loja_id===id).length;
  const vagas=typeof vagasAnd==='function'?sum(vagasAnd().filter(x=>x.loja_id===id),x=>x.quantidade-x.preenchidas):0;
  const prod=poProd(id,mes);
  const o={id,nome:lojaNome(id),s,ate,fonte,real,meta,metaAte,pMtd:metaAte?real/metaAte*100:null,proj,pProj:meta&&proj!=null?proj/meta*100:null,
    ref,d1,d1p,m1,pD1:m1&&d1!=null?d1/m1*100:null,ped:s.temVenda?s.ped:null,ticket:s.ticket,
    ifood:ind('ifood'),preparo:ind('preparo'),cancel:ind('cancel'),online:ind('online'),cmv:ind('cmv'),google,visita,
    quadro:{atv,prev,st:prev?(atv>=prev?'ok':atv>=prev*.8?'warn':'bad'):'neu'},vagas,prod};
  return CACHE[k]=o;
}
/* curva acumulada da loja: meta, realizado e projeção (seguindo o peso dos dias da semana) */
function poCurva(id,mes=S.mes){
  const ds=diasDoMes(mes), L=poLinha(id,mes), pm=poPesoMes(mes), pw=pesoDia();
  let acM=0; const meta=ds.map(d=>{const md=L.meta!=null?L.meta*pw[wkOfIso(d)]/pm:null;if(md==null)return null;acM+=md;return acM});
  let acR=0; const real=ds.map(d=>{if(!L.ate||d>L.ate)return null;if(L.s.nReg){const r=IDX.vd.get(id+'|'+d);acR+=r?(+r.salao)+(+r.delivery):0;return acR}return d===L.ate?L.real:null});
  const pa=L.ate?poPesoAte(mes,L.ate):null;
  const proj=ds.map(d=>!L.ate||L.real==null||d<L.ate?null:L.real*poPesoAte(mes,d)/pa);
  return {ds,meta,real,proj,L};
}

/* ---------- produtividade: venda por hora trabalhada (escala × caixa) ---------- */
function poEscala(id,mes){
  const es=(S.db.escalas||[]).filter(e=>e.unidade===id&&!['arquivada','proposta'].includes(e.tipo));
  let e=es.find(e=>!esC4(e)&&e.mes===mes&&e.tipo==='vigente')||es.find(e=>!esC4(e)&&e.mes===mes)
     ||es.filter(e=>esC4(e)&&e.inicio&&e.inicio<=fimMes(mes)).sort((a,b)=>b.inicio.localeCompare(a.inicio))[0];
  if(e) return {e,aprox:false};
  e=es.filter(e=>!esC4(e)&&e.tipo==='vigente').sort((a,b)=>(b.mes||'').localeCompare(a.mes||''))[0];
  return e?{e,aprox:true}:null;
}
function poChave(e,iso){const dk=wkOfIso(iso);
  if(esC4(e)){const df=esDifD(iso,e.inicio||'2026-12-14');if(df<0)return null;return `w${Math.floor((df%28)/7)+1}${dk}`}
  return dk==='dom'?'dom'+Math.ceil(+iso.slice(8,10)/7):dk}
function poProd(id,mes=S.mes){
  const k='pr|'+id+'|'+mes; if(CACHE[k]!==undefined) return CACHE[k];
  const s=lojaStats(id,mes), esc_=poEscala(id,mes);
  if(!s.temVenda||!esc_) return CACHE[k]=null;
  const ds=s.nReg?diasDoMes(mes).filter(d=>IDX.vd.has(id+'|'+d)):diasDoMes(mes).filter(d=>d<=(s.acum.ate&&ymOf(s.acum.ate)===mes?s.acum.ate:fimMes(mes)));
  const ls=esLinhas(esc_.e.id).filter(l=>!/Vaga|definir/i.test(l.vinculo||''));
  const ph=Array(25).fill(0); let min=0, alm=0, jan=0;
  ds.forEach(d=>{const key=poChave(esc_.e,d); if(!key) return; let a=0,j=0;
    ls.forEach(l=>{const t=esTurno((l.dias||{})[key]); if(t.t!=='trab') return; min+=t.min; if(t.alm)a++; if(t.jan)j++;
      t.segs.forEach(([x,y])=>{for(let h=Math.floor(x/60);h*60<y&&h<25;h++){const ov=Math.min(y,(h+1)*60)-Math.max(x,h*60);if(ov>0)ph[h]+=ov/60}})});
    alm+=a; jan+=j});
  const horas=min/60;
  const venda=Array(25).fill(null);
  if(s.acum) Object.entries(s.acum.horas).forEach(([h,v])=>venda[+h]=(venda[+h]||0)+v);
  const ped=s.ped;
  return CACHE[k]={escala:esc_.e,aprox:esc_.aprox,dias:ds.length,pessoas:ls.length,horas,fat:s.fat,ped,rsH:horas?s.fat/horas:null,pedH:horas&&ped?ped/horas:null,
    alm:ds.length?alm/ds.length:null,jan:ds.length?jan/ds.length:null,ph,venda,temHora:venda.some(v=>v)};
}

/* ---------- situação das bases (a aba check_dados do painel do BK) ---------- */
const PO_FREQ={diaria:[1,3],semanal:[8,14],mensal:[40,70]};
function poBases(){
  if(CACHE.bases) return CACHE.bases;
  const h=isoHoje(), db=S.db;
  const mx=(rows,f)=>{let m=null;(rows||[]).forEach(r=>{const v=f(r);if(v&&(!m||v>m))m=v});return m};
  const real=rows=>(rows||[]).filter(r=>!r.demo);
  const B=(o)=>{const rows=o.rows||[], rr=real(rows), so=rows.length&&!rr.length;
    const ult=o.ult!==undefined?o.ult:mx(so?rows:rr,o.f);
    let st,txt;
    if(o.pend){st='sem';txt='ainda não recebida'}
    else if(!rows.length){st='sem';txt='nenhum registro ainda'}
    else if(so){st='demo';txt='só dados de demonstração'}
    else{const lag=esDifD(h,ult.slice(0,10)),[a,b]=PO_FREQ[o.freq];st=lag<=a?'ok':lag<=b?'warn':'bad';
      txt=st==='ok'?'em dia':`${lag-a} dia${lag-a===1?'':'s'} de atraso`}
    return Object.assign(o,{ult:ult?ult.slice(0,10):null,st,txt})};
  const out=[
    B({k:'caixa',n:'Vendas do caixa (Colibri)',freq:'diaria',rows:db.vendas_hora_mes,f:r=>r.ate,alim:'Resultado por loja, Vendas, Minha loja, Produtividade',como:'relatório "Faturamento por hora e loja" do Colibri'}),
    B({k:'vd',n:'Venda diária por canal',freq:'diaria',rows:db.vendas_diarias,f:r=>r.data,alim:'D-1, meta do dia, venda dia a dia, salão × delivery',como:'Vendas › importar o faturamento diário do Colibri'}),
    B({k:'ifood',n:'iFood · desempenho',freq:'diaria',rows:db.ifood_diario,f:r=>r.data,alim:'nota, tempo de preparo, cancelamento e tempo online',como:'iFood › importar relatório ou conectar a API'}),
    B({k:'ifc',n:'iFood · comentários',freq:'semanal',rows:db.ifood_comentarios,f:r=>r.data,alim:'Voz do cliente',como:'Painel operacional › Voz do cliente › importar comentários'}),
    B({k:'google',n:'Google · nota e avaliações',freq:'diaria',rows:db.google_notas,f:r=>r.data,alim:'nota pública e comentários do Google',como:'atualização automática (Qualidade › Google)'}),
    B({k:'cmv',n:'CMV semanal',freq:'semanal',rows:db.cmv_contagens,f:r=>r.semana?addDia(r.semana,6):null,alim:'CMV no painel, DRE e metas',como:'CMV por loja › contagem semanal'}),
    B({k:'delchk',n:'Checklist de delivery',freq:'semanal',rows:db.delivery_checklists,f:r=>r.data,alim:'indicadores de delivery sem iFood conectado',como:'Checklist de delivery'}),
    B({k:'visita',n:'Visita de qualidade',freq:'mensal',rows:db.visitas_qualidade,f:r=>r.data,alim:'nota da visita no painel',como:'Checklist de qualidade'}),
    B({k:'vistoria',n:'Vistoria de operações',freq:'semanal',rows:db.vistorias_operacao,f:r=>r.data,alim:'retorno das vistorias',como:'Checklist de qualidade › vistoria'}),
    B({k:'rh',n:'RH mensal',freq:'mensal',rows:db.rh_movimentos,f:r=>r.mes?fimMes(r.mes):null,alim:'turnover e absenteísmo',como:'Indicadores de RH › movimentações'}),
    B({k:'dre',n:'Fechamento do DRE',freq:'mensal',rows:db.dre_lancamentos,f:r=>r.mes?fimMes(r.mes):null,alim:'resultado oficial por loja',como:'DRE por loja › lançamentos'}),
    B({k:'mix',n:'Mix de produtos (Colibri)',pend:true,freq:'diaria',alim:'alavancas de venda: % de pedidos com bebida, sobremesa e combo',como:'relatório de vendas por produto do Colibri'}),
  ];
  return CACHE.bases=out;
}
const PO_BST={ok:['ok','em dia'],warn:['warn','atrasada'],bad:['bad','atrasada'],demo:['neu','demonstração'],sem:['neu','pendente']};
function poBasesPill(){
  const el=$('#btnBases'); if(!el) return;
  if(!P.papel||P.papel==='colaborador'){el.classList.add('hidden');return}
  const bs=poBases(), atr=bs.filter(b=>b.st==='warn'||b.st==='bad'), grave=bs.some(b=>b.st==='bad');
  el.classList.remove('hidden'); el.className='pill-month bases-pill '+(atr.length?(grave?'b-bad':'b-warn'):'b-ok');
  el.innerHTML=`<i></i>${atr.length?`${atr.length} base${atr.length>1?'s':''} atrasada${atr.length>1?'s':''}`:'Bases em dia'}`;
  el.title=atr.length?'Atrasadas: '+atr.map(b=>b.n).join(', '):'Todas as bases com dados recebidos estão em dia';
}
function poFaixaHtml(){
  const bs=poBases().filter(b=>['caixa','vd','ifood','google','cmv','visita'].includes(b.k));
  return `<div class="po-faixa">${bs.map(b=>`<button class="po-fx ${b.st}" data-pobase="${b.k}" title="${esc(b.n)} · ${esc(b.txt)}${b.ult?' · último dado '+fmtD(b.ult):''}"><i></i><span><b>${esc(b.n)}</b><small>${b.ult?'até '+poDM(b.ult)+' · ':''}${esc(b.txt)}</small></span></button>`).join('')}<button class="po-fx mais" data-pobase="todas"><span><b>Todas as bases</b><small>ver situação completa</small></span></button></div>`;
}

/* ================= render ================= */
function renderPainel(){
  $$('#poNav button').forEach(b=>b.classList.toggle('on',b.dataset.s===PO.sub));
  $('#poFaixa').innerHTML=poFaixaHtml();
  $$('#poFaixa [data-pobase]').forEach(b=>b.onclick=()=>{PO.sub='bases';renderPainel()});
  $$('#tab-painel .po-sec').forEach(s=>s.classList.toggle('on',s.id==='po-'+PO.sub));
  try{({res:poResultado,prod:poProdutividade,voz:poVoz,bases:poBasesTela})[PO.sub]()}catch(e){console.error(e);toast('Erro ao montar o painel: '+e.message)}
}

/* ---------- 1. resultado por loja ---------- */
function poResultado(){
  const mes=S.mes, ls=poLojas(), L=ls.map(l=>poLinha(l.id,mes)), com=L.filter(x=>x.real!=null);
  const tot=f=>com.length?sum(com,f):null;
  const real=tot(x=>x.real), metaAte=tot(x=>x.metaAte||0), meta=sum(L,x=>x.meta||0), proj=tot(x=>x.proj||0);
  const ped=tot(x=>x.ped||0), ates=uniq(com.map(x=>x.ate)).sort(), ateTxt=ates.length?(ates.length===1?poDM(ates[0]):`${poDM(ates[0])} a ${poDM(ates.at(-1))}`):'';
  const ref=poRef(mes), d1L=L.filter(x=>x.d1!=null), hoje=isoHoje(), ehAtual=ymOf(hoje)===mes;
  const metaHoje=ehAtual?sum(ls,l=>metaDiaLoja(l.id,hoje)||0):null;
  const kp=(lbl,val,f,sub,st,bar)=>kpi(lbl,val,f,sub,bar).replace('class="card kpi"',`class="card kpi${st?' kpi-'+st:''}"`);
  $('#poKpis').innerHTML=
    kp('Realizado no mês',real,'brlK',com.length?`até ${ateTxt} · ${com.length} de ${ls.length} lojas`:'sem venda no mês',null,meta&&real!=null?real/meta*100:null)+
    kp('Versus meta até a data',metaAte&&real!=null?real/metaAte*100:null,'pct1',metaAte?`meta até ${ateTxt}: ${brlK(metaAte)}`:'meta do mês não cadastrada',metaAte&&real!=null?poSt(real/metaAte*100):'')+
    kp('Projeção de fechamento',proj||null,'brlK',meta&&proj?`${poPct(proj/meta*100)} da meta de ${brlK(meta)}`:'pelo ritmo do mês',meta&&proj?poSt(proj/meta*100):'')+
    kp(`Ontem (D-1)${ref?' · '+poDM(ref):''}`,d1L.length?sum(d1L,x=>x.d1):null,'brlK',d1L.length?`meta do dia ${brlK(sum(d1L,x=>x.m1||0))}`:'aguardando a venda diária do caixa',d1L.length?poSt(sum(d1L,x=>x.d1)/sum(d1L,x=>x.m1||0)*100):'')+
    kp('Ticket médio',ped?real/ped:null,'ticket',ped?`${nf0.format(ped)} pedidos no mês`:'sem pedidos no período')+
    kp(ehAtual?`Meta de hoje · ${poDiaSem(hoje)}`:'Meta média por dia',ehAtual?metaHoje:meta?meta/diasNoMes(mes):null,'brlK',ehAtual?'peso do dia da semana aplicado':'meta do mês ÷ dias');
  animateKpis($('#poKpis'));

  // curva acumulada: rede ou loja
  $('#poLoja').innerHTML=`<option value="rede">Rede</option>`+optLojas(ls,PO.loja);
  if(PO.loja!=='rede'&&!ls.some(l=>l.id===PO.loja))PO.loja='rede';
  $('#poLoja').value=PO.loja; $('#poLoja').onchange=()=>{PO.loja=$('#poLoja').value;poResultado()};
  poGraficoCurva(PO.loja==='rede'?ls.map(l=>l.id):[PO.loja],mes);

  // meta do dia
  $('#poDia').innerHTML=poMetaDiaHtml(ls,mes);

  // tabela no formato do painel regional
  $('#poTabela').innerHTML=poTabelaHtml(L,mes);
  $('#poTabInfo').textContent=com.length?`vendas: ${uniq(com.map(x=>x.fonte)).join(' · ')}`:'';
  $$('#poTabela [data-ploja]').forEach(b=>b.onclick=()=>{mlSel=b.dataset.ploja;go('loja')});

  // ranking pelo % da meta até a data
  const rk=L.filter(x=>x.pMtd!=null).sort((a,b)=>b.pMtd-a.pMtd);
  $('#poRank').innerHTML=rk.length?rk.map((x,i)=>{const st=poSt(x.pMtd);return `<div class="po-rk"><span class="pos ${i===0?'p1':''}">${i+1}</span><div><div class="po-rk-h"><b>${esc(x.nome)}</b>${poCel(poPct(x.pMtd),st)}</div>
    <div class="po-rk-bar"><i class="${st}" style="width:${Math.min(100,x.pMtd/1.25)}%"></i><em style="left:${100/1.25}%"></em></div>
    <div class="small muted">${brlK(x.real)} de ${brlK(x.metaAte)} até ${poDM(x.ate)}${x.proj&&x.meta?` · projeção ${poPct(x.pProj)}`:''}</div></div></div>`}).join('')+`<p class="small muted" style="margin-top:4px">Barra até 125% da meta; a marca vertical é 100%.</p>`
    :`<div class="empty">Sem venda com meta cadastrada em ${mesLongo(mes)}.</div>`;

  // pontos de atenção
  const at=[];
  L.forEach(x=>{
    if(x.pMtd!=null&&x.pMtd<100) at.push([x.pMtd<90?'bad':'warn',`${x.nome}: ${poPct(x.pMtd)} da meta até ${poDM(x.ate)}`,`faltam ${brlK(x.metaAte-x.real)} para a meta acumulada${x.proj&&x.meta?`; no ritmo atual o mês fecha em ${brlK(x.proj)} (${poPct(x.pProj)})`:''}`,x.pMtd]);
    [['ifood','Nota iFood',v=>nf1.format(v)],['preparo','Tempo de preparo',v=>nf1.format(v).replace(',0','')+' min'],['cancel','Cancelamentos',v=>poPct(v)],['online','Tempo online',v=>poPct(v)],['cmv','CMV',v=>poPct(v)]].forEach(([k,n,f])=>{if(x[k].st==='bad')at.push(['bad',`${x.nome}: ${n} ${f(x[k].v)}`,`fora da meta · ${x[k].src}`,200])});
    if(x.google.st==='bad') at.push(['bad',`${x.nome}: Google ${nf1.format(x.google.v)}★`,'abaixo da meta da nota do Google',210]);
    if(x.quadro.st==='bad') at.push(['bad',`${x.nome}: quadro ${x.quadro.atv}/${x.quadro.prev}`,`${x.vagas?x.vagas+' vaga'+(x.vagas>1?'s':'')+' em andamento':'sem vaga aberta para completar'}`,220]);
  });
  poBases().filter(b=>b.st==='bad'||b.st==='warn').forEach(b=>at.push([b.st,`Base atrasada: ${b.n}`,`último dado ${fmtD(b.ult)} · ${b.txt}`,300]));
  at.sort((a,b)=>(a[0]==='bad'?0:1)-(b[0]==='bad'?0:1)||a[3]-b[3]);
  $('#poAtencao').innerHTML=at.length?at.map(([c,t,d])=>`<div class="alert"><span class="dot" style="background:var(--${c==='bad'?'bad':'amber'})"></span><div><b>${esc(t)}</b><div class="small muted">${esc(d)}</div></div></div>`).join(''):'<div class="empty">Nada fora do esperado no mês.</div>';
}

function poGraficoCurva(ids,mes){
  const cs=ids.map(id=>poCurva(id,mes)), ds=cs[0]?cs[0].ds:diasDoMes(mes);
  const soma=arr=>ds.map((_,i)=>{const vs=cs.map(c=>c[arr][i]);return vs.every(v=>v==null)?null:vs.some(v=>v==null)?undefined:sum(vs)});
  let meta=soma('meta'), real=soma('real'), proj=soma('proj');
  meta=meta.map(v=>v===undefined?null:v); real=real.map(v=>v===undefined?null:v); proj=proj.map(v=>v===undefined?null:v);
  const temReal=real.some(v=>v!=null), umPonto=real.filter(v=>v!=null).length===1;
  $('#poCurvaSub').textContent=cs.length&&cs.every(c=>c.L.s.acum)?'acumulado do caixa':'';
  if(!meta.some(v=>v!=null)&&!temReal){noData('cPoCurva','Sem meta e sem venda no mês.');return}
  mk('cPoCurva',{type:'line',data:{labels:ds.map(d=>+d.slice(8,10)),datasets:[
    {label:'Meta acumulada',data:meta,borderColor:'#d28e05',borderWidth:2,borderDash:[6,5],pointRadius:0,tension:.25},
    {label:'Realizado',data:real,borderColor:C.red,backgroundColor:C.red,borderWidth:2.5,pointRadius:umPonto?7:0,pointHoverRadius:8,pointBorderColor:'#1d1715',pointBorderWidth:2,fill:false,tension:.25,spanGaps:false},
    {label:'Projeção',data:proj,borderColor:'rgba(238,219,202,.75)',borderWidth:2,borderDash:[2,4],pointRadius:0,tension:.25}
  ]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{title:t=>'Dia '+t[0].label,label:c=>c.parsed.y==null?null:' '+c.dataset.label+': '+brl(c.parsed.y)}}},
    scales:{y:yR,x:{...xG,ticks:{maxRotation:0,autoSkipPadding:10}}}}});
}

function poMetaDiaHtml(ls,mes){
  const hoje=isoHoje(), ref=poRef(mes);
  if(ymOf(hoje)===mes){
    const am=addDia(hoje,1)<=fimMes(mes)?addDia(hoje,1):null;
    return `<table class="po-dia"><thead><tr><th>Loja</th><th class="num">Ontem ${poDM(ref)}<div class="po-th2">real · meta</div></th><th class="num">Hoje ${poDM(hoje)}<div class="po-th2">${poDiaSem(hoje)}</div></th></tr></thead><tbody>${ls.map(l=>{const x=poLinha(l.id,mes);
      return `<tr><td><b>${esc(l.nome)}</b></td><td class="num">${x.d1!=null?poCel(brlK(x.d1),poSt(x.pD1))+`<div class="small muted">${brlK(x.m1)}</div>`:`<span class="muted">— · ${x.m1!=null?brlK(x.m1):'—'}</span>`}</td><td class="num"><b>${brlK(metaDiaLoja(l.id,hoje))}</b></td></tr>`}).join('')}</tbody></table>
      <p class="small muted" style="margin-top:10px">Meta do dia = meta do mês × peso do dia da semana.${am?` Amanhã (${poDiaSem(am)}): ${brlK(sum(ls,l=>metaDiaLoja(l.id,am)||0))} na rede.`:''} ${ls.some(l=>poLinha(l.id,mes).d1!=null)?'':'O realizado de ontem aparece quando a venda diária do caixa for importada.'}</p>`;
  }
  const pw=pesoDia(), ord=['seg','ter','qua','qui','sex','sab','dom'], pm=poPesoMes(mes);
  return `<table><thead><tr><th>Loja</th>${ord.map(d=>`<th class="num">${({seg:'Seg',ter:'Ter',qua:'Qua',qui:'Qui',sex:'Sex',sab:'Sáb',dom:'Dom'})[d]}</th>`).join('')}</tr></thead><tbody>${ls.map(l=>{const m=IDX.mv.get(l.id+'|'+mes);
    return `<tr><td><b>${esc(l.nome)}</b></td>${ord.map(d=>`<td class="num">${m!=null?brlK(m*pw[d]/pm):'—'}</td>`).join('')}</tr>`}).join('')}</tbody></table><p class="small muted" style="margin-top:10px">Meta de cada dia da semana em ${mesLongo(mes).toLowerCase()}.</p>`;
}

function poTabelaHtml(L,mes){
  const g=(t,n,cls)=>`<th colspan="${n}" class="po-g ${cls}">${t}</th>`;
  const ind=(o,f)=>o.v==null?'<span class="muted">—</span>':poCel(f(o.v),o.st);
  const fNota=v=>nf1.format(v), fMin=v=>nf1.format(v).replace(',0','')+' min', fP=v=>poPct(v);
  const linha=(x,rede)=>`<tr class="${rede?'po-rede':''}">
    <td class="po-fix">${rede?'<b>Rede</b>':`<button class="po-lk" data-ploja="${x.id}">${esc(x.nome)}</button>`}${!rede&&x.ate?`<div class="small muted">até ${poDM(x.ate)}</div>`:''}</td>
    <td class="num">${x.d1!=null?brl(x.d1):'—'}</td><td class="num muted">${x.m1!=null?brl(x.m1):'—'}</td><td class="num">${x.pD1!=null?poCel(poVar(x.pD1-100),poSt(x.pD1)):'—'}</td>
    <td class="num po-gs"><b>${brlK(x.real)}</b></td><td class="num muted">${brlK(x.metaAte)}</td><td class="num">${x.pMtd!=null?poCel(poVar(x.pMtd-100),poSt(x.pMtd)):'—'}</td>
    <td class="num po-gs">${brlK(x.proj)}</td><td class="num muted">${brlK(x.meta)}</td><td class="num">${x.pProj!=null?poCel(poPct(x.pProj),poSt(x.pProj)):'—'}</td>
    <td class="num po-gs">${x.ped!=null?nf0.format(x.ped):'—'}</td><td class="num">${x.ticket?'R$ '+nf2.format(x.ticket):'—'}</td>
    <td class="num po-gs">${rede?'—':ind(x.ifood,fNota)}</td><td class="num">${rede?'—':ind(x.preparo,fMin)}</td><td class="num">${rede?'—':ind(x.cancel,fP)}</td><td class="num">${rede?'—':ind(x.online,fP)}</td>
    <td class="num po-gs">${rede?'—':x.google.v!=null?poCel(nf1.format(x.google.v)+'★',x.google.st):'—'}</td><td class="num">${rede?'—':x.visita.v!=null?poCel(nf0.format(x.visita.v)+'%',x.visita.st)+(x.visita.mes?'':`<div class="small muted">${poDM(x.visita.data)}</div>`):'—'}</td>
    <td class="num po-gs">${rede?'—':ind(x.cmv,fP)}</td>
    <td class="num po-gs">${x.quadro.prev?poCel(`${x.quadro.atv}/${x.quadro.prev}`,x.quadro.st):x.quadro.atv||'—'}</td><td class="num">${x.vagas||'—'}</td><td class="num">${x.prod&&x.prod.rsH?'R$ '+nf0.format(x.prod.rsH):'—'}</td>
  </tr>`;
  const com=L.filter(x=>x.real!=null), tt=f=>sum(L,f);
  const rede={real:com.length?tt(x=>x.real||0):null,metaAte:tt(x=>x.metaAte||0)||null,meta:tt(x=>x.meta||0)||null,proj:com.length?tt(x=>x.proj||0):null,
    d1:L.some(x=>x.d1!=null)?tt(x=>x.d1||0):null,m1:L.some(x=>x.d1!=null)?tt(x=>x.d1!=null?x.m1||0:0):null,ped:com.length?tt(x=>x.ped||0):null,
    quadro:{atv:tt(x=>x.quadro.atv),prev:tt(x=>x.quadro.prev)},vagas:tt(x=>x.vagas)};
  rede.pMtd=rede.metaAte&&rede.real!=null?rede.real/rede.metaAte*100:null; rede.pProj=rede.meta&&rede.proj?rede.proj/rede.meta*100:null; rede.pD1=rede.m1&&rede.d1!=null?rede.d1/rede.m1*100:null;
  rede.ticket=rede.ped?rede.real/rede.ped:null; rede.quadro.st=rede.quadro.prev?(rede.quadro.atv>=rede.quadro.prev?'ok':rede.quadro.atv>=rede.quadro.prev*.8?'warn':'bad'):'neu';
  const hs=L.filter(x=>x.prod&&x.prod.horas); rede.prod=hs.length?{rsH:sum(hs,x=>x.prod.fat)/sum(hs,x=>x.prod.horas)}:null;
  return `<table class="po-tbl"><thead>
    <tr><th class="po-fix"></th>${g('Vendas ontem (D-1)',3,'c1')}${g('Acumulado no mês',3,'c2')}${g('Projeção do mês',3,'c3')}${g('Pedidos',2,'c4')}${g('Delivery',4,'c5')}${g('Qualidade',2,'c6')}${g('Custo',1,'c7')}${g('Pessoas',3,'c8')}</tr>
    <tr><th class="po-fix">Loja</th><th class="num">Real</th><th class="num">Meta</th><th class="num">Var.</th><th class="num po-gs">Real</th><th class="num">Meta até a data</th><th class="num">Var.</th>
    <th class="num po-gs">Projeção</th><th class="num">Meta do mês</th><th class="num">% meta</th><th class="num po-gs">Pedidos</th><th class="num">Ticket</th>
    <th class="num po-gs">Nota iFood</th><th class="num">Preparo</th><th class="num">Cancel.</th><th class="num">Online</th><th class="num po-gs">Google</th><th class="num">Visita</th><th class="num po-gs">CMV</th>
    <th class="num po-gs">Quadro</th><th class="num">Vagas</th><th class="num">R$/h trab.</th></tr></thead>
    <tbody>${L.map(x=>linha(x)).join('')}${L.length>1?linha(rede,true):''}</tbody></table>`;
}

/* ---------- 2. produtividade ---------- */
function poProdutividade(){
  const mes=S.mes, ls=poLojas(), R=ls.map(l=>({l,p:poProd(l.id,mes)})), com=R.filter(r=>r.p&&r.p.horas);
  const H=sum(com,r=>r.p.horas), F=sum(com,r=>r.p.fat), Pd=sum(com,r=>r.p.ped||0);
  $('#prKpis').innerHTML=
    kpi('Venda por hora trabalhada',H?F/H:null,'brl','rede · faturamento ÷ horas escaladas')+
    kpi('Pedidos por hora trabalhada',H&&Pd?Pd/H:null,'dec1',Pd?'rede · pedidos ÷ horas escaladas':'sem pedidos no período')+
    kpi('Horas escaladas',H||null,'int',com.length?`${com.length} loja${com.length>1?'s':''} · ${uniq(com.map(r=>r.p.dias)).join('/')} dias do mês`:'sem escala ou venda no mês')+
    kpi('Pessoas na escala',com.length?sum(com,r=>r.p.pessoas):null,'int','sem contar vagas abertas');
  animateKpis($('#prKpis'));
  const mx=Math.max(1,...com.map(r=>r.p.rsH));
  $('#prTabela').innerHTML=R.length?`<table><thead><tr><th>Loja</th><th>Escala usada</th><th class="num">Dias</th><th class="num">Horas escaladas</th><th class="num">Faturamento</th><th class="num" style="min-width:150px">R$ por hora trab.</th><th class="num">Pedidos/hora</th><th class="num">Almoço<div class="po-th2">pessoas 12h30</div></th><th class="num">Jantar<div class="po-th2">pessoas 20h</div></th></tr></thead><tbody>${R.map(({l,p})=>p?`<tr>
      <td><b>${esc(l.nome)}</b></td><td>${esc(p.escala.nome)}${p.aprox?' <span class="tag" title="Não há escala salva para este mês; usamos a mais recente">aproximada</span>':''}</td><td class="num">${p.dias}</td><td class="num">${nf0.format(p.horas)} h</td><td class="num">${brlK(p.fat)}</td>
      <td class="num"><b>${p.rsH?'R$ '+nf0.format(p.rsH):'—'}</b><div class="po-mini"><i style="width:${p.rsH?p.rsH/mx*100:0}%"></i></div></td><td class="num">${p.pedH?nf1.format(p.pedH):'—'}</td><td class="num">${p.alm!=null?nf1.format(p.alm):'—'}</td><td class="num">${p.jan!=null?nf1.format(p.jan):'—'}</td></tr>`
      :`<tr><td><b>${esc(l.nome)}</b></td><td colspan="8" class="muted">${lojaStats(l.id,mes).temVenda?'sem escala cadastrada':'sem venda no mês'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Nenhuma loja em operação.</div>';

  const op=com.filter(r=>r.p.temHora);
  if(!PO.prLoja||!op.some(r=>r.l.id===PO.prLoja)) PO.prLoja=op.length?op[0].l.id:null;
  $('#prLoja').innerHTML=optLojas(op.map(r=>r.l),PO.prLoja); $('#prLoja').onchange=()=>{PO.prLoja=$('#prLoja').value;poProdutividade()};
  const p=PO.prLoja?poProd(PO.prLoja,mes):null;
  if(!p){noData('cPrVenda','Precisa da venda por hora do caixa e de uma escala da loja.');noData('cPrPessoa','Precisa da venda por hora do caixa e de uma escala da loja.');$('#prInsight').innerHTML='<div class="empty">Sem dados para a análise por hora.</div>';$('#prHoras').innerHTML='';return}
  const hs=[];for(let h=6;h<=24;h++) if((p.venda[h]||0)>0||p.ph[h]>0) hs.push(h);
  const lab=hs.map(h=>String(h%24).padStart(2,'0')+'h'), vd=hs.map(h=>p.venda[h]?p.venda[h]/p.dias:0), pe=hs.map(h=>p.ph[h]/p.dias), rp=hs.map((h,i)=>pe[i]>0?vd[i]/pe[i]:null);
  const tv=sum(hs.filter(h=>p.ph[h]>0),h=>p.venda[h]||0), tp=sum(hs,h=>p.ph[h]), med=tp?tv/tp:null;
  $('#prSub').textContent=`${p.dias} dias · ${p.escala.nome}${p.aprox?' (aproximada)':''}`;
  mk('cPrVenda',{type:'bar',data:{labels:lab,datasets:[{label:'Venda média',data:vd,backgroundColor:'#c98f2c',borderRadius:4,maxBarThickness:26}]},
    options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' Venda média: '+brl(c.parsed.y)+' por dia'}}},scales:{y:poYR,x:{...xG,ticks:{maxRotation:0,autoSkipPadding:6}}}}});
  mk('cPrPessoa',{type:'bar',data:{labels:lab,datasets:[
    {label:'R$ por pessoa na hora',data:rp,backgroundColor:'#4f9cf0',borderRadius:4,maxBarThickness:26},
    {type:'line',label:'Média da loja',data:hs.map(()=>med),borderColor:'rgba(238,219,202,.7)',borderDash:[5,4],borderWidth:1.5,pointRadius:0}]},
    options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.parsed.y==null?' sem ninguém na escala':' '+c.dataset.label+': '+brl(c.parsed.y),afterBody:t=>{const i=t[0].dataIndex;return `Pessoas na escala: ${nf1.format(pe[i])}`}}}},scales:{y:poYR,x:{...xG,ticks:{maxRotation:0,autoSkipPadding:6}}}}});
  const it=hs.map((h,i)=>({h,l:lab[i],v:vd[i],p:pe[i],r:rp[i]}));
  const sem=it.filter(x=>x.v>0&&x.p===0), apert=it.filter(x=>x.r!=null&&med&&x.r>med*1.35&&x.v>0).sort((a,b)=>b.r-a.r).slice(0,4), folga=it.filter(x=>x.v>0&&x.r!=null&&med&&x.r<med*.55&&x.p>=1).sort((a,b)=>a.r-b.r).slice(0,4), prep=it.filter(x=>!x.v&&x.p>0);
  const li=(c,t,d)=>`<div class="alert"><span class="dot" style="background:${c}"></span><div><b>${t}</b><div class="small muted">${d}</div></div></div>`;
  $('#prInsight').innerHTML=(apert.length?li('var(--bad)','Equipe apertada: '+apert.map(x=>x.l).join(', '),`muita venda por pessoa (acima de 1,35× a média de ${brl(med)}). Reforçar nesses horários ou antecipar a produção.`):'')+
    (folga.length?li('var(--amber)','Equipe folgada: '+folga.map(x=>x.l).join(', '),'pouca venda por pessoa nesses horários. Vale conferir se a entrada, a pausa ou a saída pode mudar.'):'')+
    (prep.length?li('#8a7c72','Equipe sem venda no caixa: '+poFaixas(prep.map(x=>x.h)),`${nf1.format(sum(prep,x=>x.p))} pessoas-hora por dia em preparo, abertura ou fechamento.`):'')+
    (sem.length?li('var(--bad)','Venda sem ninguém na escala: '+sem.map(x=>x.l).join(', '),'a escala não cobre esse horário. Confira os horários cadastrados.'):'')+
    (!apert.length&&!folga.length&&!sem.length?'<div class="empty">Equipe proporcional à venda em todas as horas.</div>':'')+
    `<p class="small muted" style="margin-top:8px">Venda: relatório por hora do caixa. Pessoas: escala da loja, sem vagas abertas. Valores médios por dia.</p>`;
  $('#prHoras').innerHTML=`<table><thead><tr><th>Hora</th><th class="num">Venda média por dia</th><th class="num">Pessoas na escala</th><th class="num">R$ por pessoa</th></tr></thead><tbody>${it.map(x=>`<tr><td>${x.l}</td><td class="num">${x.v?brl(x.v):'—'}</td><td class="num">${x.p?nf1.format(x.p):'—'}</td><td class="num">${!x.v?'<span class="small muted">preparo</span>':x.r!=null?poCel(brl(x.r),med?(x.r>med*1.35?'bad':x.r<med*.55?'warn':'ok'):'neu'):'<span class="small" style="color:var(--bad)">sem escala</span>'}</td></tr>`).join('')}</tbody></table>`;
}

/* ---------- 3. voz do cliente (Google + iFood) ---------- */
const PO_TEMAS=[
  ['Atraso e demora',/demor|atras|tempo de (espera|entrega)|chegou tarde|esper(ei|amos|ando)|lent[oa]|mais de (uma|1|2|duas) hora/],
  ['Temperatura',/\bfri[oa]s?\b|gelad|morn[oa]|esfri/],
  ['Porção e tamanho',/pequen|pouc[ao]s? (comida|arroz|carne|frango|quantidade)|porc(ao|oes)|quantidade|miser|tamanho/],
  ['Sabor e preparo',/sem (gosto|sabor|tempero)|salgad|insoss|queimad|\bcru[as]?\b|dur[oa]s?\b|murch|oleos|gordur|ressecad|sabor ruim|massa crua|passad[oa] do ponto|azed|estragad/],
  ['Pedido errado ou faltando',/falt(ou|ando|aram)|nao veio|nao vieram|veio errad|pedido errad|item errad|esquec|trocad|incomplet/],
  ['Embalagem',/embalag|vaz(ou|ando|ad)|derram|amass|lacre/],
  ['Atendimento',/atend|educad|grosse|grossa|grosso|simpat|antipat|funcionari|garcom|garçom|caixa /],
  ['Preço',/\bcar[oa]s?\b|preco|custo.benef|nao vale/],
  ['Higiene',/cabelo|sujeir|\bsuj[oa]s?\b|inseto|barata|mosca|higien|plastico na/],
];
const PO_ELOGIO=/otim|excelent|delici|maravilh|perfeit|amei|adorei|recomendo|muito bo[am]|saboros|incrivel|melhor|top\b|nota 10|show/;
const poNorm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function poTemas(t){const n=poNorm(t);return PO_TEMAS.filter(([,r])=>r.test(n)).map(([x])=>x)}
function poComentarios(){
  if(CACHE.vc) return CACHE.vc;
  const g=(S.db.google_reviews||[]).map(r=>({id:'g:'+r.id,fonte:'Google',loja:r.loja_id,data:(r.publicado_em||'').slice(0,10),nota:+r.nota,texto:r.texto||'',autor:r.autor||'',quando:r.relativo||'',ref:String(r.id).split('/').pop()}));
  const i=(S.db.ifood_comentarios||[]).map(r=>({id:'i:'+r.id,fonte:'iFood',loja:r.loja_id,data:r.data,nota:r.nota!=null?+r.nota:null,texto:r.comentario||'',autor:r.pedido?'pedido '+String(r.pedido).slice(0,8):'',ref:r.pedido||String(r.id)}));
  const all=g.concat(i).filter(x=>x.data);
  all.forEach(x=>{x.temas=poTemas(x.texto);x.neg=x.nota!=null&&x.nota<=3;x.elogio=!x.neg&&PO_ELOGIO.test(poNorm(x.texto))});
  return CACHE.vc=all.sort((a,b)=>b.data.localeCompare(a.data));
}
function poVoz(){
  const mes=S.mes, ls=poLojas(), ids=ls.map(l=>l.id);
  const ini=PO.vcPer==='mes'?iniMes(mes):addDia(isoHoje(),-90), fim=PO.vcPer==='mes'?fimMes(mes):isoHoje();
  $('#vcPerTxt').textContent=PO.vcPer==='mes'?mesLongo(mes):'últimos 90 dias';
  $$('#vcPer button').forEach(b=>{b.classList.toggle('on',b.dataset.p===PO.vcPer);b.onclick=()=>{PO.vcPer=b.dataset.p;poVoz()}});
  const base=poComentarios().filter(x=>ids.includes(x.loja)&&x.data>=ini&&x.data<=fim);
  const comNota=base.filter(x=>x.nota!=null), neg=base.filter(x=>x.neg), comTxt=base.filter(x=>x.texto.trim());
  const cont={}; neg.forEach(x=>x.temas.forEach(t=>cont[t]=(cont[t]||0)+1));
  const temas=Object.entries(cont).sort((a,b)=>b[1]-a[1]);
  const nG=base.filter(x=>x.fonte==='Google').length, nI=base.length-nG;
  $('#vcKpis').innerHTML=
    kpi('Avaliações no período',base.length||null,'int',`Google ${nG} · iFood ${nI}`)+
    kpi('Nota média',comNota.length?sum(comNota,x=>x.nota)/comNota.length:null,'dec1',comNota.length?'de 1 a 5 estrelas':'sem nota no período')+
    kpi('Avaliações negativas',comNota.length?neg.length/comNota.length*100:null,'pct1',`${neg.length} com 3 estrelas ou menos`)+
    kpi('Tema que mais aparece',null,'int','');
  animateKpis($('#vcKpis'));
  const k4=$('#vcKpis').lastElementChild; k4.querySelector('.val').textContent=temas.length?temas[0][0]:'—'; k4.querySelector('.val').classList.add('po-val-txt');
  k4.querySelector('.sub').textContent=temas.length?`${temas[0][1]} das ${neg.length} negativas`:neg.length?'negativas sem tema reconhecido':'nenhuma negativa no período';
  if(temas.length) mk('cVcTemas',{type:'bar',data:{labels:temas.map(t=>t[0]),datasets:[{label:'Avaliações negativas',data:temas.map(t=>t[1]),backgroundColor:'#d93a48',borderRadius:4,maxBarThickness:22}]},
    options:{indexAxis:'y',onClick:(e,el)=>{if(el.length){const t=temas[el[0].index][0];PO.vcTema=PO.vcTema===t?'':t;poVozLista(base)}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.parsed.x} avaliação${c.parsed.x>1?'ões':''} negativa${c.parsed.x>1?'s':''}`}}},
      scales:{x:{grid:{color:C.grid},border:{display:false},ticks:{precision:0}},y:{grid:{display:false},border:{display:false}}}}});
  else noData('cVcTemas',neg.length?'As avaliações negativas do período não citam um tema reconhecido.':'Nenhuma avaliação negativa no período.');
  // por loja
  $('#vcLojas').innerHTML=`<table><thead><tr><th>Loja</th><th class="num">Avaliações</th><th class="num">Nota</th><th class="num">Negativas</th><th>Tema principal</th><th class="num">Google</th></tr></thead><tbody>${ls.map(l=>{
    const b=base.filter(x=>x.loja===l.id), cn=b.filter(x=>x.nota!=null), ng=b.filter(x=>x.neg), c={};ng.forEach(x=>x.temas.forEach(t=>c[t]=(c[t]||0)+1));const tp=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];
    const pn=cn.length?ng.length/cn.length*100:null, gg=poLinha(l.id,mes).google;
    return `<tr><td><b>${esc(l.nome)}</b></td><td class="num">${b.length||'—'}</td><td class="num">${cn.length?nf1.format(sum(cn,x=>x.nota)/cn.length):'—'}</td><td class="num">${pn!=null?poCel(poPct(pn),pn<=15?'ok':pn<=30?'warn':'bad'):'—'}</td><td class="po-wrap" style="min-width:130px">${tp?`${esc(tp[0])} <span class="muted small">(${tp[1]})</span>`:'<span class="muted">—</span>'}</td><td class="num">${gg.v!=null?poCel(nf1.format(gg.v)+'★',gg.st):'—'}</td></tr>`}).join('')}</tbody></table>`;
  // filtros
  $('#vcLoja').innerHTML=`<option value="">Todas as lojas</option>`+optLojas(ls,PO.vcLoja); $('#vcLoja').onchange=()=>{PO.vcLoja=$('#vcLoja').value;poVozLista(base)};
  $('#vcFonte').value=PO.vcFonte; $('#vcFonte').onchange=()=>{PO.vcFonte=$('#vcFonte').value;poVozLista(base)};
  $('#vcNeg').checked=PO.vcNeg; $('#vcNeg').onchange=()=>{PO.vcNeg=$('#vcNeg').checked;poVozLista(base)};
  $('#vcImport').onclick=poImportarIfood; $('#vcModelo').onclick=()=>csv('modelo-comentarios-ifood.csv',[['Loja','ID Pedido','Data do Pedido','Data Avaliação','Avaliação','Comentários'],[ls[0]?ls[0].nome:'Perdizes','abc123','2026-11-20','2026-11-21','2','Veio frio e faltou o molho']]);
  poVozLista(base);
}
function poVozLista(base){
  const temasDisp=uniq(base.flatMap(x=>x.temas));
  if(PO.vcTema&&!temasDisp.includes(PO.vcTema)) PO.vcTema='';
  $('#vcTemas').innerHTML=`<button class="po-chip ${PO.vcTema?'':'on'}" data-t="">Todos os temas</button>`+PO_TEMAS.map(([t])=>t).filter(t=>temasDisp.includes(t)).map(t=>`<button class="po-chip ${PO.vcTema===t?'on':''}" data-t="${esc(t)}">${esc(t)}</button>`).join('');
  $$('#vcTemas [data-t]').forEach(b=>b.onclick=()=>{PO.vcTema=b.dataset.t;poVozLista(base)});
  const rs=base.filter(x=>(!PO.vcLoja||x.loja===PO.vcLoja)&&(PO.vcFonte==='todas'||x.fonte===PO.vcFonte)&&(!PO.vcNeg||x.neg)&&(!PO.vcTema||x.temas.includes(PO.vcTema))&&x.texto.trim());
  const pa=S.db.planos_acao||[], temPlano=x=>pa.some(a=>a.loja_id===x.loja&&(a.obs||'').includes('ref '+x.ref));
  $('#vcN').textContent=`${rs.length} comentário${rs.length===1?'':'s'}`;
  $('#vcLista').innerHTML=rs.length?rs.slice(0,60).map(x=>`<div class="po-cm ${x.neg?'neg':x.elogio?'pos':''}">
      <div class="po-cm-h"><span class="po-st" aria-label="${x.nota??'sem'} estrelas">${x.nota!=null?'★'.repeat(Math.round(x.nota))+'<i>'+'★'.repeat(5-Math.round(x.nota))+'</i>':'sem nota'}</span>
        <span class="tag po-f-${x.fonte==='Google'?'g':'i'}">${x.fonte}</span><b>${esc(lojaNome(x.loja))}</b><span class="muted small">${fmtD(x.data)}${x.autor?' · '+esc(x.autor):''}</span></div>
      <p>${esc(x.texto)}</p>
      <div class="po-cm-f">${x.temas.map(t=>`<span class="po-tm">${esc(t)}</span>`).join('')}${x.elogio?'<span class="po-tm ok">Elogio</span>':''}
        ${x.neg&&P.editar(x.loja)?(temPlano(x)?'<span class="small muted" style="margin-left:auto">plano de ação criado</span>':`<button class="btn sm" style="margin-left:auto" data-vcpa="${esc(x.id)}">Criar plano de ação</button>`):''}</div>
    </div>`).join('')+(rs.length>60?`<p class="small muted">Mostrando os 60 mais recentes.</p>`:'')
    :`<div class="empty">${base.length?'Nenhum comentário com esses filtros.':'Nenhuma avaliação no período. Importe os comentários do iFood ou aguarde a atualização do Google.'}</div>`;
  $$('#vcLista [data-vcpa]').forEach(b=>b.onclick=async()=>{const x=rs.find(r=>r.id===b.dataset.vcpa);if(!x)return;
    const ok=await dbw(sb.from('planos_acao').insert({loja_id:x.loja,origem:x.fonte==='Google'?'google':'ifood',problema:`Avaliação de ${x.nota}★ no ${x.fonte}: "${x.texto.slice(0,220)}${x.texto.length>220?'…':''}"`,secao:x.temas[0]||'Avaliações de clientes',prioridade:x.nota<=2?'Alta':'Média',status:'Pendente',obs:`${x.autor||'Cliente'} · ${fmtD(x.data)} · ref ${x.ref}`}),'Plano de ação criado.');
    if(ok){await load(['planos_acao']);poVozLista(base)}});
}
function poImportarIfood(){
  const ls=lojasEditaveis(true);
  if(!ls.length){toast('Sem permissão para importar.');return}
  modal(`<h3>Importar comentários do iFood</h3><p class="small muted" style="margin-bottom:12px">Arquivo CSV com as colunas Loja (ou escolha abaixo), ID Pedido, Data do Pedido, Data Avaliação, Avaliação (1 a 5) e Comentários. Linhas já importadas são ignoradas.</p>
    <label class="f">Loja<select class="inp" id="ivLoja"><option value="">pela coluna Loja do arquivo</option>${optLojas(ls)}</select></label>
    <label class="f mt">Arquivo<input class="inp" type="file" id="ivArq" accept=".csv,text/csv"></label>
    <div class="actions mt"><button class="btn" id="ivNo">Cancelar</button><button class="btn pri" id="ivOk">Importar</button></div>`,b=>{
    b.querySelector('#ivNo').onclick=fecharModal;
    b.querySelector('#ivOk').onclick=async()=>{const f=b.querySelector('#ivArq').files[0];if(!f){toast('Escolha o arquivo.');return}
      const rows=parseCsv(await f.text()); if(rows.length<2){toast('Arquivo vazio.');return}
      const hd=rows[0].map(poNorm), col=(...ks)=>hd.findIndex(h=>ks.some(k=>h.includes(k)));
      const cL=col('loja','restaurante'), cP=col('id pedido','pedido'), cDP=col('data do pedido'), cD=hd.findIndex(h=>h.includes('data') && h.includes('avalia')), cN=hd.findIndex(h=>(h.includes('avaliacao')||h.includes('nota'))&&!h.includes('data')), cC=col('coment');
      const fixa=b.querySelector('#ivLoja').value, porNome=n=>{const x=poNorm(n);return ls.find(l=>poNorm(l.nome)===x||l.id===x||x.includes(poNorm(l.nome)))};
      const ex=new Set((S.db.ifood_comentarios||[]).map(r=>[r.loja_id,r.pedido||'',r.data,r.comentario||''].join('|')));
      const out=[], erros=[];
      rows.slice(1).forEach((r,i)=>{const lj=fixa?ls.find(l=>l.id===fixa):cL>=0?porNome(r[cL]):null;
        const d=dataBR(r[cD>=0?cD:cDP]||''), n=cN>=0?numBR(r[cN]):null;
        if(!lj){erros.push(`linha ${i+2}: loja não encontrada`);return} if(!d){erros.push(`linha ${i+2}: data inválida`);return}
        const o={loja_id:lj.id,pedido:cP>=0&&r[cP]?String(r[cP]).trim():null,data_pedido:cDP>=0?dataBR(r[cDP]):null,data:d,nota:n!=null&&!isNaN(n)&&n>=1&&n<=5?n:null,comentario:cC>=0&&r[cC]&&r[cC].trim()!=='-'?r[cC].trim():null};
        const kk=[o.loja_id,o.pedido||'',o.data,o.comentario||''].join('|'); if(ex.has(kk)) return; ex.add(kk); out.push(o)});
      if(!out.length){toast(erros.length?erros[0]:'Nenhuma linha nova no arquivo.');return}
      let ok=0; for(let i=0;i<out.length;i+=500){if(await dbw(sb.from('ifood_comentarios').insert(out.slice(i,i+500))))ok+=Math.min(500,out.length-i);else break}
      fecharModal(); toast(`${ok} comentário${ok===1?'':'s'} importado${ok===1?'':'s'}${erros.length?` · ${erros.length} linha(s) ignorada(s)`:''}.`);
      await load(['ifood_comentarios']); poVoz();
    }});
}

/* ---------- 4. bases ---------- */
function poBasesTela(){
  const bs=poBases(), n=s=>bs.filter(b=>b.st===s).length;
  $('#bsKpis').innerHTML=kpi('Em dia',n('ok'),'int','bases com dado recente')+kpi('Atrasadas',n('warn')+n('bad'),'int','passaram do prazo de atualização')+kpi('Só demonstração',n('demo'),'int','precisam do dado real')+kpi('Ainda não recebidas',n('sem'),'int','liberam novos indicadores');
  animateKpis($('#bsKpis'));
  const fq={diaria:'diária (D-1)',semanal:'semanal',mensal:'mensal'};
  $('#bsTabela').innerHTML=`<table><thead><tr><th>Base</th><th>Situação</th><th>Último dado</th><th>Frequência</th><th>Alimenta</th><th>Como atualizar</th></tr></thead><tbody>${bs.map(b=>{const [c,t]=PO_BST[b.st];
    return `<tr><td><b>${esc(b.n)}</b></td><td>${poCel(b.st==='ok'?'em dia':b.st==='sem'?'pendente':b.st==='demo'?'demonstração':t,c)}<div class="small muted">${esc(b.txt)}</div></td><td>${b.ult?fmtD(b.ult):'—'}</td><td>${fq[b.freq]}</td><td class="po-wrap small">${esc(b.alim)}</td><td class="po-wrap small muted">${esc(b.como)}</td></tr>`}).join('')}</tbody></table>
    <p class="small muted" style="margin-top:10px">Prazos: base diária em dia quando tem o dado de ontem; semanal até 8 dias; mensal até 40 dias depois do fim do mês.</p>`;
}

function initPainel(){
  $$('#poNav button').forEach(b=>b.onclick=()=>{PO.sub=b.dataset.s;renderPainel()});
  const bb=$('#btnBases'); if(bb) bb.onclick=()=>{PO.sub='bases';go('painel')};
}
