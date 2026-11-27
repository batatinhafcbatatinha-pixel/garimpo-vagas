const test = require('node:test');
const assert = require('node:assert');
const { build, SOURCES } = require('../lib/refresh');

const job = (source, sourceId, title, company) => ({ source, sourceId, title, company, location: 'Porto Alegre, RS', description: '', url: 'https://x' });
const NOW = '2026-01-02T00:00:00.000Z';

test('build: índice parcial junta as fontes que já chegaram e deduplica', () => {
  const lists = SOURCES.map(() => []);
  const at = (id) => SOURCES.findIndex((s) => s.id === id);

  // só o LinkedIn terminou
  lists[at('linkedin')] = [job('linkedin', '1', 'Dev Júnior', 'Acme')];
  assert.deepStrictEqual(build(lists, new Map(), NOW).jobs.map((j) => j.id), ['linkedin:1']);

  // a Gupy chega depois: a mesma vaga vira uma só e as datas antigas são preservadas
  lists[at('gupy')] = [job('gupy', '9', 'Dev Junior', 'ACME'), job('gupy', '10', 'QA', 'Acme')];
  const r = build(lists, new Map([['gupy:10', '2025-01-01T00:00:00.000Z']]), NOW);
  assert.deepStrictEqual(r.jobs.map((j) => j.id), ['gupy:9', 'gupy:10']);
  assert.deepStrictEqual(r.jobs[0].alsoOn, ['linkedin']);
  assert.strictEqual(r.jobs[0].firstSeen, NOW);
  assert.strictEqual(r.jobs[1].firstSeen, '2025-01-01T00:00:00.000Z');
  assert.deepStrictEqual(r.concursos, []);
});

test('build: vagas de empresa confidencial com o mesmo título não viram uma só', () => {
  const lists = SOURCES.map(() => []);
  const at = (id) => SOURCES.findIndex((s) => s.id === id);
  lists[at('bne')] = [job('bne', '1', 'Desenvolvedor', 'Empresa confidencial'), job('bne', '2', 'Desenvolvedor', 'Empresa confidencial'), job('bne', '3', 'Desenvolvedor', '')];
  lists[at('catho')] = [job('catho', '7', 'Desenvolvedor', 'Confidencial')];
  assert.deepStrictEqual(build(lists, new Map(), NOW).jobs.map((j) => j.id).sort(), ['bne:1', 'bne:2', 'bne:3', 'catho:7']);
});
