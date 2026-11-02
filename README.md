# RUNEstreaming

Site de streaming estático (HTML, CSS e JavaScript puro, sem build).

**Documentação completa:** [DOCS.md](DOCS.md) (também em `docs.html` no site) · **Novidades:** [CHANGELOG.md](CHANGELOG.md)

## Recursos

- Destaque (hero) e fileiras por gênero
- Busca por título/gênero
- Minha lista e "Continuar assistindo" (salvos no `localStorage`)
- Fontes de catálogo: Jellyfin (biblioteca própria), Internet Archive (domínio público) e TV ao vivo (listas M3U)
- Coletor de bugs (⚙ > Reportar bug)
- Player em modal (HLS via hls.js para o Jellyfin) com retomada do ponto onde parou; `Esc` fecha

## Estrutura

```
index.html        página única
css/style.css     estilos
js/sources/       fontes de dados (archive.js, jellyfin.js, iptv.js, tmdb.js)
js/debug.js       coletor de bugs
docs.html         documentação e novidades
worker/           proxy Cloudflare (opcional)
lists/            listas M3U incluídas
js/cloud.js       conta e sincronização (Supabase)
js/config.js      URL e chave anônima do Supabase
supabase/         schema.sql (tabela e políticas RLS)
js/app.js         lógica da interface e do player
```

## Rodar localmente

Abra `index.html` no navegador, ou sirva a pasta:

```bash
python -m http.server 8000
```

## Fontes de dados

Cada fonte expõe `load()` e devolve itens `{ id, title, year, genre, desc, poster, hue, resolve }`; o `app.js` junta todas. Se uma falha, as outras continuam.

- **Internet Archive**: busca na coleção `feature_films`, sem chave. O arquivo `.mp4` é descoberto ao dar play.
- **Jellyfin**: clique em "Conectar Jellyfin" e informe servidor, usuário e senha. O token fica só no `localStorage` do navegador, nada vai para o repositório. Requisitos: servidor em **HTTPS** (o Pages é HTTPS e bloqueia `http://`; Tailscale Funnel ou Cloudflare Tunnel resolvem) e o domínio do site liberado em CORS (Painel > Rede). Por enquanto só filmes, não séries.

## Conta e banco (Supabase)

Opcional. Guarda a chave do TMDB, a sessão do Jellyfin, a Minha lista e o progresso, valendo em qualquer aparelho.

1. Crie um projeto grátis em supabase.com.
2. SQL Editor: rode o conteúdo de `supabase/schema.sql` (cria a tabela com RLS: cada usuário só acessa a própria linha).
3. Project Settings > API: copie a **Project URL** e a chave **anon public** para `js/config.js`. Essas duas são públicas por design; **nunca** use a `service_role`.
4. Authentication > Providers > Email: para testar sem confirmar e-mail, desligue "Confirm email".
5. No site, botão **Conta** > criar conta ou entrar. Depois disso a chave do TMDB (botão **Capas**) fica salva na sua conta.

## Proxy para canais http:// (opcional)
O navegador bloqueia `http://` e servidores sem CORS numa página HTTPS. A pasta `worker/` tem um Cloudflare Worker que resolve isso:

1. No terminal: `cd worker`, `npx wrangler login`, `npx wrangler deploy`.
2. Copie o endereço que o deploy mostrar (`https://runestreaming-proxy.<sua-conta>.workers.dev`) para `proxyUrl` em `js/config.js`.
3. Só as páginas em `ALLOWED_ORIGINS` (`worker/wrangler.toml`) podem usar o proxy; troque ao usar domínio próprio.

Com o proxy, listas e canais `http://` passam a aparecer e tocar na aba TV ao vivo.
