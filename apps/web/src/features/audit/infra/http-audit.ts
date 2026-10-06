import type { z } from 'zod';
import {
  auditPageSchema,
  authorizedAuditQuerySchema,
} from '@erp/contracts/audit-api';
import type { AuditEntry } from '@erp/contracts/audit';
import { ApiRequestError } from '../../../shared/api-client';
import type { ApiClient } from '../../../shared/api-client';
import { apiQuery, allApiPages } from '../../../shared/api-query';

export class HttpAudit {
  constructor(private readonly api: ApiClient) {}
  query(input: z.input<typeof authorizedAuditQuerySchema>) {
    return this.api.request(
      apiQuery('/audit-entries', authorizedAuditQuerySchema.parse(input)),
      auditPageSchema,
    );
  }
  readonly list = async (familyId?: string): Promise<AuditEntry[]> => {
    const entries = await allApiPages(
      this.api,
      '/audit-entries',
      auditPageSchema,
      { entityType: 'Family', entityId: familyId },
    );
    return entries.map((entry) => {
      if (entry.entityType !== 'Family')
        throw new ApiRequestError('INVALID_RESPONSE', 200);
      return {
        id: entry.id,
        entityId: entry.entityId,
        entityLabel: entry.after.referenceName ?? `Família ${entry.after.code}`,
        action: entry.action,
        actorId: entry.actorId ?? '',
        actorName: entry.actor?.displayName ?? 'Sistema',
        recordedAt: entry.recordedAt,
        occurredAt: entry.occurredAt,
        reason: entry.reason,
        readCapability: 'registration.read',
        before: entry.before,
        after: entry.after,
      };
    });
  };
}
