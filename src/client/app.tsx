import { useEffect, useRef, useState } from 'react';
import {
  clearAuthSession,
  createInitialAuthState,
  markSessionUnavailable,
  resolveAuthSession,
  type AuthService,
  type AuthSession,
  type AuthState,
} from './auth/auth-state.ts';
import { LoginForm } from './auth/login-form.tsx';
import {
  ProtectedRoute,
  type ProtectedRouteDefinition,
} from './navigation/protected-route.tsx';

export interface AppProps {
  readonly authService?: AuthService;
  readonly hubRoute?: ProtectedRouteDefinition;
}

function useAuthState(authService: AuthService | undefined) {
  const [authState, setAuthState] = useState(createInitialAuthState);
  const resolutionVersion = useRef(0);

  useEffect(() => {
    if (authService === undefined) return;

    let isCurrent = true;
    const currentResolutionVersion = resolutionVersion.current + 1;
    resolutionVersion.current = currentResolutionVersion;

    void authService.getSession()
      .then((session) => {
        if (isCurrent && resolutionVersion.current === currentResolutionVersion) {
          setAuthState(resolveAuthSession(session));
        }
      })
      .catch(() => {
        if (isCurrent && resolutionVersion.current === currentResolutionVersion) {
          setAuthState(markSessionUnavailable());
        }
      });

    return () => { isCurrent = false; };
  }, [authService]);

  const replaceAuthState = (nextState: AuthState) => {
    resolutionVersion.current += 1;
    setAuthState(nextState);
  };

  const clearSession = () => {
    resolutionVersion.current += 1;
    setAuthState((state) => clearAuthSession(state));
  };

  return { authState, replaceAuthState, clearSession };
}

function AccessDeniedPage() {
  return (
    <main>
      <h1>Acesso não permitido</h1>
      <p>Seu perfil não possui acesso a esta área.</p>
    </main>
  );
}

interface HubPageProps {
  readonly displayName: string;
  readonly onSignOut: () => void;
}

function HubPage({ displayName, onSignOut }: HubPageProps) {
  return (
    <main>
      <h1>Área inicial</h1>
      <p>{displayName}</p>
      <button type="button" onClick={onSignOut}>Sair</button>
    </main>
  );
}

export function App({ authService, hubRoute }: AppProps) {
  const { authState, replaceAuthState, clearSession } = useAuthState(authService);
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (destination: string) => {
    if (window.location.pathname === destination) return;
    window.history.pushState({}, '', destination);
    setPath(destination);
  };

  const signOut = () => {
    clearSession();
    navigate('/login');
    if (authService !== undefined) void authService.signOut().catch(() => undefined);
  };

  const authenticate = (session: AuthSession) => {
    replaceAuthState(resolveAuthSession(session));
    navigate(hubRoute === undefined ? '/access-denied' : hubRoute.destination);
  };

  const displayName = authState.status === 'authenticated'
    ? authState.session.operator.displayName
    : '';

  if (hubRoute !== undefined && path === hubRoute.destination) {
    return (
      <ProtectedRoute
        requiredProfile={hubRoute.requiredProfile}
        authState={authState}
        onNavigate={navigate}
      >
        <HubPage displayName={displayName} onSignOut={signOut} />
      </ProtectedRoute>
    );
  }

  if (path === '/access-denied') return <AccessDeniedPage />;
  return (
    <LoginForm
      {...(authService === undefined ? {} : { authService })}
      onAuthenticated={authenticate}
    />
  );
}
