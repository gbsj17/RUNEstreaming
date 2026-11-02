// Fonte: TV ao vivo a partir de listas M3U/HLS que o usuário cadastra (as dele, do provedor dele).
// Por padrão traz os canais abertos do Brasil do projeto iptv-org. Limites do navegador: o servidor do
// canal precisa liberar CORS e usar HTTPS (o Pages é HTTPS); canais que não cumprem isso não tocam aqui.
const IptvSource = (() => {
  const KEY = 'rs:iptv';
  const DEFAULT = [{ name: 'Canais abertos do Brasil', url: 'https://iptv-org.github.io/iptv/countries/br.m3u' }];
  const PER_GROUP = 80;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignora */ } };

  const lists = () => read() || DEFAULT;
  const add = (name, url) => write([...lists(), { name: name.trim() || url, url: url.trim() }]);
  const remove = (i) => write(lists().filter((_, k) => k !== i));
  const reset = () => write(DEFAULT);

  const attr = (line, name) => {
    const m = line.match(new RegExp(name + '="([^"]*)"'));
    return m ? m[1] : '';
  };

  function parse(text, listName) {
    const out = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('#EXTINF')) continue;
      const url = (lines.slice(i + 1).find((l) => l.trim() && !l.startsWith('#')) || '').trim();
      if (!/^https:\/\//i.test(url)) continue;     // http:// é bloqueado pelo navegador numa página HTTPS
      const name = line.slice(line.lastIndexOf(',') + 1).trim() || 'Canal';
      const group = (attr(line, 'group-title').split(';')[0] || listName).trim();
      out.push({
        id: 'tv:' + url,
        title: name,
        year: '',
        genre: group,
        desc: `Ao vivo · ${listName}`,
        poster: attr(line, 'tvg-logo'),
        hue: (name.charCodeAt(0) * 37) % 360,
        source: 'iptv',
        live: true,
        resolve: async () => ({ url, hls: true }),
      });
    }
    return out;
  }

  async function load(onPart) {
    const seen = new Set();
    await Promise.allSettled(lists().map(async (l) => {
      const res = await fetch(l.url);
      if (!res.ok) throw new Error(l.name + ' ' + res.status);
      const items = parse(await res.text(), l.name).filter((t) => !seen.has(t.id) && seen.add(t.id));
      // Limita cada grupo para a tela inicial não ficar enorme; a busca encontra todos.
      const counts = {};
      onPart && onPart(items.filter((t) => (counts[t.genre] = (counts[t.genre] || 0) + 1) <= PER_GROUP));
    }));
    return [];
  }

  return { label: 'TV ao vivo', byGenre: true, load, lists, add, remove, reset };
})();
