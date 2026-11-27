const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../sources/solides');

// formato de /api/vacancies (campos que não usamos foram cortados)
const vaga = {
  id: 949725,
  title: 'Desenvolvedor  Front-end Jr ',
  description: '<p>Buscamos <strong>Dev</strong> React &amp; TypeScript.</p><ul><li>Remoto</li></ul>',
  companyName: 'Wicomm',
  companyLogo: 'https://exemplo/logo.png',
  state: { name: 'São Paulo', code: 'SP' },
  city: { name: 'Barueri', stateId: 26 },
  homeOffice: false,
  jobType: 'remoto',
  salary: { type: 'simple', showRangeToApplicant: true, initialRange: 0, finalRange: 2000, negotiable: false },
  seniority: [{ id: 4, name: 'Junior' }, { id: 5, name: 'Pleno' }],
  education: [{ id: 46, name: 'Tecnólogo' }, { id: 45, name: 'Graduação' }],
  createdAt: '2026-11-05',
  publishers: {},
  isDisabled: false,
};
const rhgestor = {
  ...vaga,
  id: 'ZshvHROJP6',
  homeOffice: true,
  jobType: 'presencial',
  city: { name: 'Campinas' },
  salary: { showRangeToApplicant: false, initialRange: null, finalRange: null },
  seniority: [{ name: 'Estagiário' }],
  education: [],
  createdAt: null,
  publishers: { rhgestor: { redirectUrl: 'https://vagasmartonline.rhgestor.com.br/vagas/detalhes/abc' } },
};

test('lê os campos da API', () => {
  const [j] = parse({ totalPages: 1, currentPage: 1, count: 1, data: [vaga] });
  assert.strictEqual(j.source, 'solides');
  assert.strictEqual(j.sourceId, '949725');
  assert.strictEqual(j.title, 'Desenvolvedor Front-end Jr');
  assert.strictEqual(j.company, 'Wicomm');
  assert.strictEqual(j.location, 'Barueri, SP');
  assert.strictEqual(j.workMode, 'remote');
  assert.strictEqual(j.url, 'https://vagas.solides.com.br/vaga/949725');
  assert.strictEqual(j.publishedAt, '2026-11-05T15:00:00.000Z');
  assert.strictEqual(j.salaryText, 'R$ 2.000,00');
  assert.strictEqual(j.educationText, 'Tecnólogo, Graduação');
  assert.strictEqual(j.levelHint, 'junior');
  assert.match(j.description, /React & TypeScript/);
  assert.doesNotMatch(j.description, /</);
});

test('vaga do RH Gestor usa o link de lá; home office manda no modelo', () => {
  const [j] = parse({ data: [rhgestor] });
  assert.strictEqual(j.url, 'https://vagasmartonline.rhgestor.com.br/vagas/detalhes/abc');
  assert.strictEqual(j.workMode, 'remote');
  assert.strictEqual(j.location, 'Campinas, SP');
  assert.strictEqual(j.salaryText, null);
  assert.strictEqual(j.educationText, null);
  assert.strictEqual(j.publishedAt, null);
  assert.strictEqual(j.levelHint, 'estagio');
});

test('faixa salarial e vaga desativada', () => {
  const faixa = { ...vaga, salary: { showRangeToApplicant: true, initialRange: 3000, finalRange: 4500 } };
  assert.strictEqual(parse({ data: [faixa] })[0].salaryText, 'R$ 3.000,00 a R$ 4.500,00');
  assert.strictEqual(parse({ data: [{ ...vaga, isDisabled: true }] }).length, 0);
  assert.deepStrictEqual(parse({ count: 0, data: [], error: 'Failed to fetch vacancies' }), []);
});
