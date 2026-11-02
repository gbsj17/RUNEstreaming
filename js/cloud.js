// Conta e sincronização (Supabase). Sem js/config.js preenchido, o site continua funcionando só com o navegador.
const Cloud = (() => {
  const cfg = window.RS_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseKey);
  let client = null;
  let user = null;

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });

  async function init() {
    if (!enabled) return null;
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js');
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
      const { data } = await client.auth.getSession();
      user = data.session ? data.session.user : null;
    } catch (err) { console.warn('Supabase indisponível', err); }
    return user;
  }

  const errorText = (e) => (e && e.message) || 'Erro desconhecido';

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(errorText(error));
    user = data.user;
  }

  async function signUp(email, password) {
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw new Error(errorText(error));
    if (!data.session) throw new Error('Conta criada. Confirme o e-mail e entre.');
    user = data.user;
  }

  async function signOut() {
    await client.auth.signOut();
    user = null;
  }

  async function pull() {
    if (!user) return null;
    const { data, error } = await client.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
    if (error) { console.warn('pull', error); return null; }
    return data;
  }

  async function push(patch) {
    if (!user) return;
    const { error } = await client.from('user_settings')
      .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() });
    if (error) console.warn('push', error);
  }

  return { enabled, init, signIn, signUp, signOut, pull, push, user: () => user };
})();
