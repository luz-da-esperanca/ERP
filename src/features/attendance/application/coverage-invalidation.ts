import type { AttendanceTransaction } from './attendance-ports.js';
import type { AttendanceCoverage } from '../domain/attendance.js';
import {
  changedIntervalPeriods,
  nextCivilDay,
} from '../domain/frequency-rules.js';
import { civilDateAt } from '../../projects/domain/activity-rules.js';
export function changedCivilPeriods(
  before: { validFrom: string; validUntil: string | null } | null,
  after: { validFrom: string; validUntil: string | null } | null,
  timeZone: string,
) {
  return changedIntervalPeriods(before, after).map((period) => ({
    from: civilDateAt(period.from, timeZone),
    toExclusive:
      period.toExclusive === null
        ? null
        : nextCivilDay(
            civilDateAt(
              new Date(Date.parse(period.toExclusive) - 1).toISOString(),
              timeZone,
            ),
          ),
  }));
}
export async function invalidateCoverage(
  tx: Pick<AttendanceTransaction, 'updateCoverage' | 'audit'>,
  declarations: readonly AttendanceCoverage[],
  periods: readonly { from: string | null; toExclusive: string | null }[],
  operationId: string,
  actorId: string,
  recordedAt: string,
  reason: string,
) {
  for (const before of declarations) {
    const additions = periods
      .map((period) => ({
        from:
          period.from === null || period.from < before.periodStart
            ? before.periodStart
            : period.from,
        toExclusive:
          period.toExclusive === null ||
          period.toExclusive > before.periodEndExclusive
            ? before.periodEndExclusive
            : period.toExclusive,
        recordedAt,
        recordedBy: actorId,
        reason,
      }))
      .filter((period) => period.from < period.toExclusive);
    if (!additions.length) continue;
    const after = await tx.updateCoverage(before.id, [
      ...before.invalidatedPeriods,
      ...additions,
    ]);
    await tx.audit(
      operationId,
      actorId,
      'AttendanceCoverage',
      before,
      after,
      'INVALIDATE',
      reason,
    );
  }
}
