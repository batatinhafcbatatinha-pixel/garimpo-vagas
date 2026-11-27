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

test('modelo de trabalho: texto desmente o filtro remoto', () => {
  const { classifyLocation } = require('../lib/classify');
  // Glassdoor: busca "remoto", mas "Informações da vaga" no fim diz híbrido
  const longo = 'Sobre a empresa. '.repeat(150) + 'Informações da vaga:\nModelo híbrido – 2 dias presenciais e 3 dias em home office';
  const g = classifyLocation('São Paulo, SP', null, longo, 'remote', true);
  assert.equal(g.workMode, 'hybrid');
  assert.equal(g.isRemote, false);
  assert.equal(classifyLocation('Recife', null, 'Trabalho 3x por semana no escritório', 'remote', true).workMode, 'hybrid');
  // pista confiável sem nada no texto: remoto sem "?"
  const c = classifyLocation('São Paulo, SP', null, 'Sem modelo', 'remote', true);
  assert.equal(c.isRemote, true);
  assert.equal(c.workModeUnconfirmed, false);
  // app híbrido não é trabalho híbrido
  assert.equal(classifyLocation('Brasil', null, 'Desenvolvimento de apps mobile ' + 'x '.repeat(900) + 'com Flutter híbrido app', 'remote').workMode, 'remote');
});

test('idioma e PCD', () => {
  const { isEnglishText, isPcdOnly } = require('../lib/classify');
  assert.equal(isEnglishText('Jr. Developer, AI & Automation', 'We are looking for a developer to join our team. You will work with the product team and you will be responsible for the automation of our processes and the development of tools.'), true);
  assert.equal(isEnglishText('Desenvolvedor Júnior', 'Estamos buscando uma pessoa desenvolvedora para fazer parte do nosso time. Você vai trabalhar com a equipe de produto e com experiência em Java e em React para os nossos clientes.'), false);
  assert.equal(isEnglishText('Junior Developer', ''), true);
  assert.equal(isEnglishText('Desenvolvedor Junior', ''), false);
  assert.equal(isPcdOnly('Desenvolvedor Júnior - Vaga Afirmativa PCD', ''), true);
  assert.equal(isPcdOnly('Desenvolvedor', 'Esta vaga é exclusiva para pessoas com deficiência.'), true);
  assert.equal(isPcdOnly('Desenvolvedor', 'Vaga afirmativa para PCD.'), true);
  assert.equal(isPcdOnly('Desenvolvedor', 'Todas as nossas vagas também são abertas para pessoas com deficiência.'), false);
});

test('superior exigido em outra frase vence o "escolaridade mínima: ensino médio"', () => {
  // quem cursa superior já tem o médio: o campo do formulário não é alternativa
  const e = classifyEducation('Requisitos:Superior cursando e/ou completo em análise de sistemas - conhecimento em TASY e SQL\nHorário: 08:00 - 17:48\nEscolaridade Mínima: Ensino Médio (2º Grau)\nvale alimentação\nEnsino Médio');
  assert.equal(e.resumo, 'superior');
  assert.match(e.trecho, /Superior cursando/);
  // alternativa de verdade vem na mesma frase
  assert.equal(classifyEducation('Ensino médio completo ou superior em andamento').exigeSuperior, false);
  // benefício não é exigência
  assert.equal(classifyEducation('Ensino médio completo.\nBenefícios: auxílio faculdade e Gympass').resumo, 'medio');
});

test('"possibilidade de home office" é híbrido, não remoto confirmado', () => {
  const d = 'Empresa de tecnologia. '.repeat(100) + 'Temos horário flexível e possibilidade de atuação home office. Equipes pequenas.';
  const l = classifyLocation('São Paulo, SP', null, d, 'remote');
  assert.equal(l.workMode, 'hybrid');
  assert.equal(l.isRemote, false);
});

test('benefício com "por mês" não vira salário', () => {
  assert.equal(classifySalary('Benefícios:\nFlexfood (R$910 por mês para utilização em mercados e restaurantes);\nSeguro de vida').informado, false);
  assert.equal(classifySalary('Vale alimentação de R$ 800 por mês').informado, false);
  assert.equal(classifySalary('Bolsa auxílio: R$ 1.200 por mês').min, 1200);
});

test('vagas exclusivas para mulheres', () => {
  const { isWomenOnly } = require('../lib/classify');
  // título
  assert.equal(isWomenOnly('Analista de Desenvolvimento de Software Júnior - Vaga Afirmativa para Mulheres', ''), true);
  assert.equal(isWomenOnly('Software Development Engineer Internship - Vaga para mulheres', ''), true);
  assert.equal(isWomenOnly('Banco de talentos | Mulheres', ''), true);
  assert.equal(isWomenOnly('Estágio em Engenharia de Dados - Para mulheres cis e trans', ''), true);
  assert.equal(isWomenOnly('Desenvolvedora Front-end - Exclusiva Feminina', ''), true);
  // descrição
  assert.equal(isWomenOnly('Estágio | Engenharias', 'Atuação na Vale. *Vaga exclusiva para mulheres'), true);
  assert.equal(isWomenOnly('Desenvolvedor Jr', 'Esta é uma posição afirmativa para mulheres, como parte do nosso compromisso.'), true);
  assert.equal(isWomenOnly('Desenvolvedor Jr', 'Vaga destinada a pessoas do gênero feminino.'), true);
  assert.equal(isWomenOnly('Developer', 'This position is open to women only.'), true);
  // só cita mulheres, sem restringir
  assert.equal(isWomenOnly('Desenvolvedor Back-end Jr', 'Incentivamos candidaturas de pessoas #pretas, #mulheres, #pcd, #lgbtqiapn+ e #50+.'), false);
  assert.equal(isWomenOnly('Desenvolvedor Cobol', 'Somos a 2ª melhor empresa para mulheres e para pessoas pretas.'), false);
  assert.equal(isWomenOnly('Estágio Front-end', 'Nossa missão é impactar pessoas, em especial mulheres, e inspirá-las.'), false);
  assert.equal(isWomenOnly('Desenvolvedor', 'Temos o grupo Women in Experian e aderimos ao movimento Elas Lideram 2030 com a ONU Mulheres.'), false);
  assert.equal(isWomenOnly('Desenvolvedor', 'Nossas vagas são abertas a todas as pessoas, inclusive mulheres.'), false);
});
