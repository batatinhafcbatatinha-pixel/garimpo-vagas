const test = require('node:test');
const assert = require('node:assert/strict');
const { enrichConcurso, isTi, parseBrDate } = require('../lib/concursos');
const pci = require('../sources/concursos/pci');
const poa = require('../sources/concursos/poa');

const dias = (n) => new Date(Date.now() + n * 864e5).toISOString();

test('detecta área de TI', () => {
  assert.equal(isTi('Técnico em Informática'), true);
  assert.equal(isTi('CURSO SUPERIOR DE TEC ANALISE E DESENV DE SISTEMAS'), true);
  assert.equal(isTi('Analista de TI'), true);
  assert.equal(isTi('Monitor, Bibliotecário e Professores'), false);
});

test('situação pelo prazo de inscrição', () => {
  assert.equal(enrichConcurso({ title: 'X', inscricaoAte: dias(-3) }).situacao, 'encerrada');
  assert.equal(enrichConcurso({ title: 'X', inscricaoAte: dias(5) }).situacao, 'aberta');
  assert.equal(enrichConcurso({ title: 'X', inscricaoDe: dias(2), inscricaoAte: dias(9) }).situacao, 'em-breve');
  assert.equal(enrichConcurso({ title: 'X', situacao: 'em-andamento' }).situacao, 'em-andamento');
});

test('escolaridade: geral e pelos cursos de TI', () => {
  assert.equal(enrichConcurso({ title: 'Prefeitura', escolaridadeText: 'Médio / Técnico / Superior' }).semSuperior, true);
  assert.equal(enrichConcurso({ title: 'Tribunal', escolaridadeText: 'Superior' }).semSuperior, false);
  const estagio = enrichConcurso({ title: 'Câmara', cursos: ['PEDAGOGIA', 'TECNICO EM INFORMATICA', 'CIENCIA DA COMPUTACAO'] });
  assert.equal(estagio.ti, true);
  assert.equal(estagio.semSuperior, true);
  assert.deepEqual(estagio.cursosTi, ['TECNICO EM INFORMATICA', 'CIENCIA DA COMPUTACAO']);
  const soSuperior = enrichConcurso({ title: 'Órgão', cursos: ['ENSINO MEDIO', 'SISTEMAS DE INFORMACAO'] });
  assert.equal(soSuperior.semSuperior, false); // o único curso de TI é graduação
});

test('região', () => {
  assert.equal(enrichConcurso({ title: 'CAMARA MUNICIPAL DE PORTO ALEGRE', uf: 'RS' }).isPoa, true);
  assert.equal(enrichConcurso({ title: 'Prefeitura de Montenegro', uf: 'RS' }).isPoa, false);
  assert.equal(enrichConcurso({ title: 'Prefeitura de Montenegro', uf: 'RS' }).isRs, true);
});

test('datas brasileiras', () => {
  assert.equal(parseBrDate('05/11/2026'), '2026-11-05T12:00:00.000Z');
  assert.equal(parseBrDate('sem data'), null);
});

test('parser do PCI Concursos', () => {
  const html = `<div id="concursos"><div class="na" data-url="x"> <div class="ca"><a href="https://www.pciconcursos.com.br/noticias/prefeitura-de-teste-rs" title="Prefeitura de Teste - RS abre concurso" rel="bookmark">Prefeitura de Teste</a> <div class="cb"><img src="data:x" data-src="https://cdn.pci.app.br/img/c/a.png" class="lazyload"></div> <div class="cc">RS</div> <div class="cd">12 vagas até R$ 8.798,10<br><span>Vários Cargos<br><span>Médio / Técnico / Superior</span></span> </div><div class="ce"><span>30/11/2026 a<br>04/01/2027</span></div> </div></div>`;
  const [c] = pci.parseList(html);
  assert.equal(c.title, 'Prefeitura de Teste');
  assert.equal(c.uf, 'RS');
  assert.equal(c.vagasText, '12 vagas');
  assert.equal(c.salaryText, 'R$ 8.798,10');
  assert.equal(c.escolaridadeText, 'Médio / Técnico / Superior');
  assert.equal(c.inscricaoDe, '2026-11-30T12:00:00.000Z');
  assert.equal(c.inscricaoAte, '2027-01-04T12:00:00.000Z');
});

test('parser da Prefeitura de Porto Alegre', () => {
  const html = `<dl class="ckeditor-accordion"><dt><strong>CP 900 - TÉCNICO EM INFORMÁTICA</strong></dt><dd><p>09/10/2026 - <a href="/sites/x/EDITAL.pdf"><strong>EDITAL DE ABERTURA N° 112/2026</strong></a> - Torna público, que no período de 13/10/2026 à 05/11/2026, estarão abertas as inscrições.</p></dd></dl>`;
  const [c] = poa.parsePage(html, { url: 'https://prefeitura.poa.br/smap/concursos-em-andamento', tipo: 'concurso' });
  assert.equal(c.cargos, 'CP 900 - TÉCNICO EM INFORMÁTICA');
  assert.equal(c.inscricaoAte, '2026-11-05T12:00:00.000Z');
  assert.equal(c.editalUrl, 'https://prefeitura.poa.br/sites/x/EDITAL.pdf');
  assert.equal(enrichConcurso(c).ti, true);
});
