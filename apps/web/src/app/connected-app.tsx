import { LinkPersonPage } from '../features/registration/presentation/link-person-page';
import { ConnectedDashboardPage } from '../features/home/presentation/connected-dashboard-page';
import { CatalogsPage } from '../features/projects/presentation/catalogs-page';
import { RegistrationConfigurationPage } from '../features/registration/presentation/configuration-page';
import { ReconciliationPage } from '../features/registration/presentation/reconciliation-page';
import { SessionCorrectionPage } from '../features/attendance/presentation/session-correction-page';
import { ReportsPage } from '../features/reports/presentation/reports-page';
import { HistoryPage } from '../features/reports/presentation/history-page';
import { AuditPage } from '../features/audit/presentation/audit-page';
import { SocialConfigurationPage } from '../features/social-forms/presentation/configuration-page';
import { SizesPage } from '../features/registration/presentation/sizes-page';
import { MembershipsPage } from '../features/registration/presentation/memberships-page';
import { CoveragePage } from '../features/attendance/presentation/coverage-page';
import { EligibilityPolicyPage } from '../features/eligibility/presentation/policy-page';
import {
  EligibilityAssessmentPage,
  FamilyEligibilityPage,
} from '../features/eligibility/presentation/eligibility-page';
import { EligibilityPoliciesPage } from '../features/eligibility/presentation/policies-page';
import { FamilySocialFormsPage } from '../features/social-forms/presentation/social-forms-page';
import { UsersPage } from '../features/access/presentation/users-page';
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
import type { ReactNode } from 'react';
import { Link, Navigate, Outlet, Route, Routes } from 'react-router';
import type { Capability } from '@erp/contracts/access';
import type { AuthenticationGateway } from '../features/access/application/authentication-gateway';
import { SignInPage } from '../features/access/presentation/sign-in-page';
import { ChangePasswordPage } from '../features/access/presentation/change-password-page';
import { authenticationError } from '../features/access/presentation/authentication-error';
import { Alert, Page } from '../shared/ui';
import { AppShell } from './app-layout';
import {
  AuthenticationProvider,
  useAuthentication,
} from './authentication-provider';
import { HttpErpClient } from './http-erp-client';
import { ErpProvider } from './erp-provider';
import { ConnectedFamiliesPage } from '../features/registration/presentation/connected-families-page';
import {
  FamilyPage,
  FamilyMembersPage,
  NewFamilyPage,
} from '../features/registration/presentation/family-page';
import { PersonPage } from '../features/registration/presentation/person-page';
import { PersonFormPage } from '../features/registration/presentation/person-form-page';
import { SearchPage } from '../features/registration/presentation/search-page';

export function ConnectedApp({
  authentication,
  client: providedClient,
  api,
}: {
  authentication: AuthenticationGateway;
  client?: HttpErpClient;
  api?: ApiClient;
}) {
  const [http] = useState(() => providedClient?.api ?? api ?? new ApiClient());
  const [client] = useState(() => providedClient ?? new HttpErpClient(http));
  const [quality] = useState(() => new HttpDataQuality(http));
  const [attendance] = useState(() => new HttpAttendance(http));
  return (
    <AuthenticationProvider authentication={authentication}>
      <ConnectedRoutes
        client={client}
        quality={quality}
        attendance={attendance}
      />
    </AuthenticationProvider>
  );
}

