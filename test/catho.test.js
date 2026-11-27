const test = require('node:test');
const assert = require('node:assert');
const { parseCards, parseDetail } = require('../sources/catho');

const card = (id, title, company, extra = '') => `
  <li data-offer-item="${id}" data-blind="false" class="mb-5" data-matches-filter="True" >
    <article class="offer " data-offer-item-subcontainer>
        <span class="tag pub_ontem mb-2">Publicada em 05/11</span>
        <h2 class="title_offer">
            <a href="/vagas/dev/${id}" title="${title}" data-navigation-offer>${title}</a>
        </h2>
        <p class="mb-2">
                <span class="text-12${extra}">${company}</span>
        </p>
        <p>
            <span class="icon i_job_location"></span>
            <strong>1
vaga</strong>
            - Porto Alegre
        </p>
        <p>
            <span class="icon i_salary"></span>
                <strong>A partir de R$ 3.000,00</strong>
        </p>
    </article>
</li>`;

test('lê os cards da busca da Catho', () => {
  const html = `<ul>${card(38816980, 'Desenvolvedor Web J&#xFA;nior', 'BENITES')}${card(39411038, 'Desenvolvedor Fluig', 'Empresa Confidencial', ' mr-2')}</ul>`;
  const now = new Date('2026-11-27T12:00:00Z');
  const jobs = parseCards(html, {}, now);
  assert.strictEqual(jobs.length, 2);
  assert.strictEqual(jobs[0].sourceId, '38816980');
  assert.strictEqual(jobs[0].title, 'Desenvolvedor Web Júnior');
  assert.strictEqual(jobs[0].company, 'BENITES');
  assert.strictEqual(jobs[0].location, 'Porto Alegre');
  assert.strictEqual(jobs[0].url, 'https://www.catho.com.br/vagas/dev/38816980');
  assert.strictEqual(jobs[0].salaryText, 'A partir de R$ 3.000,00');
  assert.strictEqual(jobs[0].publishedAt, '2026-11-05T12:00:00.000Z');
  assert.strictEqual(jobs[0].workModeHint, null);
  assert.strictEqual(jobs[1].company, 'Empresa Confidencial');
  assert.strictEqual(parseCards(html, { remote: true }, now)[0].workModeHint, 'remote');
});

test('data sem ano no futuro é do ano passado', () => {
  const html = card(1, 'Dev', 'X').replace('05/11', '20/12');
  assert.strictEqual(parseCards(html, {}, new Date('2026-01-10T12:00:00Z'))[0].publishedAt, '2025-12-20T12:00:00.000Z');
});

test('lê o JSON do detalhe da vaga', () => {
  const d = parseDetail({
    o: {
      ld: 'Criar sites em WordPress.\nHTML, CSS e JavaScript.',
      t: 'Desenvolvedor Web Júnior',
      pt: '2026-10-13T15:40:02',
      sn: 'A partir de R$ 3.000,00',
      cins: ['Porto Alegre'],
      lab: ['RS'],
      ctns: ['Estágio'],
    },
    c: { cn: 'BENITES ', lp: '//static.catho.com.br/images/emp/logotipos/1.gif' },
  });
  assert.strictEqual(d.location, 'Porto Alegre, RS');
  assert.strictEqual(d.company, 'BENITES');
  assert.strictEqual(d.logo, 'https://static.catho.com.br/images/emp/logotipos/1.gif');
  assert.strictEqual(d.publishedAt, '2026-10-13T18:40:02.000Z');
  assert.strictEqual(d.salaryText, 'A partir de R$ 3.000,00');
  assert.strictEqual(d.levelHint, 'estagio');
  assert.match(d.description, /WordPress\.\nHTML/);
});

test('detalhe com empresa oculta e sem salário', () => {
  const d = parseDetail({ o: { ld: 'x', t: 'Dev', pt: '0001-01-01T00:00:00', sn: 'A Combinar', cins: [], ctns: ['CLT (Efetivo)'] }, c: { cn: '********', lp: '' } });
  assert.strictEqual(d.company, undefined);
  assert.strictEqual(d.location, undefined);
  assert.strictEqual(d.publishedAt, undefined);
  assert.strictEqual(d.salaryText, undefined);
  assert.strictEqual(d.levelHint, null);
  assert.strictEqual(parseDetail({}), null);
});
