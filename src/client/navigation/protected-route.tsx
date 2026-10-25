import { useEffect } from 'react';
import type { AuthProfile, AuthState } from '../auth/auth-state.ts';

export interface ProtectedRouteDefinition {
  readonly destination: string;
  readonly requiredProfile: AuthProfile;
}

type RouteGuardOutcome = 'allowed' | 'loading' | 'unauthenticated' | 'forbidden' | 'unavailable';

export interface ProtectedRouteProps {
  readonly requiredProfile: AuthProfile;
  readonly authState: AuthState;
  readonly onNavigate: (destination: string) => void;
  readonly children: React.ReactNode;
}

export function getRouteGuardOutcome(
  authState: AuthState,
  requiredProfile: AuthProfile,
): RouteGuardOutcome {
  if (authState.status === 'resolving') return 'loading';
  if (authState.status === 'unavailable') return 'unavailable';
  if (authState.status === 'unauthenticated') return 'unauthenticated';

  return authState.session.operator.profiles.includes(requiredProfile) ? 'allowed' : 'forbidden';
}

export function ProtectedRoute({ requiredProfile, authState, onNavigate, children }: ProtectedRouteProps) {
  const outcome = getRouteGuardOutcome(authState, requiredProfile);

  useEffect(() => {
    if (outcome === 'unauthenticated') onNavigate('/login');
    if (outcome === 'forbidden') onNavigate('/access-denied');
  }, [onNavigate, outcome]);

  if (outcome === 'allowed') return children;

  if (outcome === 'loading') {
    return <main aria-busy="true"><h1>Verificando acesso</h1></main>;
  }

  if (outcome === 'unavailable') {
    return (
      <main>
        <h1>Não foi possível verificar o acesso</h1>
        <p>Tente novamente em instantes.</p>
      </main>
    );
  }

  return null;
}
