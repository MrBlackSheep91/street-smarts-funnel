// POST /api/view {src, referrer} → registra un page-view (base para medir conversión por src).
import { viewsStore, json } from './_lib/blobs.js';

export const config = { path: '/api/view' };

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let body = {};
  try { body = await req.json(); } catch { /* body vacío también es válido */ }
  const { src = '', referrer = '' } = body || {};

  const store = viewsStore();
  const id = crypto.randomUUID();
  await store.setJSON(`view:${id}`, {
    ts: new Date().toISOString(),
    src: String(src).slice(0, 80).trim(),
    referrer: String(referrer).slice(0, 300).trim(),
    user_agent: String(req.headers.get('user-agent') || '').slice(0, 300),
    ip: req.headers.get('x-nf-client-connection-ip') || '',
  });
  return json({ ok: true });
};
