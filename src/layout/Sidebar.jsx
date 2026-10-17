import { ArrowUpRight, Building2, Leaf, Settings as SettingsIcon, X } from 'lucide-react';
import { navigationFor } from '../layout/navigation.js';
import { initials } from '../api.js';
import { Brand, ImpactArt } from '../components.jsx';

export function Sidebar({ user, mobile, page, setMobile, setCompanyFilter, setSearch, navigate }) {
  return (
    <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <Brand />
        <button
          className="icon-button mobile-close"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
      </div>
      <div className="workspace-card">
        <span className="workspace-avatar">{initials(user.organization_name)}</span>
        <div>
          <strong>{user.organization_name}</strong>
          <span>
            {user.organization_type === 'carrier'
              ? 'Espaço da transportadora'
              : user.organization_type === 'ngo'
                ? 'ONG / Cooperativa'
                : 'Espaço da empresa'}
          </span>
        </div>
        <Building2 size={15} />
      </div>
      <span className="nav-section-label">PRINCIPAL</span>
      <nav aria-label="Navegação principal">
        {navigationFor(user).map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'market') {
                setCompanyFilter('');
                setSearch('');
              }
              navigate(item.id);
            }}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            aria-current={page === item.id ? 'page' : undefined}
          >
            <item.icon size={19} strokeWidth={1.7} />
            <span>{item.label}</span>
            {item.id === 'market' && <span className="nav-new">NOVO</span>}
            {page === item.id && <span className="nav-active-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-impact">
          <ImpactArt />
          <span className="sidebar-impact-tag">
            <Leaf size={12} />
            CIRCULAR POR NATUREZA
          </span>
          <h3>
            Mais valor.
            <br />
            Menos resíduos.
          </h3>
          <p>
            O futuro da indústria
            <br />
            começa com um novo ciclo.
          </p>
          <button
            onClick={() => navigate(user.organization_type === 'carrier' ? 'pickups' : 'market')}
          >
            {user.organization_type === 'carrier' ? 'Ver meus transportes' : 'Vamos transformar'}
            <ArrowUpRight size={15} />
          </button>
          <a
            className="presentation-link"
            href="/apresentacao.html"
            target="_blank"
            rel="noreferrer"
          >
            Apresentação do projeto
            <ArrowUpRight size={13} />
          </a>
        </div>
        <button
          className={`nav-item settings-nav ${page === 'settings' ? 'active' : ''}`}
          onClick={() => navigate('settings')}
        >
          <SettingsIcon size={19} strokeWidth={1.7} />
          <span>Configurações</span>
        </button>
        <div className="sidebar-footer">
          <span className="live-dot" />
          Conectados a um futuro melhor
        </div>
      </div>
    </aside>
  );
}
