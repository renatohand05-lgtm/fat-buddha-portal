/* Fat Buddha · service worker: guarda a estrutura do portal; dados sempre vêm do servidor */
// IMPORTANTE: troque o V a cada publicação; a estrutura do portal é servida desta cópia
const V = 'fb-v28';
const BASE = ['/', '/index.html', '/styles.css', '/logo.png', '/fonts/inter-latin.woff2', '/manifest.webmanifest', '/vendor/chart.umd.js', '/vendor/supabase.js',
  '/js/core.js', '/js/v_comercial.js', '/js/v_financeiro.js', '/js/v_operacoes.js', '/js/v_rh.js', '/js/v_checklists.js', '/js/v_gestao.js', '/js/v_integracao.js', '/js/v_loja.js', '/js/v_conexoes.js', '/js/v_cmvop.js', '/js/v_cmvgrupo.js', '/js/v_dre.js', '/js/v_google.js', '/js/v_vistoria.js', '/js/v_escalas.js', '/js/main.js'];
// instalação: baixa tudo de novo do servidor (sem cache do navegador) e guarda nesta versão
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(BASE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const SHELL = new Set(BASE);
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // API, banco e fotos: sempre rede
  const p = u.pathname;
  // estrutura do portal (html, css, js, fontes): abre na hora com a cópia desta versão. Cada publicação troca o V e
  // o navegador instala a versão nova sozinho; a tela avisa e só recarrega quando a pessoa tocar (nunca no meio de um checklist)
  if (SHELL.has(p) || e.request.mode === 'navigate') {
    const chave = e.request.mode === 'navigate' ? '/index.html' : p;
    e.respondWith(caches.open(V).then(c => c.match(chave, { ignoreSearch: true }).then(r => r || fetch(e.request).then(n => { if (n.ok) c.put(chave, n.clone()); return n; })))
      .catch(() => fetch(e.request)));
    return;
  }
  // demais arquivos (ícones, imagens): rede primeiro, cópia guardada sem conexão
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(cc => cc.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
