import { describe, expect, it } from 'vitest';
import {
  catalogQuerySchema,
  createActivitySchema,
  updateProjectSchema,
  updateActivitySchema,
  createProjectSchema,
} from '../src/projects-api';

describe('Projects HTTP contracts', () => {
  it('parses false explicitly, rejects unknown fields and preserves omitted patch fields', () => {
    expect(catalogQuerySchema.parse({ active: 'false' })).toEqual({
      active: false,
      page: 1,
      pageSize: 20,
    });
    expect(catalogQuerySchema.safeParse({ active: 'yes' }).success).toBe(false);
    expect(
      updateProjectSchema.parse({ expectedRevision: 2, description: null }),
    ).toEqual({ expectedRevision: 2, description: null });
    expect(updateProjectSchema.safeParse({ expectedRevision: 2 }).success).toBe(
      false,
    );
    expect(
      createActivitySchema.safeParse({
        expectedProjectRevision: 1,
        name: 'Synthetic',
        nature: 'PERIODIC',
        recordedBy: 'spoofed',
      }).success,
    ).toBe(false);
  });
  it('does not erase type or responsible account when an activity patch only changes its name', () => {
    expect(
      updateActivitySchema.parse({
        expectedRevision: 2,
        name: 'Synthetic renamed',
      }),
    ).toEqual({ expectedRevision: 2, name: 'Synthetic renamed' });
  });
  it('normalizes whitespace-only optional text without accepting empty names', () => {
    expect(
      createProjectSchema.parse({
        name: 'Synthetic',
        instituteId: '00000000-0000-4000-8000-000000000001',
        description: '   ',
      }).description,
    ).toBeNull();
    expect(
      createActivitySchema.parse({
        expectedProjectRevision: 1,
        name: 'Synthetic',
        nature: 'PERIODIC',
        plannedSchedule: '   ',
      }).plannedSchedule,
    ).toBeNull();
    expect(
      createProjectSchema.safeParse({
        name: '   ',
        instituteId: '00000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(false);
  });
});
