import { describe, expect, it } from 'vitest';
import {
  clearAuthSession,
  createInitialAuthState,
  markSessionUnavailable,
  resolveAuthSession,
  type AuthSession,
} from '../../../src/client/auth/auth-state.ts';

const session: AuthSession = {
  expiresAt: '2099-10-25T12:30:00.000Z',
  operator: {
    loginIdentifier: 'kaua.silva',
    displayName: 'Kauã Silva',
    profiles: ['PERIODIC_ACTIVITY'],
  },
};

describe('auth session state', () => {
  it('starts resolving without an authenticated session', () => {
    expect(createInitialAuthState()).toEqual({ status: 'resolving' });
  });

  it('becomes authenticated only after a session resolves', () => {
    expect(resolveAuthSession(session)).toEqual({
      status: 'authenticated',
      session,
    });
  });

  it('removes access state when the session is missing, invalid, or expired', () => {
    expect(resolveAuthSession(null)).toEqual({ status: 'unauthenticated' });
  });

  it('keeps protected access unavailable when session resolution fails', () => {
    expect(markSessionUnavailable()).toEqual({ status: 'unavailable' });
  });

  it('fails closed when session expiry metadata is malformed or expired', () => {
    expect(resolveAuthSession({ ...session, expiresAt: 'not-a-date' })).toEqual({ status: 'unavailable' });
    expect(resolveAuthSession({ ...session, expiresAt: '2020-10-25T12:30:00.000Z' })).toEqual({ status: 'unavailable' });
  });

  it('clears the local session before a logout navigation', () => {
    expect(clearAuthSession({ status: 'authenticated', session }))
      .toEqual({ status: 'unauthenticated' });
  });
});
