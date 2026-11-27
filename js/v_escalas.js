/* ================= RH · Escalas de colaboradores ================= */
const ES_DIAS=['seg','ter','qua','qui','sex','sab','dom1','dom2','dom3','dom4','dom5'];
const ES_DL={seg:'Seg',ter:'Ter',qua:'Qua',qui:'Qui',sex:'Sex',sab:'Sáb'};
const ES_SETORES=['Cozinha','Expedição','Gestão','Limpeza','Estoque','Produção'];
const ES_APOIO=['Gestão','Limpeza','Estoque','Produção'];
const ES_VINC=['CLT','Freelancer V.A','Freelancer fixo','Intermitente','Horista','Vaga aberta','A definir'];
const ES_DK=['seg','ter','qua','qui','sex','sab','dom'], ES_DC={seg:'Seg',ter:'Ter',qua:'Qua',qui:'Qui',sex:'Sex',sab:'Sáb',dom:'Dom'};
// picos de venda informados pela operação: almoço 12h–14h30 e jantar 19h–21h30
const ES_PICOS=()=>((cfg('escala_politica')||{}).picos||[{nome:'almoço',ini:'12:00',fim:'14:30'},{nome:'jantar',ini:'19:00',fim:'21:30'}]).map(p=>({nome:p.nome,a:esMin(p.ini),b:esMin(p.fim)}));
const ES_POL=()=>Object.assign({regime:'5x2',implantacao:'2026-12-16',obrigatoria:'2027-01-01'},cfg('escala_politica')||{});
// horários-modelo da escala 5x2 (44h/semana = 8h48 por dia, 5 dias) com as pausas fora dos picos
const ES_MODELOS=[
  {g:'Cozinha Dia',h:'7:30-15/16-17:18',p:'Abre a cozinha e faz a produção antes das 11h; cobre o almoço inteiro e sai só depois da troca com a noite. Pausa às 15h, quando o movimento cai.'},
  {g:'Cozinha Noite',h:'13:30-17:30/18:30-23:18',p:'Entra antes do fim do almoço (sobreposição de 1h com o dia), pausa entre 17h30 e 18h30 e está inteiro no jantar até o fechamento.'},
  {g:'Expedição Dia',h:'9:30-15/16-19:18',p:'Monta a expedição antes do almoço e segura o começo do jantar até a noite assumir.'},
  {g:'Expedição Noite',h:'13:30-17:30/18:30-23:18',p:'Mesma lógica da cozinha noite: reforça o fim do almoço, pausa antes do jantar e fecha a loja.'},
  {g:'Gerente',h:'10-15/16-19:48',p:'Presente nos dois picos (almoço e começo do jantar) e na troca de turno.'},
  {g:'Intermitente · dia',h:'10:30-15',p:'Só nos dias de maior movimento (sex, dom): cobre o pico do almoço sem custo de 8h.'},
  {g:'Intermitente · noite',h:'18-23',p:'Só nos dias de maior movimento: cobre o pico do jantar.'},
  {g:'Horista · expedição',h:'11:30-15 ou 18:30-22:30',p:'Lojas menores: 3h30 a 4h exatamente dentro do pico.'},
  {g:'Reforço de domingo',h:'18-23',p:'Freelancer no jantar de domingo, o maior pico da semana.'},
  {g:'Estoque e apoio',h:'7-12/13-16:48',p:'Recebimento, contagem e limpeza começam antes da abertura; não entram na conta de pessoas do pico.'}];
