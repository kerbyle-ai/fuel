import type { FastifyInstance } from 'fastify';
import { FINGERPRINT_HEADER } from '../config.js';
import { getUserStatsByFingerprint } from '../services/users.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/users/me/stats', async (request, reply) => {
    const raw =
      request.headers[FINGERPRINT_HEADER] ?? request.headers['x-fingerprint'];
    if (typeof raw !== 'string' || raw.length < 8) {
      return reply.status(400).send({
        error: `${FINGERPRINT_HEADER} header required`,
      });
    }

    const stats = await getUserStatsByFingerprint(raw.slice(0, 64));
    return { stats };
  });
}
