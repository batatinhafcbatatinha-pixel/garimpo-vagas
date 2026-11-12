// CIEE nacional: vitrine de processos seletivos públicos (estágio em órgãos públicos).
// A lista não diz os cursos; o detalhe de cada edital aberto é buscado uma vez e fica em cache.
const { fetchText, htmlToText, pool, UA } = require('../../lib/http');

const API = 'https://api-pp.ciee.org.br/api/editais';
const MAX_DETAILS = 150;
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

async function vitrine(page) {
  const res = await fetch(`${API}/vitrine?page=${page}&size=100`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: '{}',
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const ufFrom = (d, nome) => {
  const r = d && d.requisitos;
  if (r && r.ufResidencia) return String(r.ufResidencia.sigla || r.ufResidencia).toUpperCase();
  const m = String(nome).match(/[-–/(\s]([A-Z]{2})\)?\s*$/);
  return m && UFS.includes(m[1]) ? m[1] : 'BR';
};

async function detail(id) {
  const d = JSON.parse(await fetchText(`${API}/${id}`, { headers: { accept: 'application/json' } }));
  const insc = (d.cronogramas || []).find((c) => c.tipoFase === 'INSCRICAO') || {};
  const cursos = [...new Set((d.editalCursos || []).map((c) => String(c.curso && c.curso.descricao || '').trim()).filter(Boolean))];
  const niveis = [...new Set((d.editalCursos || []).map((c) => ({ SU: 'superior', TE: 'técnico', EM: 'médio', EF: 'fundamental' }[c.curso && c.curso.nivel] || '')).filter(Boolean))];
  const bolsas = (d.bolsasAuxilio || []).map((b) => b.valor || b.valorBolsa).filter(Boolean);
  return {
    inscricaoDe: insc.dataInicio || null,
    inscricaoAte: insc.dataFim || null,
    cursos,
    niveisExtra: niveis,
    escolaridadeText: niveis.join(' / '),
    salaryText: bolsas.length ? 'R$ ' + Math.max(...bolsas).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : null,
    uf: ufFrom(d, d.orgao && d.orgao.nome),
    description: htmlToText(d.requisitos && d.requisitos.descricaoRequisito).slice(0, 1500),
  };
}

module.exports = {
  id: 'ciee',
  name: 'CIEE nacional',
  kind: 'concursos',
  async fetchJobs(progress, cache) {
    // os abertos vêm primeiro; para quando uma página inteira não tiver nenhum aberto
    const abertos = [];
    for (let page = 0; page < 6; page++) {
      const data = await vitrine(page);
      const hit = (data.content || []).filter((e) => e.ativo && (e.status === 'ABERTO' || e.status === 'EM_BREVE'));
      abertos.push(...hit);
      progress(`${abertos.length} editais abertos`);
      if (!hit.length || data.last) break;
    }
    const missing = abertos.filter((e) => !cache[e.id]).slice(0, MAX_DETAILS);
    let done = 0;
    await pool(missing, 4, async (e) => {
      try {
        cache[e.id] = await detail(e.id);
      } catch {
        /* tenta de novo na próxima atualização */
      }
      progress(`detalhes ${++done}/${missing.length}`);
    });
    return abertos.map((e) => {
      const d = cache[e.id] || {};
      return {
        source: 'ciee',
        sourceId: String(e.id),
        title: e.orgao.nome.trim(),
        cargos: (d.cursos && d.cursos.length ? 'Estágio — ' + d.cursos.slice(0, 12).join(', ') + (d.cursos.length > 12 ? ` e mais ${d.cursos.length - 12}` : '') : 'Estágio') ,
        chamada: e.identificacao,
        uf: d.uf || ufFrom(null, e.orgao.nome),
        tipo: 'estagio',
        situacao: e.status === 'EM_BREVE' ? 'em-breve' : 'aberta',
        url: `https://pp.ciee.org.br/vitrine/${e.id}/detalhe`,
        ...d,
      };
    });
  },
};
