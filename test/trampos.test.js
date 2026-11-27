const test = require('node:test');
const assert = require('node:assert');
const { parseList, parseDetail } = require('../sources/trampos');

const list = {
  opportunities: [
    {
      id: 775099, name: 'Analista de Desenvolvimento - Ruby on Rails e React', type_slug: 'emprego', home_office: true, hybrid: false,
      salary: 'NÃO DIVULGADA', published_at: '2026-11-10T17:13:30.000-03:00', custom_company_name: null,
      company: { name: 'Agência Digi', logo: '//cdn0.trampos.co/companies/logos/1/medium/digi.jpg' },
    },
    {
      id: 775064, name: 'Estágio em Desenvolvimento', type_slug: 'estagio', state: 'RS', city: 'Porto Alegre', hybrid: false,
      salary: 'R$ 1.500 a R$ 2.000', published_at: '2026-11-15T10:40:06.000-03:00', company: { name: 'B&Partners', logo: null },
    },
  ],
  pagination: { total: 2, total_pages: 1, per_page: 12 },
};

test('lista: home office vira remoto em Brasil; sem flag vira pista de presencial', () => {
  const { jobs, totalPages } = parseList(JSON.stringify(list));
  assert.strictEqual(totalPages, 1);
  const [a, b] = jobs;
  assert.strictEqual(a.sourceId, '775099');
  assert.strictEqual(a.location, 'Brasil');
  assert.strictEqual(a.workMode, 'remote');
  assert.strictEqual(a.salaryText, null); // "NÃO DIVULGADA"
  assert.strictEqual(a.logo, 'https://cdn0.trampos.co/companies/logos/1/medium/digi.jpg');
  assert.strictEqual(a.url, 'https://trampos.co/oportunidades/775099');
  assert.strictEqual(a.publishedAt, '2026-11-10T20:13:30.000Z');
  assert.strictEqual(b.location, 'Porto Alegre, RS');
  assert.strictEqual(b.workMode, null);
  assert.strictEqual(b.workModeHint, 'onsite');
  assert.strictEqual(b.salaryText, 'R$ 1.500 a R$ 2.000');
  assert.strictEqual(b.levelHint, 'estagio');
});

test('detalhe junta descrição, requisitos e benefícios', () => {
  const d = parseDetail({ opportunity: { description: 'Atuar com Rails.\r\n', prerequisite: 'React', desirable: '', perks: 'VR', regime: 'CLT', address: 'Home office' } });
  assert.strictEqual(d.description, 'Atuar com Rails.\n\nRequisitos:\nReact\n\nBenefícios:\nVR\n\nRegime: CLT\n\nLocal: Home office');
});
