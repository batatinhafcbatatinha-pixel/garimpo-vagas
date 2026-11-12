// Orquestra a atualização: roda todas as fontes em paralelo, classifica, deduplica e salva.
const fs = require('fs');
const path = require('path');
const { enrich, norm } = require('./classify');
const { enrichConcurso } = require('./concursos');

const DATA_DIR = path.join(__dirname, '..', 'data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const CACHE_FILE = path.join(DATA_DIR, 'cache.json');

const SOURCES = [
  ...['gupy', 'linkedin', 'infojobs', 'glassdoor', 'indeed'].map((n) => require(`../sources/${n}`)),
  ...['pci', 'poa', 'cieers', 'ciee'].map((n) => require(`../sources/concursos/${n}`)),
];
const isConcurso = (src) => src.kind === 'concursos';

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

const emptySources = () =>
  SOURCES.map((s) => ({ id: s.id, name: s.name, kind: s.kind || 'vagas', status: 'nunca', count: 0, message: '', manualLinks: s.manualLinks || [] }));

function loadData() {
  const d = readJson(JOBS_FILE, null);
  if (!d) return { updatedAt: null, sources: emptySources(), jobs: [], concursos: [] };
  // dados salvos por uma versão anterior podem não ter as fontes de concursos
  const known = new Map((d.sources || []).map((s) => [s.id, s]));
  d.sources = emptySources().map((s) => ({ ...s, ...(known.get(s.id) || {}), kind: s.kind }));
  d.concursos = d.concursos || [];
  return d;
}

let state = { running: false, sources: emptySources() };
const getStatus = () => state;

async function refresh() {
  if (state.running) return state;
  const previous = loadData();
  const cache = readJson(CACHE_FILE, {});
  // firstSeen sobrevive entre atualizações para marcar o que é novo
  const firstSeen = new Map([...previous.jobs, ...previous.concursos].map((j) => [j.id, j.firstSeen]));
  const prevBySource = new Map();
  for (const j of [...previous.jobs, ...previous.concursos]) (prevBySource.get(j.source) || prevBySource.set(j.source, []).get(j.source)).push(j);

  state = { running: true, sources: emptySources().map((s) => ({ ...s, status: 'buscando' })) };
  const now = new Date().toISOString();

  const perSource = await Promise.all(
    SOURCES.map(async (src, i) => {
      const st = state.sources[i];
      try {
        cache[src.id] ||= {};
        const raw = await src.fetchJobs((msg) => (st.message = msg), cache[src.id]);
        const seen = new Set();
        const jobs = raw.filter((j) => j.sourceId && !seen.has(j.sourceId) && seen.add(j.sourceId));
        st.status = 'ok';
        st.count = jobs.length;
        st.message = '';
        return jobs;
      } catch (e) {
        st.status = e.blocked ? 'bloqueado' : 'erro';
        st.message = e.blocked ? e.message : `Falhou: ${e.message}`;
        // em caso de falha, mantém o que já tínhamos desta fonte
        const kept = prevBySource.get(src.id) || [];
        st.count = kept.length;
        if (kept.length) st.message += ' Mantidas as vagas da atualização anterior.';
        return kept;
      }
    })
  );

  // deduplica a mesma vaga publicada em mais de um site (mesmo título + empresa)
  const order = { gupy: 0, infojobs: 1, linkedin: 2, glassdoor: 3, indeed: 4 };
  const byKey = new Map();
  const concursos = perSource
    .filter((_, i) => isConcurso(SOURCES[i]))
    .flat()
    .map((c) => (c.id ? c : enrichConcurso({ ...c, id: `${c.source}:${c.sourceId}` })))
    // reavalia o prazo (itens mantidos de uma atualização anterior podem ter vencido) e remove os encerrados
    .map((c) => enrichConcurso({ ...c, situacao: c.inscricaoAte ? undefined : c.situacao }))
    .filter((c) => c.situacao !== 'encerrada')
    .map((c) => ({ ...c, firstSeen: firstSeen.get(c.id) || now }));

  const all = perSource
    .filter((_, i) => !isConcurso(SOURCES[i]))
    .flat()
    .map((j) => (j.id ? j : enrich({ ...j, id: `${j.source}:${j.sourceId}` })))
    .sort((a, b) => order[a.source] - order[b.source]);
  for (const j of all) {
    const key = `${norm(j.title).replace(/[^a-z0-9]+/g, ' ').trim()}|${norm(j.company).replace(/[^a-z0-9]+/g, ' ').trim()}`;
    const dup = byKey.get(key);
    if (dup) {
      dup.alsoOn = [...new Set([...(dup.alsoOn || []), j.source])].filter((s) => s !== dup.source);
      // aproveita dados melhores da duplicata
      if (!dup.salary.informado && j.salary.informado) dup.salary = j.salary;
      if (dup.edu.resumo === 'nao-menciona' && j.edu.resumo !== 'nao-menciona') dup.edu = j.edu;
      continue;
    }
    byKey.set(key, { ...j, firstSeen: firstSeen.get(j.id) || now });
  }

  const data = { updatedAt: now, previousUpdate: previous.updatedAt, sources: state.sources, jobs: [...byKey.values()], concursos };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(JOBS_FILE, JSON.stringify(data));
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  state = { running: false, sources: state.sources };
  return state;
}

module.exports = { refresh, getStatus, loadData };
