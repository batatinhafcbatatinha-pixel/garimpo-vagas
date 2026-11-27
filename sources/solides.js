// Sólides: o portal vagas.solides.com.br busca pela própria API (/api/vacancies), que já devolve
// a descrição completa, salário, escolaridade, senioridade e modelo de trabalho.
const { fetchText, htmlToText, pool, sleep } = require('../lib/http');

const BASE = 'https://vagas.solides.com.br';
const TAKE = 25; // acima disso a API responde "Failed to fetch vacancies"
const TERMS = ['desenvolvedor', 'programador', 'developer', 'software', 'front-end', 'back-end', 'full stack', 'estágio desenvolvimento', 'estágio ti'];
const PLACES = [
  { qs: 'locations=' + encodeURIComponent('Porto Alegre - RS'), pages: 2 },
  { qs: 'jobsType=remoto', pages: 3, remote: true },
];
const MODES = { remoto: 'remote', hibrido: 'hybrid', presencial: 'onsite' };
const LEVELS = [
  [/estagi/, 'estagio'],
  [/trainee|aprendiz/, 'trainee'],
  [/junior/, 'junior'],
  [/pleno/, 'pleno'],
  [/senior|especialista/, 'senior'],
];

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function salaryText(s) {
  if (!s || s.showRangeToApplicant === false) return null;
  const a = Number(s.initialRange) || 0;
  const b = Number(s.finalRange) || 0;
  if (!b) return a ? brl(a) : null;
  return a && a !== b ? `${brl(a)} a ${brl(b)}` : brl(b);
}

// a senioridade vem como lista ("Pleno, Sênior"): fica a mais baixa citada
function levelHint(seniority) {
  const names = (seniority || []).map((s) => norm(s.name));
  for (const [re, level] of LEVELS) if (names.some((n) => re.test(n))) return level;
  return null;
}

// Resposta da API -> vagas no formato do Garimpo
function parse(json) {
  return (json?.data || [])
    .filter((v) => v && v.id != null && v.title && !v.isDisabled)
    .map((v) => {
      const city = v.city?.name || v.address?.city?.name;
      const uf = v.state?.code || v.address?.state?.code;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(v.createdAt || '') ? new Date(v.createdAt + 'T12:00:00-03:00').toISOString() : null;
      return {
        source: 'solides',
        sourceId: String(v.id),
        title: v.title.replace(/\s+/g, ' ').trim(),
        company: v.companyName || 'Empresa confidencial',
        logo: v.companyLogo || null,
        location: [city, uf].filter(Boolean).join(', ') || 'Brasil',
        workMode: v.homeOffice ? 'remote' : MODES[v.jobType] || null,
        // vagas vindas do RH Gestor (id alfanumérico) só abrem no site de lá
        url: v.publishers?.rhgestor?.redirectUrl || `${BASE}/vaga/${encodeURIComponent(v.id)}`,
        publishedAt: date,
        salaryText: salaryText(v.salary),
        educationText: (v.education || []).map((e) => e.name).join(', ') || null,
        description: htmlToText(v.description).slice(0, 6000),
        levelHint: levelHint(v.seniority),
      };
    });
}

async function search(term, place) {
  const jobs = [];
  for (let page = 1; page <= place.pages; page++) {
    const url = `${BASE}/api/vacancies?page=${page}&take=${TAKE}&title=${encodeURIComponent(term)}&${place.qs}`;
    const json = JSON.parse(await fetchText(url, { headers: { accept: 'application/json' } }));
    if (json.error) throw new Error('Sólides: ' + json.error);
    jobs.push(...parse(json));
    if (page >= (json.totalPages || 0)) break;
    await sleep(300);
  }
  return jobs;
}

module.exports = {
  id: 'solides',
  name: 'Sólides',
  parse,
  async fetchJobs(progress) {
    const queries = PLACES.flatMap((p) => TERMS.map((t) => ({ p, t })));
    let done = 0;
    const errors = [];
    const results = await pool(queries, 3, async ({ p, t }) => {
      try {
        return await search(t, p);
      } catch (e) {
        errors.push(e.message);
        return [];
      } finally {
        progress(`${++done}/${queries.length} buscas`);
      }
    });
    if (errors.length === queries.length) throw new Error(errors[0]);
    const byId = new Map();
    for (const j of results.flat()) if (!byId.has(j.sourceId)) byId.set(j.sourceId, j);
    return [...byId.values()];
  },
};
