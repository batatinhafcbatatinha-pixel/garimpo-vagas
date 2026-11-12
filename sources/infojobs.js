// InfoJobs: os cards da busca já trazem salário, escolaridade e modelo de trabalho.
const { fetchText, decodeEntities, pool } = require('../lib/http');

const TERMS = ['desenvolvedor', 'programador', 'desenvolvedor junior', 'programador junior', 'developer', 'front end', 'back end', 'full stack', 'estagio desenvolvimento'];
const slug = (t) => encodeURIComponent(t).replace(/%20/g, '+');
const PLACES = [
  { url: (t) => `https://www.infojobs.com.br/vagas-de-emprego-${slug(t)}-em-porto-alegre,-rs.aspx`, pages: 3 },
  { url: (t) => `https://www.infojobs.com.br/vagas-de-emprego-${slug(t)}-trabalho-home-office.aspx`, pages: 3, remote: true },
];

const clean = (s) => decodeEntities(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function parseCards(html, place = {}) {
  return html
    .split(/class="[^"]*js_rowCard/)
    .slice(1)
    .map((c) => {
      const g = (re) => (c.match(re) || [])[1];
      const id = g(/data-id="(\d+)"/);
      const href = g(/data-href="([^"]+)"/);
      if (!id || !href) return null;
      // linha de ícones: money = salário, graduate-hat = escolaridade, house-and-building = modelo
      const icon = (name) => clean(g(new RegExp(`xlink:href="#${name}"\\s*/>\\s*</svg>([\\s\\S]*?)</div>`)));
      const mode = icon('house-and-building').toLowerCase();
      const date = g(/js_date" data-value="([^"]+)"/);
      const salary = icon('money');
      return {
        source: 'infojobs',
        sourceId: id,
        title: clean(g(/js_vacancyTitle[^>]*>([\s\S]*?)<\/h2>/)),
        company: clean(g(/<div class="text-body">([\s\S]*?)<\/div>/)).replace(/Este selo indica[\s\S]*/, '').trim() || 'Empresa confidencial',
        logo: null,
        location: clean(g(/<div class="mb-8">([\s\S]*?)<span hidden/)) || clean(g(/<div class="mb-8">([\s\S]*?)<\/div>/)),
        workMode: /home office|remoto/.test(mode) ? 'remote' : /h.brido/.test(mode) ? 'hybrid' : /presencial/.test(mode) ? 'onsite' : place.remote ? 'remote' : null, // busca de home office sem modelo no card = remoto
        url: 'https://www.infojobs.com.br' + href,
        publishedAt: date ? new Date(date.replace(/\//g, '-').replace(' ', 'T') + '-03:00').toISOString() : null,
        salaryText: /R\$/.test(salary) ? salary : null,
        educationText: icon('graduate-hat') || null,
        description: clean((c.match(/<div class="text-medium">([\s\S]*?)<\/div>\s*<\/div>/) || [])[1]),
      };
    })
    .filter((j) => j && j.title);
}

module.exports = {
  id: 'infojobs',
  name: 'InfoJobs',
  parseCards,
  async fetchJobs(progress) {
    const queries = PLACES.flatMap((p) => TERMS.map((t) => ({ p, t })));
    let done = 0;
    const errors = [];
    const results = await pool(queries, 3, async ({ p, t }) => {
      const jobs = [];
      try {
        for (let page = 1; page <= p.pages; page++) {
          const cards = parseCards(await fetchText(p.url(t) + (page > 1 ? `?Page=${page}` : '')), p);
          jobs.push(...cards);
          if (cards.length < 15) break;
        }
      } catch (e) {
        errors.push(e.message);
      }
      progress(`${++done}/${queries.length} buscas`);
      return jobs;
    });
    if (errors.length === queries.length) throw new Error(errors[0]);
    return results.flat();
  },
};
