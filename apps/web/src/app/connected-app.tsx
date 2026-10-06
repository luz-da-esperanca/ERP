import { useState } from 'react';
import type { ReactNode } from 'react';
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
import type { HttpErpClient } from './http-erp-client';
import { ErpProvider } from './erp-provider';
import { ConnectedFamiliesPage } from '../features/registration/presentation/connected-families-page';
import {
  FamilyPage,
  FamilyMembersPage,
  NewFamilyPage,
} from '../features/registration/presentation/family-page';
import { PersonPage } from '../features/registration/presentation/person-page';
import { PersonFormPage } from '../features/registration/presentation/person-form-page';
import { ProjectsPage } from '../features/projects/presentation/projects-page';
import { ActivityPage } from '../features/projects/presentation/activity-page';
import { SearchPage } from '../features/registration/presentation/search-page';

export function ConnectedApp({
  authentication,
  client,
}: {
  authentication: AuthenticationGateway;
  client: HttpErpClient;
}) {
  return (
    <AuthenticationProvider authentication={authentication}>
      <ConnectedRoutes client={client} />
    </AuthenticationProvider>
  );
}

function ConnectedRoutes({ client }: { client: HttpErpClient }) {
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
    <ErpProvider
      client={client}
      session={{
        user: { ...state.session.user, roles: state.session.roles },
        capabilities: state.session.capabilities,
      }}
    >
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route element={<ConnectedLayout />}>
          <Route
            index
            element={
              <Page title="Início">
                <Panel>
                  <Empty>
                    Escolha uma área no menu para consultar os dados do sistema.
                  </Empty>
                </Panel>
              </Page>
            }
          />
          <Route element={<RequireCapability capability="registration.read" />}>
            <Route
              path="families"
              element={
                <ConnectedFamiliesPage registration={client.registration} />
              }
            />
            <Route path="families/:id" element={<FamilyPage />} />
            <Route
              path="families/:id/members"
              element={<FamilyMembersPage />}
            />
            <Route path="people/:id" element={<PersonPage allowEdit />} />
            <Route
              element={<RequireCapability capability="registration.write" />}
            >
              <Route path="families/new" element={<NewFamilyPage />} />
              <Route path="families/:id/edit" element={<FamilyPage edit />} />
              <Route
                path="people/new"
                element={<PersonFormPage registration={client.registration} />}
              />
              <Route
                path="people/:id/edit"
                element={
                  <PersonFormPage registration={client.registration} edit />
                }
              />
            </Route>
          </Route>
          <Route element={<RequireCapability capability="projects.read" />}>
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="activities/:id" element={<ActivityPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErpProvider>
  );
}

function ConnectedLayout() {
  const { authentication, state } = useAuthentication();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState<Element | null>(null);
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
    <>
      <AppShell
        displayName={state.session.user.displayName}
        roles={state.session.roles}
        capabilities={state.session.capabilities}
        accountLabel="Acesso autenticado"
        onSearch={
          state.session.capabilities.includes('registration.read')
            ? () => {
                setSearchTrigger(document.activeElement);
                setSearchOpen(true);
              }
            : undefined
        }
        searchOpen={searchOpen}
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
      {searchOpen && (
        <SearchPage
          onClose={() => setSearchOpen(false)}
          returnFocusTo={searchTrigger}
        />
      )}
    </>
  );
}

function RequireCapability({
  capability,
  children,
}: {
  capability: Capability;
  children?: ReactNode;
}) {
  const { state } = useAuthentication();
  const allowed =
    state.status === 'authenticated' &&
    state.session.capabilities.includes(capability);
  return allowed ? (
    (children ?? <Outlet />)
  ) : (
    <Page title="Acesso restrito">
      <Alert error>Seu perfil não permite acessar esta área.</Alert>
    </Page>
  );
}
