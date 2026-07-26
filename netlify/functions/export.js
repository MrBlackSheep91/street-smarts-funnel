// GET /api/export?token=ADMIN_TOKEN → descarga CSV de leads (admin).
import { leadsStore, checkToken, listAll, json } from './_lib/blobs.js';

export const config = { path: '/api/export' };

const COLS = ['ts', 'name', 'email', 'donde', 'como', 'opera', 'hace_cuanto', 'costando', 'src', 'referrer', 'user_agent', 'ip'];
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default async (req) => {
  if (!checkToken(req)) return json({ error: 'forbidden' }, 403);
  const rows = await listAll(leadsStore(), 'lead:');
  const out = [COLS.join(','), ...rows.map((r) => COLS.map((c) => esc(r[c])).join(','))].join('\n');
  return new Response(out, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads-street-smarts.csv"',
    },
  });
};
