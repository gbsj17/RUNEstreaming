// Proxy CORS para o RUNEstreaming: deixa o site (HTTPS) tocar canais http:// e servidores sem CORS.
// Só responde a páginas listadas em ALLOWED_ORIGINS e nunca a endereços de rede interna.
const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i;

export default {
  async fetch(req, env) {
    const allowed = (env.ALLOWED_ORIGINS || 'https://gbsj17.github.io').split(',').map((s) => s.trim());
    const origin = req.headers.get('Origin') || '';
    if (!allowed.includes(origin)) return new Response('Origem não permitida', { status: 403 });
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Método não permitido', { status: 405, headers: cors });

    const self = new URL(req.url);
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
