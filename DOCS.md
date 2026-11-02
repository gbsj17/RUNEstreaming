# Documentação do RUNEstreaming

Site de streaming estático (HTML, CSS e JavaScript puro, sem build), publicado no GitHub Pages em https://gbsj17.github.io/RUNEstreaming/. Esta documentação também está no site, em `docs.html`.

## 1. Visão geral

Dois apps no mesmo site:

- **Filmes e Séries** (abas Início, Filmes, Séries, Minha lista): catálogo de títulos que tocam dentro do site.
- **TV ao vivo** (aba TV ao vivo): canais de listas M3U/HLS.

O site só mostra o que realmente toca. Não há trailers nem "onde assistir".

## 2. De onde vem o conteúdo

| Fonte | O que é | Observações |
|---|---|---|
| Internet Archive | Filmes e séries de domínio público, 17 fileiras por gênero | Sem chave. O servidor às vezes demora (8 a 20 s) ou responde 503. |
| Jellyfin | Sua biblioteca própria | Só filmes por enquanto. Exige HTTPS e CORS liberado. |
| Listas M3U | Canais ao vivo | Só `https://` (ou `http://` com o proxy). |
| TMDB | Apenas capas e sinopses dos títulos do Archive | A chave pública está em `js/config.js`. |

Lançamentos recentes só tocam se o arquivo estiver no **seu** servidor Jellyfin. O site não inclui nem indica fontes pirata.

## 3. Usando o site

- **Abas**: Início (destaque e fileiras), Filmes, Séries, TV ao vivo, Minha lista.
- **Busca**: filtra o catálogo; com 3 ou mais letras também busca no Internet Archive. Na aba TV filtra os canais.
- **Player**: clique em um título. `Esc` fecha. O ponto onde você parou é salvo e retomado.
- **Minha lista** e **Continuar assistindo**: salvos no navegador (ou na conta, se configurada).
- **Menu ⚙**: Listas de TV, Conectar Jellyfin, Capas (TMDB), Conta, Reportar bug, Documentação e Novidades.

## 4. TV ao vivo

- Categorias (chips), favoritos (☆), último canal e troca de canal pelos botões ◀ ▶ ou PageUp/PageDown.
- Canais que não respondem (offline, geo-bloqueados, sem CORS): o site pula sozinho para o próximo, até 6 vezes.
- **Listas**: em ⚙ > Listas de TV há listas prontas (iptv-org, Brasil iptv-com, Brasil iptvcat). Cada lista mostra quantos canais carregou ou o motivo do erro.
- **Campo na aba TV**: cole um link de lista (`.m3u`, vira lista salva) ou de canal (`.m3u8`, toca na hora). Campos opcionais:
  - **EPG**: guia XMLTV (`.xml` ou `.xml.gz`). Mostra "Agora: programa" no player. O `tvg-id` do canal precisa existir no guia.
  - **Logos**: pasta de imagens. Completa o logo dos canais que não trazem um link completo.
- As listas ficam só no seu navegador e não vão para o repositório.

### Limites do navegador

- Páginas HTTPS bloqueiam `http://`. Links encurtados (`bit.ly`, `j.mp`) costumam levar a `http://`: use o endereço final `https://`.
- O servidor do canal, do EPG e das logos precisa liberar CORS.
- Alguns canais só tocam com IP do Brasil (geo-bloqueio).

## 5. Proxy opcional (Cloudflare Worker)

Libera canais `http://` e servidores sem CORS. Código em `worker/`.

1. `cd worker`, `npx wrangler login`, `npx wrangler deploy`.
2. Copie o endereço do deploy para `proxyUrl` em `js/config.js`.
3. Só as páginas listadas em `ALLOWED_ORIGINS` (`worker/wrangler.toml`) podem usar o proxy. O proxy recusa endereços de rede interna e reescreve playlists HLS para os segmentos também passarem por ele.

## 6. Jellyfin

⚙ > Conectar Jellyfin: servidor, usuário e senha. O token fica só no `localStorage`. Requisitos: servidor em HTTPS (Tailscale Funnel ou Cloudflare Tunnel resolvem) e o domínio do site liberado em CORS (Painel > Rede).

