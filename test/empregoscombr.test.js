const test = require('node:test');
const assert = require('node:assert');
const { parseResponse, mapJob } = require('../sources/empregoscombr');

const job = (over = {}) => ({
  salary: { min: 1750, max: 3000, format: 'R$ 1,750.00 - R$ 3,000.00' },
  referenceId: 12045066,
  source: 'empregoscombr',
  title: 'Desenvolvedor Júnior ',
  role: { name: 'Desenvolvedor', hierarchicalLevel: 'Analista / Especialista' },
  description: '<p>Desenvolver APIs REST.</p><p>Node &amp; React</p>',
  workplaceTypes: 'Híbrido',
  location: [{ city: 'Porto Alegre', state: 'RS', stateAbbreviation: 'RS', country: 'br' }],
  company: { id: 43004, name: 'Tmsa' },
  requiredQualification: ' ',
  academicFormation: null,
  createdAt: '2026-11-20T12:00:19.890',
  ...over,
});

test('lê a resposta da API de busca', () => {
  const { total, jobs } = parseResponse({ total: 94, jobPostingCollection: [job(), { referenceId: 0 }] });
  assert.strictEqual(total, 94);
  assert.strictEqual(jobs.length, 1);
  const j = jobs[0];
  assert.strictEqual(j.sourceId, '12045066');
  assert.strictEqual(j.title, 'Desenvolvedor Júnior');
  assert.strictEqual(j.company, 'Tmsa');
  assert.strictEqual(j.location, 'Porto Alegre, RS');
  assert.strictEqual(j.workMode, 'hybrid');
  assert.strictEqual(j.url, 'https://www.empregos.com.br/vaga/12045066');
  assert.strictEqual(j.publishedAt, '2026-11-20T15:00:19.000Z');
  assert.strictEqual(j.salaryText, 'R$ 1.750 a R$ 3.000');
  assert.strictEqual(j.description, 'Desenvolver APIs REST.\nNode & React');
  assert.strictEqual(j.levelHint, null);
});

test('salário zerado, remoto, estagiário e várias cidades', () => {
  const j = mapJob(
    job({
      salary: { min: 0, max: 0, format: 'R$ 0.00 - R$ 0.00' },
      workplaceTypes: 'Remoto',
      role: { hierarchicalLevel: 'Estagiários' },
      location: [{ city: 'Brasilia', stateAbbreviation: 'DF' }, { city: 'Recife', stateAbbreviation: 'PE' }],
    })
  );
  assert.strictEqual(j.salaryText, null);
  assert.strictEqual(j.workMode, 'remote');
  assert.strictEqual(j.levelHint, 'estagio');
  assert.strictEqual(j.location, 'Várias cidades');
  assert.strictEqual(mapJob(job({ salary: { min: 1100, max: 0 } })).salaryText, 'R$ 1.100');
});

test('resposta sem a lista de vagas é erro', () => {
  assert.throws(() => parseResponse({ type: 'erro', status: 400 }), /sem vagas/);
});
