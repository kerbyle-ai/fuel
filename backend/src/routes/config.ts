import type { FastifyInstance } from 'fastify';
import { FUEL_TYPES, MAP_DEFAULTS, STALE_HOURS } from '../config.js';
import { query } from '../db.js';

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/config', async () => {
    const { rows } = await query<{ id: number; code: string; name: string }>(
      'SELECT id, code, name FROM fuel_types ORDER BY id'
    );

    return {
      fuel_types: rows.length > 0 ? rows.map(({ code, name }) => ({ code, name })) : FUEL_TYPES,
      map: MAP_DEFAULTS,
      stale_hours: STALE_HOURS,
      report_statuses: ['available', 'unavailable', 'unknown'],
      queue_statuses: ['none', 'short', 'long', 'unknown'],
    };
  });
}