function ConnectedRoutes({
  client,
  quality,
  attendance,
}: {
  client: HttpErpClient;
  quality: DataQualityGateway;
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
              <ConnectedDashboardPage
                client={client}
                capabilities={state.session.capabilities}
                displayName={state.session.user.displayName}
              />
            }
          />
          <Route element={<RequireCapability capability="registration.read" />}>
            <Route
              path="families"
              element={
                <ConnectedFamiliesPage
                  registration={client.registration}
                  eligibility={client.eligibility}
                />
              }
            />
            <Route path="families/:id" element={<FamilyPage connected />} />
            <Route
              path="families/:id/members"
              element={<FamilyMembersPage connected />}
            />
            <Route
              path="people/:id"
              element={<PersonPage allowEdit connected />}
            />
            <Route
              element={<RequireCapability capability="registration.write" />}
            >
              <Route
                path="families/:id/members/link"
                element={<LinkPersonPage projects={client.projects} />}
              />
              <Route path="families/new" element={<NewFamilyPage />} />
              <Route
                path="families/:id/edit"
                element={<FamilyPage connected edit />}
              />
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
            <Route
              path="projects"
              element={
                <ManagedProjectsPage
                  gateway={client.projects}
                  capabilities={state.session.capabilities}
                />
              }
            />
            <Route
              path="activities/:id"
              element={
                <ManagedActivityPage
                  gateway={client.projects}
                  capabilities={state.session.capabilities}
                />
              }
            />
          </Route>
          <Route element={<RequireCapability capability="registration.read" />}>
            <Route
              path="data-quality"
              element={<ConnectedQualityPage gateway={quality} />}
            />
          </Route>
          <Route element={<RequireCapability capability="attendance.read" />}>
            <Route
              path="activities/:id/attendance"
              element={
                <AttendancePage
                  gateway={attendance}
                  projects={client.projects}
                  capabilities={state.session.capabilities}
                />
              }
            />
            <Route
              path="activities/:id/attendance/:sessionId"
              element={
                <SessionPage
                  gateway={attendance}
                  projects={client.projects}
                  capabilities={state.session.capabilities}
                />
              }
            />
          </Route>
          <Route element={<RequireCapability capability="registration.read" />}>
            <Route
              element={<RequireCapability capability="registration.write" />}
            >
              <Route
                path="people/:id/reconciliation"
                element={
                  <ReconciliationPage
                    gateway={client.composition}
                    registration={client.registration}
                    attendance={attendance}
                    canCorrectAttendance={state.session.capabilities.includes(
                      'attendance.write',
                    )}
                  />
                }
              />
            </Route>
          </Route>
          <Route element={<RequireCapability capability="projects.read" />}>
            <Route element={<RequireCapability capability="projects.write" />}>
              <Route
                path="catalogs"
                element={<CatalogsPage gateway={client.projects} />}
              />
            </Route>
          </Route>
          <Route element={<RequireCapability capability="registration.read" />}>
            <Route
              element={
                <RequireCapability capability="featureDecisions.manage" />
              }
            >
              <Route
                path="registration-configuration"
                element={
                  <RegistrationConfigurationPage gateway={client.composition} />
                }
              />
            </Route>
          </Route>
          <Route element={<RequireCapability capability="attendance.read" />}>
            <Route
              element={<RequireCapability capability="attendance.write" />}
            >
              <Route
                path="activities/:id/attendance/:sessionId/correction"
                element={
                  <SessionCorrectionPage
                    gateway={attendance}
                    projects={client.projects}
                  />
                }
              />
            </Route>
          </Route>
          <Route element={<RequireCapability capability="reports.read" />}>
            <Route
              path="reports"
              element={
                <ReportsPage
                  gateway={client.reports}
                  registration={client.registration}
                  projects={client.projects}
                  capabilities={state.session.capabilities}
                />
              }
            />
            <Route
              element={<RequireCapability capability="registration.read" />}
            >
              <Route
                path="families/:id/history"
                element={<HistoryPage gateway={client.reports} />}
              />
            </Route>
            <Route
              element={<RequireCapability capability="participants.lookup" />}
            >
              <Route
                path="people/:id/history"
                element={<HistoryPage gateway={client.reports} person />}
              />
            </Route>
          </Route>
          <Route element={<RequireCapability capability="audit.read" />}>
            <Route
              path="audit"
              element={
                <AuditPage
                  gateway={client.audit}
                  capabilities={state.session.capabilities}
                />
              }
            />
          </Route>
          <Route
            element={<RequireCapability capability="featureDecisions.manage" />}
          >
            <Route
              path="social-form-configuration"
              element={<SocialConfigurationPage gateway={client.socialForms} />}
            />
          </Route>
          <Route element={<RequireCapability capability="attendance.read" />}>
            <Route
              path="activities/:id/coverage"
              element={
                <CoveragePage
                  gateway={attendance}
                  canWrite={state.session.capabilities.includes(
                    'attendance.write',
                  )}
                />
              }
            />
          </Route>
          <Route element={<RequireCapability capability="registration.read" />}>
            <Route
              element={<RequireCapability capability="registration.write" />}
            >
              <Route
                path="people/:id/sizes"
                element={<SizesPage gateway={client.composition} />}
              />
              <Route
                path="people/:id/memberships"
                element={
                  <MembershipsPage
                    gateway={client.composition}
                    registration={client.registration}
                  />
                }
              />
            </Route>
          </Route>
          <Route element={<RequireCapability capability="eligibility.read" />}>
            <Route
              path="families/:id/eligibility"
              element={
                <FamilyEligibilityPage
                  gateway={client.eligibility}
                  canEvaluate={state.session.capabilities.includes(
                    'eligibility.evaluate',
                  )}
                />
              }
            />
            <Route
              path="eligibility-policies"
              element={
                <EligibilityPoliciesPage
                  gateway={client.eligibility}
                  projects={client.projects}
                  canWrite={state.session.capabilities.includes(
                    'eligibility.policy.write',
                  )}
                />
              }
            />
          </Route>
          <Route element={<RequireCapability capability="eligibility.read" />}>
            <Route
              path="eligibility-policies/:id"
              element={<EligibilityPolicyPage gateway={client.eligibility} />}
            />
            <Route
              path="eligibility-assessments/:id"
              element={
                <EligibilityAssessmentPage gateway={client.eligibility} />
              }
            />
          </Route>
          <Route element={<RequireCapability capability="socialForms.read" />}>
            <Route
              path="families/:id/social-forms"
              element={
                <FamilySocialFormsPage
                  gateway={client.socialForms}
                  canWrite={state.session.capabilities.includes(
                    'socialForms.write',
                  )}
                />
              }
            />
          </Route>
          <Route element={<RequireCapability capability="accounts.manage" />}>
            <Route
              path="users"
              element={<UsersPage gateway={client.users} />}
            />
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
        showDataQuality
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
          serverFiltered
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
