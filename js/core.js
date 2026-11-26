/* =====================================================================
   FAT BUDDHA · PORTAL OPERACIONAL — núcleo
   conexão, estado, carregamento, permissões, cálculos e utilitários
   ===================================================================== */
const SUPABASE_URL = 'https://akcbpjlsfarcfzmtkdle.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3rhA42e6c5NMSjxlJz_v8w_tzuj6ddt';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

/* ---------------- helpers (os mesmos do painel original) ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const nf0 = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
const nf1 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
const nf2 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const ok_ = v => v!=null && isFinite(v);
const brl = v => ok_(v)?'R$ ' + nf0.format(Math.round(v)):'—';
const brlK = v => !ok_(v)?'—':v<0?'−'+brlK(-v):Math.abs(v)>=999500 ? 'R$ '+nf1.format(v/1e6).replace(',0','')+' mi' : 'R$ '+nf0.format(Math.round(v/1000))+' mil';
const fmt = (f,v) => v==null||isNaN(v)?'—':({brl:brlK(v),pct0:nf0.format(v)+'%',pct1:nf1.format(v)+'%',pctS:(v>0?'+':'')+nf1.format(v)+'%',min:nf1.format(v)+' min',nota:nf1.format(v),int:nf0.format(v)})[f];
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtD = d => d?new Date(d+'T12:00').toLocaleDateString('pt-BR'):'—';
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_L = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const mesTxt = m => {const [y,mm]=m.split('-');return MESES[+mm-1]+'/'+y.slice(2)};
const mesLongo = m => {const [y,mm]=m.split('-');return MESES_L[+mm-1]+' '+y};
const isoD = d => new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const isoHoje = () => isoD(new Date());
const ymOf = iso => iso.slice(0,7);
const diasNoMes = m => {const [y,mm]=m.split('-').map(Number);return new Date(y,mm,0).getDate()};
const iniMes = m => m+'-01';
const fimMes = m => m+'-'+String(diasNoMes(m)).padStart(2,'0');
const addMes = (m,n) => {const [y,mm]=m.split('-').map(Number);const d=new Date(y,mm-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const addDia = (iso,n) => {const d=new Date(iso+'T12:00');d.setDate(d.getDate()+n);return isoD(d)};
const WK = ['dom','seg','ter','qua','qui','sex','sab'];
const wkOfIso = iso => WK[new Date(iso+'T12:00').getDay()];
const semanaDe = iso => {const d=new Date(iso+'T12:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return isoD(d)};
const semTxt = s => {const d=new Date(s+'T12:00');return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})};
const sum = (a,f=x=>x) => a.reduce((s,x)=>s+(+f(x)||0),0);
const uniq = a => [...new Set(a)];
const num = v => v===''||v==null?null:+v;

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),2800)}
function csv(name,rows){
  const s=rows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(';')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+s],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();
}
function parseCsv(txt){
  txt=txt.replace(/^﻿/,'');
  const sep=(txt.split('\n')[0].match(/;/g)||[]).length>=(txt.split('\n')[0].match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<txt.length;i++){const c=txt[i];
    if(q){if(c==='"'){if(txt[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c==='"')q=true; else if(c===sep){row.push(cur);cur=''} else if(c==='\n'||c==='\r'){if(c==='\r'&&txt[i+1]==='\n')i++;row.push(cur);rows.push(row);row=[];cur=''} else cur+=c}
  if(cur!==''||row.length){row.push(cur);rows.push(row)}
  return rows.filter(r=>r.some(c=>c.trim()!==''));
}
const numBR = s => {s=String(s??'').trim().replace(/[R$\s%]/g,'');if(s==='')return null;if(/,\d{1,2}$/.test(s)||(s.includes(',')&&!s.includes('.')))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');const n=+s;return isNaN(n)?NaN:n};
const dataBR = s => {s=String(s||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return s.slice(0,10);m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return null};

/* ---------------- KPI e animação (original) ---------------- */
function countUp(el,to,f){
  if(!ok_(to)){el.textContent='—';return}
  const t0=performance.now(), dur=1100;
  const step=t=>{const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3); el.textContent=f(to*e); if(p<1) requestAnimationFrame(step)};
  requestAnimationFrame(step);
}
function kpi(lbl,val,f,sub,bar){
  return `<div class="card kpi"><div class="lbl">${lbl}</div><div class="val" data-v="${ok_(val)?val:''}" data-f="${f}">—</div><div class="sub">${sub||''}</div>${bar!=null&&ok_(bar)?`<div class="bar"><i data-w="${Math.max(0,Math.min(100,bar))}"></i></div>`:''}</div>`;
}
const FMTS = {brl, brlK, pct1:v=>nf1.format(v)+'%', int:v=>nf0.format(v), ticket:v=>'R$ '+nf2.format(v), pp:v=>(v>0?'+':'')+nf1.format(v)+' p.p.'};
function animateKpis(root){
  root.querySelectorAll('.val[data-v]').forEach(el=>{const v=el.dataset.v;if(v===''){el.textContent='—';return}countUp(el,+v,FMTS[el.dataset.f])});
  requestAnimationFrame(()=>root.querySelectorAll('.bar i').forEach(i=>i.style.width=i.dataset.w+'%'));
}

