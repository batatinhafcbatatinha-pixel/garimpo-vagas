// Orquestra a atualização: roda todas as fontes em paralelo e, a cada fonte que termina, classifica, deduplica e salva.
const fs = require('fs');
const path = require('path');
const { VERSION, enrich, norm, isEnglishText, isPcdOnly, classifyLocation, classifyEducation, classifySalary } = require('./classify');
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
  const li = lazyLiCache();
  d.jobs = d.jobs.map((j) => upgradeJob(j, li));
  return d;
}

// Vagas salvas por uma versão anterior: calcula os campos novos a partir do que já foi salvo.
// `liCache`: função que devolve o cache do LinkedIn (só é lido se alguma vaga precisar).
function upgradeJob(j, liCache = () => ({})) {
  if (j.v === VERSION) return j;
  const out = { ...j, v: VERSION };
  const text = [j.title, j.description, (j.attributes || []).join('\n')].filter(Boolean).join('\n');
  if (!('isEnglish' in j)) {
    Object.assign(out, { isEnglish: isEnglishText(j.title, j.description), pcdOnly: isPcdOnly(j.title, j.description) });
    // Glassdoor/Indeed marcavam como remota tudo que vinha da busca "remoto"; agora a descrição manda
    if ((j.source === 'glassdoor' || j.source === 'indeed') && j.workMode === 'remote')
      Object.assign(out, classifyLocation(j.location, null, text, 'remote', true));
  }
  // v2: escolaridade e salário recalculados. Dado herdado de uma duplicata (outro site) é mantido.
  const edu = classifyEducation(text, j.educationText);
  if (edu.resumo !== 'nao-menciona' || !j.edu || j.edu.resumo === 'nao-menciona') out.edu = edu;
  if (!(j.salary?.fonte === 'campo' && !j.salaryText)) out.salary = classifySalary(text, j.salaryText, j.salaryEstimate);
  // v2: LinkedIn "remoto" só pelo texto ("possibilidade de home office") pode ser híbrido.
  // Se o modelo veio do login do LinkedIn, ele continua valendo.
  if (j.source === 'linkedin' && j.workMode === 'remote' && !j.workModeUnconfirmed && !liCache()[j.sourceId]?.workMode) {
    const loc = classifyLocation(j.location, null, text, 'remote');
    if (loc.workMode === 'hybrid') Object.assign(out, loc);
  }
  return out;
}

// cache do LinkedIn lido no máximo uma vez por carga
function lazyLiCache() {
  let c;
  return () => (c ||= readJson(CACHE_FILE, {}).linkedin || {});
}

// `version` sobe a cada fonte que termina: o site recarrega as vagas quando ela muda
let state = { running: false, version: 0, sources: emptySources() };
const getStatus = () => state;

// Junta as listas de cada fonte (na ordem de SOURCES) no índice: classifica, deduplica e marca firstSeen.
function build(perSource, firstSeen, now) {
  const concursos = perSource
    .filter((_, i) => isConcurso(SOURCES[i]))
    .flat()
    .map((c) => (c.id ? c : enrichConcurso({ ...c, id: `${c.source}:${c.sourceId}` })))
    // reavalia o prazo (itens mantidos de uma atualização anterior podem ter vencido) e remove os encerrados
    .map((c) => enrichConcurso({ ...c, situacao: c.inscricaoAte ? undefined : c.situacao }))
    .filter((c) => c.situacao !== 'encerrada')
    .map((c) => ({ ...c, firstSeen: firstSeen.get(c.id) || now }));

  // deduplica a mesma vaga publicada em mais de um site (mesmo título + empresa)
  const order = { gupy: 0, infojobs: 1, linkedin: 2, glassdoor: 3, indeed: 4 };
  const byKey = new Map();
  const li = lazyLiCache();
  const all = perSource
    .filter((_, i) => !isConcurso(SOURCES[i]))
    .flat()
    .map((j) => (j.id ? upgradeJob(j, li) : enrich({ ...j, id: `${j.source}:${j.sourceId}` })))
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
  return { jobs: [...byKey.values()], concursos };
}

