// CIEE-RS: processos seletivos públicos (estágio, aprendizagem e residência em órgãos públicos do RS).
const { fetchText, pool } = require('../../lib/http');

const API = 'https://cieers.org.br/portal/api/conjuntos/processo-seletivo';

const LINK = {
  APRENDIZAGEM: (id) => `https://www.cieers.org.br/estudante/processosSeletivosAprendiz?id=${id}`,
  ESTAGIO: (id) => `https://cieers.org.br/estudante/processosSeletivos?id=${id}`,
  RESIDENCIA: (id) => `https://cieers.org.br/estudante/processosSeletivos?id=${id}`,
};
const TIPO = { APRENDIZAGEM: 'aprendiz', ESTAGIO: 'estagio', RESIDENCIA: 'residencia' };

module.exports = {
  id: 'cieers',
  name: 'CIEE-RS',
  kind: 'concursos',
  async fetchJobs(progress) {
    const data = JSON.parse(await fetchText(API, { headers: { accept: 'application/json' } }));
    const list = [...(data.public || []), ...(data.private || [])];
    let done = 0;
    const details = await pool(list, 4, async (p) => {
      let d = {};
      try {
        d = JSON.parse(await fetchText(`${API}/${p.programType}/${p.id}`, { headers: { accept: 'application/json' } }));
      } catch {
        /* segue sem os cursos */
      }
      progress(`${++done}/${list.length} processos`);
      return d;
    });
    return list.map((p, i) => ({
      cursos: details[i].courses || [],
      city: (details[i].cities || []).map((c) => c.name || c).join(', ') || undefined,
      prova: details[i].exam || null,
      source: 'cieers',
      sourceId: `${p.programType}-${p.id}`,
      title: p.title,
      cargos: { APRENDIZAGEM: 'Programa de aprendizagem', ESTAGIO: 'Estágio — vários cursos (ver edital)', RESIDENCIA: 'Residência' }[p.programType] || '',
      uf: 'RS',
      tipo: TIPO[p.programType] || 'estagio',
      inscricaoDe: p.subscription && p.subscription.from,
      inscricaoAte: p.subscription && p.subscription.to,
      situacao: p.status === 'INSCRICOES_ABERTAS' ? 'aberta' : p.status === 'INSCRICOES_ENCERRADAS' ? 'encerrada' : 'desconhecida',
      description: String(p.notice || '').trim(),
      url: (LINK[p.programType] || LINK.ESTAGIO)(p.id),
    }));
  },
};
