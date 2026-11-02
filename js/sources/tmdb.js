// Capas e sinopses reais via TMDB (opcional). A chave é pessoal e fica só no localStorage do navegador.
// Crie uma chave grátis em themoviedb.org > Configurações > API (chave "v3").
const Tmdb = (() => {
  const KEY = 'rs:tmdb-key';
  const CACHE = 'rs:tmdb-cache';
  const IMG = 'https://image.tmdb.org/t/p/w342';

  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignora */ } };

  let cache = {};
  try { cache = JSON.parse(get(CACHE)) || {}; } catch { cache = {}; }

  const apiKey = () => get(KEY) || '';
  const setKey = (k) => {
    try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch { /* ignora */ }
  };

  // Tira anos, colchetes e sufixos comuns de títulos do Archive para melhorar a busca.
  const clean = (t) => t.replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\b(19|20)\d\d\b/g, ' ')
    .replace(/\b(complete|full movie|hd|1080p|720p|remastered)\b/gi, ' ').replace(/\s+/g, ' ').trim();

  async function lookup(item) {
    // Aceita a chave v3 (curta) ou o Token de Leitura v4 (começa com "eyJ").
    const key = apiKey();
    const bearer = key.startsWith('eyJ');
    const q = new URLSearchParams({ language: 'pt-BR', query: clean(item.title) });
    if (!bearer) q.set('api_key', key);
    if (item.year) q.set('year', item.year);
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?${q}`, bearer ? { headers: { Authorization: 'Bearer ' + key } } : undefined);
    if (res.status === 401) throw new Error('chave inválida');
    if (!res.ok) throw new Error('tmdb ' + res.status);
    const hit = (await res.json()).results.find((r) => r.poster_path);
    return hit ? { poster: IMG + hit.poster_path, desc: hit.overview || '' } : { poster: '', desc: '' };
  }

  // Troca capa e sinopse dos itens, no máximo 6 buscas ao mesmo tempo. onUpdate roda a cada lote.
  async function enrich(items, onUpdate) {
    if (!apiKey()) return;
    const todo = items.filter((i) => i.source === 'archive');
    let dirty = false, n = 0;
    const apply = (i, m) => {
      if (m.poster) i.poster = m.poster;
      if (m.desc) i.desc = m.desc;
    };
    todo.filter((i) => cache[i.id]).forEach((i) => apply(i, cache[i.id]));
    const pending = todo.filter((i) => !cache[i.id]);
    let stop = false;
    const worker = async () => {
      while (pending.length && !stop) {
        const i = pending.shift();
        try {
          const m = await lookup(i);
          cache[i.id] = m; apply(i, m); dirty = true;
          if (++n % 25 === 0) onUpdate && onUpdate();
        } catch (err) {
          if (err.message === 'chave inválida') { stop = true; console.warn('TMDB: chave inválida'); }
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (dirty) set(CACHE, JSON.stringify(cache));
    onUpdate && onUpdate();
  }

  return { apiKey, setKey, enrich };
})();
