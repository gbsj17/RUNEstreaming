# RUNEstreaming

Site de streaming estático (HTML, CSS e JavaScript puro, sem build).

## Recursos

- Destaque (hero) e fileiras por gênero
- Busca por título/gênero
- Minha lista e "Continuar assistindo" (salvos no `localStorage`)
- Player em modal com retomada do ponto onde parou; `Esc` fecha

## Estrutura

```
index.html        página única
css/style.css     estilos
js/catalog.js     catálogo (edite aqui para adicionar títulos)
js/app.js         lógica da interface e do player
```

## Rodar localmente

Abra `index.html` no navegador, ou sirva a pasta:

```bash
python -m http.server 8000
```

## Adicionar um título

Inclua um objeto em `js/catalog.js` com `id`, `title`, `year`, `genre`, `desc`, `video` (URL .mp4) e `hue` (0–360, cor do pôster).

## Conteúdo de exemplo

Os vídeos do catálogo são filmes abertos da Blender Foundation (CC BY), usados apenas como demonstração.
