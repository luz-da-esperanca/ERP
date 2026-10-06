import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import type {
  AuthenticationGateway,
  AuthenticationState,
} from '../features/access/application/authentication-gateway';

const AuthenticationContext = createContext<{
  authentication: AuthenticationGateway;
  state: AuthenticationState;
} | null>(null);

export function AuthenticationProvider({
  authentication,
  children,
}: {
  authentication: AuthenticationGateway;
  children: ReactNode;
}) {
  const state = useSyncExternalStore(
    authentication.subscribe,
    authentication.getSnapshot,
    authentication.getSnapshot,
  );
  useEffect(() => {
    void authentication.restore();
  }, [authentication]);
  return (
    <AuthenticationContext value={{ authentication, state }}>
      {children}
    </AuthenticationContext>
  );
}

export function useAuthentication() {
  const value = useContext(AuthenticationContext);
  if (!value) throw new Error('Authentication provider is required');
  return value;
}
