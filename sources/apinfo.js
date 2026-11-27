// APInfo: site antigo (ColdFusion, ISO-8859-1). A busca é um POST em list4.cfm e cada página
// traz 8 vagas já com a descrição inteira. Não há página própria da vaga (o link "envie seu
// currículo" exige sessão), então o link leva à busca. O site tem cota de consultas bem curta
// ("seu limite de consultas está temporariamente esgotado"): uma busca só, combinando Home
// Office + RS e os cargos de desenvolvimento, e as vagas vistas ficam em cache para cobrir as
// páginas que a cota não deixar ler.
const { UA, htmlToText, decodeEntities, sleep } = require('../lib/http');

const URL = 'https://www.apinfo.com/apinfo/inc/list4.cfm';
// estado HO = Home Office. Cargos: 27 Programador/Desenvolvedor, 21 Analista Programador/Desenvolvedor,
// 41 Engenheiro de Software, 60 Estagiário, 56 Trainee TI
const FILTER = [['estado[]', 'HO'], ['estado[]', 'RS'], ...['27', '21', '41', '60', '56'].map((c) => ['cargo2cod[]', c])];
const MAX_PAGES = 12;
const KEEP_DAYS = 30; // vaga em cache que não apareceu desta vez (cota) continua por até 30 dias

const clean = (s) => decodeEntities(String(s ?? '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const QUOTA_RE = /limite de consultas/i;

// Página de resultados -> { jobs, page, pages, form } (form = campos para pedir a próxima página).
function parsePage(html) {
  const jobs = html
    .split(/<div class="box-vagas/)
    .slice(1)
    .map((c) => {
      const g = (re) => (c.match(re) || [])[1];
      const id = g(/C[óo]digo[^<]*<\/strong>\s*(\d+)/);
      if (!id) return null;
      // "Porto Alegre - RS - 26/11/26" ou "Home Office - HO - 26/11/26"
      const info = clean(g(/class="info-data">([\s\S]*?)<\/div>/));
      const m = /^(.*?)\s*-\s*([A-Z]{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{2})$/.exec(info) || [];
      const home = m[2] === 'HO';
      return {
        source: 'apinfo',
        sourceId: id,
        title: clean(g(/class="cargo m-tb">([\s\S]*?)<\/div>/)), // o título vem letra a letra entre <span>
        company: clean(g(/Empresa[ .]*:<\/strong>([\s\S]*?)<br/i)) || 'Empresa confidencial',
        logo: null,
        location: home || !m[1] ? 'Brasil' : `${m[1]}, ${m[2]}`,
        // filtro "Home Office": pista confiável, mas a descrição manda (ex.: "híbrido 3x no mês")
        workModeHint: home ? 'remote' : null,
        workModeHintTrusted: true,
        url: URL,
        publishedAt: m[3] ? new Date(`20${m[5]}-${m[4]}-${m[3]}T12:00:00-03:00`).toISOString() : null,
        salaryText: null,
        educationText: null,
        description: htmlToText(g(/<p style="white-space:pre-wrap;[^"]*">([\s\S]*?)<\/p>/)).slice(0, 6000),
        levelHint: null,
      };
    })
    .filter((j) => j && j.title);

  const pg = /P[áa]gina (\d+) de (\d+)/.exec(html) || [];
  // formulário de paginação: os filtros, a chave da busca (pkey) e o total (tcv) em campos ocultos
  let form = null;
  const at = html.indexOf('<form METHOD="POST" ACTION="list4.cfm">');
  if (at >= 0) {
    const f = html.slice(at, html.indexOf('</form>', at));
    form = [...f.matchAll(/<input type="?hidden"? name="?([^"\s>]+)"?\s+value="?([^">]*)"?/g)].map((x) => [x[1], x[2]]);
  }
  return { jobs, page: Number(pg[1]) || 1, pages: Number(pg[2]) || 1, form };
}

async function post(fields) {
  const res = await fetch(URL, {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9', referer: URL },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const html = new TextDecoder('latin1').decode(await res.arrayBuffer());
  if (QUOTA_RE.test(html)) throw Object.assign(new Error('cota de consultas esgotada'), { quota: true });
  return html;
}

module.exports = {
  id: 'apinfo',
  name: 'APInfo',
  parsePage,
  async fetchJobs(progress, cache) {
    const found = new Map();
    let form = [['tcv', '1'], ['pag', '1'], ['keyw', ''], ['onde', '1'], ['andor', '1'], ...FILTER];
    let pages = 1;
    let stopErr = null;
    for (let page = 1; page <= Math.min(pages, MAX_PAGES); page++) {
      try {
        const res = parsePage(await post(form));
        for (const j of res.jobs) found.set(j.sourceId, j);
        pages = res.pages;
        if (!res.form) break;
        form = res.form.filter(([k]) => k !== 'pag').concat([['pag', String(page + 1)]]);
      } catch (e) {
        stopErr = e; // cota ou falha no meio: fica com o que já veio + o cache
        break;
      }
      progress(`${page}/${Math.min(pages, MAX_PAGES)} páginas · ${found.size} vagas`);
      await sleep(2000);
    }

    if (!found.size && stopErr) {
      if (stopErr.quota) {
        const err = new Error('O APInfo esgotou a cota de consultas (limite temporário do site); tente de novo mais tarde.');
        err.blocked = true;
        throw err;
      }
      throw stopErr;
    }
    // cache: vagas vistas. Sem ler todas as páginas, as que já conhecíamos e ainda são recentes continuam
    const now = Date.now();
    const fresh = (j) => !j.publishedAt || now - Date.parse(j.publishedAt) < KEEP_DAYS * 864e5;
    for (const j of found.values()) cache[j.sourceId] = j;
    for (const [id, j] of Object.entries(cache)) if (!fresh(j)) delete cache[id];
    const complete = !stopErr && pages <= MAX_PAGES;
    return complete ? [...found.values()] : [...found.values(), ...Object.values(cache).filter((j) => !found.has(j.sourceId))];
  },
};
