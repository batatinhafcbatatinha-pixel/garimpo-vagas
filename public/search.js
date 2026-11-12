// Busca por texto. Usado pelo site e pelos testes (funciona no navegador e no Node).
// Regras: ignora acentos e maiúsculas; "junior", "júnior" e "jr" são a mesma coisa;
// palavras de nível (júnior, pleno, sênior...) viram filtro de nível, então buscar
// "desenvolvedor junior" nunca traz vaga pleno ou sênior.
(function (root) {
  const norm = (s) =>
    String(s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');

  const LEVEL_WORDS = {
    junior: 'junior', jr: 'junior', jnr: 'junior', juniors: 'junior',
    pleno: 'pleno', pl: 'pleno',
    senior: 'senior', sr: 'senior', especialista: 'senior',
    estagio: 'estagio', estagiario: 'estagio', estagiaria: 'estagio', intern: 'estagio',
    trainee: 'trainee', aprendiz: 'trainee',
  };

  // Palavras equivalentes: quem busca "desenvolvedor" também quer "desenvolvedora", "developer", "programador", "dev".
  const SYNONYMS = [
    { test: /^(desenvolv|develop|programad|dev$)/, match: /desenvolv|develop|programa[dc]|\bdev\b|engenh\w* de software|software engineer/ },
    { test: /^front/, match: /front/ },
    { test: /^back/, match: /back/ },
    { test: /^full/, match: /full/ },
    { test: /^(remoto|remota|remote|homeoffice)$/, match: /remot|home office/ },
  ];

  // Transforma o texto digitado em { levels: [...], terms: [regex|string...] }
  function parseQuery(q) {
    const levels = new Set();
    const terms = [];
    for (const tok of norm(q).split(/[^a-z0-9#+.]+/).filter(Boolean)) {
      const word = tok.replace(/\.+$/, '');
      if (LEVEL_WORDS[word]) {
        levels.add(LEVEL_WORDS[word]);
        continue;
      }
      if (word.length < 2 && !/[a-z]#|\d/.test(word)) continue; // "de", "e", "a" soltos
      if (['de', 'da', 'do', 'em', 'para', 'e', 'ou'].includes(word)) continue;
      const syn = SYNONYMS.find((s) => s.test.test(word));
      terms.push(syn ? syn.match : word);
    }
    return { levels: [...levels], terms };
  }

  // job precisa ter .level e ._text (título + empresa já normalizados) ou title/company
  function matchesQuery(job, parsed) {
    if (parsed.levels.length && !parsed.levels.includes(job.level)) return false;
    const text = job._text ?? norm(job.title + ' ' + job.company);
    return parsed.terms.every((t) => (typeof t === 'string' ? text.includes(t) : t.test(text)));
  }

  const api = { norm, parseQuery, matchesQuery };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JobSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
