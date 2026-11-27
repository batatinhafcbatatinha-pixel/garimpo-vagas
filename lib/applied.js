// Marcas que a pessoa põe nas vagas: candidaturas ("já me candidatei", data/candidaturas.json)
// e vagas escondidas (data/escondidas.json). Cada uma é um store criado com seu arquivo.
// Fica salvo no servidor para valer no computador, no celular e na TV.
// Guarda uma cópia da vaga, então ela continua na lista mesmo depois de sair do ar.
const fs = require('fs');
const path = require('path');
const { toggleMark, parseMarks } = require('../public/marks');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'candidaturas.json');

function createStore(file = DEFAULT_FILE) {
  const load = () => {
    try {
      return parseMarks(fs.readFileSync(file, 'utf8'));
    } catch {
      return {};
    }
  };

  // Marca ou desmarca. `data` é o índice atual ({ jobs, concursos }), de onde sai a cópia da vaga.
  // Devolve o mapa atualizado, ou null se o id não existe no índice.
  // A regra fica em public/marks.js, a mesma que o site publicado usa no navegador.
  function set(id, on, data) {
    const map = toggleMark(load(), id, on, data);
    if (!map) return null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(map));
    return map;
  }

  return { load, set };
}

module.exports = { createStore };
