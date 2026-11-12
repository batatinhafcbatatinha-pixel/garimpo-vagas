// Gupy: o portal renderiza a busca no servidor e embute o resultado em __NEXT_DATA__.
const { fetchText, htmlToText, pool } = require('../lib/http');

const TERMS = ['desenvolvedor', 'programador', 'developer', 'desenvolvedora', 'software', 'front-end', 'back-end', 'full stack', 'estágio desenvolvimento'];
const MODES = { remote: 'remote', hybrid: 'hybrid', 'on-site': 'onsite' };

async function searchPage(params) {
  const html = await fetchText('https://portal.gupy.io/job-search/' + encodeURI(params));
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Gupy: página sem dados');
  return JSON.parse(m[1]).props.pageProps.initialJobList;
}

async function search(base, maxPages) {
  const jobs = [];
  for (let page = 1; page <= maxPages; page++) {
    const list = await searchPage(base + (page > 1 ? `&page=${page}` : ''));
    jobs.push(...list.data);
    const { total, limit, offset } = list.pagination;
    if (offset + limit >= total) break;
  }
  return jobs;
}

module.exports = {
  id: 'gupy',
  name: 'Gupy',
  async fetchJobs(progress) {
    const queries = [];
    for (const term of TERMS) {
      queries.push({ q: `term=${term}&state=Rio Grande do Sul&city=Porto Alegre`, pages: 3 });
      queries.push({ q: `term=${term} junior&workplaceTypes[]=remote`, pages: 4 });
      queries.push({ q: `term=${term} jr&workplaceTypes[]=remote`, pages: 2 });
    }
    let done = 0;
    const errors = [];
    const results = await pool(queries, 4, async ({ q, pages }) => {
      try {
        return await search(q, pages);
      } catch (e) {
        errors.push(e.message);
        return [];
      } finally {
        progress(`${++done}/${queries.length} buscas`);
      }
    });
    if (errors.length === queries.length) throw new Error(errors[0]);
    return results.flat().map((j) => ({
      source: 'gupy',
      sourceId: String(j.id),
      title: j.name.trim(),
      company: j.careerPageName,
      logo: j.careerPageLogo || null,
      location: [j.city, j.state].filter(Boolean).join(', ') || 'Brasil',
      workMode: MODES[j.workplaceType] || null,
      url: j.jobUrl,
      publishedAt: j.publishedDate || null,
      description: htmlToText(j.description).slice(0, 6000),
      levelHint: /internship/.test(j.type) ? 'estagio' : /trainee|apprentice/.test(j.type) ? 'trainee' : null,
    }));
  },
};
