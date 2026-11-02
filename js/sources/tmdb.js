// TMDB: capas e sinopses dos títulos do Archive, fileiras de lançamentos/populares e detalhes
// (trailer e onde assistir). Usa a chave de js/config.js, ou a que o usuário salvar no botão "Capas".
// O TMDB só fornece informação: o vídeo completo vem do Archive/Jellyfin; para os demais, o site
// mostra o trailer e os serviços legais onde o título está disponível.
const Tmdb = (() => {
  const KEY = 'rs:tmdb-key';
  const CACHE = 'rs:tmdb-cache';
  const IMG = 'https://image.tmdb.org/t/p/w342';
  const API = 'https://api.themoviedb.org/3';

  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignora */ } };

  let cache = {};
  try { cache = JSON.parse(get(CACHE)) || {}; } catch { cache = {}; }

  // Chave salva pelo usuário (botão "Capas") ou a padrão de js/config.js.
  const apiKey = () => get(KEY) || (window.RS_CONFIG && window.RS_CONFIG.tmdbKey) || '';
  const setKey = (k) => {
    try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch { /* ignora */ }
  };

  // Aceita a chave v3 (curta) ou o Token de Leitura v4 (começa com "eyJ").
  async function api(path, params = {}) {
    const key = apiKey();
    const bearer = key.startsWith('eyJ');
    const q = new URLSearchParams({ language: 'pt-BR', ...params });
    if (!bearer) q.set('api_key', key);
    const res = await fetch(`${API}${path}?${q}`, bearer ? { headers: { Authorization: 'Bearer ' + key } } : undefined);
    if (res.status === 401) throw new Error('chave inválida');
    if (!res.ok) throw new Error('tmdb ' + res.status);
    return res.json();
  }

  // Tira anos, colchetes e sufixos comuns de títulos do Archive para melhorar a busca.
  const clean = (t) => t.replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\b(19|20)\d\d\b/g, ' ')
    .replace(/\b(complete|full movie|hd|1080p|720p|remastered)\b/gi, ' ').replace(/\s+/g, ' ').trim();

  async function lookup(item) {
    const params = { query: clean(item.title) };
    if (item.year) params.year = item.year;
    const hit = (await api('/search/movie', params)).results.find((r) => r.poster_path);
    return hit ? { poster: IMG + hit.poster_path, desc: hit.overview || '' } : { poster: '', desc: '' };
  }

  // Troca capa e sinopse dos itens do Archive, no máximo 6 buscas ao mesmo tempo.
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

  // Fileiras do catálogo: [nome, caminho, tipo, parâmetros]
  const ROWS = [
    ['Em alta esta semana', '/trending/movie/week', 'movie', {}],
    ['Em cartaz', '/movie/now_playing', 'movie', { region: 'BR' }],
    ['Séries em alta', '/trending/tv/week', 'tv', {}],
    ['Filmes populares', '/movie/popular', 'movie', { region: 'BR' }],
    ['Mais bem avaliados', '/movie/top_rated', 'movie', { region: 'BR' }],
    ['Séries populares', '/tv/popular', 'tv', {}],
  ];

  const toItem = (r, type, genre) => {
    const title = r.title || r.name || '';
    const date = r.release_date || r.first_air_date || '';
    return {
      id: `tm:${type}:${r.id}`,
      title,
      year: parseInt(date, 10) || '',
      genre,
      desc: r.overview || 'Sem sinopse disponível.',
      poster: r.poster_path ? IMG + r.poster_path : '',
      hue: (title.charCodeAt(0) * 37) % 360 || 200,
      source: 'tmdb',
      tmdbId: r.id,
      type,
    };
  };

  // onPart recebe cada fileira assim que ela chega.
  async function load(onPart) {
    if (!apiKey()) return [];
    const seen = new Set();
    await Promise.allSettled(ROWS.map(async ([genre, path, type, params]) => {
      const { results } = await api(path, params);
      const part = results.filter((r) => r.poster_path)
        .map((r) => toItem(r, type, genre)).filter((t) => !seen.has(t.id) && seen.add(t.id));
      onPart && onPart(part);
    }));
    return [];
  }

  // Trailer (YouTube) e onde assistir no Brasil, em uma chamada só.
  async function details(item) {
    const d = await api(`/${item.type}/${item.tmdbId}`, {
      append_to_response: 'videos,watch/providers',
      include_video_language: 'pt,en,null',
    });
    const vids = (d.videos && d.videos.results || []).filter((v) => v.site === 'YouTube');
    const trailer = vids.find((v) => v.type === 'Trailer' && v.iso_639_1 === 'pt')
      || vids.find((v) => v.type === 'Trailer') || vids[0];
    const br = (d['watch/providers'] && d['watch/providers'].results || {}).BR || {};
    const names = (list) => (list || []).map((p) => p.provider_name);
    return {
      trailerKey: trailer ? trailer.key : '',
      genres: (d.genres || []).map((g) => g.name).join(', '),
      runtime: d.runtime || (d.episode_run_time && d.episode_run_time[0]) || 0,
      link: br.link || '',
      stream: names(br.flatrate),
      rent: names(br.rent),
      buy: names(br.buy),
    };
  }

  return { label: 'TMDB', byGenre: true, apiKey, setKey, enrich, load, details };
})();
