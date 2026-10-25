import type {
  AuthCredentials,
  AuthProfile,
  AuthService,
  AuthSession,
  AuthenticatedOperator,
  SignInResult,
} from './auth-state.ts';

const AUTH_PROFILES: readonly AuthProfile[] = [
  'COORDINATOR',
  'SOCIAL_ASSISTANCE',
  'PERIODIC_ACTIVITY',
  'POINT_IN_TIME_SERVICE',
  'STOCK_DISTRIBUTION',
  'BAZAR',
  'ADMIN',
];

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

  return {
    async signIn(credentials: AuthCredentials): Promise<SignInResult> {
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

    async getSession(): Promise<AuthSession | null> {
      const sessionVersion = authOperationVersion;

      try {
        const response = await fetchClient('/api/v1/auth/session', {
          method: 'GET',
          credentials: 'same-origin',
        });
        if (response.status === 401 && await hasProblemCode(response, 'AUTH_REQUIRED')) {
          if (authOperationVersion === sessionVersion) csrfToken = null;
          return null;
        }
        if (!response.ok) throw unavailableError();

        const authenticated = await readAuthenticatedResponse(response);
        if (authenticated === null) throw unavailableError();

        if (authOperationVersion === sessionVersion) csrfToken = authenticated.csrfToken;
        return authenticated.session;
      } catch {
        throw unavailableError();
      }
    },

    async signOut(): Promise<void> {
      const csrfTokenForRequest = csrfToken;
      authOperationVersion += 1;
      csrfToken = null;
      if (csrfTokenForRequest === null) return;

      try {
        const response = await fetchClient('/api/v1/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'X-CSRF-Token': csrfTokenForRequest },
        });
        if (response.status === 204 || (response.status === 401 && await hasProblemCode(response, 'AUTH_REQUIRED'))) {
          return;
        }
        throw unavailableError();
      } catch {
        throw unavailableError();
      }
    },
  };
}

function unavailableError(): Error {
  return new Error('Authentication service is unavailable.');
}

async function readAuthenticatedResponse(response: Response): Promise<AuthenticatedResponse | null> {
  const body = await readJson(response);
  if (!isRecord(body) || typeof body.csrfToken !== 'string' || body.csrfToken.length === 0) return null;

  const operator = readOperator(body.user);
  if (operator === null) return null;

  return {
    csrfToken: body.csrfToken,
    session: { operator },
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
