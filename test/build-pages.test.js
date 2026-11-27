const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { staticData, buildSite } = require('../scripts/build-pages');

test('staticData: tira candidaturas e escondidas e marca o modo publicado', () => {
  const d = staticData({ updatedAt: 'x', jobs: [1], concursos: [], sources: [], applied: { a: 1 }, hidden: { b: 1 } });
  assert.deepEqual(d, { updatedAt: 'x', jobs: [1], concursos: [], sources: [], hosted: true });
});

test('buildSite: só public/ + jobs.json + cache.json, nada pessoal', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'garimpo-site-'));
  try {
    const pub = path.join(tmp, 'public');
    fs.mkdirSync(pub);
    fs.writeFileSync(path.join(pub, 'index.html'), 'oi');
    const out = path.join(tmp, 'site');
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, 'velho.txt'), 'some');
    buildSite(out, { publicDir: pub, data: { jobs: [], applied: { x: 1 } }, cache: { gupy: {} } });
    assert.deepEqual(fs.readdirSync(out).sort(), ['cache.json', 'index.html', 'jobs.json']);
    const jobs = JSON.parse(fs.readFileSync(path.join(out, 'jobs.json'), 'utf8'));
    assert.equal(jobs.hosted, true);
    assert.ok(!('applied' in jobs));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('public/ não tem arquivos de dados pessoais', () => {
  const files = fs.readdirSync(path.join(__dirname, '..', 'public'));
  for (const f of ['candidaturas.json', 'escondidas.json', 'linkedin.json', 'jobs.json', 'cache.json']) assert.ok(!files.includes(f), f);
});
