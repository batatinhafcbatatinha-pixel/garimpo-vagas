// Servidor local: entrega o site e expõe a API de vagas. Sem dependências externas.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { refresh, getStatus, loadData } = require('./lib/refresh');

const PORT = Number(process.env.PORT) || 4321;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/jobs' && req.method === 'GET') return json(res, 200, loadData());
  if (url.pathname === '/api/status' && req.method === 'GET') return json(res, 200, getStatus());
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

server.listen(PORT, '127.0.0.1', () => console.log(`Vagas Dev rodando em http://localhost:${PORT}`));
