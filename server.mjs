// Street Smarts Funnel — captura de leads del podcast/serie de YouTube. Cero dependencias (node >= 18).
// Reusa el patrón de ia-mapa-funnel/server.mjs (JSONL + dedup + admin export), + atribución/nutrición.
// POST /api/lead   {name, email, donde, como, opera, hace_cuanto, costando, src, referrer}
//                                                     → append a data/leads.jsonl (dedup por contacto normalizado)
// POST /api/view    {src, referrer}                  → append a data/views.jsonl (page-view, para medir conversión)
// GET  /api/lead?token=ADMIN_TOKEN                    → lista completa (admin, JSON)
// GET  /api/export?token=ADMIN_TOKEN                  → CSV para descargar
// GET  /api/count                                     → total capturados (prueba social real, opcional)
// GET  /api/stats?token=ADMIN_TOKEN                    → agregados por src, por respuesta, conversión views→leads
// Static: sirve ./public (la landing + /gracias)
import { createServer } from 'node:http';
import { readFileSync, appendFileSync, existsSync, mkdirSync, createReadStream, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ROOT = new URL('.', import.meta.url).pathname;
const DATA_DIR = join(ROOT, 'data');
const LEADS = join(DATA_DIR, 'leads.jsonl');
const VIEWS = join(DATA_DIR, 'views.jsonl');
mkdirSync(DATA_DIR, { recursive: true });

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const QUESTIONS = ['donde', 'como', 'opera', 'hace_cuanto'];

// contacto = email O WhatsApp. Normaliza para dedup.
function normContacto(v) {
  const s = String(v).trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return s;            // email
  const digits = s.replace(/[^\d]/g, '');
  if (digits.length >= 6 && digits.length <= 20) return digits;   // teléfono/WhatsApp
  return '';
}

function readJsonl(file) {
  return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
}

function seenLeads() {
  return new Set(readJsonl(LEADS).map(l => l.key).filter(Boolean));
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function csv(res, list) {
  const cols = ['ts', 'name', 'email', 'donde', 'como', 'opera', 'hace_cuanto', 'costando', 'src', 'referrer', 'user_agent', 'ip'];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const out = [cols.join(','), ...list.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="leads-street-smarts.csv"' });
  res.end(out);
}

function buildStats() {
  const leads = readJsonl(LEADS);
  const views = readJsonl(VIEWS);

  const bySrc = {};
  const touchSrc = (src) => (bySrc[src] ||= { src, views: 0, leads: 0, conversion: 0 });
  for (const v of views) { const src = v.src || '(directo)'; touchSrc(src).views++; }
  for (const l of leads) { const src = l.src || '(directo)'; touchSrc(src).leads++; }
  for (const k of Object.keys(bySrc)) {
    const s = bySrc[k];
    s.conversion = s.views > 0 ? Number(((s.leads / s.views) * 100).toFixed(1)) : null;
  }

  const byQuestion = {};
  for (const q of QUESTIONS) {
    const counts = {};
    for (const l of leads) {
      const v = l[q] || '(sin responder)';
      counts[v] = (counts[v] || 0) + 1;
    }
    byQuestion[q] = counts;
  }

  return {
    totalViews: views.length,
    totalLeads: leads.length,
    conversion: views.length > 0 ? Number(((leads.length / views.length) * 100).toFixed(1)) : null,
    bySrc: Object.values(bySrc).sort((a, b) => b.leads - a.leads),
    byQuestion,
  };
}

createServer((req, res) => {
  const url = new URL(req.url, `http://x`);

  if (req.method === 'POST' && url.pathname === '/api/lead') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10_000) req.destroy(); });
    req.on('end', () => {
      try {
        const { name = '', email = '', donde = '', como = '', opera = '', hace_cuanto = '', costando = '', src = '', referrer = '' } = JSON.parse(body);
        const key = normContacto(email);
        if (!key) return json(res, 400, { error: 'contacto inválido (email o WhatsApp)' });
        if (seenLeads().has(key)) return json(res, 200, { ok: true, dup: true }); // no rebota al usuario
        appendFileSync(LEADS, JSON.stringify({
          ts: new Date().toISOString(),
          key,
          name: String(name).slice(0, 80).trim(),
          email: String(email).slice(0, 120).trim(),
          donde: String(donde).slice(0, 40).trim(),
          como: String(como).slice(0, 40).trim(),
          opera: String(opera).slice(0, 40).trim(),
          hace_cuanto: String(hace_cuanto).slice(0, 40).trim(),
          costando: String(costando).slice(0, 300).trim(),
          src: String(src).slice(0, 80).trim(),
          referrer: String(referrer).slice(0, 300).trim(),
          user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
          ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        }) + '\n');
        return json(res, 200, { ok: true });
      } catch { return json(res, 400, { error: 'bad request' }); }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/view') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2_000) req.destroy(); });
    req.on('end', () => {
      try {
        const { src = '', referrer = '' } = body ? JSON.parse(body) : {};
        appendFileSync(VIEWS, JSON.stringify({
          ts: new Date().toISOString(),
          src: String(src).slice(0, 80).trim(),
          referrer: String(referrer).slice(0, 300).trim(),
          user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
          ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        }) + '\n');
        return json(res, 200, { ok: true });
      } catch { return json(res, 400, { error: 'bad request' }); }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/count') {
    return json(res, 200, { count: seenLeads().size });
  }

  if (req.method === 'GET' && url.pathname === '/api/stats') {
    if (!ADMIN_TOKEN || url.searchParams.get('token') !== ADMIN_TOKEN) return json(res, 403, { error: 'forbidden' });
    return json(res, 200, buildStats());
  }

  if (req.method === 'GET' && (url.pathname === '/api/lead' || url.pathname === '/api/export')) {
    if (!ADMIN_TOKEN || url.searchParams.get('token') !== ADMIN_TOKEN) return json(res, 403, { error: 'forbidden' });
    const list = readJsonl(LEADS);
    if (url.pathname === '/api/export') return csv(res, list);
    return json(res, 200, { count: list.length, rows: list });
  }

  // static (la landing + /gracias)
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (p === '/gracias') p = '/gracias.html';
  p = normalize(p).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, 'public', p);
  if (existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=300' });
    return createReadStream(file).pipe(res);
  }
  res.writeHead(404); res.end('404');
}).listen(PORT, () => console.log(`street-smarts-funnel up :${PORT}`));
