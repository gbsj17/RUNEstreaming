// Junta listas abertas de canais em português, testa cada canal (HTTPS, CORS liberado, playlist HLS válida e
// pelo menos um trecho de vídeo acessível) e grava só os que funcionam em lists/brasil-verificados.m3u.
// Uso: node scripts/check-lists.mjs
import { readFile, writeFile } from 'node:fs/promises';

const ORIGIN = 'https://gbsj17.github.io';
const SOURCES = [
  'https://iptv-org.github.io/iptv/countries/br.m3u',
  'https://iptv-org.github.io/iptv/languages/por.m3u',
  'https://raw.githubusercontent.com/iptv-com/iptv/main/lists/brazil.m3u',
  'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_brazil.m3u8',
  new URL('../lists/brasil-iptvcat.m3u', import.meta.url),
];
const TIMEOUT = 9000;
const CONCURRENCY = 25;

const get = async (url, opts = {}) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: c.signal, headers: { Origin: ORIGIN, 'User-Agent': 'Mozilla/5.0', ...(opts.headers || {}) } }); }
  finally { clearTimeout(t); }
};
const cors = (res) => { const v = res.headers.get('access-control-allow-origin'); return v === '*' || v === ORIGIN; };

async function load(src) {
  const text = src instanceof URL ? await readFile(src, 'utf8') : await (await get(src)).text();
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXTINF')) continue;
    const url = (lines.slice(i + 1).find((l) => l.trim() && !l.startsWith('#')) || '').trim();
    if (/^https:\/\//i.test(url) && !/geo-?blocked/i.test(lines[i])) out.push({ info: lines[i], url });
  }
  return out;
}

// Confere a playlist e um trecho de vídeo (ou a sub-playlist), sempre exigindo CORS.
async function works({ url }) {
  try {
    const res = await get(url);
    if (!res.ok || !cors(res)) return false;
    const text = await res.text();
    if (!text.startsWith('#EXTM3U')) return false;
    const next = text.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#'));
    if (!next) return false;
    const target = new URL(next.trim(), res.url).href;
    const r2 = await get(target, { headers: { Range: 'bytes=0-1023' } });
    if (!(r2.ok || r2.status === 206) || !cors(r2)) return false;
    if (/\.m3u8?(\?|$)/i.test(target)) {                  // master -> checa também um trecho da variante
      const t2 = await r2.text();
      const seg = t2.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#'));
      if (!seg) return false;
      const r3 = await get(new URL(seg.trim(), r2.url).href, { headers: { Range: 'bytes=0-1023' } });
      return (r3.ok || r3.status === 206) && cors(r3);
    }
    return true;
  } catch { return false; }
}

const seen = new Set();
const all = [];
for (const s of SOURCES) {
  try { (await load(s)).forEach((c) => { if (!seen.has(c.url)) { seen.add(c.url); all.push(c); } }); }
  catch (e) { console.warn('falhou', String(s), e.message); }
}
console.log('canais https para testar:', all.length);

const good = [];
let next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < all.length) {
    const c = all[next++];
    if (await works(c)) good.push(c);
  }
}));

good.sort((a, b) => a.info.split(',').pop().localeCompare(b.info.split(',').pop()));
const body = ['#EXTM3U', ...good.flatMap((c) => [c.info, c.url])].join('\n') + '\n';
await writeFile(new URL('../lists/brasil-verificados.m3u', import.meta.url), body);
console.log(`funcionam: ${good.length} de ${all.length}`);
