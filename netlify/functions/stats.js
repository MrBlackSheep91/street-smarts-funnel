// GET /api/stats?token=ADMIN_TOKEN → agregados: views/leads totales, conversión global,
// conversión por src (qué episodio/link convierte más), distribución de respuestas por pregunta.
import { leadsStore, viewsStore, checkToken, listAll, json } from './_lib/blobs.js';

export const config = { path: '/api/stats' };

const QUESTIONS = ['donde', 'como', 'opera', 'hace_cuanto'];

export default async (req) => {
  if (!checkToken(req)) return json({ error: 'forbidden' }, 403);
  const leads = await listAll(leadsStore(), 'lead:');
  const views = await listAll(viewsStore(), 'view:');
  return json(buildStats(leads, views));
};

function buildStats(leads, views) {
  const bySrc = {};
  const touch = (src) => (bySrc[src] ||= { src, views: 0, leads: 0, conversion: 0 });
  for (const v of views) touch(v.src || '(directo)').views++;
  for (const l of leads) touch(l.src || '(directo)').leads++;
  for (const s of Object.values(bySrc)) {
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
