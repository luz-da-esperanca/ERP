import { useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import {
  Home,
  Users,
  LayoutDashboard,
  Activity,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import type { Capability } from '@erp/contracts/access';
import { useErp } from './erp-provider';
import { roleLabels } from '../features/access/presentation/role-labels';

const navigation: Array<{
  to: string;
  label: string;
  icon: typeof Home;
  capability?: Capability;
}> = [
  { to: '/', label: 'Início', icon: LayoutDashboard },
  {
    to: '/families',
    label: 'Famílias',
    icon: Home,
    capability: 'registration.read',
  },
  {
    to: '/people',
    label: 'Pessoas',
    icon: Users,
    capability: 'registration.read',
  },
  {
    to: '/projects',
    label: 'Projetos e atividades',
    icon: Activity,
    capability: 'projects.read',
  },
  {
    to: '/data-quality',
    label: 'Qualidade cadastral',
    icon: ClipboardCheck,
    capability: 'registration.read',
  },
  {
    to: '/reports',
    label: 'Relatórios',
    icon: BarChart3,
    capability: 'reports.read',
  },
  {
    to: '/audit',
    label: 'Auditoria',
    icon: ShieldCheck,
    capability: 'audit.read',
  },
  { to: '/settings', label: 'Configurações', icon: Settings },
];
export function AppLayout() {
  const { session, client } = useErp();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace />;
  const items = navigation.filter(
    (item) =>
      !item.capability || session.capabilities.includes(item.capability),
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <strong>Luz da Esperança</strong>
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
        <div className="environment">● Demonstração · dados fictícios</div>
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
            <strong>{session.user.displayName}</strong>
            <small>
              {session.user.roles.map((role) => roleLabels[role]).join(' · ')}
            </small>
          </div>
          <button
            className="button secondary full-button"
            onClick={() => client.access.logout()}
          >
            <LogOut size={16} /> Sair da demonstração
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
          <span>
            ERP Social /{' '}
            <strong>
              {items.find(
                (item) =>
                  item.to !== '/' && location.pathname.startsWith(item.to),
              )?.label ?? 'Início'}
            </strong>
          </span>
          <span className="top-account">
            {roleLabels[session.user.roles[0] ?? 'COORDINATION']}
          </span>
        </header>
        <main id="main-content" className="page-wrap" tabIndex={-1}>
          <div className="demo-banner">
            Ambiente de demonstração — use apenas dados fictícios. Recarregar
            reinicia os registros.
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
