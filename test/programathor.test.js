const test = require('node:test');
const assert = require('node:assert');
const { parseCards, parseDetail } = require('../sources/programathor');

const card = (href, h3, icons, img = '<img src=https://programathor.com.br/assets/company_avatar-87bc.png alt=X>') => `
  <div class="cell-list ">
    <a href="${href}">
      <div class="cell-logo hidden-xs">${img}</div>
      <div class="cell-list-content"><h3 class="text-24 line-height-30">${h3}</h3><div class='cell-list-content-icon'>${icons}</div></div>
    </a>
  </div>`;
const icon = (name, txt) => `<span><i class='${name}'></i>${txt}</span>`;

const page = `<div class="col-md-9">
  ${card(
    '/jobs/33935-desenvolvedor-a-python-junior',
    '<span class="presential-only-badge">📍 PRESENCIAL - SOMENTE PARA CANDIDATOS NO LOCAL</span> Desenvolvedor(a) Python J&uacute;nior',
    icon('fa fa-briefcase', 'Strategi Capital') + icon('fas fa-map-marker-alt', 'Porto Alegre  (Presencial)') +
      icon('far fa-money-bill-alt', 'Até R$7.000') + icon('far fa-chart-bar', 'Júnior') + icon('far fa-file-alt', 'PJ')
  )}
  <div class="cell-list min-height-180"><a href="/jobs-city/sao-paulo">Vagas Desenvolvedor São Paulo</a></div>
  ${card(
    '/jobs/33950-software-engineer',
    'Software Engineer (USD-based pay)<span class="new-label">NOVA</span>',
    icon('fa fa-briefcase', 'STRIDER') + icon('fas fa-map-marker-alt', 'Remoto') + icon('far fa-chart-bar', 'Pleno') + icon('far fa-file-alt', 'Estágio'),
    '<img alt="STRIDER" src="https://res.cloudinary.com/programathor/logo.png" />'
  )}
  ${card('/jobs/31809-backend-jr', 'Backend Node.js Jr', icon('fa fa-briefcase', 'Omni') + icon('fas fa-map-marker-alt', 'São Paulo, São Paulo, Brasil  (Híbrido)'))}
</div>`;

test('lê os cards da busca (ignora anúncios e selos no título)', () => {
  const jobs = parseCards(page);
  assert.strictEqual(jobs.length, 3);
  const [a, b, c] = jobs;
  assert.strictEqual(a.sourceId, '33935');
  assert.strictEqual(a.title, 'Desenvolvedor(a) Python Júnior');
  assert.strictEqual(a.company, 'Strategi Capital');
  assert.strictEqual(a.logo, null); // avatar padrão
  assert.strictEqual(a.location, 'Porto Alegre');
  assert.strictEqual(a.workMode, 'onsite');
  assert.strictEqual(a.salaryText, 'Até R$7.000');
  assert.strictEqual(a.levelHint, 'junior');
  assert.strictEqual(a.url, 'https://programathor.com.br/jobs/33935-desenvolvedor-a-python-junior');
  assert.strictEqual(b.title, 'Software Engineer (USD-based pay)');
  assert.strictEqual(b.location, 'Brasil');
  assert.strictEqual(b.workMode, 'remote');
  assert.strictEqual(b.levelHint, 'estagio'); // contrato de estágio vale mais que o nível
  assert.strictEqual(b.logo, 'https://res.cloudinary.com/programathor/logo.png');
  assert.strictEqual(c.location, 'São Paulo, São Paulo');
  assert.strictEqual(c.workMode, 'hybrid');
  assert.strictEqual(c.salaryText, null);
});

test('página da vaga: descrição e data do JSON-LD', () => {
  const ld = { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Dev', datePosted: '2026-11-25', description: '<h3>Habilidades</h3><p>React<br />Node</p>' };
  const html = `<script type="application/ld+json">{"@type":"BreadcrumbList"}</script><script type="application/ld+json">${JSON.stringify(ld)}</script>`;
  const d = parseDetail(html);
  assert.strictEqual(d.description, 'Habilidades\nReact\nNode');
  assert.strictEqual(d.publishedAt, '2026-11-25T15:00:00.000Z');
  assert.strictEqual(parseDetail('<html></html>'), null);
});
