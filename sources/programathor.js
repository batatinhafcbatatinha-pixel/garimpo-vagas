// Programathor: a busca é HTML renderizado no servidor (Rails). O card já traz empresa, local
// com modelo ("São Paulo (Presencial)", "Remoto"), salário e nível; a descrição vem do JSON-LD
// JobPosting da página da vaga, aberta uma vez e guardada em cache. O site é pequeno e limita
// rajadas (HTTP 429), então as páginas vão uma de cada vez, com pausa.
const { fetchText, htmlToText, decodeEntities, sleep } = require('../lib/http');

const BASE = 'https://programathor.com.br';
const SEARCHES = [
  { path: '/jobs', qs: '?expertise=' + encodeURIComponent('Júnior'), pages: 3 },
  { path: '/jobs', qs: '?contract_type=' + encodeURIComponent('Estágio'), pages: 2 },
  { path: '/jobs-city/porto-alegre', qs: '', pages: 2 },
];
const PAGE_SIZE = 15; // página cheia tem ~17 vagas; menos que isso é a última
const MAX_DETAILS = 40; // por atualização; o resto entra na próxima
const LEVELS = { estágio: 'estagio', trainee: 'trainee', júnior: 'junior', pleno: 'pleno', sênior: 'senior', especialista: 'senior' };

const clean = (s) => decodeEntities(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// "São Paulo  (Presencial)" -> local + modelo
function splitLocation(txt) {
  const m = /^(.*?)\s*\((presencial|h[ií]brido|remoto)\)\s*$/i.exec(txt);
  const place = (m ? m[1] : txt).replace(/,\s*Brasil$/i, '').trim();
  const mode = (m ? m[2] : txt).toLowerCase();
  const workMode = /remoto/.test(mode) ? 'remote' : /h[ií]brido/.test(mode) ? 'hybrid' : /presencial/.test(mode) ? 'onsite' : null;
  return { location: !place || /^remoto$/i.test(place) ? 'Brasil' : place, workMode };
}

function parseCards(html) {
  return html
    .split(/class="cell-list[ "]/)
    .slice(1)
    .map((c) => {
      const href = (c.match(/href="(\/jobs\/(\d+)[^"]*)"/) || []);
      if (!href[1]) return null; // anúncio ou link de cidade
      // ícones do card: briefcase = empresa, map-marker = local, money = salário, chart-bar = nível
      const icon = (name) => clean((c.match(new RegExp(`<i class='[^']*${name}[^']*'></i>([^<]*)`)) || [])[1]);
      const h3 = (c.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1] || '';
      const logo = (c.match(/<img[^>]*\ssrc=["']?([^"' >]+)/) || [])[1];
      const level = icon('fa-chart-bar').toLowerCase();
      const contract = icon('fa-file-alt');
      return {
        source: 'programathor',
        sourceId: href[2],
        title: clean(h3.replace(/<span[\s\S]*?<\/span>/g, ' ')),
        company: icon('fa-briefcase').replace(/^confidencial$/i, '') || 'Empresa confidencial',
        logo: logo && !/company_avatar/.test(logo) ? decodeEntities(logo) : null,
        ...splitLocation(icon('fa-map-marker-alt')),
        url: BASE + href[1],
        publishedAt: null,
        salaryText: /R\$/.test(icon('fa-money')) ? icon('fa-money') : null,
        educationText: null,
        description: '',
        levelHint: /estágio/i.test(contract) ? 'estagio' : LEVELS[level] || null,
      };
    })
    .filter((j) => j && j.title);
}

// Página da vaga -> descrição e data do JSON-LD JobPosting.
function parseDetail(html) {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let j;
    try {
      j = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if (j['@type'] !== 'JobPosting') continue;
    return {
      description: htmlToText(j.description).slice(0, 6000),
      publishedAt: j.datePosted ? new Date(j.datePosted + 'T12:00:00-03:00').toISOString() : null,
    };
  }
  return null;
}

const get = (url) => fetchText(url, { retries: 3 });

module.exports = {
  id: 'programathor',
  name: 'Programathor',
  parseCards,
  parseDetail,
  async fetchJobs(progress, cache) {
    const byId = new Map();
    const errors = [];
    for (const [i, s] of SEARCHES.entries()) {
      try {
        for (let page = 1; page <= s.pages; page++) {
          const cards = parseCards(await get(BASE + s.path + (page > 1 ? `/page/${page}` : '') + s.qs));
          for (const c of cards) if (!byId.has(c.sourceId)) byId.set(c.sourceId, c);
          await sleep(1500);
          if (cards.length < PAGE_SIZE) break;
        }
      } catch (e) {
        errors.push(e); // uma busca que falha não derruba as outras
      }
      progress(`${i + 1}/${SEARCHES.length} buscas · ${byId.size} vagas`);
    }
    if (errors.length === SEARCHES.length) {
      throw errors[0].status === 429 ? new Error('O Programathor limitou as buscas (HTTP 429); tente de novo mais tarde.') : errors[0];
    }

    const jobs = [...byId.values()];
    const missing = jobs.filter((j) => !cache[j.sourceId]).slice(0, MAX_DETAILS);
    for (const [i, j] of missing.entries()) {
      try {
        const d = parseDetail(await get(j.url));
        if (d) cache[j.sourceId] = d;
      } catch {
        /* sem descrição desta vez; tenta de novo na próxima atualização */
      }
      progress(`descrições ${i + 1}/${missing.length}`);
      await sleep(1500);
    }
    return jobs.map((j) => ({ ...j, ...(cache[j.sourceId] || {}) }));
  },
};
