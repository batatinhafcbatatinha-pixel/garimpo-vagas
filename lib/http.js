// Helpers de rede e de texto compartilhados pelas fontes.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status}`);
    this.status = status;
    this.url = url;
  }
}

// Busca uma página como texto. Repete em 429/5xx com espera crescente.
async function fetchText(url, { retries = 2, timeout = 25000, headers = {} } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': UA,
          'accept-language': 'pt-BR,pt;q=0.9,en;q=0.6',
          accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          ...headers,
        },
        signal: AbortSignal.timeout(timeout),
        redirect: 'follow',
      });
      if (res.ok) return await res.text();
      lastErr = new HttpError(res.status, url);
      if (res.status !== 429 && res.status < 500) break; // 403/404: não adianta repetir
    } catch (e) {
      lastErr = e;
    }
    if (attempt < retries) await sleep(1500 * (attempt + 1) ** 2);
  }
  throw lastErr;
}

// Alguns sites (Glassdoor) recusam o cliente HTTP do Node mas aceitam o curl,
// que já vem instalado no Windows 10+. Mesma requisição, outro cliente.
// Com `json`, faz um POST com esse corpo (as APIs internas que o próprio site usa).
function curlText(url, { timeout = 40, json, headers = {} } = {}) {
  const { execFile } = require('child_process');
  const args = ['-s', '-L', '--compressed', '-m', String(timeout), '-A', UA, '-H', 'accept-language: pt-BR,pt;q=0.9'];
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  if (json !== undefined) args.push('-H', 'content-type: application/json', '--data-raw', JSON.stringify(json));
  args.push('-w', '\n%{http_code}', url);
  return new Promise((resolve, reject) => {
    execFile('curl', args, { maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
      if (err) return reject(new Error('curl falhou: ' + (err.code === 'ENOENT' ? 'curl não encontrado' : err.message.split('\n')[0])));
      const cut = stdout.lastIndexOf('\n');
      const status = Number(stdout.slice(cut + 1));
      if (status >= 200 && status < 300) resolve(stdout.slice(0, cut));
      else reject(new HttpError(status, url));
    });
  });
}

// Alguns sites (Indeed) só liberam a página para um navegador de verdade.
// Usa o Edge (vem no Windows) ou o Chrome em modo headless e devolve o HTML já renderizado.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0';

function findBrowser() {
  const fs = require('fs');
  const path = require('path');
  const roots = [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES, process.env.LOCALAPPDATA].filter(Boolean);
  const rel = ['Microsoft/Edge/Application/msedge.exe', 'Google/Chrome/Application/chrome.exe'];
  const unix = ['/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const candidates = [process.env.BROWSER_PATH, ...rel.flatMap((r) => roots.map((root) => path.join(root, r))), ...unix];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

// Cada navegador headless pesa bastante; com muitos ao mesmo tempo (Glassdoor + Indeed) eles
// ficam lentos e estouram o tempo. Por isso no máximo BROWSER_SLOTS abertos de uma vez.
const BROWSER_SLOTS = 2;
let browserBusy = 0;
const browserQueue = [];
async function withBrowserSlot(fn) {
  if (browserBusy >= BROWSER_SLOTS) await new Promise((r) => browserQueue.push(r));
  browserBusy++;
  try {
    return await fn();
  } finally {
    browserBusy--;
    const next = browserQueue.shift();
    if (next) next();
  }
}

// Repete uma vez se o navegador falhar ou estourar o tempo.
async function browserHtml(url, opts = {}) {
  try {
    return await withBrowserSlot(() => browserHtmlOnce(url, opts));
  } catch {
    await sleep(3000);
    return withBrowserSlot(() => browserHtmlOnce(url, opts));
  }
}

function browserHtmlOnce(url, { timeout = 120, waitMs = 15000 } = {}) {
  const exe = findBrowser();
  if (!exe) return Promise.reject(new Error('nenhum navegador (Edge/Chrome) encontrado'));
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { execFile } = require('child_process');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'garimpo-browser-'));
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled', `--user-agent=${BROWSER_UA}`, '--lang=pt-BR',
    `--user-data-dir=${profile}`, `--virtual-time-budget=${waitMs}`,
    // no Linux (ex.: GitHub Actions) o Chrome não abre sem isso rodando em contêiner/sem /dev/shm grande
    ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
    '--dump-dom', url,
  ];
  return new Promise((resolve, reject) => {
    execFile(exe, args, { maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: timeout * 1000 }, (err, stdout) => {
      setTimeout(() => fs.rm(profile, { recursive: true, force: true }, () => {}), 2000);
      if (err && !stdout) {
        const why = err.killed ? `demorou mais de ${timeout} s` : err.code != null ? `saiu com código ${err.code}` : err.message.split('\n')[0].slice(0, 120);
        return reject(new Error(`navegador (${path.basename(exe)}) falhou: ${why}`));
      }
      resolve(stdout);
    });
  });
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª', deg: '°', ndash: '–', mdash: '—', hellip: '…',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', laquo: '«', raquo: '»', bull: '•', middot: '·', euro: '€', copy: '©', reg: '®', szlig: 'ß',
};
// letras acentuadas: &ccedil; &atilde; &Eacute; ... viram letra + acento combinado
const ACCENTS = { acute: '́', grave: '̀', circ: '̂', tilde: '̃', uml: '̈', cedil: '̧' };

function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => {
      if (ENTITIES[n] ?? ENTITIES[n.toLowerCase()]) return ENTITIES[n] ?? ENTITIES[n.toLowerCase()];
      const a = /^([a-z])(acute|grave|circ|tilde|uml|cedil)$/i.exec(n);
      return a ? (a[1] + ACCENTS[a[2].toLowerCase()]).normalize('NFC') : m;
    });
}

// HTML -> texto simples, preservando quebras de bloco como espaço/linha.
function htmlToText(html) {
  return decodeEntities(
    String(html ?? '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

// Executa tarefas com limite de concorrência.
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await worker(items[i], i);
      }
    })
  );
  return out;
}

module.exports = { fetchText, curlText, browserHtml, findBrowser, htmlToText, decodeEntities, sleep, pool, HttpError, UA };
