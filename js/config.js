// Configuração pública. Nada aqui é segredo: são chaves feitas para rodar no navegador.
window.RS_CONFIG = {
  // Chave v3 do TMDB (capas e sinopses). Quem colar outra no botão "Capas" usa a dele no lugar desta.
  tmdbKey: '39e10b6458df43b5546cde28e22e12b1',

  // Supabase (Project Settings > API): URL e chave "anon public". A anon key é pública por design;
  // quem protege os dados são as políticas RLS de supabase/schema.sql. Nunca coloque a service_role aqui.
  // Endereço do proxy (pasta worker/). Com ele, canais http:// e servidores sem CORS passam a tocar.
  proxyUrl: '',

  supabaseUrl: '',
  supabaseKey: '',
};
