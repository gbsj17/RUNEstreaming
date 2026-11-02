// Fonte: TV ao vivo a partir de listas M3U/HLS que o usuário cadastra (as dele, do provedor dele).
// Por padrão traz os canais abertos do Brasil do projeto iptv-org. Limites do navegador: o servidor do
// canal precisa liberar CORS e usar HTTPS (o Pages é HTTPS); canais que não cumprem isso não tocam aqui.
const IptvSource = (() => {
  const KEY = 'rs:iptv';
  const EXTRA = { name: 'Brasil (iptv-com)', url: 'https://raw.githubusercontent.com/iptv-com/iptv/main/lists/brazil.m3u' };
  const CAT = { name: 'Brasil (iptvcat)', url: 'lists/brasil-iptvcat.m3u' };
  const DEFAULT = [{ name: 'Canais abertos do Brasil', url: 'https://iptv-org.github.io/iptv/countries/br.m3u' }, EXTRA, CAT];

  // Listas gratuitas e abertas do projeto iptv-org, prontas para adicionar com um clique.
  const B = 'https://iptv-org.github.io/iptv/';
  const PRESETS = [
    EXTRA,
    CAT,
    { name: 'Em português (todos os países)', url: B + 'languages/por.m3u' },
    { name: 'Filmes', url: B + 'categories/movies.m3u' },
    { name: 'Séries', url: B + 'categories/series.m3u' },
    { name: 'Infantil', url: B + 'categories/kids.m3u' },
    { name: 'Esportes', url: B + 'categories/sports.m3u' },
    { name: 'Notícias', url: B + 'categories/news.m3u' },
  ];

  // Proxy opcional (worker/): libera http:// e servidores sem CORS.
  const proxy = () => (window.RS_CONFIG && RS_CONFIG.proxyUrl || '').replace(/\/+$/, '');
  const via = (u) => (proxy() && /^http:/i.test(u) ? `${proxy()}/?url=${encodeURIComponent(u)}` : u);

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignora */ } };

  const lists = () => read() || DEFAULT;
  const add = (name, url, epg = '', logos = '') =>
    write([...lists(), { name: name.trim() || url, url: url.trim(), epg: epg.trim(), logos: logos.trim() }]);
  const remove = (i) => write(lists().filter((_, k) => k !== i));
  const reset = () => write(DEFAULT);

  const attr = (line, name) => {
    const m = line.match(new RegExp(name + '="([^"]*)"'));
    return m ? m[1] : '';
  };

  // Logos: usa o tvg-logo; se for relativo (ou vazio), completa com a base de logos informada.
  const logoUrl = (logo, base, name) => {
    if (/^https?:\/\//i.test(logo)) return logo;
    if (!base) return '';
    const b = base.replace(/\/+$/, '') + '/';
    return b + (logo || encodeURIComponent(name) + '.png');
  };

  // Guia de programação (XMLTV, opcionalmente .gz): coloca "Agora: programa" na descrição dos canais.
  async function applyEpg(url, items) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('epg ' + res.status);
    let xml;
    if (/\.gz(\?|$)/i.test(url) && window.DecompressionStream) {
      xml = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
    } else xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const stamp = (v) => { const m = (v || '').match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)\s*([+-]\d{4})?/); return m ? Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ? m[7].slice(0, 3) + ':' + m[7].slice(3) : 'Z'}`) : NaN; };
    const now = Date.now();
    const cur = new Map();
    doc.querySelectorAll('programme').forEach((p) => {
      const a = stamp(p.getAttribute('start')), b = stamp(p.getAttribute('stop'));
      if (a <= now && now < b) cur.set(p.getAttribute('channel'), (p.querySelector('title') || {}).textContent);
    });
    items.forEach((t) => { const n = cur.get(t.tvgId); if (n) t.desc = `Agora: ${n} · ${t.desc}`; });
  }

  function parse(text, listName, logos = '') {
    const out = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('#EXTINF')) continue;
      const url = (lines.slice(i + 1).find((l) => l.trim() && !l.startsWith('#')) || '').trim();
      if (!/^https:\/\//i.test(url) && !(proxy() && /^http:\/\//i.test(url))) continue;   // http:// só passa pelo proxy
      const name = line.slice(line.lastIndexOf(',') + 1).trim() || 'Canal';
      const group = (attr(line, 'group-title').split(';')[0] || listName).trim();
      out.push({
        id: 'tv:' + url,
        title: name,
        year: '',
        genre: group,
        desc: `Ao vivo · ${listName}`,
        tvgId: attr(line, 'tvg-id'),
        poster: logoUrl(attr(line, 'tvg-logo'), logos, name),
        hue: (name.charCodeAt(0) * 37) % 360,
        source: 'iptv',
        live: true,
        resolve: async () => ({ url: via(url), hls: true }),
      });
    }
    return out;
  }

  async function load(onPart) {
    const seen = new Set();
    await Promise.allSettled(lists().map(async (l) => {
      const res = await fetch(via(l.url));
      if (!res.ok) throw new Error(l.name + ' ' + res.status);
      const items = parse(await res.text(), l.name, l.logos).filter((t) => !seen.has(t.id) && seen.add(t.id));
      onPart && onPart(items);
      if (l.epg) applyEpg(l.epg, items).catch((err) => console.warn('EPG', err));
    }));
    return [];
  }

  return { label: 'TV ao vivo', byGenre: true, load, lists, add, remove, reset, PRESETS };
})();
