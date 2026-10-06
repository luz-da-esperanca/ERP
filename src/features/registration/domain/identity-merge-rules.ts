import {
  RegistrationConflictError,
  RegistrationRuleError,
} from './registration-errors.js';
import type {
  AttendanceConflict,
  AttendanceResolution,
  FieldChoice,
  FieldConflict,
  IntervalConflict,
  IntervalResolution,
  IntervalRow,
  ResolvedInterval,
} from './identity-merge.js';

type Fields = Record<string, string | null>;

/** A value informed only by the source complements the target; divergence needs a choice. */
export function fieldDifferences<K extends string>(
  source: Record<K, string | null>,
  target: Record<K, string | null>,
  keys: readonly K[],
) {
  const conflicts: FieldConflict[] = [];
  const adopted: K[] = [];
  for (const field of keys) {
    const sourceValue = source[field];
    const targetValue = target[field];
    if (sourceValue === null || sourceValue === targetValue) continue;
    if (targetValue === null) adopted.push(field);
    else conflicts.push({ field, source: sourceValue, target: targetValue });
  }
  return { conflicts, adopted };
}

export function selectFields<K extends string>(
  source: Record<K, string | null>,
  target: Record<K, string | null>,
  keys: readonly K[],
  selections: Readonly<Record<string, FieldChoice>>,
): Partial<Record<K, string>> {
  const { conflicts, adopted } = fieldDifferences(source, target, keys);
  const expected = conflicts.map((row) => row.field).sort();
  const chosen = Object.keys(selections).sort();
  if (expected.join() !== chosen.join())
    throw new RegistrationConflictError('MERGE_RESOLUTION_REQUIRED', expected);
  const changes: Fields = {};
  for (const field of adopted) changes[field] = source[field];
  for (const { field, source: value } of conflicts)
    if (selections[field] === 'SOURCE') changes[field] = value;
  return changes as Partial<Record<K, string>>;
}

const start = (row: { validFrom: string }) => Date.parse(row.validFrom);
const end = (row: { validUntil: string | null }) =>
  row.validUntil === null ? Infinity : Date.parse(row.validUntil);
const overlap = (first: IntervalRow, second: IntervalRow) =>
  start(first) < end(second) && start(second) < end(first);
const pair = (first: string, second: string): [string, string] =>
  first < second ? [first, second] : [second, first];

export function intervalConflicts(
  source: readonly IntervalRow[],
  target: readonly IntervalRow[],
  sameGroupOnly: boolean,
): IntervalConflict[] {
  const conflicts: IntervalConflict[] = [];
  for (const first of source)
    for (const second of target) {
      const sameGroup = first.group === second.group;
      if (overlap(first, second) && (sameGroup || !sameGroupOnly))
        conflicts.push({ ids: pair(first.id, second.id), sameGroup });
    }
  return conflicts.sort((a, b) => a.ids.join().localeCompare(b.ids.join()));
}

function union(rows: readonly IntervalRow[]) {
  const segments: [number, number][] = [];
  for (const row of [...rows].sort((a, b) => start(a) - start(b))) {
    const last = segments.at(-1);
    if (last && start(row) <= last[1]) last[1] = Math.max(last[1], end(row));
    else segments.push([start(row), end(row)]);
  }
  return segments;
}
const within = (inner: [number, number][], outer: [number, number][]) =>
  inner.every(([from, to]) =>
    outer.some(([low, high]) => low <= from && to <= high),
  );

/**
 * Applies explicit interval resolutions. Duplicated stretches may be merged or
 * superseded, but no stretch a group covered alone may disappear or move.
 */
export function resolveIntervals(
  rows: readonly IntervalRow[],
  resolutions: readonly IntervalResolution[],
  sameGroupOnly: boolean,
): ResolvedInterval[] {
  const invalid = () => new RegistrationRuleError('MERGE_RESOLUTION_INVALID');
  const ids = resolutions.map((row) => row.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !rows.some((row) => row.id === id))
  )
    throw invalid();
  const resolved = rows.map((row): ResolvedInterval => {
    const resolution = resolutions.find((item) => item.id === row.id);
    if (!resolution) return { ...row, supersededById: null, changed: false };
    if (resolution.action === 'SUPERSEDE')
      return {
        ...row,
        supersededById: resolution.supersededById,
        changed: true,
      };
    return {
      ...row,
      validFrom: resolution.validFrom,
      validUntil: resolution.validUntil,
      supersededById: null,
      changed:
        resolution.validFrom !== row.validFrom ||
        resolution.validUntil !== row.validUntil,
    };
  });
  const effective = resolved.filter((row) => row.supersededById === null);
  if (effective.some((row) => start(row) >= end(row))) throw invalid();
  for (const row of resolved) {
    if (row.supersededById === null) continue;
    const keeper = effective.find((item) => item.id === row.supersededById);
    // Only a redundant interval of the same group can be discarded as a duplicate.
    if (
      !keeper ||
      keeper.group !== row.group ||
      start(keeper) > start(row) ||
      end(keeper) < end(row)
    )
      throw invalid();
  }
  for (const [index, first] of effective.entries())
    for (const second of effective.slice(index + 1))
      if (
        overlap(first, second) &&
        (first.group === second.group || !sameGroupOnly)
      )
        throw new RegistrationConflictError(
          'MERGE_RESOLUTION_REQUIRED',
          pair(first.id, second.id),
        );
  const groups = [...new Set(rows.map((row) => row.group))];
  const of = (list: readonly IntervalRow[], group: string) =>
    list.filter((row) => row.group === group);
  const preserved = (before: IntervalRow[], after: IntervalRow[]) =>
    within(union(before), union(after)) && within(union(after), union(before));
  if (
    groups.some(
      (group) => !within(union(of(effective, group)), union(of(rows, group))),
    ) ||
    (sameGroupOnly
      ? groups.some(
          (group) => !preserved(of(rows, group), of(effective, group)),
        )
      : !preserved([...rows], effective))
  )
    throw invalid();
  return resolved;
}

export function attendanceConflicts(
  source: readonly { id: string; sessionId: string; status: string }[],
  target: readonly { id: string; sessionId: string; status: string }[],
): AttendanceConflict[] {
  return source
    .flatMap((first) => {
      const second = target.find((row) => row.sessionId === first.sessionId);
      return second
        ? [
            {
              sessionId: first.sessionId,
              attendanceIds: pair(first.id, second.id),
              statusesDiffer: first.status !== second.status,
            },
          ]
        : [];
    })
    .sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}

/** One marking stays effective per session; the other is preserved as superseded. */
export function resolveAttendances(
  conflicts: readonly AttendanceConflict[],
  resolutions: readonly AttendanceResolution[],
) {
  const required = () =>
    new RegistrationConflictError(
      'MERGE_RESOLUTION_REQUIRED',
      conflicts.flatMap((row) => row.attendanceIds),
    );
  if (
    resolutions.length !== conflicts.length ||
    resolutions.some(
      (row) => !conflicts.some((item) => item.sessionId === row.sessionId),
    )
  )
    throw required();
  return conflicts.map((conflict) => {
    const resolution = resolutions.find(
      (row) => row.sessionId === conflict.sessionId,
    );
    if (
      !resolution ||
      !conflict.attendanceIds.includes(resolution.effectiveAttendanceId) ||
      (conflict.statusesDiffer && !resolution.reason)
    )
      throw required();
    return {
      supersededId: conflict.attendanceIds.find(
        (id) => id !== resolution.effectiveAttendanceId,
      )!,
      effectiveId: resolution.effectiveAttendanceId,
    };
  });
}
