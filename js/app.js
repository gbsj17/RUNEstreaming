(() => {
  const $ = (id) => document.getElementById(id);
  const hero = $('hero'), rows = $('rows'), empty = $('empty'), search = $('search');
  const modal = $('player-modal'), video = $('video');

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

  const byId = (id) => CATALOG.find((t) => t.id === id);
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const posterStyle = (t) => `background:linear-gradient(160deg,hsl(${t.hue} 60% 38%),hsl(${(t.hue + 50) % 360} 55% 12%))`;

  function card(t) {
    const pct = progress[t.id]?.pct || 0;
    return `<button class="card" data-id="${t.id}" style="${posterStyle(t)}" aria-label="Assistir ${esc(t.title)}">
      <span class="card-title">${esc(t.title)}</span>
      <span class="card-meta">${t.year} · ${esc(t.genre)}</span>
      ${pct > 0 ? `<span class="bar"><i style="width:${pct}%"></i></span>` : ''}
    </button>`;
  }

  function row(title, items) {
    if (!items.length) return '';
    return `<section class="row"><h2>${esc(title)}</h2><div class="strip">${items.map(card).join('')}</div></section>`;
  }

  function renderHero() {
    const t = CATALOG.find((x) => x.featured) || CATALOG[0];
    hero.style.cssText = posterStyle(t);
    hero.innerHTML = `<div class="hero-inner">
      <h1>${esc(t.title)}</h1>
      <p>${esc(t.desc)}</p>
      <div class="actions">
        <button class="btn primary" data-play="${t.id}">▶ Assistir</button>
        <button class="btn" data-toggle="${t.id}">${myList.has(t.id) ? '✓ Na minha lista' : '+ Minha lista'}</button>
      </div></div>`;
    hero.hidden = false;
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    let html = '';
    let any = false;
    hero.hidden = true;

    if (q) {
      const hits = CATALOG.filter((t) => (t.title + ' ' + t.genre).toLowerCase().includes(q));
      html = row(`Resultados para “${search.value.trim()}”`, hits);
      any = hits.length > 0;
      empty.textContent = 'Nenhum título encontrado.';
    } else if (view === 'list') {
      const items = CATALOG.filter((t) => myList.has(t.id));
      html = row('Minha lista', items);
      any = items.length > 0;
      empty.textContent = 'Sua lista está vazia. Abra um título e adicione à lista.';
    } else {
      renderHero();
      const resume = CATALOG.filter((t) => progress[t.id]?.pct > 0 && progress[t.id].pct < 98);
      html += row('Continuar assistindo', resume);
      html += row('Em destaque', CATALOG);
      [...new Set(CATALOG.map((t) => t.genre))].forEach((g) => {
        html += row(g, CATALOG.filter((t) => t.genre === g));
      });
      any = true;
    }
    rows.innerHTML = html;
    empty.hidden = any;
  }

  function toggleList(id) {
    myList.has(id) ? myList.delete(id) : myList.add(id);
    store.set('list', [...myList]);
    render();
  }

  function openPlayer(id) {
    const t = byId(id);
    if (!t) return;
    current = t;
    $('player-title').textContent = t.title;
    $('player-desc').textContent = t.desc;
    video.src = t.video;
    const saved = progress[id];
    video.addEventListener('loadedmetadata', () => {
      if (saved && saved.pct < 98) video.currentTime = (saved.pct / 100) * video.duration;
    }, { once: true });
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    video.play().catch(() => { /* autoplay bloqueado: usuário usa os controles */ });
  }

  function closePlayer() {
    if (modal.hidden) return;
    saveProgress();
    video.pause();
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

  // Eventos
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) return openPlayer(card.dataset.id);
    const play = e.target.closest('[data-play]');
    if (play) return openPlayer(play.dataset.play);
    const tog = e.target.closest('[data-toggle]');
    if (tog) return toggleList(tog.dataset.toggle);
    if (e.target === modal) closePlayer();
  });
  $('player-close').addEventListener('click', closePlayer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePlayer(); });
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

  render();
})();
