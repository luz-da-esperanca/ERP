import { describe, expect, it } from 'vitest';
import {
  attendanceConflicts,
  fieldDifferences,
  intervalConflicts,
  resolveAttendances,
  resolveIntervals,
  selectFields,
} from '../../../../src/features/registration/domain/identity-merge-rules.js';
import type { IntervalRow } from '../../../../src/features/registration/domain/identity-merge.js';

const month = (value: number) =>
  `2026-${String(value).padStart(2, '0')}-01T03:00:00.000Z`;
const row = (
  id: string,
  group: string,
  from: number,
  until: number | null,
): IntervalRow => ({
  id,
  group,
  validFrom: month(from),
  validUntil: until === null ? null : month(until),
});

describe('Merge field reconciliation', () => {
  const keys = ['name', 'cpf', 'rg', 'sex'] as const;
  const source = {
    name: 'Synthetic A',
    cpf: '11111111111',
    rg: '10',
    sex: null,
  };
  const target = {
    name: 'Synthetic B',
    cpf: '11111111111',
    rg: null,
    sex: null,
  };
  it('separates divergent values from values only the source knows', () => {
    expect(fieldDifferences(source, target, keys)).toEqual({
      conflicts: [
        { field: 'name', source: 'Synthetic A', target: 'Synthetic B' },
      ],
      adopted: ['rg'],
    });
  });
  it('applies an explicit choice per divergent field and complements unknown values', () => {
    expect(selectFields(source, target, keys, { name: 'SOURCE' })).toEqual({
      name: 'Synthetic A',
      rg: '10',
    });
    expect(selectFields(source, target, keys, { name: 'TARGET' })).toEqual({
      rg: '10',
    });
  });
  it.each([[{}], [{ name: 'SOURCE', cpf: 'SOURCE' }]] as const)(
    'never selects automatically nor accepts a choice without divergence: %j',
    (selections) => {
      expect(() => selectFields(source, target, keys, selections)).toThrow(
        expect.objectContaining({ rule: 'MERGE_RESOLUTION_REQUIRED' }),
      );
    },
  );
});

describe('Merge interval reconciliation', () => {
  it('reports overlaps across families for memberships and only inside an activity for enrollments', () => {
    const source = [row('s1', 'A', 3, 6), row('s2', 'B', 8, null)];
    const target = [row('t1', 'A', 1, 4), row('t2', 'C', 9, 10)];
    expect(intervalConflicts(source, target, false)).toEqual([
      { ids: ['s1', 't1'], sameGroup: true },
      { ids: ['s2', 't2'], sameGroup: false },
    ]);
    expect(intervalConflicts(source, target, true)).toEqual([
      { ids: ['s1', 't1'], sameGroup: true },
    ]);
  });
  it('keeps exclusive stretches when partially overlapping intervals of one group are joined', () => {
    const rows = [row('t1', 'A', 1, 4), row('s1', 'A', 3, 6)];
    const resolved = resolveIntervals(
      rows,
      [
        { id: 't1', action: 'KEEP', validFrom: month(1), validUntil: month(6) },
        { id: 's1', action: 'SUPERSEDE', supersededById: 't1' },
      ],
      false,
    );
    expect(resolved).toEqual([
      {
        ...rows[0],
        validUntil: month(6),
        supersededById: null,
        changed: true,
      },
      { ...rows[1], supersededById: 't1', changed: true },
    ]);
  });
  it('refuses full supersession that would drop a stretch only the discarded interval covers', () => {
    expect(() =>
      resolveIntervals(
        [row('t1', 'A', 1, 4), row('s1', 'A', 3, 6)],
        [{ id: 's1', action: 'SUPERSEDE', supersededById: 't1' }],
        false,
      ),
    ).toThrow(expect.objectContaining({ rule: 'MERGE_RESOLUTION_INVALID' }));
  });
  it('requires a resolution while effective intervals still overlap', () => {
    expect(() =>
      resolveIntervals([row('t1', 'A', 1, 4), row('s1', 'B', 3, 6)], [], false),
    ).toThrow(
      expect.objectContaining({
        rule: 'MERGE_RESOLUTION_REQUIRED',
        ids: ['s1', 't1'],
      }),
    );
  });
  it('lets different families split an overlap but never take a stretch that was exclusive to the other', () => {
    const rows = [row('t1', 'A', 1, 4), row('s1', 'B', 3, 6)];
    const keep = (id: string, from: number, until: number) => ({
      id,
      action: 'KEEP' as const,
      validFrom: month(from),
      validUntil: month(until),
    });
    expect(
      resolveIntervals(rows, [keep('t1', 1, 3)], false).map((item) => [
        item.id,
        item.validFrom,
        item.validUntil,
      ]),
    ).toEqual([
      ['t1', month(1), month(3)],
      ['s1', month(3), month(6)],
    ]);
    for (const plan of [
      [keep('t1', 1, 5), keep('s1', 5, 6)],
      [keep('t1', 1, 3), keep('s1', 4, 6)],
      [{ id: 's1', action: 'SUPERSEDE' as const, supersededById: 't1' }],
    ])
      expect(() => resolveIntervals(rows, plan, false)).toThrow(
        expect.objectContaining({ rule: 'MERGE_RESOLUTION_INVALID' }),
      );
  });
  it('rejects resolutions for unknown rows, repeated rows or chained supersession', () => {
    const rows = [row('t1', 'A', 1, 4), row('s1', 'A', 1, 4)];
    for (const plan of [
      [{ id: 'x', action: 'SUPERSEDE' as const, supersededById: 't1' }],
      [
        { id: 's1', action: 'SUPERSEDE' as const, supersededById: 't1' },
        { id: 's1', action: 'SUPERSEDE' as const, supersededById: 't1' },
      ],
      [
        { id: 's1', action: 'SUPERSEDE' as const, supersededById: 't1' },
        { id: 't1', action: 'SUPERSEDE' as const, supersededById: 's1' },
      ],
    ])
      expect(() => resolveIntervals(rows, plan, false)).toThrow(
        expect.objectContaining({ rule: 'MERGE_RESOLUTION_INVALID' }),
      );
  });
  it('leaves rows untouched when nothing overlaps', () => {
    const rows = [row('t1', 'A', 1, 3), row('s1', 'B', 3, null)];
    expect(resolveIntervals(rows, [], false)).toEqual(
      rows.map((item) => ({ ...item, supersededById: null, changed: false })),
    );
  });
});

