(() => {
  const $ = (id) => document.getElementById(id);
  const hero = $('hero'), rows = $('rows'), empty = $('empty'), search = $('search');
  const modal = $('player-modal'), video = $('video');
  const dlg = $('jf-modal');

  const LocalSource = { label: 'Amostras · Blender Foundation', load: async () => LOCAL_CATALOG };
  JellyfinSource.byGenre = true;
  const SOURCES = [JellyfinSource, IptvSource, Tmdb, ArchiveSource, LocalSource];

  // Estado persistido (localStorage pode falhar em modo privado)
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem('rs:' + key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('rs:' + key, JSON.stringify(value)); } catch { /* ignora */ }
    },
  };
  let myList = new Set(store.get('list', []));
  let progress = store.get('progress', {});
  let view = 'home';
  let current = null;
  let sections = [];   // [{ source, items }]
  let hls = null;
  let remote = [];     // resultados da busca ao vivo no Archive
  let searchTimer = null;
  let searching = false;
  let tvGroup = '';                           // categoria selecionada na TV ao vivo ('' = todas)
  let tvOrder = [];                           // ids dos canais exibidos, para trocar de canal
  let favs = new Set(store.get('favs', []));

  // Sincroniza tudo com a conta (se logado). localStorage continua como cache local.
  let syncTimer = null;
  const sync = () => {
    if (!Cloud.user()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => Cloud.push({
      tmdb_key: Tmdb.apiKey() || null,
      jellyfin: JellyfinSource.config() || null,
      my_list: [...myList],
      progress,
    }), 1500);
  };

  const allItems = () => sections.flatMap((s) => s.items);
  const byId = (id) => allItems().concat(remote).find((t) => t.id === id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gradient = (t) => `linear-gradient(160deg,hsl(${t.hue} 60% 38%),hsl(${(t.hue + 50) % 360} 55% 12%))`;
  const posterStyle = (t) => t.source === 'iptv'
    ? (t.poster ? `background:url('${esc(t.poster)}') center 40%/60% no-repeat,${gradient(t)}` : `background:${gradient(t)}`)
    : t.poster
    ? `background:linear-gradient(transparent 45%,#000d),url('${esc(t.poster)}') center/cover,${gradient(t)}`
    : `background:${gradient(t)}`;

  function card(t) {
    const pct = progress[t.id]?.pct || 0;
    return `<button class="card" data-id="${esc(t.id)}" style="${posterStyle(t)}" aria-label="Assistir ${esc(t.title)}">
      ${t.live ? `<span class="live">AO VIVO</span><span class="fav" data-fav="${esc(t.id)}" title="Favorito">${favs.has(t.id) ? '★' : '☆'}</span>` : ''}
      <span class="card-title">${esc(t.title)}</span>
      <span class="card-meta">${esc([t.year, t.genre].filter(Boolean).join(' · '))}</span>
      ${pct > 0 ? `<span class="bar"><i style="width:${pct}%"></i></span>` : ''}
    </button>`;
  }

  function row(title, items) {
    if (!items.length) return '';
    return `<section class="row"><h2>${esc(title)}</h2><div class="strip">${items.map(card).join('')}</div></section>`;
  }

  function renderHero() {
    const items = allItems();
    const t = items.find((x) => x.poster && x.source !== 'archive' && !x.live) || items.find((x) => x.poster) || items[0];
    if (!t) return;
    hero.style.cssText = t.poster
      ? `background:linear-gradient(90deg,#000c 20%,transparent),url("${esc(t.poster)}") center/cover,${gradient(t)}`
      : `background:${gradient(t)}`;
    hero.innerHTML = `<div class="hero-inner">
      <h1>${esc(t.title)}</h1>
      <p>${esc(t.desc)}</p>
      <div class="actions">
        <button class="btn primary" data-play="${esc(t.id)}">${t.source === 'tmdb' ? 'Detalhes e trailer' : '▶ Assistir'}</button>
        <button class="btn" data-toggle="${esc(t.id)}">${myList.has(t.id) ? '✓ Na minha lista' : '+ Minha lista'}</button>
      </div></div>`;
    hero.hidden = false;
  }

  const isSeries = (t) => t.type === 'tv';
  const isMovie = (t) => !t.live && t.type !== 'tv';

  // Fileiras por gênero para as fontes que agrupam (byGenre) e uma fileira por fonte para as demais.
  function genreRows(filter) {
    let html = '';
    sections.forEach(({ source, items: list }) => {
      const pool = list.filter(filter);
      if (!source.byGenre) { html += row(source.label, pool); return; }
      [...new Set(pool.map((t) => t.genre))].forEach((g) => {
        html += row(g, pool.filter((t) => t.genre === g));
      });
    });
    return html;
  }

  function renderTv(q) {
    const live = allItems().filter((t) => t.live);
    const groups = [...new Set(live.map((t) => t.genre))];
    $('tvbar').innerHTML = ['', ...groups].map((g) =>
      `<button class="chip-btn${g === tvGroup ? ' is-on' : ''}" data-group="${esc(g)}">${g ? esc(g) : 'Todos'}</button>`).join('');
    $('tvbar').hidden = !live.length;

    const shown = live.filter((t) => (!tvGroup || t.genre === tvGroup) && (!q || t.title.toLowerCase().includes(q)));
    const grid = (title, list) => list.length
      ? `<section class="row"><h2>${esc(title)} <small>${list.length}</small></h2><div class="grid">${list.map(card).join('')}</div></section>` : '';
    let html = '';
    tvOrder = [];
    if (!q && !tvGroup) {
      const last = byId(store.get('lastTv', ''));
      html += grid('Último canal', last ? [last] : []);
      html += grid('Favoritos', live.filter((t) => favs.has(t.id)));
    }
    [...new Set(shown.map((t) => t.genre))].forEach((g) => {
      const list = shown.filter((t) => t.genre === g);
      tvOrder.push(...list.map((t) => t.id));
      html += grid(g, list);
    });
    rows.innerHTML = html;
    empty.textContent = live.length ? 'Nenhum canal encontrado.'
      : (sections.length ? 'Nenhum canal. Adicione uma lista em ⚙ > Listas de TV.' : 'Carregando canais…');
    empty.hidden = !!shown.length;
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    hero.hidden = true;
    $('tvbar').hidden = true;
    document.body.dataset.view = view;
    if (view === 'tv') return renderTv(q);

    const items = allItems().filter((t) => !t.live);
    const scope = view === 'movies' ? isMovie : view === 'series' ? isSeries : () => true;
    let html = '';
    let any = false;

    if (q) {
      const local = items.filter((t) => scope(t) && (t.title + ' ' + t.genre).toLowerCase().includes(q));
      const hits = [...local, ...remote.filter((r) => scope(r) && !local.some((l) => l.id === r.id))];
      html = row(`Resultados para “${search.value.trim()}”`, hits);
      any = hits.length > 0;
      empty.textContent = q.length >= 3 && searching ? 'Buscando…' : 'Nenhum título encontrado.';
    } else if (view === 'list') {
      const mine = items.filter((t) => myList.has(t.id));
      html = row('Minha lista', mine);
      any = mine.length > 0;
      empty.textContent = 'Sua lista está vazia. Abra um título e adicione à lista.';
    } else {
      if (view === 'home') renderHero();
      html += row('Continuar assistindo', items.filter((t) => scope(t) && progress[t.id]?.pct > 0 && progress[t.id].pct < 98));
      html += genreRows((t) => !t.live && scope(t));
      any = items.some(scope);
      empty.textContent = sections.length ? 'Nada por aqui ainda.' : 'Carregando catálogo…';
    }
    rows.innerHTML = html;
    empty.hidden = any;
  }

  async function loadCatalog() {
    empty.hidden = false;
    empty.textContent = 'Carregando catálogo…';
    $('jf-btn').textContent = JellyfinSource.isConnected() ? 'Jellyfin ✓' : 'Conectar Jellyfin';
    sections = [];
    // Cada fonte aparece assim que carrega, sem esperar as mais lentas.
    const add = (source, items) => {
      if (!items.length) return;
      const cur = sections.find((x) => x.source === source);
      if (cur) cur.items = [...cur.items, ...items];
      else sections = [...sections, { source, items }].sort((x, y) => SOURCES.indexOf(x.source) - SOURCES.indexOf(y.source));
      if (!search.value) render();
    };
    // Cada fonte (e cada fileira do Archive) aparece assim que carrega.
    await Promise.all(SOURCES.map(async (source) => {
      try { add(source, await source.load((part) => add(source, part))); } catch (err) { console.warn(source.label, err); }
    }));
    if (!sections.length) { empty.textContent = 'Nenhum título disponível.'; return; }
    render();
    Tmdb.enrich(allItems(), () => { if (!search.value) render(); });
  }

  function toggleList(id) {
    myList.has(id) ? myList.delete(id) : myList.add(id);
    store.set('list', [...myList]);
    sync();
    render();
  }

  function loadHls() {
    if (window.Hls) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function attach({ url, hls: isHls }) {
    if (!isHls) { video.src = url; return; }
    // Prefere hls.js (MSE); o HLS nativo fica para o Safari/iOS, onde o hls.js não roda.
    await loadHls().catch(() => {});
    if (!(window.Hls && Hls.isSupported())) { video.src = url; return; }
    hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) $('player-desc').textContent = 'Este canal não respondeu (offline, bloqueado ou sem CORS).';
    });
  }

  // Detalhes de títulos do TMDB: trailer e onde assistir legalmente (o vídeo completo não é hospedado aqui).
  const det = $('det-modal');
  const chips = (label, names) => names.length
    ? `<p class="where"><b>${label}</b> ${names.map((n) => `<span class="chip">${esc(n)}</span>`).join('')}</p>` : '';

  async function openDetail(t) {
    $('det-title').textContent = t.title;
    $('det-meta').textContent = [t.year, t.type === 'tv' ? 'Série' : 'Filme'].filter(Boolean).join(' · ');
    $('det-desc').textContent = t.desc;
    $('det-trailer').innerHTML = '';
    $('det-where').innerHTML = '<p class="hint">Carregando…</p>';
    const btn = $('det-list');
    btn.textContent = myList.has(t.id) ? '✓ Na minha lista' : '+ Minha lista';
    btn.onclick = () => { toggleList(t.id); btn.textContent = myList.has(t.id) ? '✓ Na minha lista' : '+ Minha lista'; };
    det.hidden = false;
    document.body.classList.add('no-scroll');
    try {
      const d = await Tmdb.details(t);
      if (det.hidden) return;
      $('det-meta').textContent = [t.year, t.type === 'tv' ? 'Série' : 'Filme', d.genres, d.runtime ? d.runtime + ' min' : '']
        .filter(Boolean).join(' · ');
      if (d.trailerKey) {
        $('det-trailer').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(d.trailerKey)}?rel=0" title="Trailer" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      } else {
        $('det-trailer').innerHTML = `<div class="no-trailer" style="${posterStyle(t)}"></div>`;
      }
      const any = d.stream.length || d.rent.length || d.buy.length;
      $('det-where').innerHTML = any
        ? chips('Assistir em', d.stream) + chips('Alugar em', d.rent) + chips('Comprar em', d.buy)
          + (d.link ? `<p><a class="btn primary" href="${esc(d.link)}" target="_blank" rel="noopener">Abrir onde assistir</a></p>` : '')
        : '<p class="hint">Ainda não disponível em serviços no Brasil.</p>';
    } catch (err) {
      console.warn(err);
      $('det-where').innerHTML = '<p class="hint">Não foi possível carregar os detalhes.</p>';
    }
  }

  function closeDetail() {
    if (det.hidden) return;
    $('det-trailer').innerHTML = '';
    det.hidden = true;
    document.body.classList.remove('no-scroll');
    render();
  }
  $('det-close').addEventListener('click', closeDetail);

  // Para a reprodução atual sem fechar a janela (usado ao trocar de canal).
  function teardown() {
    saveProgress();
    video.pause();
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src');
    video.load();
  }

  function toggleFav(id) {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set('favs', [...favs]);
    render();
  }

  function zap(dir) {
    if (!current || !current.live) return;
    const order = tvOrder.length ? tvOrder : allItems().filter((t) => t.live).map((t) => t.id);
    const i = order.indexOf(current.id);
    openPlayer(order[(i + dir + order.length) % order.length]);
  }

  async function openPlayer(id) {
    const t = byId(id);
    if (!t) return;
    if (t.source === 'tmdb') return openDetail(t);
    if (current) teardown();
    current = t;
    $('zap').hidden = !t.live;
    if (t.live) store.set('lastTv', t.id);
    $('player-title').textContent = t.title;
    $('player-desc').textContent = t.desc;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    try {
      await attach(t.resolve ? await t.resolve() : { url: t.video });
    } catch (err) {
      console.warn(err);
      $('player-desc').textContent = 'Não foi possível carregar este vídeo.';
      return;
    }
    if (current !== t) return; // fechado enquanto carregava
    const saved = progress[id];
    video.addEventListener('loadedmetadata', () => {
      if (saved && saved.pct < 98) video.currentTime = (saved.pct / 100) * video.duration;
    }, { once: true });
    video.play().catch(() => { /* autoplay bloqueado: usuário usa os controles */ });
  }

  function closePlayer() {
    if (modal.hidden) return;
    saveProgress();
    video.pause();
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src');
    video.load();
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    current = null;
    render();
  }

  function saveProgress() {
    if (!current || current.live || !isFinite(video.duration) || !video.duration) return;
    progress[current.id] = { pct: Math.round((video.currentTime / video.duration) * 100) };
    store.set('progress', progress);
    sync();
  }

  // Conexão com o Jellyfin
  function openJellyfin() {
    const connected = JellyfinSource.isConnected();
    $('jf-form').hidden = connected;
    $('jf-connected').hidden = !connected;
    $('jf-error').textContent = '';
    dlg.hidden = false;
  }

  $('jf-btn').addEventListener('click', openJellyfin);
  $('jf-cancel').addEventListener('click', () => { dlg.hidden = true; });
  $('jf-logout').addEventListener('click', () => { JellyfinSource.logout(); dlg.hidden = true; sync(); loadCatalog(); });
  $('jf-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    $('jf-error').textContent = 'Conectando…';
    try {
      await JellyfinSource.login(f.server.value, f.user.value, f.pass.value);
      f.pass.value = '';
      dlg.hidden = true;
      sync();
      loadCatalog();
    } catch (err) {
      $('jf-error').textContent = err.message === 'Failed to fetch'
        ? 'Não foi possível acessar o servidor (verifique HTTPS e CORS).' : err.message;
    }
  });

  // Listas de TV ao vivo
  const tv = $('tv-modal');
  const renderLists = () => {
    $('tv-lists').innerHTML = IptvSource.lists().map((l, i) =>
      `<li><span>${esc(l.name)}</span><button class="btn" data-rm="${i}" type="button">Remover</button></li>`).join('')
      || '<li class="hint">Nenhuma lista.</li>';
  };
  $('tv-btn').addEventListener('click', () => { renderLists(); tv.hidden = false; });
  $('tv-close').addEventListener('click', () => { tv.hidden = true; });
  $('tv-lists').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    IptvSource.remove(+b.dataset.rm); renderLists(); loadCatalog();
  });
  $('tv-reset').addEventListener('click', () => { IptvSource.reset(); renderLists(); loadCatalog(); });
  $('tv-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    IptvSource.add(f.name.value, f.url.value);
    f.reset(); renderLists(); loadCatalog();
  });

  // Conta (Supabase)
  const ac = $('ac-modal');
  const refreshAccount = () => {
    const u = Cloud.user();
    $('ac-btn').textContent = u ? 'Conta ✓' : 'Conta';
    $('ac-off').hidden = Cloud.enabled;
    $('ac-form').hidden = !Cloud.enabled || !!u;
    $('ac-in').hidden = !u;
    if (u) $('ac-email').textContent = u.email;
  };
  async function applyRemote() {
    const row = await Cloud.pull();
    if (!row) { sync(); return; }               // primeira vez: sobe o que já existe no navegador
    if (row.tmdb_key) Tmdb.setKey(row.tmdb_key);
    if (row.jellyfin) JellyfinSource.restore(row.jellyfin);
    myList = new Set([...myList, ...(row.my_list || [])]);
    progress = { ...progress, ...(row.progress || {}) };
    store.set('list', [...myList]);
    store.set('progress', progress);
  }
  $('ac-btn').addEventListener('click', () => { $('ac-error').textContent = ''; refreshAccount(); ac.hidden = false; });
  $('ac-cancel').addEventListener('click', () => { ac.hidden = true; });
  $('ac-close').addEventListener('click', () => { ac.hidden = true; });
  $('ac-logout').addEventListener('click', async () => { await Cloud.signOut(); refreshAccount(); ac.hidden = true; });
  const authSubmit = (fn) => async () => {
    const f = $('ac-form');
    if (!f.reportValidity()) return;
    $('ac-error').textContent = 'Aguarde…';
    try {
      await fn(f.email.value, f.pass.value);
      f.pass.value = '';
      $('ac-error').textContent = '';
      await applyRemote();
      refreshAccount();
      ac.hidden = true;
      loadCatalog();
    } catch (err) { $('ac-error').textContent = err.message; }
  };
  $('ac-form').addEventListener('submit', (e) => { e.preventDefault(); authSubmit(Cloud.signIn)(); });
  $('ac-signup').addEventListener('click', authSubmit(Cloud.signUp));

  // Chave do TMDB (capas reais)
  const tm = $('tm-modal');
  $('tm-btn').addEventListener('click', () => {
    $('tm-key').value = Tmdb.apiKey();
    tm.hidden = false;
  });
  $('tm-cancel').addEventListener('click', () => { tm.hidden = true; });
  $('tm-form').addEventListener('submit', (e) => {
    e.preventDefault();
    Tmdb.setKey($('tm-key').value);
    sync();
    tm.hidden = true;
    loadCatalog();
  });

  // Eventos
  document.addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) return toggleFav(fav.dataset.fav);
    const grp = e.target.closest('[data-group]');
    if (grp) { tvGroup = grp.dataset.group; return render(); }
    const mi = e.target.closest('.menu-item');
    if (mi) $('menu').open = false;
    const c = e.target.closest('.card');
    if (c) return openPlayer(c.dataset.id);
    const play = e.target.closest('[data-play]');
    if (play) return openPlayer(play.dataset.play);
    const tog = e.target.closest('[data-toggle]');
    if (tog) return toggleList(tog.dataset.toggle);
    if (e.target === modal) closePlayer();
    if (e.target === dlg) dlg.hidden = true;
    if (e.target === tm) tm.hidden = true;
    if (e.target === ac) ac.hidden = true;
    if (e.target === tv) tv.hidden = true;
    if (e.target === det) closeDetail();
  });
  $('player-close').addEventListener('click', closePlayer);
  $('zap-prev').addEventListener('click', () => zap(-1));
  $('zap-next').addEventListener('click', () => zap(1));
  document.addEventListener('keydown', (e) => {
    if (!modal.hidden && current && current.live && (e.key === 'PageUp' || e.key === 'PageDown')) {
      e.preventDefault(); return zap(e.key === 'PageUp' ? -1 : 1);
    }
    if (e.key !== 'Escape') return;
    if (!det.hidden) closeDetail(); else if (!tv.hidden) tv.hidden = true; else if (!dlg.hidden) dlg.hidden = true; else if (!tm.hidden) tm.hidden = true; else if (!ac.hidden) ac.hidden = true; else closePlayer();
  });
  video.addEventListener('timeupdate', () => { if (Math.round(video.currentTime) % 5 === 0) saveProgress(); });
  video.addEventListener('pause', saveProgress);

  document.querySelectorAll('.tab[data-view]').forEach((b) => b.addEventListener('click', () => {
    view = b.dataset.view;
    search.value = '';
    remote = [];
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('is-active', x === b));
    render();
  }));
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = search.value.trim();
    remote = [];
    searching = q.length >= 3 && view !== 'tv';
    render();
    if (!searching) return;
    searchTimer = setTimeout(async () => {
      try { remote = await ArchiveSource.search(q); } catch (err) { console.warn(err); }
      searching = false;
      if (search.value.trim() === q) render();
    }, 400);
  });
  const measure = () => document.documentElement.style.setProperty('--top', $('topbar').offsetHeight + 'px');
  window.addEventListener('resize', measure);
  measure();
  window.addEventListener('scroll', () => $('topbar').classList.toggle('solid', scrollY > 20), { passive: true });

  (async () => {
    if (await Cloud.init()) await applyRemote();
    refreshAccount();
    loadCatalog();
  })();
})();
