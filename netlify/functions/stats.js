// GET /api/stats?token=ADMIN_TOKEN → agregados: views/leads totales, conversión global,
// conversión por src (qué episodio/link convierte más), distribución de respuestas por pregunta.
import { leadsStore, viewsStore, checkToken, listAll, json } from './_lib/blobs.js';

export const config = { path: '/api/stats' };

const QUESTIONS = ['donde', 'como', 'opera', 'hace_cuanto'];

export default async (req) => {
  if (!checkToken(req)) return json({ error: 'forbidden' }, 403);
  const leads = await listAll(leadsStore(), 'lead:');
  const views = await listAll(viewsStore(), 'view:');
  const engs = await listAll(viewsStore(), 'eng:');
  return json(buildStats(leads, views, engs));
};

// Engagement = permaneció ≥10s O scrolleó ≥25% O tocó el CTA. Rebote = view sin engagement.
const isEngaged = (e) => e.seconds >= 10 || e.scroll >= 25 || e.cta;

function buildStats(leads, views, engs) {
  const bySrc = {};
  const touch = (src) => (bySrc[src] ||= { src, views: 0, engaged: 0, leads: 0, conversion: 0, bounceRate: null });
  for (const v of views) touch(v.src || '(directo)').views++;
  for (const e of engs) { if (isEngaged(e)) touch(e.src || '(directo)').engaged++; }
  for (const l of leads) touch(l.src || '(directo)').leads++;
  for (const s of Object.values(bySrc)) {
    s.conversion = s.views > 0 ? Number(((s.leads / s.views) * 100).toFixed(1)) : null;
    s.bounceRate = s.views > 0 ? Number((((s.views - Math.min(s.engaged, s.views)) / s.views) * 100).toFixed(1)) : null;
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

  const engagedTotal = engs.filter(isEngaged).length;
  const secs = engs.map((e) => e.seconds).filter((n) => n > 0);
  return {
    totalViews: views.length,
    totalEngaged: engagedTotal,
    bounceRate: views.length > 0 ? Number((((views.length - Math.min(engagedTotal, views.length)) / views.length) * 100).toFixed(1)) : null,
    avgSeconds: secs.length > 0 ? Number((secs.reduce((a, b) => a + b, 0) / secs.length).toFixed(1)) : null,
    ctaClicks: engs.filter((e) => e.cta).length,
    totalLeads: leads.length,
    conversion: views.length > 0 ? Number(((leads.length / views.length) * 100).toFixed(1)) : null,
    bySrc: Object.values(bySrc).sort((a, b) => b.leads - a.leads),
    byQuestion,
  };
}
