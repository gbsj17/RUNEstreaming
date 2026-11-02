(() => {
  const $ = (id) => document.getElementById(id);
  const hero = $('hero'), rows = $('rows'), empty = $('empty'), search = $('search');
  const modal = $('player-modal'), video = $('video');
  const dlg = $('jf-modal');

  const LocalSource = { label: 'Amostras · Blender Foundation', load: async () => LOCAL_CATALOG };
  const SOURCES = [JellyfinSource, ArchiveSource, LocalSource];

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

  const allItems = () => sections.flatMap((s) => s.items);
  const byId = (id) => allItems().find((t) => t.id === id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gradient = (t) => `linear-gradient(160deg,hsl(${t.hue} 60% 38%),hsl(${(t.hue + 50) % 360} 55% 12%))`;
  const posterStyle = (t, shade) => t.poster
    ? `background:linear-gradient(transparent 45%,#000d),url("${esc(t.poster)}") center/cover,${gradient(t)}`
    : `background:${gradient(t)}`;

  function card(t) {
    const pct = progress[t.id]?.pct || 0;
    return `<button class="card" data-id="${esc(t.id)}" style="${posterStyle(t)}" aria-label="Assistir ${esc(t.title)}">
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
    const t = items.find((x) => x.featured) || items[0];
    if (!t) return;
    hero.style.cssText = t.poster
      ? `background:linear-gradient(90deg,#000c 20%,transparent),url("${esc(t.poster)}") center/cover,${gradient(t)}`
      : `background:${gradient(t)}`;
    hero.innerHTML = `<div class="hero-inner">
      <h1>${esc(t.title)}</h1>
      <p>${esc(t.desc)}</p>
      <div class="actions">
        <button class="btn primary" data-play="${esc(t.id)}">▶ Assistir</button>
        <button class="btn" data-toggle="${esc(t.id)}">${myList.has(t.id) ? '✓ Na minha lista' : '+ Minha lista'}</button>
      </div></div>`;
    hero.hidden = false;
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const items = allItems();
    let html = '';
    let any = false;
    hero.hidden = true;

    if (q) {
      const hits = items.filter((t) => (t.title + ' ' + t.genre).toLowerCase().includes(q));
      html = row(`Resultados para “${search.value.trim()}”`, hits);
      any = hits.length > 0;
      empty.textContent = 'Nenhum título encontrado.';
    } else if (view === 'list') {
      const mine = items.filter((t) => myList.has(t.id));
      html = row('Minha lista', mine);
      any = mine.length > 0;
      empty.textContent = 'Sua lista está vazia. Abra um título e adicione à lista.';
    } else {
      renderHero();
      html += row('Continuar assistindo', items.filter((t) => progress[t.id]?.pct > 0 && progress[t.id].pct < 98));
      sections.forEach(({ source, items: list }) => {
        html += row(source.label, list);
        if (source === JellyfinSource) {
          [...new Set(list.map((t) => t.genre))].forEach((g) => {
            html += row(g, list.filter((t) => t.genre === g));
          });
        }
      });
      any = items.length > 0;
      empty.textContent = 'Carregando catálogo…';
    }
    rows.innerHTML = html;
    empty.hidden = any;
  }

  async function loadCatalog() {
    empty.hidden = false;
    empty.textContent = 'Carregando catálogo…';
    const results = await Promise.allSettled(SOURCES.map((s) => s.load()));
    sections = results
      .map((r, i) => ({ source: SOURCES[i], items: r.status === 'fulfilled' ? r.value : [], error: r.reason }))
      .filter((s) => s.items.length);
    results.forEach((r, i) => { if (r.status === 'rejected') console.warn(SOURCES[i].label, r.reason); });
    $('jf-btn').textContent = JellyfinSource.isConnected() ? 'Jellyfin ✓' : 'Conectar Jellyfin';
    render();
  }

  function toggleList(id) {
    myList.has(id) ? myList.delete(id) : myList.add(id);
    store.set('list', [...myList]);
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
    if (!isHls || video.canPlayType('application/vnd.apple.mpegurl')) { video.src = url; return; }
    await loadHls();
    hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
  }

  async function openPlayer(id) {
    const t = byId(id);
    if (!t) return;
    current = t;
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
    if (!current || !video.duration) return;
    progress[current.id] = { pct: Math.round((video.currentTime / video.duration) * 100) };
    store.set('progress', progress);
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
  $('jf-logout').addEventListener('click', () => { JellyfinSource.logout(); dlg.hidden = true; loadCatalog(); });
  $('jf-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    $('jf-error').textContent = 'Conectando…';
    try {
      await JellyfinSource.login(f.server.value, f.user.value, f.pass.value);
      f.pass.value = '';
      dlg.hidden = true;
      loadCatalog();
    } catch (err) {
      $('jf-error').textContent = err.message === 'Failed to fetch'
        ? 'Não foi possível acessar o servidor (verifique HTTPS e CORS).' : err.message;
    }
  });

  // Eventos
  document.addEventListener('click', (e) => {
    const c = e.target.closest('.card');
    if (c) return openPlayer(c.dataset.id);
    const play = e.target.closest('[data-play]');
    if (play) return openPlayer(play.dataset.play);
    const tog = e.target.closest('[data-toggle]');
    if (tog) return toggleList(tog.dataset.toggle);
    if (e.target === modal) closePlayer();
    if (e.target === dlg) dlg.hidden = true;
  });
  $('player-close').addEventListener('click', closePlayer);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!dlg.hidden) dlg.hidden = true; else closePlayer();
  });
  video.addEventListener('timeupdate', () => { if (Math.round(video.currentTime) % 5 === 0) saveProgress(); });
  video.addEventListener('pause', saveProgress);

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    view = b.dataset.view;
    search.value = '';
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('is-active', x === b));
    render();
  }));
  search.addEventListener('input', render);
  window.addEventListener('scroll', () => $('topbar').classList.toggle('solid', scrollY > 20), { passive: true });

  loadCatalog();
})();
