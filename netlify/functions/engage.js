// POST /api/engage {vid, src, seconds, scroll, cta} → registra engagement de un page-view.
// Un blob por visita (keyed por vid, generado client-side): re-envíos del beacon sobreescriben
// con la foto más reciente (seconds/scroll solo crecen). Base para medir REBOTE:
// bounce = view sin blob de engagement (o con seconds < umbral).
import { viewsStore, json } from './_lib/blobs.js';

export const config = { path: '/api/engage' };

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let body = {};
  try { body = await req.json(); } catch { return json({ error: 'bad body' }, 400); }
  const vid = String(body.vid || '').slice(0, 40);
  if (!/^[a-f0-9-]{10,40}$/.test(vid)) return json({ error: 'bad vid' }, 400);

  await viewsStore().setJSON(`eng:${vid}`, {
    ts: new Date().toISOString(),
    src: String(body.src || '').slice(0, 80).trim(),
    seconds: Math.min(Math.max(Number(body.seconds) || 0, 0), 3600),
    scroll: Math.min(Math.max(Number(body.scroll) || 0, 0), 100),
    cta: Boolean(body.cta),
  });
  return json({ ok: true });
};
