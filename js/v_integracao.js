/* ================= INTEGRAÇÕES (API) ================= */
const API_BASE = SUPABASE_URL + '/functions/v1/api-integracao';
const API_REC = {
  vendas:{n:'Vendas diárias',d:'Upsert por loja + data (reenviar corrige, não duplica)',ex:[{data:'2026-11-21',loja:'brooklyn',salao:6611.5,delivery:23038,pedidos_salao:103,pedidos_delivery:303}]},
  vendas_hora:{n:'Vendas por hora',d:'Upsert por loja + data + hora',ex:[{data:'2026-11-21',loja:'perdizes',hora:19,salao:0,delivery:4120.9}]},
  rupturas:{n:'Rupturas',d:'Cada envio cria um registro',ex:[{data:'2026-11-21',loja:'Vila Mariana',item:'Salmão',motivo:'Falta na cozinha central',horas:3,acao:'Remanejado do Brooklyn'}]},
  delivery:{n:'Indicadores de delivery',d:'Cada envio cria um checklist (alimenta preparo, cancelamentos, iFood, online)',ex:[{data:'2026-11-21',loja:'tatuape',periodo:'Diário',preparo:16.2,cancel:2.4,ifood:4.6,online:96.8,pedidos:92,ticket:68.4}]},
  indicadores:{n:'Indicadores do mês',d:'Upsert por loja + mês (envie só os campos que tiver)',ex:[{mes:'2026-11',loja:'brooklyn',comp:5.8,folha_valor:182000}]},
  ifood:{n:'iFood (métricas diárias)',d:'Upsert por loja + data · alimenta a aba iFood e os indicadores de delivery',ex:[{data:'2026-11-21',loja:'brooklyn',pedidos:298,faturamento:21540.5,cancelados:5,online_min:690,previsto_min:720,nota:4.7,avaliacoes:41,preparo_min:15.5,entrega_min:38,atrasados:9,comissao:2584.86,taxas:310,promocoes:420,novos_clientes:37}]},
  pedidos:{n:'Pedidos em tempo real',d:'Upsert por origem + id · atualiza na hora a venda do dia e da hora',ex:[{id:'PDV-104523',loja:'perdizes',data_hora:'2026-11-21T19:42:10-03:00',canal:'delivery',plataforma:'ifood',valor:86.9,itens:3,status:'concluido'}]},
  notas:{n:'Notas fiscais (NF-e)',d:'Upsert pela chave de acesso · XML completo ou campos · até 200 notas por chamada',ex:[{chave:'35261112345678000190550010000456781234567890',numero:'45678',serie:'1',emissao:'2026-11-18',loja:'brooklyn',fornecedor_cnpj:'12345678000190',fornecedor_nome:'Distribuidora Exemplo Ltda',valor_total:4870.4,itens:[{codigo:'ARZ5',descricao:'Arroz japonês 5 kg',unidade:'UN',quantidade:40,valor_unit:121.76,valor_total:4870.4}]}]},
  cmv:{n:'Contagem de CMV',d:'Upsert por loja + semana',ex:[{semana:'2026-11-16',loja:'perdizes',vendas:201167,cmv_teorico:20.1,estoque_inicial:67284,compras:38859,estoque_final:64213,responsavel:'Talita D.'}]}
};
async function sha256hex(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function novaChave(){const a=new Uint8Array(24);crypto.getRandomValues(a);return 'fbk_'+btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function cfInteg(){
  $('#apiUrl').textContent=API_BASE+'/<recurso>';
  $('#tApiRec').innerHTML=`<tr><th>Recurso</th><th>Endereço</th><th>Regra</th></tr>`+Object.entries(API_REC).map(([k,r])=>`<tr><td><b>${r.n}</b></td><td class="muted small" style="user-select:all">POST …/api-integracao/${k}</td><td style="white-space:normal" class="small">${r.d}</td></tr>`).join('');
  $('#akEsc').innerHTML=Object.entries(API_REC).map(([k,r])=>`<label><input type="checkbox" value="${k}" checked> ${r.n}</label>`).join('');
  $('#akLojas').innerHTML=LOJAS.map(l=>`<label><input type="checkbox" value="${l.id}"> ${esc(l.nome)}</label>`).join('');
  $('#apiExRec').innerHTML=Object.entries(API_REC).map(([k,r])=>`<option value="${k}">${r.n}</option>`).join('');
  const ex=()=>{const k=$('#apiExRec').value,r=API_REC[k];$('#apiEx').textContent=
`# cURL
curl -X POST "${API_BASE}/${k}" \\
  -H "x-api-key: SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({registros:r.ex})}'

// JavaScript (fetch)
await fetch("${API_BASE}/${k}", {
  method: "POST",
  headers: { "x-api-key": "SUA_CHAVE", "Content-Type": "application/json" },
  body: JSON.stringify(${JSON.stringify({registros:r.ex},null,2).replace(/\n/g,'\n  ')})
});

// Resposta
{ "ok": true, "recurso": "${k}", "recebidos": 1, "gravados": 1, "rejeitados": 0, "erros": [] }

// Testar a chave (GET devolve a documentação completa e as permissões)
curl "${API_BASE}" -H "x-api-key: SUA_CHAVE"`};
  $('#apiExRec').onchange=ex; ex();
  $('#akAdd').onclick=async()=>{const nome=$('#akNome').value.trim();if(!nome){toast('Dê um nome à chave.');return}
    const escopos=$$('#akEsc input:checked').map(i=>i.value);if(!escopos.length){toast('Marque ao menos uma permissão.');return}
    const lojas=$$('#akLojas input:checked').map(i=>i.value);
    const k=novaChave();
    if(await dbw(sb.from('api_chaves').insert({nome,prefixo:k.slice(0,12),hash:await sha256hex(k),escopos,lojas:lojas.length?lojas:null}),'Chave gerada.')){
      $('#akNome').value='';
      $('#akNova').classList.remove('hidden');
      $('#akNova').innerHTML=`<div class="banner" style="margin:0"><b>Copie agora — esta chave não será mostrada de novo:</b><div class="actions" style="justify-content:flex-start;margin-top:8px"><code style="user-select:all;font-size:13px;word-break:break-all">${k}</code><button class="btn sm" id="akCopy">Copiar</button></div></div>`;
      $('#akCopy').onclick=()=>{navigator.clipboard.writeText(k).then(()=>toast('Chave copiada.'))};
      listarChaves();
    }};
  $('#apiLogR').onclick=listarLogs;
  listarChaves(); listarLogs();
}
async function listarChaves(){
  const {data,error}=await sb.from('api_chaves').select('*').order('created_at',{ascending:false});
  if(error){$('#tApiKeys').innerHTML=`<tr><td><div class="empty">${esc(error.message)}</div></td></tr>`;return}
  $('#tApiKeys').innerHTML=data.length?`<tr><th>Nome</th><th>Chave</th><th>Permissões</th><th>Lojas</th><th>Último uso</th><th>Situação</th><th></th></tr>`+data.map(c=>`<tr><td><b>${esc(c.nome)}</b><div class="small muted">criada em ${fmtD(c.created_at.slice(0,10))}</div></td><td class="muted">${esc(c.prefixo)}…</td><td style="white-space:normal" class="small">${c.escopos.map(e=>API_REC[e]?API_REC[e].n:e).join(', ')}</td><td class="small">${c.lojas?c.lojas.map(lojaNome).join(', '):'todas'}</td><td class="small">${c.ultimo_uso?new Date(c.ultimo_uso).toLocaleString('pt-BR'):'—'}</td><td>${c.ativo?'<span class="sem s-ok" style="min-width:0">Ativa</span>':'<span class="sem s-bad" style="min-width:0">Revogada</span>'}</td><td class="num">${c.ativo?`<button class="btn sm" data-kr="${c.id}">Revogar</button>`:`<button class="btn sm" data-kx="${c.id}">Excluir</button>`}</td></tr>`).join(''):'<tr><td><div class="empty">Nenhuma chave gerada.</div></td></tr>';
  $('#tApiKeys').querySelectorAll('[data-kr]').forEach(b=>b.onclick=async()=>{if(!confirm('Revogar esta chave? O sistema que a usa deixa de conseguir enviar dados imediatamente.'))return;if(await dbw(sb.from('api_chaves').update({ativo:false}).eq('id',b.dataset.kr),'Chave revogada.'))listarChaves()});
  $('#tApiKeys').querySelectorAll('[data-kx]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir esta chave revogada?'))return;if(await dbw(sb.from('api_chaves').delete().eq('id',b.dataset.kx),'Chave excluída.'))listarChaves()});
}
async function listarLogs(){
  const [{data:lg},{data:ks}]=await Promise.all([sb.from('api_logs').select('*').order('em',{ascending:false}).limit(150),sb.from('api_chaves').select('id,nome')]);
  const kn=Object.fromEntries((ks||[]).map(k=>[k.id,k.nome]));
  $('#tApiLog').innerHTML=(lg||[]).length?`<tr><th>Quando</th><th>Chave</th><th>Recurso</th><th class="num">Status</th><th class="num">Gravados</th><th>Detalhe</th></tr>`+lg.map(l=>`<tr><td>${new Date(l.em).toLocaleString('pt-BR')}</td><td>${esc(kn[l.chave_id]||'—')}</td><td>${esc(l.recurso)}</td><td class="num"><span class="sem s-${l.status<300?'ok':l.status<500?'warn':'bad'}" style="min-width:0">${l.status}</span></td><td class="num">${l.registros}</td><td style="white-space:normal;max-width:480px" class="small muted">${esc(l.erro||'')}</td></tr>`).join(''):'<tr><td><div class="empty">Nenhuma chamada recebida ainda.</div></td></tr>';
}

