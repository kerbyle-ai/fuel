import { query } from '../db.js';

const DEFAULT_MAX = 10;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

function getLimits() {
  return {
    max: Number(process.env.RATE_LIMIT_MAX ?? DEFAULT_MAX),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? DEFAULT_WINDOW_MS),
  };
}

export async function checkReportRateLimit(key: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const { max, windowMs } = getLimits();
  const now = new Date();

  const { rows } = await query<{
    report_count: number;
    window_start: Date;
  }>('SELECT report_count, window_start FROM rate_limits WHERE ip = $1', [key]);

  if (rows.length === 0) {
    await query(
      'INSERT INTO rate_limits (ip, report_count, window_start) VALUES ($1, 1, $2)',
      [key, now]
    );
    return {
      allowed: true,
      remaining: max - 1,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }

  const row = rows[0];
  const windowStart = new Date(row.window_start);
  const elapsed = now.getTime() - windowStart.getTime();

  if (elapsed >= windowMs) {
    await query(
      'UPDATE rate_limits SET report_count = 1, window_start = $2 WHERE ip = $1',
      [key, now]
    );
    return {
      allowed: true,
      remaining: max - 1,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }

  if (row.report_count >= max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(windowStart.getTime() + windowMs),
    };
  }

  await query('UPDATE rate_limits SET report_count = report_count + 1 WHERE ip = $1', [key]);

  return {
    allowed: true,
    remaining: max - row.report_count - 1,
    resetAt: new Date(windowStart.getTime() + windowMs),
  };
}

/** IP-based limit: max 10 reports/hour per IP */
export async function checkIpReportRateLimit(ip: string) {
  return checkReportRateLimit(`ip:${ip}`);
}

export async function hasDuplicateReport(
  stationId: number,
  fuelType: string,
  fingerprint: string
): Promise<boolean> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM reports r
     JOIN fuel_types ft ON ft.id = r.fuel_type_id
     WHERE r.station_id = $1
       AND ft.code = $2
       AND r.user_fingerprint = $3
       AND r.created_at > NOW() - INTERVAL '15 minutes'`,
    [stationId, fuelType, fingerprint]
  );
  return parseInt(rows[0].count, 10) > 0;
}

export function checkHoneypot(body: Record<string, unknown>): boolean {
  const honeypot = body.website ?? body._hp;
  return honeypot === undefined || honeypot === null || honeypot === '';
}
