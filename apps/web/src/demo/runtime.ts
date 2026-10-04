import type { Account, Capability, Session } from '@erp/contracts/access';
import type { AuditEntry } from '@erp/contracts/audit';
import { ApplicationError } from '@erp/contracts/common';
import { getCapabilities } from '../features/access/domain/permissions';
import type { DemoState } from './state';
import { createSeed } from './seed';

export interface RuntimeDependencies {
  now: () => Date;
  id: () => string;
}
export type AuditChange = Omit<
  AuditEntry,
  'id' | 'actorId' | 'actorName' | 'recordedAt'
>;
export class DemoRuntime {
  private state: DemoState;
  private actorId: string | null = null;
  private version = 0;
  private listeners = new Set<() => void>();
  constructor(
    readonly dependencies: RuntimeDependencies = {
      now: () => new Date(),
      id: () => crypto.randomUUID(),
    },
  ) {
    this.state = createSeed(dependencies.now(), dependencies.id);
  }
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly getVersion = () => this.version;
  readonly now = () => this.dependencies.now().toISOString();
  readonly id = () => this.dependencies.id();
  private emit() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }
  session(): Session | null {
    const user = this.state.accounts.find(
      (a) => a.id === this.actorId && a.active,
    );
    return user
      ? {
          user: structuredClone(user),
          capabilities: getCapabilities(user.roles),
        }
      : null;
  }
  authorize(capability: Capability): Account {
    const session = this.session();
    if (!session)
      throw new ApplicationError(
        'UNAUTHENTICATED',
        'An active demo session is required',
      );
    if (!session.capabilities.includes(capability))
      throw new ApplicationError(
        'FORBIDDEN',
        'The account lacks the required capability',
      );
    return session.user;
  }
  read<T>(capability: Capability, query: (state: Readonly<DemoState>) => T): T {
    this.authorize(capability);
    return structuredClone(query(this.state));
  }
  execute<T>(
    capability: Capability,
    command: (
      state: DemoState,
      actor: Account,
    ) => { result: T; change: AuditChange },
  ): T {
    const actor = this.authorize(capability);
    const draft = structuredClone(this.state);
    const { result, change } = command(draft, actor);
    draft.audit.push({
      ...change,
      id: this.id(),
      actorId: actor.id,
      actorName: actor.displayName,
      recordedAt: this.now(),
    });
    this.state = draft;
    this.emit();
    return structuredClone(result);
  }
  demoAccounts() {
    return this.state.accounts
      .filter((a) => a.active)
      .map(({ id, displayName, roles }) => ({
        id,
        displayName,
        roles: [...roles],
      }));
  }
  enterDemo(accountId: string) {
    if (!this.state.accounts.some((a) => a.id === accountId && a.active))
      throw new ApplicationError(
        'UNAUTHENTICATED',
        'Demo account is unavailable',
      );
    this.actorId = accountId;
    this.emit();
  }
  logout() {
    this.actorId = null;
    this.emit();
  }
}
export function requireFound<T>(value: T | undefined): T {
  if (value === undefined)
    throw new ApplicationError('NOT_FOUND', 'Resource was not found');
  return value;
}
export function requireRevision(actual: number, expected: number) {
  if (actual !== expected)
    throw new ApplicationError('REVISION_CONFLICT', 'The record has changed');
}
