import { useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useData } from '../hooks/useData.js';
import { api, dateLabel } from '../api.js';
import { ErrorMessage, Loading } from '../components.jsx';

export function Notifications({ revision, onOpenLot, onChanged, onClose }) {
  const state = useData('/notifications', revision);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function readAll() {
    setBusy(true);
    try {
      await api('/notifications/read', {
        method: 'PATCH',
        body: {},
      });
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="popover-backdrop" aria-label="Fechar notificações" onClick={onClose} />
      <section className="notification-popover">
        <div className="notification-heading">
          <h3>Notificações</h3>
          <button className="icon-button" aria-label="Fechar notificações" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p>Novidades das negociações da sua organização.</p>
        <ErrorMessage error={error} />
        {state.loading ? (
          <Loading />
        ) : state.error ? (
          <ErrorMessage error={state.error} />
        ) : (
          <>
            <button className="mark-read" onClick={readAll} disabled={busy}>
              <CheckCheck size={14} />
              Marcar todas como lidas
            </button>
            <div className="notification-list">
              {state.data.notifications.length ? (
                state.data.notifications.map((note) => (
                  <button
                    key={note.id}
                    className={note.is_read ? 'read' : ''}
                    onClick={() => {
                      if (note.lot_id) {
                        onClose();
                        onOpenLot(note.lot_id);
                      }
                    }}
                  >
                    <span className="notification-note-icon">
                      <Bell size={17} />
                    </span>
                    <span>
                      <strong>{note.title}</strong>
                      <p>{note.message}</p>
                      <small>{dateLabel(note.created_at)}</small>
                    </span>
                    {!note.is_read && <i />}
                  </button>
                ))
              ) : (
                <div className="small-empty">Nenhuma notificação ainda.</div>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
