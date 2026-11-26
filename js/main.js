/* ================= navegação, login e inicialização ================= */
const TITLES={ifood:['iFood','Vendas, tempo online, cancelamentos, nota e custos do iFood por loja'],notas:['Notas fiscais','Compras por fornecedor, classificação no DRE e compras do CMV'],geral:['Visão geral','Resultado da rede, ranking das lojas e alertas'],loja:['Minha loja','Resultado do dia, do mês e pendências da loja'],vendas:['Vendas','Venda diária, hora a hora e por canal'],metas:['Metas e indicadores','Metas do plano de gestão e semáforo por loja'],qualidade:['Qualidade','Visita operacional com nota, desvios e plano de ação · notas e avaliações do Google'],delivery:['Checklist de indicadores de delivery','Acompanhamento diário ou semanal por loja'],dre:['DRE por loja','Resultado operacional de cada loja no mês'],orc:['Orçamento de inaugurações','DRE orçado de uma nova loja, maturação, cenários e rede com 10 lojas'],rh:['Indicadores de RH','Quadro, turnover, absenteísmo, ocorrências, performance, nine box e sucessão'],cmv:['CMV por loja','CMV semanal, controle diário de bebidas, sobremesas e proteínas, perdas e produção do dia'],cc:['Cozinha central','Rupturas das lojas e estoque da cozinha central'],
  planos:['Planos de ação','Desvios dos checklists e indicadores, com responsável, prazo e verificação'],relatorios:['Relatórios','Relatórios gerenciais em PDF e CSV'],config:['Configurações','Lojas, metas, premissas, quadro, usuários e histórico']};
