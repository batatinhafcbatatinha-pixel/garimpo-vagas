const test = require('node:test');
const assert = require('node:assert');
const { mapListing } = require('../sources/glassdoor');
const { decodeEntities, htmlToText } = require('../lib/http');

test('acentos em entidades HTML viram letras', () => {
  assert.strictEqual(decodeEntities('manuten&ccedil;&atilde;o &Eacute; h&iacute;brido 3&ordm; &amp; &#233;'), 'manutenção É híbrido 3º & é');
  assert.strictEqual(decodeEntities('&naoexiste; &xacute;'), '&naoexiste; x́'.normalize('NFC'));
  assert.strictEqual(htmlToText('<p>Ensino m&eacute;dio</p><p>completo</p>'), 'Ensino médio\ncompleto');
});

test('vaga no formato da API do Glassdoor (páginas seguintes)', () => {
  const l = {
    jobview: {
      header: { ageInDays: 2, employerNameFromSearch: 'Acme', locationName: 'Porto Alegre', seoJobLink: '/job-listing/dev-jr.htm?jl=123', indeedJobAttribute: { extractedJobAttributes: [{ value: 'Híbrido' }] } },
      job: { listingId: 123, jobTitleText: 'Desenvolvedor Júnior', descriptionFragmentsText: ['<b>Node</b>', 'SQL'] },
      overview: { squareLogoUrl: null },
    },
  };
  const j = mapListing(l, {});
  assert.strictEqual(j.sourceId, '123');
  assert.strictEqual(j.title, 'Desenvolvedor Júnior');
  assert.strictEqual(j.url, 'https://www.glassdoor.com.br/job-listing/dev-jr.htm?jl=123');
  assert.strictEqual(j.workMode, 'hybrid');
  assert.strictEqual(j.description, 'Node … SQL');
  assert.strictEqual(mapListing({ jobview: { header: {}, job: {} } }, {}), null);
});
