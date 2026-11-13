// Glassdoor: a primeira página de cada busca vem embutida no HTML (stream do Next.js).
// As páginas seguintes e a descrição completa vêm das APIs internas que o próprio site usa
// (job-search-next/bff). Elas recusam navegador automatizado, mas aceitam o curl.
const { curlText, htmlToText, pool, sleep } = require('../lib/http');

const TERMS = ['desenvolvedor junior', 'programador junior', 'desenvolvedor jr', 'desenvolvedor', 'programador', 'junior developer', 'desenvolvedor trainee', 'estagio desenvolvimento', 'front end junior', 'back end junior'];
const MAX_PAGES = 5; // 30 vagas por página
const MAX_DETAILS = 500; // descrições novas por atualização; o resto fica para a próxima
const BASE = 'https://www.glassdoor.com.br';
const BFF = `${BASE}/job-search-next/bff`;

const slug = (t) => t.trim().replace(/\s+/g, '-');
// prefixo da URL, onde a palavra-chave entra na URL e o local na API
const PLACES = [
  { prefix: 'porto-alegre', loc: 'IC2417359', locationId: 2417359, locationType: 'CITY' },
  { prefix: 'brasil', loc: 'IN36', locationId: 36, locationType: 'COUNTRY', remote: true, workMode: 'remote' },
];
function search(place, term) {
  const p = place.prefix.length;
  const params = `IL.0,${p}_${place.loc}_KO${p + 1},${p + 1 + term.length}`;
  const seo = `${place.prefix}-${slug(term)}-vagas`;
  const qs = place.remote ? 'remoteWorkType=1' : '';
  return { params, seo, qs, url: `${BASE}/Vaga/${seo}-SRCH_${params}.htm${qs ? '?' + qs : ''}` };
}

// Junta os pedaços self.__next_f.push([1,"..."]) num texto só.
function flightText(html) {
  let out = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try {
      out += JSON.parse('"' + m[1] + '"');
    } catch {
      /* pedaço malformado: ignora */
    }
  }
  return out;
}

// Extrai o array JSON que segue `"key":` respeitando strings e aninhamento.
function extractArray(text, key) {
  const start = text.indexOf(`"${key}":[`);
  if (start === -1) return null;
  let i = start + key.length + 3;
  const begin = i;
  let depth = 0;
  let inStr = false;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') {
      if (--depth === 0) return JSON.parse(text.slice(begin, i + 1));
    }
  }
  return null;
}

// Resolve referências "$5b" para a linha correspondente do stream ("5b:..." ou "5b:Tlen,texto").
function makeResolver(text) {
  const buf = Buffer.from(text, 'utf8');
  return (v) => {
    if (typeof v !== 'string' || !/^\$[0-9a-f]+$/.test(v)) return v;
    const id = v.slice(1);
    const marker = Buffer.from(`\n${id}:`);
    let at = buf.indexOf(marker);
    if (at === -1) {
      if (buf.subarray(0, id.length + 1).toString() === `${id}:`) at = -1 - 0;
      else return null;
    }
    const from = at === -1 ? id.length + 1 : at + marker.length;
    if (buf[from] === 0x54) {
      // T<hexlen>,<bytes>
      const comma = buf.indexOf(',', from);
      const len = parseInt(buf.subarray(from + 1, comma).toString(), 16);
      return buf.subarray(comma + 1, comma + 1 + len).toString('utf8');
    }
    const end = buf.indexOf('\n', from);
    try {
      return JSON.parse(buf.subarray(from, end === -1 ? undefined : end).toString('utf8'));
    } catch {
      return null;
    }
  };
}

// Converte um item de "jobListings" (do HTML ou da API) para o formato do Garimpo.
function mapListing(l, place, resolve = (v) => v) {
  const jv = l.jobview || {};
  const h = jv.header || {};
  const job = jv.job || {};
  const id = job.listingId || h.jobListingId;
  const link = resolve(h.seoJobLink) || resolve(h.jobLink);
  if (!id || !link) return null;
  const pay = h.payPeriodAdjustedPay;
  const fmt = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
  // o Glassdoor normaliza para o período informado; converte para mês
  const perMonth = { ANNUAL: 1 / 12, MONTHLY: 1, HOURLY: 160, WEEKLY: 4.33, DAILY: 21 }[h.payPeriod] || 1;
  const salaryText = pay && pay.p10 ? [...new Set([pay.p10, pay.p90].filter(Boolean).map((v) => fmt(v * perMonth)))].join(' – ') : null;
  const attrs = (h.indeedJobAttribute?.extractedJobAttributes || []).map((a) => a.value);
  const frag = resolve(job.descriptionFragmentsText);
  const job2 = {
    source: 'glassdoor',
    sourceId: String(id),
    title: String(resolve(job.jobTitleText) || h.jobTitleText || '').trim(),
    company: h.employerNameFromSearch || h.employer?.shortName || h.employer?.name || 'Empresa confidencial',
    logo: resolve(jv.overview?.squareLogoUrl) || null,
    location: resolve(h.locationName) || 'Brasil',
    workMode: place.workMode || (attrs.some((a) => /remoto|home office/i.test(a)) ? 'remote' : attrs.some((a) => /h[íi]brido/i.test(a)) ? 'hybrid' : null),
    url: link.startsWith('http') ? link : BASE + link,
    publishedAt: Number.isFinite(h.ageInDays) ? new Date(Date.now() - h.ageInDays * 864e5).toISOString() : null,
    salaryText,
    salaryEstimate: salaryText ? h.salarySource !== 'EMPLOYER_PROVIDED' : false,
    description: (Array.isArray(frag) ? frag.join(' … ') : String(frag || '')).replace(/<[^>]+>/g, ''),
    attributes: attrs,
  };
  return job2.title ? job2 : null;
}

