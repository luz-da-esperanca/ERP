import type {
  AuthCredentials,
  AuthProfile,
  AuthService,
  AuthSession,
  AuthenticatedOperator,
  SignInResult,
} from './auth-state.ts';
import { hasValidSessionExpiry } from './auth-state.ts';

const AUTH_PROFILES: readonly AuthProfile[] = [
  'COORDINATOR',
  'SOCIAL_ASSISTANCE',
  'PERIODIC_ACTIVITY',
  'POINT_IN_TIME_SERVICE',
  'STOCK_DISTRIBUTION',
  'BAZAR',
  'ADMIN',
];

const LOGOUT_INTENT_KEY = 'erp.logout-intent';

export type FetchClient = (input: string, init: RequestInit) => Promise<Response>;

export interface HttpAuthServiceOptions {
  readonly fetchClient?: FetchClient;
}

interface AuthenticatedResponse {
  readonly csrfToken: string;
  readonly session: AuthSession;
}

/**
 * Browser adapter for C-02. The HttpOnly cookie remains under browser control;
 * this instance keeps only the CSRF verifier needed for protected mutations.
 */
export function createHttpAuthService(options: HttpAuthServiceOptions = {}): AuthService {
  const fetchClient = options.fetchClient ?? globalThis.fetch.bind(globalThis);
  let csrfToken: string | null = null;
  let authOperationVersion = 0;
  let isSignOutPending = readLogoutIntent();
  let activeSignOut: Promise<void> | null = null;

  async function readServerSession(signal?: AbortSignal): Promise<AuthenticatedResponse | null> {
    const response = await fetchClient('/api/v1/auth/session', {
      method: 'GET', credentials: 'same-origin', ...(signal === undefined ? {} : { signal }),
    });
    if (response.status === 401 && await hasProblemCode(response, 'AUTH_REQUIRED')) return null;
    if (!response.ok) throw unavailableError();
    const authenticated = await readAuthenticatedResponse(response);
    if (authenticated === null) throw unavailableError();
    return authenticated;
  }

  async function completeSignOut(): Promise<void> {
    try {
      // A fresh adapter or a failed request must bootstrap the current cookie's verifier.
      const verifier = csrfToken ?? (await readServerSession())?.csrfToken;
      if (verifier !== undefined) {
        const response = await fetchClient('/api/v1/auth/logout', {
          method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': verifier },
        });
        if (response.status !== 204
          && !(response.status === 401 && await hasProblemCode(response, 'AUTH_REQUIRED'))) throw unavailableError();
      }
      csrfToken = null;
      isSignOutPending = false;
      writeLogoutIntent(false);
    } catch {
      csrfToken = null;
      throw unavailableError();
    }
  }

  return {
    hasPendingSignOut: () => isSignOutPending,

    async signIn(credentials: AuthCredentials): Promise<SignInResult> {
      if (isSignOutPending) return { status: 'unavailable' };
      const signInVersion = authOperationVersion + 1;
      authOperationVersion = signInVersion;

      try {
        const response = await fetchClient('/api/v1/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(credentials),
        });

        if (response.status === 401 && await hasProblemCode(response, 'INVALID_CREDENTIALS')) {
          return { status: 'invalid-credentials' };
        }
        if (!response.ok) return { status: 'unavailable' };

        const authenticated = await readAuthenticatedResponse(response);
        if (authenticated === null) return { status: 'unavailable' };

        if (authOperationVersion !== signInVersion) return { status: 'unavailable' };
        authOperationVersion += 1;
        csrfToken = authenticated.csrfToken;
        return { status: 'authenticated', session: authenticated.session };
      } catch {
        return { status: 'unavailable' };
      }
    },

    async getSession(signal?: AbortSignal): Promise<AuthSession | null> {
      if (isSignOutPending) throw unavailableError();
      const sessionVersion = authOperationVersion;

      try {
        const authenticated = await readServerSession(signal);
        if (authenticated === null) {
          if (authOperationVersion === sessionVersion) csrfToken = null;
          return null;
        }
        if (authOperationVersion !== sessionVersion || isSignOutPending) throw unavailableError();
        csrfToken = authenticated.csrfToken;
        return authenticated.session;
      } catch {
        throw unavailableError();
      }
    },

    signOut(): Promise<void> {
      if (activeSignOut !== null) return activeSignOut;
      authOperationVersion += 1;
      isSignOutPending = true;
      writeLogoutIntent(true);
      activeSignOut = completeSignOut().finally(() => { activeSignOut = null; });
      return activeSignOut;
    },
  };
}

function readLogoutIntent(): boolean {
  try { return globalThis.sessionStorage?.getItem(LOGOUT_INTENT_KEY) === 'pending'; }
  catch { return false; }
}

function writeLogoutIntent(isPending: boolean): void {
  try {
    if (isPending) globalThis.sessionStorage?.setItem(LOGOUT_INTENT_KEY, 'pending');
    else globalThis.sessionStorage?.removeItem(LOGOUT_INTENT_KEY);
  } catch {
    // Restricted browser storage leaves the in-memory guard active; server logout still runs.
  }
}

function unavailableError(): Error {
  return new Error('Authentication service is unavailable.');
}

async function readAuthenticatedResponse(response: Response): Promise<AuthenticatedResponse | null> {
  const body = await readJson(response);
  if (!isRecord(body) || typeof body.csrfToken !== 'string' || body.csrfToken.length === 0) return null;

  const operator = readOperator(body.user);
  if (operator === null) return null;
  if (typeof body.expiresAt !== 'string' || !hasValidSessionExpiry(body.expiresAt)) return null;

  return {
    csrfToken: body.csrfToken,
    session: { operator, expiresAt: body.expiresAt },
  };
}

function readOperator(value: unknown): AuthenticatedOperator | null {
  if (!isRecord(value)
    || typeof value.loginIdentifier !== 'string'
    || typeof value.displayName !== 'string'
    || !Array.isArray(value.profiles)
    || !value.profiles.every(isAuthProfile)) return null;

  return {
    loginIdentifier: value.loginIdentifier,
    displayName: value.displayName,
    profiles: value.profiles,
  };
}

function isAuthProfile(value: unknown): value is AuthProfile {
  return typeof value === 'string' && AUTH_PROFILES.some((profile) => profile === value);
}

async function hasProblemCode(response: Response, expectedCode: string): Promise<boolean> {
  const body = await readJson(response);
  return isRecord(body) && body.code === expectedCode;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
