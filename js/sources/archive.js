// Fonte: Internet Archive (filmes de domínio público). API aberta, sem chave.
const ArchiveSource = (() => {
  const SEARCH = 'https://archive.org/advancedsearch.php';
  const PAGE = 40;

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

  async function load() {
    const params = new URLSearchParams({
      q: 'collection:feature_films AND mediatype:movies AND format:(h.264)',
      sort: 'downloads desc',
      rows: PAGE,
      output: 'json',
    });
    ['identifier', 'title', 'description', 'year'].forEach((f) => params.append('fl[]', f));
    const res = await fetch(`${SEARCH}?${params}`);
    if (!res.ok) throw new Error('busca ' + res.status);
    const { response } = await res.json();
    return response.docs.map((d) => ({
      id: 'ia:' + d.identifier,
      title: text(d.title) || d.identifier,
      year: parseInt(d.year, 10) || '',
      genre: 'Domínio público',
      desc: text(d.description).slice(0, 220) || 'Filme de domínio público do Internet Archive.',
      poster: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
      hue: (d.identifier.charCodeAt(0) * 37) % 360,
      source: 'archive',
      resolve: () => resolve(d.identifier),
    }));
  }

  return { label: 'Internet Archive · domínio público', load };
})();