/* ================= DADOS DE DEMONSTRAÇÃO ================= */
function temDemo(){return ['vendas_diarias','colaboradores','rupturas','cmv_contagens','estoque_cc'].some(t=>(S.db[t]||[]).some(r=>r.demo))}
function aplicarDemo(){
  const on=temDemo(), b=$('#banner');
  b.classList.toggle('hidden',!on);
  if(on) b.innerHTML='<b>Dados de demonstração.</b> O portal está carregado com os dados do painel original (vendas, indicadores, CMV, cozinha central e RH de outubro de 2026) e registros de exemplo de visitas, checklists, ocorrências e planos de ação. '+(P.admin?'Para começar a operação real, remova-os em Configurações › Lojas.':'');
  const c=$('#demoCard'); if(c){c.classList.toggle('hidden',!(on&&P.admin));
    $('#demoTxt').textContent='Remove somente os registros marcados como demonstração (vendas, vendas por hora, indicadores, CMV, estoque, rupturas, colaboradores, RH, liderança, ocorrências, visitas, checklists, avaliações e planos de ação). Lojas, metas, premissas, quadro previsto e usuários são mantidos. Lançamentos feitos por você ou pela API também são mantidos.';
    $('#demoDel').onclick=async()=>{if(!confirm('Remover todos os dados de demonstração? Esta ação não pode ser desfeita.'))return;
      busy(true);const {data,error}=await sb.rpc('limpar_demo');busy(false);
      if(error){toast('Não foi possível remover: '+error.message);return}
      toast(`${data} registros de demonstração removidos.`);await load();aplicarLojas();aplicarDemo();go(S.tab)}}
}
