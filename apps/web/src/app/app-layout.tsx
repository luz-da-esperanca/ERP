import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router';
import {
  Users,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  Search,
  FolderKanban,
  BadgeCheck,
  ChartColumnIncreasing,
  History,
  ListChecks,
  UserCog,
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
    to: '/projects',
    label: 'Projetos e atividades',
    icon: FolderKanban,
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
  showManagement = false,
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
  showManagement?: boolean;
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
  const navigationId = useId();
  const navigationRef = useRef<HTMLElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const sidebar = navigationRef.current;
    const trigger = menuTrigger.current;
    const controls = sidebar?.querySelectorAll<HTMLElement>(
      ':is(button, a[href]):not(:disabled)',
    );
    const first = controls?.[0];
    const last = controls?.[controls.length - 1];
    first?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia?.('(min-width: 901px)');
    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === 'Tab') {
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    desktop?.addEventListener('change', closeOnDesktop);
    return () => {
      document.removeEventListener('keydown', handleKey);
      desktop?.removeEventListener('change', closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);
  const connectedNavigation: typeof navigation = showManagement
    ? [
        ...navigation,
        {
          to: '/eligibility-policies',
          label: 'Políticas de aptidão',
          icon: BadgeCheck,
          capability: 'eligibility.read',
        },
        {
          to: '/reports',
          label: 'Relatórios',
          icon: ChartColumnIncreasing,
          capability: 'reports.read',
        },
        {
          to: '/audit',
          label: 'Auditoria',
          icon: History,
          capability: 'audit.read',
        },
        {
          to: '/registration-configuration',
          label: 'Campos cadastrais',
          icon: ListChecks,
          capability: 'featureDecisions.manage',
        },
        {
          to: '/users',
          label: 'Usuários e perfis',
          icon: UserCog,
          capability: 'accounts.manage',
        },
      ]
    : navigation;
  const items = connectedNavigation.filter(
    (item) => !item.capability || capabilities.includes(item.capability),
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <aside
        id={navigationId}
        ref={navigationRef}
        className={`sidebar ${open ? 'sidebar-open' : ''}`}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? 'Menu principal' : undefined}
      >
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
          tabIndex={-1}
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-content" inert={open}>
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            ref={menuTrigger}
            aria-label="Abrir menu"
            aria-controls={navigationId}
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
