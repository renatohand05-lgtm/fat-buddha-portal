/* Fat Buddha · service worker: guarda a estrutura do portal; dados sempre vêm do servidor */
// IMPORTANTE: troque o V a cada publicação; a estrutura do portal é servida desta cópia
const V = 'fb-v34';
const BASE = ['/', '/styles.css', '/logo.png', '/fonts/inter-latin.woff2', '/manifest.webmanifest', '/vendor/chart.umd.js', '/vendor/supabase.js',
  '/js/core.js', '/js/v_comercial.js', '/js/v_financeiro.js', '/js/v_operacoes.js', '/js/v_rh.js', '/js/v_checklists.js', '/js/v_gestao.js', '/js/v_integracao.js', '/js/v_loja.js', '/js/v_conexoes.js', '/js/v_cmvop.js', '/js/v_cmvgrupo.js', '/js/v_dre.js', '/js/v_google.js', '/js/v_vistoria.js', '/js/v_escalas.js', '/js/v_painel.js', '/js/main.js'];
// a Vercel redireciona /index.html para / (cleanUrls): resposta com redirecionamento não pode ser entregue para abrir a
// página (Safari e Chrome recusam), então toda cópia é guardada "limpa", sem o histórico de redirecionamento
const limpa = r => r.redirected ? r.blob().then(b => new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers })) : Promise.resolve(r);
// instalação: baixa tudo de novo do servidor (sem cache do navegador) e guarda nesta versão
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(BASE.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(u); return limpa(r).then(l => c.put(u, l)); }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const SHELL = new Set(BASE);
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // API, banco e fotos: sempre rede
  const nav = e.request.mode === 'navigate';
  // páginas: rede primeiro (até 3 s); sem rede ou lenta, a cópia desta versão. Nunca entrega resposta redirecionada.
  if (nav) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const r = await Promise.race([fetch(e.request), new Promise((_, rej) => setTimeout(() => rej(new Error('lenta')), 3000))]);
        if (r.ok) { const l = await limpa(r); c.put('/', l.clone()); return l; }
        return r;
      } catch (err) {
        return (await c.match('/')) || limpa(await fetch(e.request));
      }
    })());
    return;
  }
  // estrutura do portal (css, js, fontes): abre na hora com a cópia desta versão. Cada publicação troca o V e o navegador
  // instala a versão nova sozinho; a tela avisa e só recarrega quando a pessoa tocar (nunca no meio de um checklist)
  if (SHELL.has(u.pathname)) {
    e.respondWith(caches.open(V).then(c => c.match(u.pathname, { ignoreSearch: true }).then(r => r || fetch(e.request).then(n => { if (n.ok) limpa(n.clone()).then(l => c.put(u.pathname, l)); return n; })))
      .catch(() => fetch(e.request)));
    return;
  }
  // demais arquivos (ícones, imagens): rede primeiro, cópia guardada sem conexão
  e.respondWith(fetch(e.request).then(r => { if (r.ok && !r.redirected) { const c = r.clone(); caches.open(V).then(cc => cc.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
