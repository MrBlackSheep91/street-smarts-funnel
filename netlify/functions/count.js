// GET /api/count → total de leads capturados (prueba social real, público, sin token).
import { leadsStore, countAll, json } from './_lib/blobs.js';

export const config = { path: '/api/count' };

export default async (req) => {
  const count = await countAll(leadsStore(), 'lead:');
  return json({ count });
};
