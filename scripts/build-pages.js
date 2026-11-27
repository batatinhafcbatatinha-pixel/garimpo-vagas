// Gera o site estático do GitHub Pages: atualiza as vagas e monta a pasta site/ com o conteúdo
// de public/ + jobs.json (vagas e concursos) + cache.json (descrições já baixadas).
// Usado pelo workflow .github/workflows/pages.yml, uma vez por dia.
//
// Variáveis de ambiente:
//   PREV_URL        endereço do site já publicado. De lá vêm as vagas e o cache da última vez,
//                   para marcar o que é novo e não baixar de novo as descrições.
//   LINKEDIN_LI_AT  (opcional, segredo do repositório) cookie li_at do LinkedIn, para saber o
//                   modelo de trabalho das vagas. Sem ele o LinkedIn é buscado sem login.
//   SITE_DIR        pasta de saída (padrão: site/)
//
// Candidaturas e vagas escondidas NUNCA entram no site: no modo publicado elas ficam no
// navegador de cada pessoa (localStorage).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');

// O que vai para o jobs.json publicado: o índice, sem nada pessoal, com a marca de modo publicado.
function staticData(data) {
  const rest = { ...data };
  delete rest.applied;
  delete rest.hidden;
  return { ...rest, hosted: true };
}

// Monta a pasta do site. Só entram os arquivos de public/ e os dois JSON gerados aqui.
function buildSite(outDir, { publicDir = PUBLIC_DIR, data, cache }) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.cpSync(publicDir, outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'jobs.json'), JSON.stringify(staticData(data)));
  fs.writeFileSync(path.join(outDir, 'cache.json'), JSON.stringify(cache || {}));
}

// Baixa um JSON do site publicado; null se não existe ainda (primeira vez) ou veio estragado.
async function fetchPrev(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.log(`Sem ${url} (${e.message}); começando do zero.`);
    return null;
  }
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const prevUrl = (process.env.PREV_URL || '').replace(/\/+$/, '');
  const jobsFile = path.join(DATA_DIR, 'jobs.json');
  const cacheFile = path.join(DATA_DIR, 'cache.json');
  if (prevUrl && !fs.existsSync(jobsFile)) {
    const prev = await fetchPrev(`${prevUrl}/jobs.json`);
    if (prev && Array.isArray(prev.jobs)) {
      fs.writeFileSync(jobsFile, JSON.stringify(staticData(prev)));
      console.log(`Vagas anteriores: ${prev.jobs.length} vagas, ${(prev.concursos || []).length} concursos.`);
    }
    const cache = await fetchPrev(`${prevUrl}/cache.json`);
    if (cache && typeof cache === 'object' && !Array.isArray(cache)) fs.writeFileSync(cacheFile, JSON.stringify(cache));
  }

  if (process.env.LINKEDIN_LI_AT) {
    try {
      require('../lib/linkedin-auth').setCookie(process.env.LINKEDIN_LI_AT);
      console.log('LinkedIn: usando o login do segredo LINKEDIN_LI_AT.');
    } catch (e) {
      console.log(`LinkedIn: segredo LINKEDIN_LI_AT ignorado (${e.message}).`);
    }
  } else {
    console.log('LinkedIn: sem o segredo LINKEDIN_LI_AT, buscando sem login.');
  }

  const { refresh, getStatus, loadData } = require('../lib/refresh');
  const timer = setInterval(() => {
    console.log(getStatus().sources.filter((s) => s.status === 'buscando').map((s) => `${s.name}: ${s.message}`).join(' | '));
  }, 30000);
  const st = await refresh();
  clearInterval(timer);
  for (const s of st.sources) console.log(`${s.name.padEnd(14)} ${s.status.padEnd(10)} ${String(s.count).padStart(5)}  ${s.message}`);

  const data = loadData();
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch {}
  const outDir = path.resolve(ROOT, process.env.SITE_DIR || 'site');
  buildSite(outDir, { data, cache });
  console.log(`Site em ${outDir}: ${data.jobs.length} vagas, ${data.concursos.length} concursos.`);
  // todas as fontes falharam e não havia nada de antes: melhor não publicar um site vazio
  if (!data.jobs.length && !data.concursos.length) {
    console.error('Nenhuma vaga nem concurso; o site não será publicado.');
    process.exitCode = 1;
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { staticData, buildSite };
