/* ================= RH · Escalas de colaboradores ================= */
const ES_DIAS=['seg','ter','qua','qui','sex','sab','dom1','dom2','dom3','dom4','dom5'];
const ES_DL={seg:'Seg',ter:'Ter',qua:'Qua',qui:'Qui',sex:'Sex',sab:'Sáb'};
const ES_SETORES=['Cozinha','Expedição','Limpeza','Estoque','Produção'];
const ES_VINC=['CLT','Freelancer V.A','Freelancer fixo','Vaga aberta','A definir'];
const ES_TIPO={vigente:'Em vigor',planejada:'Planejada',proposta:'Proposta',arquivada:'Arquivada'};
const ES_ALM=12*60+30, ES_JAN=20*60; // plantões: quem está trabalhando às 12h30 (almoço) e às 20h (jantar)
const esNorm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esKpi=(l,v,sub,st)=>`<div class="card kpi ${st?'kpi-'+st:''}"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${sub||''}</div></div>`;
const esFiltra=l=>ES.setor==='todos'||l.setor===ES.setor||(ES.setor==='Limpeza'&&l.setor==='Estoque');
let ES={uni:null,id:null,setor:'todos',edit:false,sujo:{},quem:null};

const ES_ORIENT={lideres:[
  ['Controle de proteínas','2x ao dia','Ao abrir (antes das 9h) e ao fechar','Planilha de controle'],
  ['Controle de bebidas e sobremesas','2x ao dia','Ao abrir (antes das 9h) e ao fechar','Planilha de controle'],
  ['Planejamento de produção diária','Diário','Antes das 9h','Planilha de orientação dos colaboradores'],
  ['Pedidos e contagens de hortifruti','3x por semana','Segunda, quarta e sexta até as 10h','Planilha e sistema'],
  ['Pedidos / requerimento','1x por semana','Segunda até as 12h','Planilha e sistema'],
  ['Ajustar horários de preparo da produção de cada loja (ovos, gema curada, salada de batata…)','Diário','Pela planilha de produção e validade',''],
  ['Ajustar quantidades do dia, sem desperdício e com tudo fresco','Diário','Pela planilha de produção e validade',''],
  ['Orientar horários de abastecimento dos refrigerados e aquecidos e de ligar os equipamentos','Diário','',''],
  ['Garantir áreas abastecidas e organizadas antes da abertura, sem produção no horário de pico','Diário','',''],
  ['Manter todas as áreas organizadas e limpas','Diário','','']],
 todos:[
  ['Seguir os horários da escala e de descanso, nunca deixando a cozinha vazia','Diário'],
  ['Seguir as orientações dos líderes (quantidade e horário de preparo)','Sempre'],
  ['Ao terminar cada tarefa, deixar a área limpa e sanitizada','Sempre'],
  ['Buscar orientação sempre que houver dúvida','Sempre'],
  ['Folga para compromisso: avisar o líder por escrito com 15 dias de antecedência','Quando precisar']]};

// ---------- leitura dos horários ----------
function esMin(t){const m=String(t).replace(/^:/,'').match(/^(\d{1,2})(?::(\d{2}))?/);return m?(+m[1])*60+(+(m[2]||0)):null}
function esTurno(v){
  const s=String(v||'').trim(),u=s.toUpperCase();
  if(!s)return {t:'vazio'};
  if(/^FOLGA/.test(u))return {t:'folga'};
  if(/^F[ÉE]RIAS/.test(u))return {t:'ferias'};
  if(/ATESTADO|AFAST/.test(u))return {t:'ausente'};
  const dobra=/\(D\)/i.test(s), segs=[];
  s.replace(/\(.*?\)/g,'').split('/').forEach(p=>{const m=p.trim().match(/^:?(\d{1,2}(?::\d{2})?)\s*-\s*:?(\d{1,2}(?::\d{2})?)/);if(!m)return;let a=esMin(m[1]),b=esMin(m[2]);if(a==null||b==null)return;
    if(b<a&&b<12*60)b+=12*60; if(b<=a||b-a>12*60)return; segs.push([a,b])}); // horário digitado errado (ex.: 16-15:20) é ignorado
  if(!segs.length)return {t:'outro',txt:s};
  const ini=segs[0][0],fim=segs.at(-1)[1],min=sum(segs,g=>g[1]-g[0]),em=x=>segs.some(g=>x>=g[0]&&x<g[1]);
  const alm=em(ES_ALM),jan=em(ES_JAN);
  return {t:'trab',segs,ini,fim,min,alm,jan,dobra:dobra||(alm&&jan),cls:dobra||(alm&&jan)?'dobra':ini<11*60?'manha':ini>=14*60?'noite':'meio'};
}
const esHM=m=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const esHC=m=>{const h=Math.floor(m/60)%24,mm=m%60;return mm?`${h}:${String(mm).padStart(2,'0')}`:`${h}`};
const esHoras=m=>{const h=Math.floor(m/60),mm=Math.round(m%60);return mm?`${h}h${String(mm).padStart(2,'0')}`:`${h}h`};

// ---------- dados ----------
function esUnidades(){
  const us=LOJAS.filter(l=>P.gestor||S.minhas.includes(l.id)).map(l=>({id:l.id,nome:l.nome}));
  if(P.gestor||P.veTudo)us.push({id:'producao',nome:'Matriz · Produção'});
  return us.filter(u=>(S.db.escalas||[]).some(e=>e.unidade===u.id)||P.gestor);
}
const esPodeEditar=u=>u==='producao'?P.gestor:P.editar(u);
function esDaUnidade(u){const ord={vigente:0,planejada:1,proposta:2,arquivada:3};return (S.db.escalas||[]).filter(e=>e.unidade===u).sort((a,b)=>ord[a.tipo]-ord[b.tipo]||(b.mes||'').localeCompare(a.mes||'')||a.nome.localeCompare(b.nome))}
function esPadrao(u){const es=esDaUnidade(u),m=ymOf(isoHoje());return es.find(e=>e.tipo==='vigente'&&e.mes===m)||es.find(e=>e.tipo==='vigente')||es[0]||null}
const esLinhas=id=>(S.db.escala_linhas||[]).filter(l=>l.escala_id===id).sort((a,b)=>a.ordem-b.ordem||a.id-b.id);
const esColab=id=>id?(S.db.colaboradores||[]).find(c=>c.id===id):null;
function esCat(l){const c=esColab(l.colaborador_id),t=esNorm((l.funcao||'')+' '+(c?(c.cargo_folha||c.cargo||''):''));
  if(/lider|chefe/.test(t))return 'Líder'; if(/gerente|gerencia|coordenador|supervisor/.test(t))return 'Gerente';
  if(/atendente/.test(t))return 'Atendente'; if(/pacote/.test(t))return 'Pacote'; if(/cozinheiro/.test(t))return 'Cozinheiro';
  if(/estoqu/.test(t))return 'Estoque'; if(/auxiliar geral|limpeza/.test(t))return 'Limpeza'; if(/auxiliar/.test(t))return 'Auxiliar'; if(/expedidor/.test(t))return 'Expedição';
  return ''}