const RENDER={ifood:renderIfood,notas:renderNotas,geral:renderGeral,loja:renderLoja,vendas:renderVendas,metas:renderMetas,dre:renderDRE,orc:renderOrc,rh:renderRH,cmv:renderCmvTab,cc:renderCC,qualidade:renderQualidade,delivery:()=>{buildDel();renderDelHist()},planos:renderPlanos,relatorios:renderRelatorios,config:renderConfig};
function abasPermitidas(){
  const p=P.papel;
  if(p==='colaborador') return ['cmv','cc','delivery'];
  const t=['geral','loja','vendas','ifood','metas','cmv','cc','dre','notas','rh','qualidade','delivery','planos','relatorios'];
  if(P.veTudo) t.splice(t.indexOf('notas')+1,0,'orc');
  if(P.gestor) t.push('config');
  return t;
}
function go(t){
  const ok=abasPermitidas(); if(!ok.includes(t)) t=ok[0];
  S.tab=t;
  $$('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  $$('.tab').forEach(s=>s.classList.toggle('on',s.id==='tab-'+t));
  $('#pTitle').textContent=TITLES[t][0]; $('#pSub').textContent=TITLES[t][1];
  try{RENDER[t]()}catch(e){console.error(e);toast('Erro ao montar a tela: '+e.message)}
  if(t==='geral'||t==='loja') liveAtualizar();
  try{history.replaceState(null,'','#'+t)}catch(e){}
  window.scrollTo({top:0});
}
function aplicarLojas(){
  initVendas(); initMetas(); initCMV(); initDRE(); initCC(); initIfood(); initNotas(); initCont(); initCmvOp(); initRH(); initMov(); initOco(); initPlanos(); initChecklists(); initGoogle();
  $('#foot').innerHTML=`Fat Buddha | Rice &amp; Deli<br>${OPER.length} loja${OPER.length===1?'':'s'} em operação${LOJAS.filter(l=>l.status==='inauguracao').map(l=>' · '+esc(l.nome)+(l.inauguracao?' em '+esc(l.inauguracao):'')).join('')}`;
  // visibilidade por permissão
  const tem=(sel,cond)=>$$(sel).forEach(e=>e.classList.toggle('hidden',!cond));
  tem('.only-edit',lojasEditaveis().length>0); tem('.only-op',lojasOperaveis().length>0); tem('.only-gestor',P.gestor); tem('.only-cc',P.editaCC);
  const nb=abasPermitidas(); $$('#nav button').forEach(b=>b.classList.toggle('hidden',!nb.includes(b.dataset.tab)));
  $('#nav .grp').classList.toggle('hidden',!nb.some(t=>['planos','relatorios','config'].includes(t)));
  $$('#rhNav button').forEach(b=>b.classList.toggle('hidden',b.dataset.s==='oco'&&!LOJAS.some(l=>P.veOco(l.id))));
  if(P.papel==='colaborador'){ccSub='rup';$$('#ccNav button').forEach(b=>b.classList.toggle('hidden',b.dataset.s!=='rup'))}
}
function mesesOpcoes(){
  const hoje=ymOf(isoHoje()), datas=(S.db.vendas_diarias||[]).map(r=>r.data.slice(0,7));
  let ini=datas.length?datas.reduce((a,b)=>a<b?a:b):addMes(hoje,-11); if(ini>addMes(hoje,-11)) ini=addMes(hoje,-11);
  const out=[]; for(let m=addMes(hoje,1);m>=ini;m=addMes(m,-1)) out.push(m); return out;
}
function initMes(){
  $('#pMonth').innerHTML=mesesOpcoes().map(m=>`<option value="${m}" ${m===S.mes?'selected':''}>${mesLongo(m)}</option>`).join('');
  $('#pMonth').onchange=()=>{S.mes=$('#pMonth').value;CACHE={};$('#vIni').value='';$('#vFim').value='';$('#mvMes').value=S.mes;go(S.tab)};
}
async function entrar(){
  const {data:{user}}=await sb.auth.getUser(); if(!user) return mostrarLogin();
  S.user=user;
  const {data:pf}=await sb.from('perfis').select('*').eq('user_id',user.id).maybeSingle();
  S.perfil=pf;
  if(!pf||!pf.papel||!pf.ativo){mostrarLogin('espera');return}
  const {data:ml}=await sb.from('perfil_lojas').select('loja_id').eq('user_id',user.id);
  S.minhas=(ml||[]).map(x=>x.loja_id);
  await load();
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  const nome=pf.nome||user.email;
  $('#userBox').innerHTML=`<div class="av">${esc(nome.trim()[0]||'?').toUpperCase()}</div><div><b>${esc(nome)}</b><span>${PAPEL_TXT[pf.papel]}</span></div><button id="btnSair" title="Sair">Sair</button>`;
  $('#btnSair').onclick=async()=>{await sb.auth.signOut();location.hash='';location.reload()};
  if(!(S.db.vendas_diarias||[]).some(r=>ymOf(r.data)===S.mes)){const ms=(S.db.vendas_diarias||[]).map(r=>ymOf(r.data)).filter(m=>m<=S.mes).sort();if(ms.length)S.mes=ms.at(-1)}
  initPWA(); liveLigar(); $('#bell').onclick=()=>abrirAlertas(); pintarSino(); if(alertasVisiveis().some(a=>!a.resolvido&&!lidos().has(a.id)))$('#bell').classList.add('tem');
  initMes(); initOrc(); initConfig(); aplicarLojas();
  aplicarDemo();
  const start=(location.hash||'').slice(1); go(TITLES[start]?start:(['gerente','regional'].includes(P.papel)?'loja':abasPermitidas()[0]));
  setInterval(async()=>{await load(['alertas','alertas_lidos']);pintarSino()},5*60*1000);
}
async function mostrarLogin(modo){
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
  $('#fLogin').classList.toggle('hidden',modo==='espera'); $('#lgEspera').classList.toggle('hidden',modo!=='espera'); $('#fPrimeiro').classList.add('hidden');
  if(modo!=='espera'){const {data}=await sb.rpc('existe_admin'); if(data===false){$('#fLogin').classList.add('hidden');$('#fPrimeiro').classList.remove('hidden')}}
}
const msg=(t,ok)=>{const m=$('#lgMsg');m.textContent=t||'';m.classList.toggle('ok',!!ok)};
$('#fLogin').onsubmit=async e=>{e.preventDefault();msg('');$('#lgBtn').disabled=true;
  const {error}=await sb.auth.signInWithPassword({email:$('#lgEmail').value.trim(),password:$('#lgSenha').value});
  $('#lgBtn').disabled=false;
  if(error){msg(/confirm/i.test(error.message)?'Confirme seu e-mail antes de entrar (veja a caixa de entrada).':'E-mail ou senha incorretos.');return}
  entrar()};
$('#lgEsq').onclick=async()=>{const em=$('#lgEmail').value.trim();if(!em){msg('Digite seu e-mail acima e clique novamente.');return}
  const {error}=await sb.auth.resetPasswordForEmail(em,{redirectTo:location.origin+location.pathname});msg(error?error.message:'Se o e-mail estiver cadastrado, você receberá um link para criar nova senha. Se preferir, peça ao administrador para redefinir.',!error)};
$('#fPrimeiro').onsubmit=async e=>{e.preventDefault();msg('');
  const {data,error}=await sb.auth.signUp({email:$('#pmEmail').value.trim(),password:$('#pmSenha').value,options:{data:{nome:$('#pmNome').value.trim()},emailRedirectTo:location.origin+location.pathname}});
  if(error){msg(error.message);return}
  if(data.session) entrar(); else {msg('Conta criada. Confirme o e-mail recebido e depois entre com e-mail e senha.',true);$('#fPrimeiro').classList.add('hidden');$('#fLogin').classList.remove('hidden');$('#lgEmail').value=$('#pmEmail').value}};
$('#lgSair2').onclick=async()=>{await sb.auth.signOut();location.reload()};
sb.auth.onAuthStateChange(async(ev)=>{
  if(ev==='PASSWORD_RECOVERY'){const s=await pedir('Criar nova senha','Nova senha',{tipo:'password',ajuda:'Mínimo de 8 caracteres.'});if(s&&s.length>=8){const {error}=await sb.auth.updateUser({password:s});toast(error?error.message:'Senha alterada.')}else if(s!=null)toast('A senha precisa ter pelo menos 8 caracteres.')}
  if(ev==='SIGNED_OUT'){$('#app').classList.add('hidden');mostrarLogin()}
});
$$('#nav button').forEach(b=>b.onclick=()=>go(b.dataset.tab));
$('#modal').addEventListener('keydown',e=>{if(e.key==='Escape')fecharModal()});
entrar();

/* ================= fundo animado ================= */
/* modo leve automático: se o computador não der conta, tira o desfoque dos cartões e mantém o fundo animado */
(function(){let n=0;const t0=performance.now();function f(){n++;const dt=performance.now()-t0;if(dt<1500)requestAnimationFrame(f);else if(n/dt*1000<28)document.body.classList.add('lite')}setTimeout(()=>requestAnimationFrame(f),800)})();
/* 1) brilhos grandes: desenhados em baixa resolução e ampliados (ficam suaves sem custo de blur) */
(function(){
  const cv=$('#bgc'), x=cv.getContext('2d'), S=8; let W,H;
  const B=[{c:'229,48,63',a:.62,r:.42,px:.78,py:.08,ax:.22,ay:.2,fx:.00011,fy:.00015,ph:0},
           {c:'242,179,61',a:.38,r:.38,px:.22,py:.95,ax:.3,ay:.18,fx:.00009,fy:.00013,ph:1.7},
           {c:'238,219,202',a:.18,r:.3,px:.6,py:.5,ax:.28,ay:.22,fx:.00013,fy:.0001,ph:3.1},
           {c:'179,18,31',a:.5,r:.34,px:.05,py:.4,ax:.25,ay:.25,fx:.00012,fy:.00008,ph:4.4},
           {c:'229,48,63',a:.3,r:.26,px:.45,py:.2,ax:.35,ay:.15,fx:.00017,fy:.00012,ph:2.3}];
  function rs(){W=Math.ceil(cv.clientWidth/S);H=Math.ceil(cv.clientHeight/S);cv.width=W;cv.height=H}
  function fr(t){x.clearRect(0,0,W,H);x.globalCompositeOperation='lighter';const m=Math.max(W,H);
    for(const b of B){const cx=(b.px+Math.sin(t*b.fx+b.ph)*b.ax)*W, cy=(b.py+Math.cos(t*b.fy+b.ph)*b.ay)*H, r=m*b.r*(1+.15*Math.sin(t*.0003+b.ph));
      const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,`rgba(${b.c},${b.a})`);g.addColorStop(1,`rgba(${b.c},0)`);x.fillStyle=g;x.fillRect(0,0,W,H)}
    requestAnimationFrame(fr)}
  addEventListener('resize',rs);rs();requestAnimationFrame(fr);
})();
/* 2) grãos de arroz, brasas e vapor subindo, com leve parallax do mouse */
(function(){
  const cv=$('#fx'), x=cv.getContext('2d'); let W,H,G=[],E=[],V=[],mx=0,my=0,tx=0,ty=0,t=0;
  const dpr=Math.min(2,window.devicePixelRatio||1), R=Math.random;
  const sprite=(rgb,size,stop)=>{const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d'),h=size/2,gr=g.createRadialGradient(h,h,0,h,h,h);gr.addColorStop(0,`rgba(${rgb},1)`);gr.addColorStop(stop,`rgba(${rgb},.35)`);gr.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=gr;g.fillRect(0,0,size,size);return c};
  const SP={gold:sprite('255,190,90',64,.25),red:sprite('255,90,80',64,.25),vap:sprite('255,240,230',128,.4)};
  const grain=init=>({x:R()*W,y:init?R()*H:H+20,r:1.8+R()*2.8,s:.35+R()*.9,a:R()*6.28,va:(R()-.5)*.03,w:R()*6.28,ws:.01+R()*.02,o:.18+R()*.35,z:.4+R()*1.2,
    c:R()<.15?'242,179,61':(R()<.3?'229,48,63':'238,219,202')});
  const ember=init=>({x:R()*W,y:init?R()*H:H+10,r:1+R()*2.2,s:.8+R()*1.6,w:R()*6.28,o:.5+R()*.5,sp:R()<.5?SP.gold:SP.red,z:.8+R()*.8});
  const vapor=init=>({x:R()*W,y:init?R()*H:H+150,r:90+R()*140,s:.25+R()*.35,max:.05+R()*.06,w:R()*6.28});
  function rs(){W=cv.clientWidth;H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0);
    G=Array.from({length:Math.round(W*H/14000)},()=>grain(true));E=Array.from({length:Math.round(W*H/40000)},()=>ember(true));V=Array.from({length:7},()=>vapor(true))}
  addEventListener('pointermove',e=>{tx=(e.clientX/W-.5);ty=(e.clientY/H-.5)});
  function fr(){t++;mx+=(tx-mx)*.04;my+=(ty-my)*.04;x.clearRect(0,0,W,H);
    for(const v of V){v.y-=v.s;v.w+=.008;v.x+=Math.sin(v.w)*.4;if(v.y<-v.r)Object.assign(v,vapor(false));
      const life=Math.max(0,Math.min(1,1-v.y/H));x.globalAlpha=v.max*Math.sin(life*Math.PI)*1.6;x.drawImage(SP.vap,v.x-v.r,v.y-v.r,v.r*2,v.r*2)}
    x.globalAlpha=1;
    for(const p of G){p.y-=p.s*p.z;p.w+=p.ws;p.x+=Math.sin(p.w)*.6*p.z;p.a+=p.va;if(p.y<-20||p.x<-30||p.x>W+30)Object.assign(p,grain(false));
      const px=p.x-mx*40*p.z, py=p.y-my*30*p.z;
      x.setTransform(dpr*Math.cos(p.a),dpr*Math.sin(p.a),-dpr*Math.sin(p.a),dpr*Math.cos(p.a),px*dpr,py*dpr);
      x.beginPath();x.ellipse(0,0,p.r*1.9,p.r*.8,0,0,6.28);x.fillStyle=`rgba(${p.c},${p.o})`;x.fill()}
    x.setTransform(dpr,0,0,dpr,0,0);x.globalCompositeOperation='lighter';
    for(const e of E){e.y-=e.s;e.w+=.05;e.x+=Math.sin(e.w)*.8;if(e.y<-10)Object.assign(e,ember(false));
      const px=e.x-mx*60*e.z, py=e.y-my*40*e.z, s=e.r*10;x.globalAlpha=e.o*(.6+.4*Math.sin(t*.15+e.w*3));x.drawImage(e.sp,px-s/2,py-s/2,s,s)}
    x.globalAlpha=1;x.globalCompositeOperation='source-over';
    requestAnimationFrame(fr)}
  addEventListener('resize',rs);rs();fr();
})();
