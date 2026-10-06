import { HttpProjects } from '../features/projects/infra/http-projects';
import { HttpAttendance } from '../features/attendance/infra/http-attendance';
import { AttendancePage } from '../features/attendance/presentation/attendance-page';
import { SessionPage } from '../features/attendance/presentation/session-page';
import { ManagedProjectsPage } from '../features/projects/presentation/projects-page';
import { ManagedActivityPage } from '../features/projects/presentation/activity-page';
import { ApiClient } from '../shared/api-client';
import { HttpDataQuality } from '../features/registration/infra/http-data-quality';
import type { DataQualityGateway } from '../features/registration/application/data-quality-gateway';
import { DataQualityPage } from '../features/registration/presentation/data-quality-page';
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
  api,
}: {
  authentication: AuthenticationGateway;
  api?: ApiClient;
}) {
  const [http] = useState(() => api ?? new ApiClient());
  const [quality] = useState(() => new HttpDataQuality(http));
  const [projects] = useState(() => new HttpProjects(http));
  const [attendance] = useState(() => new HttpAttendance(http));
  return (
    <AuthenticationProvider authentication={authentication}>
      <ConnectedRoutes
        quality={quality}
        projects={projects}
        attendance={attendance}
      />
    </AuthenticationProvider>
  );
}

function ConnectedRoutes({
  quality,
  projects,
  attendance,
}: {
  quality: DataQualityGateway;
  projects: HttpProjects;
  attendance: HttpAttendance;
}) {
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
        <Route
          path="data-quality"
          element={<ConnectedQualityPage gateway={quality} />}
        />
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
            <ManagedProjectsPage
              gateway={projects}
              capabilities={state.session.capabilities}
            />
          }
        />
        <Route
          path="activities/:id"
          element={
            <ManagedActivityPage
              gateway={projects}
              capabilities={state.session.capabilities}
            />
          }
        />
        <Route
          path="activities/:id/attendance"
          element={
            <AttendancePage
              gateway={attendance}
              projects={projects}
              capabilities={state.session.capabilities}
            />
          }
        />
        <Route
          path="activities/:id/attendance/:sessionId"
          element={
            <SessionPage
              gateway={attendance}
              projects={projects}
              capabilities={state.session.capabilities}
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
      showDataQuality
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

function ConnectedQualityPage({ gateway }: { gateway: DataQualityGateway }) {
  const { state } = useAuthentication();
  if (state.status !== 'authenticated') return null;
  return (
    <DataQualityPage
      gateway={gateway}
      capabilities={state.session.capabilities}
    />
  );
}
