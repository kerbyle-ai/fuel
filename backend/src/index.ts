import Fastify from 'fastify';
import cors from '@fastify/cors';
import { closePool } from './db.js';
import { configRoutes } from './routes/config.js';
import { stationRoutes } from './routes/stations.js';
import { reportRoutes } from './routes/reports.js';
import { userRoutes } from './routes/users.js';

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? '0.0.0.0';

const app = Fastify({ logger: true, trustProxy: true });

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : true;

await app.register(cors, { origin: allowedOrigins });
await configRoutes(app);
await stationRoutes(app);
await reportRoutes(app);
await userRoutes(app);

app.get('/health', async () => ({ status: 'ok' }));
app.get('/api/health', async () => ({ status: 'ok' }));

async function shutdown() {
  await app.close();
  await closePool();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ port, host });
  console.log(`Fuel Map API listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