// Primeira página: vagas e cursores das páginas seguintes, a partir do HTML.
function parsePage(html, place) {
  const text = flightText(html);
  const resolve = makeResolver(text);
  return {
    jobs: (extractArray(text, 'jobListings') || []).map((l) => mapListing(l, place, resolve)).filter(Boolean),
    cursors: extractArray(text, 'paginationCursors') || [],
  };
}
const parseListings = (html, place) => parsePage(html, place).jobs;

// Páginas seguintes, pela mesma API que o botão "Mostrar mais vagas" usa.
async function fetchPage(place, term, s, page, cursor) {
  const body = {
    // sem filterParams a API ignora o "remoto" do queryString
    excludeJobListingIds: [], filterParams: place.remote ? [{ filterKey: 'remoteWorkType', values: '1' }] : [], includeIndeedJobAttributes: true, keyword: term,
    locationId: place.locationId, locationType: place.locationType, numJobsToShow: 30,
    originalPageUrl: s.url, pageCursor: cursor, pageNumber: page, pageType: 'SERP',
    parameterUrlInput: s.params, queryString: s.qs, seoFriendlyUrlInput: s.seo, seoUrl: true,
  };
  const res = JSON.parse(await curlText(`${BFF}/jobSearchResultsQuery`, { json: body, headers: { referer: s.url, origin: BASE } }));
  const d = res.data?.jobListings || {};
  return { jobs: (d.jobListings || []).map((l) => mapListing(l, place)).filter(Boolean), cursors: d.paginationCursors || [] };
}

// Descrição completa (HTML) de uma vaga.
async function fetchDetail(id) {
  const res = JSON.parse(await curlText(`${BFF}/jobDetailsQuery`, { json: { jl: Number(id) }, headers: { referer: `${BASE}/`, origin: BASE } }));
  const html = res.data?.jobview?.job?.description;
  return html ? { description: htmlToText(html).slice(0, 12000) } : null;
}

module.exports = {
  id: 'glassdoor',
  name: 'Glassdoor',
  parseListings,
  parsePage,
  mapListing,
  async fetchJobs(progress, cache = {}) {
    const queries = PLACES.flatMap((p) => TERMS.map((t) => ({ p, t })));
    const byId = new Map();
    let done = 0;
    let firstOk = 0;
    const errors = [];
    await pool(queries, 2, async ({ p, t }) => {
      const s = search(p, t);
      try {
        let { jobs, cursors } = parsePage(await curlText(s.url), p);
        firstOk++;
        for (let page = 2; ; page++) {
          let fresh = 0;
          for (const j of jobs) if (!byId.has(j.sourceId)) { byId.set(j.sourceId, j); fresh++; }
          const next = cursors.find((c) => c.pageNumber === page);
          // para quando acabam as páginas ou a busca só repete vagas já vistas
          if (!next || page > MAX_PAGES || !fresh || jobs.length < 30) break;
          await sleep(300);
          try {
            ({ jobs, cursors } = await fetchPage(p, t, s, page, next.cursor));
          } catch (e) {
            errors.push(`página ${page}: ${e.message}`);
            break;
          }
        }
      } catch (e) {
        errors.push(e.message);
      } finally {
        progress(`${++done}/${queries.length} buscas · ${byId.size} vagas`);
      }
    });
    if (!firstOk) throw new Error(errors[0]);

    const jobs = [...byId.values()];
    // descrição completa: cada vaga nova é aberta uma vez e fica em cache
    for (const id of Object.keys(cache)) if (!byId.has(id)) delete cache[id];
    const missing = jobs.filter((j) => !cache[j.sourceId]).slice(0, MAX_DETAILS);
    let n = 0;
    await pool(missing, 3, async (j) => {
      try {
        const d = await fetchDetail(j.sourceId);
        if (d) cache[j.sourceId] = d;
      } catch {
        /* fica com o resumo desta vez; tenta de novo na próxima atualização */
      }
      progress(`descrições ${++n}/${missing.length}`);
      await sleep(200);
    });
    return jobs.map((j) => ({ ...j, ...(cache[j.sourceId] || {}) }));
  },
};