function esDomingos(mes){if(!mes)return [];const [y,m]=mes.split('-').map(Number),d=new Date(y,m-1,1),r=[];while(d.getMonth()===m-1){if(d.getDay()===0)r.push(d.getDate());d.setDate(d.getDate()+1)}return r}
function esCols(e,ls){const doms=esDomingos(e.mes),n=Math.max(doms.length||4,ls.some(l=>(l.dias||{}).dom5)?5:4);
  return ES_DIAS.filter(k=>!k.startsWith('dom')||+k.slice(3)<=n).map(k=>({k,dom:k.startsWith('dom'),l:k.startsWith('dom')?(doms[+k.slice(3)-1]?`Dom ${String(doms[+k.slice(3)-1]).padStart(2,'0')}`:`Dom ${k.slice(3)}`):ES_DL[k]}))}
const esMins=(u,setor)=>((cfg('escala_minimos')||{})[u]||{})[setor]||null;
const esFree=l=>/Freelancer|Vaga|definir/.test(l.vinculo);

// semana k = seg..sáb + domingo k (o padrão de segunda a sábado se repete toda semana)
function esSemanas(l,cols){return cols.filter(c=>c.dom).map(c=>{const ks=['seg','ter','qua','qui','sex','sab',c.k],ts=ks.map(k=>esTurno((l.dias||{})[k]));
  return {c,min:sum(ts,t=>t.t==='trab'?t.min:0),dias:ts.filter(t=>t.t==='trab').length,folgas:ts.filter(t=>['folga','ferias','ausente'].includes(t.t)).length}})}

function esDistrib(ls,cols){
  const setores=ES_SETORES.filter(s=>ls.some(l=>l.setor===s));
  const rows=[];
  setores.forEach(s=>{const so=['Limpeza','Estoque','Produção'].includes(s)?[['alm','Dia (12h30)']]:[['alm','Almoço (12h30)'],['jan','Jantar (20h)']];
    so.forEach(([p,lab])=>rows.push({s,p,lab,cel:cols.map(c=>{const q=ls.filter(l=>l.setor===s).filter(l=>{const t=esTurno((l.dias||{})[c.k]);return t.t==='trab'&&t[p]});return {c,q}})}))});
  return rows;
}

function esRegras(e,ls,cols){
  const out=[],add=(nivel,regra,det)=>out.push({nivel,regra,det});
  const dist=esDistrib(ls,cols);
  // mínimos por plantão
  dist.forEach(r=>{const mn=esMins(e.unidade,r.s);if(!mn)return;const fal=r.cel.filter(x=>{const m=x.c.dom?mn['dom_'+r.p]:mn[r.p];return m!=null&&x.q.length<m}).map(x=>`${x.c.l}: ${x.q.length} de ${x.c.dom?mn['dom_'+r.p]:mn[r.p]}`);
    const temMin=cols.some(c=>(c.dom?mn['dom_'+r.p]:mn[r.p])!=null);if(!temMin)return;
    add(fal.length?'bad':'ok',`${r.s} · ${r.lab.replace(/ \(.*/,'')}: mínimo de pessoas`,fal.length?fal.join(' · '):'Todos os dias atingem o mínimo.')});
  const domCols=cols.filter(c=>c.dom),folga=(l,k)=>['folga','ferias','ausente'].includes(esTurno((l.dias||{})[k]).t);
  const lid=ls.filter(l=>l.setor==='Cozinha'&&esCat(l)==='Líder'),sup=ls.filter(l=>l.setor==='Expedição'&&esCat(l)==='Gerente');
  if(lid.length>=2){const v=domCols.filter(c=>lid.filter(l=>folga(l,c.k)).length>=2).map(c=>`${c.l}: ${lid.filter(l=>folga(l,c.k)).map(l=>l.nome).join(' e ')}`);add(v.length?'bad':'ok','Domingo: nunca folgar dois líderes no mesmo domingo',v.length?v.join(' · '):`${lid.length} líderes conferidos.`)}
  [['Atendente','atendentes'],['Pacote','pacotes']].forEach(([cat,pl])=>{const g=ls.filter(l=>esCat(l)===cat);if(g.length<2)return;const v=domCols.filter(c=>g.filter(l=>folga(l,c.k)).length>=2).map(c=>c.l);add(v.length?'bad':'ok',`Domingo: nunca folgar dois ${pl} no mesmo domingo`,v.length?v.join(' · '):'OK.')});
  if(sup.length&&lid.length){const v=domCols.filter(c=>sup.some(l=>folga(l,c.k))&&lid.some(l=>folga(l,c.k))).map(c=>c.l);add(v.length?'bad':'ok','Domingo: nunca folgar supervisor junto com líder de cozinha',v.length?v.join(' · '):'OK.')}
  const lm=lid.filter(l=>{const ts=['seg','ter','qua','qui','sex','sab'].map(k=>esTurno((l.dias||{})[k])).filter(t=>t.t==='trab');return ts.length&&ts.filter(t=>t.ini<11*60).length>=ts.length/2});
  if(lm.length){const v=lm.filter(l=>folga(l,'seg')||folga(l,'qua')).map(l=>`${l.nome} folga ${[folga(l,'seg')?'segunda':'',folga(l,'qua')?'quarta':''].filter(Boolean).join(' e ')}`);add(v.length?'bad':'ok','Líder da manhã não folga segunda (contagem) nem quarta (requerimento)',v.length?v.join(' · '):lm.map(l=>l.nome).join(', ')+' ok.')}
  // semana sem folga e carga acima de 44h (CLT)
  const clt=ls.filter(l=>l.vinculo==='CLT');
  const semF=clt.map(l=>({l,w:esSemanas(l,cols).filter(s=>s.folgas===0&&s.dias>0)})).filter(x=>x.w.length);
  add(semF.length?'warn':'ok','Toda semana com pelo menos uma folga',semF.length?semF.map(x=>`${x.l.nome} (semana do ${x.w.map(s=>s.c.l).join(', ')})`).join(' · '):'Todos os CLT têm folga em todas as semanas.');
  const h44=clt.map(l=>({l,w:esSemanas(l,cols).filter(s=>s.min>44*60+15)})).filter(x=>x.w.length);
  add(h44.length?'warn':'ok','Carga semanal até 44h (acima disso é hora extra)',h44.length?h44.map(x=>`${x.l.nome}: até ${esHoras(Math.max(...x.w.map(s=>s.min)))}`).join(' · '):'Ninguém passa de 44h na semana.');
  // cadastro
  const dup={};ls.forEach(l=>{if(l.colaborador_id)(dup[l.colaborador_id]=dup[l.colaborador_id]||[]).push(l.nome)});
  const d=Object.values(dup).filter(v=>v.length>1);if(d.length)add('warn','Mesma pessoa em duas linhas',d.map(v=>v.join(' / ')).join(' · ')+' apontam para o mesmo cadastro do RH.');
  const semRH=clt.filter(l=>!l.colaborador_id);add(semRH.length?'warn':'ok','Pessoas da escala com cadastro no RH',semRH.length?`Sem cadastro: ${semRH.map(l=>l.nome).join(', ')}`:'Todos os CLT estão cadastrados.');
  const rh=(S.db.colaboradores||[]).filter(c=>!c.desligamento&&(c.loja_id===e.unidade||(!c.loja_id&&c.setor===e.unidade)));
  const fora=rh.filter(c=>!ls.some(l=>l.colaborador_id===c.id));
  if(rh.length)add(fora.length?'warn':'ok','Colaboradores ativos do RH presentes na escala',fora.length?`Fora da escala: ${fora.map(c=>c.nome).join(', ')}`:`Os ${rh.length} colaboradores ativos estão na escala.`);
  return out;
}

