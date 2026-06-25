import { computeReportWeight } from '../config.js';
import {
  applyReputationOnReport,
  getUserStatsByFingerprint,
  upsertUserByFingerprint,
} from './reputation.js';

export { getUserStatsByFingerprint };

export async function resolveReportWeight(options: {
  fingerprint: string;
}): Promise<{ weight: number; userId: number; fingerprint: string }> {
  const user = await upsertUserByFingerprint(options.fingerprint);
  return {
    weight: computeReportWeight(user.reputation_score),
    userId: user.id,
    fingerprint: options.fingerprint,
  };
}

export async function finalizeReportReputation(
  userId: number,
  stationId: number,
  fuelTypeId: number,
  status: string,
  fingerprint: string
): Promise<number> {
  return applyReputationOnReport(userId, stationId, fuelTypeId, status, fingerprint);
}