describe('Merge attendance reconciliation', () => {
  const mark = (
    id: string,
    sessionId: string,
    status: 'PRESENT' | 'ABSENT',
  ) => ({
    id,
    sessionId,
    status,
  });
  const conflicts = attendanceConflicts(
    [mark('s1', 'session-1', 'PRESENT'), mark('s2', 'session-2', 'ABSENT')],
    [mark('t1', 'session-1', 'ABSENT'), mark('t3', 'session-3', 'PRESENT')],
  );
  it('finds two markings of the merged person in the same session', () => {
    expect(conflicts).toEqual([
      {
        sessionId: 'session-1',
        attendanceIds: ['s1', 't1'],
        statusesDiffer: true,
      },
    ]);
  });
  it('keeps the chosen marking effective and supersedes the other', () => {
    expect(
      resolveAttendances(conflicts, [
        {
          sessionId: 'session-1',
          effectiveAttendanceId: 's1',
          reason: 'Synthetic paper list',
        },
      ]),
    ).toEqual([{ supersededId: 't1', effectiveId: 's1' }]);
  });
  it.each([
    [[]],
    [[{ sessionId: 'session-1', effectiveAttendanceId: 's1' }]],
    [[{ sessionId: 'session-1', effectiveAttendanceId: 's2', reason: 'x' }]],
    [[{ sessionId: 'session-9', effectiveAttendanceId: 's1', reason: 'x' }]],
  ] as const)(
    'requires an explicit choice with reason for divergent statuses: %j',
    (resolutions) => {
      expect(() => resolveAttendances(conflicts, resolutions)).toThrow(
        expect.objectContaining({ rule: 'MERGE_RESOLUTION_REQUIRED' }),
      );
    },
  );
  it('accepts a choice without reason when both markings agree', () => {
    const same = attendanceConflicts(
      [mark('s1', 'session-1', 'PRESENT')],
      [mark('t1', 'session-1', 'PRESENT')],
    );
    expect(
      resolveAttendances(same, [
        { sessionId: 'session-1', effectiveAttendanceId: 't1' },
      ]),
    ).toEqual([{ supersededId: 's1', effectiveId: 't1' }]);
  });
});
