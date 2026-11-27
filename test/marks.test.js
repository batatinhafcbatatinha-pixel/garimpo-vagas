const test = require('node:test');
const assert = require('node:assert/strict');
const { toggleMark, parseMarks } = require('../public/marks');

const DATA = {
  jobs: [{ id: 'gupy:1', title: 'Dev Jr', _text: 'dev jr', _loc: ['poa'] }],
  concursos: [{ id: 'pci:9', title: 'Técnico' }],
};
const AT = '2026-03-01T10:00:00.000Z';

test('toggleMark: marca vaga e concurso guardando a cópia sem os campos calculados do site', () => {
  let m = toggleMark({}, 'gupy:1', true, DATA, AT);
  assert.deepEqual(m, { 'gupy:1': { at: AT, kind: 'vaga', item: { id: 'gupy:1', title: 'Dev Jr' } } });
  m = toggleMark(m, 'pci:9', true, DATA, AT);
  assert.equal(m['pci:9'].kind, 'concurso');
});

test('toggleMark: marcar de novo mantém a data original; desmarcar remove; não altera o mapa recebido', () => {
  const m = toggleMark({}, 'gupy:1', true, DATA, AT);
  assert.equal(toggleMark(m, 'gupy:1', true, DATA, '2027-01-01T00:00:00.000Z')['gupy:1'].at, AT);
  const off = toggleMark(m, 'gupy:1', false, DATA);
  assert.deepEqual(off, {});
  assert.ok(m['gupy:1']);
  // desmarcar vaga que já saiu do índice também funciona
  assert.deepEqual(toggleMark(m, 'gupy:1', false, { jobs: [] }), {});
});

test('toggleMark: id que não está no índice devolve null', () => {
  assert.equal(toggleMark({}, 'x:1', true, DATA), null);
});

test('parseMarks: aceita só objeto', () => {
  assert.deepEqual(parseMarks('{"a":{"at":"x"}}'), { a: { at: 'x' } });
  for (const bad of [null, '', 'lixo', '[1]', 'null']) assert.deepEqual(parseMarks(bad), {});
});
