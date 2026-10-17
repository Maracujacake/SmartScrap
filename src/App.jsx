import { useCallback, useEffect, useState } from 'react';
import { Check, Leaf, X } from 'lucide-react';
import { Topbar } from './layout/Topbar.jsx';
import { Sidebar } from './layout/Sidebar.jsx';
import { navigation, extraNavigation, navigationFor } from './layout/navigation.js';
import { api } from './api.js';
import { Brand, Button, ErrorMessage, Loading } from './components.jsx';
import Auth from './Auth.jsx';
import Dashboard from './Dashboard.jsx';
import Lots from './Lots.jsx';
import { LotDetail } from './lots/LotDetail.jsx';
import { NewLot } from './lots/NewLot.jsx';
import { Proposals } from './Proposals.jsx';
import Organizations from './Organizations.jsx';
import Pickups from './Pickups.jsx';
import Settings from './Settings.jsx';
import TransportDashboard from './TransportDashboard.jsx';
import TransportRates from './TransportRates.jsx';
import Emails from './Emails.jsx';

const validPages = [
  ...navigation.map((n) => n.id),
  ...extraNavigation.map((n) => n.id),
  'settings',
];

const getPage = () =>
  validPages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const [requestedPage, setPage] = useState(getPage);
  const page =
    user && ![...navigationFor(user).map((n) => n.id), 'settings'].includes(requestedPage)
      ? 'dashboard'
      : requestedPage;
  const [revision, setRevision] = useState(0);
  const [days, setDays] = useState(30);
  const [newLot, setNewLot] = useState(false);
  const [lotId, setLotId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [unread, setUnread] = useState(0);
  const changed = useCallback(() => setRevision((n) => n + 1), []);
  const toast = useCallback(
    (message) =>
      setNotice({
        message,
        id: Date.now(),
      }),
    [],
  );
  const checkSession = useCallback(async () => {
    setChecking(true);
    setSessionError(null);
    try {
      const data = await api('/auth/me');
      setUser(data.user);
    } catch (err) {
      if (err.status !== 401) {
        setSessionError(err);
      }
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    checkSession();
  }, [checkSession]);
  useEffect(() => {
    const handler = () => {
      setPage(getPage());
      setMobile(false);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!user) {
      return;
    }
    const controller = new AbortController();
    api('/notifications', {
      signal: controller.signal,
    })
      .then((data) => setUnread(data.notifications.filter((n) => !n.is_read).length))
      .catch((err) => {
        if (err.status === 401) {
          setUser(null);
          toast('Sua sessão expirou. Entre novamente.');
        }
      });
    return () => controller.abort();
  }, [user, revision, toast]);
  function navigate(next) {
    setMobile(false);
    setNotifications(false);
    setProfileMenu(false);
    if (next !== page) {
      setPage(next);
      location.hash = next;
    }
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
  async function logout() {
    try {
      await api('/auth/logout', {
        method: 'POST',
        body: {},
      });
      setUser(null);
      setProfileMenu(false);
      setLotId(null);
      setNewLot(false);
      setPage('dashboard');
      location.hash = 'dashboard';
    } catch (err) {
      toast(err.message);
    }
  }
  function explore(company) {
    setSearch('');
    setCompanyFilter(String(company));
    navigate(company === user.organization_id ? 'lots' : 'market');
  }
  function searchAll(event) {
    event.preventDefault();
    setCompanyFilter('');
    navigate('market');
    setSearch(globalSearch);
  }
  if (checking) {
    return (
      <div className="boot-screen">
        <Brand dark />
        <Loading />
      </div>
    );
  }
  if (sessionError) {
    return (
      <div className="boot-screen">
        <Brand dark />
        <ErrorMessage error={sessionError} />
        <Button onClick={checkSession}>Tentar novamente</Button>
      </div>
    );
  }
  if (!user) {
    return (
      <Auth
        onLogin={(logged) => {
          setUser(logged);
          changed();
        }}
      />
    );
  }
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        />
      )}
      <Sidebar
        user={user}
        mobile={mobile}
        page={page}
        setMobile={setMobile}
        setCompanyFilter={setCompanyFilter}
        setSearch={setSearch}
        navigate={navigate}
      />
      <div className="main-shell">
        <Topbar
          user={user}
          page={page}
          setMobile={setMobile}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          searchAll={searchAll}
          days={days}
          setDays={setDays}
          notifications={notifications}
          setNotifications={setNotifications}
          profileMenu={profileMenu}
          setProfileMenu={setProfileMenu}
          unread={unread}
          revision={revision}
          setLotId={setLotId}
          changed={changed}
          navigate={navigate}
          logout={logout}
        />
        <main className="main-content" key={page}>
          {page === 'dashboard' && user.organization_type === 'carrier' && (
            <TransportDashboard user={user} days={days} revision={revision} navigate={navigate} />
          )}
          {page === 'dashboard' && user.organization_type !== 'carrier' && (
            <Dashboard
              user={user}
              days={days}
              revision={revision}
              navigate={navigate}
              onNewLot={() => setNewLot(true)}
              onOpenLot={setLotId}
            />
          )}{' '}
          {(page === 'lots' || page === 'market') && (
            <Lots
              mine={page === 'lots'}
              revision={revision}
              onNewLot={() => setNewLot(true)}
              onOpenLot={setLotId}
              search={search}
              setSearch={setSearch}
              companyFilter={companyFilter}
              setCompanyFilter={setCompanyFilter}
            />
          )}{' '}
          {page === 'proposals' && <Proposals revision={revision} onOpenLot={setLotId} />}{' '}
          {(page === 'companies' || page === 'ngos') && (
            <Organizations ngo={page === 'ngos'} revision={revision} onExplore={explore} />
          )}{' '}
          {page === 'pickups' && (
            <Pickups
              user={user}
              revision={revision}
              onChanged={changed}
              toast={toast}
              onOpenLot={setLotId}
            />
          )}{' '}
          {page === 'settings' && (
            <Settings user={user} onUserChanged={setUser} revision={revision} toast={toast} />
          )}
          {page === 'rates' && user.organization_type === 'carrier' && (
            <TransportRates revision={revision} onChanged={changed} toast={toast} />
          )}
          {page === 'emails' && <Emails revision={revision} />}
          <footer className="page-footer">
            <span>
              SmartScrap Exchange<span>·</span>Um novo ciclo para a indústria.
            </span>
            <span>
              <Leaf size={12} />
              Feito para transformar.
            </span>
          </footer>
        </main>
      </div>
      {newLot && (
        <NewLot
          onClose={() => setNewLot(false)}
          onSuccess={(lot) => {
            setNewLot(false);
            changed();
            navigate('lots');
            toast('Lote publicado. Sua próxima conexão começa agora.');
          }}
        />
      )}
      {lotId && (
        <LotDetail
          id={lotId}
          user={user}
          revision={revision}
          onClose={() => setLotId(null)}
          onChanged={changed}
          toast={toast}
        />
      )}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {notice && (
          <div className="toast" key={notice.id}>
            <span>
              <Check size={17} />
            </span>
            {notice.message}
            <button
              className="icon-button"
              aria-label="Dispensar mensagem"
              onClick={() => setNotice(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
