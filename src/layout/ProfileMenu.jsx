import { ChevronDown, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { initials } from '../api.js';

export function ProfileMenu({
  user,
  profileMenu,
  setProfileMenu,
  setNotifications,
  navigate,
  logout,
}) {
  return (
    <div className="profile-anchor">
      <button
        className="profile-button"
        onClick={() => {
          setProfileMenu(!profileMenu);
          setNotifications(false);
        }}
        aria-expanded={profileMenu}
      >
        <span className="profile-avatar">{initials(user.name)}</span>
        <span className="profile-button-text">
          <strong>{user.name}</strong>
          <small>{user.organization_name}</small>
        </span>
        <ChevronDown size={14} />
      </button>
      {profileMenu && (
        <>
          <button
            className="popover-backdrop"
            aria-label="Fechar menu do perfil"
            onClick={() => setProfileMenu(false)}
          />
          <div className="profile-menu">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
            <button onClick={() => navigate('settings')}>
              <SettingsIcon size={16} />
              Meu perfil
            </button>
            <button onClick={logout}>
              <LogOut size={16} />
              Sair da conta
            </button>
          </div>
        </>
      )}
    </div>
  );
}
