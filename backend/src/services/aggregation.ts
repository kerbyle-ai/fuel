import { STALE_HOURS, type QueueStatus, type ReportStatus } from '../config.js';
import type { AggregatedFuelStatus, ReportRow } from '../types.js';

const STALE_MS = STALE_HOURS * 60 * 60 * 1000;

function isStale(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() > STALE_MS;
}

function parsePrice(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function weightedStatusVote(
  reports: ReportRow[]
): { status: ReportStatus; weights: Record<ReportStatus, number> } {
  const weights: Record<ReportStatus, number> = {
    available: 0,
    unavailable: 0,
    unknown: 0,
  };

  for (const report of reports) {
    const w = Number(report.weight) || 1;
    weights[report.status] += w;
  }

  const status = (Object.entries(weights) as [ReportStatus, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  return { status, weights };
}

function weightedQueueStatus(reports: ReportRow[]): QueueStatus {
  const weights = new Map<QueueStatus, number>();
  for (const report of reports) {
    const w = Number(report.weight) || 1;
    weights.set(report.queue_status, (weights.get(report.queue_status) ?? 0) + w);
  }

  return [...weights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
}

function weightedAveragePrice(reports: ReportRow[]): number | null {
  let sum = 0;
  let weightSum = 0;

  for (const report of reports) {
    const price = parsePrice(report.price);
    if (price === null || report.status !== 'available') continue;
    const w = Number(report.weight) || 1;
    sum += price * w;
    weightSum += w;
  }

  if (weightSum === 0) return null;
  return Math.round((sum / weightSum) * 100) / 100;
}

function latestLimitLiters(reports: ReportRow[]): number | null {
  const sorted = [...reports].sort(
    (a, b) => b.created_at.getTime() - a.created_at.getTime()
  );
  return sorted[0]?.limit_liters ?? null;
}

export function aggregateFuelReports(
  fuelCode: string,
  fuelName: string,
  reports: ReportRow[]
): AggregatedFuelStatus {
  if (reports.length === 0) {
    return {
      fuel_type: fuelCode as AggregatedFuelStatus['fuel_type'],
      fuel_type_name: fuelName,
      status: 'unknown',
      price: null,
      queue_status: 'unknown',
      limit_liters: null,
      stale: true,
      report_count: 0,
      last_report_at: null,
    };
  }

  const sorted = [...reports].sort(
    (a, b) => b.created_at.getTime() - a.created_at.getTime()
  );
  const latest = sorted[0];
  const stale = isStale(latest.created_at);
  const { status } = weightedStatusVote(reports);

  return {
    fuel_type: fuelCode as AggregatedFuelStatus['fuel_type'],
    fuel_type_name: fuelName,
    status,
    price: weightedAveragePrice(reports),
    queue_status: weightedQueueStatus(reports),
    limit_liters: latestLimitLiters(reports),
    stale,
    report_count: reports.length,
    last_report_at: latest.created_at.toISOString(),
  };
}

export function groupReportsByFuelType(
  reports: ReportRow[]
): Map<string, { fuelName: string; reports: ReportRow[] }> {
  const groups = new Map<string, { fuelName: string; reports: ReportRow[] }>();

  for (const report of reports) {
    const existing = groups.get(report.fuel_code);
    if (existing) {
      existing.reports.push(report);
    } else {
      groups.set(report.fuel_code, {
        fuelName: report.fuel_name,
        reports: [report],
      });
    }
  }

  return groups;
}

export function reportToHistoryItem(report: ReportRow) {
  return {
    id: report.id,
    fuel_type: report.fuel_code as AggregatedFuelStatus['fuel_type'],
    fuel_type_name: report.fuel_name,
    status: report.status,
    price: parsePrice(report.price),
    queue_status: report.queue_status,
    limit_liters: report.limit_liters,
    comment: report.comment,
    stale: isStale(report.created_at),
    created_at: report.created_at.toISOString(),
  };
}

export function isReportStale(createdAt: Date): boolean {
  return isStale(createdAt);
}
