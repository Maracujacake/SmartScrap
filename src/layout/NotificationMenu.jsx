import { Bell } from 'lucide-react';
import { Notifications } from '../layout/Notifications.jsx';

export function NotificationMenu({
  notifications,
  unread,
  setNotifications,
  setProfileMenu,
  revision,
  setLotId,
  changed,
}) {
  return (
    <div className="notification-anchor">
      <button
        className={`notification-button icon-button ${notifications ? 'selected' : ''}`}
        aria-label={`Notificações, ${unread} não lidas`}
        aria-expanded={notifications}
        onClick={() => {
          setNotifications(!notifications);
          setProfileMenu(false);
        }}
      >
        <Bell size={21} strokeWidth={1.7} />
        {unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {notifications && (
        <Notifications
          revision={revision}
          onOpenLot={setLotId}
          onChanged={changed}
          onClose={() => setNotifications(false)}
        />
      )}
    </div>
  );
}
