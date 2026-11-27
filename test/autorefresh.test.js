const test = require('node:test');
const assert = require('node:assert/strict');
const { OPTIONS, valid, autoRefreshDelay } = require('../public/autorefresh');

const NOW = '2026-03-01T12:00:00.000Z';
const H = 3600e3;

test('opções: desligado, 1, 3, 6, 12 e 24 horas', () => {
  assert.deepEqual(OPTIONS.map((o) => o.hours), [0, 1, 3, 6, 12, 24]);
  assert.ok(valid('6'));
  assert.ok(!valid(5));
});

test('autoRefreshDelay: desligado ou valor inválido = null', () => {
  assert.equal(autoRefreshDelay(0, NOW, null, NOW), null);
  assert.equal(autoRefreshDelay(5, NOW, null, NOW), null);
  assert.equal(autoRefreshDelay('lixo', NOW, null, NOW), null);
});

test('autoRefreshDelay: conta a partir da última atualização', () => {
  assert.equal(autoRefreshDelay(3, '2026-03-01T11:00:00.000Z', null, NOW), 2 * H);
  assert.equal(autoRefreshDelay(1, '2026-03-01T09:00:00.000Z', null, NOW), 0);
  // nunca atualizou: já está na hora
  assert.equal(autoRefreshDelay(6, null, null, NOW), 0);
});

test('autoRefreshDelay: tentativa recente que falhou adia a próxima', () => {
  assert.equal(autoRefreshDelay(1, '2026-02-01T00:00:00.000Z', '2026-03-01T11:30:00.000Z', NOW), H / 2);
});
