import { useState } from 'react';
import { Link, Navigate, Outlet, Route, Routes } from 'react-router';
import type { Capability } from '@erp/contracts/access';
import type { AuthenticationGateway } from '../features/access/application/authentication-gateway';
import { SignInPage } from '../features/access/presentation/sign-in-page';
import { ChangePasswordPage } from '../features/access/presentation/change-password-page';
import { authenticationError } from '../features/access/presentation/authentication-error';
import { Alert, Empty, Page, Panel } from '../shared/ui';
import { AppShell } from './app-layout';
import {
  AuthenticationProvider,
  useAuthentication,
} from './authentication-provider';

export function ConnectedApp({
  authentication,
}: {
  authentication: AuthenticationGateway;
}) {
  return (
    <AuthenticationProvider authentication={authentication}>
      <ConnectedRoutes />
    </AuthenticationProvider>
  );
}

function ConnectedRoutes() {
  const { authentication, state } = useAuthentication();
  if (state.status === 'loading')
    return (
      <main className="login-page">
        <section className="login-card">
          <p role="status">Verificando sua sessão…</p>
        </section>
      </main>
    );
  if (state.status === 'unavailable')
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>Acesso indisponível</h1>
          <Alert error>{authenticationError(state.error)}</Alert>
          <button
            className="button primary"
            onClick={() => {
              void authentication.restore();
            }}
          >
            Tentar novamente
          </button>
        </section>
      </main>
    );
  if (state.status === 'anonymous')
    return (
      <Routes>
        <Route path="/login" element={<SignInPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  if (state.session.user.mustChangePassword)
    return (
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      </Routes>
    );
  return (
    <Routes>
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route element={<ConnectedLayout />}>
        <Route index element={<PendingPage title="Início" />} />
        <Route
          path="families/*"
          element={
            <PendingPage
              title="Pessoas e famílias"
              capability="registration.read"
            />
          }
        />
        <Route
          path="people/*"
          element={
            <PendingPage
              title="Pessoas e famílias"
              capability="registration.read"
            />
          }
        />
        <Route
          path="projects"
          element={
            <PendingPage
              title="Projetos e atividades"
              capability="projects.read"
            />
          }
        />
        <Route
          path="activities/*"
          element={
            <PendingPage
              title="Projetos e atividades"
              capability="projects.read"
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function ConnectedLayout() {
  const { authentication, state } = useAuthentication();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (state.status !== 'authenticated') return null;
  async function logout() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await authentication.logout();
    } catch (cause) {
      setError(authenticationError(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <AppShell
      displayName={state.session.user.displayName}
      roles={state.session.roles}
      capabilities={state.session.capabilities}
      accountLabel="Acesso autenticado"
      onLogout={() => {
        void logout();
      }}
      logoutPending={pending}
      headerActions={
        <Link to="/change-password" className="text-link">
          Alterar senha
        </Link>
      }
    >
      {error && <Alert error>{error}</Alert>}
      <Outlet />
    </AppShell>
  );
}

function PendingPage({
  title,
  capability,
}: {
  title: string;
  capability?: Capability;
}) {
  const { state } = useAuthentication();
  const allowed =
    state.status === 'authenticated' &&
    (!capability || state.session.capabilities.includes(capability));
  return (
    <Page title={title}>
      <Panel>
        <Empty>
          {allowed
            ? 'Esta tela aguarda integração com os dados do sistema.'
            : 'Seu perfil não permite acessar esta área.'}
        </Empty>
      </Panel>
    </Page>
  );
}