/* ---------------- gráficos (configuração original) ---------------- */
const C = {red:'#e5303f',beige:'#eedbca',gold:'#f2b33d',green:'#3fc58e',grid:'rgba(255,236,220,.07)',tick:'#b9aa9e'};
Chart.defaults.color=C.tick; Chart.defaults.font.family=getComputedStyle(document.body).fontFamily; Chart.defaults.font.size=11.5;
Chart.defaults.plugins.legend.labels.usePointStyle=true; Chart.defaults.plugins.legend.labels.boxWidth=8;
Chart.defaults.plugins.tooltip.backgroundColor='rgba(30,23,21,.95)'; Chart.defaults.plugins.tooltip.borderColor='rgba(255,236,220,.15)'; Chart.defaults.plugins.tooltip.borderWidth=1; Chart.defaults.plugins.tooltip.padding=10;
Chart.defaults.maintainAspectRatio=false;
/* nitidez: desenha os gráficos em 2x (ou mais) — fica cristalino em qualquer tela */
Chart.defaults.devicePixelRatio=Math.max(2,window.devicePixelRatio||1);
Chart.defaults.font.weight=500;
Chart.defaults.plugins.tooltip.cornerRadius=10; Chart.defaults.plugins.tooltip.titleFont={weight:700}; Chart.defaults.plugins.tooltip.boxPadding=4;
/* acabamento premium: barras e áreas em degradê, linhas com brilho */
function _rgba(c,a){
  if(typeof c!=='string') return c;
  let m=c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if(m){let h=m[1];if(h.length===3)h=h.split('').map(x=>x+x).join('');const n=parseInt(h,16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
  m=c.match(/^rgba?\(([^,]+),([^,]+),([^,)]+)(?:,([^)]+))?\)$/);
  if(m) return `rgba(${m[1].trim()},${m[2].trim()},${m[3].trim()},${(m[4]!=null?+m[4]:1)*a})`;
  return c;
}
function _grad(chart,base,horiz,a0,a1){
  const {ctx,chartArea:ca}=chart; if(!ca||typeof base!=='string'||!/^(#|rgb)/.test(base)) return base;
  const g=horiz?ctx.createLinearGradient(ca.left,0,ca.right,0):ctx.createLinearGradient(0,ca.bottom,0,ca.top);
  g.addColorStop(0,_rgba(base,a0)); g.addColorStop(1,_rgba(base,a1)); return g;
}
const premiumFx={id:'premiumFx',
  beforeInit(chart){
    const tipo=chart.config.type, horiz=chart.options.indexAxis==='y';
    chart.data.datasets.forEach(ds=>{
      const t=ds.type||tipo;
      if(t==='bar'&&ds.backgroundColor&&!ds._fx){
        const orig=ds.backgroundColor; ds._fx=1;
        if(!ds.hoverBackgroundColor) ds.hoverBackgroundColor=orig;
        ds.backgroundColor=c=>{const b=Array.isArray(orig)?orig[c.dataIndex%orig.length]:(typeof orig==='function'?orig(c):orig);return _grad(c.chart,b,horiz,.55,1)};
      }
      if(t==='line'&&ds.fill&&ds.backgroundColor&&!ds._fx&&typeof ds.backgroundColor==='string'){
        const b=ds.borderColor||ds.backgroundColor; ds._fx=1;
        ds.backgroundColor=c=>{const g=_grad(c.chart,typeof b==='string'?b:ds.backgroundColor,false,0,.32);return g};
      }
    });
  },
  beforeDatasetDraw(chart,args){
    const ds=chart.data.datasets[args.index], t=ds.type||chart.config.type;
    if(t!=='line'||document.body.classList.contains('lite')) return;
    const c=chart.ctx; c.save(); c.shadowColor=_rgba(typeof ds.borderColor==='string'?ds.borderColor:'#e5303f',.55); c.shadowBlur=14; c.shadowOffsetY=4;
  },
  afterDatasetDraw(chart,args){
    const ds=chart.data.datasets[args.index], t=ds.type||chart.config.type;
    if(t!=='line'||document.body.classList.contains('lite')) return;
    chart.ctx.restore();
  }
};
Chart.register(premiumFx);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{Chart.defaults.font.family=getComputedStyle(document.body).fontFamily;Object.values(charts).forEach(c=>{try{c.update('none')}catch(e){}})});
const charts={};
function mk(id,cfg){ if(charts[id]) charts[id].destroy(); const el=document.getElementById(id); el.style.display=''; const ph=el.parentElement.querySelector('.chart-empty'); if(ph) ph.remove(); charts[id]=new Chart(el,cfg); return charts[id]; }
function noData(id,msg){
  if(charts[id]){charts[id].destroy();delete charts[id]}
  const el=document.getElementById(id); el.style.display='none';
  let ph=el.parentElement.querySelector('.chart-empty');
  if(!ph){ph=document.createElement('div');ph.className='empty chart-empty';ph.style.height='100%';ph.style.display='grid';ph.style.placeItems='center';el.parentElement.appendChild(ph)}
  ph.textContent=msg||'Sem dados no período.';
}
const yR = {grid:{color:C.grid},border:{display:false},ticks:{callback:v=>brlK(v)}};
const xG = {grid:{display:false},border:{display:false}};
const tipBrl = {callbacks:{label:c=>' '+c.dataset.label+': '+brl(c.parsed.y)}};
const PAL = ['#d93a48','#c98f2c','#5a8fd8','#2c9f73','#b9aa9e','#c2410c']; // lojas: paleta validada (contraste, daltonismo) no fundo escuro
const yPct = {grid:{color:C.grid},border:{display:false},ticks:{callback:v=>nf1.format(v)+'%'}};
const tipPct = {callbacks:{label:c=>' '+c.dataset.label+': '+nf1.format(c.parsed.y)+'%'}};

/* ---------------- estado ---------------- */
const S = { user:null, perfil:null, minhas:[], mes:ymOf(isoHoje()), db:{}, tab:'geral' };
const TABLES = {
  lojas:{order:'ordem'}, config:{}, metas:{order:'vigente_desde'}, metas_vendas:{}, dre_premissas_loja:{},
  vendas_diarias:{order:'data'}, vendas_hora:{order:'data',lazy:true}, indicadores_mensais:{}, cmv_contagens:{order:'semana'}, cmv_itens:{order:'semana'},
  estoque_cc:{order:'item'}, rupturas:{order:'data'}, dre_lancamentos:{}, orc_cenarios:{order:'created_at'}, expansao:{order:'ordem'},
  colaboradores:{order:'nome'}, colaboradores_folha:{}, quadro_previsto:{}, vagas:{order:'created_at'}, lideranca:{}, rh_movimentos:{order:'mes'}, ocorrencias:{order:'data'},
  avaliacoes_gerentes:{order:'periodo'}, visitas_qualidade:{order:'data'}, delivery_checklists:{order:'data'}, planos_acao:{order:'created_at'},
  ninebox_historico:{order:'em'}, alertas:{order:'criado_em'}, alertas_lidos:{},
  ifood_diario:{order:'data'}, notas_fiscais:{order:'emissao'}, itens_controle:{order:'ordem'}, producao_padrao:{order:'ordem'}, nf_regras:{}, contagens_estoque:{order:'created_at'}
};
function busy(on){const l=$('#loading');if(on){l.classList.add('on');l.style.width='70%'}else{l.style.width='100%';setTimeout(()=>{l.classList.remove('on');l.style.width='0'},300)}}
async function fetchAll(t){
  const o=TABLES[t]||{}; let out=[], from=0; const page=1000;
  for(;;){
    let q=sb.from(t).select('*').range(from,from+page-1);
    if(o.order) q=q.order(o.order,{ascending:true});
    const {data,error}=await q; if(error){console.warn(t,error.message);return out}
    out=out.concat(data); if(data.length<page) break; from+=page;
  }
  return out;
}
async function load(ts){
  busy(true);
  const list=ts?ts.filter(t=>!(TABLES[t]||{}).lazy):Object.keys(TABLES).filter(t=>!TABLES[t].lazy);
  if(ts&&ts.includes('vendas_hora')){HORA_MESES.clear();S.db.vendas_hora=[]}
  const res=await Promise.all(list.map(fetchAll));
  list.forEach((t,i)=>S.db[t]=res[i]);
  indexar(); busy(false);
}
/* grava e devolve erro amigável */
async function dbw(promise,okMsg){
  busy(true);
  const {data,error}=await promise; busy(false);
  if(error){
    const m=error.message||'';
    toast(/row-level security|permission|42501/i.test(m)?'Sem permissão para esta alteração.':/duplicate|unique/i.test(m)?'Já existe um registro igual.':/violates check/i.test(m)?'Valor fora do permitido.':'Não foi possível salvar: '+m);
    return null;
  }
  if(okMsg) toast(okMsg);
  return data||true;
}

/* ---------------- configurações ---------------- */
const cfg = k => {const r=(S.db.config||[]).find(x=>x.chave===k);return r?r.valor:null};

/* ---------------- lojas e permissões ---------------- */
let LOJAS=[], OPER=[], LBYID={};
const lojaNome = id => (LBYID[id]||{}).nome||id;
const P = {
  get papel(){return S.perfil&&S.perfil.ativo?S.perfil.papel:null},
  get admin(){return ['admin','diretoria'].includes(this.papel)},
  get gestor(){return ['admin','consultor','diretoria'].includes(this.papel)},
  get veTudo(){return ['admin','consultor','diretoria'].includes(this.papel)},
  editar(l){return this.gestor||(['regional','gerente'].includes(this.papel)&&S.minhas.includes(l))},
  operar(l){return this.editar(l)||(this.papel==='colaborador'&&S.minhas.includes(l))},
  excluir(l){return this.gestor||(this.papel==='regional'&&S.minhas.includes(l))},
  get veRH(){return !!this.papel&&this.papel!=='colaborador'},
  get veFolha(){return this.veTudo},
  aprovaVaga(l){return this.gestor||(!!l&&this.papel==='regional'&&S.minhas.includes(l))},
  veOco(l){return this.gestor||(['regional','gerente'].includes(this.papel)&&S.minhas.includes(l))},
  get editaCC(){return ['admin','consultor','diretoria','regional'].includes(this.papel)},
};
const lojasEditaveis = (soOper) => LOJAS.filter(l=>P.editar(l.id)&&(!soOper||l.status==='operando'));
const lojasOperaveis = () => LOJAS.filter(l=>P.operar(l.id));
const optLojas = (ls,sel) => ls.map(l=>`<option value="${l.id}" ${l.id===sel?'selected':''}>${esc(l.nome)}</option>`).join('');

/* ---------------- índices ---------------- */
let IDX={};
function indexar(){
  LOJAS=(S.db.lojas||[]).slice().sort((a,b)=>a.ordem-b.ordem||a.nome.localeCompare(b.nome));
  OPER=LOJAS.filter(l=>l.status==='operando');
  LBYID=Object.fromEntries(LOJAS.map(l=>[l.id,l]));
  IDX.vd=new Map((S.db.vendas_diarias||[]).map(r=>[r.loja_id+'|'+r.data,r]));
  IDX.mv=new Map((S.db.metas_vendas||[]).map(r=>[r.loja_id+'|'+r.mes,+r.valor]));
  IDX.im=new Map((S.db.indicadores_mensais||[]).map(r=>[r.loja_id+'|'+r.mes,r]));
  IDX.rh=new Map((S.db.rh_movimentos||[]).map(r=>[r.loja_id+'|'+r.mes,r]));
  IDX.dl=new Map((S.db.dre_lancamentos||[]).map(r=>[r.loja_id+'|'+r.mes+'|'+r.linha,r]));
  IDX.prem=Object.fromEntries((S.db.dre_premissas_loja||[]).map(r=>[r.loja_id,r.valores||{}]));
  CACHE={};
}
let CACHE={};
/* vendas por hora: buscadas por mês, sob demanda */
const HORA_MESES=new Set();
async function garantirHora(ini,fim){
  const ms=[];for(let m=ymOf(ini);m<=ymOf(fim);m=addMes(m,1))if(!HORA_MESES.has(m))ms.push(m);
  if(!ms.length)return false;
  busy(true);
  for(const m of ms){let from=0;for(;;){const {data,error}=await sb.from('vendas_hora').select('*').gte('data',iniMes(m)).lte('data',fimMes(m)).order('data').range(from,from+999);if(error)break;S.db.vendas_hora=(S.db.vendas_hora||[]).concat(data);if(data.length<1000)break;from+=1000}HORA_MESES.add(m)}
  busy(false);return true;
}

/* ---------------- metas ---------------- */
const METAS_DEF = [
  {k:'fat',     g:'Comercial', n:'Faturamento por loja', f:'brl', fr:'Diário'},
  {k:'pctMeta', g:'Comercial', n:'Vendas versus meta', f:'pct0', fr:'Diário'},
  {k:'comp',    g:'Comercial', n:'Comp', f:'pctS', fr:'Semanal'},
  {k:'cmv',     g:'Financeiro', n:'CMV', f:'pct1', fr:'Semanal'},
  {k:'pessoal', g:'Financeiro', n:'Custo de pessoal', f:'pct1', fr:'Mensal'},
  {k:'preparo', g:'Delivery e qualidade', n:'Tempo de preparo', f:'min', fr:'Diário'},
  {k:'cancel',  g:'Delivery e qualidade', n:'Cancelamentos', f:'pct1', fr:'Diário'},
  {k:'ifood',   g:'Delivery e qualidade', n:'Nota iFood', f:'nota', fr:'Diário'},
  {k:'online',  g:'Delivery e qualidade', n:'Tempo online', f:'pct1', fr:'Diário'},
  {k:'rupturas',g:'Delivery e qualidade', n:'Rupturas por semana', f:'int', fr:'Semanal'},
  {k:'absent',  g:'Pessoas', n:'Absenteísmo', f:'pct1', fr:'Semanal'},
  {k:'turnover',g:'Pessoas', n:'Turnover', f:'pct1', fr:'Mensal'},
];
const META_EXTRA_DEF = {k:'qualidade', g:'Delivery e qualidade', n:'Nota da visita de qualidade', f:'pct0'};
const METAS_EXTRA = {
  'Comercial':[['Traffic','evolução positiva dos pedidos comparáveis'],['Ticket médio e conversão','evolução positiva']],
  'Financeiro':[['Margem operacional','por unidade'],['Custo de delivery','por pedido']],
  'Delivery e qualidade':[],
  'Pessoas':[['Produtividade','semanal'],['Desenvolvimento dos gestores','mensal']]
};
function metaRow(k,loja,mes){
  const lim=fimMes(mes), rs=(S.db.metas||[]).filter(m=>m.indicador===k&&m.vigente_desde<=lim);
  const pick=a=>a.sort((x,y)=>y.vigente_desde.localeCompare(x.vigente_desde)||y.id-x.id)[0];
  return (loja&&pick(rs.filter(m=>m.loja_id===loja)))||pick(rs.filter(m=>m.loja_id==null))||null;
}
function metaTxt(d,meta,t){
  if(meta==null) return d.fr==='Mensal'?'acompanhamento mensal':'acompanhamento semanal';
  const v=+meta;
  switch(d.f){
    case 'brl': return (t==='min'?'acima de ':'até ')+brlK(v)+'/mês';
    case 'pctS': return (t==='min'?'':'até ')+(v>0?'+':'')+nf1.format(v).replace(',0','')+'%';
    case 'min': return (t==='min'?'pelo menos ':'até ')+nf1.format(v).replace(',0','')+' minutos';
    case 'int': return (t==='min'?'pelo menos ':'até ')+nf0.format(v)+' por semana';
    case 'nota': return (t==='min'?'pelo menos ':'até ')+nf1.format(v);
    default: return (t==='min'?'pelo menos ':'até ')+nf1.format(v).replace(',0','')+'%';
  }
}
/* lista de metas aplicável à loja (ou rede) no mês, no formato do painel original */
function METAS(loja,mes=S.mes){
  return METAS_DEF.map(d=>{const r=metaRow(d.k,loja,mes);const meta=r&&r.valor!=null?+r.valor:null;const t=r?r.direcao:null;return Object.assign({},d,{meta,t,txt:metaTxt(d,meta,t)})});
}
const metaQual = (loja,mes=S.mes) => {const r=metaRow('qualidade',loja,mes);return r&&r.valor!=null?+r.valor:90};
const pisoLoja = (mes=S.mes) => {const r=metaRow('fat',null,mes);return r&&r.valor!=null?+r.valor:+(cfg('piso_loja')||500000)};

function status(m,v){
  if(m.meta==null||v==null||isNaN(v)) return 'neu';
  const ok = m.t==='min'? v>=m.meta : v<=m.meta; if(ok) return 'ok';
  const off = m.t==='min'? (m.meta-v)/Math.abs(m.meta||1) : (v-m.meta)/Math.abs(m.meta||1);
  return off<=.10?'warn':'bad';
}

/* ---------------- cálculo mensal por loja ---------------- */
const pesoDia = () => cfg('peso_dia_semana')||{seg:1,ter:1,qua:1,qui:1,sex:1,sab:1,dom:1};
function diasDoMes(m){const n=diasNoMes(m);return Array.from({length:n},(_,i)=>m+'-'+String(i+1).padStart(2,'0'))}
/* meta de um dia = meta do mês × peso do dia da semana ÷ soma dos pesos do mês (regra do painel original) */
function metaDiaLoja(loja,iso){
  const m=ymOf(iso), mm=IDX.mv.get(loja+'|'+m); if(mm==null) return null;
  const pw=pesoDia(), k='sp|'+m; if(CACHE[k]==null) CACHE[k]=sum(diasDoMes(m),d=>pw[wkOfIso(d)]);
  return mm*pw[wkOfIso(iso)]/CACHE[k];
}
const cmvRealR = r => (+r.estoque_inicial)+(+r.compras)+(+r.transf_entrada||0)-(+r.transf_saida||0)-(+r.devolucoes||0)-(+r.estoque_final);
const cmvReal = r => cmvRealR(r)/(+r.vendas)*100;
const turnOf = r => (r.admissoes+r.desligamentos)/2/r.headcount*100;
const absOf = r => r.faltas/r.dias_previstos*100;

function lojaStats(id,mes=S.mes){
  const key='st|'+id+'|'+mes; if(CACHE[key]) return CACHE[key];
  const ds=diasDoMes(mes);
  const dias=ds.map(d=>{const r=IDX.vd.get(id+'|'+d);return r?[+r.salao,+r.delivery,+r.pedidos_salao,+r.pedidos_delivery]:[0,0,0,0]});
  const nReg=ds.filter(d=>IDX.vd.has(id+'|'+d)).length;
  const sal=sum(dias,d=>d[0]), del=sum(dias,d=>d[1]), ps=sum(dias,d=>d[2]), pd=sum(dias,d=>d[3]);
  const fat=sal+del, meta=IDX.mv.get(id+'|'+mes)??null;
  const temVenda=nReg>0;
  const ind={}, src={};
  // delivery e qualidade: média dos checklists de delivery do mês; na falta, lançamento manual do mês
  const chk=(S.db.delivery_checklists||[]).filter(c=>c.loja_id===id&&ymOf(c.data)===mes);
  const man=IDX.im.get(id+'|'+mes)||{};
  // iFood (integração ou relatório importado) tem prioridade: é o dado medido pela plataforma
  const ifd=(S.db.ifood_diario||[]).filter(r=>r.loja_id===id&&ymOf(r.data)===mes);
  if(ifd.length){const R=ifResumo(ifd), t=`iFood · ${ifd.length} dia${ifd.length>1?'s':''}`;
    [['preparo',R.preparo],['cancel',R.cancel],['ifood',R.nota],['online',R.online]].forEach(([k,v])=>{if(v!=null){ind[k]=v;src[k]=t}})}
  ['preparo','cancel','ifood','online'].forEach(k=>{
    if(ind[k]!=null) return;
    const vs=chk.map(c=>c.metas&&c.metas[k]).filter(v=>v!=null&&v!=='').map(Number);
    if(vs.length){ind[k]=sum(vs)/vs.length;src[k]=`média de ${vs.length} checklist${vs.length>1?'s':''} de delivery`}
    else if(man[k]!=null){ind[k]=+man[k];src[k]='indicador lançado no mês'}
  });
  // rupturas por semana: registros da cozinha central ÷ semanas decorridas no mês
  const hoje=isoHoje(), ini=iniMes(mes), fim=fimMes(mes);
  const diasDec = hoje<ini?0:hoje>fim?ds.length:+hoje.slice(8,10);
  const rup=(S.db.rupturas||[]).filter(r=>r.loja_id===id&&r.data>=ini&&r.data<=fim);
  const sem=Math.max(1,diasDec/7);
  if(rup.length){ind.rupturas=rup.length/sem;src.rupturas=`${rup.length} rupturas registradas ÷ ${nf1.format(sem)} semanas`}
  else{const vs=chk.map(c=>c.metas&&c.metas.rupturas).filter(v=>v!=null&&v!=='').map(Number);
    if(vs.length){ind.rupturas=sum(vs)/vs.length;src.rupturas='checklists de delivery'}
    else if(diasDec>0&&(S.db.rupturas||[]).some(r=>r.data>=ini&&r.data<=fim)){ind.rupturas=0;src.rupturas='nenhuma ruptura registrada no mês'}}
  // CMV: contagens semanais do mês, ponderadas pelas vendas
  const cm=(S.db.cmv_contagens||[]).filter(r=>r.loja_id===id&&ymOf(r.semana)===mes);
  // fechamento oficial do DRE (faturamento) vale como base quando existe
  const fOf=IDX.dl.get(id+'|'+mes+'|fat'), baseFat=fOf&&+fOf.valor>0?+fOf.valor:fat, baseTxt=fOf?'faturamento do fechamento oficial':'vendas lançadas';
  if(cm.length){ind.cmv=sum(cm,cmvRealR)/sum(cm,r=>r.vendas)*100;src.cmv=`${cm.length} contage${cm.length>1?'ns':'m'} semanais`}
  else{const dc=IDX.dl.get(id+'|'+mes+'|cmv');if(dc&&baseFat>0){ind.cmv=+dc.valor/baseFat*100;src.cmv=`CMV do DRE ÷ ${baseTxt}`}}
  // pessoal: folha lançada no DRE ou nos indicadores ÷ faturamento
  const fl=IDX.dl.get(id+'|'+mes+'|folha');
  const folhaR=fl?+fl.valor:(man.folha_valor!=null?+man.folha_valor:null);
  if(folhaR!=null&&baseFat>0){ind.pessoal=folhaR/baseFat*100;src.pessoal=(fl?'folha lançada no DRE':'folha lançada nos indicadores')+' ÷ '+baseTxt}
  // comp: mesmo período do ano anterior (dias com venda lançada), senão o manual
  const py=addMes(mes,-12); let fPY=0,fCY=0,nPY=0;
  ds.forEach(d=>{const r=IDX.vd.get(id+'|'+d), rp=IDX.vd.get(id+'|'+py+d.slice(7));if(r&&rp){fCY+=+r.salao+ +r.delivery;fPY+=+rp.salao+ +rp.delivery;nPY++}});
  if(nPY&&fPY>0){ind.comp=(fCY/fPY-1)*100;src.comp=`${nPY} dias comparáveis com ${mesTxt(py)}`}
  else if(man.comp!=null){ind.comp=+man.comp;src.comp='lançado manualmente'}
  // pessoas
  const rh=IDX.rh.get(id+'|'+mes);
  if(rh){ind.turnover=turnOf(rh);ind.absent=absOf(rh);src.turnover=src.absent='lançamento mensal de RH'}
  const vals=Object.assign({fat:temVenda?fat:null,pctMeta:temVenda&&meta?fat/meta*100:null},ind);
  src.fat=src.pctMeta=temVenda?`${nReg} dias de venda lançados`:'sem vendas lançadas';
  const st={sal,del,ps,pd,fat,ped:ps+pd,ticket:(ps+pd)?fat/(ps+pd):null,meta,pctMeta:vals.pctMeta,dias,nReg,temVenda,vals,src,ind};
  return CACHE[key]=st;
}
const ST = new Proxy({},{get:(_,id)=>lojaStats(id)});

/* ---------------- DRE (fórmulas do painel original) ---------------- */
/* calcula um DRE mensal. cmv, folha e demais % sobre o faturamento bruto; valores realizados (R$) substituem a estimativa */
function dreCalc(o){
  const fat=o.fat, del=o.fatDel, sal=del==null?null:fat-del, R=o.real||{};
  const imp=R.imp??fat*o.impostos/100, cmv=R.cmv??(o.cmvR!=null?o.cmvR:fat*o.cmv/100), folha=R.folha??(o.folhaR!=null?o.folhaR:fat*o.folha/100);
  const baseDel = o.deliveryBase==='total'||del==null?fat:del;
  const cdel=R.cdel??baseDel*o.delivery/100, man=R.man??fat*o.manutencao/100, mkt=R.mkt??fat*o.marketing/100;
  const cto=R.cto??o.cto, agua=R.agua??o.agua, energia=R.energia??o.energia;
  const fixos=cto+agua+energia;
  const res=fat-imp-cmv-folha-cdel-man-mkt-fixos;
  const varPct=fat?(imp+cmv+cdel+man+mkt)/fat:0;
  const pe=(folha+fixos)/(1-varPct);
  return {fat,sal,del,imp,rl:fat-imp,cmv,folha,cdel,man,mkt,cto,agua,energia,res,mg:fat?res/fat*100:null,pe,varPct,est:o.est||{},oficial:!!o.oficial};
}
const DRE_LINES = [
  ['fat','Faturamento bruto','tot'],['sal','Salão','sub'],['del','Delivery','sub'],
  ['imp','(-) Impostos','neg'],['rl','= Receita líquida','tot'],
  ['cmv','(-) CMV','neg'],['folha','(-) Folha de pagamento','neg'],['cdel','(-) Custos de delivery','neg'],
  ['man','(-) Manutenção','neg'],['mkt','(-) Marketing, royalties, escritório e fundo de propaganda','neg'],
  ['cto','(-) CTO (custo total de ocupação)','neg'],['agua','(-) Água','neg'],['energia','(-) Energia','neg'],
  ['res','= Resultado operacional','res']
];
const dreBase = () => Object.assign({impostos:10,delivery:28,deliveryBase:'delivery',manutencao:1.5,marketing:7,cto:12000,agua:1500,energia:4500,cmv:21,pessoal:19},cfg('dre')||{});
/* DRE da loja no mês: realizado quando lançado; CMV pela contagem; folha pelo lançamento; o resto pela premissa (marcado como estimado) */
function lojaDre(id,mes=S.mes){
  const s=lojaStats(id,mes), P0=Object.assign({},dreBase(),IDX.prem[id]||{});
  const real={}, est={};
  ['imp','cmv','folha','cdel','man','mkt','cto','agua','energia'].forEach(k=>{const r=IDX.dl.get(id+'|'+mes+'|'+k);if(r)real[k]=+r.valor;else est[k]=true});
  let cmvR=null; if(real.cmv==null&&s.ind.cmv!=null){cmvR=s.fat*s.ind.cmv/100;est.cmv=false}
  let folhaR=null; const man=IDX.im.get(id+'|'+mes); if(real.folha==null&&man&&man.folha_valor!=null){folhaR=+man.folha_valor;est.folha=false}
  // faturamento oficial do fechamento (lançado no DRE) substitui a soma das vendas; sem a divisão salão/delivery no fechamento, ela fica em branco
  const fo=IDX.dl.get(id+'|'+mes+'|fat'), fd=IDX.dl.get(id+'|'+mes+'|fat_del');
  const fat=fo?+fo.valor:s.fat, fatDel=fo?(fd?+fd.valor:null):s.del;
  return dreCalc(Object.assign({},P0,{fat,fatDel,folha:P0.pessoal,cmvR,folhaR,real,est,oficial:!!fo}));
}

/* ---------------- RH ---------------- */
const CARGOS=['Gerente de loja','Líder de turno','Cozinheiro','Auxiliar de cozinha','Expedidor','Estoque e apoio'];
const SETORES={escritorio:'Matriz · Escritório',producao:'Matriz · Produção'};
const unidadeNome = p => p.loja_id?lojaNome(p.loja_id):(SETORES[p.setor]||'Matriz');
const LV=['','Baixo','Médio','Alto'];
const ativo = p => !p.desligamento || p.desligamento>isoHoje();
const people = () => (S.db.colaboradores||[]).filter(ativo);
const mesesCasa = (adm,ref) => {if(!adm)return null;const a=new Date(adm+'T12:00'), h=ref?new Date(ref+'T12:00'):new Date(); return Math.max(0,(h.getFullYear()-a.getFullYear())*12+h.getMonth()-a.getMonth())};
const casaTxt = m => m==null||isNaN(m)?'—':m<12?`${m} ${m===1?'mês':'meses'}`:`${nf1.format(m/12).replace(',0','')} ${m<24?'ano':'anos'}`;

/* ---------------- relatório (impressão / PDF) ---------------- */
function relatorio(titulo,blocos,opts={}){
  const lojas=opts.lojas||LOJAS.map(l=>l.nome);
  const w=window.open('','_blank'); if(!w){toast('Permita pop-ups para gerar o relatório.');return}
  const tbl=b=>`<h2>${esc(b.t)}</h2>${b.p?`<p class="p">${esc(b.p)}</p>`:''}${b.cab?`<table><thead><tr>${b.cab.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.linhas.length?b.linhas.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${b.cab.length}" class="e">Sem registros no período.</td></tr>`}</tbody></table>`:''}`;
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)} · Fat Buddha</title><style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#1d1715;margin:28px;font-size:12px}
  header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #e5303f;padding-bottom:12px;margin-bottom:14px}
  header img{width:54px;height:54px;border-radius:50%}h1{font-size:20px;margin:0}header span{color:#6b5d54}
  .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.meta div{background:#f6efe9;border-radius:8px;padding:8px 10px}.meta b{display:block;font-size:10px;color:#8a7c72;text-transform:uppercase;letter-spacing:.5px}
  h2{font-size:14px;margin:18px 0 6px;color:#c41e2d}.p{color:#6b5d54;margin:0 0 6px}
  table{width:100%;border-collapse:collapse;margin-bottom:6px}th{background:#1d1715;color:#fff;text-align:left;padding:6px 8px;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #eadfd6}tr:nth-child(even) td{background:#fbf7f4}.e{color:#8a7c72;text-align:center}
  footer{margin-top:20px;color:#8a7c72;font-size:10.5px;border-top:1px solid #eadfd6;padding-top:8px}
  @media print{body{margin:12mm}button{display:none}}
  </style></head><body>
  <header><img src="${location.origin}${location.pathname.replace(/[^/]*$/,'')}logo.png"><div><h1>${esc(titulo)}</h1><span>Fat Buddha | Rice &amp; Deli · Portal Operacional</span></div><button style="margin-left:auto;padding:8px 14px" onclick="print()">Imprimir / salvar PDF</button></header>
  <div class="meta"><div><b>Cliente</b>Fat Buddha</div><div><b>Período</b>${esc(opts.periodo||mesLongo(S.mes))}</div><div><b>Lojas incluídas</b>${esc(lojas.join(', ')||'—')}</div><div><b>Gerado em</b>${new Date().toLocaleString('pt-BR')} · ${esc(S.perfil.nome||S.perfil.email)}</div></div>
  ${blocos.map(tbl).join('')}
  <footer>Origem dos dados: ${esc(opts.origem||'lançamentos registrados no portal')}. Valores calculados a partir dos registros salvos no banco do portal no momento da geração.</footer>
  </body></html>`);
  w.document.close();
}

/* ---------------- modal simples ---------------- */
function modal(html,onOpen){const m=$('#modal');$('#modalBody').innerHTML=html;m.classList.remove('hidden');m.onclick=e=>{if(e.target===m)fecharModal()};if(onOpen)onOpen($('#modalBody'))}
function fecharModal(){$('#modal').classList.add('hidden')}
/* pergunta em janela no visual do portal (substitui prompt do navegador) */
function pedir(titulo,rotulo,{valor='',tipo='text',placeholder='',ok='Salvar',ajuda=''}={}){
  return new Promise(res=>{
    modal(`<h3>${esc(titulo)}</h3><label class="f">${esc(rotulo)}<input class="inp" id="pdIn" type="${tipo}" value="${esc(valor)}" placeholder="${esc(placeholder)}"></label>${ajuda?`<p class="small muted" style="margin-top:8px">${esc(ajuda)}</p>`:''}
      <div class="actions mt"><button class="btn" id="pdNo">Cancelar</button><button class="btn pri" id="pdOk">${esc(ok)}</button></div>`,el=>{
      const i=el.querySelector('#pdIn'); setTimeout(()=>i.focus(),50);
      const fim=v=>{fecharModal();res(v)};
      el.querySelector('#pdOk').onclick=()=>fim(i.value); el.querySelector('#pdNo').onclick=()=>fim(null);
      i.onkeydown=e=>{if(e.key==='Enter')fim(i.value);if(e.key==='Escape')fim(null)};
    });
    $('#modal').onclick=e=>{if(e.target===$('#modal')){fecharModal();res(null)}};
  });
}