// ---------- tela ----------
function esDiaPadrao(e,cols){
  const h=isoHoje(),d=new Date(h+'T12:00'),wd=d.getDay();
  if(wd>=1&&wd<=6)return ['seg','ter','qua','qui','sex','sab'][wd-1];
  const doms=esDomingos(e.mes);if(e.mes===ymOf(h)){const i=doms.indexOf(d.getDate());if(i>=0&&cols.some(c=>c.k==='dom'+(i+1)))return 'dom'+(i+1)}
  return 'dom1';
}
const ES_DIA_LONGO={seg:'Segunda-feira',ter:'Terça-feira',qua:'Quarta-feira',qui:'Quinta-feira',sex:'Sexta-feira',sab:'Sábado'};
const esDiaNome=(c,e)=>c.dom?(()=>{const doms=esDomingos(e.mes),n=+c.k.slice(3);return doms[n-1]&&e.mes?`Domingo, ${String(doms[n-1]).padStart(2,'0')}/${e.mes.slice(5)}`:`Domingo ${n}`})():ES_DIA_LONGO[c.k];
function esEhHoje(e,c){const h=isoHoje(),d=new Date(h+'T12:00'),wd=d.getDay();if(e.mes&&e.mes!==ymOf(h))return false;
  if(!c.dom)return wd>=1&&wd<=6&&['seg','ter','qua','qui','sex','sab'][wd-1]===c.k;const doms=esDomingos(e.mes);return wd===0&&doms[+c.k.slice(3)-1]===d.getDate()}

