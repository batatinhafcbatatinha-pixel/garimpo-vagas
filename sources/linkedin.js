// LinkedIn: usa as páginas públicas de busca (sem login). A lista não traz a descrição,
// então cada vaga nova é aberta uma vez e a descrição fica em cache.
const { fetchText, htmlToText, decodeEntities, pool, sleep } = require('../lib/http');
const auth = require('../lib/linkedin-auth');

const BASE = 'https://www.linkedin.com/jobs-guest/jobs/api';
const TERMS = ['desenvolvedor junior', 'programador junior', 'desenvolvedor jr', 'junior developer', 'desenvolvedor trainee', 'estágio desenvolvimento'];
const PLACES = [
  { tag: 'poa', qs: 'location=' + encodeURIComponent('Porto Alegre, Rio Grande do Sul, Brazil') + '&distance=10', pages: 3 },
  { tag: 'remoto', qs: 'location=Brazil&geoId=106057199&f_WT=2', pages: 4, workMode: 'remote' },
];
const MAX_DETAILS = 150; // por atualização; o resto entra na próxima

const clean = (s) => decodeEntities(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function parseCards(html, place) {
  return html
    .split(/<li[\s>]/)
    .slice(1)
    .map((c) => {
      const g = (re) => (c.match(re) || [])[1];
      const id = g(/jobPosting:(\d+)/);
      if (!id) return null;
      return {
        source: 'linkedin',
        sourceId: id,
        title: clean(g(/base-search-card__title[^>]*>([\s\S]*?)<\/h3>/)),
        company: clean(g(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/)),
        logo: decodeEntities(g(/data-delayed-url="([^"]+)"/) || '') || null,
        location: clean(g(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/)),
        // o filtro f_WT do LinkedIn é frouxo (sem login a vaga não mostra o modelo), então é só uma pista
        workModeHint: place.workMode || null,
        url: `https://www.linkedin.com/jobs/view/${id}`,
        publishedAt: g(/datetime="([^"]+)"/) || null,
        salaryText: clean(g(/job-search-card__salary-info[^>]*>([\s\S]*?)<\/span>/)) || null,
        description: '',
      };
    })
    .filter((j) => j && j.title);
}

async function fetchDetail(id) {
  const html = await fetchText(`${BASE}/jobPosting/${id}`, { retries: 3 });
  const desc = (html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/) || [])[1];
  const criteria = [...html.matchAll(/description__job-criteria-text[^>]*>([\s\S]*?)<\/span>/g)].map((m) => clean(m[1]));
  const seniority = (criteria[0] || '').toLowerCase();
  return {
    description: htmlToText(desc).slice(0, 6000),
    levelHint: /intern|estági/.test(seniority) ? 'estagio' : /entry|júnior|assistente/.test(seniority) ? 'junior' : /mid|pleno/.test(seniority) ? 'pleno' : /senior|sênior|director|executive/.test(seniority) ? 'senior' : null,
  };
}

module.exports = {
  id: 'linkedin',
  name: 'LinkedIn',
  async fetchJobs(progress, cache) {
    const byId = new Map();
    const errors = [];
    let searches = 0;
    const total = TERMS.length * PLACES.length;
    for (const place of PLACES) {
      for (const term of TERMS) {
        for (let page = 0; page < place.pages; page++) {
          const url = `${BASE}/seeMoreJobPostings/search?keywords=${encodeURIComponent(term)}&${place.qs}&sortBy=DD&start=${page * 10}`;
          try {
            const cards = parseCards(await fetchText(url, { retries: 3 }), place);
            for (const c of cards) if (!byId.has(c.sourceId)) byId.set(c.sourceId, c);
            if (cards.length < 10) break;
          } catch (e) {
            errors.push(e.message);
            break;
          }
          await sleep(350);
        }
        progress(`${++searches}/${total} buscas · ${byId.size} vagas`);
      }
    }
    if (!byId.size && errors.length) throw new Error(errors[0]);

    const jobs = [...byId.values()];
    const missing = jobs.filter((j) => !cache[j.sourceId]).slice(0, MAX_DETAILS);
    let done = 0;
    await pool(missing, 3, async (j) => {
      try {
        cache[j.sourceId] = await fetchDetail(j.sourceId);
      } catch {
        /* sem descrição desta vez; tenta de novo na próxima atualização */
      }
      progress(`descrições ${++done}/${missing.length}`);
      await sleep(250);
    });
    // com login (opcional), confere o modelo de trabalho real; as "remotas" primeiro
    const ids = [...jobs].sort((a, b) => (b.workModeHint === 'remote') - (a.workModeHint === 'remote')).map((j) => j.sourceId);
    await auth.fillWorkModes(ids, cache, progress);
    return jobs.map((j) => ({ ...j, ...(cache[j.sourceId] || {}) }));
  },
};
