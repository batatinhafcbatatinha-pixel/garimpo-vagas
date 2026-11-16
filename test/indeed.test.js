const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../sources/indeed');

const card = {
  jobkey: 'abc123',
  title: 'Desenvolvedor J&uacute;nior',
  company: 'Acme',
  formattedLocation: 'Porto Alegre, RS',
  pubDate: 1763100000000,
  salarySnippet: { text: 'R$ 3.000 por mês' },
  snippet: '<ul><li>Node.js {e} "React"</li></ul>',
};
const page = (data) =>
  `<html><script>
    window.mosaic.providerData["mosaic-provider-jobcards"]=${JSON.stringify(data)};
    window.mosaic.publicPaths["outro"]="https://exemplo/";
  </script></html>`;

test('lê as vagas mesmo com outros comandos depois do JSON no mesmo script', () => {
  const jobs = parse(page({ metaData: { mosaicProviderJobCardsModel: { results: [card] } } }), { l: 'Porto Alegre, RS' });
  assert.strictEqual(jobs.length, 1);
  assert.strictEqual(jobs[0].sourceId, 'abc123');
  assert.strictEqual(jobs[0].title, 'Desenvolvedor Júnior');
  assert.strictEqual(jobs[0].url, 'https://br.indeed.com/viewjob?jk=abc123');
  assert.strictEqual(jobs[0].salaryText, 'R$ 3.000 por mês');
  assert.match(jobs[0].description, /Node\.js \{e\} "React"/);
  assert.strictEqual(jobs[0].workMode, null);
});

test('busca remota marca a vaga como remota', () => {
  const jobs = parse(page({ metaData: { mosaicProviderJobCardsModel: { results: [card] } } }), { l: 'Brasil', remote: true });
  assert.strictEqual(jobs[0].workMode, 'remote');
});

test('página de bloqueio devolve null', () => {
  assert.strictEqual(parse('<html><title>Blocked - Indeed.com</title></html>', { l: 'Brasil' }), null);
});