function rhEscalas(){
  const us=esUnidades(),sel=$('#esUni');
  if(!us.length){$('#esCorpo').innerHTML='<div class="card empty">Nenhuma escala cadastrada para as suas lojas.</div>';sel.innerHTML='';$('#esEsc').innerHTML='';return}
  if(!ES.uni||!us.some(u=>u.id===ES.uni)){const r=$('#rhLoja').value;ES.uni=us.some(u=>u.id===r)?r:us[0].id;ES.id=null}
  sel.innerHTML=us.map(u=>`<option value="${u.id}" ${u.id===ES.uni?'selected':''}>${esc(u.nome)}</option>`).join('');
  const es=esDaUnidade(ES.uni);
  if(!ES.id||!es.some(e=>e.id===ES.id)){const p=esPadrao(ES.uni);ES.id=p?p.id:null;ES.edit=false;ES.sujo={};ES.dia=null}
  $('#esEsc').innerHTML=es.map(e=>`<option value="${e.id}" ${e.id===ES.id?'selected':''}>${esc(e.nome)} · ${ES_TIPO[e.tipo]}</option>`).join('')||'<option value="">Sem escala</option>';
  $$('#esSet button').forEach(b=>b.classList.toggle('on',b.dataset.s===ES.setor));
  const pe=esPodeEditar(ES.uni);
  $('#esEditar').style.display=pe&&ES.id?'':'none'; $('#esEditar').textContent=ES.edit?'Concluir edição':'Editar escala';
  $('#esNova').style.display=pe?'':'none';
  const e=es.find(x=>x.id===ES.id);
  if(!e){$('#esCorpo').innerHTML=`<div class="card empty">Esta unidade ainda não tem escala.${pe?' Use "Nova escala" para criar.':''}</div>`;return}
  const todas=esLinhas(e.id), ls=todas.filter(esFiltra), cols=esCols(e,todas);
  if(ES.edit){
    $('#esCorpo').innerHTML=`<div class="card"><h3>Editando · ${esc(e.nome)} <small>altere horários, folgas, setor, vínculo e cadastro do RH · os campos alterados ficam destacados</small>
      <span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="esAddL">Adicionar pessoa</button><button class="btn sm" id="esPropE">Nome e situação</button><button class="btn sm pri" id="esSalvar">Salvar alterações</button></span></h3>
      <p class="small muted" style="margin:-4px 0 12px">Formato do horário: entrada-pausa/volta-saída, ex.: <b>7-13/14-15:20</b>. Escreva <b>FOLGA</b> ou <b>FÉRIAS</b>; acrescente <b>(D)</b> na dobra.</p>
      ${esGradeHtml(e,ls,cols)}</div>`;
    esLigar(e,todas,cols);return}
  if(!ES.dia||!cols.some(c=>c.k===ES.dia))ES.dia=esDiaPadrao(e,cols);
  const regras=esRegras(e,todas,cols), dist=esDistrib(ls,cols), cDia=cols.find(c=>c.k===ES.dia);
  const clt=todas.filter(l=>l.vinculo==='CLT'),fr=todas.filter(l=>/Freelancer/.test(l.vinculo)),vg=todas.filter(l=>/Vaga|definir/.test(l.vinculo));
  const ruins=regras.filter(r=>r.nivel==='bad'),av=regras.filter(r=>r.nivel==='warn'),okr=regras.filter(r=>r.nivel==='ok');
  const hMed=clt.length?sum(clt,l=>{const w=esSemanas(l,cols);return w.length?sum(w,s=>s.min)/w.length:0})/clt.length:0;
  const pend=ruins.length+av.length, saude=ruins.length?'bad':av.length?'warn':'ok';
  const uniNome=(esUnidades().find(u=>u.id===e.unidade)||{}).nome||e.unidade;
  $('#esCorpo').innerHTML=`
  <div class="card es-hero">
    <div class="es-hero-l"><div class="cmg-eyebrow">Escala · ${esc(uniNome)}</div>
      <div class="es-hero-t">${esc(e.nome)} <span class="es-tipo ${e.tipo}">${ES_TIPO[e.tipo]}</span></div>
      <div class="es-hero-m"><span><b>${clt.length}</b> colaboradores</span><span><b>${fr.length}</b> freelancers</span>${vg.length?`<span class="es-warn-t"><b>${vg.length}</b> ${vg.length>1?'posições':'posição'} sem pessoa</span>`:''}<span>carga média <b>${esHoras(hMed)}</b>/semana</span></div></div>
    <button class="es-saude ${saude}" id="esIrAt"><span class="es-saude-i">${saude==='ok'?'✓':'!'}</span><span><b>${pend?`${pend} ${pend>1?'pontos':'ponto'} de atenção`:'Escala em dia'}</b><small>${pend?`${ruins.length?ruins.length+' fora da regra':''}${ruins.length&&av.length?' · ':''}${av.length?av.length+' para revisar':''}`:`${okr.length} regras conferidas`}</small></span></button>
  </div>

  <div class="card mt"><h3>Como está a semana <small>toque num dia para ver quem trabalha</small></h3>
    <div class="es-sem">${esSemanaHtml(e,cols,dist)}</div></div>

  <div class="card mt es-tl-card"><h3>${esc(esDiaNome(cDia,e))}${esEhHoje(e,cDia)?' <span class="es-hoje">hoje</span>':''} <small>quem trabalha e em que horário</small>
    <span class="es-leg2"><i class="manha"></i>manhã<i class="meio"></i>intermediário<i class="noite"></i>noite<i class="dobra"></i>dobra</span></h3>
    ${esTimelineHtml(e,ls,cDia,dist,cols)}</div>

  <div class="card mt"><h3>Escala completa <small>${esc(e.nome)}${e.mes&&mesLongo(e.mes)!==e.nome?' · '+mesLongo(e.mes):''} · entrada e saída de cada dia · clique num dia para ver a linha do tempo</small>
    <span style="margin-left:auto;display:flex;gap:8px"><button class="btn sm" id="esCsv">Exportar CSV</button><button class="btn sm" onclick="window.print()">Imprimir</button></span></h3>
    ${esGradeHtml(e,ls,cols)}</div>

  <div class="grid g2 mt">
    <div class="card" id="esAt"><h3>Pontos de atenção <small>regras da planilha conferidas automaticamente</small></h3>
      ${pend?ruins.concat(av).map(esRegraHtml).join(''):'<div class="es-tudo-ok">✓ Nenhum ponto de atenção nesta escala.</div>'}
      ${okr.length?`<details class="es-okd"><summary>${okr.length} ${okr.length>1?'regras em dia':'regra em dia'}</summary>${okr.map(esRegraHtml).join('')}</details>`:''}
      ${esMinHtml(e)}</div>
    <div class="card"><h3>Orientações da escala padrão</h3>
      <div class="es-or2">${ES_ORIENT.lideres.map(r=>`<div class="es-or-i"><b>${esc(r[0])}</b><span>${esc([r[1],r[2],r[3]].filter(Boolean).join(' · '))}</span></div>`).join('')}</div>
      <div class="small muted" style="margin:14px 0 6px">Na ausência do líder, o cozinheiro III cobre. Para todos:</div>
      <ul class="es-ul">${ES_ORIENT.todos.map(r=>`<li>${esc(r[0])}</li>`).join('')}</ul></div>
  </div>`;
  esLigar(e,todas,cols);
  $$('#esCorpo [data-dia]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();ES.dia=b.dataset.dia;rhEscalas()});
  $('#esIrAt').onclick=()=>$('#esAt').scrollIntoView({behavior:'smooth',block:'start'});
}
const esRegraHtml=r=>`<div class="es-rg ${r.nivel}"><span class="es-rg-i">${r.nivel==='ok'?'✓':r.nivel==='bad'?'✕':'!'}</span><div><b>${esc(r.regra)}</b><div class="small muted">${esc(r.det)}</div></div></div>`;

// cartões da semana: seg..sáb + um cartão de domingo com a escolha do domingo do mês
function esSemanaHtml(e,cols,dist){
  const card=(c,extra)=>{const ix=cols.indexOf(c);let baixo=false;
    const multi=[...new Set(dist.map(r=>r.s))].filter(s=>dist.filter(r=>r.s===s).length>1), apoio=[...new Set(dist.map(r=>r.s))].filter(s=>!multi.includes(s));
    const apHtml=apoio.length?`<div class="es-dl"><span title="${esc(apoio.join(', '))}">${esc(multi.length?(apoio.length>1?'Apoio':apoio[0]):apoio.join(' e '))}</span><b>${sum(dist.filter(r=>apoio.includes(r.s)),r=>r.cel[ix].q.length)}</b></div>`:'';
    const linhas=multi.map(s=>{const rs=dist.filter(r=>r.s===s);const v=rs.map(r=>{const n=r.cel[ix].q.length,mn=esMins(e.unidade,s),m=mn?(c.dom?mn['dom_'+r.p]:mn[r.p]):null;if(m!=null&&n<m)baixo=true;return {p:r.p,n,m,b:m!=null&&n<m}});
      return `<div class="es-dl"><span>${esc(s)}</span>${v.map(x=>`<b class="${x.b?'b':''}" title="${x.p==='alm'?'almoço (12h30)':'jantar (20h)'}${x.m!=null?' · mínimo '+x.m:''}">${x.p==='alm'?'☀ ':'☾ '}${x.n}</b>`).join('')}</div>`}).join('')+apHtml;
    const pessoas=new Set(dist.flatMap(r=>r.cel[ix].q.map(l=>l.id))).size;
    return `<div class="es-dc2 ${ES.dia===c.k?'on':''} ${baixo?'baixo':''}" data-dia="${c.k}">
      <div class="es-dc2-h"><span>${c.dom?'Domingo':c.l}</span>${esEhHoje(e,c)?'<em>hoje</em>':''}${baixo?'<i title="abaixo do mínimo">!</i>':''}</div>
      <div class="es-dc2-n">${pessoas}<small>pessoas</small></div>${linhas}${extra||''}</div>`};
  const sem=cols.filter(c=>!c.dom),doms=cols.filter(c=>c.dom);
  const dSel=doms.find(c=>c.k===ES.dia)||doms[0];
  return sem.map(c=>card(c)).join('')+(dSel?card(dSel,`<div class="es-doms">${doms.map(c=>`<button data-dia="${c.k}" class="${c.k===ES.dia?'on':''}">${c.l.replace('Dom ','')}</button>`).join('')}</div>`):'');
}

// linha do tempo do dia: 6h às 24h, uma barra por pessoa, faixas de almoço e jantar
function esTimelineHtml(e,ls,c,dist,cols){
  const T0=6*60,T1=24*60,X=m=>Math.max(0,Math.min(100,(m-T0)/(T1-T0)*100));
  const ix=cols.indexOf(c);
  const cob=[...new Set(dist.map(r=>r.s))].map(s=>{const mn=esMins(e.unidade,s);return `<div class="es-cob"><b>${esc(s)}</b>${dist.filter(r=>r.s===s).map(r=>{const n=r.cel[ix].q.length,m=mn?(c.dom?mn['dom_'+r.p]:mn[r.p]):null,ok=m==null||n>=m;
    return `<span class="${ok?'ok':'b'}">${/^Dia/.test(r.lab)?'no dia':r.p==='alm'?'☀ almoço':'☾ jantar'} <b>${n}</b>${m!=null?` <small>/ mín ${m}</small>`:''}</span>`}).join('')}</div>`}).join('');
  const trab=[],folga=[];
  ls.forEach(l=>{const t=esTurno((l.dias||{})[c.k]);if(t.t==='trab')trab.push({l,t});else if(t.t!=='vazio')folga.push({l,t})});
  const ticks=[6,8,10,12,14,16,18,20,22,24];
  const agora=esEhHoje(e,c)?(()=>{const d=new Date(),m=d.getHours()*60+d.getMinutes();return m>=T0&&m<=T1?m:null})():null;
  const bandas='';
  const setores=ES_SETORES.filter(s=>trab.some(x=>x.l.setor===s));
  const linha=({l,t})=>{const c_=esColab(l.colaborador_id),fun=l.funcao||(c_?(c_.cargo_folha||c_.cargo):'')||l.vinculo;
    const tip=`${l.nome} · ${t.segs.map(g=>esHM(g[0])+'–'+esHM(g[1])).join(' e ')} · ${esHoras(t.min)} trabalhadas`;
    const lab=`${esHC(t.ini)}–${esHC(t.fim)}`, gm=t.segs.reduce((a,g)=>g[1]-g[0]>a[1]-a[0]?g:a), larg=X(gm[1])-X(gm[0]);
    return `<div class="es-tr ${esFree(l)?'fr':''}"><div class="es-tn"><b>${esc(l.nome)}</b><span>${esc(fun)}</span></div>
      <div class="es-tt" title="${esc(tip)}">${bandas}
        ${t.segs.length>1?`<i class="es-pausa" style="left:${X(t.segs[0][1])}%;width:${X(t.segs[1][0])-X(t.segs[0][1])}%"></i>`:''}
        ${t.segs.map(g=>`<i class="es-tb ${t.cls}" style="left:${X(g[0])}%;width:${Math.max(.6,X(g[1])-X(g[0]))}%"></i>`).join('')}
        <span class="es-bl ${larg<9?'fora':''}" style="${larg<9?`left:calc(${X(t.fim)}% + 6px)`:`left:${X(gm[0])}%;width:${larg}%`}">${lab}${t.dobra&&/\(D\)/i.test((l.dias||{})[c.k])?' · dobra':''}</span></div></div>`};
  return `<div class="es-cobs">${cob}</div>
  <div class="es-tl"><div class="es-bands"><div class="es-band alm" style="left:${X(11*60+30)}%;width:${X(14*60+30)-X(11*60+30)}%"></div><div class="es-band jan" style="left:${X(18*60+30)}%;width:${X(22*60)-X(18*60+30)}%"></div>${agora!=null?`<div class="es-now" style="left:${X(agora)}%"><span>agora</span></div>`:''}</div>
    <div class="es-tr es-ax"><div class="es-tn"></div><div class="es-tt">${ticks.map(h=>`<span style="left:${X(h*60)}%">${h}h</span>`).join('')}<em class="alm" style="left:${(X(11*60+30)+X(14*60+30))/2}%">almoço</em><em class="jan" style="left:${(X(18*60+30)+X(22*60))/2}%">jantar</em></div></div>
    ${setores.map(s=>`<div class="es-tsg">${esc(s)} <span>${trab.filter(x=>x.l.setor===s).length} trabalhando</span></div>`+trab.filter(x=>x.l.setor===s).sort((a,b)=>a.t.ini-b.t.ini||b.t.fim-a.t.fim).map(linha).join('')).join('')||'<div class="empty">Ninguém escalado neste dia.</div>'}
  </div>
  ${folga.length?`<div class="es-folgas"><span>De folga</span>${folga.map(({l,t})=>`<em class="${t.t}">${esc(l.nome)}${t.t==='ferias'?' · férias':''}</em>`).join('')}</div>`:''}`;
}

function esDistHtml(dist,cols,e){
  if(!dist.length)return '<div class="empty">Sem pessoas neste setor.</div>';
  const mx=Math.max(1,...dist.flatMap(r=>r.cel.map(x=>x.q.length)));
  return `<div class="tbl-wrap"><table class="es-dist"><tr><th>Setor · plantão</th>${cols.map(c=>`<th class="${c.dom?'dom':''}">${c.l}</th>`).join('')}</tr>${dist.map((r,ri)=>{const mn=esMins(e.unidade,r.s);
    return `<tr><td><b>${esc(r.s)}</b> <span class="muted">· ${esc(r.lab)}</span>${mn&&mn[r.p]!=null?`<div class="small muted">mínimo ${mn[r.p]}${mn['dom_'+r.p]!=null?` · domingo ${mn['dom_'+r.p]}`:''}</div>`:''}</td>${r.cel.map((x,ci)=>{const m=mn?(x.c.dom?mn['dom_'+r.p]:mn[r.p]):null,n=x.q.length,baixo=m!=null&&n<m;
      return `<td class="es-dc ${baixo?'baixo':''} ${ES.quem===ri+'|'+ci?'sel':''}" data-q="${ri}|${ci}" style="--a:${(n/mx*.75).toFixed(2)}" title="${esc(x.q.map(l=>l.nome).join(', ')||'ninguém')}"><b>${n}</b>${baixo?`<small>mín ${m}</small>`:''}</td>`}).join('')}</tr>`}).join('')}</table></div>`;
}

function esChip(v){const t=esTurno(v);if(t.t==='vazio')return '<span class="es-ch vazio">—</span>';
  if(t.t==='trab')return `<span class="es-ch ${t.cls}" title="${esc(v)}">${esHC(t.ini)}–${esHC(t.fim)}${/\(D\)/i.test(v)?' <i>D</i>':''}</span>`;
  return `<span class="es-ch ${t.t==='folga'?'folga':t.t==='ferias'?'ferias':'outro'}" title="${esc(v)}">${t.t==='folga'?'Folga':t.t==='ferias'?'Férias':esc(String(v).slice(0,14))}</span>`}

function esGradeHtml(e,ls,cols){
  if(!ls.length)return '<div class="empty">Nenhuma pessoa neste setor.</div>';
  const turnos=[...new Set((S.db.escala_linhas||[]).filter(l=>l.escala_id===e.id).flatMap(l=>Object.values(l.dias||{})))].sort();
  const setores=ES_SETORES.filter(s=>ls.some(l=>l.setor===s));
  const ed=ES.edit;
  return `${ed?`<datalist id="esTurnos">${['FOLGA','FÉRIAS'].concat(turnos.filter(t=>!/^F(OLGA|ÉRIAS)/i.test(t))).map(t=>`<option value="${esc(t)}">`).join('')}</datalist>`:''}
  <div class="tbl-wrap es-gw"><table class="es-g ${ed?'ed':''}"><tr><th class="es-nm">Pessoa</th>${cols.map(c=>`<th class="${c.dom?'dom':''} ${!ed&&c.k===ES.dia?'sel':''}" ${ed?'':`data-dia="${c.k}"`}>${c.l}</th>`).join('')}<th class="num" title="média das semanas do mês">h/sem</th>${ed?'<th></th>':''}</tr>
  ${setores.map(s=>`<tr class="es-sg"><td colspan="${cols.length+2+(ed?1:0)}">${esc(s)} <span class="muted">· ${ls.filter(l=>l.setor===s).length}</span></td></tr>`+ls.filter(l=>l.setor===s).map(l=>{const c=esColab(l.colaborador_id),w=esSemanas(l,cols),hm=w.length?sum(w,x=>x.min)/w.length:0,mx=w.length?Math.max(...w.map(x=>x.min)):0,d=ES.sujo[l.id]||{},dias=Object.assign({},l.dias||{},d.dias||{});
    const fun=l.funcao||(c?(c.cargo_folha||c.cargo):'')||'';
    return `<tr class="${esFree(l)?'fr':''}">
      <td class="es-nm">${ed?`<input class="inp es-in" data-f="nome" data-l="${l.id}" value="${esc(d.nome??l.nome)}"><div class="es-mini"><select class="inp" data-f="setor" data-l="${l.id}">${ES_SETORES.map(o=>`<option ${(d.setor??l.setor)===o?'selected':''}>${o}</option>`).join('')}</select><select class="inp" data-f="vinculo" data-l="${l.id}">${ES_VINC.map(o=>`<option ${(d.vinculo??l.vinculo)===o?'selected':''}>${o}</option>`).join('')}</select><input class="inp" data-f="funcao" data-l="${l.id}" value="${esc(d.funcao??l.funcao??'')}" placeholder="${esc(fun||'Função')}"><select class="inp" data-f="colaborador_id" data-l="${l.id}" title="Cadastro no RH"><option value="">sem cadastro no RH</option>${esRhOpts(e.unidade,d.colaborador_id??l.colaborador_id)}</select></div>`
        :`<b>${esc(l.nome)}</b>${c?` <span class="es-rh" title="Cadastro no RH: ${esc(c.nome)}">RH</span>`:''}<div class="small muted">${esc(fun)}${l.vinculo!=='CLT'?`${fun?' · ':''}<span class="es-vn">${esc(l.vinculo)}</span>`:''}</div>`}</td>
      ${cols.map(cc=>`<td class="${cc.dom?'dom':''} ${!ed&&cc.k===ES.dia?'sel':''}">${ed?`<input class="inp es-ci" list="esTurnos" data-d="${cc.k}" data-l="${l.id}" value="${esc(dias[cc.k]||'')}">`:esChip(dias[cc.k])}</td>`).join('')}
      <td class="num ${mx>44*60+15&&l.vinculo==='CLT'?'es-h44':''}" title="${w.map(x=>`${x.c.l}: ${esHoras(x.min)}`).join(' · ')}">${hm?esHoras(hm):'—'}</td>
      ${ed?`<td><button class="btn sm" data-del="${l.id}" title="Remover da escala">×</button></td>`:''}</tr>`}).join('')).join('')}</table></div>`;
}

function esRhOpts(u,sel){return (S.db.colaboradores||[]).filter(c=>!c.desligamento&&(c.loja_id===u||(!c.loja_id&&c.setor===u))).sort((a,b)=>a.nome.localeCompare(b.nome)).map(c=>`<option value="${c.id}" ${+sel===c.id?'selected':''}>${esc(c.nome)}</option>`).join('')}
function esMinHtml(e){
  const pe=P.gestor||esPodeEditar(e.unidade);if(!pe)return '';
  const m=esMins(e.unidade,'Cozinha')||{};
  return `<details class="es-minf"><summary>Mínimo de pessoas na cozinha desta loja</summary><div class="form-row" style="grid-template-columns:repeat(4,1fr) auto;margin-top:10px">
    <label class="f">Almoço (seg–sáb)<input class="inp" type="number" min="0" id="esMa" value="${m.alm??''}"></label><label class="f">Jantar (seg–sáb)<input class="inp" type="number" min="0" id="esMj" value="${m.jan??''}"></label>
    <label class="f">Almoço domingo<input class="inp" type="number" min="0" id="esMda" value="${m.dom_alm??''}"></label><label class="f">Jantar domingo<input class="inp" type="number" min="0" id="esMdj" value="${m.dom_jan??''}"></label>
    <button class="btn pri" id="esMSave" style="align-self:end">Salvar</button></div></details>`;
}

function esLigar(e,todas,cols){
  const C=$('#esCorpo');
  C.querySelectorAll('.es-dc').forEach(td=>td.onclick=()=>{ES.quem=ES.quem===td.dataset.q?null:td.dataset.q;C.querySelectorAll('.es-dc').forEach(x=>x.classList.toggle('sel',x.dataset.q===ES.quem));esQuem(e,cols)});
  esQuem(e,cols);
  const cs=$('#esCsv');if(cs)cs.onclick=()=>csv(`escala-${e.unidade}-${e.nome.replace(/\W+/g,'-').toLowerCase()}.csv`,[['Setor','Nome','Função','Vínculo'].concat(cols.map(c=>c.l)).concat(['Horas/semana'])].concat(todas.map(l=>{const w=esSemanas(l,cols);return [l.setor,l.nome,l.funcao||'',l.vinculo].concat(cols.map(c=>(l.dias||{})[c.k]||'')).concat([w.length?esHoras(sum(w,x=>x.min)/w.length):''])})));
  const ms=$('#esMSave');if(ms)ms.onclick=async()=>{const all=JSON.parse(JSON.stringify(cfg('escala_minimos')||{})),v=id=>$(id).value===''?null:+$(id).value;
    all[e.unidade]=all[e.unidade]||{};all[e.unidade].Cozinha={alm:v('#esMa'),jan:v('#esMj'),dom_alm:v('#esMda'),dom_jan:v('#esMdj')};
    if(await dbw(sb.from('config').upsert({chave:'escala_minimos',valor:all}),'Mínimos salvos.')){await load(['config']);rhEscalas()}};
  if(!ES.edit)return;
  C.querySelectorAll('[data-l][data-f]').forEach(el=>el.onchange=el.oninput=()=>{const id=+el.dataset.l;(ES.sujo[id]=ES.sujo[id]||{})[el.dataset.f]=el.value});
  C.querySelectorAll('[data-d]').forEach(el=>{el.onchange=()=>{const id=+el.dataset.l,s=(ES.sujo[id]=ES.sujo[id]||{});s.dias=s.dias||{};s.dias[el.dataset.d]=el.value.trim();el.classList.add('mud')}});
  C.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{const l=todas.find(x=>x.id==b.dataset.del);if(!confirm(`Remover ${l.nome} desta escala?`))return;
    if(await dbw(sb.from('escala_linhas').delete().eq('id',l.id),'Removido da escala.')){delete ES.sujo[l.id];await load(['escala_linhas']);rhEscalas()}});
  $('#esAddL').onclick=()=>esNovaLinha(e,todas);
  $('#esPropE').onclick=()=>esPropriedades(e);
  $('#esSalvar').onclick=()=>esSalvar(e,todas);
}
function esQuem(e,cols){
  const box=$('#esQuem');if(!box)return;if(!ES.quem){box.innerHTML='';return}
  const [ri,ci]=ES.quem.split('|').map(Number),todas=esLinhas(e.id),ls=todas.filter(esFiltra),r=esDistrib(ls,cols)[ri];if(!r){box.innerHTML='';return}
  const x=r.cel[ci];box.innerHTML=`<b>${esc(r.s)} · ${esc(r.lab)} · ${x.c.l}</b>: ${x.q.length?x.q.map(l=>`<span class="es-pq">${esc(l.nome)} <span class="muted">${esc((l.dias||{})[x.c.k])}</span></span>`).join(''):'<span class="muted">ninguém trabalhando nesse horário</span>'}`;
}

