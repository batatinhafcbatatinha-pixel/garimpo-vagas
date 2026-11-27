// 99jobs: a busca do site carrega os cards por AJAX (HTML parcial). O card corta o título
// em ~37 letras e não tem descrição, então cada vaga nova é aberta uma vez (fica em cache).
const { fetchText, htmlToText, decodeEntities, pool, sleep } = require('../lib/http');

const SEARCH = 'https://www.99jobs.com/opportunities/filtered_search/search_opportunities';
// pouca vaga de dev no portal: termos de dev em todo o Brasil (o filtro de local fica no classificador)
const TERMS = ['desenvolvedor', 'desenvolvedora', 'programador', 'developer', 'front', 'back-end', 'full stack', 'software', 'sistemas', 'java', 'estágio tecnologia', 'estágio desenvolvimento'];
const PAGES = 2;
const MAX_DETAILS = 40; // páginas de vaga novas por atualização
const MODES = { remoto: 'remote', hibrido: 'hybrid', presencial: 'onsite' };
const LEVELS = { estagio: 'estagio', trainee: 'trainee', 'jovem aprendiz': 'trainee', junior: 'junior', pleno: 'pleno', senior: 'senior', especialista: 'senior' };

const clean = (s) => decodeEntities(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function parseCards(html) {
  return String(html)
    .split('<a class="opportunity-card"')
    .slice(1)
    .map((c) => {
      const g = (re) => (c.match(re) || [])[1];
      const href = decodeEntities(g(/href="([^"]+)"/) || '');
      const id = g(/\/jobs\/(\d+)-/);
      if (!id) return null;
      const loc = clean(g(/opportunity-address">[\s\S]*?<p>([\s\S]*?)<\/p>/)).replace(/\s*,\s*/g, ', ');
      const mode = MODES[fold(clean(g(/opportunity-label-acting-mode">([^<]*)/)))] || null;
      return {
        source: '99jobs',
        sourceId: id,
        title: clean(g(/<h1>([\s\S]*?)<\/h1>/)),
        company: clean(g(/opportunity-company-infos">\s*<h2>([\s\S]*?)<\/h2>/)) || 'Empresa confidencial',
        logo: g(/opportunity-company-logo">\s*<img src="([^"]+)"/) || null,
        location: !loc || /n.o informado/i.test(loc) ? 'Brasil' : loc,
        workMode: mode,
        url: href.split('?')[0],
        publishedAt: null, // o portal não mostra a data
        salaryText: null,
        educationText: null,
        description: '',
        levelHint: LEVELS[fold(clean(g(/opportunity-label-level">([^<]*)/)))] || null,
      };
    })
    .filter((j) => j && j.title);
}

// Página da vaga: título completo e o miolo (responsabilidades, requisitos, benefícios), sem o "Sobre a Organização"
function parseDetail(html) {
  const h = String(html);
  const title = clean((h.match(/<h2 style="font-size: 28px;"><strong>([\s\S]*?)<\/strong>/) || [])[1]);
  const start = h.indexOf('opportunities-details');
  if (start < 0) return null;
  let end = h.indexOf('Sobre a Organiza', start);
  if (end < 0) end = start + 30000;
  const body = h.slice(h.indexOf('>', start) + 1, end).replace(/<h2[^>]*>[\s\S]*?<\/h2>/, '');
  const description = htmlToText(body).slice(0, 6000);
  return { ...(title ? { title } : {}), description };
}

module.exports = {
  id: '99jobs',
  name: '99jobs',
  parseCards,
  parseDetail,
  async fetchJobs(progress, cache = {}) {
    const byId = new Map();
    const errors = [];
    let done = 0;
    await pool(TERMS, 2, async (term) => {
      try {
        for (let page = 1; page <= PAGES; page++) {
          const cards = parseCards(await fetchText(`${SEARCH}?page=${page}&search%5Bterm%5D=${encodeURIComponent(term)}`));
          for (const c of cards) if (!byId.has(c.sourceId)) byId.set(c.sourceId, c);
          if (cards.length < 20) break;
          await sleep(400);
        }
      } catch (e) {
        errors.push(e.message);
      }
      progress(`${++done}/${TERMS.length} buscas · ${byId.size} vagas`);
    });
    if (errors.length === TERMS.length) throw new Error('99jobs: ' + errors[0]);

    const jobs = [...byId.values()];
    const missing = jobs.filter((j) => !cache[j.sourceId]).slice(0, MAX_DETAILS);
    let n = 0;
    await pool(missing, 3, async (j) => {
      try {
        const d = parseDetail(await fetchText(j.url));
        if (d) cache[j.sourceId] = d;
      } catch {
        /* sem descrição desta vez; tenta de novo na próxima atualização */
      }
      progress(`descrições ${++n}/${missing.length}`);
      await sleep(300);
    });
    return jobs.map((j) => ({ ...j, ...(cache[j.sourceId] || {}) }));
  },
};
