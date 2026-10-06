import type {
  ChangePasswordInput,
  LoginInput,
  SessionDto,
} from '@erp/contracts/access-api';

export type AuthenticationState =
  | { status: 'loading'; session: null }
  | { status: 'anonymous'; session: null }
  | { status: 'authenticated'; session: SessionDto }
  | { status: 'unavailable'; session: null; error: unknown };

export interface AuthenticationGateway {
  subscribe(listener: () => void): () => void;
  getSnapshot(): AuthenticationState;
  restore(): Promise<void>;
  login(input: LoginInput): Promise<void>;
  logout(): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<void>;
}
