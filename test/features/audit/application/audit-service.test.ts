import { describe, expect, it, vi } from 'vitest';
import { AuditService } from '../../../../src/features/audit/application/audit-service.js';
import type {
  AuditReader,
  AuditQueryInput,
} from '../../../../src/features/audit/application/audit-reader.js';
import { PermissionDeniedError } from '../../../../src/features/access/domain/account-errors.js';
import { ResourceNotFoundError } from '../../../../src/core/application/errors.js';
import { createAccessServiceFixture } from '../../../support/access-service-fixture.js';

function fixture() {
  const { principal } = createAccessServiceFixture();
  const page = { data: [], pagination: { page: 1, pageSize: 20, total: 0 } };
  const reader = {
    list: vi.fn<AuditReader['list']>().mockResolvedValue(page),
    get: vi.fn<AuditReader['get']>().mockResolvedValue(null),
  } satisfies AuditReader;
  const input: AuditQueryInput = {
    entityType: 'UserAccount',
    page: 1,
    pageSize: 20,
  };
  return { service: new AuditService(reader), reader, principal, page, input };
}

describe('AuditService account history', () => {
  it('allows an administrator to list authorized account history', async () => {
    const { service, principal, input, page } = fixture();
    await expect(service.list(principal, input)).resolves.toEqual(page);
  });

  it('denies account history listing to social assistance before consulting persistence', async () => {
    const { service, principal, reader, input } = fixture();
    principal.user.roleCodes = ['SOCIAL_ASSISTANCE'];
    await expect(service.list(principal, input)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    expect(reader.list).not.toHaveBeenCalled();
  });

  it('hides account audit identifiers outside the allowed scope', async () => {
    const { service, principal, reader } = fixture();
    principal.user.roleCodes = ['ACTIVITY_MANAGER'];
    await expect(
      service.get(principal, 'restricted-entry'),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(reader.get).not.toHaveBeenCalled();
  });

  it('reports a nonexistent entry within an authorized account scope', async () => {
    const { service, principal } = fixture();
    await expect(
      service.get(principal, 'missing-entry'),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('requires the initial password change before listing history', async () => {
    const { service, principal, reader, input } = fixture();
    principal.user.mustChangePassword = true;
    await expect(service.list(principal, input)).rejects.toMatchObject({
      rule: 'PASSWORD_CHANGE_REQUIRED',
    });
    expect(reader.list).not.toHaveBeenCalled();
  });
});
