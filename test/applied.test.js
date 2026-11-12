const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('../lib/applied');

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'garimpo-')), 'candidaturas.json');
const data = { jobs: [{ id: 'gupy:1', title: 'Dev Jr' }], concursos: [{ id: 'pci:x', title: 'Prefeitura' }] };

test('marca vaga e concurso guardando uma cópia', () => {
  const s = createStore(tmp());
  assert.deepStrictEqual(s.load(), {});
  s.set('gupy:1', true, data);
  const map = s.set('pci:x', true, data);
  assert.strictEqual(map['gupy:1'].kind, 'vaga');
  assert.strictEqual(map['gupy:1'].item.title, 'Dev Jr');
  assert.strictEqual(map['pci:x'].kind, 'concurso');
  assert.deepStrictEqual(Object.keys(s.load()).sort(), ['gupy:1', 'pci:x']);
});

test('candidatura continua depois que a vaga sai do índice, e marcar de novo não muda a data', () => {
  const s = createStore(tmp());
  const at = s.set('gupy:1', true, data)['gupy:1'].at;
  const map = s.set('gupy:1', true, { jobs: [], concursos: [] });
  assert.strictEqual(map['gupy:1'].at, at);
  assert.strictEqual(map['gupy:1'].item.title, 'Dev Jr');
});

test('desmarcar remove; id desconhecido é recusado', () => {
  const s = createStore(tmp());
  s.set('gupy:1', true, data);
  assert.deepStrictEqual(s.set('gupy:1', false, data), {});
  assert.strictEqual(s.set('nao-existe', true, data), null);
  assert.strictEqual(s.set('__proto__', true, data), null);
  assert.deepStrictEqual(s.load(), {});
});
