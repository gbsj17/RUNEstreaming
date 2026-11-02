# Novidades (patch notes)

Versão atual: **1.2.0**. A mesma lista aparece no site em `docs.html#novidades`.

## 1.2.0

- **Logs no servidor**: toda mensagem de erro mostrada na tela (player, listas de TV, Jellyfin, conta), erro de JavaScript e falha de rede vai para o registro do coletor e é gravada no servidor (Cloudflare Worker + KV, guardada por 30 dias). Mensagens repetidas são enviadas no máximo 1 vez por minuto. Tokens e senhas são removidos antes do envio.
- Consulta dos logs: `GET /logs` no Worker, protegido por `ADMIN_TOKEN`.

## 1.1.0

- **Reportar bug** (⚙ > Reportar bug): coletor que guarda erros, avisos e falhas de rede e monta um relatório com versão, navegador, estado do player e das listas de TV. Dá para copiar, baixar em `.txt` ou abrir uma issue no GitHub já preenchida. Nada é enviado sozinho e o relatório não inclui senhas, tokens nem a chave do TMDB.
- **Documentação completa** (`docs.html`, e `DOCS.md` no repositório) e esta página de novidades.
- **Campos de EPG e logos** nas listas de TV: guia XMLTV (`.xml` ou `.xml.gz`) mostra "Agora: programa" no player, e a pasta de logos completa as imagens dos canais.
- **Campo na aba TV ao vivo** para colar um link de lista (`.m3u`) ou de um canal (`.m3u8`) e assistir na hora.
- **Status por lista**: a janela de listas de TV mostra quantos canais cada lista carregou ou por que falhou (link `http://`, link encurtado, servidor fora do ar).
- **Proxy opcional** (`worker/`): Cloudflare Worker que libera canais `http://` e servidores sem CORS.
- Novas listas de TV prontas: Brasil (iptv-com) e Brasil (iptvcat, só os canais https).
- **Player mais resistente**: tenta outras versões do arquivo quando uma falha, repete a busca do arquivo no Internet Archive, mostra o progresso de carregamento e tem o botão "Tentar de novo".

## 1.0.0

- Site estático em HTML, CSS e JavaScript puro, publicado no GitHub Pages.
- Dois apps em um: **Filmes e Séries** e **TV ao vivo**, com abas (Início, Filmes, Séries, TV ao vivo, Minha lista) e menu de ajustes (⚙).
- Catálogo só com o que toca: Internet Archive (domínio público, 17 fileiras por gênero), Jellyfin (biblioteca própria) e canais ao vivo.
- Capas e sinopses via TMDB, em cache local.
- TV ao vivo: listas M3U, categorias, favoritos, último canal, troca de canal (◀ ▶, PageUp/PageDown) e pulo automático de canais que não respondem.
- Minha lista, "Continuar assistindo" e retomada do ponto onde parou.
- Conta e sincronização opcionais via Supabase (chave do TMDB, sessão do Jellyfin, lista e progresso).
- Busca ao vivo no Internet Archive.
- Fixes: capas quebradas, cabeçalho cobrindo o conteúdo, páginas antigas em cache (`?v=N` nos arquivos), amostras da Blender removidas (403), apenas filmes com arquivo `.mp4` tocável.
