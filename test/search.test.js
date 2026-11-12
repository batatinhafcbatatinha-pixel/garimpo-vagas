const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQuery, matchesQuery } = require('../public/search');
const { classifyLevel } = require('../lib/classify');

const job = (title, company = 'Empresa X') => ({ title, company, level: classifyLevel(title) });
const hit = (q, title) => matchesQuery(job(title), parseQuery(q));

test('busca ignora acentos e maiúsculas', () => {
  assert.equal(hit('desenvolvedor junior', 'Desenvolvedor Júnior'), true);
  assert.equal(hit('desenvolvedor júnior', 'DESENVOLVEDOR JUNIOR'), true);
  assert.equal(hit('estagio', 'Estágio em Desenvolvimento'), true);
  assert.equal(hit('programacao', 'Assistente de Programação'), true);
});

test('junior e jr são a mesma coisa', () => {
  assert.equal(hit('desenvolvedor junior', 'Desenvolvedor Jr'), true);
  assert.equal(hit('desenvolvedor jr', 'Desenvolvedor Júnior Fullstack'), true);
  assert.equal(hit('dev jr.', 'Pessoa Desenvolvedora JR Golang'), true);
});

test('buscar junior nunca traz pleno nem sênior', () => {
  assert.equal(hit('desenvolvedor junior', 'Desenvolvedor Pleno'), false);
  assert.equal(hit('desenvolvedor junior', 'Desenvolvedor Sênior'), false);
  assert.equal(hit('desenvolvedor junior', 'DESENVOLVEDOR FULL STACK SR'), false);
  assert.equal(hit('desenvolvedor junior', 'Desenvolvedor II'), false);
  assert.equal(hit('desenvolvedor junior', 'Tech Lead'), false);
  // sem nível no título não é confirmado como júnior
  assert.equal(hit('desenvolvedor junior', 'Desenvolvedor Web'), false);
  // sênior que só cita júnior no nome da empresa não entra
  assert.equal(matchesQuery(job('Desenvolvedor Sênior', 'Junior Achievement'), parseQuery('junior')), false);
});

test('sinônimos de desenvolvedor', () => {
  assert.equal(hit('desenvolvedor junior', 'Junior Software Developer'), true);
  assert.equal(hit('desenvolvedor junior', 'Programador Junior'), true);
  assert.equal(hit('desenvolvedor', 'Desenvolvedor de Software Pleno'), true); // sem nível na busca, não filtra nível
  assert.equal(hit('desenvolvedor junior', 'Analista Financeiro Júnior'), false);
});

test('outros termos precisam aparecer no título ou empresa', () => {
  assert.equal(hit('java junior', 'Desenvolvedor Java Jr'), true);
  assert.equal(hit('java junior', 'Desenvolvedor PHP Jr'), false);
  assert.equal(hit('c# jr', 'Desenvolvedor C# Júnior'), true);
});
