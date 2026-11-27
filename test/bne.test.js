const test = require('node:test');
const assert = require('node:assert');
const { parseCards, parseDetail } = require('../sources/bne');

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="17"><path d="M1 2" fill="#AE63FF" /></svg>';
const card = (id, { company = 'Rede Cal&#xE1;bria', mode = 'Presencial', place = 'Porto Alegre / RS', desc } = {}) => `
<section class="job__card__container job-container" id="job-${id}">
    <div class="card--list--vagas" id="job-miniature-${id}" data-job-id="${id}" data-previousJob="" data-nextJob="">
        <div class="job__card__header" data-job-list="true" data-job-id-candidate="${id}">
            <h2><strong>
                <a class="card__link" href="https://www.bne.com.br/vaga-de-emprego-na-area-informatica-em-porto-alegre-rs/desenvolvedor/${id}" title="Desenvolvedor Java em Porto Alegre/RS">Vaga De Desenvolvedor Java</a>
            </strong></h2>
            <div class="tags__header w-100"></div>
        </div>
        <div class="info__vaga">
            <div class="info__vaga-item">
                ${svg} desenvolvedor java
            </div>
            ${company ? `<div class="info__vaga-item">
                    ${svg} ${company}
                </div>` : ''}
            <div class="info__vaga-item">
                ${svg} ${mode}
            </div>
            <div class="info__vaga-item">
                ${svg}  ${place}
            </div>
                <div class="job__description">
                    <p class="job__description-text" id="job-description-${id}">${desc}<span class="job__description-ellipsis">...</span></p>
                </div>
        </div>
    </div>
</section>`;

test('lê os cards da busca do BNE', () => {
  const html =
    card(6239810, { desc: 'Vaga para desenvolvedor backend java pleno.&#xA;Requisitos: Spring' }) +
    card(6267482, { company: '', mode: 'Home Office', place: 'S&#xE3;o Paulo / SP', desc: 'Atribui&#xE7;&#xF5;es: APIs' });
  const jobs = parseCards(html);
  assert.strictEqual(jobs.length, 2);
  const [a, b] = jobs;
  assert.strictEqual(a.sourceId, '6239810');
  assert.strictEqual(a.title, 'Desenvolvedor Java');
  assert.strictEqual(a.company, 'Rede Calábria');
  assert.strictEqual(a.location, 'Porto Alegre, RS');
  assert.strictEqual(a.workModeHint, 'onsite');
  assert.strictEqual(a.url, 'https://www.bne.com.br/vaga-de-emprego-na-area-informatica-em-porto-alegre-rs/desenvolvedor/6239810');
  assert.strictEqual(a.description, 'Vaga para desenvolvedor backend java pleno.\nRequisitos: Spring');
  assert.strictEqual(a.levelHint, 'pleno');
  assert.strictEqual(b.company, 'Empresa confidencial');
  assert.strictEqual(b.workModeHint, 'remote');
  assert.strictEqual(b.location, 'São Paulo, SP');
  assert.strictEqual(b.levelHint, null);
});

test('lê o JSON-LD da página da vaga', () => {
  const posting = {
    '@context': 'http://schema.org',
    '@type': 'JobPosting',
    employmentType: 'INTERN',
    title: 'desenvolvedor',
    description: '<p> Atribuições:\nDesenvolver sistemas em C# e PHP.</p>',
    datePosted: '2026-10-22',
    hiringOrganization: { '@type': 'Organization', name: 'Confidencial' },
    baseSalary: { '@type': 'MonetaryAmount', currency: 'BRL', value: { '@type': 'QuantitativeValue', value: 1045, unitText: 'MONTH' } },
  };
  const html = `<script type="application/ld+json">{"@type":"Organization","name":"BNE"}</script>
    <script type="application/ld+json">${JSON.stringify(posting)}</script>`;
  const d = parseDetail(html);
  assert.strictEqual(d.description, 'Atribuições:\nDesenvolver sistemas em C# e PHP.');
  assert.strictEqual(d.publishedAt, '2026-10-22T15:00:00.000Z');
  assert.strictEqual(d.salaryText, 'R$ 1.045');
  assert.strictEqual(d.levelHint, 'estagio');
  assert.strictEqual(d.company, undefined); // "Confidencial" não sobrescreve
  const clt = parseDetail(html.replace('"INTERN"', '"FULL_TIME"').replace('"Confidencial"', '"Acme"').replace(/"baseSalary".*?"MONTH"\}\}/, '"x":1'));
  assert.strictEqual(clt.levelHint, undefined);
  assert.strictEqual(clt.company, 'Acme');
  assert.strictEqual(clt.salaryText, null);
  assert.strictEqual(parseDetail('<html></html>'), null);
});
