/* ================= Qualidade · Vistoria diária de operações (relatório de campo GG V6) ================= */
// pa: item que entra também no P.A. semanal da loja · data: pede a data da última execução
const CK_OPER = [
  {k:'cf',s:'Checklist Fácil com o gerente',d:'primeiro ponto da visita',i:[
    {k:'cf1',n:'Averiguação do cumprimento das tarefas no Checklist Fácil (relatório em mãos)'}]},
  {k:'a',s:'A. Equipe e postura',i:[
    {k:'a1',n:'Foco da equipe (sem celular e sem conversa paralela)'},
    {k:'a2',n:'Lideranças distribuindo tarefas, incluindo limpeza da cozinha e expedição'},
    {k:'a3',n:'Radinhos sendo utilizados: comunicação cozinha-atendimento ativa e respeitosa'},
    {k:'a4',n:'Passagem de turno feita (praça, limpeza e pendências)'},
    {k:'a5',n:'Meta de tempo de preparo (15 min) passada à equipe no briefing',pa:1},
    {k:'a6',n:'Meta de tempo de entrega (30 min) repassada no briefing de atendimento',pa:1},
    {k:'a7',n:'Escala na parede coerente com a equipe atual'},
    {k:'a8',n:'Equipe suficiente para a demanda atual'}]},
  {k:'b',s:'B. Limpeza da cozinha',i:[
    {k:'b1',n:'Piso limpo e seco, sem acúmulo de sujeira'},
    {k:'b2',n:'Bancadas e praças limpas e abastecidas'},
    {k:'b3',n:'Lixo recolhido e lixeiras limpas'},
    {k:'b4',n:'Limpeza da caixa de gordura em dia',data:'última limpeza'}]},
  {k:'c',s:'C. Equipamentos',i:[
    {k:'c1',n:'Fritadeiras limpas'},
    {k:'c2',n:'Geladeira dos descongelados limpa e organizada conforme o mapa'},
    {k:'c3',n:'Geladeiras limpas por dentro e por fora'},
    {k:'c4',n:'Temperatura das geladeiras aferida e registrada'},
    {k:'c5',n:'Freezer trancado após a retirada das proteínas',pa:1},
    {k:'c6',n:'Equipamento com defeito registrado para manutenção'}]},
  {k:'d',s:'D. Praças, utensílios e porcionamento',i:[
    {k:'d1',n:'Utensílios completos em todas as praças (se faltar, pedir compra)',pa:1},
    {k:'d2',n:'Medidores, conchas e balança em uso',pa:1},
    {k:'d3',n:'Karaage porcionado: 170 g congelado, 9 a 10 bolinhas por porção, 4 bolinhas para o bao'},
    {k:'d4',n:'Porcionamento de arroz para wok'},
    {k:'d5',n:'Etiquetas da praça conferidas e dentro da validade'},
    {k:'d6',n:'Itens e insumos armazenados de forma correta, seguindo o mapeamento'},
    {k:'d7',n:'Etiquetas de insumos aplicadas nas pistas quentes e frias'},
    {k:'d8',n:'Embalagens prontas para uso: entradas, baos e bowls com tampas feitas e posicionadas'}]},
  {k:'e',s:'E. Controles e planilhas',i:[
    {k:'e1',n:'Caderno/planilha de proteína atualizada, com divergências justificadas',pa:1},
    {k:'e2',n:'Descongelamento compatível com as métricas de consumo da unidade'},
    {k:'e3',n:'Linhas do descongelamento averiguadas pelo gestor da loja (quebra de estoque: a matemática faz sentido?)'},
    {k:'e4',n:'Descongelamento feito da maneira correta (refrigerado)'},
    {k:'e5',n:'Planilha de bebidas e sobremesas atualizada, com divergências justificadas'},
    {k:'e6',n:'Cadernos de produção preenchidos'},
    {k:'e7',n:'Desperdício anotado na lista pela equipe com unidade de medida (prato completo, porção, unidade, kg) e justificativa',h:'Ajuda o gerente no lançamento do Everloja',pa:1},
    {k:'e8',n:'Desperdício lançado pelo gerente no Everloja diariamente',pa:1},
    {k:'e9',n:'Planilha de limpeza da nutricionista preenchida'}]},
  {k:'f',s:'F. Atendimento e expedição',i:[
    {k:'f1',n:'Comunicação por radinhos ativa'},
    {k:'f2',n:'Ritmo do serviço: pedidos saindo no tempo'},
    {k:'f3',n:'Botão de pronto apertado na hora certa'},
    {k:'f4',n:'Resposta ao cliente no chat (meta 100%)',pa:1},
    {k:'f5',n:'Pacote conferido antes de fechar',h:'Nas unidades grandes, confirmação em 2 pontos onde a escala exige (3 na expedição)'},
    {k:'f6',n:'Cookies do dia'},
    {k:'f7',n:'Molhos de gyoza, maionese, molho missô e gemas porcionados e do dia'},
    {k:'f8',n:'Relatório de ocorrências do dia anterior conferido e repassado ao gerente pelo coordenador de atendimento/gerente',pa:1},
    {k:'f9',n:'Plano de ação das ocorrências do dia anterior executado'}]},
  {k:'g',s:'G. Salão e banheiros',i:[
    {k:'g1',n:'Mesas do salão sem lixo'},
    {k:'g2',n:'Banheiro de clientes limpo e com papel'},
    {k:'g3',n:'Banheiro e vestiário da equipe limpos'}]},
  {k:'h',s:'H. Estrutura e manutenção',i:[
    {k:'h1',n:'Pintura e estrutura em bom estado'},
    {k:'h2',n:'Sem vazamentos, infiltrações ou ralos entupidos'},
    {k:'h3',n:'Dedetização em dia, sem sinais de pragas'},
    {k:'h4',n:'Documentos da unidade em dia'}]},
];
const VO_ITEM={}; CK_OPER.forEach(s=>s.i.forEach(it=>VO_ITEM[it.k]=Object.assign({sec:s.s},it)));
const VO_TURNOS=['Manhã','Tarde','Noite','Fechamento'];
let VO={r:{},ac:{},extra:[],ret:{},fg:[]};

