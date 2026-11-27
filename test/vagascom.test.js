const test = require('node:test');
const assert = require('node:assert');
const { parseCards, parseDetail, nextPage } = require('../sources/vagascom');

const card = (id, title, place, level = 'Júnior/Trainee') => `
<li class="vaga odd ">
  <header class="clearfix">
    <div class="informacoes-adicionais-header clearfix">
          <figure class="logoEmpresa haslogo">
            <img alt="Logo da empresa HStern " src="https://site.vagas.com.br/img/logosMkt/lgc1.gif" />
        </figure>
    </div>
    <div class="informacoes-header">
      <h2 class="cargo">
        <a class="link-detalhes-vaga" data-id-vaga="${id}" title="${title}" id="v${id}" onclick="ga('send');" href="/vagas/v${id}/dev">
            <mark>Desenvolvedor</mark> de Software Jr
</a>      </h2>
      <span class="emprVaga">
          HStern
      </span>
      <div class="nivelQtdVagas">
          <span class="nivelVaga">
            ${level}
          </span>
      </div>
    </div>
  </header>
  <div class="detalhes">
    <p>Buscamos <mark>desenvolvedor</mark> para React &amp; Node</p>
  </div>
    <footer>
          <div class="vaga-local">
            <i class="bx bx-map"></i>
            ${place}
              <div class="tooltip-place" role="tooltip"><div id="tooltip-place">A empresa aceita candidaturas de qualquer cidade</div></div>
          </div>
          <span class="data-publicacao"><i class="bx bx-time-five"></i>04/11/2026</span>
    </footer>
</li>`;

test('lê os cards da busca do Vagas.com', () => {
  const html = `<ul>${card(2841827, 'Desenvolvedor de Software Jr', 'Porto Alegre / RS')}${card(2843817, 'Trainee (desenvolvimento)', '100% Home Office', 'Estágio')}</ul>
    <a data-grupo="todasVagas" data-filtro="pagina" data-total="27" data-url="/vagas-de-programador?pagina=2&amp;q=programador" class="btMaisVagas btn" id="maisVagas" href="#">`;
  const jobs = parseCards(html);
  assert.strictEqual(jobs.length, 2);
  const [a, b] = jobs;
  assert.strictEqual(a.sourceId, '2841827');
  assert.strictEqual(a.title, 'Desenvolvedor de Software Jr');
  assert.strictEqual(a.company, 'HStern');
  assert.strictEqual(a.logo, 'https://site.vagas.com.br/img/logosMkt/lgc1.gif');
  assert.strictEqual(a.location, 'Porto Alegre, RS');
  assert.strictEqual(a.workMode, null);
  assert.strictEqual(a.url, 'https://www.vagas.com.br/vagas/v2841827/dev');
  assert.strictEqual(a.publishedAt, '2026-11-04T15:00:00.000Z');
  assert.strictEqual(a.description, 'Buscamos desenvolvedor para React & Node');
  assert.strictEqual(a.levelHint, 'junior');
  assert.strictEqual(b.location, 'Brasil');
  assert.strictEqual(b.workMode, 'remote');
  assert.strictEqual(b.levelHint, 'estagio');
  assert.strictEqual(nextPage(html), '/vagas-de-programador?pagina=2&q=programador');
  assert.strictEqual(parseCards(html, { remote: true })[0].workModeHint, 'remote');
});

test('lê a descrição completa e o salário da página da vaga', () => {
  const html = `
    <span class="info-localizacao" title="100% Home Office">100% Home Office</span>
    <div><span>
            Faixa salarial
          </span>
          <span>
            R$ 3.000,00 a R$ 4.000,00
          </span></div>
    <div class="job-tab-content job-description__text texto" data-testid="JobDescription">
        <br><b>Descrição</b>: <p>Desenvolver APIs</p><p>Requisitos: Node</p>
      </div>`;
  const d = parseDetail(html);
  assert.strictEqual(d.description, 'Descrição : Desenvolver APIs\nRequisitos: Node');
  assert.strictEqual(d.salaryText, 'R$ 3.000,00 a R$ 4.000,00');
  assert.strictEqual(d.workMode, 'remote');
  const semSalario = parseDetail(html.replace('R$ 3.000,00 a R$ 4.000,00', 'a combinar').replace(/100% Home Office/g, 'Rio de Janeiro'));
  assert.strictEqual(semSalario.salaryText, undefined);
  assert.strictEqual(semSalario.workMode, undefined);
  assert.strictEqual(parseDetail('<html>Just a moment...</html>'), null);
});
