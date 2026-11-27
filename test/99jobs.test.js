const test = require('node:test');
const assert = require('node:assert');
const { parseCards, parseDetail } = require('../sources/99jobs');

const card = (id, title, level, mode, place) => `
  <input type="hidden" name="count_opportunities" value="2">
  <a class="opportunity-card" href="https://99jobs.com/acme/jobs/${id}-vaga?utm_source=tagportal&amp;utm_medium=ses_oportunis">
    <div class="opportunity-card-content">
      <h1>${title}</h1>
      <div class="opportunity-labels">
        <span class="opportunity-label opportunity-label-level"> ${level} </span>
          <span class="opportunity-label opportunity-label-acting-mode">${mode}</span>
      </div>
      <div class="opportunity-address">
        <img alt="" height="14" src="https://cdn/icon-address.svg" />
        <p>
            ${place}
        </p>
      </div>
      <div class="opportunity-card-footer">
        <div class="opportunity-company">
          <div class="opportunity-company-logo">
            <img src="https://cdn/logo.png" />
          </div>
          <div class="opportunity-company-infos">
            <h2>
              Acme &amp; Cia
            </h2>
          </div>
        </div>
      </div>
    </div>
</a>`;

test('lê os cards da busca', () => {
  const html =
    card(36494, ' Desenvolvedor (Java)', 'Júnior', 'Presencial', 'Porto Alegre,\n            RS') +
    card(520444, 'Estágio em Desenvolvimento Fro...', 'Estágio', 'Remoto', 'Não informado');
  const [a, b, ...rest] = parseCards(html);
  assert.strictEqual(rest.length, 0);
  assert.strictEqual(a.sourceId, '36494');
  assert.strictEqual(a.title, 'Desenvolvedor (Java)');
  assert.strictEqual(a.company, 'Acme & Cia');
  assert.strictEqual(a.logo, 'https://cdn/logo.png');
  assert.strictEqual(a.location, 'Porto Alegre, RS');
  assert.strictEqual(a.workMode, 'onsite');
  assert.strictEqual(a.levelHint, 'junior');
  assert.strictEqual(a.url, 'https://99jobs.com/acme/jobs/36494-vaga');
  assert.strictEqual(b.location, 'Brasil');
  assert.strictEqual(b.workMode, 'remote');
  assert.strictEqual(b.levelHint, 'estagio');
});

test('detalhe traz o título completo e corta o "Sobre a Organização"', () => {
  const html = `<div class="panel-default companies opportunities-details">
    <h2 style="font-size: 28px;"><strong>Estágio em Desenvolvimento Front-end </strong></h2>
    <p>Estágio, Remoto</p>
    <div class="row"><div class="headline">Requisitos</div><div><p><ul><li>React</li></ul></p></div></div>
    <div class="row"><div class="headline">Sobre a Organização</div><div>Somos a Acme.</div></div>`;
  const d = parseDetail(html);
  assert.strictEqual(d.title, 'Estágio em Desenvolvimento Front-end');
  assert.match(d.description, /Requisitos\nReact/);
  assert.doesNotMatch(d.description, /Somos a Acme/);
  assert.strictEqual(parseDetail('<html>login</html>'), null);
});
