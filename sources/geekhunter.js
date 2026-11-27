// GeekHunter: a busca (/pt/vagas) é Next.js e embute a lista de vagas no payload RSC
// (self.__next_f). A lista traz só um trecho da descrição e o slug da empresa, então cada
// vaga nova é aberta uma vez (JSON-LD JobPosting) e nome da empresa, logo e descrição ficam em cache.
const { fetchText, htmlToText, pool, sleep } = require('../lib/http');

const BASE = 'https://www.geekhunter.com/pt';
// o site é pequeno (~500 vagas no total): filtra por nível e por cidade, a classificação faz o resto
const SEARCHES = [
  { qs: 'experienceLevel=entry', pages: 3 },
  { qs: 'experienceLevel=intern', pages: 2 },
  { qs: 'cityName=' + encodeURIComponent('Porto Alegre'), pages: 2, city: 'Porto Alegre, RS' }, // às vezes a vaga vem sem cidade
  { qs: 'searchTerm=desenvolvedor&workModality=remote', pages: 2 },
];
const MODES = { remote: 'remote', 'remote-in-city': 'remote', hybrid: 'hybrid', 'on-site': 'onsite' };
const LEVELS = { intern: 'estagio', entry: 'junior', mid: 'pleno', senior: 'senior' };
const MAX_DETAILS = 80; // por atualização; o resto entra na próxima

// Junta os pedaços do payload RSC numa string só.
function flight(html) {
  let s = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) s += JSON.parse(m[1]);
  return s;
}

// Recorta o array/objeto JSON que começa em `start` (ignora colchetes dentro de strings).
function sliceJson(text, start) {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '[' || c === '{') depth++;
    else if ((c === ']' || c === '}') && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

const titleCase = (slug) => slug.replace(/-\d+$/, '').split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const money = (v, sym) => sym + ' ' + Number(v).toLocaleString('pt-BR');

function salaryText(salaries = []) {
  const s = salaries.find((x) => x.minSalary || x.maxSalary);
  if (!s) return null;
  const sym = s.currencyRef?.symbol || s.currency || 'R$';
  const txt = s.minSalary && s.maxSalary && s.minSalary !== s.maxSalary
    ? `${money(s.minSalary, sym)} a ${money(s.maxSalary, sym)}`
    : money(s.minSalary || s.maxSalary, sym);
  return s.contractType ? `${txt} (${s.contractType})` : txt;
}

// Página de busca -> { jobs, lastPage }. null se a página não tiver a lista.
function parseList(html, search = {}) {
  const s = flight(html);
  const at = s.indexOf('"data":[{"__typename":"PublicJob"');
  if (at < 0) return /"data":\[\],"meta"/.test(s) ? { jobs: [], lastPage: 1 } : null;
  const data = JSON.parse(sliceJson(s, s.indexOf('[', at)));
  const meta = JSON.parse(sliceJson(s, s.indexOf('{', s.indexOf('"meta":', at))) || '{}');
  const jobs = data
    .filter((p) => p.atsJob?.atsJobDetail)
    .map((p) => {
      const j = p.atsJob;
      const d = j.atsJobDetail;
      const slug = j.company?.slug || '';
      const cities = (d.atsJobCities || []).map((c) => c.name).filter(Boolean);
      return {
        source: 'geekhunter',
        sourceId: String(p.id),
        title: d.title.trim(),
        company: !slug || /^confidential/.test(slug) ? 'Empresa confidencial' : titleCase(slug),
        logo: null,
        location: cities[0] || search.city || 'Brasil',
        workMode: MODES[d.workModality] || null,
        url: `${BASE}/${slug}/jobs/${j.jobSlug}`,
        publishedAt: j.publishedAt ? new Date(Number(j.publishedAt)).toISOString() : null,
        salaryText: salaryText(d.atsJobSalaries),
        educationText: null,
        description: htmlToText(d.description).slice(0, 6000),
        levelHint: LEVELS[d.experienceLevel] || null,
      };
    });
  return { jobs, lastPage: meta.lastPage || 1 };
}

// Página da vaga -> dados do JSON-LD JobPosting (empresa, logo, descrição completa).
function parseDetail(html) {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let j;
    try {
      j = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if (j['@type'] !== 'JobPosting') continue;
    const org = j.hiringOrganization || {};
    const out = { description: htmlToText(j.description).slice(0, 6000) };
    if (org.name && !/^confidencial|^confidential/i.test(org.name)) out.company = org.name;
    if (org.logo) out.logo = typeof org.logo === 'string' ? org.logo : org.logo.url || null;
    return out;
  }
  return null;
}

module.exports = {
  id: 'geekhunter',
  name: 'GeekHunter',
  parseList,
  parseDetail,
  async fetchJobs(progress, cache) {
    const byId = new Map();
    const errors = [];
    let done = 0;
    for (const s of SEARCHES) {
      try {
        for (let page = 1; page <= s.pages; page++) {
          const res = parseList(await fetchText(`${BASE}/vagas?${s.qs}${page > 1 ? `&page=${page}` : ''}`), s);
          if (!res) throw new Error('GeekHunter: página sem a lista de vagas');
          for (const j of res.jobs) if (!byId.has(j.sourceId)) byId.set(j.sourceId, j);
          if (page >= res.lastPage) break;
          await sleep(400);
        }
      } catch (e) {
        errors.push(e.message); // uma busca que falha não derruba as outras
      }
      progress(`${++done}/${SEARCHES.length} buscas · ${byId.size} vagas`);
    }
    if (errors.length === SEARCHES.length) throw new Error(errors[0]);

    const jobs = [...byId.values()];
    const missing = jobs.filter((j) => !cache[j.sourceId]).slice(0, MAX_DETAILS);
    let n = 0;
    await pool(missing, 3, async (j) => {
      try {
        const d = parseDetail(await fetchText(j.url));
        if (d) cache[j.sourceId] = d;
      } catch {
        /* fica com o trecho da lista; tenta de novo na próxima atualização */
      }
      progress(`descrições ${++n}/${missing.length}`);
      await sleep(250);
    });
    return jobs.map((j) => ({ ...j, ...(cache[j.sourceId] || {}) }));
  },
};
