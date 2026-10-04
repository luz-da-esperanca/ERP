import type { Account, AccountInput, Session } from '@erp/contracts/access';
export interface DemoAccount {
  id: string;
  displayName: string;
  roles: Account['roles'];
}
export interface AccessGateway {
  session(): Session | null;
  demoAccounts(): DemoAccount[];
  enterDemo(id: string): void;
  logout(): void;
  listAccounts(): Promise<Account[]>;
  createAccount(input: AccountInput): Promise<Account>;
  updateAccount(
    id: string,
    revision: number,
    input: AccountInput,
    active: boolean,
    reason: string,
  ): Promise<void>;
}
