import { z } from 'zod';
import {
  changePasswordSchema,
  loginInputSchema,
  sessionDtoSchema,
  userDtoSchema,
} from '@erp/contracts/access-api';
import type {
  ChangePasswordInput,
  LoginInput,
} from '@erp/contracts/access-api';
import type {
  AuthenticationGateway,
  AuthenticationState,
} from '../application/authentication-gateway';
import { ApiRequestError } from '../../../shared/api-client';
import type { ApiClient } from '../../../shared/api-client';

const sessionResponse = z.object({ data: sessionDtoSchema }).strict();

export class HttpAuthentication implements AuthenticationGateway {
  private state: AuthenticationState = { status: 'loading', session: null };
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private restoration: { generation: number; promise: Promise<void> } | null =
    null;
  constructor(private readonly api: ApiClient) {
    api.subscribeUnauthorized(() => {
      this.generation += 1;
      this.publish({ status: 'anonymous', session: null });
    });
  }

  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: AuthenticationState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  restore(): Promise<void> {
    if (this.restoration?.generation === this.generation)
      return this.restoration.promise;
    const generation = ++this.generation;
    this.publish({ status: 'loading', session: null });
    const promise = this.restoreSession(generation);
    this.restoration = { generation, promise };
    return promise;
  }
  private async restoreSession(generation: number): Promise<void> {
    try {
      const response = await this.api.request('/auth/session', sessionResponse);
      if (generation === this.generation)
        this.publish({ status: 'authenticated', session: response.data });
    } catch (error) {
      if (generation === this.generation)
        this.publish(
          error instanceof ApiRequestError && error.status === 401
            ? { status: 'anonymous', session: null }
            : { status: 'unavailable', session: null, error },
        );
    } finally {
      if (this.restoration?.generation === generation) this.restoration = null;
    }
  }
  async login(input: LoginInput): Promise<void> {
    const body = loginInputSchema.parse(input);
    const generation = ++this.generation;
    const response = await this.api.request('/auth/login', sessionResponse, {
      method: 'POST',
      body,
    });
    if (generation === this.generation)
      this.publish({ status: 'authenticated', session: response.data });
  }
  async logout(): Promise<void> {
    const generation = ++this.generation;
    await this.api.requestEmpty('/auth/logout', { method: 'POST', body: {} });
    if (generation === this.generation)
      this.publish({ status: 'anonymous', session: null });
  }
  async changePassword(input: ChangePasswordInput): Promise<void> {
    const body = changePasswordSchema.parse(input);
    const generation = ++this.generation;
    await this.api.request(
      '/auth/password',
      z.object({ data: userDtoSchema }).strict(),
      { method: 'PUT', body },
    );
    if (generation === this.generation)
      this.publish({ status: 'anonymous', session: null });
  }
}
