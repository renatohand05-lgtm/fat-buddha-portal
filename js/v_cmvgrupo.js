/* ================= CMV · visão do grupo (cards de análise) ================= */
// mini gráfico em SVG: real (linha cheia), teórico (tracejado), meta (linha fina); hover por ponto
function cmgSpark(real,teo,meta,cor,labels,w=260,h=64){
  const vals=real.concat(teo,[meta]).filter(v=>v!=null);if(!vals.length)return '<div class="small muted">sem histórico</div>';
  let lo=Math.min(...vals),hi=Math.max(...vals);const pad=Math.max(.4,(hi-lo)*.15);lo-=pad;hi+=pad;
  const n=real.length, X=i=>n<2?w/2:4+i*(w-8)/(n-1), Y=v=>h-4-(v-lo)/(hi-lo)*(h-8);
  const path=a=>{let d='',pen=false;a.forEach((v,i)=>{if(v==null){pen=false;return}d+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)+' ';pen=true});return d};
  const li=real.map((v,i)=>v==null?-1:i).filter(i=>i>=0).at(-1);
  return `<svg class="cmg-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="CMV semanal">
    <line x1="0" x2="${w}" y1="${Y(meta).toFixed(1)}" y2="${Y(meta).toFixed(1)}" stroke="rgba(255,236,220,.28)" stroke-width="1" stroke-dasharray="2 3"/>
    <path d="${path(teo)}" fill="none" stroke="rgba(255,236,220,.45)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="${path(real)}" fill="none" stroke="${cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${li!=null&&li>=0?`<circle cx="${X(li).toFixed(1)}" cy="${Y(real[li]).toFixed(1)}" r="4" fill="${cor}" stroke="#1d1715" stroke-width="2"/>`:''}
    ${real.map((v,i)=>v==null?'':`<rect x="${(X(i)-w/n/2).toFixed(1)}" y="0" width="${(w/n).toFixed(1)}" height="${h}" fill="transparent"><title>${labels[i]} · real ${nf1.format(v)}%${teo[i]!=null?' · teórico '+nf1.format(teo[i])+'%':''}</title></rect>`).join('')}
  </svg>`;
}
// barra de leitura: escala de CMV com faixa até a meta, marcador do teórico e o real
function cmgBullet(real,teo,meta){
  if(real==null)return '';
  const lo=Math.floor(Math.min(real,teo??real,meta)-2), hi=Math.ceil(Math.max(real,teo??real,meta)+2), P=v=>Math.max(0,Math.min(100,(v-lo)/(hi-lo)*100));
  const st=real<=meta?'ok':real<=meta+1?'warn':'bad';
  return `<div class="cmg-bullet" title="Real ${nf1.format(real)}% · teórico ${teo!=null?nf1.format(teo)+'%':'—'} · meta até ${nf1.format(meta)}%">
    <div class="cmg-b-zone" style="width:${P(meta)}%"></div>
    <div class="cmg-b-real s-${st}" style="width:${P(real)}%"></div>
    ${teo!=null?`<div class="cmg-b-teo" style="left:${P(teo)}%"></div>`:''}
    <div class="cmg-b-meta" style="left:${P(meta)}%"></div>
  </div><div class="cmg-b-scale"><span>${lo}%</span><span>meta ${nf1.format(meta).replace(',0','')}%</span><span>${hi}%</span></div>`;
}
const cmgDelta=(d,un=' p.p.')=>d==null||isNaN(d)?'<span class="muted">—</span>':`<span class="cmg-delta ${Math.abs(d)<0.05?'eq':d>0?'up':'down'}">${Math.abs(d)<0.05?'=':d>0?'▲':'▼'} ${nf1.format(Math.abs(d))}${un}</span>`;
let CMG_EXTRA={ref:null,perdas:{},ctl:{}};
function renderCmvGrupo(reg,sems,lojas,metaCmv){
  const last=sems.at(-1), prev=sems.at(-2), mesRef=last?last.slice(0,7):S.mes;
  const w=s=>reg.filter(r=>r.semana===s), rede=s=>{const x=w(s),v=sum(x,r=>r.vendas);return v?{v,real:sum(x,cmvRealR)/v*100,teo:sum(x,r=>r.vendas*r.cmv_teorico/100)/v*100,perda:sum(x,r=>cmvRealR(r)-r.vendas*r.cmv_teorico/100)}:null};
  const R=last?rede(last):null, Rp=prev?rede(prev):null, labs=sems.map(semTxt);
  const semMes=sems.filter(s=>s.slice(0,7)===mesRef), perdaMes=sum(semMes,s=>(rede(s)||{}).perda), perda12=sum(sems,s=>(rede(s)||{}).perda);
  const st=R?(R.real<=metaCmv?'ok':R.real<=metaCmv+1?'warn':'bad'):'neu';
  const stTxt={ok:'Na meta',warn:'Perto da meta',bad:'Acima da meta',neu:'Sem contagem'}[st];
  const serie=sems.map(s=>{const r=rede(s);return r?r.real:null}), serieT=sems.map(s=>{const r=rede(s);return r?r.teo:null});
  const mAc=serie.filter(v=>v!=null&&v>metaCmv).length;
  $('#cmgHero').innerHTML=!R?'<div class="empty">Nenhuma contagem semanal lançada até este mês.</div>':`
    <div class="cmg-hero-l">
      <div class="cmg-eyebrow">${lojas.length===1?"CMV real · "+esc(lojaNome(lojas[0])):"CMV real do grupo"} · semana de ${semTxt(last)}</div>
      <div class="cmg-big">${nf1.format(R.real)}<small>%</small> <span class="sem s-${st}">${stTxt}</span></div>
      <div class="cmg-sub">${cmgDelta(Rp?R.real-Rp.real:null)} vs semana anterior · teórico ${nf1.format(R.teo)}% · dispersão <b>${R.real-R.teo>0?'+':''}${nf1.format(R.real-R.teo)} p.p.</b></div>
      ${cmgBullet(R.real,R.teo,metaCmv)}
    </div>
    <div class="cmg-hero-c">${cmgSpark(serie,serieT,metaCmv,'#f7eee6',labs,420,96)}
      <div class="cmg-legend"><span><i style="background:#f7eee6"></i>Real</span><span><i class="dash"></i>Teórico</span><span><i class="dot"></i>Meta ${nf1.format(metaCmv).replace(',0','')}%</span><span class="muted">${sems.length} semanas · ${mAc} acima da meta</span></div></div>
    <div class="cmg-hero-r">
      <div class="cmg-stat"><span>Acima do teórico na semana</span><b class="${R.perda>0?'neg':'pos'}">${brl(R.perda)}</b></div>
      <div class="cmg-stat"><span>No mês (${mesTxt(mesRef)})</span><b class="${perdaMes>0?'neg':'pos'}">${brl(perdaMes)}</b></div>
      <div class="cmg-stat"><span>Últimas ${sems.length} semanas</span><b class="${perda12>0?'neg':'pos'}">${brl(perda12)}</b></div>
      <div class="cmg-stat"><span>Vendas da semana</span><b>${brlK(R.v)}</b></div>
    </div>`;
  // cards por loja
  const lw=lojas.map(id=>{const r=reg.find(x=>x.loja_id===id&&x.semana===last), rp=reg.find(x=>x.loja_id===id&&x.semana===prev);
    const se=sems.map(s=>{const x=reg.find(y=>y.loja_id===id&&y.semana===s);return x?cmvReal(x):null}), st_=sems.map(s=>{const x=reg.find(y=>y.loja_id===id&&y.semana===s);return x?+x.cmv_teorico:null});
    let seq=0;for(let i=se.length-1;i>=0&&se[i]!=null&&se[i]>metaCmv;i--)seq++;
    return {id,r,real:r?cmvReal(r):null,teo:r?+r.cmv_teorico:null,perda:r?cmvRealR(r)-r.vendas*r.cmv_teorico/100:null,d:r&&rp?cmvReal(r)-cmvReal(rp):null,se,st_,seq,ac:se.filter(v=>v!=null&&v>metaCmv).length,n:se.filter(v=>v!=null).length,cor:PAL[LOJAS.findIndex(l=>l.id===id)%PAL.length]}});
  const rank=lw.filter(x=>x.real!=null).sort((a,b)=>a.real-b.real).map(x=>x.id);
  $('#cmgLojas').innerHTML=lw.map(x=>{const s=x.real==null?'neu':x.real<=metaCmv?'ok':x.real<=metaCmv+1?'warn':'bad', disp=x.real!=null?x.real-x.teo:null, pos=rank.indexOf(x.id);
    return `<div class="card cmg-loja" style="--cor:${x.cor}">
      <div class="cmg-l-head"><span class="cmg-dot"></span><b>${esc(lojaNome(x.id))}</b>${pos>=0?`<span class="cmg-rank" title="Posição no grupo (menor CMV)">${pos+1}º</span>`:''}</div>
      ${x.real==null?'<div class="empty" style="padding:18px 0">Sem contagem nesta semana.</div>':`
      <div class="cmg-l-big">${nf1.format(x.real)}<small>%</small><span class="sem s-${s}">${{ok:'Na meta',warn:'Perto',bad:'Acima'}[s]}</span></div>
      <div class="cmg-sub">${cmgDelta(x.d)} vs semana anterior</div>
      ${cmgBullet(x.real,x.teo,metaCmv)}
      ${cmgSpark(x.se,x.st_,metaCmv,x.cor,labs)}
      <div class="cmg-l-grid">
        <div><span>Teórico</span><b>${nf1.format(x.teo)}%</b></div>
        <div><span>Dispersão</span><b class="${disp>CM_TOL?'neg':''}">${disp>0?'+':''}${nf1.format(disp)} p.p.</b></div>
        <div><span>Acima do teórico</span><b class="${x.perda>0?'neg':'pos'}">${brl(x.perda)}</b></div>
        <div><span>Semanas acima da meta</span><b>${x.ac} de ${x.n}${x.seq>=2?` <em class="neg">· ${x.seq} seguidas</em>`:''}</b></div>
        <div><span>Perdas registradas (${mesTxt(mesRef)})</span><b data-cmgp="${x.id}">…</b></div>
        <div><span>Controle diário com diferença</span><b data-cmgc="${x.id}">…</b></div>
      </div>`}
    </div>`}).join('')||'<div class="card"><div class="empty">Nenhuma loja com contagem.</div></div>';
  // destaques
  const com=lw.filter(x=>x.real!=null), its=(S.db.cmv_itens||[]), ultI=uniq(its.map(i=>i.semana)).sort().at(-1);
  const crit=its.filter(i=>i.semana===ultI&&i.teorico>0).map(i=>({...i,d:(i.real-i.teorico)/i.teorico*100})).sort((a,b)=>b.d-a.d).slice(0,3);
  const D=[];
  if(com.length){const b=com.slice().sort((a,b)=>a.real-b.real)[0], wv=com.slice().sort((a,b)=>b.real-a.real)[0];
    D.push(['ok','Menor CMV do grupo',`${lojaNome(b.id)} com ${nf1.format(b.real)}% (teórico ${nf1.format(b.teo)}%).`]);
    if(wv.id!==b.id)D.push([wv.real>metaCmv?'bad':'warn','Maior CMV do grupo',`${lojaNome(wv.id)} com ${nf1.format(wv.real)}%: ${nf1.format(wv.real-b.real)} p.p. acima da melhor loja.`]);
    const pi=com.filter(x=>x.d!=null).sort((a,b)=>b.d-a.d)[0]; if(pi&&pi.d>0.3)D.push(['warn','Maior piora na semana',`${lojaNome(pi.id)} subiu ${nf1.format(pi.d)} p.p. em relação à semana anterior.`]);
    const me=com.filter(x=>x.d!=null).sort((a,b)=>a.d-b.d)[0]; if(me&&me.d<-0.3)D.push(['ok','Maior melhora na semana',`${lojaNome(me.id)} caiu ${nf1.format(-me.d)} p.p. em relação à semana anterior.`]);
    const sq=com.filter(x=>x.seq>=2).sort((a,b)=>b.seq-a.seq)[0]; if(sq)D.push(['bad','Acima da meta em sequência',`${lojaNome(sq.id)} está há ${sq.seq} semanas seguidas acima de ${nf1.format(metaCmv).replace(',0','')}%.`]);
    const pp=com.filter(x=>x.perda>0).sort((a,b)=>b.perda-a.perda)[0]; if(pp)D.push(['warn','Maior valor acima do teórico',`${lojaNome(pp.id)}: ${brl(pp.perda)} na semana (${nf1.format(pp.perda/R.perda*100)}% do grupo).`]);}
  if(crit.length)D.push(['bad','Itens que mais fugiram da ficha',crit.map(i=>`${i.item} (${lojaNome(i.loja_id)}) +${nf1.format(i.d)}%`).join(' · ')]);
  $('#cmgDest').innerHTML=D.length?D.map(([s,t,x])=>`<div class="cmg-ins"><span class="cmg-ins-ic s-${s}">${s==='ok'?'✓':s==='bad'?'!':'•'}</span><div><b>${t}</b><div class="small muted">${esc(x)}</div></div></div>`).join(''):'<div class="empty">Sem contagens para analisar.</div>';
  // mapa de calor: lojas × semanas, divergente em torno da meta (verde abaixo, neutro na meta, vermelho acima)
  const cel=v=>{if(v==null)return 'background:transparent';const d=v-metaCmv,a=Math.min(1,Math.abs(d)/2.5);return d>0?`background:rgba(217,58,72,${(.12+a*.6).toFixed(2)})`:`background:rgba(44,159,115,${(.12+a*.55).toFixed(2)})`};
  $('#cmgHeat').innerHTML=sems.length?`<table class="cmg-heat"><tr><th></th>${labs.map(l=>`<th>${l}</th>`).join('')}</tr>`+lw.map(x=>`<tr><th><span class="cmg-dot" style="--cor:${x.cor}"></span>${esc(lojaNome(x.id))}</th>${x.se.map((v,i)=>`<td style="${cel(v)}" title="${esc(lojaNome(x.id))} · ${labs[i]} · ${v==null?'sem contagem':nf1.format(v)+'% (teórico '+nf1.format(x.st_[i])+'%)'}">${v==null?'·':nf1.format(v)}</td>`).join('')}</tr>`).join('')+
    `<tr class="cmg-heat-rede"><th>Grupo</th>${serie.map((v,i)=>`<td style="${cel(v)}" title="Grupo · ${labs[i]} · ${v==null?'—':nf1.format(v)+'%'}">${v==null?'·':nf1.format(v)}</td>`).join('')}</tr></table>
    <div class="cmg-heat-leg"><span>abaixo da meta</span><i style="background:linear-gradient(90deg,rgba(44,159,115,.67),rgba(44,159,115,.12),rgba(255,255,255,.05),rgba(217,58,72,.12),rgba(217,58,72,.72))"></i><span>acima da meta</span></div>`:'<div class="empty">Sem contagens.</div>';
  // CMV do fechamento oficial (DRE)
  const dl=(S.db.dre_lancamentos||[]), meses=uniq(dl.filter(r=>r.linha==='fat').map(r=>r.mes)).sort();
  $('#cmgDreCard').classList.toggle('hidden',!meses.length);
  if(meses.length){
    const g=(l,m,k)=>{const r=dl.find(x=>x.loja_id===l&&x.mes===m&&x.linha===k);return r?+r.valor:null};
    const ls=LOJAS.filter(l=>meses.some(m=>g(l.id,m,'fat'))).map(l=>l.id);
    const ds=ls.map(id=>({label:lojaNome(id),data:meses.map(m=>{const f=g(id,m,'fat'),c=g(id,m,'cmv');return f&&c!=null?c/f*100:null}),borderColor:PAL[LOJAS.findIndex(l=>l.id===id)%PAL.length],backgroundColor:PAL[LOJAS.findIndex(l=>l.id===id)%PAL.length],borderWidth:2,pointRadius:4,pointHoverRadius:6,tension:.25,spanGaps:true}));
    ds.push({label:'Grupo',data:meses.map(m=>{const f=sum(ls,id=>g(id,m,'fat')),c=sum(ls,id=>g(id,m,'cmv'));return f?c/f*100:null}),borderColor:'#f7eee6',backgroundColor:'#f7eee6',borderWidth:2.5,borderDash:[6,4],pointRadius:0,pointHoverRadius:5});
    mk('cCmvDre',{type:'line',data:{labels:meses.map(mesTxt),datasets:ds},options:{interaction:{mode:'index',intersect:false},plugins:{tooltip:tipPct},scales:{y:yPct,x:xG}}});
    const salto=ls.map(id=>{const a=meses.filter(m=>m<'2026-05').map(m=>g(id,m,'cmv')/g(id,m,'fat')*100).filter(v=>isFinite(v)),b=meses.filter(m=>m>='2026-05').map(m=>g(id,m,'cmv')/g(id,m,'fat')*100).filter(v=>isFinite(v));return a.length&&b.length?{id,a:sum(a)/a.length,b:sum(b)/b.length}:null}).filter(x=>x&&Math.abs(x.b-x.a)>8);
    $('#cmgDreNote').textContent='CMV = alimentos e bebidas + descartáveis do fechamento ÷ faturamento oficial. '+(salto.length?'Mudança de patamar a partir de maio: '+salto.map(x=>`${lojaNome(x.id)} de ${nf1.format(x.a)}% para ${nf1.format(x.b)}%`).join(', ')+' — indício de mudança na forma de lançar as compras (ex.: cozinha central no Perdizes), não necessariamente de desempenho.':'');
  }
  cmgExtras(mesRef,lojas);
}
async function cmgExtras(m,lojas){
  if(CMG_EXTRA.ref!==m){
    const [pe,ct]=await Promise.all([typeof perdasMes==='function'?perdasMes(m):Promise.resolve([]),
      sb.from('controle_diario').select('loja_id,data,diferenca').gte('data',m+'-01').lte('data',fimMes(m)).not('diferenca','is',null).then(r=>r.data||[])]);
    const P_={},C_={};(pe||[]).forEach(p=>{const o=P_[p.loja_id]=P_[p.loja_id]||{n:0,v:0};o.n++;o.v+=+p.valor||0});
    ct.forEach(r=>{const o=C_[r.loja_id]=C_[r.loja_id]||{dias:new Set(),dif:new Set(),itens:0};o.dias.add(r.data);if(+r.diferenca!==0){o.dif.add(r.data);o.itens++}});
    CMG_EXTRA={ref:m,perdas:P_,ctl:C_};
  }
  lojas.forEach(id=>{const p=CMG_EXTRA.perdas[id],c=CMG_EXTRA.ctl[id];
    const ep=document.querySelector(`[data-cmgp="${id}"]`), ec=document.querySelector(`[data-cmgc="${id}"]`);
    if(ep)ep.innerHTML=p?`${p.n} registro${p.n===1?'':'s'}${p.v?' · '+brl(p.v):''}`:'<span class="muted">nenhuma</span>';
    if(ec)ec.innerHTML=c?`${c.dif.size} de ${c.dias.size} dias${c.itens?' · '+c.itens+' itens':''}`:'<span class="muted">sem controle</span>';});
}