const ES_TIPO={vigente:'Em vigor',planejada:'Planejada',proposta:'Proposta',arquivada:'Arquivada'};
const ES_ALM=12*60+30, ES_JAN=20*60; // plantões: quem está trabalhando às 12h30 (almoço) e às 20h (jantar)
const esNorm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esKpi=(l,v,sub,st)=>`<div class="card kpi ${st?'kpi-'+st:''}"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${sub||''}</div></div>`;
const esFiltra=l=>ES.setor==='todos'||l.setor===ES.setor||(ES.setor==='Limpeza'&&['Estoque','Gestão'].includes(l.setor));
let ES={uni:null,id:null,setor:'todos',edit:false,sujo:{},quem:null,sem:null};

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
  return {t:'trab',segs,ini,fim,min,alm,jan,dobra:dobra||(alm&&jan),cls:dobra||(alm&&jan)?'dobra':ini<11*60?'manha':ini>=13*60?'noite':'meio'};
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
function esPadrao(u){const es=esDaUnidade(u),m=ymOf(isoHoje());return es.find(e=>esC4(e)&&['vigente','planejada'].includes(e.tipo))||es.find(e=>e.tipo==='vigente'&&e.mes===m)||es.find(e=>e.tipo==='vigente')||es[0]||null}
const esC4=e=>!!e&&e.modelo==='ciclo4';
const esAddD=(iso,n)=>{const d=new Date(iso+'T12:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const esDifD=(a,b)=>Math.round((new Date(a+'T12:00')-new Date(b+'T12:00'))/864e5);
const esDM=iso=>iso.slice(8,10)+'/'+iso.slice(5,7);
// início do ciclo que está rodando (o rodízio de 4 semanas se repete a partir da data de início)
function esBase(e){const ini=e.inicio||'2026-12-14',h=isoHoje(),df=esDifD(h,ini);return df<0?ini:esAddD(ini,Math.floor(df/28)*28)}
const esLinhas=id=>(S.db.escala_linhas||[]).filter(l=>l.escala_id===id).sort((a,b)=>a.ordem-b.ordem||a.id-b.id);
const esColab=id=>id?(S.db.colaboradores||[]).find(c=>c.id===id):null;
function esCat(l){const c=esColab(l.colaborador_id),t=esNorm((l.funcao||'')+' '+(c?(c.cargo_folha||c.cargo||''):''));
  if(/lider|chefe/.test(t))return 'Líder'; if(/gerente|gerencia|coordenador|supervisor/.test(t))return 'Gerente';
  if(/atendente/.test(t))return 'Atendente'; if(/pacote/.test(t))return 'Pacote'; if(/cozinheiro/.test(t))return 'Cozinheiro';
  if(/estoqu/.test(t))return 'Estoque'; if(/auxiliar geral|limpeza/.test(t))return 'Limpeza'; if(/auxiliar/.test(t))return 'Auxiliar'; if(/expedidor/.test(t))return 'Expedição';
  return ''}
function esDomingos(mes){if(!mes)return [];const [y,m]=mes.split('-').map(Number),d=new Date(y,m-1,1),r=[];while(d.getMonth()===m-1){if(d.getDay()===0)r.push(d.getDate());d.setDate(d.getDate()+1)}return r}
function esCols(e,ls){
  if(esC4(e)){const b=esBase(e);return [1,2,3,4].flatMap(w=>ES_DK.map((d,i)=>{const date=esAddD(b,(w-1)*7+i);return {k:`w${w}${d}`,w,d,dom:d==='dom',date,l:`${ES_DC[d]} ${date.slice(8,10)}`}}))}
  const doms=esDomingos(e.mes),n=Math.max(doms.length||4,ls.some(l=>(l.dias||{}).dom5)?5:4);
  return ES_DIAS.filter(k=>!k.startsWith('dom')||+k.slice(3)<=n).map(k=>({k,dom:k.startsWith('dom'),l:k.startsWith('dom')?(doms[+k.slice(3)-1]?`Dom ${String(doms[+k.slice(3)-1]).padStart(2,'0')}`:`Dom ${k.slice(3)}`):ES_DL[k]}))}
const esMins=(u,setor)=>((cfg('escala_minimos')||{})[u]||{})[setor]||null;
const esFree=l=>/Freelancer|Vaga|definir/.test(l.vinculo);
const esVaga=l=>l.vaga_id?(S.db.vagas||[]).find(v=>v.id===l.vaga_id):null;
function esVagaTag(l){if(l.vinculo!=='Vaga aberta')return '';const v=esVaga(l);
  if(!v)return '<span class="es-vg none" title="Sem vaga no RH">sem vaga no RH</span>';
  const t={solicitada:['aguardando aprovação','warn'],aprovada:['vaga aberta no RH','open'],em_selecao:['em seleção','open'],preenchida:['contratado · coloque o nome','ok'],cancelada:['vaga cancelada','none']}[v.status]||[v.status,'none'];
  return `<span class="es-vg ${t[1]}" title="${esc(v.cargo_folha||v.cargo)} · ${v.preenchidas}/${v.quantidade} preenchida(s)${v.prazo?' · prazo '+fmtD(v.prazo):''}">${t[0]}</span>`}

// semana k = seg..sáb + domingo k (o padrão de segunda a sábado se repete toda semana)
function esSemanas(l,cols){return cols.filter(c=>c.dom).map(c=>{const ks=c.w?cols.filter(x=>x.w===c.w).map(x=>x.k):['seg','ter','qua','qui','sex','sab',c.k],ts=ks.map(k=>esTurno((l.dias||{})[k]));
  return {c,rot:c.w?`semana ${c.w} · ${esDM(cols.find(x=>x.w===c.w).date)}`:`semana do ${c.l}`,ts,min:sum(ts,t=>t.t==='trab'?t.min:0),dias:ts.filter(t=>t.t==='trab').length,folgas:ts.filter(t=>['folga','ferias','ausente'].includes(t.t)).length}})}

function esDistrib(ls,cols){
  const setores=ES_SETORES.filter(s=>ls.some(l=>l.setor===s));
  const rows=[];
  setores.forEach(s=>{const so=ES_APOIO.includes(s)?[['alm','Dia (12h30)']]:[['alm','Almoço (12h30)'],['jan','Jantar (20h)']];
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
  const lid=ls.filter(l=>l.setor==='Cozinha'&&esCat(l)==='Líder'),sup=ls.filter(l=>['Expedição','Gestão'].includes(l.setor)&&esCat(l)==='Gerente');
  if(lid.length>=2){const v=domCols.filter(c=>lid.filter(l=>folga(l,c.k)).length>=2).map(c=>`${c.l}: ${lid.filter(l=>folga(l,c.k)).map(l=>l.nome).join(' e ')}`);add(v.length?'bad':'ok','Domingo: nunca folgar dois líderes no mesmo domingo',v.length?v.join(' · '):`${lid.length} líderes conferidos.`)}
  [['Atendente','atendentes'],['Pacote','pacotes']].forEach(([cat,pl])=>{const g=ls.filter(l=>esCat(l)===cat);if(g.length<2)return;const v=domCols.filter(c=>g.filter(l=>folga(l,c.k)).length>=2).map(c=>c.l);add(v.length?'bad':'ok',`Domingo: nunca folgar dois ${pl} no mesmo domingo`,v.length?v.join(' · '):'OK.')});
  if(sup.length&&lid.length){const v=domCols.filter(c=>sup.some(l=>folga(l,c.k))&&lid.some(l=>folga(l,c.k))).map(c=>c.l);add(v.length?'bad':'ok','Domingo: nunca folgar supervisor junto com líder de cozinha',v.length?v.join(' · '):'OK.')}
  const kd=d=>cols.filter(c=>(c.d||c.k)===d).map(c=>c.k), fd=(l,d)=>kd(d).some(k=>folga(l,k));
  const lm=lid.filter(l=>{const ts=cols.filter(c=>!c.dom).map(c=>esTurno((l.dias||{})[c.k])).filter(t=>t.t==='trab');return ts.length&&ts.filter(t=>t.ini<11*60).length>=ts.length/2});
  if(lm.length){const v=lm.filter(l=>fd(l,'seg')||fd(l,'qua')).map(l=>`${l.nome} folga ${[fd(l,'seg')?'segunda':'',fd(l,'qua')?'quarta':''].filter(Boolean).join(' e ')}`);add(v.length?'bad':'ok','Líder da manhã não folga segunda (contagem) nem quarta (requerimento)',v.length?v.join(' · '):lm.map(l=>l.nome).join(', ')+' ok.')}
  // regime 5x2 (obrigatório a partir de 01/01/2027)
  const fixo=l=>l.vinculo==='CLT'||(l.vinculo==='Vaga aberta'&&!/Intermit|Horista|Refor/i.test((l.posicao||'')+' '+(l.funcao||'')));
  if(esC4(e)){const fx=ls.filter(fixo),seq=l=>{const v=cols.map(c=>esTurno((l.dias||{})[c.k]).t==='trab');let mx=0,r=0;v.concat(v).forEach(x=>{r=x?r+1:0;mx=Math.max(mx,r)});return Math.min(mx,28)};
    const d5=fx.map(l=>({l,w:esSemanas(l,cols).filter(s=>s.dias>5)})).filter(x=>x.w.length);
    add(d5.length?'bad':'ok','5x2: no máximo 5 dias de trabalho e 2 folgas por semana',d5.length?d5.map(x=>`${x.l.nome}${x.l.vinculo==='Vaga aberta'?' ('+(x.l.posicao||'vaga')+')':''}: ${x.w.map(s=>s.dias+' dias na '+s.rot).join(', ')}`).join(' · '):`${fx.length} posições fixas em 5x2.`);
    const s6=fx.filter(l=>seq(l)>6);add(s6.length?'bad':'ok','No máximo 6 dias seguidos sem folga',s6.length?s6.map(l=>`${l.nome}: ${seq(l)} dias`).join(' · '):'Ninguém passa de 6 dias seguidos, inclusive na virada do ciclo.');
    const sd=fx.filter(l=>!cols.some(c=>c.dom&&folga(l,c.k)));add(sd.length?'bad':'ok','Pelo menos 1 domingo de folga no ciclo de 4 semanas',sd.length?sd.map(l=>l.nome).join(', '):'Todos folgam ao menos um domingo no ciclo.');
    const pa=ls.filter(l=>!['Limpeza','Estoque','Produção'].includes(l.setor)).filter(l=>{const t=cols.map(c=>esTurno((l.dias||{})[c.k])).find(t=>t.t==='trab'&&t.segs.length>1);if(!t)return false;const pz=[t.segs[0][1],t.segs[1][0]];return ES_PICOS().some(p=>pz[0]<p.b&&pz[1]>p.a)});
    add(pa.length?'warn':'ok','Pausas fora dos picos de venda',pa.length?`Pausa dentro do almoço ou do jantar: ${pa.map(l=>l.nome).join(', ')}`:'Nenhuma pausa cai entre 12h–14h30 ou 19h–21h30.');
  } else if(e.tipo!=='arquivada'){const pol=ES_POL();add('warn','Modelo 5x2 obrigatório',`Esta escala ainda está no modelo antigo. A partir de ${fmtD(pol.obrigatoria)} todas as lojas rodam a escala 5x2 oficial (rodízio de 4 semanas).`)}
  const vagas=ls.filter(l=>l.vinculo==='Vaga aberta');
  if(vagas.length){const g={};vagas.forEach(l=>{const k=(l.grupo||l.setor)+(/Intermit/i.test(l.posicao||'')?' · intermitente':/Horista/i.test(l.posicao||'')?' · horista':'');g[k]=(g[k]||0)+1});add('warn',`${vagas.length} ${vagas.length>1?'posições':'posição'} a contratar`,Object.entries(g).map(([k,n])=>`${k}: ${n}`).join(' · '))}
  // semana sem folga e carga acima de 44h (CLT)
  const clt=ls.filter(l=>l.vinculo==='CLT');
  const semF=clt.map(l=>({l,w:esSemanas(l,cols).filter(s=>s.folgas===0&&s.dias>0)})).filter(x=>x.w.length);
  add(semF.length?'warn':'ok','Toda semana com pelo menos uma folga',semF.length?semF.map(x=>`${x.l.nome} (semana do ${x.w.map(s=>s.rot).join(', ')})`).join(' · '):'Todos os CLT têm folga em todas as semanas.');
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
  if(esC4(e)){const h=isoHoje(),c=cols.find(c=>c.date===h)||cols.find(c=>c.date===ES_POL().implantacao)||cols[0];return c.k}
  const h=isoHoje(),d=new Date(h+'T12:00'),wd=d.getDay();
  if(wd>=1&&wd<=6)return ['seg','ter','qua','qui','sex','sab'][wd-1];
  const doms=esDomingos(e.mes);if(e.mes===ymOf(h)){const i=doms.indexOf(d.getDate());if(i>=0&&cols.some(c=>c.k==='dom'+(i+1)))return 'dom'+(i+1)}
  return 'dom1';
}
const ES_DIA_LONGO={seg:'Segunda-feira',ter:'Terça-feira',qua:'Quarta-feira',qui:'Quinta-feira',sex:'Sexta-feira',sab:'Sábado'};
const ES_DIA_LONGO2={seg:'Segunda-feira',ter:'Terça-feira',qua:'Quarta-feira',qui:'Quinta-feira',sex:'Sexta-feira',sab:'Sábado',dom:'Domingo'};
const esDiaNome=(c,e)=>c.date?`${ES_DIA_LONGO2[c.d]}, ${esDM(c.date)}`:c.dom?(()=>{const doms=esDomingos(e.mes),n=+c.k.slice(3);return doms[n-1]&&e.mes?`Domingo, ${String(doms[n-1]).padStart(2,'0')}/${e.mes.slice(5)}`:`Domingo ${n}`})():ES_DIA_LONGO[c.k];
function esEhHoje(e,c){if(c.date)return c.date===isoHoje();const h=isoHoje(),d=new Date(h+'T12:00'),wd=d.getDay();if(e.mes&&e.mes!==ymOf(h))return false;
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
  const c4=esC4(e), wSel=c4?cDia.w:null;
  $('#esCorpo').innerHTML=`${esPoliticaHtml(e)}
  <div class="card es-hero mt">
    <div class="es-hero-l"><div class="cmg-eyebrow">Escala · ${esc(uniNome)}</div>
      <div class="es-hero-t">${esc(e.nome)} <span class="es-tipo ${e.tipo}">${ES_TIPO[e.tipo]}</span></div>
      <div class="es-hero-m"><span><b>${clt.length}</b> colaboradores</span><span><b>${fr.length}</b> freelancers</span>${vg.length?`<span class="es-warn-t"><b>${vg.length}</b> ${vg.length>1?'posições':'posição'} sem pessoa</span>${(()=>{const vs=[...new Set(vg.map(esVaga).filter(v=>v&&['solicitada','aprovada','em_selecao'].includes(v.status)))];return vs.length?`<button class="es-lk" id="esIrVg">${sum(vs,v=>v.quantidade-v.preenchidas)} em vagas abertas no RH →</button>`:''})()}`:''}<span>carga média <b>${esHoras(hMed)}</b>/semana</span>${c4?`<span>rodízio <b>5x2</b> · 4 semanas · ciclo atual de <b>${fmtD(esBase(e))}</b> a <b>${fmtD(esAddD(esBase(e),27))}</b></span>`:''}</div></div>
    <button class="es-saude ${saude}" id="esIrAt"><span class="es-saude-i">${saude==='ok'?'✓':'!'}</span><span><b>${pend?`${pend} ${pend>1?'pontos':'ponto'} de atenção`:'Escala em dia'}</b><small>${pend?`${ruins.length?ruins.length+' fora da regra':''}${ruins.length&&av.length?' · ':''}${av.length?av.length+' para revisar':''}`:`${okr.length} regras conferidas`}</small></span></button>
  </div>

  <div class="card mt"><h3>Como está a semana <small>toque num dia para ver quem trabalha</small>
    ${c4?`<span class="es-wk">${[1,2,3,4].map(w=>{const a=cols.find(c=>c.w===w);return `<button data-dia="w${w}${cDia.d}" class="${w===wSel?'on':''}"><b>Semana ${w}</b><small>${esDM(a.date)} a ${esDM(esAddD(a.date,6))}</small></button>`}).join('')}</span>`:''}</h3>
    <div class="es-sem">${esSemanaHtml(e,cols,dist)}</div></div>

  <div class="card mt es-tl-card"><h3>${esc(esDiaNome(cDia,e))}${esEhHoje(e,cDia)?' <span class="es-hoje">hoje</span>':''} <small>quem trabalha e em que horário</small>
    <span class="es-leg2"><i class="manha"></i>manhã<i class="meio"></i>intermediário<i class="noite"></i>noite<i class="dobra"></i>dobra</span></h3>
    ${esTimelineHtml(e,ls,cDia,dist,cols)}</div>

  ${esPropostaHtml(e,ls,cDia)}

  <div class="card mt"><h3>Escala completa <small>${esc(e.nome)}${c4?' · rodízio de 4 semanas, se repete a cada ciclo · horário de entrada de cada dia':e.mes&&mesLongo(e.mes)!==e.nome?' · '+mesLongo(e.mes):''}${c4?'':' · entrada e saída de cada dia'} · clique num dia para ver a linha do tempo</small>
    <span style="margin-left:auto;display:flex;gap:8px"><button class="btn sm" id="esCsv">Exportar CSV</button><button class="btn sm" onclick="window.print()">Imprimir</button></span></h3>
    ${esGradeHtml(e,ls,cols)}</div>

  <div class="grid g2 mt">
    <div class="card" id="esAtn"><h3>Pontos de atenção <small>regras da planilha conferidas automaticamente</small></h3>
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
  $$('#esCorpo [data-pol]').forEach(b=>b.onclick=()=>{ES.uni=b.dataset.pol;ES.id=null;ES.quem=null;ES.edit=false;ES.sujo={};rhEscalas()});
  const iv=$('#esIrVg');if(iv)iv.onclick=()=>{rhSub='vagas';const r=$('#rhLoja');if(r&&[...r.options].some(o=>o.value===e.unidade))r.value=e.unidade;renderRH()};
  $('#esIrAt').onclick=()=>$("#esAtn").scrollIntoView({behavior:'smooth',block:'start'});
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
      <div class="es-dc2-h"><span>${c.dom&&!c.w?'Domingo':c.l}</span>${esEhHoje(e,c)?'<em>hoje</em>':''}${baixo?'<i title="abaixo do mínimo">!</i>':''}</div>
      <div class="es-dc2-n">${pessoas}<small>pessoas</small></div>${linhas}${extra||''}</div>`};
  if(cols[0]&&cols[0].w){const w=(cols.find(c=>c.k===ES.dia)||cols[0]).w;return cols.filter(c=>c.w===w).map(c=>card(c)).join('')}
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
  <div class="es-tl"><div class="es-bands">${ES_PICOS().map((p,i)=>`<div class="es-band ${i?'jan':'alm'}" style="left:${X(p.a)}%;width:${X(p.b)-X(p.a)}%"></div>`).join('')}${agora!=null?`<div class="es-now" style="left:${X(agora)}%"><span>agora</span></div>`:''}</div>
    <div class="es-tr es-ax"><div class="es-tn"></div><div class="es-tt">${ticks.map(h=>`<span style="left:${X(h*60)}%">${h}h</span>`).join('')}${ES_PICOS().map((p,i)=>`<em class="${i?'jan':'alm'}" style="left:${(X(p.a)+X(p.b))/2}%">pico ${esc(p.nome)}</em>`).join('')}</div></div>
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

function esChip(v,cp){const t=esTurno(v);if(t.t==='vazio')return '<span class="es-ch vazio">—</span>';
  if(cp){if(t.t==='trab')return `<span class="es-ch cp ${t.cls}" title="${esc(v)}">${esHC(t.ini)}</span>`;return `<span class="es-ch cp ${t.t==='folga'?'folga':t.t==='ferias'?'ferias':'outro'}" title="${esc(v)}">${t.t==='folga'?'F':t.t==='ferias'?'Fé':'·'}</span>`}
  if(t.t==='trab')return `<span class="es-ch ${t.cls}" title="${esc(v)}">${esHC(t.ini)}–${esHC(t.fim)}${/\(D\)/i.test(v)?' <i>D</i>':''}</span>`;
  return `<span class="es-ch ${t.t==='folga'?'folga':t.t==='ferias'?'ferias':'outro'}" title="${esc(v)}">${t.t==='folga'?'Folga':t.t==='ferias'?'Férias':esc(String(v).slice(0,14))}</span>`}

function esGradeHtml(e,ls,cols){
  if(!ls.length)return '<div class="empty">Nenhuma pessoa neste setor.</div>';
  const turnos=[...new Set((S.db.escala_linhas||[]).filter(l=>l.escala_id===e.id).flatMap(l=>Object.values(l.dias||{})))].sort();
  const setores=ES_SETORES.filter(s=>ls.some(l=>l.setor===s));
  const ed=ES.edit,c4=!!(cols[0]&&cols[0].w);
  const cab=c4?`<tr class="es-wh"><th class="es-nm"></th>${[1,2,3,4].map(w=>{const a=cols.find(c=>c.w===w);return `<th colspan="7" class="wk">Semana ${w} <span>${esDM(a.date)}–${esDM(esAddD(a.date,6))}</span></th>`}).join('')}<th></th>${ed?'<th></th>':''}</tr>`:'';
  return `${ed?`<datalist id="esTurnos">${['FOLGA','FÉRIAS'].concat(turnos.filter(t=>!/^F(OLGA|ÉRIAS)/i.test(t))).map(t=>`<option value="${esc(t)}">`).join('')}</datalist>`:''}
  <div class="tbl-wrap es-gw"><table class="es-g ${ed?'ed':''} ${c4?'c4':''}">${cab}<tr class="es-dh"><th class="es-nm">Pessoa</th>${cols.map(c=>`<th class="${c.dom?'dom':''} ${c.d==='seg'?'w0':''} ${!ed&&c.k===ES.dia?'sel':''}" ${ed?'':`data-dia="${c.k}"`}>${c4?`${ES_DC[c.d].slice(0,1)}<small>${c.date.slice(8,10)}</small>`:c.l}</th>`).join('')}<th class="num" title="média das semanas do mês">h/sem</th>${ed?'<th></th>':''}</tr>
  ${(c4?[...new Set(ls.map(l=>l.grupo||l.setor))]:setores).map(s=>{const doG=l=>c4?(l.grupo||l.setor)===s:l.setor===s;return `<tr class="es-sg"><td colspan="${cols.length+2+(ed?1:0)}">${esc(s)} <span class="muted">· ${ls.filter(doG).length}</span></td></tr>`+ls.filter(doG).map(l=>{const c=esColab(l.colaborador_id),w=esSemanas(l,cols),hm=w.length?sum(w,x=>x.min)/w.length:0,mx=w.length?Math.max(...w.map(x=>x.min)):0,d=ES.sujo[l.id]||{},dias=Object.assign({},l.dias||{},d.dias||{});
    const fun=l.funcao||(c?(c.cargo_folha||c.cargo):'')||'';
    return `<tr class="${esFree(l)?'fr':''}">
      <td class="es-nm">${ed?`<input class="inp es-in" data-f="nome" data-l="${l.id}" value="${esc(d.nome??l.nome)}"><div class="es-mini"><select class="inp" data-f="setor" data-l="${l.id}">${ES_SETORES.map(o=>`<option ${(d.setor??l.setor)===o?'selected':''}>${o}</option>`).join('')}</select><select class="inp" data-f="vinculo" data-l="${l.id}">${ES_VINC.map(o=>`<option ${(d.vinculo??l.vinculo)===o?'selected':''}>${o}</option>`).join('')}</select><input class="inp" data-f="funcao" data-l="${l.id}" value="${esc(d.funcao??l.funcao??'')}" placeholder="${esc(fun||'Função')}"><select class="inp" data-f="colaborador_id" data-l="${l.id}" title="Cadastro no RH"><option value="">sem cadastro no RH</option>${esRhOpts(e.unidade,d.colaborador_id??l.colaborador_id)}</select></div>`
        :`<b>${esc(l.nome)}</b>${c?` <span class="es-rh" title="Cadastro no RH: ${esc(c.nome)}">RH</span>`:''}<div class="small muted">${esc(c4&&l.posicao?l.posicao.replace(/^.*· /,''):fun)}${c4&&fun&&l.posicao&&!l.posicao.includes(fun)?' · '+esc(fun):''}${l.vinculo!=='CLT'?` · <span class="es-vn">${esc(l.vinculo)}</span>`:''}</div>${c4?`<div class="es-hr">${esc(esHorario(l))}</div>`:''}${esVagaTag(l)}`}</td>
      ${cols.map(cc=>`<td class="${cc.dom?'dom':''} ${cc.d==='seg'?'w0':''} ${!ed&&cc.k===ES.dia?'sel':''}">${ed?`<input class="inp es-ci" list="esTurnos" data-d="${cc.k}" data-l="${l.id}" value="${esc(dias[cc.k]||'')}">`:esChip(dias[cc.k],c4)}</td>`).join('')}
      <td class="num ${mx>44*60+15&&l.vinculo==='CLT'?'es-h44':''}" title="${w.map(x=>`${x.c.l}: ${esHoras(x.min)}`).join(' · ')}">${hm?esHoras(hm):'—'}</td>
      ${ed?`<td><button class="btn sm" data-del="${l.id}" title="Remover da escala">×</button></td>`:''}</tr>`}).join('')}).join('')}</table></div>`;
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
    if(await dbw(sb.from('escala_linhas').delete().eq('id',l.id),'Removido da escala.')){delete ES.sujo[l.id];await load(['escala_linhas','vagas','quadro_previsto','alertas']);rhEscalas()}});
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
  busy(false);if(ok)toast('Escala salva.');ES.sujo={};ES.edit=false;await load(['escalas','escala_linhas','vagas','quadro_previsto','alertas']);rhEscalas();
}

function esNovaLinha(e,todas){
  const rh=(S.db.colaboradores||[]).filter(c=>!c.desligamento&&(c.loja_id===e.unidade||(!c.loja_id&&c.setor===e.unidade))).filter(c=>!todas.some(l=>l.colaborador_id===c.id));
  modal(`<h3>Adicionar pessoa à escala</h3><div class="form-row" style="grid-template-columns:1fr 1fr">
    <label class="f">Colaborador do RH<select class="inp" id="enC"><option value="">— não está no RH / freelancer —</option>${rh.map(c=>`<option value="${c.id}">${esc(c.nome)} · ${esc(c.cargo_folha||c.cargo||'')}</option>`).join('')}</select></label>
    <label class="f">Nome na escala<input class="inp" id="enN" placeholder="Nome"></label>
    <label class="f">Setor<select class="inp" id="enS">${ES_SETORES.map(s=>`<option ${s===(ES.setor!=='todos'?ES.setor:'Cozinha')?'selected':''}>${s}</option>`).join('')}</select></label>
    <label class="f">Vínculo<select class="inp" id="enV">${ES_VINC.map(v=>`<option>${v}</option>`).join('')}</select></label>
    <label class="f">Horário padrão (seg–sáb)<input class="inp" id="enH" list="esTurnos" placeholder="ex.: 7-13/14-15:20"></label>
    <label class="f">${esC4(e)?'Folga fixa (além do domingo)':'Folga fixa na semana'}<select class="inp" id="enF"><option value="">—</option>${['seg','ter','qua','qui','sex','sab'].map(k=>`<option value="${k}">${ES_DL[k]}</option>`).join('')}</select></label></div>
    <p class="small muted mt">Os domingos ficam em branco para você definir na grade.</p>
    <div class="actions mt"><button class="btn" onclick="fecharModal()">Cancelar</button><button class="btn pri" id="enOk">Adicionar</button></div>`,b=>{
    b.querySelector('#enC').onchange=ev=>{const c=rh.find(x=>x.id==ev.target.value);if(c){b.querySelector('#enN').value=c.nome.split(' ').slice(0,2).join(' ');b.querySelector('#enV').value='CLT'}};
    b.querySelector('#enOk').onclick=async()=>{const nome=b.querySelector('#enN').value.trim();if(!nome){toast('Informe o nome.');return}
      const h=b.querySelector('#enH').value.trim(),f=b.querySelector('#enF').value,dias={};if(h)(esC4(e)?[1,2,3,4]:['']).forEach(w=>['seg','ter','qua','qui','sex','sab'].forEach(d=>dias[(w?'w'+w:'')+d]=d===f?'FOLGA':h));
      const ord=Math.max(-1,...todas.map(l=>l.ordem))+1;
      if(await dbw(sb.from('escala_linhas').insert({escala_id:e.id,nome,setor:b.querySelector('#enS').value,vinculo:b.querySelector('#enV').value,colaborador_id:+b.querySelector('#enC').value||null,ordem:ord,dias}),'Pessoa adicionada.')){fecharModal();await load(['escala_linhas','vagas','quadro_previsto','alertas']);rhEscalas()}}});
}

function esPropriedades(e){
  modal(`<h3>Escala</h3><div class="form-row" style="grid-template-columns:1.4fr 1fr 1fr">
    <label class="f">Nome<input class="inp" id="epN" value="${esc(e.nome)}"></label>
    <label class="f">Mês de referência<input class="inp" type="month" id="epM" value="${e.mes||''}"></label>
    <label class="f">Situação<select class="inp" id="epT">${Object.entries(ES_TIPO).map(([k,v])=>`<option value="${k}" ${k===e.tipo?'selected':''}>${v}</option>`).join('')}</select></label></div>
    ${esC4(e)?`<label class="f mt">Início do rodízio (segunda-feira da semana 1)<input class="inp" type="date" id="epI" value="${e.inicio||''}"></label>`:''}
    <label class="f mt">Observação<input class="inp" id="epO" value="${esc(e.obs||'')}"></label>
    <div class="actions mt">${P.excluir(e.unidade)||P.gestor?'<button class="btn" id="epDel" style="margin-right:auto">Excluir escala</button>':''}<button class="btn" onclick="fecharModal()">Cancelar</button><button class="btn pri" id="epOk">Salvar</button></div>`,b=>{
    b.querySelector('#epOk').onclick=async()=>{const n=b.querySelector('#epN').value.trim();if(!n){toast('Informe o nome.');return}
      if(await dbw(sb.from('escalas').update({nome:n,mes:b.querySelector('#epM').value||null,tipo:b.querySelector('#epT').value,obs:b.querySelector('#epO').value.trim()||null,...(esC4(e)&&b.querySelector('#epI').value?{inicio:b.querySelector('#epI').value}:{})}).eq('id',e.id),'Escala atualizada.')){fecharModal();await load(['escalas','vagas','quadro_previsto','alertas']);rhEscalas()}};
    const d=b.querySelector('#epDel');if(d)d.onclick=async()=>{if(!confirm(`Excluir a escala "${e.nome}" com todas as pessoas? Não dá para desfazer.`))return;
      if(await dbw(sb.from('escalas').delete().eq('id',e.id),'Escala excluída.')){fecharModal();ES.id=null;await load(['escalas','escala_linhas','vagas','quadro_previsto','alertas']);rhEscalas()}}});
}

function esNova(){
  const u=ES.uni,es=esDaUnidade(u),atual=es.find(x=>x.id===ES.id),prox=addMes(ymOf(isoHoje()),1),pol=ES_POL();
  const seg=(()=>{let d=pol.implantacao;while(new Date(d+'T12:00').getDay()!==1)d=esAddD(d,-1);return d})();
  modal(`<h3>Nova escala · ${esc(esUnidades().find(x=>x.id===u)?.nome||u)}</h3><div class="form-row" style="grid-template-columns:1.4fr 1fr 1fr">
    <label class="f">Nome<input class="inp" id="nwN" value="${esc(mesLongo(prox))}"></label>
    <label class="f">Mês de referência<input class="inp" type="month" id="nwM" value="${prox}"></label>
    <label class="f">Situação<select class="inp" id="nwT">${Object.entries(ES_TIPO).map(([k,v])=>`<option value="${k}" ${k==='planejada'?'selected':''}>${v}</option>`).join('')}</select></label></div>
    <div class="form-row mt" style="grid-template-columns:1fr 1fr"><label class="f">Modelo<select class="inp" id="nwMo"><option value="ciclo4" selected>Escala 5x2 · rodízio de 4 semanas (obrigatória)</option><option value="semana">Semana padrão (modelo antigo)</option></select></label>
    <label class="f">Início do rodízio<input class="inp" type="date" id="nwI" value="${seg}"></label></div>
    <label class="f mt">Começar a partir de<select class="inp" id="nwB"><option value="">Escala em branco</option>${es.map(x=>`<option value="${x.id}" ${atual&&x.id===atual.id?'selected':''}>Copiar "${esc(x.nome)}"</option>`).join('')}</select></label>
    <p class="small muted mt">Ao copiar, as pessoas, setores e horários vêm iguais; depois é só ajustar folgas e domingos.</p>
    <div class="actions mt"><button class="btn" onclick="fecharModal()">Cancelar</button><button class="btn pri" id="nwOk">Criar</button></div>`,b=>{
    b.querySelector('#nwOk').onclick=async()=>{const n=b.querySelector('#nwN').value.trim();if(!n){toast('Informe o nome.');return}
      const mo=b.querySelector('#nwMo').value;
      const r=await dbw(sb.from('escalas').insert({unidade:u,nome:n,mes:b.querySelector('#nwM').value||null,tipo:b.querySelector('#nwT').value,modelo:mo,inicio:mo==='ciclo4'?(b.querySelector('#nwI').value||seg):null}).select('id').single());if(!r)return;
      const base=+b.querySelector('#nwB').value,be=es.find(x=>x.id===base);
      // de semana padrão para o rodízio: seg..sáb vale para as 4 semanas e o domingo N vira o domingo da semana N
      const conv=d=>{if(!be||esC4(be)===(mo==='ciclo4'))return d;const o={};if(mo==='ciclo4'){[1,2,3,4].forEach(w=>{['seg','ter','qua','qui','sex','sab'].forEach(k=>{if(d[k])o['w'+w+k]=d[k]});if(d['dom'+w])o['w'+w+'dom']=d['dom'+w]})}else{['seg','ter','qua','qui','sex','sab'].forEach(k=>{if(d['w1'+k])o[k]=d['w1'+k]});[1,2,3,4].forEach(w=>{if(d['w'+w+'dom'])o['dom'+w]=d['w'+w+'dom']})}return o};
      if(base){const ls=esLinhas(base).map(l=>({escala_id:r.id,setor:l.setor,nome:l.nome,funcao:l.funcao,vinculo:l.vinculo,colaborador_id:l.colaborador_id,ordem:l.ordem,grupo:l.grupo||null,posicao:l.posicao||null,vaga_id:l.vaga_id||null,dias:conv(l.dias||{})}));if(ls.length)await dbw(sb.from('escala_linhas').insert(ls))}
      fecharModal();toast('Escala criada.');ES.id=r.id;ES.edit=!!0;await load(['escalas','escala_linhas','vagas','quadro_previsto','alertas']);rhEscalas()}});
}

// ---------- 5x2 obrigatória ----------
function esHorario(l){const f={};Object.values(l.dias||{}).forEach(v=>{const t=esTurno(v);if(t.t==='trab')f[v]=(f[v]||0)+1});const v=Object.keys(f).sort((a,b)=>f[b]-f[a])[0];if(!v)return '';const t=esTurno(v);
  return `${esHC(t.ini)}–${esHC(t.fim)}${t.segs.length>1?` · pausa ${esHC(t.segs[0][1])}–${esHC(t.segs[1][0])}`:''} · ${esHoras(t.min)}`}
function esPoliticaHtml(e){
  const pol=ES_POL(),h=isoHoje(),dO=esDifD(pol.obrigatoria,h),dI=esDifD(pol.implantacao,h);
  const lj=LOJAS.filter(l=>['operando','inauguracao'].includes(l.status)&&(P.gestor||P.veTudo||S.minhas.includes(l.id)));
  const chips=lj.map(l=>{const x=(S.db.escalas||[]).find(z=>z.unidade===l.id&&esC4(z)&&['vigente','planejada'].includes(z.tipo)),vg=x?esLinhas(x.id).filter(y=>y.vinculo==='Vaga aberta').length:0;
    return `<button class="es-pol-ch ${x?(vg?'warn':'ok'):'bad'} ${l.id===e.unidade?'on':''}" data-pol="${l.id}" title="${x?'Escala 5x2 lançada'+(vg?` · ${vg} posições a contratar`:''):'Escala 5x2 ainda não lançada'}"><i>${x?(vg?'!':'✓'):'✕'}</i><span><b>${esc(l.nome)}</b><small>${x?(vg?`lançada · ${vg} a contratar`:'lançada e completa'):'não lançada'}</small></span></button>`}).join('');
  const prazo=dO>0?`<b>${dO}</b><span>${dO>1?'dias':'dia'} para a obrigatoriedade</span>`:`<b>✓</b><span>em vigor desde ${fmtD(pol.obrigatoria)}</span>`;
  return `<div class="card es-pol"><div class="es-pol-top"><div class="es-pol-l"><div class="es-pol-tag">Obrigatório · nível Brasil</div>
    <div class="es-pol-t">Escala 5x2 em todas as operações</div>
    <div class="es-pol-s">${dI>0?`Implantação em <b>${fmtD(pol.implantacao)}</b>. `:`Implantada em ${fmtD(pol.implantacao)}. `}A partir de <b>${fmtD(pol.obrigatoria)}</b> toda loja roda e lança no portal a escala <b>5x2</b>: 5 dias de trabalho, 2 folgas por semana, 44h semanais e pelo menos 1 domingo de folga no ciclo de 4 semanas.</div></div>
    <div class="es-pol-c">${prazo}</div></div>
    <div class="es-pol-lj">${chips}</div></div>`;
}

// ---------- proposta pelos picos de venda ----------
const ES_T0=6*60, ES_T1=24*60, ES_SL=15;
function esDemReal(u){const r=(S.db.vendas_hora||[]).filter(x=>x.loja_id===u&&!x.demo);let h=null,txt='';
  if(new Set(r.map(x=>x.data)).size>=14){h=Array(24).fill(0);r.forEach(x=>h[x.hora]+=(+x.salao||0)+(+x.delivery||0));txt='curva das vendas por hora registradas da loja'}
  else{const ms=[...IDX.vhm.keys()].filter(k=>k.startsWith(u+'|')).map(k=>k.split('|')[1]).sort(),m=ms[ms.length-1];
    if(m){const a=IDX.vhm.get(u+'|'+m);h=Array(24).fill(0);Object.entries(a.horas).forEach(([k,v])=>h[k]=v);txt=`curva real: faturamento por hora de ${mesLongo(m).toLowerCase()}${a.ate?' até '+fmtD(a.ate).slice(0,5):''} (${a.fonte||'caixa'})`}}
  if(!h)return null;const mx=Math.max(...h);if(!mx)return null;
  // valor da hora cheia, suavizado entre as horas vizinhas a cada 15 min
  const v=[];for(let t=ES_T0;t<ES_T1;t+=ES_SL){const m=t+ES_SL/2,hh=Math.floor(m/60),f=(m-hh*60)/60,a=h[hh]||0,b=f<.5?(h[hh-1]||0):(h[hh+1]||0),w=Math.abs(f-.5);v.push(((1-w)*a+w*b)/mx)}
  return {v,txt,h}}
function esDemanda(u){
  const real=esDemReal(u);if(real)return {v:real.v,fonte:'real',txt:real.txt,h:real.h};
  const P=ES_PICOS(),v=[];
  for(let t=ES_T0;t<ES_T1;t+=ES_SL){const m=t+ES_SL/2;let x=m<10*60+30||m>23*60+30?0:(m>=15*60&&m<18*60?.22:.16);
    P.forEach((p,i)=>{const pk=i?.95:1,r=45;let y=0;
      if(m>=p.a&&m<=p.b){const mid=(p.a+p.b)/2,hw=(p.b-p.a)/2;y=pk*(1-.25*((m-mid)/hw)**2)}
      else if(m>p.a-r&&m<p.a)y=pk*.75*(m-(p.a-r))/r; else if(m>p.b&&m<p.b+r)y=pk*.75*(1-(m-p.b)/r);
      x=Math.max(x,y)});
    v.push(x)}
  return {v,fonte:'picos'};
}
function esCobre(t,p){if(!t||t.t!=='trab')return 'nao';const ok=m=>t.segs.some(g=>m>=g[0]&&m<g[1]);let a=0,n=0;for(let m=p.a;m<p.b;m+=15){n++;if(ok(m))a++}return a===n?'sim':a?'parcial':'nao'}
function esPropostaHtml(e,ls,c){
  const op=ls.filter(l=>!['Limpeza','Estoque','Produção'].includes(l.setor));
  const D=esDemanda(e.unidade),P=ES_PICOS(),n=D.v.length;
  const turnos=op.map(l=>({l,t:esTurno((l.dias||{})[c.k])})).filter(x=>x.t.t==='trab');
  const pes=D.v.map((_,i)=>{const m=ES_T0+i*ES_SL+ES_SL/2;return turnos.filter(x=>x.t.segs.some(g=>m>=g[0]&&m<g[1])).length});
  const noPico=i=>{const m=ES_T0+i*ES_SL+ES_SL/2;return P.some(p=>m>=p.a&&m<p.b)};
  const pp=pes.filter((_,i)=>noPico(i)),pk=Math.max(1,Math.round(sum(pp,x=>x)/Math.max(1,pp.length))); // equipe média que a loja coloca nos picos
  const alvo=D.v.map(v=>v>0?Math.max(1,Math.round(v*pk)):0);
  const hh=m=>{const h=Math.floor(m/60)%24,mm=m%60;return mm?`${h}h${String(mm).padStart(2,'0')}`:`${h}h`}, hm=i=>hh(ES_T0+i*ES_SL);
  const entre=i=>{const m=ES_T0+i*ES_SL+ES_SL/2;return m>=P[0].b&&m<P[P.length-1].a};
  const faixas=f=>{const r=[];let a=null;for(let i=0;i<=n;i++){if(i<n&&f(i)){if(a==null)a=i}else if(a!=null){r.push([a,i]);a=null}}return r};
  const fal=faixas(i=>pes[i]<alvo[i]&&D.v[i]>=.4), sob=faixas(i=>entre(i)&&pes[i]-alvo[i]>=2&&D.v[i]<.45).filter(([a,b])=>b-a>=4);
  const abre=pes.findIndex(x=>x>0),fecha=pes.length-1-[...pes].reverse().findIndex(x=>x>0),pre=D.v.findIndex(v=>v>0);
  const pausaPico=turnos.filter(x=>x.t.segs.length>1&&P.some(p=>x.t.segs[0][1]<p.b&&x.t.segs[1][0]>p.a));
  const ins=[];
  if(D.h){const tot=D.h.reduce((a,b)=>a+b,0),top=D.h.map((v,i)=>[i,v]).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]+'h'),pc=(a,b)=>Math.round(D.h.slice(a,b).reduce((x,y)=>x+y,0)/tot*100);
    ins.push({k:'i',t:`Vendas reais: as horas mais fortes são ${top.join(', ')}. Almoço (11h–15h) = ${pc(11,15)}% do faturamento; jantar (18h–22h) = ${pc(18,22)}%.`})}
  P.forEach(p=>{const ix=D.v.map((_,i)=>i).filter(i=>{const m=ES_T0+i*ES_SL+ES_SL/2;return m>=p.a&&m<p.b});const mn=Math.min(...ix.map(i=>pes[i])),mx=Math.max(...ix.map(i=>pes[i]));
    ins.push({k:'i',t:`Pico do ${p.nome} (${hh(p.a)} às ${hh(p.b)}): ${mn===mx?mn:mn+' a '+mx} pessoas na operação${mn!==mx?`, ${ix.filter(i=>pes[i]===mn).length*15} min com ${mn}`:''}.`})});
  fal.forEach(([a,b])=>{const g=Math.max(...pes.slice(a,b).map((x,j)=>alvo[a+j]-x));ins.push({k:'b',t:`Das ${hm(a)} às ${hm(b)} a equipe fica abaixo da curva de demanda (falta${g>1?'m':''} até ${g} ${g>1?'pessoas':'pessoa'}): antecipe uma entrada ou chame o intermitente nesse horário.`})});
  sob.forEach(([a,b])=>{const g=Math.max(...pes.slice(a,b).map((x,j)=>x-alvo[a+j]));ins.push({k:'o',t:`Das ${hm(a)} às ${hm(b)}, entre os picos, há até ${g} pessoas além do necessário: é a janela para pausas, produção, limpeza e recebimento.`})});
  if(abre>=0&&pre>abre)ins.push({k:'i',t:`Abertura: a primeira pessoa entra às ${hm(abre)}; até as ${hm(pre)} a equipe faz produção e abastecimento, sem venda.`});
  if(pausaPico.length)ins.push({k:'b',t:`Pausa dentro do pico: ${pausaPico.map(x=>x.l.nome).join(', ')}. Mova a pausa para 15h–16h ou 17h30–18h30.`});
  if(!fal.length&&!pausaPico.length)ins.push({k:'ok',t:'A escala deste dia acompanha a curva de demanda nos dois picos e nenhuma pausa cai no pico.'});
  // gráfico: dois painéis com o mesmo eixo de horário
  const W=720,L=44,R=14,H1=84,G=24,H2=170,TOP=24,Y2=TOP+H1+G,AX=Y2+H2,Wp=W-L-R,X=i=>L+i/n*Wp,Xm=m=>L+(m-ES_T0)/(ES_T1-ES_T0)*Wp;
  const ymax=Math.max(2,...pes,...alvo),Yp=v=>Y2+H2-v/ymax*H2,Yd=v=>TOP+H1-v*H1;
  const areaD=`M${L},${TOP+H1} `+D.v.map((v,i)=>`L${X(i).toFixed(1)},${Yd(v).toFixed(1)} L${X(i+1).toFixed(1)},${Yd(v).toFixed(1)}`).join(' ')+` L${L+Wp},${TOP+H1} Z`;
  const step=a=>a.map((v,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Yp(v).toFixed(1)} L${X(i+1).toFixed(1)},${Yp(v).toFixed(1)}`).join(' ');
  const areaP=`M${L},${Y2+H2} `+step(pes).replace(/^M/,'L')+` L${L+Wp},${Y2+H2} Z`;
  const yt=[0,Math.ceil(ymax/2),ymax];
  const svg=`<svg class="es-pp" viewBox="0 0 ${W} ${AX+22}" role="img" aria-label="Demanda e pessoas trabalhando por horário">
    ${P.map(p=>`<rect class="es-pp-band" x="${Xm(p.a)}" y="${TOP-6}" width="${Xm(p.b)-Xm(p.a)}" height="${AX-TOP+6}" rx="4"/><text class="es-pp-bl" x="${(Xm(p.a)+Xm(p.b))/2}" y="${TOP-10}">pico ${esc(p.nome)}</text>`).join('')}
    <text class="es-pp-t" x="${L}" y="${TOP-10}">Demanda</text>
    <line class="es-pp-base" x1="${L}" x2="${L+Wp}" y1="${TOP+H1}" y2="${TOP+H1}"/>
    <path class="es-pp-dem" d="${areaD}"/>
    ${yt.map(v=>`<line class="es-pp-grid" x1="${L}" x2="${L+Wp}" y1="${Yp(v)}" y2="${Yp(v)}"/><text class="es-pp-yl" x="${L-8}" y="${Yp(v)+4}">${v}</text>`).join('')}
    <text class="es-pp-t" x="${L}" y="${Y2-5}">Pessoas na operação</text>
    ${fal.map(([a,b])=>`<rect class="es-pp-gap" x="${X(a)}" y="${Y2}" width="${X(b)-X(a)}" height="${H2}"/>`).join('')}
    <path class="es-pp-pes" d="${areaP}"/><path class="es-pp-pl" d="${step(pes)}"/>
    <path class="es-pp-alvo" d="${step(alvo)}"/>
    ${[6,8,10,12,14,16,18,20,22,24].map(h=>`<text class="es-pp-xl" x="${Xm(h*60)}" y="${AX+15}">${h}h</text>`).join('')}
    ${D.v.map((v,i)=>`<rect class="es-pp-hit" x="${X(i)}" y="${TOP}" width="${X(i+1)-X(i)}" height="${AX-TOP}"><title>${hm(i)}–${hm(i+1)} · demanda ${Math.round(v*100)}% do pico · ${pes[i]} ${pes[i]===1?'pessoa':'pessoas'} (ideal ${alvo[i]})</title></rect>`).join('')}
  </svg>`;
  const mdl=ES_MODELOS.map(m=>{const t=esTurno(m.h.split(' ou ')[0]),cb=P.map(p=>esCobre(t,p)),ic=v=>v==='sim'?'<span class="es-ok">✓</span>':v==='parcial'?'<span class="es-par">parcial</span>':'<span class="muted">—</span>';
    return `<tr><td><b>${esc(m.g)}</b></td><td class="num">${esc(m.h.replace(/-/g,'–'))}</td><td class="num">${m.h.includes(' ou ')?'3h30–4h':esHoras(t.min)}</td><td>${ic(cb[0])}</td><td>${ic(cb[1])}</td><td class="es-mot">${esc(m.p)}</td></tr>`}).join('');
  return `<div class="card mt es-prop"><h3>Proposta pelos picos de venda <small>${esc(esDiaNome(c,e))} · ${D.fonte==='real'?esc(D.txt):'curva montada pelos picos da operação: almoço 12h–14h30 e jantar 19h–21h30'}</small></h3>
    <div class="es-pp-wrap"><div>${svg}<div class="es-pp-leg"><span><i class="dem"></i>Demanda (índice do pico)</span><span><i class="pes"></i>Pessoas trabalhando</span><span><i class="alvo"></i>Ideal pela demanda</span>${fal.length?'<span><i class="gap"></i>Abaixo da curva</span>':''}</div></div>
      <div class="es-ins">${ins.map(x=>`<div class="es-in-i ${x.k}"><i>${x.k==='ok'?'✓':x.k==='b'?'!':x.k==='o'?'↓':'•'}</i><span>${esc(x.t)}</span></div>`).join('')}
        <p class="small muted">Ideal = demanda de cada 15 minutos × a equipe que a loja coloca no pico. Cozinha, expedição e gestão; estoque e limpeza ficam fora da conta.</p></div></div>
    <details class="es-mdl" ${esC4(e)?'':'open'}><summary>Horários propostos para a escala 5x2 <small>44h por semana = 8h48 por dia em 5 dias · pausa sempre fora do pico</small></summary>
      <div class="tbl-wrap"><table class="es-mt"><tr><th>Posição</th><th>Horário</th><th>Horas/dia</th><th>Almoço</th><th>Jantar</th><th>Por que este horário</th></tr>${mdl}</table></div></details></div>`;
}

function initEscalas(){
  $('#esUni').onchange=ev=>{ES.uni=ev.target.value;ES.id=null;ES.quem=null;ES.edit=false;ES.sujo={};rhEscalas()};
  $('#esEsc').onchange=ev=>{if(ES.edit&&Object.keys(ES.sujo).length&&!confirm('Descartar as alterações não salvas?')){ev.target.value=ES.id;return}ES.id=+ev.target.value;ES.quem=null;ES.edit=false;ES.sujo={};rhEscalas()};
  $$('#esSet button').forEach(b=>b.onclick=()=>{ES.setor=b.dataset.s;ES.quem=null;rhEscalas()});
  $('#esEditar').onclick=()=>{if(ES.edit&&Object.keys(ES.sujo).length&&!confirm('Sair da edição sem salvar?'))return;ES.edit=!ES.edit;ES.sujo={};rhEscalas()};
  $('#esNova').onclick=esNova;
}
