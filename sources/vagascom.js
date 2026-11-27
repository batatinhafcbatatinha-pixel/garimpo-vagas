// Vagas.com: busca em HTML renderizado no servidor. O Cloudflare deixa passar as páginas sem
// query string; com filtros (?m[]=...) só passa com o cabeçalho de AJAX que o próprio site manda.
// O card traz só um trecho da descrição; cada vaga nova é aberta uma vez e fica em cache.
const { fetchText, htmlToText, decodeEntities, pool, sleep } = require('../lib/http');
const { isDevJob } = require('../lib/classify');

const BASE = 'https://www.vagas.com.br';
const HOME_OFFICE = '?m%5B%5D=100%25+Home+Office';
// o site tem pouca vaga de dev; a busca nacional já cobre POA e as remotas
const SEARCHES = [
  ...['desenvolvedor', 'programador', 'developer', 'front-end', 'back-end', 'full-stack', 'software', 'estagio-ti', 'analista-desenvolvedor'].map((t) => ({ path: `/vagas-de-${t}` })),
  ...['programador', 'ti', 'software', 'tecnologia'].map((t) => ({ path: `/vagas-de-${t}-em-porto-alegre` })),
  ...['ti', 'tecnologia', 'programador', 'desenvolvimento', 'software'].map((t) => ({ path: `/vagas-de-${t}${HOME_OFFICE}`, remote: true })),
];
const MAX_DETAILS = 40; // por atualização; o resto entra na próxima
const XHR = { 'x-requested-with': 'XMLHttpRequest' };

const clean = (s) => decodeEntities(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const levelOf = (s) => {
  const t = String(s || '').toLowerCase();
  return /est[aá]gi/.test(t) ? 'estagio' : /j[uú]nior|trainee/.test(t) ? 'junior' : /pleno/.test(t) ? 'pleno' : /s[eê]nior/.test(t) ? 'senior' : null;
};
// "São Paulo / SP" -> "São Paulo, SP"; "100% Home Office" é a vaga remota
const placeOf = (s) => (/home office|n[aã]o informad/i.test(s) ? 'Brasil' : s.replace(/\s*\/\s*/, ', ') || 'Brasil');
const isBlockPage = (html) => /<title>Just a moment|challenges\.cloudflare\.com/.test(html) && !/class="vaga /.test(html);

function parseCards(html, search = {}) {
  return html
    .split(/<li class="vaga /)
    .slice(1)
    .map((c) => {
      const g = (re) => (c.match(re) || [])[1];
      const id = g(/data-id-vaga="(\d+)"/);
      const href = g(/class="link-detalhes-vaga"[^>]*href="([^"]+)"/);
      if (!id || !href) return null;
      const place = clean(g(/class="vaga-local">\s*<i[^>]*><\/i>([^<]*)/));
      const date = c.match(/data-publicacao"><i[^>]*><\/i>\s*(\d{2})\/(\d{2})\/(\d{4})/);
      return {
        source: 'vagascom',
        sourceId: id,
        title: decodeEntities(g(/class="link-detalhes-vaga"[^>]*title="([^"]*)"/) || '').trim(),
        company: clean(g(/class="emprVaga">([\s\S]*?)<\/span>/)) || 'Empresa confidencial',
        logo: g(/class="logoEmpresa[^"]*">\s*<img[^>]*src="([^"]+)"/) || null,
        location: placeOf(place),
        workMode: /home office/i.test(place) ? 'remote' : null,
        workModeHint: search.remote ? 'remote' : null, // filtro de home office da busca
        url: BASE + href,
        publishedAt: date ? new Date(`${date[3]}-${date[2]}-${date[1]}T12:00:00-03:00`).toISOString() : null,
        salaryText: null,
        description: clean(g(/<div class="detalhes">\s*<p>([\s\S]*?)<\/p>/)),
        levelHint: levelOf(clean(g(/class="nivelVaga">([\s\S]*?)<\/span>/))),
      };
    })
    .filter((j) => j && j.title);
}

// próxima página: o botão "mais vagas" traz a URL (só funciona com o cabeçalho de AJAX)
const nextPage = (html) => decodeEntities((html.match(/data-url="([^"]+)"[^>]*id="maisVagas"/) || [])[1] || '') || null;

function parseDetail(html) {
  const desc = (html.match(/job-description__text texto"[^>]*>([\s\S]*?)<\/div>/) || [])[1];
  if (desc == null) return null;
  const salary = clean((html.match(/Faixa salarial\s*<\/span>\s*<span>([\s\S]*?)<\/span>/) || [])[1]);
  const place = clean((html.match(/class="info-localizacao"[^>]*>([^<]*)/) || [])[1]);
  return {
    description: htmlToText(desc).slice(0, 6000),
    ...(/R\$|\d/.test(salary) ? { salaryText: salary } : {}),
    ...(/home office/i.test(place) ? { workMode: 'remote', location: 'Brasil' } : {}),
  };
}

module.exports = {
  id: 'vagascom',
  name: 'Vagas.com',
  parseCards,
  parseDetail,
  nextPage,
  async fetchJobs(progress, cache) {
    const byId = new Map();
    const errors = [];
    let blocked = 0;
    let done = 0;
    await pool(SEARCHES, 2, async (s) => {
      try {
        let url = BASE + s.path;
        for (let page = 1; page <= 2 && url; page++) {
          const html = await fetchText(url, { headers: XHR });
          if (isBlockPage(html)) {
            blocked++;
            break;
          }
          const cards = parseCards(html, s);
          for (const c of cards) if (!byId.has(c.sourceId)) byId.set(c.sourceId, c);
          const next = nextPage(html);
          url = cards.length >= 40 && next ? BASE + next : null;
          await sleep(400);
        }
      } catch (e) {
        if (e.status === 403) blocked++;
        else errors.push(e.message);
      }
      progress(`${++done}/${SEARCHES.length} buscas · ${byId.size} vagas`);
    });
    if (!byId.size && blocked) {
      const err = new Error('O Vagas.com bloqueou as buscas automáticas (verificação anti-robô).');
      err.blocked = true;
      throw err;
    }
    if (!byId.size && errors.length) throw new Error(errors[0]);

    const jobs = [...byId.values()];
    // só abre as que parecem de dev (a busca é frouxa e traz muita vaga de outra área)
    const missing = jobs.filter((j) => !cache[j.sourceId] && isDevJob(j.title)).slice(0, MAX_DETAILS);
    let n = 0;
    // o site devolve 429 se abrir muitas vagas seguidas: uma por vez e, no primeiro 429, para
    let limited = false;
    await pool(missing, 1, async (j) => {
      if (limited) return;
      try {
        const d = parseDetail(await fetchText(j.url, { retries: 0 }));
        if (d) cache[j.sourceId] = d;
      } catch (e) {
        if (e.status === 429) limited = true;
        /* fica com o trecho do card; tenta de novo na próxima atualização */
      }
      progress(`descrições ${++n}/${missing.length}`);
      await sleep(800);
    });
    return jobs.map((j) => ({ ...j, ...(cache[j.sourceId] || {}) }));
  },
};
