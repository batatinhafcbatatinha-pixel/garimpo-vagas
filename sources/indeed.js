// Indeed: o site responde com uma verificação anti-robô (HTTP 403) para acessos automáticos.
// Tentamos a busca normal; se vier bloqueio, a fonte é marcada como bloqueada e o site
// oferece links para abrir a busca do Indeed já filtrada no navegador.
const { fetchText, htmlToText, decodeEntities } = require('../lib/http');

const SEARCHES = [
  { q: 'desenvolvedor junior', l: 'Porto Alegre, RS' },
  { q: 'programador junior', l: 'Porto Alegre, RS' },
  { q: 'desenvolvedor junior', l: 'Brasil', remote: true },
  { q: 'programador junior', l: 'Brasil', remote: true },
];
const searchUrl = (s) =>
  `https://br.indeed.com/jobs?q=${encodeURIComponent(s.q)}&l=${encodeURIComponent(s.l)}&sort=date` +
  (s.remote ? '&sc=' + encodeURIComponent('0kf:attr(DSQF7);') : '');

function parse(html, s) {
  const m = html.match(/window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) return [];
  const results = JSON.parse(m[1])?.metaData?.mosaicProviderJobCardsModel?.results || [];
  return results.map((r) => ({
    source: 'indeed',
    sourceId: r.jobkey,
    title: decodeEntities(r.title || r.displayTitle || ''),
    company: r.company || 'Empresa confidencial',
    logo: null,
    location: r.formattedLocation || s.l,
    workMode: s.remote || r.remoteLocation ? 'remote' : null,
    url: `https://br.indeed.com/viewjob?jk=${r.jobkey}`,
    publishedAt: r.pubDate ? new Date(r.pubDate).toISOString() : null,
    salaryText: r.salarySnippet?.text || null,
    description: htmlToText(r.snippet),
  }));
}

module.exports = {
  id: 'indeed',
  name: 'Indeed',
  manualLinks: SEARCHES.map((s) => ({ label: `${s.q} · ${s.remote ? 'remoto' : 'Porto Alegre'}`, url: searchUrl(s) })),
  async fetchJobs(progress) {
    const jobs = [];
    let blocked = 0;
    for (const [i, s] of SEARCHES.entries()) {
      try {
        jobs.push(...parse(await fetchText(searchUrl(s), { retries: 0 }), s));
      } catch (e) {
        if (e.status === 403) blocked++;
        else throw e;
      }
      progress(`${i + 1}/${SEARCHES.length} buscas`);
    }
    if (blocked === SEARCHES.length) {
      const err = new Error('O Indeed bloqueia buscas automáticas (verificação anti-robô).');
      err.blocked = true;
      throw err;
    }
    return jobs;
  },
};
