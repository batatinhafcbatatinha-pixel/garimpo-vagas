const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyLevel, classifyEducation, classifySalary, classifyLocation, isDevJob } = require('../lib/classify');

test('nível pelo título', () => {
  assert.equal(classifyLevel('Desenvolvedor(a) Júnior Fullstack'), 'junior');
  assert.equal(classifyLevel('PESSOA DESENVOLVEDORA JR Golang'), 'junior');
  assert.equal(classifyLevel('Desenvolvedor Jr/ Pleno'), 'junior');
  assert.equal(classifyLevel('Desenvolvedor FullStack - Pleno'), 'pleno');
  assert.equal(classifyLevel('DESENVOLVEDOR FULL STACK SR'), 'senior');
  assert.equal(classifyLevel('Estágio em Desenvolvimento'), 'estagio');
  assert.equal(classifyLevel('Desenvolvedor II'), 'pleno');
  assert.equal(classifyLevel('Desenvolvedor FullStack I | Labs'), 'junior');
  assert.equal(classifyLevel('Desenvolvedor Web'), 'nao-informado');
  assert.equal(classifyLevel('Desenvolvedor Web', 'junior'), 'junior');
});

test('vaga de dev', () => {
  assert.equal(isDevJob('Desenvolvedor Java'), true);
  assert.equal(isDevJob('Assistente de Programação'), true);
  assert.equal(isDevJob('Analista de Programação de Produção'), false);
  assert.equal(isDevJob('Programador Junior'), true);
  assert.equal(isDevJob('Desenvolvedor de Negócios - RS'), false);
  assert.equal(isDevJob('Auxiliar de cozinha'), false);
});

test('escolaridade: exige superior', () => {
  const e = classifyEducation('Requisitos: Ensino superior completo em Ciência da Computação.');
  assert.equal(e.exigeSuperior, true);
  assert.equal(e.resumo, 'superior');
  assert.equal(classifyEducation('Cursando graduação em TI a partir do 3º semestre').exigeSuperior, true);
});

test('escolaridade: médio / técnico', () => {
  assert.equal(classifyEducation('Ensino médio completo. Conhecimento em PHP.').resumo, 'medio');
  assert.equal(classifyEducation('Curso técnico em informática ou superior em andamento').exigeSuperior, false);
  assert.equal(classifyEducation('Curso técnico em informática ou superior em andamento').tecnico, true);
  assert.equal(classifyEducation('', 'Ensino Médio').resumo, 'medio');
  assert.equal(classifyEducation('vaga legal', 'Ensino Superior').exigeSuperior, true);
});

test('escolaridade: superior opcional ou não citado', () => {
  const e = classifyEducation('Experiência com React.\nGraduação em áreas correlatas será um diferencial.');
  assert.equal(e.exigeSuperior, false);
  assert.equal(e.resumo, 'superior-opcional');
  assert.equal(classifyEducation('Experiência com Node e SQL.').resumo, 'nao-menciona');
});

test('salário', () => {
  assert.deepEqual(
    (({ informado, min, max }) => ({ informado, min, max }))(classifySalary('Salário: R$ 3.500,00 CLT')),
    { informado: true, min: 3500, max: 3500 }
  );
  const faixa = classifySalary('Remuneração de R$ 2.800 a R$ 4.200 por mês');
  assert.equal(faixa.min, 2800);
  assert.equal(faixa.max, 4200);
  assert.equal(classifySalary('Vale refeição R$ 1.500,00 e Gympass').informado, false);
  assert.equal(classifySalary('sem valores').informado, false);
  assert.equal(classifySalary('', 'R$ 7.000,00').min, 7000);
  const est = classifySalary('', 'R$ 3 mil – R$ 5 mil', true);
  assert.equal(est.informado, false);
  assert.equal(est.estimativa, true);
  assert.equal(est.max, 5000);
});

test('local', () => {
  assert.equal(classifyLocation('Porto Alegre - RS', 'hybrid').isPoa, true);
  assert.equal(classifyLocation('Porto Alegre do Tocantins, TO').isPoa, false);
  assert.equal(classifyLocation('Canoas, Rio Grande do Sul, Brazil').isMetro, true);
  assert.equal(classifyLocation('Greater Porto Alegre').isMetro, true);
  assert.equal(classifyLocation('São Paulo', 'remote').isRemote, true);
  assert.equal(classifyLocation('Brasil', null, 'Vaga 100% remoto para todo o país').isRemote, true);
  // pista do filtro "remoto" do LinkedIn: o texto manda
  assert.equal(classifyLocation('Fortaleza, CE', null, 'Modelo de trabalho presencial', 'remote').isRemote, false);
  assert.equal(classifyLocation('Recife, PE', null, 'Atuação híbrida', 'remote').workMode, 'hybrid');
  const semTexto = classifyLocation('Fortaleza, CE', null, 'Descrição sem modelo', 'remote');
  assert.equal(semTexto.isRemote, true);
  assert.equal(semTexto.workModeUnconfirmed, true);
  assert.equal(classifyLocation('Brazil', null, 'Descrição sem modelo', 'remote').workModeUnconfirmed, false);
});