async function esSalvar(e,todas){
  const ids=Object.keys(ES.sujo);if(!ids.length){ES.edit=false;rhEscalas();return}
  busy(true);let ok=true;
  for(const id of ids){const d=ES.sujo[id],l=todas.find(x=>x.id==id);if(!l)continue;const o={};
    ['nome','setor','vinculo'].forEach(k=>{if(d[k]!=null&&d[k]!==l[k])o[k]=d[k]}); if(d.colaborador_id!=null&&(+d.colaborador_id||null)!==(l.colaborador_id||null))o.colaborador_id=+d.colaborador_id||null; if(d.funcao!=null&&d.funcao!==(l.funcao||''))o.funcao=d.funcao||null;
    if(d.dias){const nd=Object.assign({},l.dias||{});Object.entries(d.dias).forEach(([k,v])=>{if(v)nd[k]=v;else delete nd[k]});o.dias=nd}
    if(o.nome!=null&&!o.nome.trim()){toast('O nome não pode ficar vazio.');continue}
    if(Object.keys(o).length){const {error}=await sb.from('escala_linhas').update(o).eq('id',l.id);if(error){ok=false;toast('Erro ao salvar '+l.nome+': '+error.message)}}}
  await sb.from('escalas').update({updated_at:new Date().toISOString()}).eq('id',e.id);
  busy(false);if(ok)toast('Escala salva.');ES.sujo={};ES.edit=false;await load(['escalas','escala_linhas']);rhEscalas();
}

