// Marcas nas vagas ("já me candidatei" e "esconder"): id -> { at, kind: 'vaga' | 'concurso', item }.
// A mesma regra vale no servidor local (lib/applied.js) e no site publicado, onde as marcas
// ficam no localStorage do navegador. Funciona no navegador e no Node.
(function (root) {
  // Marca (`on` = true) ou desmarca `id`. `data` é o índice atual ({ jobs, concursos }), de onde
  // sai a cópia da vaga, para ela continuar na lista depois de sair do ar.
  // Devolve um mapa novo, ou null se o id não existe no índice.
  function toggleMark(map, id, on, data, now) {
    const out = Object.assign({}, map);
    if (!on) {
      delete out[id];
      return out;
    }
    if (Object.prototype.hasOwnProperty.call(out, id)) return out;
    const job = ((data && data.jobs) || []).find((j) => j.id === id);
    const item = job || ((data && data.concursos) || []).find((c) => c.id === id);
    if (!item) return null;
    // campos com "_" são calculados pelo site (texto da busca, local) e não precisam ser guardados
    const copy = {};
    for (const k of Object.keys(item)) if (k[0] !== '_') copy[k] = item[k];
    out[id] = { at: now || new Date().toISOString(), kind: job ? 'vaga' : 'concurso', item: copy };
    return out;
  }

  // lê um mapa salvo, aceitando só objetos (lixo ou lista vira mapa vazio)
  function parseMarks(raw) {
    try {
      const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
    } catch {
      return {};
    }
  }

  const api = { toggleMark, parseMarks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JobMarks = api;
})(typeof window !== 'undefined' ? window : globalThis);
