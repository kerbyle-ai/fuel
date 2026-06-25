import type { FastifyInstance } from 'fastify';
import type { QueueStatus, ReportStatus } from '../config.js';
import { FINGERPRINT_HEADER, getClientFingerprint } from '../config.js';
import { query } from '../db.js';
import {
  checkHoneypot,
  checkIpReportRateLimit,
  checkReportRateLimit,
  hasDuplicateReport,
} from '../services/rateLimit.js';
import { createReport } from '../services/reports.js';

const VALID_STATUSES = new Set<ReportStatus>(['available', 'unavailable', 'unknown']);
const VALID_QUEUE = new Set<QueueStatus>(['none', 'short', 'long', 'unknown']);

interface CreateReportBody {
  station_id: number;
  fuel_type: string;
  status: ReportStatus;
  queue_status?: QueueStatus;
  limit_liters?: number | null;
  price?: number | null;
  comment?: string | null;
  user_id?: number | null;
  website?: unknown;
  _hp?: unknown;
}

function resolveFingerprint(
  request: { ip: string; headers: Record<string, string | string[] | undefined> }
): string {
  const headerFp =
    request.headers[FINGERPRINT_HEADER] ?? request.headers['x-fingerprint'];
  if (typeof headerFp === 'string' && headerFp.length > 0) {
    return headerFp.slice(0, 64);
  }
  return getClientFingerprint(request.ip, String(request.headers['user-agent'] ?? ''));
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateReportBody }>('/api/reports', async (request, reply) => {
    const body = request.body ?? ({} as CreateReportBody);
    const {
      station_id,
      fuel_type,
      status,
      queue_status = 'unknown',
      limit_liters = null,
      price = null,
      comment = null,
    } = body;

    if (!checkHoneypot(body as unknown as Record<string, unknown>)) {
      return reply.status(400).send({ error: 'Invalid submission' });
    }

    if (!station_id || !Number.isInteger(station_id) || station_id <= 0) {
      return reply.status(400).send({ error: 'station_id is required' });
    }
    if (!fuel_type || typeof fuel_type !== 'string') {
      return reply.status(400).send({ error: 'fuel_type is required' });
    }
    if (!status || !VALID_STATUSES.has(status)) {
      return reply.status(400).send({
        error: 'status must be available, unavailable, or unknown',
      });
    }
    if (!VALID_QUEUE.has(queue_status)) {
      return reply.status(400).send({
        error: 'queue_status must be none, short, long, or unknown',
      });
    }
    if (limit_liters !== null && limit_liters !== undefined) {
      if (!Number.isInteger(limit_liters) || limit_liters < 0) {
        return reply.status(400).send({ error: 'limit_liters must be a positive integer' });
      }
    }
    if (price !== null && price !== undefined) {
      if (!Number.isFinite(price) || price < 0) {
        return reply.status(400).send({ error: 'price must be a non-negative number' });
      }
    }

    const fingerprint = resolveFingerprint(request);

    const ipRate = await checkIpReportRateLimit(request.ip);
    reply.header('X-RateLimit-Remaining', String(ipRate.remaining));
    reply.header('X-RateLimit-Reset', ipRate.resetAt.toISOString());

    if (!ipRate.allowed) {
      return reply.status(429).send({
        error: 'Too many reports. Please try again later.',
        reset_at: ipRate.resetAt.toISOString(),
      });
    }

    const fpRate = await checkReportRateLimit(`fp:${fingerprint}`);
    if (!fpRate.allowed) {
      return reply.status(429).send({
        error: 'Too many reports from this device. Please try again later.',
        reset_at: fpRate.resetAt.toISOString(),
      });
    }

    if (await hasDuplicateReport(station_id, fuel_type, fingerprint)) {
      return reply.status(409).send({
        error: 'Duplicate report',
        message: 'You already reported this station and fuel type recently',
      });
    }

    const { rows: stationRows } = await query<{ id: number }>(
      'SELECT id FROM stations WHERE id = $1',
      [station_id]
    );
    if (stationRows.length === 0) {
      return reply.status(404).send({ error: 'Station not found' });
    }

    try {
      const report = await createReport({
        station_id,
        fuel_type,
        status,
        queue_status,
        limit_liters,
        price,
        comment,
        fingerprint,
      });
      return reply.status(201).send({ report });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create report';
      return reply.status(400).send({ error: message });
    }
  });
}
