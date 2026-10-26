/**
 * Client-facing C-02 profile identifiers. A route guard must still receive a
 * server-authorized response for every protected operation.
 */
export type AuthProfile =
  | 'COORDINATOR'
  | 'SOCIAL_ASSISTANCE'
  | 'PERIODIC_ACTIVITY'
  | 'POINT_IN_TIME_SERVICE'
  | 'STOCK_DISTRIBUTION'
  | 'BAZAR'
  | 'ADMIN';

export interface AuthCredentials {
  readonly loginIdentifier: string;
  readonly password: string;
}

/**
 * Display identity and explicitly assigned profiles required by client
 * navigation. Sensitive server-only fields stay outside this boundary.
 */
export interface AuthenticatedOperator {
  readonly loginIdentifier: string;
  readonly displayName: string;
  readonly profiles: readonly AuthProfile[];
}

/**
 * Memory-only client session. The HTTP adapter must discard session tokens
 * and rely on the HttpOnly cookie described by C-02.
 */
export interface AuthSession {
  readonly operator: AuthenticatedOperator;
  readonly expiresAt: string;
}

export type SignInResult =
  | { readonly status: 'authenticated'; readonly session: AuthSession }
  | { readonly status: 'invalid-credentials' }
  | { readonly status: 'unavailable' };

/**
 * Client port for C-02. Pending logout prevents automatic session restoration.
 */
export interface AuthService {
  hasPendingSignOut(): boolean;
  signIn(credentials: AuthCredentials): Promise<SignInResult>;
  getSession(signal?: AbortSignal): Promise<AuthSession | null>;
  signOut(): Promise<void>;
}

export type AuthState =
  | { readonly status: 'resolving' }
  | { readonly status: 'authenticated'; readonly session: AuthSession }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'unavailable' };

export function createInitialAuthState(): AuthState {
  return { status: 'resolving' };
}

/**
 * Maps a completed session check. Missing, invalid, and expired sessions all
 * have the same presentation state; server authorization remains decisive.
 */
export function resolveAuthSession(session: AuthSession | null): AuthState {
  if (session === null) return { status: 'unauthenticated' };
  if (!hasValidSessionExpiry(session.expiresAt)) return { status: 'unavailable' };

  return { status: 'authenticated', session };
}

export function hasValidSessionExpiry(expiresAt: string): boolean {
  const expiresAtMilliseconds = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMilliseconds) && expiresAtMilliseconds > Date.now();
}

/**
 * No retry policy is encoded here because C-02 has not defined one.
 */
export function markSessionUnavailable(): AuthState {
  return { status: 'unavailable' };
}

/**
 * Logout callers clear this state before waiting for server revocation.
 */
export function clearAuthSession(state: AuthState): AuthState {
  if (state.status === 'unauthenticated') return state;

  return { status: 'unauthenticated' };
}
