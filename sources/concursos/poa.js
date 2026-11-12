// Prefeitura de Porto Alegre (SMAP): concursos e processos seletivos em andamento.
// Cada certame é um item de sanfona (<dt> título, <dd> editais em ordem do mais novo ao mais antigo).
const { fetchText, htmlToText, decodeEntities } = require('../../lib/http');
const { parseBrDate } = require('../../lib/concursos');

const PAGES = [
  { url: 'https://prefeitura.poa.br/smap/concursos-em-andamento', tipo: 'concurso' },
  { url: 'https://prefeitura.poa.br/smap/processos-seletivos-em-andamento', tipo: 'processo-seletivo' },
];

function parsePage(html, page) {
  const body = (html.match(/<dl class="ckeditor-accordion">([\s\S]*?)<\/dl>/) || [])[1] || '';
  return body
    .split(/<dt[^>]*>/)
    .slice(1)
    .map((chunk) => {
      const [dt, dd = ''] = chunk.split(/<\/dt>/);
      const title = htmlToText(dt).replace(/\s+/g, ' ').trim();
      if (!title) return null;
      const text = htmlToText(dd);
      // período de inscrições, citado no edital de abertura
      const periodo = text.match(/per[íi]odo de (\d{1,2}\/\d{1,2}\/\d{4})\s*(?:a|à|até)\s*(\d{1,2}\/\d{1,2}\/\d{4})[^.]*inscri/i) || text.match(/inscri[çc][õo]es[^.]{0,80}?(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:a|à|até)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      const abertura = dd.match(/<a href="([^"]+)"[^>]*>(?:\s*<[^>]+>)*\s*EDITAL DE ABERTURA/i);
      const ultima = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*([^\n]{0,200})/);
      return {
        source: 'poa',
        sourceId: title.toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 80),
        title: 'Prefeitura de Porto Alegre',
        cargos: title,
        uf: 'RS',
        city: 'Porto Alegre',
        tipo: page.tipo,
        inscricaoDe: periodo ? parseBrDate(periodo[1]) : null,
        inscricaoAte: periodo ? parseBrDate(periodo[2]) : null,
        situacao: periodo ? undefined : 'em-andamento',
        description: ultima ? `Última publicação (${ultima[1]}): ${ultima[2].trim()}` : '',
        editalUrl: abertura ? new URL(decodeEntities(abertura[1]), page.url).href : null,
        url: page.url,
      };
    })
    .filter(Boolean);
}

module.exports = {
  id: 'poa',
  name: 'Prefeitura POA',
  kind: 'concursos',
  parsePage,
  async fetchJobs(progress) {
    const out = [];
    for (const [i, p] of PAGES.entries()) {
      out.push(...parsePage(await fetchText(p.url), p));
      progress(`${i + 1}/${PAGES.length} páginas`);
    }
    return out;
  },
};
