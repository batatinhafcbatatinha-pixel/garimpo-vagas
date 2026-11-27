// Empregos.com.br: o site (Nuxt) consulta uma API JSON própria que já devolve a descrição
// completa e o modelo de trabalho. Filtros: facetItem 17 = modelo, 13 = local (lat,lng + raio em km).
const { htmlToText, pool, sleep, UA } = require('../lib/http');

const API = 'https://gatewayb2c.empregos.com.br/searchjob/v2/elastic/search';
const POA = { facetItem: 13, description: '-30.02564,-51.12732', subDescription: 'Porto Alegre, RS' };
const REMOTE = { facetItem: 17, description: 'Remoto' };
const TERMS = ['desenvolvedor', 'programador', 'developer', 'desenvolvedor junior', 'front-end', 'back-end', 'full stack', 'estagio desenvolvimento'];
const SEARCHES = [
  ...TERMS.map((keyword) => ({ keyword, filters: [POA], distance: 30, pages: 1 })),
  ...TERMS.map((keyword) => ({ keyword, filters: [REMOTE], distance: 100, pages: keyword === 'desenvolvedor' ? 3 : 1 })),
];
const SIZE = 50;
const MODES = { remoto: 'remote', 'híbrido': 'hybrid', hibrido: 'hybrid', presencial: 'onsite' };

const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
function salaryText({ min, max } = {}) {
  if (min > 0 && max > min) return `${brl(min)} a ${brl(max)}`;
  if (min > 0 || max > 0) return brl(Math.max(min || 0, max || 0));
  return null;
}

function mapJob(j) {
  if (!j?.referenceId || !j.title) return null;
  const loc = j.location || [];
  const level = String(j.role?.hierarchicalLevel || '').toLowerCase();
  return {
    source: 'empregoscombr',
    sourceId: String(j.referenceId),
    title: j.title.trim(),
    company: j.company?.name?.trim() || 'Empresa confidencial',
    logo: null,
    location: loc.length === 1 ? [loc[0].city, loc[0].stateAbbreviation].filter(Boolean).join(', ') : loc.length ? 'Várias cidades' : 'Brasil',
    workMode: MODES[String(j.workplaceTypes || '').toLowerCase()] || null,
    url: `https://www.empregos.com.br/vaga/${j.referenceId}`,
    // horário de Brasília, sem fuso no texto
    publishedAt: j.createdAt ? new Date(j.createdAt.replace(/(\.\d+)?$/, '-03:00')).toISOString() : null,
    salaryText: salaryText(j.salary),
    educationText: j.academicFormation || null,
    description: htmlToText([j.description, j.requiredQualification].filter((s) => s && s.trim()).join('\n')).slice(0, 6000),
    levelHint: /estagi/.test(level) ? 'estagio' : /trainee/.test(level) ? 'trainee' : null,
  };
}

function parseResponse(json) {
  const list = json?.jobPostingCollection;
  if (!Array.isArray(list)) throw new Error('Empregos.com.br: resposta sem vagas');
  return { total: json.total || 0, jobs: list.map(mapJob).filter(Boolean) };
}

async function searchPage(s, page) {
  const body = { keyword: s.keyword, filters: s.filters, page, size: SIZE, order: 0, distance: s.distance };
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA, origin: 'https://www.empregos.com.br' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return parseResponse(await res.json());
}

module.exports = {
  id: 'empregoscombr',
  name: 'Empregos.com.br',
  mapJob,
  parseResponse,
  async fetchJobs(progress) {
    const byId = new Map();
    const errors = [];
    let done = 0;
    await pool(SEARCHES, 2, async (s) => {
      try {
        for (let page = 0; page < s.pages; page++) {
          const { total, jobs } = await searchPage(s, page);
          for (const j of jobs) if (!byId.has(j.sourceId)) byId.set(j.sourceId, j);
          if ((page + 1) * SIZE >= total) break;
          await sleep(400);
        }
      } catch (e) {
        errors.push(e.message);
      }
      progress(`${++done}/${SEARCHES.length} buscas · ${byId.size} vagas`);
    });
    if (errors.length === SEARCHES.length) throw new Error(errors[0]);
    return [...byId.values()];
  },
};
