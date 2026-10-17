import { CalendarDays, ChevronDown, Menu, Search } from 'lucide-react';
import { NotificationMenu } from './NotificationMenu.jsx';
import { ProfileMenu } from './ProfileMenu.jsx';
import { navigationFor } from './navigation.js';

export function Topbar({
  user,
  page,
  setMobile,
  globalSearch,
  setGlobalSearch,
  searchAll,
  days,
  setDays,
  notifications,
  setNotifications,
  profileMenu,
  setProfileMenu,
  unread,
  revision,
  setLotId,
  changed,
  navigate,
  logout,
}) {
  return (
    <header className="topbar">
      <button
        className="icon-button mobile-menu"
        aria-label="Abrir menu"
        onClick={() => setMobile(true)}
      >
        <Menu size={23} />
      </button>
      <div className="breadcrumb">
        Workspace<span>/</span>
        <strong>
          {page === 'settings'
            ? 'Configurações'
            : navigationFor(user).find((n) => n.id === page)?.label}
        </strong>
      </div>
      {user.organization_type !== 'carrier' && (
        <form className="global-search" onSubmit={searchAll}>
          <Search size={17} />
          <input
            aria-label="Busca global"
            placeholder="Buscar lotes, empresas, materiais…"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
          <kbd>↵</kbd>
        </form>
      )}
      <div className="topbar-actions">
        {page === 'dashboard' && (
          <div className="period-picker">
            <CalendarDays size={16} />
            <div>
              <span>Período</span>
              <select
                aria-label="Período do dashboard"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
                <option value={365}>Último ano</option>
              </select>
            </div>
            <ChevronDown size={14} />
          </div>
        )}
        <NotificationMenu
          notifications={notifications}
          unread={unread}
          setNotifications={setNotifications}
          setProfileMenu={setProfileMenu}
          revision={revision}
          setLotId={setLotId}
          changed={changed}
        />
        <span className="topbar-divider" />
        <ProfileMenu
          user={user}
          profileMenu={profileMenu}
          setProfileMenu={setProfileMenu}
          setNotifications={setNotifications}
          navigate={navigate}
          logout={logout}
        />
      </div>
    </header>
  );
}
