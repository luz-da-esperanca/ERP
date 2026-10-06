export const id = '00000000-0000-4000-8000-000000000001';
export const personId = '00000000-0000-4000-8000-000000000002';
export const context = {
  activityId: id,
  projectId: id,
  occurredAt: '2026-01-02T12:00:00.000Z',
  expectedActivityRevision: 3,
  expectedProjectRevision: 1,
  session: null,
  rosterFingerprint: 'a'.repeat(64),
  rows: [
    {
      personId,
      name: 'Ana Sintética',
      expectedPersonRevision: 2,
      familyId: id,
      familyCode: 'FAM-1',
      expectedFamilyRevision: 3,
      membershipId: id,
      expectedMembershipRevision: 1,
      enrollmentIds: [id],
      attendance: null,
    },
    {
      personId: '00000000-0000-4000-8000-000000000003',
      name: 'Bruno Sintético',
      expectedPersonRevision: 1,
      familyId: null,
      familyCode: null,
      expectedFamilyRevision: null,
      membershipId: null,
      expectedMembershipRevision: null,
      enrollmentIds: [id],
      attendance: null,
    },
  ],
};
export const session = {
  id,
  activityId: id,
  responsibleId: id,
  occurredAt: context.occurredAt,
  recordedAt: '2026-01-03T12:00:00.000Z',
  recordedBy: id,
  status: 'COMPLETED' as const,
  revision: 1,
};
