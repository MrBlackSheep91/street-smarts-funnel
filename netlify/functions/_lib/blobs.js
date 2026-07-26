// Helpers compartidos por las Netlify Functions de street-smarts-funnel.
// Persistencia: Netlify Blobs (nativo, sin servicio externo). Un blob por lead/view,
// keyeado por contacto normalizado (dedup) o UUID (views).
import { getStore } from '@netlify/blobs';

export function leadsStore() {
  return getStore('street-smarts-leads');
}

export function viewsStore() {
  return getStore('street-smarts-views');
}

// contacto = email O WhatsApp. Normaliza para dedup (mismo criterio que server.mjs original).
export function normContacto(v) {
  const s = String(v || '').trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return s;
  const digits = s.replace(/[^\d]/g, '');
  if (digits.length >= 6 && digits.length <= 20) return digits;
  return '';
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

export function checkToken(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  return Boolean(process.env.ADMIN_TOKEN) && token === process.env.ADMIN_TOKEN;
}

// Lee todos los blobs bajo un prefijo, paginando por cursor.
export async function listAll(store, prefix) {
  const out = [];
  let cursor;
  do {
    const res = await store.list({ prefix, cursor });
    for (const b of res.blobs) {
      const v = await store.get(b.key, { type: 'json' });
      if (v) out.push(v);
    }
    cursor = res.cursor;
  } while (cursor);
  return out;
}

// Cuenta blobs bajo un prefijo sin traer el contenido (más liviano que listAll).
export async function countAll(store, prefix) {
  let total = 0;
  let cursor;
  do {
    const res = await store.list({ prefix, cursor });
    total += res.blobs.length;
    cursor = res.cursor;
  } while (cursor);
  return total;
}
