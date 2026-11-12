// Glassdoor: a primeira página de cada busca vem embutida no HTML (stream do Next.js).
// Só a primeira página é acessível sem login, então várias buscas são combinadas.
const { curlText, pool } = require('../lib/http');

const TERMS = ['desenvolvedor junior', 'programador junior', 'desenvolvedor jr', 'desenvolvedor', 'programador', 'junior developer', 'desenvolvedor trainee', 'estagio desenvolvimento', 'front end junior', 'back end junior'];
const slug = (t) => t.trim().replace(/\s+/g, '-');
const PLACES = [
  { url: (t) => `https://www.glassdoor.com.br/Vaga/porto-alegre-${slug(t)}-vagas-SRCH_IL.0,12_IC2417359_KO13,${13 + t.length}.htm` },
  { url: (t) => `https://www.glassdoor.com.br/Vaga/brasil-${slug(t)}-vagas-SRCH_IL.0,6_IN36_KO7,${7 + t.length}.htm?remoteWorkType=1`, workMode: 'remote' },
];

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

function parseListings(html, place) {
  const text = flightText(html);
  const listings = extractArray(text, 'jobListings') || [];
  const resolve = makeResolver(text);
  return listings
    .map((l) => {
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
      return {
        source: 'glassdoor',
        sourceId: String(id),
        title: String(resolve(job.jobTitleText) || h.jobTitleText || '').trim(),
        company: h.employerNameFromSearch || h.employer?.shortName || h.employer?.name || 'Empresa confidencial',
        logo: resolve(jv.overview?.squareLogoUrl) || null,
        location: resolve(h.locationName) || 'Brasil',
        workMode: place.workMode || (attrs.some((a) => /remoto|home office/i.test(a)) ? 'remote' : attrs.some((a) => /h[íi]brido/i.test(a)) ? 'hybrid' : null),
        url: link.startsWith('http') ? link : 'https://www.glassdoor.com.br' + link,
        publishedAt: Number.isFinite(h.ageInDays) ? new Date(Date.now() - h.ageInDays * 864e5).toISOString() : null,
        salaryText,
        salaryEstimate: salaryText ? h.salarySource !== 'EMPLOYER_PROVIDED' : false,
        description: (Array.isArray(frag) ? frag.join(' … ') : String(frag || '')).replace(/<[^>]+>/g, ''),
        attributes: attrs,
      };
    })
    .filter((j) => j && j.title);
}

module.exports = {
  id: 'glassdoor',
  name: 'Glassdoor',
  parseListings,
  async fetchJobs(progress) {
    const queries = PLACES.flatMap((p) => TERMS.map((t) => ({ p, t })));
    let done = 0;
    const errors = [];
    const results = await pool(queries, 2, async ({ p, t }) => {
      try {
        return parseListings(await curlText(p.url(t)), p);
      } catch (e) {
        errors.push(e.message);
        return [];
      } finally {
        progress(`${++done}/${queries.length} buscas`);
      }
    });
    if (errors.length === queries.length) throw new Error(errors[0]);
    return results.flat();
  },
};
