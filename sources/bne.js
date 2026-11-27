// BNE: busca em HTML renderizado no servidor, por função ("desenvolvedor", "programador").
// O card traz só a função como título, o modelo de trabalho e um trecho da descrição; a página
// da vaga tem o JSON-LD (descrição completa, data, salário, estágio). Abre cada vaga nova uma vez e guarda em cache.
const { fetchText, htmlToText, decodeEntities, pool, sleep } = require('../lib/http');
const { isDevJob } = require('../lib/classify');

const BASE = 'https://www.bne.com.br';
const SEARCHES = [
  { path: '/vagas-de-emprego-para-desenvolvedor-em-porto-alegre-rs', pages: 4 },
  { path: '/vagas-de-emprego-para-programador-em-porto-alegre-rs', pages: 2 },
  { path: '/vagas-de-emprego-para-analista-de-sistemas-em-porto-alegre-rs', pages: 1 },
  { path: '/vagas-de-emprego-para-desenvolvedor/?HomeOffice=True', pages: 3 },
  { path: '/vagas-de-emprego-para-programador/?HomeOffice=True', pages: 1 },
  { path: '/vagas-de-emprego-na-area-de-informatica?Area=Informatica&HomeOffice=True', pages: 2 },
];
const MAX_DETAILS = 40; // por atualização; o resto entra na próxima
const MODES = { presencial: 'onsite', 'home office': 'remote', remoto: 'remote', 'híbrido': 'hybrid', hibrido: 'hybrid' };

// o título é só a função; o nível costuma vir no começo da descrição ("Vaga para desenvolvedor java pleno")
function levelFrom(text) {
  const t = String(text || '').slice(0, 160).toLowerCase();
  const m = t.match(/est[aá]gi\w*|trainee|j[uú]nior|\bjr\b|pleno|s[eê]nior|\bsr\b/);
  if (!m) return null;
  return /est/.test(m[0]) ? 'estagio' : /trainee/.test(m[0]) ? 'trainee' : /^j/.test(m[0]) ? 'junior' : /pleno/.test(m[0]) ? 'pleno' : 'senior';
}

function parseCards(html) {
  return html
    .split('class="card--list--vagas"')
    .slice(1)
    .map((c) => {
      const g = (re) => (c.match(re) || [])[1];
      const id = g(/data-job-id="(\d+)"/);
      const link = c.match(/class="card__link" href="([^"]+)" title="([^"]*)"/);
      if (!id || !link) return null;
      // itens: função, empresa (às vezes falta), modelo, local; reconhecidos pelo formato
      const items = [...c.matchAll(/<div class="info__vaga-item">([\s\S]*?)<\/div>/g)].map((m) => htmlToText(m[1]));
      const mode = items.find((s) => MODES[s.toLowerCase()]);
      const place = items.find((s) => /\s\/\s[A-Z]{2}$/.test(s));
      const company = items.slice(1).find((s) => s && s !== mode && s !== place);
      const description = htmlToText((c.match(/job__description-text"[^>]*>([\s\S]*?)<span class="job__description-ellipsis/) || [])[1]);
      return {
        source: 'bne',
        sourceId: id,
        title: decodeEntities(link[2]).replace(/\s+em\s+[^/]+\/[A-Z]{2}$/, '').trim(),
        company: company && !/^confidencial$/i.test(company) ? company : 'Empresa confidencial',
        logo: null,
        location: place ? place.replace(/\s*\/\s*/, ', ') : 'Brasil',
        // o campo do BNE é frouxo ("Home Office" com "modelo híbrido" na descrição): pista confiável, mas o texto manda
        workModeHint: mode ? MODES[mode.toLowerCase()] : null,
        workModeHintTrusted: true,
        url: link[1].startsWith('http') ? link[1] : BASE + link[1],
        publishedAt: null,
        salaryText: null,
        description,
        levelHint: levelFrom(description),
      };
    })
    .filter((j) => j && j.title);
}

const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function parseDetail(html) {
  let posting = null;
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      if (j['@type'] === 'JobPosting') posting = j;
    } catch {
      /* outro bloco quebrado; ignora */
    }
  }
  if (!posting) return null;
  const v = posting.baseSalary?.value || {};
  const min = v.minValue || v.value;
  const max = v.maxValue;
  const org = posting.hiringOrganization?.name;
  const description = htmlToText(posting.description).slice(0, 6000);
  const level = /INTERN/.test(posting.employmentType || '') ? 'estagio' : levelFrom(description);
  return {
    description,
    publishedAt: posting.datePosted ? new Date(posting.datePosted + 'T12:00:00-03:00').toISOString() : null,
    salaryText: min > 0 ? (max > min ? `${brl(min)} a ${brl(max)}` : brl(min)) : null,
    ...(org && !/^confidencial$/i.test(org) ? { company: org } : {}),
    ...(level ? { levelHint: level } : {}), // sem nível no detalhe, fica o do card
  };
}

module.exports = {
  id: 'bne',
  name: 'BNE',
  parseCards,
  parseDetail,
  async fetchJobs(progress, cache) {
    const byId = new Map();
    const errors = [];
    let done = 0;
    await pool(SEARCHES, 2, async (s) => {
      try {
        for (let page = 1; page <= s.pages; page++) {
          const sep = s.path.includes('?') ? '&' : '?';
          const cards = parseCards(await fetchText(BASE + s.path + (page > 1 ? `${sep}Page=${page}` : '')));
          for (const c of cards) if (!byId.has(c.sourceId)) byId.set(c.sourceId, c);
          if (cards.length < 20) break;
          await sleep(400);
        }
      } catch (e) {
        errors.push(e.message);
      }
      progress(`${++done}/${SEARCHES.length} buscas · ${byId.size} vagas`);
    });
    if (errors.length === SEARCHES.length) throw new Error(errors[0]);

    const jobs = [...byId.values()];
    // só abre as que parecem de dev (a busca por área traz suporte, redes etc.)
    const missing = jobs.filter((j) => !cache[j.sourceId] && isDevJob(j.title)).slice(0, MAX_DETAILS);
    let n = 0;
    await pool(missing, 2, async (j) => {
      try {
        const d = parseDetail(await fetchText(j.url));
        if (d) cache[j.sourceId] = d;
      } catch {
        /* fica com o trecho do card; tenta de novo na próxima atualização */
      }
      progress(`descrições ${++n}/${missing.length}`);
      await sleep(300);
    });
    return jobs.map((j) => ({ ...j, ...(cache[j.sourceId] || {}) }));
  },
};
