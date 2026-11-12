// Servidor local: entrega o site e expõe a API de vagas. Sem dependências externas.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { refresh, getStatus, loadData } = require('./lib/refresh');
const applied = require('./lib/applied').createStore();

// lê um corpo JSON pequeno (o servidor fica aberto na rede local, então limita o tamanho)
const readBody = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 4096) { resolve(null); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });

// endereços deste computador na rede local, para abrir o site no celular ou na TV
const lanUrls = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.'))
    .map((n) => `http://${n.address}:${PORT}`);

const PORT = Number(process.env.PORT) || 4321;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/jobs' && req.method === 'GET') return json(res, 200, { ...loadData(), applied: applied.load() });
  if (url.pathname === '/api/applied' && req.method === 'POST') {
    return readBody(req).then((body) => {
      if (!body || typeof body.id !== 'string' || !body.id || body.id.length > 300) return json(res, 400, { error: 'pedido inválido' });
      const map = applied.set(body.id, body.applied !== false, loadData());
      return map ? json(res, 200, { applied: map }) : json(res, 404, { error: 'vaga não encontrada' });
    });
  }
  if (url.pathname === '/api/status' && req.method === 'GET') return json(res, 200, getStatus());
  if (url.pathname === '/api/info' && req.method === 'GET') return json(res, 200, { urls: lanUrls() });
  if (url.pathname === '/api/refresh' && req.method === 'POST') {
    // dispara em segundo plano; o site acompanha por /api/status
    if (!getStatus().running) refresh().catch((e) => console.error('Falha na atualização:', e));
    return json(res, 202, { started: true });
  }
  if (req.method !== 'GET') return json(res, 405, { error: 'método não permitido' });

  const file = path.join(PUBLIC, path.normalize(url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(PUBLIC)) return json(res, 403, { error: 'proibido' });
  fs.readFile(file, (err, buf) => {
    if (err) return json(res, 404, { error: 'não encontrado' });
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  });
});

// escuta em toda a rede local para o celular e a TV conseguirem abrir
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Garimpo rodando em http://localhost:${PORT}`);
  for (const u of lanUrls()) console.log(`No celular ou na TV (mesma rede): ${u}`);
});
