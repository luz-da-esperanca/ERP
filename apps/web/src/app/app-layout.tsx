import { useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router';
import {
  Users,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  Search,
  FolderOpen,
} from 'lucide-react';
import type { Capability } from '@erp/contracts/access';
import { useErp } from './erp-provider';
import { roleLabels } from '../features/access/presentation/role-labels';
import { SearchPage } from '../features/registration/presentation/search-page';

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
    icon: FolderOpen,
    capability: 'projects.read',
  },
];

export function AppLayout() {
  const { session, client } = useErp();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
          <button
            type="button"
            className="global-search"
            aria-expanded={searchOpen}
            aria-haspopup="dialog"
            onClick={() => setSearchOpen(true)}
          >
            <Search aria-hidden="true" size={18} />
            <span>Buscar por família, pessoa ou código...</span>
          </button>
          <span className="top-account" title="Ambiente de demonstração">
            Dados sintéticos
          </span>
        </header>
        <main id="main-content" className="page-wrap" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      {searchOpen ? <SearchPage onClose={() => setSearchOpen(false)} /> : null}
    </div>
  );
}