## 7. Conta e banco (Supabase), opcional

Guarda a chave do TMDB, a sessão do Jellyfin, a Minha lista e o progresso, valendo em qualquer aparelho.

1. Crie um projeto em supabase.com e rode `supabase/schema.sql` no SQL Editor (tabela com RLS: cada usuário só acessa a própria linha).
2. Copie a **Project URL** e a chave **anon public** para `js/config.js`. Nunca use a `service_role`.
3. Em Authentication > Providers > Email, desligue "Confirm email" se quiser testar sem confirmar e-mail.
4. No site: ⚙ > Conta.

## 8. Reportar bug

⚙ > **Reportar bug**. O coletor guarda os últimos 200 eventos (erros de JavaScript, promessas rejeitadas, `console.error/warn`, falhas de rede, erros do player) e monta um relatório com versão, navegador, tela, estado do player e status das listas de TV. Você pode:

- **Copiar** o texto;
- **Baixar .txt**;
- **Abrir issue no GitHub** com o relatório já preenchido.

O relatório só é enviado quando você usa um dos botões. Tokens, senhas e a chave do TMDB são removidos.

### Logs no servidor

Com o proxy (seção 5) e um KV configurado, todo erro (mensagem de erro na tela, erro de JavaScript, falha de rede, erro do player, lista de TV que falhou) é enviado em segundo plano ao Worker e gravado por 30 dias. O envio é anônimo (id de sessão aleatório, sem IP guardado), sem repetir a mesma mensagem por 1 minuto e com limite de 60 envios por visita.

1. `npx wrangler kv namespace create LOGS` e cole o `id` no bloco `[[kv_namespaces]]` de `worker/wrangler.toml` (tirando os `#`).
2. `npx wrangler secret put ADMIN_TOKEN` e escolha uma senha.
3. `npx wrangler deploy`.
4. Ler os logs (últimos 100): `curl -H "Authorization: Bearer SUA_SENHA" https://SEU-WORKER.workers.dev/logs`.

Sem `proxyUrl` ou sem KV, os erros ficam só no registro local do navegador (⚙ > Reportar bug).

## 9. Estrutura do projeto

```
index.html          página única do site
docs.html           documentação e novidades (página)
css/style.css       estilos
js/config.js        versão, chave do TMDB, proxy e Supabase
js/debug.js         coletor de bugs
js/cloud.js         conta e sincronização (Supabase)
js/sources/         archive.js, jellyfin.js, iptv.js, tmdb.js
js/app.js           interface, player e abas
lists/              listas M3U incluídas
worker/             Cloudflare Worker (proxy)
supabase/schema.sql tabela e políticas RLS
CHANGELOG.md        novidades
```

Cada fonte expõe `{ label, byGenre, load(onPart) }` e devolve itens `{ id, title, year, genre, desc, poster, hue, source, type, live, resolve }`. O `app.js` junta todas; se uma falha, as outras continuam. Assets usam `?v=N` no `index.html` para evitar cache antigo: aumente o número ao publicar.

## 10. Rodar e publicar

- Local: abra `index.html` ou rode `python -m http.server 8000`.
- Publicar: push na branch `main`; o GitHub Pages publica em cerca de 1 minuto. O navegador guarda a página por até 10 minutos: use Ctrl+Shift+R.

## 11. Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Filme demora para começar | Servidor do Internet Archive lento | Aguarde; o site troca de arquivo sozinho após 40 s. Use "Tentar de novo". |
| Lista adicionada e nenhum canal | Link `http://` ou encurtado | Veja a mensagem sob a lista em ⚙ > Listas de TV; use o link `https://` final ou o proxy. |
| Canal não toca | Offline, geo-bloqueado ou sem CORS | O site pula para o próximo; teste outro. |
| Tela sem campos novos | Cache do navegador | Ctrl+Shift+R ou aba anônima. |
| Capas ausentes | TMDB sem resposta | Recarregue; veja ⚙ > Capas (TMDB). |
| Qualquer outro problema | — | ⚙ > Reportar bug. |
