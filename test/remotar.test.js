const test = require('node:test');
const assert = require('node:assert');
const { parseList } = require('../sources/remotar');

const job = (o) => ({
  id: 174115, title: 'Desenvolvedor(a) Back-End Laravel Júnior', companyDisplayName: null,
  description: '<p>Vaga para <strong>PHP</strong> &amp; Laravel.</p>', city: null, state: null, type: 'remote',
  expired: false, active: true, createdAt: '2026-11-27T16:22:15.586-03:00',
  company: { name: 'Acme', companyProfilePicture: { url: 'https://s3/x.jpg', smallUrl: 'https://s3/x-small.jpg' } },
  jobSalary: { from: null, to: null, currency: null, type: 'uninformed' },
  jobTags: [{ tagId: 17, tag: { id: 17, name: '🐥 Júnior' } }, { tagId: 4, tag: { id: 4, name: '🌍 100% Remoto' } }],
  jobRequirements: [{ description: 'Laravel;' }], jobBenefits: [], jobFeaturedInfos: [],
  ...o,
});
const page = {
  meta: { total: 3, per_page: 50, current_page: 1, last_page: 1 },
  data: [
    job(),
    job({
      id: 2, title: 'Programa de Estágio', type: 'hybrid', city: 'Porto Alegre', state: 'RS',
      jobSalary: { from: 330000, to: 330000, currency: 'BRL', type: 'monthly' },
      jobTags: [{ tagId: 21 }, { tagId: 10 }],
    }),
    job({ id: 3, expired: true }),
  ],
};

test('lê vagas da API, ignora expiradas', () => {
  const { jobs, lastPage } = parseList(JSON.stringify(page));
  assert.strictEqual(lastPage, 1);
  assert.strictEqual(jobs.length, 2);
  const a = jobs[0];
  assert.strictEqual(a.sourceId, '174115');
  assert.strictEqual(a.company, 'Acme');
  assert.strictEqual(a.logo, 'https://s3/x-small.jpg');
  assert.strictEqual(a.location, 'Brasil');
  assert.strictEqual(a.workMode, 'remote');
  assert.strictEqual(a.url, 'https://remotar.com.br/job/174115');
  assert.strictEqual(a.levelHint, 'junior');
  assert.strictEqual(a.salaryText, null);
  assert.strictEqual(a.description, 'Vaga para PHP & Laravel.\n\nRequisitos:\n- Laravel;');
  assert.strictEqual(a.publishedAt, '2026-11-27T19:22:15.586Z');
});

test('salário em centavos, cidade e nível mais baixo entre as tags', () => {
  const b = parseList(page).jobs[1];
  assert.strictEqual(b.location, 'Porto Alegre, RS');
  assert.strictEqual(b.workMode, 'hybrid');
  assert.strictEqual(b.salaryText, 'R$ 3.300 por mês');
  assert.strictEqual(b.levelHint, 'estagio');
});
