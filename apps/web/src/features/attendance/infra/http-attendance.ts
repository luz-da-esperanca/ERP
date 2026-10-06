import { z } from 'zod';
import * as contracts from '@erp/contracts/attendance-api';
import { attendanceAuditEntrySchema } from '@erp/contracts/audit-api';
import { paginationSchema } from '@erp/contracts/access-api';
import type { ApiClient } from '../../../shared/api-client';

export type SessionStatus = contracts.SessionDto['status'];
export type SessionHistoryEntity = 'ActivitySession' | 'Attendance';

export class HttpAttendance {
  constructor(private readonly api: ApiClient) {}

  private async read<T>(path: string, schema: z.ZodType<T>) {
    return (await this.api.request(path, z.object({ data: schema }))).data;
  }
  context(
    activityId: string,
    occurredAt: string,
    guestPersonIds: string[] = [],
    sessionId?: string,
  ) {
    const query = contracts.attendanceContextQuerySchema.parse({
      occurredAt,
      guestPersonIds,
      sessionId,
    });
    const params = new URLSearchParams({ occurredAt: query.occurredAt });
    if (query.sessionId) params.set('sessionId', query.sessionId);
    if (query.guestPersonIds.length)
      params.set('guestPersonIds', query.guestPersonIds.join(','));
    return this.read(
      `/activities/${z.uuid().parse(activityId)}/attendance-context?${params}`,
      contracts.attendanceContextSchema,
    );
  }
  sessions(
    activityId: string,
    page = 1,
    filters: {
      from?: string;
      toExclusive?: string;
      status?: SessionStatus;
    } = {},
  ) {
    const query = contracts.sessionsQuerySchema.parse({
      ...filters,
      page,
      pageSize: 20,
    });
    const params = new URLSearchParams(
      Object.entries(query).map(([key, value]) => [key, String(value)]),
    );
    return this.api.request(
      `/activities/${z.uuid().parse(activityId)}/sessions?${params}`,
      contracts.sessionsPageSchema,
    );
  }
  detail(sessionId: string) {
    return this.read(
      `/sessions/${z.uuid().parse(sessionId)}`,
      contracts.sessionDetailSchema,
    );
  }
  private write(
    path: string,
    method: 'POST' | 'PUT',
    body: unknown,
    key: string,
  ) {
    return this.api
      .request(path, z.object({ data: contracts.sessionResultSchema }), {
        method,
        body,
        idempotencyKey: key,
      })
      .then((result) => result.data);
  }
  create(activityId: string, input: contracts.CreateSessionInput, key: string) {
    return this.write(
      `/activities/${z.uuid().parse(activityId)}/sessions`,
      'POST',
      contracts.createSessionSchema.parse(input),
      key,
    );
  }
  correct(
    sessionId: string,
    input: contracts.UpdateAttendanceInput,
    key: string,
  ) {
    return this.write(
      `/sessions/${z.uuid().parse(sessionId)}/attendance`,
      'PUT',
      contracts.updateAttendanceSchema.parse(input),
      key,
    );
  }
  cancel(sessionId: string, revision: number, reason: string, key: string) {
    return this.write(
      `/sessions/${z.uuid().parse(sessionId)}/cancellation`,
      'POST',
      contracts.cancellationSchema.parse({
        expectedSessionRevision: revision,
        reason,
      }),
      key,
    );
  }
  frequency(
    personId: string,
    input: z.input<typeof contracts.frequencyQuerySchema>,
  ) {
    const query = contracts.frequencyQuerySchema.parse(input);
    const params = new URLSearchParams(Object.entries(query));
    return this.read(
      `/people/${z.uuid().parse(personId)}/frequency?${params}`,
      contracts.frequencyResultSchema,
    );
  }
  coverage(
    activityId: string,
    periodStart: string,
    periodEndExclusive: string,
  ) {
    const params = new URLSearchParams(
      contracts.periodQuerySchema.parse({ periodStart, periodEndExclusive }),
    );
    return this.read(
      `/activities/${z.uuid().parse(activityId)}/coverage?${params}`,
      contracts.coverageViewSchema,
    );
  }
  history(entityType: SessionHistoryEntity, entityId: string, page = 1) {
    const params = new URLSearchParams({
      entityType,
      entityId: z.uuid().parse(entityId),
      page: String(page),
      pageSize: '20',
    });
    return this.api.request(
      `/audit-entries?${params}`,
      z.object({
        data: z.array(attendanceAuditEntrySchema),
        pagination: paginationSchema.extend({
          total: z.number().int().nonnegative(),
        }),
      }),
    );
  }
}
