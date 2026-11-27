const test = require('node:test');
const assert = require('node:assert');
const { parseList, parseDetail } = require('../sources/geekhunter');

const job = (id, over = {}) => ({
  __typename: 'PublicJob',
  id: `ats_${id}`,
  type: 'ats',
  atsJob: {
    __typename: 'AtsJob',
    id,
    jobSlug: 'desenvolvedor-junior-1',
    publishedAt: '1795697011778',
    company: { __typename: 'NestCompany', id: 151, slug: 'mv-saude-digital' },
    atsJobDetail: {
      title: ' DESENVOLVEDOR JÚNIOR',
      description: 'Sobre a vaga: buscamos [dev] "júnior"…',
      experienceLevel: 'entry',
      workModality: 'on-site',
      atsJobSalaries: [{ contractType: 'CLT', minSalary: 3000, maxSalary: 4500, currency: 'BRL', currencyRef: { symbol: 'R$' } }],
      atsJobCities: [{ name: 'Porto Alegre, RS' }],
      ...over,
    },
  },
});

// payload RSC: a lista vem quebrada em vários self.__next_f.push com strings JSON
const page = (data, total = 2) => {
  const rsc = `42:["$","$L57",null,{"data":${JSON.stringify(data)},"meta":{"__typename":"PaginationMeta","total":${total},"currentPage":1,"lastPage":2,"perPage":25}}]\n`;
  const half = Math.floor(rsc.length / 2);
  return `<html><script>self.__next_f.push([1,${JSON.stringify(rsc.slice(0, half))}])</script>` +
    `<script>self.__next_f.push([1,${JSON.stringify(rsc.slice(half))}])</script></html>`;
};

test('lê a lista do payload RSC, mesmo quebrada em pedaços', () => {
  const html = page([
    job(1),
    job(2, { title: 'Dev Backend', experienceLevel: 'intern', workModality: 'remote-in-city', atsJobSalaries: [], atsJobCities: [] }),
    { __typename: 'PublicJob', id: 'outro_3', type: 'outro' },
  ]);
  const { jobs, lastPage } = parseList(html, { city: 'Porto Alegre, RS' });
  assert.strictEqual(lastPage, 2);
  assert.strictEqual(jobs.length, 2);
  const [a, b] = jobs;
  assert.strictEqual(a.sourceId, 'ats_1');
  assert.strictEqual(a.title, 'DESENVOLVEDOR JÚNIOR');
  assert.strictEqual(a.company, 'Mv Saude Digital'); // provisório, a página da vaga traz o nome certo
  assert.strictEqual(a.url, 'https://www.geekhunter.com/pt/mv-saude-digital/jobs/desenvolvedor-junior-1');
  assert.strictEqual(a.location, 'Porto Alegre, RS');
  assert.strictEqual(a.workMode, 'onsite');
  assert.strictEqual(a.levelHint, 'junior');
  assert.strictEqual(a.publishedAt, new Date(1795697011778).toISOString());
  assert.match(a.salaryText, /^R\$ 3\.000 a R\$ 4\.500 \(CLT\)$/);
  assert.match(a.description, /\[dev\] "júnior"/);
  assert.strictEqual(b.levelHint, 'estagio');
  assert.strictEqual(b.workMode, 'remote');
  assert.strictEqual(b.salaryText, null);
  assert.strictEqual(b.location, 'Porto Alegre, RS'); // sem cidade: vale a da busca
});

test('busca vazia e página sem lista', () => {
  assert.deepStrictEqual(parseList(page([], 0)), { jobs: [], lastPage: 1 });
  assert.strictEqual(parseList('<html>bloqueado</html>'), null);
});

test('página da vaga: empresa, logo e descrição do JSON-LD', () => {
  const ld = {
    '@type': 'JobPosting',
    description: '<p><strong>Requisitos</strong></p><ul><li>Java</li></ul>',
    hiringOrganization: { '@type': 'Organization', name: 'MV', logo: 'https://cdn/x.png' },
  };
  const html = `<script id="org" type="application/ld+json">{"@type":"Organization"}</script><script id="job" type="application/ld+json">${JSON.stringify(ld)}</script>`;
  assert.deepStrictEqual(parseDetail(html), { description: 'Requisitos\nJava', company: 'MV', logo: 'https://cdn/x.png' });
  ld.hiringOrganization = { name: 'Confidencial' };
  const conf = parseDetail(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
  assert.strictEqual(conf.company, undefined);
});
