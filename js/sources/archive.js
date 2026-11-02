// Fonte: Internet Archive (filmes e séries de domínio público). API aberta, sem chave.
const ArchiveSource = (() => {
  const SEARCH = 'https://archive.org/advancedsearch.php';
  const BASE = 'mediatype:movies AND format:(h.264) AND NOT title:(sex)';

  // Fileira -> consulta. O Archive é grande; cada fileira traz os mais assistidos.
  const ROWS = {
    'Clássicos': 'collection:feature_films',
    'Animação': 'collection:animationandcartoons',
    'Comédia': 'collection:feature_films AND subject:(comedy)',
    'Terror': 'collection:feature_films AND subject:(horror)',
    'Ficção científica': 'collection:feature_films AND subject:("science fiction")',
    'Faroeste': 'collection:feature_films AND subject:(western)',
    'Noir e crime': 'collection:feature_films AND subject:(noir OR crime)',
    'Drama': 'collection:feature_films AND subject:(drama)',
    'Romance': 'collection:feature_films AND subject:(romance)',
    'Aventura': 'collection:feature_films AND subject:(adventure)',
    'Ação': 'collection:feature_films AND subject:(action)',
    'Mistério': 'collection:feature_films AND subject:(mystery)',
    'Musical': 'collection:feature_films AND subject:(musical)',
    'Fantasia': 'collection:feature_films AND subject:(fantasy)',
    'Documentários': 'collection:feature_films AND subject:(documentary)',
    'Séries clássicas': 'collection:classic_tv',
  };
  const PAGE = 40;

  const text = (v) => {
    const s = Array.isArray(v) ? v.join(' ') : (v || '');
    return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  // O arquivo .mp4 só é descoberto na hora de assistir (um item pode ter vários arquivos).
  async function resolve(identifier) {
    let data;
    for (let i = 0; i < 3 && !data; i++) {       // o servidor às vezes responde 503 na primeira tentativa
      try {
        const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
        if (res.ok) data = await res.json();
      } catch { /* tenta de novo */ }
      if (!data) await new Promise((r) => setTimeout(r, 800));
    }
    if (!data) throw new Error('metadata');
    const { files = [] } = data;
    const mp4s = files.filter((f) => /\.mp4$/i.test(f.name));
    // Prefere as versões otimizadas para streaming; o original (MPEG4) pode ter centenas de MB e demora a começar.
    const rank = (f) => { const i = ['h.264 IA', 'h.264', '512Kb MPEG4'].indexOf(f.format); return i < 0 ? 9 : i; };
    const sorted = [...mp4s].sort((a, b) => rank(a) - rank(b) || (+a.size || 0) - (+b.size || 0));
    if (!sorted.length) throw new Error('sem mp4');
    const urls = sorted.map((f) => `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(f.name)}`);
    return { url: urls[0], alts: urls.slice(1, 4) };   // alternativas, caso o primeiro arquivo falhe
  }

  const TTL = 6 * 3600 * 1000;
  const cacheGet = (k) => {
    try { const c = JSON.parse(localStorage.getItem('rs:ia:' + k)); return c && Date.now() - c.t < TTL ? c.docs : null; } catch { return null; }
  };
  const cacheSet = (k, docs) => {
    try { localStorage.setItem('rs:ia:' + k, JSON.stringify({ t: Date.now(), docs })); } catch { /* ignora */ }
  };

  const toItem = (d, genre) => ({
    id: 'ia:' + d.identifier,
    title: text(d.title) || d.identifier,
    year: parseInt(d.year, 10) || '',
    genre,
    type: genre === 'Séries clássicas' ? 'tv' : 'movie',
    desc: text(d.description).slice(0, 260) || 'Título de domínio público do Internet Archive.',
    poster: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
    hue: (d.identifier.charCodeAt(0) * 37) % 360,
    source: 'archive',
    resolve: () => resolve(d.identifier),
  });

  async function fetchDocs(q, rows) {
    const params = new URLSearchParams({ q: `${BASE} AND ${q}`, sort: 'downloads desc', rows, output: 'json' });
    ['identifier', 'title', 'description', 'year'].forEach((f) => params.append('fl[]', f));
    const res = await fetch(`${SEARCH}?${params}`);
    if (!res.ok) throw new Error('busca ' + res.status);
    return (await res.json()).response.docs;
  }

  async function query(q, genre, rows = PAGE, cacheKey) {
    let docs = cacheKey && cacheGet(cacheKey);
    if (!docs) {
      docs = await fetchDocs(q, rows);
      if (cacheKey) cacheSet(cacheKey, docs);
    }
    return docs.map((d) => toItem(d, genre));
  }

  // onPart recebe cada fileira assim que ela chega; o retorno traz tudo de uma vez.
  async function load(onPart) {
    const seen = new Set();
    const all = [];
    await Promise.allSettled(Object.entries(ROWS).map(async ([genre, q]) => {
      // Um título aparece só na primeira fileira em que entrou.
      const part = (await query(q, genre, PAGE, genre)).filter((t) => !seen.has(t.id) && seen.add(t.id));
      all.push(...part);
      onPart && onPart(part);
    }));
    return onPart ? [] : all;
  }

  const escapeQ = (s) => s.replace(/["\\()\[\]:]/g, ' ').trim();
  const search = (q) => query(`title:(${escapeQ(q)}*)`, 'Resultados', 40);

  return { label: 'Internet Archive', byGenre: true, load, search };
})();