function esNovaLinha(e,todas){
  const rh=(S.db.colaboradores||[]).filter(c=>!c.desligamento&&(c.loja_id===e.unidade||(!c.loja_id&&c.setor===e.unidade))).filter(c=>!todas.some(l=>l.colaborador_id===c.id));
  modal(`<h3>Adicionar pessoa à escala</h3><div class="form-row" style="grid-template-columns:1fr 1fr">
    <label class="f">Colaborador do RH<select class="inp" id="enC"><option value="">— não está no RH / freelancer —</option>${rh.map(c=>`<option value="${c.id}">${esc(c.nome)} · ${esc(c.cargo_folha||c.cargo||'')}</option>`).join('')}</select></label>
    <label class="f">Nome na escala<input class="inp" id="enN" placeholder="Nome"></label>
    <label class="f">Setor<select class="inp" id="enS">${ES_SETORES.map(s=>`<option ${s===(ES.setor!=='todos'?ES.setor:'Cozinha')?'selected':''}>${s}</option>`).join('')}</select></label>
    <label class="f">Vínculo<select class="inp" id="enV">${ES_VINC.map(v=>`<option>${v}</option>`).join('')}</select></label>
    <label class="f">Horário padrão (seg–sáb)<input class="inp" id="enH" list="esTurnos" placeholder="ex.: 7-13/14-15:20"></label>
    <label class="f">Folga fixa na semana<select class="inp" id="enF"><option value="">—</option>${['seg','ter','qua','qui','sex','sab'].map(k=>`<option value="${k}">${ES_DL[k]}</option>`).join('')}</select></label></div>
    <p class="small muted mt">Os domingos ficam em branco para você definir na grade.</p>
    <div class="actions mt"><button class="btn" onclick="fecharModal()">Cancelar</button><button class="btn pri" id="enOk">Adicionar</button></div>`,b=>{
    b.querySelector('#enC').onchange=ev=>{const c=rh.find(x=>x.id==ev.target.value);if(c){b.querySelector('#enN').value=c.nome.split(' ').slice(0,2).join(' ');b.querySelector('#enV').value='CLT'}};
    b.querySelector('#enOk').onclick=async()=>{const nome=b.querySelector('#enN').value.trim();if(!nome){toast('Informe o nome.');return}
      const h=b.querySelector('#enH').value.trim(),f=b.querySelector('#enF').value,dias={};if(h)['seg','ter','qua','qui','sex','sab'].forEach(k=>dias[k]=k===f?'FOLGA':h);
      const ord=Math.max(-1,...todas.map(l=>l.ordem))+1;
      if(await dbw(sb.from('escala_linhas').insert({escala_id:e.id,nome,setor:b.querySelector('#enS').value,vinculo:b.querySelector('#enV').value,colaborador_id:+b.querySelector('#enC').value||null,ordem:ord,dias}),'Pessoa adicionada.')){fecharModal();await load(['escala_linhas']);rhEscalas()}}});
}

