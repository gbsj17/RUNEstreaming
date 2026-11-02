// Catálogo de exemplo. Para adicionar títulos, inclua um objeto aqui.
// Vídeos: filmes abertos da Blender Foundation (CC BY).
const BASE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';

const LOCAL_CATALOG = [
  {
    id: 'bbb', title: 'Big Buck Bunny', year: 2008, genre: 'Animação', featured: true,
    desc: 'Um coelho gigante e gentil enfrenta três roedores brincalhões que perturbam a sua paz.',
    video: BASE + 'BigBuckBunny.mp4', hue: 130, source: 'local',
  },
  {
    id: 'sintel', title: 'Sintel', year: 2010, genre: 'Fantasia',
    desc: 'Uma jovem busca o dragão que ela criou e perdeu, numa jornada por terras geladas.',
    video: BASE + 'Sintel.mp4', hue: 20, source: 'local',
  },
  {
    id: 'tears', title: 'Tears of Steel', year: 2012, genre: 'Ficção científica',
    desc: 'Guerreiros e cientistas tentam salvar o mundo de robôs gigantes em Amsterdã.',
    video: BASE + 'TearsOfSteel.mp4', hue: 200, source: 'local',
  },
  {
    id: 'ed', title: "Elephant's Dream", year: 2006, genre: 'Ficção científica',
    desc: 'Dois personagens exploram uma máquina surreal e enorme em um mundo estranho.',
    video: BASE + 'ElephantsDream.mp4', hue: 280, source: 'local',
  },
  {
    id: 'blazes', title: 'For Bigger Blazes', year: 2013, genre: 'Ação',
    desc: 'Cenas de fogo e adrenalina em um curta de demonstração.',
    video: BASE + 'ForBiggerBlazes.mp4', hue: 0, source: 'local',
  },
  {
    id: 'escapes', title: 'For Bigger Escapes', year: 2013, genre: 'Ação',
    desc: 'Uma fuga espetacular em alta velocidade.',
    video: BASE + 'ForBiggerEscapes.mp4', hue: 45, source: 'local',
  },
  {
    id: 'fun', title: 'For Bigger Fun', year: 2013, genre: 'Comédia',
    desc: 'Momentos divertidos para animar qualquer tarde.',
    video: BASE + 'ForBiggerFun.mp4', hue: 320, source: 'local',
  },
  {
    id: 'joyrides', title: 'For Bigger Joyrides', year: 2013, genre: 'Comédia',
    desc: 'Um passeio sem rumo cheio de aventuras.',
    video: BASE + 'ForBiggerJoyrides.mp4', hue: 170, source: 'local',
  },
];
