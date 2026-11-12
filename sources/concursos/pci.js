// PCI Concursos: páginas por cargo de TI (todo o Brasil) + a lista geral de concursos do RS.
const { fetchText, decodeEntities, pool } = require('../../lib/http');
const { parseBrDate } = require('../../lib/concursos');

// cargos de TI que têm página própria no PCI
const CARGOS = ['programador', 'desenvolvedor', 'analista-de-sistemas', 'analista-de-ti', 'analista-de-tecnologia-da-informacao', 'analista-de-informatica', 'tecnico-em-informatica', 'tecnico-de-informatica', 'tecnico-em-tecnologia-da-informacao', 'informatica'];
const label = (slug) => slug.replace(/-/g, ' ').replace(/\bti\b/, 'TI');

const clean = (s) => decodeEntities(String(s == null ? '' : s).replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/( · )+$/, '').trim();

function parseList(html) {
  return html
    .split(/<div class="na"/)
    .slice(1)
    .map((b) => {
      const g = (re) => (b.match(re) || [])[1];
      const url = g(/<div class="ca"><a href="([^"]+)"/);
      if (!url) return null;
      const cd = g(/<div class="cd">([\s\S]*?)<\/div>/) || '';
      const [head, cargos, niveis] = cd.split(/<br\s*\/?>/i).map(clean);
      const datas = clean(g(/<div class="ce">([\s\S]*?)<\/div>/)).match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
      return {
        source: 'pci',
        sourceId: url.replace(/^https?:\/\/[^/]+\/noticias\//, ''),
        title: clean(g(/<div class="ca"><a[^>]*>([\s\S]*?)<\/a>/)),
        chamada: clean(g(/<a href="[^"]+" title="([^"]*)"/)),
        uf: clean(g(/<div class="cc">([\s\S]*?)<\/div>/)) || 'BR',
        tipo: 'concurso',
        vagasText: (head || '').replace(/\s*até R\$.*/, ''),
        salaryText: ((head || '').match(/R\$\s?[\d.,]+/) || [])[0] || null,
        cargos: cargos || '',
        escolaridadeText: niveis || '',
        inscricaoDe: datas.length > 1 ? parseBrDate(datas[0]) : null,
        inscricaoAte: parseBrDate(datas[datas.length - 1]),
        url,
        logo: g(/data-src="([^"]+)"/) || null,
      };
    })
    .filter((c) => c && c.title);
}

module.exports = {
  id: 'pci',
  name: 'PCI Concursos',
  kind: 'concursos',
  parseList,
  async fetchJobs(progress) {
    const pages = [...CARGOS.map((c) => ({ url: `https://www.pciconcursos.com.br/vagas/${c}`, cargo: c })), { url: 'https://www.pciconcursos.com.br/concursos/sul/', onlyUf: 'RS' }];
    let done = 0;
    const errors = [];
    const byId = new Map();
    await pool(pages, 3, async (p) => {
      try {
        for (const c of parseList(await fetchText(p.url))) {
          if (p.onlyUf && c.uf !== p.onlyUf) continue;
          const prev = byId.get(c.sourceId) || byId.set(c.sourceId, { ...c, cargosTi: [], ti: false }).get(c.sourceId);
          if (p.cargo) {
            prev.ti = true; // apareceu numa página de cargo de TI
            if (!prev.cargosTi.includes(label(p.cargo))) prev.cargosTi.push(label(p.cargo));
          }
        }
      } catch (e) {
        errors.push(e.message);
      }
      progress(`${++done}/${pages.length} páginas`);
    });
    if (errors.length === pages.length) throw new Error(errors[0]);
    return [...byId.values()];
  },
};
