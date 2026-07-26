// POST /api/lead → crea un lead (dedup por contacto normalizado). GET /api/lead?token= → lista (admin).
import { leadsStore, normContacto, json, checkToken, listAll } from './_lib/blobs.js';

export const config = { path: '/api/lead' };

export default async (req) => {
  const store = leadsStore();
  if (req.method === 'POST') return handleCreate(req, store);
  if (req.method === 'GET') return handleList(req, store);
  return json({ error: 'method not allowed' }, 405);
};

async function handleCreate(req, store) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const { name = '', email = '', donde = '', como = '', opera = '', hace_cuanto = '', costando = '', src = '', referrer = '' } = body || {};
  const key = normContacto(email);
  if (!key) return json({ error: 'contacto inválido (email o WhatsApp)' }, 400);

  const existing = await store.get(`lead:${key}`, { type: 'json' });
  if (existing) return json({ ok: true, dup: true }); // no rebota al usuario

  await store.setJSON(`lead:${key}`, {
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
    user_agent: String(req.headers.get('user-agent') || '').slice(0, 300),
    ip: req.headers.get('x-nf-client-connection-ip') || '',
  });
  return json({ ok: true });
}

async function handleList(req, store) {
  if (!checkToken(req)) return json({ error: 'forbidden' }, 403);
  const rows = await listAll(store, 'lead:');
  return json({ count: rows.length, rows });
}
