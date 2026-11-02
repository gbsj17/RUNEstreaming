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

  function add(type, ...args) {
    log.push({ t: ((Date.now() - t0) / 1000).toFixed(1) + 's', type, msg: clean(args.map(short).join(' ')) });
    if (log.length > MAX) log.shift();
  }

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

  return { add, report, issueUrl };
})();
window.Debug = Debug;
