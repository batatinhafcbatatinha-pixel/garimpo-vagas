// Login opcional no LinkedIn. Sem login, a página pública da vaga não diz se ela é presencial,
// remota ou híbrida (o filtro "remoto" da busca é frouxo). Com o cookie de sessão (li_at) da
// própria pessoa, a API interna que o site usa devolve o modelo de trabalho de cada vaga.
// O cookie fica só em data/linkedin.json, neste computador, e nunca é devolvido pela API do Garimpo.
const fs = require('fs');
const path = require('path');
const { UA, sleep } = require('./http');

const FILE = path.join(__dirname, '..', 'data', 'linkedin.json');
const MODES = { 1: 'onsite', 2: 'remote', 3: 'hybrid' }; // urn:li:fs_workplaceType:N

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return d && typeof d.liAt === 'string' && d.liAt ? d : null;
  } catch {
    return null;
  }
}

function save(d) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  if (d) fs.writeFileSync(FILE, JSON.stringify(d));
  else fs.rmSync(FILE, { force: true });
}

// o que o site pode saber (sem o cookie)
function publicStatus() {
  const d = load();
  return d ? { connected: true, status: d.status || 'novo', checkedAt: d.checkedAt || null } : { connected: false };
}

// aceita o valor puro ou "li_at=valor" colado do navegador
function setCookie(raw) {
  const v = String(raw ?? '').trim().replace(/^li_at=/, '').replace(/^"|"$/g, '').replace(/;.*$/, '');
  if (!v) return save(null), publicStatus();
  if (!/^[\w\-.~%+/=]{20,1000}$/.test(v)) throw new Error('Isso não parece um cookie li_at válido.');
  save({ liAt: v, status: 'novo' });
  return publicStatus();
}

class SessionExpired extends Error {}

function client(liAt) {
  // o LinkedIn só confere se o csrf-token bate com o JSESSIONID; qualquer valor serve
  const jsession = 'ajax:' + String(Math.random()).slice(2, 12) + String(Date.now()).slice(-9);
  return async function workMode(id) {
    const res = await fetch(`https://www.linkedin.com/voyager/api/jobs/jobPostings/${encodeURIComponent(id)}`, {
      headers: {
        'user-agent': UA,
        accept: 'application/json',
        'accept-language': 'pt-BR,pt;q=0.9',
        'csrf-token': jsession,
        'x-restli-protocol-version': '2.0.0',
        cookie: `li_at=${liAt}; JSESSIONID="${jsession}"`,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 401 || res.status === 403 || (res.status >= 300 && res.status < 400)) throw new SessionExpired();
    if (res.status === 404) return null; // vaga saiu do ar
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    const m = body.match(/fs_workplaceType:(\d)/);
    if (m) return MODES[m[1]] || null;
    // sem tipo informado o LinkedIn mostra "Presencial" (e "remoto permitido" vira Remoto)
    const remote = body.match(/"workRemoteAllowed"\s*:\s*(true|false)/);
    return remote ? (remote[1] === 'true' ? 'remote' : 'onsite') : null;
  };
}

// Consulta o modelo de trabalho das vagas ainda não checadas, devagar para não chamar atenção.
// `cache` é o cache do LinkedIn (id -> detalhes); grava cache[id].workMode e cache[id].wmChecked.
async function fillWorkModes(ids, cache, progress, { max = 100 } = {}) {
  const d = load();
  if (!d) return;
  // wmChecked 2 = consulta que também entende "sem tipo" como presencial; as antigas sem resultado repetem
  const todo = ids.filter((id) => cache[id] && (!cache[id].wmChecked || (cache[id].wmChecked !== 2 && !cache[id].workMode))).slice(0, max);
  if (!todo.length) return;
  const workMode = client(d.liAt);
  let done = 0;
  let status = d.status;
  for (const id of todo) {
    try {
      const mode = await workMode(id);
      cache[id] = { ...cache[id], wmChecked: 2, ...(mode ? { workMode: mode } : {}) };
      status = 'ok';
    } catch (e) {
      if (e instanceof SessionExpired) {
        status = 'expirado';
        break;
      }
      // erro passageiro: tenta de novo na próxima atualização
    }
    progress(`modelo de trabalho ${++done}/${todo.length}`);
    await sleep(1200 + Math.random() * 1500);
  }
  save({ ...d, status, checkedAt: new Date().toISOString() });
}

module.exports = { publicStatus, setCookie, fillWorkModes, MODES };
