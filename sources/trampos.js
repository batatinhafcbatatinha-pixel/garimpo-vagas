// Trampos: o site (Ember) consome uma API JSON pública, /api/v2/opportunities.
// A lista traz cidade, modelo e salário; a descrição vem do detalhe de cada vaga (fica em cache).
const { fetchText, pool, sleep } = require('../lib/http');

const BASE = 'https://trampos.co/api/v2/opportunities';
// o portal é pequeno (poucas centenas de vagas, quase todas de comunicação): categoria TI inteira
// mais buscas por termo, que pegam vagas de dev cadastradas em outras categorias
const QUERIES = [
  { q: 'ct[]=ti', pages: 5 },
  { q: 'ct[]=dados', pages: 2 },
  ...['desenvolvedor', 'programador', 'developer', 'front-end', 'back-end', 'full stack', 'software'].map((t) => ({ q: 'tr=' + t, pages: 2 })),
];
const MAX_DETAILS = 40; // descrições novas por atualização
const LEVELS = { estagio: 'estagio', trainee: 'trainee' };

const clean = (s) => String(s ?? '').replace(/\r/g, '').trim();

// Uma vaga da lista (ou do detalhe) -> vaga crua
function parseOpportunity(o) {
  const salary = clean(o.salary);
  return {
    source: 'trampos',
    sourceId: String(o.id),
    title: clean(o.name),
    company: clean(o.custom_company_name || o.company?.name) || 'Empresa confidencial',
    logo: o.company?.logo ? (o.company.logo.startsWith('//') ? 'https:' : '') + o.company.logo : null,
    location: o.home_office && !o.city ? 'Brasil' : [clean(o.city), clean(o.state)].filter(Boolean).join(', ') || 'Brasil',
    workMode: o.home_office ? 'remote' : o.hybrid ? 'hybrid' : null,
    // sem home office nem híbrido marcado, o padrão do Trampos é presencial (a descrição manda)
    workModeHint: o.home_office || o.hybrid ? null : 'onsite',
    workModeHintTrusted: true,
    url: `https://trampos.co/oportunidades/${o.id}`,
    publishedAt: o.published_at ? new Date(o.published_at).toISOString() : null,
    salaryText: /\d/.test(salary) ? salary : null,
    educationText: null,
    description: '',
    levelHint: LEVELS[o.type_slug] || null,
  };
}

function parseList(json) {
  const d = typeof json === 'string' ? JSON.parse(json) : json;
  return {
    jobs: (d.opportunities || []).map(parseOpportunity),
    totalPages: d.pagination?.total_pages || 1,
  };
}

// Detalhe: descrição + requisitos + diferenciais + benefícios
function parseDetail(json) {
  const o = (typeof json === 'string' ? JSON.parse(json) : json).opportunity || {};
  const parts = [
    o.description,
    o.prerequisite && 'Requisitos:\n' + o.prerequisite,
    o.desirable && 'Diferenciais:\n' + o.desirable,
    o.perks && 'Benefícios:\n' + o.perks,
    o.regime && 'Regime: ' + o.regime,
    o.address && 'Local: ' + o.address,
  ];
  return { description: parts.map(clean).filter(Boolean).join('\n\n').slice(0, 6000) };
}

const get = (url) => fetchText(url, { headers: { accept: 'application/json' } });

module.exports = {
  id: 'trampos',
  name: 'Trampos',
  parseList,
  parseDetail,
  async fetchJobs(progress, cache = {}) {
    const byId = new Map();
    const errors = [];
    let done = 0;
    await pool(QUERIES, 2, async ({ q, pages }) => {
      try {
        for (let page = 1; page <= pages; page++) {
          const { jobs, totalPages } = parseList(await get(`${BASE}?${encodeURI(q)}&page=${page}`));
          for (const j of jobs) if (!byId.has(j.sourceId)) byId.set(j.sourceId, j);
          if (page >= totalPages) break;
          await sleep(300);
        }
      } catch (e) {
        errors.push(e.message);
      }
      progress(`${++done}/${QUERIES.length} buscas · ${byId.size} vagas`);
    });
    if (errors.length === QUERIES.length) throw new Error('Trampos: ' + errors[0]);

    const jobs = [...byId.values()];
    const missing = jobs.filter((j) => !cache[j.sourceId]).slice(0, MAX_DETAILS);
    let n = 0;
    await pool(missing, 3, async (j) => {
      try {
        cache[j.sourceId] = parseDetail(await get(`${BASE}/${j.sourceId}`));
      } catch {
        /* sem descrição desta vez; tenta de novo na próxima atualização */
      }
      progress(`descrições ${++n}/${missing.length}`);
      await sleep(200);
    });
    return jobs.map((j) => ({ ...j, ...(cache[j.sourceId] || {}) }));
  },
};