function voScores(){
  const per=CK_OPER.map(sec=>{let s=0,n=0,na=0;sec.i.forEach(it=>{const v=(VO.r[it.k]||{}).v;if(v==='sim')s++;if(v==='nao')n++;if(v==='na')na++});return {s,n,na,tot:sec.i.length}});
  const S_=sum(per,p=>p.s),N=sum(per,p=>p.n);
  return {per,S:S_,N,NA:sum(per,p=>p.na),tot:sum(per,p=>p.tot),score:S_+N?S_/(S_+N)*100:null};
}
async function voFoto(file){
  const loja=$('#voLoja').value; if(!loja){toast('Selecione a loja antes das fotos.');return null}
  const blob=await comprimir(file); if(blob.size>5*1024*1024){toast('Foto acima de 5 MB.');return null}
  const path=`${loja}/${ymOf($('#voData').value||isoHoje())}/vistoria-${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
  const {error}=await sb.storage.from('checklist-fotos').upload(path,blob,{contentType:'image/jpeg',upsert:false});
  if(error){toast(/row-level|security|403/i.test(error.message)?'Sem permissão para enviar fotos desta loja.':'Falha ao enviar foto: '+error.message);return null}
  return path;
}
const voFotosHtml=(fs,key)=>fs.map((p,i)=>`<span class="ft"><img data-src="${esc(p)}" alt=""><button title="Remover" data-vfr="${key}|${i}">×</button></span>`).join('');

function buildOper(){
  $('#voTurno').innerHTML=VO_TURNOS.map(t=>`<button data-v="${t}" class="${VO.turno===t?'on':''}">${t}</button>`).join('');
  $('#voSecs').innerHTML=CK_OPER.map((sec,si)=>`<div class="sec" data-s="${sec.k}"><div class="sec-h"><b>${si===0?'1. ':''}${esc(sec.s)}${sec.d?` <span class="small muted" style="font-weight:500">· ${esc(sec.d)}</span>`:''}</b><span class="sc" id="vosc_${sec.k}"></span></div><div class="sec-b">${
    sec.i.map(it=>`<div class="item vo-item" id="voi_${it.k}"><span>${esc(it.n)}${it.pa?' <span class="tag vo-pa" title="Entra também no P.A. semanal da loja">P.A. semanal</span>':''}${it.h?`<div class="small muted">${esc(it.h)}</div>`:''}</span>
      <div class="qctl">${it.data?`<label class="vo-dt"><span class="small muted">${esc(it.data)}</span><input class="inp" type="date" data-vd="${it.k}"></label>`:''}<button class="btn sm" data-vob="${it.k}" title="Anotar observação">Obs.</button><label class="btn sm fbtn" title="Adicionar foto">${IC_CAM}<input type="file" accept="image/*" capture="environment" multiple hidden data-vfu="${it.k}"></label><div class="seg" data-vk="${it.k}"><button data-v="sim">Conforme</button><button data-v="nao">Ajustar</button><button data-v="na">N/A</button></div></div>
      <input class="inp obs" placeholder="O que foi visto" data-vo="${it.k}"><div class="fotos"></div></div>`).join('')}</div></div>`).join('');
  const box=$('#voSecs');
  box.querySelectorAll('.sec-h').forEach(h=>h.onclick=()=>h.parentElement.classList.toggle('closed'));
  box.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{const k=b.parentElement.dataset.vk;VO.r[k]=VO.r[k]||{};VO.r[k].v=VO.r[k].v===b.dataset.v?null:b.dataset.v;paintOper()});
  box.querySelectorAll('[data-vob]').forEach(b=>b.onclick=()=>{const it=$('#voi_'+b.dataset.vob);it.classList.toggle('showobs');if(it.classList.contains('showobs'))it.querySelector('.obs').focus()});
  box.querySelectorAll('[data-vo]').forEach(i=>{const k=i.dataset.vo;i.value=(VO.r[k]||{}).o||'';if(i.value)i.closest('.item').classList.add('showobs');i.oninput=()=>{VO.r[k]=VO.r[k]||{};VO.r[k].o=i.value;paintPlanoOper()}});
  box.querySelectorAll('[data-vd]').forEach(i=>{const k=i.dataset.vd;i.value=(VO.r[k]||{}).d||'';i.onchange=()=>{VO.r[k]=VO.r[k]||{};VO.r[k].d=i.value}});
  box.querySelectorAll('[data-vfu]').forEach(inp=>inp.onchange=async()=>{const k=inp.dataset.vfu,fs=[...inp.files];inp.value='';if(!fs.length)return;busy(true);
    for(const f of fs){const p=await voFoto(f);if(p){VO.r[k]=VO.r[k]||{};(VO.r[k].f=VO.r[k].f||[]).push(p)}}busy(false);paintOper();toast(fs.length>1?'Fotos adicionadas.':'Foto adicionada.')});
  $('#voBom').value=VO.bom||''; $('#voAj').value=VO.aj||''; $('#voCiente').checked=!!VO.ciente;
  paintOper(); renderRetornoOper();
}

function paintOper(){
  CK_OPER.forEach(sec=>sec.i.forEach(it=>{const q=VO.r[it.k]||{},el=$('#voi_'+it.k);if(!el)return;
    el.querySelectorAll('.seg button').forEach(b=>b.classList.toggle('on',b.dataset.v===q.v));el.classList.toggle('no',q.v==='nao');
    const fb=el.querySelector('.fotos');fb.innerHTML=voFotosHtml(q.f||[],it.k);
    fb.querySelectorAll('[data-vfr]').forEach(b=>b.onclick=()=>{const [kk,i]=b.dataset.vfr.split('|');const p=VO.r[kk].f.splice(+i,1)[0];sb.storage.from('checklist-fotos').remove([p]).then(()=>{});paintOper()});
    fb.querySelectorAll('.ft img').forEach(im=>im.onclick=()=>galeria(it.n,q.f||[]))}));
  pintarFotos($('#voSecs'));
  const sc=voScores();
  $('#voRing').innerHTML=ring(sc.score,'conformidade');
  $('#voBars').innerHTML=CK_OPER.map((sec,i)=>{const p=sc.per[i],pct=p.s+p.n?p.s/(p.s+p.n)*100:null;return `<div class="r"><span>${esc(sec.k==='cf'?'Checklist Fácil':sec.s.replace(/^[A-H]\. /,''))}</span><div class="tr"><i style="width:${pct||0}%;background:${scCol(pct)}"></i></div><span style="text-align:right">${pct==null?'—':nf0.format(pct)+'%'}</span></div>`}).join('');
  CK_OPER.forEach((sec,i)=>{const p=sc.per[i],el=$('#vosc_'+sec.k);if(el)el.innerHTML=`<span>${p.s+p.n+p.na}/${p.tot} avaliados</span>${p.n?`<span class="sem s-bad" style="min-width:0">${p.n} ajustar</span>`:''}`});
  $('#voCont').innerHTML=`<span><b>${sc.S}</b> conforme</span><span class="${sc.N?'gg-neg':''}"><b>${sc.N}</b> ajustar</span><span><b>${sc.NA}</b> N/A</span><span class="muted">${sc.S+sc.N+sc.NA} de ${sc.tot} itens avaliados</span>`;
  $('#voFg').innerHTML=voFotosHtml(VO.fg,'_g');
  $('#voFg').querySelectorAll('[data-vfr]').forEach(b=>b.onclick=()=>{const i=+b.dataset.vfr.split('|')[1];const p=VO.fg.splice(i,1)[0];sb.storage.from('checklist-fotos').remove([p]).then(()=>{});paintOper()});
  $('#voFg').querySelectorAll('.ft img').forEach(im=>im.onclick=()=>galeria('Fotos da vistoria',VO.fg));
  pintarFotos($('#voFg'));
  paintPlanoOper();
}

// plano de ação: um item por "Ajustar" + ações livres
function paintPlanoOper(){
  const nos=[];CK_OPER.forEach(sec=>sec.i.forEach(it=>{if((VO.r[it.k]||{}).v==='nao')nos.push(it)}));
  const pri0=it=>it.pa?'Alta':'Média';
  const row=(key,prob,sub,a,pa)=>`<tr><td style="white-space:normal;min-width:220px"><b>${esc(prob)}</b>${pa?' <span class="tag vo-pa">P.A. semanal</span>':''}${sub?`<div class="small muted">${esc(sub)}</div>`:''}</td>
    <td style="min-width:220px"><input class="inp" data-va="${key}" data-f="acao" value="${esc(a.acao)}" placeholder="O que será feito"></td>
    <td style="min-width:140px"><input class="inp" data-va="${key}" data-f="resp" value="${esc(a.resp)}" placeholder="Quem"></td>
    <td><input class="inp" type="date" data-va="${key}" data-f="prazo" value="${esc(a.prazo)}"></td>
    <td><select class="inp" style="min-width:104px" data-va="${key}" data-f="pri">${['Alta','Média','Baixa'].map(o=>`<option ${(a.pri||pri0({pa}))===o?'selected':''}>${o}</option>`).join('')}</select></td>
    <td><select class="inp" style="min-width:118px" data-va="${key}" data-f="st">${['Pendente','Feito'].map(o=>`<option ${(a.st||'Pendente')===o?'selected':''}>${o}</option>`).join('')}</select></td>
    <td>${key.startsWith('x')?`<button class="btn sm" data-vxd="${key.slice(1)}">×</button>`:''}</td></tr>`;
  const linhas=nos.map(it=>row(it.k,it.n,VO_ITEM[it.k].sec+((VO.r[it.k]||{}).o?' · '+VO.r[it.k].o:''),VO.ac[it.k]||{},it.pa))
    .concat(VO.extra.map((x,i)=>`<tr><td style="min-width:220px"><input class="inp" data-vx="${i}" value="${esc(x.problema)}" placeholder="Problema ou ponto observado"></td>${row('x'+i,'','',x,false).replace(/^<tr><td[\s\S]*?<\/td>/,'')}`));
  $('#voPlano').innerHTML=linhas.length?`<div class="tbl-wrap"><table><tr><th>Ponto a ajustar</th><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Prioridade</th><th>Status</th><th></th></tr>${linhas.join('')}</table></div>`
    :'<div class="empty">Nenhum item marcado como "Ajustar". Os itens marcados aparecem aqui para virar ação; use "Adicionar ação" para incluir outras.</div>';
  $('#voPlano').querySelectorAll('[data-va]').forEach(el=>el.oninput=el.onchange=()=>{const k=el.dataset.va;if(k.startsWith('x')){VO.extra[+k.slice(1)][el.dataset.f]=el.value}else{VO.ac[k]=VO.ac[k]||{};VO.ac[k][el.dataset.f]=el.value}});
  $('#voPlano').querySelectorAll('[data-vx]').forEach(el=>el.oninput=()=>{VO.extra[+el.dataset.vx].problema=el.value});
  $('#voPlano').querySelectorAll('[data-vxd]').forEach(b=>b.onclick=()=>{VO.extra.splice(+b.dataset.vxd,1);paintPlanoOper()});
}

// retorno da vistoria anterior: ações geradas na última vistoria da mesma loja
function voAnterior(){
  const loja=$('#voLoja').value,data=$('#voData').value||isoHoje();
  return (S.db.vistorias_operacao||[]).filter(v=>v.loja_id===loja&&v.data<=data&&v.id!==VO.idCarregado).sort((a,b)=>b.data.localeCompare(a.data)||b.id-a.id)[0]||null;
}
function renderRetornoOper(){
  const ant=voAnterior(), el=$('#voRet');
  if(!ant){el.innerHTML='<div class="empty">Primeira vistoria desta loja: sem pendências anteriores.</div>';$('#voRetSub').textContent='';return}
  const pa=(S.db.planos_acao||[]).filter(a=>a.origem==='vistoria'&&a.origem_id===ant.id);
  $('#voRetSub').textContent=`vistoria de ${fmtD(ant.data)}${ant.responsavel?' · '+ant.responsavel:''}`;
  if(!pa.length){el.innerHTML='<div class="empty">A vistoria anterior não deixou pendências.</div>';return}
  el.innerHTML=`<div class="tbl-wrap"><table><tr><th>Pendência da última vistoria</th><th>Status no plano</th><th>Resolvido?</th><th>Observação</th></tr>${pa.map(a=>{const r=VO.ret[a.id]||{},def=a.status==='Concluído'?'sim':null,v=r.r||def;
    return `<tr><td style="white-space:normal;min-width:240px"><b>${esc(a.problema)}</b>${a.acao?`<div class="small muted">Ação: ${esc(a.acao)}${a.responsavel?' · '+esc(a.responsavel):''}${a.prazo?' · prazo '+fmtD(a.prazo):''}</div>`:''}</td>
      <td><span class="sem s-${a.status==='Concluído'?'ok':atrasado(a)?'bad':'warn'}" style="min-width:0">${atrasado(a)?'Atrasada':esc(a.status)}</span></td>
      <td><div class="seg" data-vr="${a.id}"><button data-v="sim" class="${v==='sim'?'on':''}">Sim</button><button data-v="nao" class="${v==='nao'?'on':''}">Não</button></div></td>
      <td style="min-width:180px"><input class="inp" data-vro="${a.id}" value="${esc(r.o)}" placeholder="O que foi visto"></td></tr>`}).join('')}</table></div>
    <p class="small muted" style="margin-top:8px">Ao salvar, o que for marcado "Sim" é concluído em Planos de ação; o "Não" continua aberto e recebe a observação.</p>`;
  el.querySelectorAll('[data-vr] button').forEach(b=>b.onclick=()=>{const id=+b.parentElement.dataset.vr;VO.ret[id]=VO.ret[id]||{};VO.ret[id].r=b.dataset.v;renderRetornoOper()});
  el.querySelectorAll('[data-vro]').forEach(i=>i.oninput=()=>{const id=+i.dataset.vro;VO.ret[id]=VO.ret[id]||{};VO.ret[id].o=i.value});
}

async function saveOper(){
  const loja=$('#voLoja').value,data=$('#voData').value; if(!loja||!data){toast('Informe a loja e a data da vistoria.');return}
  const sc=voScores(); if(sc.S+sc.N===0){toast('Avalie pelo menos um item antes de salvar.');return}
  if(!$('#voResp').value.trim()){toast('Informe o responsável pela vistoria.');$('#voResp').focus();return}
  const ant=voAnterior(), paAnt=ant?(S.db.planos_acao||[]).filter(a=>a.origem==='vistoria'&&a.origem_id===ant.id):[];
  const retorno=paAnt.map(a=>{const r=VO.ret[a.id]||{};return {plano_id:a.id,problema:a.problema,resolvido:r.r||(a.status==='Concluído'?'sim':null),obs:r.o||null}});
  const row={loja_id:loja,data,hora:$('#voHora').value||null,turno:VO.turno||null,responsavel:$('#voResp').value.trim(),lider:$('#voLider').value.trim()||null,
    pessoas_cozinha:$('#voPc').value===''?null:+$('#voPc').value,pessoas_expedicao:$('#voPe').value===''?null:+$('#voPe').value,
    respostas:Object.assign(JSON.parse(JSON.stringify(VO.r)),VO.fg.length?{_gerais:{f:VO.fg.slice()}}:{}),secoes:sc.per.map(p=>p.s+p.n?Math.round(p.s/(p.s+p.n)*1000)/10:null),
    conforme:sc.S,ajustar:sc.N,score:sc.score==null?null:Math.round(sc.score*10)/10,leitura_bom:$('#voBom').value.trim()||null,leitura_ajustar:$('#voAj').value.trim()||null,
    retorno:retorno.length?retorno:null,lider_ciente:$('#voCiente').checked};
  const r=await dbw(sb.from('vistorias_operacao').insert(row).select('id').single()); if(!r)return;
  {const RS={sim:'Conforme',nao:'Ajustar',na:'N/A'},lin=[],dst=[];
    CK_OPER.forEach(sec=>sec.i.forEach(it=>{const q=VO.r[it.k]||{};lin.push([data,row.hora||'',lojaNome(loja),row.turno||'',row.responsavel,row.lider||'',row.score,sec.s,it.n,RS[q.v]||'',q.o||'',(q.f||[]).length||'']);if(q.v==='nao')dst.push(`${it.n}${q.o?' · '+q.o:''}`)}));
    VO.extra.filter(x=>(x.problema||'').trim()).forEach(x=>{lin.push([data,row.hora||'',lojaNome(loja),row.turno||'',row.responsavel,row.lider||'',row.score,'Outros pontos',x.problema.trim(),'Ajustar',x.acao||'','']);dst.push(x.problema.trim())});
    retorno.forEach(x=>lin.push([data,row.hora||'',lojaNome(loja),row.turno||'',row.responsavel,row.lider||'',row.score,'Retorno da vistoria anterior',x.problema,x.resolvido==='sim'?'Resolvido':x.resolvido==='nao'?'Não resolvido':'',x.obs||'','']));
    filaDrive({tipo:'vistoria_operacao',loja_id:loja,ref:`vo|${r.id}`,mes:ymOf(data),aba:'Vistoria de operações',titulo:`Vistoria de operações · ${lojaNome(loja)} · ${fmtD(data)}${row.score!=null?' · nota '+nf1.format(row.score):''}`,
      colunas:['Data','Hora','Loja','Turno','Responsável','Líder','Nota','Seção','Item','Resposta','Observação','Fotos'],linhas:lin,tabela:false,
      resumo:{'Nota':row.score==null?'—':nf1.format(row.score),'Conforme':sc.S,'Ajustar':sc.N,'Pessoas cozinha':row.pessoas_cozinha??'—','Pessoas expedição':row.pessoas_expedicao??'—'},
      destaques:dst.concat(row.leitura_ajustar?[`Leitura do que ajustar: ${row.leitura_ajustar}`]:[])});}
  const ST={Pendente:'Pendente',Feito:'Concluído'};
  const acoes=[];CK_OPER.forEach(sec=>sec.i.forEach(it=>{const q=VO.r[it.k]||{};if(q.v!=='nao')return;const a=VO.ac[it.k]||{};
    acoes.push({loja_id:loja,origem:'vistoria',origem_id:r.id,problema:it.n,secao:sec.s,acao:a.acao||null,responsavel:a.resp||null,prazo:a.prazo||null,prioridade:a.pri||(it.pa?'Alta':'Média'),status:ST[a.st]||'Pendente',pa_semanal:!!it.pa,
      obs:[q.o,(q.f||[]).length?`${q.f.length} foto(s) na vistoria`:''].filter(Boolean).join(' · ')||null})}));
  VO.extra.filter(x=>(x.problema||'').trim()).forEach(x=>acoes.push({loja_id:loja,origem:'vistoria',origem_id:r.id,problema:x.problema.trim(),secao:'Vistoria de operações',acao:x.acao||null,responsavel:x.resp||null,prazo:x.prazo||null,prioridade:x.pri||'Média',status:ST[x.st]||'Pendente',pa_semanal:false,obs:null}));
  let ok=true; if(acoes.length&&!await dbw(sb.from('planos_acao').insert(acoes))) ok=false;
  for(const x of retorno){const a=paAnt.find(p=>p.id===x.plano_id);if(!a)continue;
    if(x.resolvido==='sim'&&a.status!=='Concluído') await sb.from('planos_acao').update({status:'Concluído',concluido_em:data,evidencia:a.evidencia||`Conferido na vistoria de ${fmtD(data)}`}).eq('id',a.id);
    else if(x.resolvido==='nao'&&x.obs) await sb.from('planos_acao').update({obs:[a.obs,`Vistoria ${fmtD(data)}: ${x.obs}`].filter(Boolean).join(' · ')}).eq('id',a.id)}
  toast(ok?`Vistoria salva${acoes.length?` e ${acoes.length} ação(ões) criada(s) em Planos de ação`:''}.`:'Vistoria salva, mas o plano de ação não foi gerado.');
  limparOper(true); await load(['vistorias_operacao','planos_acao']); buildOper(); renderOperHist();
}
function limparOper(manterCab){
  VO={r:{},ac:{},extra:[],ret:{},fg:[],turno:manterCab?VO.turno:null};
  if(!manterCab){$('#voHora').value='';$('#voLider').value='';$('#voPc').value='';$('#voPe').value=''}
}

function renderOperHist(){
  const h=(S.db.vistorias_operacao||[]).slice().sort((a,b)=>b.data.localeCompare(a.data)||(b.hora||'').localeCompare(a.hora||'')||b.id-a.id);
  const pa=S.db.planos_acao||[], mq=metaQual(null);
  // última vistoria de cada loja
  const ult=LOJAS.filter(l=>l.status!=='fechada').map(l=>({l,v:h.find(x=>x.loja_id===l.id)}));
  $('#voUlt').innerHTML=ult.map(({l,v})=>{const dias=v?Math.round((new Date(isoHoje()+'T12:00')-new Date(v.data+'T12:00'))/864e5):null;
    return `<div class="vo-ult"><span class="cmg-dot" style="--cor:${PAL[LOJAS.findIndex(x=>x.id===l.id)%PAL.length]}"></span><div><b>${esc(l.nome)}</b><div class="small muted">${v?`${dias===0?'hoje':dias===1?'ontem':`há ${dias} dias`}${v.turno?' · '+esc(v.turno):''}`:'sem vistoria'}</div></div>${v&&v.score!=null?`<span class="sem s-${v.score>=mq?'ok':v.score>=mq-15?'warn':'bad'}" style="min-width:0;margin-left:auto">${nf0.format(v.score)}%</span>`:''}</div>`}).join('');
  $('#voHist').innerHTML=h.length?`<div class="tbl-wrap" style="max-height:480px;overflow:auto"><table><tr><th>Data</th><th>Loja</th><th>Turno</th><th>Responsável</th><th>Líder</th><th class="num">Conformidade</th><th class="num">Ajustar</th><th class="num">Ações abertas</th><th class="num">Fotos</th><th></th></tr>${h.map(v=>{const fs=Object.values(v.respostas||{}).flatMap(q=>q&&q.f||[]);
    return `<tr><td>${fmtD(v.data)}${v.hora?`<div class="small muted">${v.hora.slice(0,5)}</div>`:''}</td><td><b>${esc(lojaNome(v.loja_id))}</b></td><td>${esc(v.turno)||'—'}</td><td>${esc(v.responsavel)||'—'}</td><td>${esc(v.lider)||'—'}${v.lider_ciente?' <span class="small muted">· ciente</span>':''}</td>
      <td class="num">${v.score!=null?`<span class="sem s-${v.score>=mq?'ok':v.score>=mq-15?'warn':'bad'}">${nf0.format(v.score)}%</span>`:'—'}</td><td class="num">${v.ajustar}</td>
      <td class="num">${pa.filter(a=>a.origem==='vistoria'&&a.origem_id===v.id&&!['Concluído','Cancelado'].includes(a.status)).length}</td>
      <td class="num">${fs.length?`<button class="btn sm" data-vfg="${v.id}">${fs.length} ${IC_CAM}</button>`:'—'}</td>
      <td class="num" style="white-space:nowrap"><button class="btn sm" data-vld="${v.id}">Abrir</button> ${P.excluir(v.loja_id)?`<button class="btn sm" data-vdel="${v.id}">Excluir</button>`:''}</td></tr>`}).join('')}</table></div>`
    :'<div class="empty">Nenhuma vistoria salva ainda.</div>';
  $('#voHist').querySelectorAll('[data-vdel]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta vistoria do histórico? As ações geradas por ela continuam em Planos de ação.'))return;if(await dbw(sb.from('vistorias_operacao').delete().eq('id',b.dataset.vdel),'Vistoria excluída.')){await load(['vistorias_operacao']);renderOperHist();renderRetornoOper()}});
  $('#voHist').querySelectorAll('[data-vfg]').forEach(b=>b.onclick=()=>{const v=h.find(x=>x.id==b.dataset.vfg);galeria(`Fotos · ${lojaNome(v.loja_id)} · ${fmtD(v.data)}`,Object.values(v.respostas||{}).flatMap(q=>q&&q.f||[]))});
  $('#voHist').querySelectorAll('[data-vld]').forEach(b=>b.onclick=()=>{const v=h.find(x=>x.id==b.dataset.vld);const resp=JSON.parse(JSON.stringify(v.respostas||{}));const fg=(resp._gerais||{}).f||[];delete resp._gerais;
    VO={r:resp,ac:{},extra:[],ret:{},fg,turno:v.turno,bom:v.leitura_bom,aj:v.leitura_ajustar,ciente:v.lider_ciente,idCarregado:v.id};
    if([...$('#voLoja').options].some(o=>o.value===v.loja_id))$('#voLoja').value=v.loja_id;
    $('#voData').value=v.data;$('#voHora').value=(v.hora||'').slice(0,5);$('#voResp').value=v.responsavel||'';$('#voLider').value=v.lider||'';$('#voPc').value=v.pessoas_cozinha??'';$('#voPe').value=v.pessoas_expedicao??'';
    buildOper();$('#qs-oper').scrollIntoView({behavior:'smooth'});toast('Vistoria carregada para consulta. Ao salvar, ela entra como um novo registro.')});
}

function initOper(){
  $('#voFgIc').innerHTML=IC_CAM;
  $('#voLoja').innerHTML=optLojas(lojasEditaveis()); $('#voData').value=isoHoje();
  $('#voLoja').onchange=()=>{VO.ret={};renderRetornoOper()}; $('#voData').onchange=()=>{VO.ret={};renderRetornoOper()};
  $('#voTurno').onclick=e=>{const b=e.target.closest('button');if(!b)return;VO.turno=VO.turno===b.dataset.v?null:b.dataset.v;$$('#voTurno button').forEach(x=>x.classList.toggle('on',x.dataset.v===VO.turno))};
  $('#voBom').oninput=e=>VO.bom=e.target.value; $('#voAj').oninput=e=>VO.aj=e.target.value; $('#voCiente').onchange=e=>VO.ciente=e.target.checked;
  $('#voAddAc').onclick=()=>{VO.extra.push({problema:'',st:'Pendente',pri:'Média'});paintPlanoOper();const ins=$$('#voPlano [data-vx]');if(ins.length)ins[ins.length-1].focus()};
  $('#voPreencher').onclick=()=>{const aj=[];CK_OPER.forEach(sec=>sec.i.forEach(it=>{const q=VO.r[it.k]||{};if(q.v==='nao')aj.push('• '+it.n+(q.o?': '+q.o:''))}));
    if(!aj.length){toast('Nenhum item marcado como "Ajustar".');return}$('#voAj').value=(($('#voAj').value.trim()?$('#voAj').value.trim()+'\n':'')+aj.join('\n'));VO.aj=$('#voAj').value};
  $('#voFgIn').onchange=async e=>{const fs=[...e.target.files];e.target.value='';if(!fs.length)return;busy(true);for(const f of fs){const p=await voFoto(f);if(p)VO.fg.push(p)}busy(false);paintOper()};
  $('#voSave').onclick=saveOper; $('#voClear').onclick=()=>{if(!confirm('Limpar a vistoria em andamento?'))return;limparOper(false);buildOper()};
  $('#voOpenAll').onclick=()=>{const secs=$$('#voSecs .sec');const anyOpen=secs.some(s=>!s.classList.contains('closed'));secs.forEach(s=>s.classList.toggle('closed',anyOpen))};
  $('#voCsv').onclick=()=>{const pa=S.db.planos_acao||[];const rows=[['Data','Hora','Turno','Loja','Responsável','Líder','Conformidade %','Conforme','Ajustar','Item','Seção','Resultado','Observação','Ação','Responsável da ação','Prazo','Status','P.A. semanal']];
    (S.db.vistorias_operacao||[]).forEach(v=>{const R=v.respostas||{};CK_OPER.forEach(sec=>sec.i.forEach(it=>{const q=R[it.k];if(!q||!q.v)return;const a=pa.find(x=>x.origem==='vistoria'&&x.origem_id===v.id&&x.problema===it.n)||{};
      rows.push([v.data,(v.hora||'').slice(0,5),v.turno||'',lojaNome(v.loja_id),v.responsavel||'',v.lider||'',v.score??'',v.conforme,v.ajustar,it.n,sec.s,{sim:'Conforme',nao:'Ajustar',na:'N/A'}[q.v],q.o||'',a.acao||'',a.responsavel||'',a.prazo||'',a.status||'',it.pa?'Sim':''])}))});
    csv('vistorias-operacao-fat-buddha.csv',rows)};
  buildOper(); renderOperHist();
}
