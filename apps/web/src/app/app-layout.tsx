import { useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router';
import {
  Users,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  Search,
  FolderOpen,
  CopyCheck,
} from 'lucide-react';
import type { Capability, Role } from '@erp/contracts/access';
import { useErp } from './erp-provider';
import { roleLabels } from '../features/access/presentation/role-labels';
import { SearchPage } from '../features/registration/presentation/search-page';
import { GlobalActions } from './global-actions';

const navigation: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  capability?: Capability;
}> = [
  { to: '/', label: 'Início', icon: LayoutDashboard },
  {
    to: '/families',
    label: 'Pessoas e famílias',
    icon: Users,
    capability: 'registration.read',
  },
  {
    to: '/data-quality',
    label: 'Duplicidades e qualidade',
    icon: CopyCheck,
    capability: 'registration.read',
  },
  {
    to: '/projects',
    label: 'Projetos e atividades',
    icon: FolderOpen,
    capability: 'projects.read',
  },
];

export function AppLayout() {
  const { session, client } = useErp();
  const [searchOpen, setSearchOpen] = useState(false);
  if (!session) return <Navigate to="/login" replace />;
  const access = client.access;
  if (!access) throw new Error('Demo access is required by the demo layout');
  return (
    <>
      <AppShell
        displayName={session.user.displayName}
        roles={session.user.roles}
        capabilities={session.capabilities}
        onLogout={() => access.logout()}
        logoutLabel="Sair da demonstração"
        accountLabel="Dados sintéticos"
        onSearch={() => setSearchOpen(true)}
        searchOpen={searchOpen}
        headerActions={<GlobalActions />}
      >
        <Outlet />
      </AppShell>
      {searchOpen ? <SearchPage onClose={() => setSearchOpen(false)} /> : null}
    </>
  );
}

export function AppShell({
  displayName,
  showDataQuality = false,
  roles,
  capabilities,
  onLogout,
  logoutPending = false,
  logoutLabel = 'Sair',
  accountLabel,
  onSearch,
  searchOpen = false,
  headerActions,
  children,
}: {
  displayName: string;
  showDataQuality?: boolean;
  roles: Role[];
  capabilities: Capability[];
  onLogout: () => void;
  logoutPending?: boolean;
  logoutLabel?: string;
  accountLabel: string;
  onSearch?: () => void;
  searchOpen?: boolean;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const items = navigation
    .filter((item) => item.to !== '/data-quality' || showDataQuality)
    .filter(
      (item) => !item.capability || capabilities.includes(item.capability),
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand app-brand">
          <img src="/logo-le.jpeg" alt="Luz da Esperança" />
          <div>
            <small>ERP Social</small>
          </div>
          <button
            className="close-nav icon-button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X />
          </button>
        </div>
        <nav aria-label="Navegação principal">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-card">
            <strong>{displayName}</strong>
            <small>{roles.map((role) => roleLabels[role]).join(' · ')}</small>
          </div>
          <button
            className="button secondary full-button"
            disabled={logoutPending}
            onClick={onLogout}
          >
            <LogOut size={16} /> {logoutPending ? 'Saindo…' : logoutLabel}
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="nav-scrim"
          aria-label="Fechar navegação"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Abrir menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          {onSearch && (
            <button
              type="button"
              className="global-search"
              aria-expanded={searchOpen}
              aria-haspopup="dialog"
              onClick={onSearch}
            >
              <Search aria-hidden="true" size={18} />
              <span>Buscar por família, pessoa ou código...</span>
            </button>
          )}
          <span className="top-account">{accountLabel}</span>
          {headerActions}
        </header>
        <main id="main-content" className="page-wrap" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
