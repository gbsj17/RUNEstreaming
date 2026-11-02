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
    'Documentários': 'collection:feature_films AND subject:(documentary)',
    'Séries clássicas': 'collection:classic_tv',
  };
  const PAGE = 30;

  const text = (v) => {
    const s = Array.isArray(v) ? v.join(' ') : (v || '');
    return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  // O arquivo .mp4 só é descoberto na hora de assistir (um item pode ter vários arquivos).
  async function resolve(identifier) {
    const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
    if (!res.ok) throw new Error('metadata ' + res.status);
    const { files = [] } = await res.json();
    const mp4s = files.filter((f) => /\.mp4$/i.test(f.name));
    const best = mp4s.find((f) => f.format === 'h.264') || mp4s[0];
    if (!best) throw new Error('sem mp4');
    return { url: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(best.name)}` };
  }

  async function query(q, genre, rows = PAGE) {
    const params = new URLSearchParams({ q: `${BASE} AND ${q}`, sort: 'downloads desc', rows, output: 'json' });
    ['identifier', 'title', 'description', 'year'].forEach((f) => params.append('fl[]', f));
    const res = await fetch(`${SEARCH}?${params}`);
    if (!res.ok) throw new Error('busca ' + res.status);
    const { response } = await res.json();
    return response.docs.map((d) => ({
      id: 'ia:' + d.identifier,
      title: text(d.title) || d.identifier,
      year: parseInt(d.year, 10) || '',
      genre,
      desc: text(d.description).slice(0, 260) || 'Título de domínio público do Internet Archive.',
      poster: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
      hue: (d.identifier.charCodeAt(0) * 37) % 360,
      source: 'archive',
      resolve: () => resolve(d.identifier),
    }));
  }

  async function load() {
    const lists = await Promise.allSettled(Object.entries(ROWS).map(([genre, q]) => query(q, genre)));
    const seen = new Set();
    // Um título aparece só na primeira fileira em que entrou.
    return lists.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .filter((t) => !seen.has(t.id) && seen.add(t.id));
  }

  const escapeQ = (s) => s.replace(/["\\()\[\]:]/g, ' ').trim();
  const search = (q) => query(`title:(${escapeQ(q)}*)`, 'Resultados', 40);

  return { label: 'Internet Archive', byGenre: true, load, search };
})();