function esPropriedades(e){
  modal(`<h3>Escala</h3><div class="form-row" style="grid-template-columns:1.4fr 1fr 1fr">
    <label class="f">Nome<input class="inp" id="epN" value="${esc(e.nome)}"></label>
    <label class="f">Mês de referência<input class="inp" type="month" id="epM" value="${e.mes||''}"></label>
    <label class="f">Situação<select class="inp" id="epT">${Object.entries(ES_TIPO).map(([k,v])=>`<option value="${k}" ${k===e.tipo?'selected':''}>${v}</option>`).join('')}</select></label></div>
    <label class="f mt">Observação<input class="inp" id="epO" value="${esc(e.obs||'')}"></label>
    <div class="actions mt">${P.excluir(e.unidade)||P.gestor?'<button class="btn" id="epDel" style="margin-right:auto">Excluir escala</button>':''}<button class="btn" onclick="fecharModal()">Cancelar</button><button class="btn pri" id="epOk">Salvar</button></div>`,b=>{
    b.querySelector('#epOk').onclick=async()=>{const n=b.querySelector('#epN').value.trim();if(!n){toast('Informe o nome.');return}
      if(await dbw(sb.from('escalas').update({nome:n,mes:b.querySelector('#epM').value||null,tipo:b.querySelector('#epT').value,obs:b.querySelector('#epO').value.trim()||null}).eq('id',e.id),'Escala atualizada.')){fecharModal();await load(['escalas']);rhEscalas()}};
    const d=b.querySelector('#epDel');if(d)d.onclick=async()=>{if(!confirm(`Excluir a escala "${e.nome}" com todas as pessoas? Não dá para desfazer.`))return;
      if(await dbw(sb.from('escalas').delete().eq('id',e.id),'Escala excluída.')){fecharModal();ES.id=null;await load(['escalas','escala_linhas']);rhEscalas()}}});
}