// Parar no meio: cada fonte em andamento é abandonada (fica com as vagas anteriores) e o que
// já terminou é salvo. A fonte para de verdade na próxima vez que reporta progresso.
class Cancelled extends Error {}
let cancel = null;
function cancelRefresh() {
  if (!state.running || !cancel) return false;
  cancel.stop();
  state.cancelling = true;
  return true;
}

// `only`: ids das fontes a atualizar (vazio ou ausente = todas). As outras ficam como estavam.
async function refresh(only) {
  if (state.running) return state;
  const wanted = new Set((Array.isArray(only) ? only : []).filter((id) => SOURCES.some((s) => s.id === id)));
  const picked = (src) => !wanted.size || wanted.has(src.id);
  const previous = loadData();
  const cache = readJson(CACHE_FILE, {});
  // firstSeen sobrevive entre atualizações para marcar o que é novo
  const firstSeen = new Map([...previous.jobs, ...previous.concursos].map((j) => [j.id, j.firstSeen]));
  const prevBySource = new Map();
  for (const j of [...previous.jobs, ...previous.concursos]) (prevBySource.get(j.source) || prevBySource.set(j.source, []).get(j.source)).push(j);

  const prevStatus = new Map(previous.sources.map((s) => [s.id, s]));
  let stop;
  const stopped = new Promise((r) => (stop = r));
  cancel = { cancelled: false, stop: () => { cancel.cancelled = true; stop(); } };
  const token = cancel;
  state = {
    running: true,
    version: 0,
    sources: emptySources().map((s, i) => (picked(SOURCES[i]) ? { ...s, status: 'buscando' } : { ...s, ...(prevStatus.get(s.id) || {}), kind: s.kind })),
  };
  const now = new Date().toISOString();

  // enquanto uma fonte não termina (ou se não foi escolhida), vale o que já tínhamos dela
  const perSource = SOURCES.map((src) => prevBySource.get(src.id) || []);
  const done = SOURCES.map((src) => !picked(src));

  // Salva o índice com o que já chegou, sem esperar as outras fontes.
  const save = () => {
    // fonte ainda em andamento fica no arquivo com o status da atualização anterior
    const sources = state.sources.map((st, i) => (done[i] ? st : previous.sources[i]));
    const data = { updatedAt: now, previousUpdate: previous.updatedAt, sources, ...build(perSource, firstSeen, now) };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(JOBS_FILE, JSON.stringify(data));
    state.version++;
  };

  await Promise.all(
    SOURCES.map(async (src, i) => {
      const st = state.sources[i];
      if (!picked(src)) return;
      try {
        cache[src.id] ||= {};
        const progress = (msg) => {
          if (token.cancelled) throw new Cancelled();
          st.message = msg;
        };
        const raw = await Promise.race([
          src.fetchJobs(progress, cache[src.id]),
          stopped.then(() => { throw new Cancelled(); }),
        ]);
        const seen = new Set();
        const jobs = raw.filter((j) => j.sourceId && !seen.has(j.sourceId) && seen.add(j.sourceId));
        st.status = 'ok';
        st.count = jobs.length;
        st.message = '';
        perSource[i] = jobs;
      } catch (e) {
        if (e instanceof Cancelled || token.cancelled) {
          st.status = 'parado';
          st.message = 'Atualização interrompida.';
        } else {
          st.status = e.blocked ? 'bloqueado' : 'erro';
          st.message = e.blocked ? e.message : `Falhou: ${e.message}`;
        }
        // em caso de falha, mantém o que já tínhamos desta fonte
        st.count = perSource[i].length;
        if (perSource[i].length) st.message += ' Mantidas as vagas da atualização anterior.';
      }
      done[i] = true;
      // ao parar, todas as fontes pendentes caem aqui juntas: salva uma vez só, no fim
      if (!token.cancelled) save();
    })
  );

  if (token.cancelled || !state.version) save();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  state = { running: false, version: state.version, sources: state.sources };
  cancel = null;
  return state;
}

module.exports = { refresh, cancelRefresh, getStatus, loadData, build, SOURCES };
