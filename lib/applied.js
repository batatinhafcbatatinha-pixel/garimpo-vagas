// Candidaturas: vagas e concursos que a pessoa marcou como "já me candidatei".
// Fica salvo no servidor (data/candidaturas.json) para valer no computador, no celular e na TV.
// Guarda uma cópia da vaga, então ela continua na lista mesmo depois de sair do ar.
const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'candidaturas.json');

function createStore(file = DEFAULT_FILE) {
  const load = () => {
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
    } catch {
      return {};
    }
  };

  // Marca ou desmarca. `data` é o índice atual ({ jobs, concursos }), de onde sai a cópia da vaga.
  // Devolve o mapa atualizado, ou null se o id não existe no índice.
  function set(id, on, data) {
    const map = load();
    if (!on) {
      delete map[id];
    } else if (!Object.prototype.hasOwnProperty.call(map, id)) {
      const job = (data.jobs || []).find((j) => j.id === id);
      const item = job || (data.concursos || []).find((c) => c.id === id);
      if (!item) return null;
      map[id] = { at: new Date().toISOString(), kind: job ? 'vaga' : 'concurso', item };
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(map));
    return map;
  }

  return { load, set };
}

module.exports = { createStore };
