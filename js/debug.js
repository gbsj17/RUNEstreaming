// Coletor de bugs: guarda os últimos erros, avisos e falhas de rede e monta um relatório para colar/baixar/abrir como issue.
// Nada é enviado sozinho. O relatório não inclui senhas, tokens nem a chave do TMDB.
const Debug = (() => {
  const MAX = 200;
  const log = [];
  const REPO = 'https://github.com/gbsj17/RUNEstreaming';
  const t0 = Date.now();

  const short = (v) => {
    let s;
    try { s = typeof v === 'string' ? v : (v instanceof Error ? (v.stack || v.message) : JSON.stringify(v)); } catch { s = String(v); }
    return String(s).slice(0, 600);
  };
  // Remove tokens e chaves de qualquer texto antes de guardar.
  const clean = (s) => s
    .replace(/(api_key|token|apikey|password|senha|X-Emby-Token)=?[:=]?\s*[^\s&"',}]+/gi, '$1=[oculto]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt oculto]');

  // Envio ao servidor (Cloudflare Worker em worker/, rota POST /log). Só ocorre se proxyUrl estiver configurado.
  const endpoint = () => ((window.RS_CONFIG && RS_CONFIG.proxyUrl) || '').replace(/\/+$/, '');
  const sid = (() => {
    try {
      let v = sessionStorage.getItem('rs:sid');
      if (!v) { v = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('rs:sid', v); }
      return v;
    } catch { return 'anon'; }
  })();
  const queue = [];
  const recent = new Map();
  let sent = 0;
  let timer = 0;
  const rawFetch = window.fetch.bind(window);   // não passa pelo registro, para não gerar eventos em loop

  async function flush() {
    timer = 0;
    const url = endpoint();
    if (!url || !queue.length) { queue.length = 0; return; }
    const entries = queue.splice(0, 20);
    try {
      await rawFetch(url + '/log', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          sid, v: (window.RS_CONFIG && RS_CONFIG.version) || '', page: location.pathname,
          ua: navigator.userAgent, w: innerWidth, h: innerHeight, entries,
        }),
      });
    } catch { /* sem servidor: o registro local continua valendo */ }
  }

  function add(type, ...args) {
    const msg = clean(args.map(short).join(' '));
    log.push({ t: ((Date.now() - t0) / 1000).toFixed(1) + 's', type, msg });
    if (log.length > MAX) log.shift();
    if (!endpoint() || sent >= 60) return;
    const key = type + msg;
    if (Date.now() - (recent.get(key) || 0) < 60000) return;   // não repete a mesma mensagem por 1 min
    recent.set(key, Date.now());
    sent++;
    queue.push({ at: new Date().toISOString(), type, msg: msg.slice(0, 500) });
    if (!timer) timer = setTimeout(flush, 2000);
  }

  // Toda mensagem de erro mostrada ao usuário também vai para o registro.
  const ERR = /erro|não foi possível|não pôde|não respondeu|não entregou|bloquea|falh|sem resposta|nenhum canal|offline/i;
  function watch(ids) {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      new MutationObserver(() => {
        const text = (el.textContent || '').trim();
        if (text && ERR.test(text)) add('mensagem', id + ':', text.slice(0, 300));
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
  }
  document.addEventListener('DOMContentLoaded', () => watch(['player-desc', 'jf-error', 'ac-error', 'tv-add-msg', 'empty', 'tv-lists']));

  window.addEventListener('error', (e) => add('erro', e.message, `${(e.filename || '').split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => add('promessa', e.reason));
  ['error', 'warn'].forEach((k) => {
    const orig = console[k].bind(console);
    console[k] = (...a) => { add(k === 'error' ? 'console.error' : 'console.warn', ...a); orig(...a); };
  });
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String((input && input.url) || input);
    try {
      const res = await origFetch(input, init);
      if (!res.ok) add('rede', res.status, url.slice(0, 160));
      return res;
    } catch (err) {
      add('rede', 'falhou', err.message, url.slice(0, 160));
      throw err;
    }
  };

  const lsKeys = () => {
    try {
      return Object.keys(localStorage)
        .filter((k) => k.startsWith('rs:') && !/jellyfin|tmdb-key/.test(k))
        .map((k) => `${k} (${(localStorage.getItem(k) || '').length} bytes)`);
    } catch { return []; }
  };

  function report(description = '') {
    const cfg = window.RS_CONFIG || {};
    const video = document.getElementById('video');
    const tab = document.querySelector('.tab.is-active');
    const lines = [
      `# Relatório de bug · RUNEstreaming ${cfg.version || ''}`,
      `Data: ${new Date().toISOString()}`,
      `Página: ${location.href.replace(/[?#].*$/, '')}  (aba: ${tab ? tab.textContent : '?'})`,
      `Navegador: ${navigator.userAgent}`,
      `Tela: ${innerWidth}x${innerHeight}  |  Online: ${navigator.onLine}  |  Idioma: ${navigator.language}`,
      `Proxy configurado: ${cfg.proxyUrl ? 'sim' : 'não'}  |  Supabase configurado: ${cfg.supabaseUrl ? 'sim' : 'não'}  |  hls.js: ${window.Hls ? (Hls.isSupported() ? 'ok' : 'sem suporte') : 'não carregado'}`,
    ];
    if (video && video.currentSrc) {
      const err = video.error ? `${video.error.code} ${video.error.message || ''}` : 'nenhum';
      lines.push(`Player: src=${clean(video.currentSrc).slice(0, 200)} readyState=${video.readyState} erro=${err} t=${video.currentTime.toFixed(1)}s`);
    }
    try {
      const st = window.IptvSource && IptvSource.status;
      if (st && Object.keys(st).length) lines.push('', '## Listas de TV', ...Object.entries(st).map(([u, v]) => `- ${u.slice(0, 100)} → ${v}`));
    } catch { /* ignora */ }
    lines.push('', '## Dados locais', lsKeys().join('\n') || '(vazio)');
    if (description.trim()) lines.splice(1, 0, '', '## O que aconteceu', description.trim(), '');
    lines.push('', `## Registro (${log.length} últimos eventos)`, ...(log.length ? log.map((e) => `[${e.t}] ${e.type}: ${e.msg}`) : ['(nenhum erro registrado)']));
    return lines.join('\n');
  }

  const issueUrl = (description) => {
    const body = report(description);
    return `${REPO}/issues/new?title=${encodeURIComponent('Bug: ')}&body=${encodeURIComponent(body.slice(0, 5500))}`;
  };

  return { add, report, issueUrl, flush };
})();
window.Debug = Debug;
