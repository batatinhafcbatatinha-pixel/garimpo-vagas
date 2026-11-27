// Catho: a busca é HTML renderizado no servidor (cards sem descrição). O painel de detalhe
// do próprio site busca um JSON em oferta.catho.com.br; cada vaga nova é aberta uma vez e fica em cache.
const { fetchText, htmlToText, decodeEntities, pool, sleep } = require('../lib/http');
const { isDevJob } = require('../lib/classify');

const BASE = 'https://www.catho.com.br/vagas';
const POA_TERMS = ['desenvolvedor', 'programador', 'developer', 'front-end', 'back-end', 'full-stack'];
const REMOTE_TERMS = [
  ['desenvolvedor', 3],
  ['programador', 2],
  ['desenvolvedor-junior', 1],
  ['front-end', 1],
  ['back-end', 1],
  ['full-stack', 1],
];
const SEARCHES = [
  ...POA_TERMS.map((t) => ({ url: `${BASE}/${t}/porto-alegre-rs/?order=dataAtualizacao`, pages: 2 })),
  ...REMOTE_TERMS.map(([t, pages]) => ({ url: `${BASE}/${t}/?order=dataAtualizacao&work_model[0]=remote`, pages, remote: true })),
];
const MAX_DETAILS = 60; // por atualização; o resto entra na próxima
const PER_PAGE = 20;

const clean = (s) => decodeEntities(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// "Publicada em 05/11" (sem ano): se cair no futuro, é do ano passado
function cardDate(tag, now = new Date()) {
  const t = clean(tag).toLowerCase();
  const day = (d) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12)).toISOString();
  if (/hoje/.test(t)) return day(now);
  if (/ontem/.test(t)) return day(new Date(now - 864e5));
  const m = t.match(/(\d{2})\/(\d{2})/);
  if (!m) return null;
  let d = new Date(Date.UTC(now.getFullYear(), m[2] - 1, m[1], 12));
  if (d > now) d = new Date(Date.UTC(now.getFullYear() - 1, m[2] - 1, m[1], 12));
  return d.toISOString();
}

function parseCards(html, search = {}, now = new Date()) {
  return html
    .split(/<li data-offer-item="/)
    .slice(1)
    .map((c) => {
      const g = (re) => (c.match(re) || [])[1];
      const id = g(/^(\d+)"/);
      const href = g(/<h2 class="title_offer">\s*<a href="([^"]+)"/);
      if (!id || !href) return null;
      const salary = clean(g(/i_salary"><\/span>\s*<strong>([\s\S]*?)<\/strong>/));
      return {
        source: 'catho',
        sourceId: id,
        title: clean(g(/<h2 class="title_offer">\s*<a [^>]*>([\s\S]*?)<\/a>/)),
        company: clean(g(/<p class="mb-2">\s*<span class="text-12[^"]*">([\s\S]*?)<\/span>/)) || 'Empresa confidencial',
        logo: null,
        location: clean(g(/i_job_location"><\/span>[\s\S]*?<\/strong>\s*-\s*([^<]+)/)),
        // o filtro "Home Office" da busca é a única pista: nem o card nem o detalhe trazem o modelo
        workModeHint: search.remote ? 'remote' : null,
        url: 'https://www.catho.com.br' + href,
        publishedAt: cardDate(g(/<span class="tag pub_[^"]*">([^<]*)<\/span>/), now),
        salaryText: /R\$/.test(salary) ? salary : null,
        description: '',
        levelHint: null,
      };
    })
    .filter((j) => j && j.title);
}

// JSON do painel de detalhe: { o: oferta, c: empresa }
function parseDetail(json) {
  const o = json?.o;
  if (!o) return null;
  const c = json.c || {};
  const contract = (o.ctns || []).join(' ').toLowerCase();
  const city = (o.cins || [])[0];
  const uf = (o.lab || [])[0];
  return {
    title: o.t || undefined,
    company: c.cn?.replace(/\*+/g, '').trim() || undefined, // empresa oculta vem como "********"
    logo: c.lp ? c.lp.replace(/^\/\//, 'https://') : null,
    ...(city ? { location: [city, uf].filter(Boolean).join(', ') } : {}),
    publishedAt: o.pt && !o.pt.startsWith('0001') ? new Date(o.pt + '-03:00').toISOString() : undefined,
    ...(/R\$/.test(o.sn || '') ? { salaryText: o.sn } : {}),
    description: htmlToText(o.ld).slice(0, 6000),
    levelHint: /est[aá]gio/.test(contract) ? 'estagio' : /trainee|aprendiz/.test(contract) ? 'trainee' : null,
  };
}

async function fetchDetail(id) {
  const json = await fetchText(`https://oferta.catho.com.br/offer/${id}/d/j?ipo=42&iapo=1`, {
    headers: { 'x-requested-with': 'XMLHttpRequest' },
  });
  let data = JSON.parse(json);
  if (typeof data === 'string') data = JSON.parse(data); // com "accept: json" o servidor manda o JSON dentro de uma string
  const d = parseDetail(data);
  if (!d) throw new Error('Catho: detalhe vazio');
  // tira os campos indefinidos para não apagar o que veio do card
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined));
}

module.exports = {
  id: 'catho',
  name: 'Catho',
  parseCards,
  parseDetail,
  async fetchJobs(progress, cache) {
    const byId = new Map();
    const errors = [];
    let done = 0;
    await pool(SEARCHES, 2, async (s) => {
      try {
        for (let page = 1; page <= s.pages; page++) {
          const cards = parseCards(await fetchText(s.url + (page > 1 ? `&page=${page}` : '')), s);
          for (const c of cards) if (!byId.has(c.sourceId)) byId.set(c.sourceId, c);
          if (cards.length < PER_PAGE) break;
          await sleep(400);
        }
      } catch (e) {
        errors.push(e.message);
      }
      progress(`${++done}/${SEARCHES.length} buscas · ${byId.size} vagas`);
    });
    if (errors.length === SEARCHES.length) throw new Error(errors[0]);

    const jobs = [...byId.values()];
    // só abre as que parecem de dev (a busca é frouxa e traz muita vaga de outra área)
    const missing = jobs.filter((j) => !cache[j.sourceId] && isDevJob(j.title)).slice(0, MAX_DETAILS);
    let n = 0;
    await pool(missing, 3, async (j) => {
      try {
        cache[j.sourceId] = await fetchDetail(j.sourceId);
      } catch {
        /* sem descrição desta vez; tenta de novo na próxima atualização */
      }
      progress(`descrições ${++n}/${missing.length}`);
      await sleep(250);
    });
    return jobs.map((j) => ({ ...j, ...(cache[j.sourceId] || {}) }));
  },
};
