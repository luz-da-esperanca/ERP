import { accountInputSchema } from '@erp/contracts/access';
import { reasonSchema, ApplicationError } from '@erp/contracts/common';
import type { DemoRuntime } from '../../../demo/runtime';
import { requireFound, requireRevision } from '../../../demo/runtime';
import { validateAccountChange } from '../domain/account-rules';
import type { AccessGateway } from '../application/access-gateway';
export function createDemoAccess(runtime: DemoRuntime): AccessGateway {
  return {
    session: () => runtime.session(),
    demoAccounts: () => runtime.demoAccounts(),
    enterDemo: (id) => runtime.enterDemo(id),
    logout: () => runtime.logout(),
    async listAccounts() {
      return runtime.read('accounts.manage', (s) => s.accounts);
    },
    async createAccount(raw) {
      const input = accountInputSchema.parse(raw);
      return runtime.execute('accounts.manage', (s) => {
        if (s.accounts.some((a) => a.login === input.login))
          throw new ApplicationError('DOMAIN_CONFLICT', 'Login must be unique');
        const account = {
          ...input,
          id: runtime.id(),
          active: true,
          revision: 1,
        };
        s.accounts.push(account);
        return {
          result: account,
          change: {
            entityId: account.id,
            entityLabel: account.displayName,
            action: 'CREATE',
            occurredAt: null,
            reason: null,
            readCapability: 'accounts.manage',
            before: null,
            after: { ...account },
          },
        };
      });
    },
    async updateAccount(id, revision, raw, active, rawReason) {
      const input = accountInputSchema.parse(raw);
      const reason = reasonSchema.parse(rawReason);
      runtime.execute('accounts.manage', (s) => {
        const account = requireFound(s.accounts.find((a) => a.id === id));
        requireRevision(account.revision, revision);
        if (account.login !== input.login)
          throw new ApplicationError(
            'DOMAIN_CONFLICT',
            'Login cannot be changed',
          );
        const before = structuredClone(account);
        const next = {
          ...account,
          ...input,
          active,
          revision: account.revision + 1,
        };
        validateAccountChange(s.accounts, next);
        Object.assign(account, next);
        return {
          result: undefined,
          change: {
            entityId: id,
            entityLabel: account.displayName,
            action:
              before.active !== active
                ? active
                  ? 'ACTIVATE'
                  : 'DEACTIVATE'
                : 'UPDATE',
            occurredAt: null,
            reason,
            readCapability: 'accounts.manage',
            before: { ...before },
            after: { ...account },
          },
        };
      });
    },
  };
}
