// Remotar: o site (Next.js) consome uma API JSON pública em api.remotar.com.br.
// A lista já traz descrição, requisitos, salário, tags de nível e modelo de trabalho.
const { fetchText, htmlToText, pool, sleep } = require('../lib/http');

const API = 'https://api.remotar.com.br/jobs';
const CATEGORIES = '13,14,7,8'; // Programação, Programação Mobile, DevOps, QA
const TAGS = { 10: 'estagio', 17: 'junior', 25: 'trainee', 21: 'pleno', 23: 'senior' }; // Estágio, Júnior, Jovem Aprendiz, Pleno, Sênior
const QUERIES = [
  { q: `categoryId=${CATEGORIES}&tagId=10,17,25`, pages: 4 }, // marcadas como estágio/júnior/aprendiz
  { q: `categoryId=${CATEGORIES}`, pages: 4 }, // as mais recentes, marcadas ou não
  ...['junior', 'estagio', 'trainee'].map((t) => ({ q: `search=${t}&categoryId=${CATEGORIES}`, pages: 2 })),
];

function salaryText(s) {
  if (!s || !(s.from > 0 || s.to > 0)) return null;
  // valores em centavos
  const fmt = (v) => (v / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const cur = s.currency && s.currency !== 'BRL' ? s.currency + ' ' : 'R$ ';
  const range = s.from && s.to && s.from !== s.to ? `${cur}${fmt(s.from)} a ${cur}${fmt(s.to)}` : cur + fmt(s.to || s.from);
  return range + ({ monthly: ' por mês', hourly: ' por hora', yearly: ' por ano', annual: ' por ano' }[s.type] || '');
}

function parseJob(j) {
  const tags = (j.jobTags || []).map((t) => t.tagId ?? t.tag?.id);
  const level = tags.map((t) => TAGS[t]).filter(Boolean);
  const parts = [
    htmlToText(j.description),
    (j.jobFeaturedInfos || []).map((f) => f.message).join('\n'),
    j.jobRequirements?.length && 'Requisitos:\n' + j.jobRequirements.map((r) => '- ' + r.description).join('\n'),
    j.jobBenefits?.length && 'Benefícios:\n' + j.jobBenefits.map((b) => '- ' + b.description).join('\n'),
  ];
  return {
    source: 'remotar',
    sourceId: String(j.id),
    title: String(j.title || '').trim(),
    company: (j.companyDisplayName || j.company?.name || '').trim() || 'Empresa confidencial',
    logo: j.company?.companyProfilePicture?.smallUrl || j.company?.companyProfilePicture?.url || null,
    location: j.city ? [j.city, j.state].filter(Boolean).join(', ') : 'Brasil',
    workMode: { remote: 'remote', hybrid: 'hybrid', onsite: 'onsite', presential: 'onsite' }[j.type] || null,
    url: `https://remotar.com.br/job/${j.id}`,
    publishedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    salaryText: salaryText(j.jobSalary),
    educationText: null,
    description: parts.filter(Boolean).join('\n\n').slice(0, 6000),
    // vaga "Júnior/Pleno" vem com as duas tags: fica a mais baixa
    levelHint: ['estagio', 'trainee', 'junior', 'pleno', 'senior'].find((l) => level.includes(l)) || null,
  };
}

function parseList(json) {
  const d = typeof json === 'string' ? JSON.parse(json) : json;
  return {
    jobs: (d.data || []).filter((j) => j.active !== false && !j.expired).map(parseJob),
    lastPage: d.meta?.last_page || 1,
  };
}

module.exports = {
  id: 'remotar',
  name: 'Remotar',
  parseList,
  async fetchJobs(progress) {
    const byId = new Map();
    const errors = [];
    let done = 0;
    await pool(QUERIES, 2, async ({ q, pages }) => {
      try {
        for (let page = 1; page <= pages; page++) {
          const { jobs, lastPage } = parseList(await fetchText(`${API}?${q}&page=${page}`, { headers: { accept: 'application/json', origin: 'https://remotar.com.br' } }));
          for (const j of jobs) if (!byId.has(j.sourceId)) byId.set(j.sourceId, j);
          if (page >= lastPage) break;
          await sleep(300);
        }
      } catch (e) {
        errors.push(e.message);
      }
      progress(`${++done}/${QUERIES.length} buscas · ${byId.size} vagas`);
    });
    if (errors.length === QUERIES.length) throw new Error('Remotar: ' + errors[0]);
    return [...byId.values()];
  },
};
