/* Fat Buddha · service worker: guarda a estrutura do portal; dados sempre vêm do servidor */
const V = 'fb-v3';
const BASE = ['/', '/index.html', '/styles.css', '/logo.png', '/manifest.webmanifest', '/vendor/chart.umd.js', '/vendor/supabase.js',
  '/js/core.js', '/js/v_comercial.js', '/js/v_financeiro.js', '/js/v_operacoes.js', '/js/v_rh.js', '/js/v_checklists.js', '/js/v_gestao.js', '/js/v_integracao.js', '/js/v_loja.js', '/js/main.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // API, banco e fotos: sempre rede
  // rede primeiro (versão nova assim que publicada); sem conexão, usa a cópia guardada
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(cc => cc.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('/index.html'))));
});
