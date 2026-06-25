import { query } from '../db.js';
import { computeReportWeight } from '../config.js';

export type RankLabel = 'Новичок' | 'Активист' | 'Эксперт';

const POINTS_PER_REPORT = 5;
const POINTS_FIRST_ON_STATION_24H = 10;
const POINTS_CONTRADICTED = -20;

export function getRankLabel(reputation: number, reportsCount: number): RankLabel {
  if (reputation >= 150 || reportsCount >= 30) return 'Эксперт';
  if (reputation >= 50 || reportsCount >= 5) return 'Активист';
  return 'Новичок';
}

export async function upsertUserByFingerprint(fingerprint: string): Promise<{
  id: number;
  reputation_score: number;
  reports_count: number;
}> {
  const { rows } = await query<{
    id: number;
    reputation_score: string;
    reports_count: number;
  }>(
    `INSERT INTO users (fingerprint, reputation_score, reports_count)
     VALUES ($1, 0, 0)
     ON CONFLICT (fingerprint) DO UPDATE SET fingerprint = EXCLUDED.fingerprint
     RETURNING id, reputation_score, reports_count`,
    [fingerprint]
  );
  return {
    id: rows[0].id,
    reputation_score: Number(rows[0].reputation_score),
    reports_count: rows[0].reports_count,
  };
}

export async function getUserStatsByFingerprint(fingerprint: string) {
  const { rows } = await query<{
    id: number;
    reputation_score: string;
    reports_count: number;
  }>(`SELECT id, reputation_score, reports_count FROM users WHERE fingerprint = $1`, [
    fingerprint,
  ]);

  if (rows.length === 0) {
    return {
      reports_count: 0,
      reputation: 0,
      rank: 'Новичок' as RankLabel,
      weight: computeReportWeight(0),
    };
  }

  const reputation = Number(rows[0].reputation_score);
  return {
    reports_count: rows[0].reports_count,
    reputation,
    rank: getRankLabel(reputation, rows[0].reports_count),
    weight: computeReportWeight(reputation),
  };
}

async function isFirstReportOnStationIn24h(stationId: number): Promise<boolean> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM reports
     WHERE station_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [stationId]
  );
  return parseInt(rows[0].count, 10) === 1;
}

async function applyContradictionPenalties(
  stationId: number,
  fuelTypeId: number,
  newStatus: string,
  excludeFingerprint: string
): Promise<void> {
  const opposite =
    newStatus === 'available'
      ? 'unavailable'
      : newStatus === 'unavailable'
        ? 'available'
        : null;

  if (!opposite) return;

  const { rows } = await query<{ user_id: number | null }>(
    `SELECT DISTINCT r.user_id
     FROM reports r
     WHERE r.station_id = $1
       AND r.fuel_type_id = $2
       AND r.status = $3
       AND r.created_at > NOW() - INTERVAL '1 hour'
       AND (r.user_fingerprint IS NULL OR r.user_fingerprint <> $4)
       AND r.user_id IS NOT NULL`,
    [stationId, fuelTypeId, opposite, excludeFingerprint]
  );

  for (const row of rows) {
    if (row.user_id) {
      await query(
        `UPDATE users SET reputation_score = GREATEST(0, reputation_score + $2) WHERE id = $1`,
        [row.user_id, POINTS_CONTRADICTED]
      );
    }
  }
}

export async function applyReputationOnReport(
  userId: number,
  stationId: number,
  fuelTypeId: number,
  status: string,
  fingerprint: string
): Promise<number> {
  let bonus = POINTS_PER_REPORT;

  if (await isFirstReportOnStationIn24h(stationId)) {
    bonus += POINTS_FIRST_ON_STATION_24H;
  }

  await applyContradictionPenalties(stationId, fuelTypeId, status, fingerprint);

  const { rows } = await query<{ reputation_score: string }>(
    `UPDATE users
     SET reputation_score = reputation_score + $2,
         reports_count = reports_count + 1
     WHERE id = $1
     RETURNING reputation_score`,
    [userId, bonus]
  );

  return Number(rows[0].reputation_score);
}
