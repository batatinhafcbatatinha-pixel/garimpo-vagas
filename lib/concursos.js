// Classificação dos concursos / processos seletivos públicos: área de TI, escolaridade, salário e prazo.
const { norm, classifySalary } = require('./classify');

const TI_RE =
  /informatica|programad|desenvolvedor|analista de sistemas|tecnologia da informacao|\bti\b|\bt\.i\.|\btic\b|sistemas de informacao|sistemas para internet|ciencias? da computacao|engenharia d[ae] (computacao|software)|software|computacao|redes de computadores|suporte (tecnico|em ti|de ti)|analise e desen|desen\w* de sistemas|web ?design|banco de dados|ciencia de dados|processamento de dados|seguranca da informacao|jogos digitais|geoprocessamento/;

const isTi = (text) => TI_RE.test(norm(text));

function classifyNiveis(text) {
  const t = norm(text);
  return {
    fundamental: /fundamental|alfabetizado/.test(t),
    medio: /\bmedio\b|ensino medio|nivel medio/.test(t),
    tecnico: /\btecnico\b|nivel tecnico|curso tecnico/.test(t),
    superior: /superior|graduacao|bacharel|licenciatura|tecnologo|pos-?graduacao|mestrado|doutorado/.test(t),
  };
}

// "dd/mm/aaaa" -> ISO (meio-dia UTC para não escorregar de dia com fuso)
function parseBrDate(s) {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12)).toISOString() : null;
}

function enrichConcurso(c) {
  const text = [c.title, c.cargos, c.escolaridadeText, c.description, (c.cursos || []).join(', ')].filter(Boolean).join('\n');
  const cursosTi = c.cursos ? c.cursos.filter(isTi) : c.cursosTi || [];
  // com lista de cursos, a escolaridade que importa é a dos cursos de TI (se houver)
  const base = cursosTi.length ? cursosTi.join(' ; ') : [c.escolaridadeText, c.cargos, (c.niveisExtra || []).join(' '), (c.cursos || []).join(' ; ')].filter(Boolean).join(' ');
  const niveis = classifyNiveis(base);
  if (cursosTi.length && !niveis.tecnico && !niveis.medio) niveis.superior = true; // curso de TI sem "técnico" no nome é graduação
  const salary = classifySalary('', c.salaryText || '');
  const fim = c.inscricaoAte ? new Date(c.inscricaoAte) : null;
  let situacao = c.situacao || 'desconhecida';
  if (fim) {
    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    situacao = fim < hoje ? 'encerrada' : c.inscricaoDe && new Date(c.inscricaoDe) > new Date() ? 'em-breve' : 'aberta';
  }
  return {
    ...c,
    ti: c.ti === true || isTi(text),
    cursosTi: cursosTi.slice(0, 12),
    cursos: undefined, // a lista completa pode ter centenas de cursos; guardamos só os de TI
    niveis,
    semSuperior: niveis.medio || niveis.tecnico || niveis.fundamental,
    salary,
    situacao,
    isRs: c.uf === 'RS',
    isPoa: /porto alegre/.test(norm(c.title + ' ' + (c.city || ''))),
  };
}

module.exports = { enrichConcurso, isTi, classifyNiveis, parseBrDate };
