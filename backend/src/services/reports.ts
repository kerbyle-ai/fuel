import type { QueueStatus, ReportStatus } from '../config.js';
import { query } from '../db.js';
import { finalizeReportReputation, resolveReportWeight } from './users.js';

export interface CreateReportInput {
  station_id: number;
  fuel_type: string;
  status: ReportStatus;
  queue_status?: QueueStatus;
  limit_liters?: number | null;
  price?: number | null;
  comment?: string | null;
  fingerprint: string;
}

export async function createReport(input: CreateReportInput) {
  const { rows: fuelRows } = await query<{ id: number }>(
    'SELECT id FROM fuel_types WHERE code = $1',
    [input.fuel_type]
  );
  if (fuelRows.length === 0) {
    throw new Error('Unknown fuel_type code');
  }

  const { weight, userId } = await resolveReportWeight({
    fingerprint: input.fingerprint,
  });

  const queueStatus = input.queue_status ?? 'unknown';

  const { rows } = await query<{
    id: number;
    created_at: Date;
    weight: string;
  }>(
    `INSERT INTO reports (
       station_id, fuel_type_id, status, price, queue_status,
       limit_liters, comment, user_fingerprint, user_id, weight
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, created_at, weight::text`,
    [
      input.station_id,
      fuelRows[0].id,
      input.status,
      input.price ?? null,
      queueStatus,
      input.limit_liters ?? null,
      input.comment ?? null,
      input.fingerprint,
      userId,
      weight,
    ]
  );

  const newReputation = await finalizeReportReputation(
    userId,
    input.station_id,
    fuelRows[0].id,
    input.status,
    input.fingerprint
  );

  return {
    id: rows[0].id,
    station_id: input.station_id,
    fuel_type: input.fuel_type,
    status: input.status,
    price: input.price ?? null,
    queue_status: queueStatus,
    limit_liters: input.limit_liters ?? null,
    comment: input.comment ?? null,
    weight: Number(rows[0].weight),
    reputation: newReputation,
    stale: false,
    created_at: rows[0].created_at.toISOString(),
  };
}
