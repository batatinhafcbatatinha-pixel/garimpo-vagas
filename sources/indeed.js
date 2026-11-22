// Indeed: recusa clientes HTTP comuns (HTTP 403, verificação anti-robô), mas libera a página
// para um navegador de verdade. Por isso a busca é feita pelo Edge/Chrome em modo headless
// (ver browserHtml em lib/http). Se nem assim der, a fonte é marcada como bloqueada e o site
// oferece links para abrir a busca do Indeed já filtrada no navegador.
const { fetchText, browserHtml, findBrowser, htmlToText, decodeEntities } = require('../lib/http');

const SEARCHES = [
  { q: 'desenvolvedor junior', l: 'Porto Alegre, RS' },
  { q: 'programador junior', l: 'Porto Alegre, RS' },
  { q: 'desenvolvedor junior', l: 'Brasil', remote: true },
  { q: 'programador junior', l: 'Brasil', remote: true },
];
const searchUrl = (s) =>
  `https://br.indeed.com/jobs?q=${encodeURIComponent(s.q)}&l=${encodeURIComponent(s.l)}&sort=date` +
  (s.remote ? '&sc=' + encodeURIComponent('0kf:attr(DSQF7);') : '');

// Extrai o objeto JSON que começa em `start` contando chaves (ignorando as que estão dentro de strings).
function sliceJson(text, start) {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function parse(html, s) {
  const at = html.indexOf('providerData["mosaic-provider-jobcards"]');
  if (at < 0) return null; // página sem a lista de vagas (bloqueio ou layout novo)
  const json = sliceJson(html, html.indexOf('{', at));
  if (!json) return null;
  const results = JSON.parse(json)?.metaData?.mosaicProviderJobCardsModel?.results || [];
  return results.map((r) => ({
    source: 'indeed',
    sourceId: r.jobkey,
    title: decodeEntities(r.title || r.displayTitle || ''),
    company: r.company || 'Empresa confidencial',
    logo: null,
    location: r.formattedLocation || s.l,
    // filtro "remoto" da busca: pista confiável, mas a descrição manda (ex.: "modelo híbrido")
    workModeHint: s.remote || r.remoteLocation ? 'remote' : null,
    workModeHintTrusted: true,
    url: `https://br.indeed.com/viewjob?jk=${r.jobkey}`,
    publishedAt: r.pubDate ? new Date(r.pubDate).toISOString() : null,
    salaryText: r.salarySnippet?.text || null,
    description: htmlToText(r.snippet),
  }));
}

async function getPage(url) {
  if (findBrowser()) return browserHtml(url);
  return fetchText(url, { retries: 0 }); // sem navegador: tenta direto (costuma dar 403)
}

module.exports = {
  id: 'indeed',
  name: 'Indeed',
  parse,
  manualLinks: SEARCHES.map((s) => ({ label: `${s.q} · ${s.remote ? 'remoto' : 'Porto Alegre'}`, url: searchUrl(s) })),
  async fetchJobs(progress) {
    const jobs = [];
    let blocked = 0;
    const errors = [];
    for (const [i, s] of SEARCHES.entries()) {
      try {
        const found = parse(await getPage(searchUrl(s)), s);
        if (found) jobs.push(...found);
        else blocked++;
      } catch (e) {
        // uma busca que falha não derruba as outras
        if (e.status === 403) blocked++;
        else errors.push(e);
      }
      progress(`${i + 1}/${SEARCHES.length} buscas · ${jobs.length} vagas`);
    }
    if (!jobs.length && errors.length) throw errors[0];
    if (blocked === SEARCHES.length) {
      const err = new Error(
        findBrowser()
          ? 'O Indeed bloqueou as buscas automáticas (verificação anti-robô).'
          : 'O Indeed bloqueia buscas automáticas; instale o Edge ou o Chrome para buscar por ele.'
      );
      err.blocked = true;
      throw err;
    }
    return jobs;
  },
};
