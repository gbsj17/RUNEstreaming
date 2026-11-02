// Fonte: servidor Jellyfin próprio. O login é feito no navegador e o token fica no localStorage;
// nenhuma credencial vai para o repositório. O servidor precisa estar em HTTPS e liberar este
// domínio em CORS (Painel > Rede > "Permitir CORS").
const JellyfinSource = (() => {
  const KEY = 'rs:jellyfin';
  const AUTH = 'MediaBrowser Client="RUNEstreaming", Device="Web", DeviceId="runestreaming-web", Version="1.0.0"';

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignora */ } };

  const cleanUrl = (u) => u.trim().replace(/\/+$/, '');
  const isConnected = () => !!read();

  async function login(server, username, password) {
    server = cleanUrl(server);
    const res = await fetch(`${server}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Emby-Authorization': AUTH },
      body: JSON.stringify({ Username: username, Pw: password }),
    });
    if (!res.ok) throw new Error(res.status === 401 ? 'Usuário ou senha inválidos.' : 'Erro ' + res.status);
    const data = await res.json();
    write({ server, token: data.AccessToken, userId: data.User.Id });
  }

  function logout() {
    try { localStorage.removeItem(KEY); } catch { /* ignora */ }
  }

  async function load() {
    const cfg = read();
    if (!cfg) return [];
    const q = new URLSearchParams({
      IncludeItemTypes: 'Movie', Recursive: 'true', SortBy: 'SortName',
      Fields: 'Overview,Genres,ProductionYear',
    });
    const res = await fetch(`${cfg.server}/Users/${cfg.userId}/Items?${q}`, { headers: { 'X-Emby-Token': cfg.token } });
    if (res.status === 401) { logout(); throw new Error('Sessão do Jellyfin expirou.'); }
    if (!res.ok) throw new Error('Jellyfin ' + res.status);
    const { Items } = await res.json();
    return Items.map((i) => ({
      id: 'jf:' + i.Id,
      title: i.Name,
      year: i.ProductionYear || '',
      genre: (i.Genres && i.Genres[0]) || 'Sem gênero',
      desc: i.Overview || '',
      poster: i.ImageTags && i.ImageTags.Primary
        ? `${cfg.server}/Items/${i.Id}/Images/Primary?maxWidth=400&tag=${i.ImageTags.Primary}` : '',
      hue: (i.Name.charCodeAt(0) * 37) % 360,
      source: 'jellyfin',
      resolve: async () => ({
        url: `${cfg.server}/Videos/${i.Id}/master.m3u8?MediaSourceId=${i.Id}&api_key=${cfg.token}`,
        hls: true,
      }),
    }));
  }

  return { label: 'Minha biblioteca · Jellyfin', isConnected, login, logout, load };
})();
