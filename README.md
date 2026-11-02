# RUNEstreaming

Site de streaming estático (HTML, CSS e JavaScript puro, sem build).

## Recursos

- Destaque (hero) e fileiras por gênero
- Busca por título/gênero
- Minha lista e "Continuar assistindo" (salvos no `localStorage`)
- Fontes de catálogo combinadas: Jellyfin (biblioteca própria), Internet Archive (domínio público) e amostras da Blender
- Player em modal (HLS via hls.js para o Jellyfin) com retomada do ponto onde parou; `Esc` fecha

## Estrutura

```
index.html        página única
css/style.css     estilos
js/catalog.js     amostras locais (edite aqui para adicionar títulos)
js/sources/       fontes de dados (archive.js, jellyfin.js)
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

## Adicionar um título local

Inclua um objeto em `js/catalog.js` com `id`, `title`, `year`, `genre`, `desc`, `video` (URL .mp4) e `hue` (0–360, cor do pôster).

## Conteúdo de exemplo

Os vídeos do catálogo são filmes abertos da Blender Foundation (CC BY), usados apenas como demonstração.
