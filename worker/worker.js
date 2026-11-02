// Proxy CORS para o RUNEstreaming: deixa o site (HTTPS) tocar canais http:// e servidores sem CORS.
// Só responde a páginas listadas em ALLOWED_ORIGINS e nunca a endereços de rede interna.
const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i;

export default {
  async fetch(req, env) {
    if (new URL(req.url).pathname === '/logs') {
      if (!env.LOGS || !env.ADMIN_TOKEN) return new Response('Logs não configurados', { status: 501 });
      if (req.headers.get('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) return new Response('Não autorizado', { status: 401 });
      const list = await env.LOGS.list({ prefix: 'log:', limit: 100 });
      const rows = await Promise.all(list.keys.map(async (k) => JSON.parse(await env.LOGS.get(k.name))));
      return new Response(JSON.stringify(rows, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    const allowed = (env.ALLOWED_ORIGINS || 'https://gbsj17.github.io').split(',').map((s) => s.trim());
    const origin = req.headers.get('Origin') || '';
    if (!allowed.includes(origin)) return new Response('Origem não permitida', { status: 403 });
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const isLog = req.method === 'POST' && new URL(req.url).pathname === '/log';
    if (!isLog && req.method !== 'GET' && req.method !== 'HEAD') return new Response('Método não permitido', { status: 405, headers: cors });

    const self = new URL(req.url);

    // Registro de erros do site (precisa do KV "LOGS", veja o README).
    if (self.pathname === '/log' && req.method === 'POST') {
      if (!env.LOGS) return new Response('KV não configurado', { status: 501, headers: cors });
      const raw = (await req.text()).slice(0, 20000);
      let data;
      try { data = JSON.parse(raw); } catch { return new Response('JSON inválido', { status: 400, headers: cors }); }
      const entries = Array.isArray(data.entries) ? data.entries.slice(0, 20).map((e) => ({
        at: String(e.at || '').slice(0, 30), type: String(e.type || '').slice(0, 20), msg: String(e.msg || '').slice(0, 500),
      })) : [];
      if (!entries.length) return new Response(null, { status: 204, headers: cors });
      const rec = { sid: String(data.sid || '').slice(0, 20), v: String(data.v || '').slice(0, 12), page: String(data.page || '').slice(0, 80),
        ua: String(data.ua || '').slice(0, 200), screen: `${data.w}x${data.h}`, entries };
      // Chave com o tempo invertido: a listagem do KV devolve os mais novos primeiro.
      const key = `log:${String(9999999999999 - Date.now()).padStart(13, '0')}:${Math.random().toString(36).slice(2, 7)}`;
      await env.LOGS.put(key, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 30 });
      return new Response(null, { status: 204, headers: cors });
    }
    let target;
    try { target = new URL(self.searchParams.get('url')); } catch { return new Response('url inválida', { status: 400, headers: cors }); }
    if (!/^https?:$/.test(target.protocol) || PRIVATE.test(target.hostname)) {
      return new Response('Destino não permitido', { status: 400, headers: cors });
    }

    const headers = new Headers({ 'User-Agent': 'Mozilla/5.0 RUNEstreaming-proxy' });
    if (req.headers.get('Range')) headers.set('Range', req.headers.get('Range'));
    let res;
    try { res = await fetch(target, { headers, redirect: 'follow' }); }
    catch { return new Response('Falha ao acessar o destino', { status: 502, headers: cors }); }

    const out = new Headers(cors);
    ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'].forEach((h) => {
      if (res.headers.get(h)) out.set(h, res.headers.get(h));
    });

    // Playlists HLS: reescreve os endereços internos para também passarem pelo proxy.
    const type = res.headers.get('Content-Type') || '';
    if (res.ok && (/mpegurl/i.test(type) || /\.m3u8?$/i.test(target.pathname))) {
      const text = await res.text();
      if (text.includes('#EXT-X-')) {
        const base = res.url || target.href;
        const prox = (u) => { try { return `${self.origin}/?url=${encodeURIComponent(new URL(u, base).href)}`; } catch { return u; } };
        const body = text.split(/\r?\n/).map((l) => {
          if (!l.trim()) return l;
          if (l.startsWith('#')) return l.replace(/URI="([^"]+)"/g, (_, u) => `URI="${prox(u)}"`);
          return prox(l.trim());
        }).join('\n');
        out.delete('Content-Length');
        out.set('Content-Type', 'application/vnd.apple.mpegurl');
        return new Response(body, { status: res.status, headers: out });
      }
      out.delete('Content-Length');
      return new Response(text, { status: res.status, headers: out });
    }
    return new Response(res.body, { status: res.status, headers: out });
  },
};