function esNova(){
  const u=ES.uni,es=esDaUnidade(u),atual=es.find(x=>x.id===ES.id),prox=addMes(ymOf(isoHoje()),1);
  modal(`<h3>Nova escala · ${esc(esUnidades().find(x=>x.id===u)?.nome||u)}</h3><div class="form-row" style="grid-template-columns:1.4fr 1fr 1fr">
    <label class="f">Nome<input class="inp" id="nwN" value="${esc(mesLongo(prox))}"></label>
    <label class="f">Mês de referência<input class="inp" type="month" id="nwM" value="${prox}"></label>
    <label class="f">Situação<select class="inp" id="nwT">${Object.entries(ES_TIPO).map(([k,v])=>`<option value="${k}" ${k==='planejada'?'selected':''}>${v}</option>`).join('')}</select></label></div>
    <label class="f mt">Começar a partir de<select class="inp" id="nwB"><option value="">Escala em branco</option>${es.map(x=>`<option value="${x.id}" ${atual&&x.id===atual.id?'selected':''}>Copiar "${esc(x.nome)}"</option>`).join('')}</select></label>
    <p class="small muted mt">Ao copiar, as pessoas, setores e horários vêm iguais; depois é só ajustar folgas e domingos.</p>
    <div class="actions mt"><button class="btn" onclick="fecharModal()">Cancelar</button><button class="btn pri" id="nwOk">Criar</button></div>`,b=>{
    b.querySelector('#nwOk').onclick=async()=>{const n=b.querySelector('#nwN').value.trim();if(!n){toast('Informe o nome.');return}
      const r=await dbw(sb.from('escalas').insert({unidade:u,nome:n,mes:b.querySelector('#nwM').value||null,tipo:b.querySelector('#nwT').value}).select('id').single());if(!r)return;
      const base=+b.querySelector('#nwB').value;
      if(base){const ls=esLinhas(base).map(l=>({escala_id:r.id,setor:l.setor,nome:l.nome,funcao:l.funcao,vinculo:l.vinculo,colaborador_id:l.colaborador_id,ordem:l.ordem,dias:l.dias}));if(ls.length)await dbw(sb.from('escala_linhas').insert(ls))}
      fecharModal();toast('Escala criada.');ES.id=r.id;ES.edit=!!0;await load(['escalas','escala_linhas']);rhEscalas()}});
}

function initEscalas(){
  $('#esUni').onchange=ev=>{ES.uni=ev.target.value;ES.id=null;ES.quem=null;ES.edit=false;ES.sujo={};rhEscalas()};
  $('#esEsc').onchange=ev=>{if(ES.edit&&Object.keys(ES.sujo).length&&!confirm('Descartar as alterações não salvas?')){ev.target.value=ES.id;return}ES.id=+ev.target.value;ES.quem=null;ES.edit=false;ES.sujo={};rhEscalas()};
  $$('#esSet button').forEach(b=>b.onclick=()=>{ES.setor=b.dataset.s;ES.quem=null;rhEscalas()});
  $('#esEditar').onclick=()=>{if(ES.edit&&Object.keys(ES.sujo).length&&!confirm('Sair da edição sem salvar?'))return;ES.edit=!ES.edit;ES.sujo={};rhEscalas()};
  $('#esNova').onclick=esNova;
}
