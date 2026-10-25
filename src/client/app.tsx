import { useCallback, useEffect, useRef, useState } from 'react';
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

function useAuthState(authService: AuthService | undefined, isProtectedRoute: boolean) {
  const [authState, setAuthState] = useState(createInitialAuthState);
  const resolutionVersion = useRef(0);
  const activeSessionRequest = useRef<AbortController | null>(null);

  const cancelSessionResolution = useCallback(() => {
    activeSessionRequest.current?.abort();
    activeSessionRequest.current = null;
    resolutionVersion.current += 1;
  }, []);

  const revalidateSession = useCallback(() => {
    if (authService === undefined) return;

    cancelSessionResolution();
    const sessionRequest = new AbortController();
    activeSessionRequest.current = sessionRequest;
    const currentResolutionVersion = resolutionVersion.current;
    setAuthState(createInitialAuthState());

    void authService.getSession(sessionRequest.signal)
      .then((session) => {
        if (resolutionVersion.current === currentResolutionVersion) {
          setAuthState(resolveAuthSession(session));
        }
      })
      .catch(() => {
        if (resolutionVersion.current === currentResolutionVersion) {
          setAuthState(markSessionUnavailable());
        }
      })
      .finally(() => {
        if (activeSessionRequest.current === sessionRequest) {
          activeSessionRequest.current = null;
        }
      });
  }, [authService, cancelSessionResolution]);

  useEffect(() => {
    if (!isProtectedRoute) {
      cancelSessionResolution();
      return;
    }

    let isCurrent = true;
    void Promise.resolve().then(() => {
      if (isCurrent) revalidateSession();
    });
    return () => {
      isCurrent = false;
      cancelSessionResolution();
    };
  }, [cancelSessionResolution, isProtectedRoute, revalidateSession]);

  useEffect(() => {
    if (!isProtectedRoute) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') revalidateSession();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isProtectedRoute, revalidateSession]);

  useEffect(() => {
    if (authState.status !== 'authenticated') return;

    const currentResolutionVersion = resolutionVersion.current;
    const expiresAtMilliseconds = Date.parse(authState.session.expiresAt);
    let expiryTimer: number | undefined;
    const scheduleExpiry = () => {
      const remainingMilliseconds = expiresAtMilliseconds - Date.now();
      const delay = Math.min(Math.max(0, remainingMilliseconds), 2_147_483_647);
      expiryTimer = window.setTimeout(() => {
        if (resolutionVersion.current !== currentResolutionVersion) return;
        if (Date.now() < expiresAtMilliseconds) {
          scheduleExpiry();
          return;
        }
        resolutionVersion.current += 1;
        setAuthState((state) => clearAuthSession(state));
      }, delay);
    };
    scheduleExpiry();

    return () => {
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    };
  }, [authState]);

  const replaceAuthState = (nextState: AuthState) => {
    cancelSessionResolution();
    setAuthState(nextState);
  };

  const clearSession = () => {
    cancelSessionResolution();
    setAuthState((state) => clearAuthSession(state));
  };

  const beginProtectedRouteResolution = useCallback(() => {
    cancelSessionResolution();
    setAuthState(createInitialAuthState());
  }, [cancelSessionResolution]);

  return {
    authState,
    replaceAuthState,
    clearSession,
    beginProtectedRouteResolution,
    cancelSessionResolution,
  };
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
  const [path, setPath] = useState(() => window.location.pathname);
  const isProtectedRoute = hubRoute !== undefined && path === hubRoute.destination;
  const {
    authState,
    replaceAuthState,
    clearSession,
    beginProtectedRouteResolution,
    cancelSessionResolution,
  } = useAuthState(authService, isProtectedRoute);

  useEffect(() => {
    const handlePopState = () => {
      if (hubRoute !== undefined && window.location.pathname === hubRoute.destination) {
        beginProtectedRouteResolution();
      } else {
        cancelSessionResolution();
      }
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [beginProtectedRouteResolution, cancelSessionResolution, hubRoute]);

  const navigate = (destination: string) => {
    if (window.location.pathname === destination) return;
    if (hubRoute !== undefined && destination === hubRoute.destination) {
      beginProtectedRouteResolution();
    } else {
      cancelSessionResolution();
    }
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
