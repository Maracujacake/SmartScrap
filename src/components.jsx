import { useEffect, useId, useRef } from 'react';
import {
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  PackageOpen,
  Recycle,
  X,
} from 'lucide-react';
import { useData } from './hooks/useData.js';
import { number, currency, lotCode, materialColors, visualLabel } from './api.js';

export function Brand({ dark = false }) {
  return (
    <div className={`brand ${dark ? 'brand-dark' : ''}`}>
      <span className="brand-mark">
        <Recycle size={28} strokeWidth={2.1} />
      </span>
      <span>
        SmartScrap<span className="brand-sub">E X C H A N G E</span>
      </span>
    </div>
  );
}

export function Badge({ status, children }) {
  const labels = {
    available: 'Disponível',
    negotiating: 'Em negociação',
    sold: 'Negociado',
    pending: 'Em análise',
    accepted: 'Aceita',
    rejected: 'Recusada',
    awaiting: 'Aguardando',
    scheduled: 'Agendada',
    transit: 'Em transporte',
    delivered: 'Concluída',
  };
  return (
    <span className={`badge badge-${status}`}>
      <span />
      {children || labels[status] || status}
    </span>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  loading = false,
  ...props
}) {
  return (
    <button
      className={`button button-${variant} ${className}`}
      {...props}
      disabled={loading || props.disabled}
    >
      {loading && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function ErrorMessage({ error }) {
  return error ? (
    <div className="error-message" role="alert">
      <CircleAlert size={17} />
      {error.message || error}
    </div>
  ) : null;
}

export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle size={24} className="spin" />
      <span>Carregando informações…</span>
    </div>
  );
}

export function LoadState({ state, children }) {
  if (state.loading) {
    return <Loading />;
  }
  if (state.error) {
    return (
      <div className="panel load-error">
        <ErrorMessage error={state.error} />
        <Button variant="secondary" onClick={state.retry}>
          Tentar novamente
        </Button>
      </div>
    );
  }
  return children(state.data);
}

export function Empty({ title = 'Nada por aqui ainda', description, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <PackageOpen size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function PanelHeading({ icon: Icon, title, action }) {
  return (
    <div className="panel-heading">
      <h2>
        {Icon && <Icon size={18} />} {title}
      </h2>
      {action}
    </div>
  );
}

export function TextLink({ children, onClick }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}

export function MaterialIcon({ material, size = 22 }) {
  return (
    <span
      className="material-icon"
      style={{
        '--material-color': materialColors[material] || '#078563',
      }}
    >
      <Box size={size} strokeWidth={1.7} />
    </span>
  );
}

export function LotTable({ lots, onOpen, compact = false }) {
  return (
    <div className="table-scroll">
      <table className={`lot-table ${compact ? 'compact' : ''}`}>
        <thead>
          <tr>
            <th>Lote / material</th>
            <th>Peso</th>
            <th>Avaliação visual</th>
            <th>Status</th>
            <th>Preço / kg</th>
            <th>
              <span className="sr-only">Detalhes</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
            <tr key={lot.id} onClick={() => onOpen(lot.id)}>
              <td>
                <button
                  className="table-lot-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(lot.id);
                  }}
                >
                  <MaterialIcon material={lot.material} size={17} />
                  <span>
                    <strong>{lotCode(lot.id)}</strong>
                    <small>{lot.material}</small>
                  </span>
                </button>
              </td>
              <td>
                <strong>
                  {number(lot.weight)} <span className="muted">t</span>
                </strong>
              </td>
              <td>{visualLabel(lot)}</td>
              <td>
                <Badge status={lot.status} />
              </td>
              <td className="price-cell">{currency(lot.price_cents / 100)}</td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Ver lote ${lotCode(lot.id)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(lot.id);
                  }}
                >
                  <ArrowUpRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Select({ children, ...props }) {
  return (
    <div className="select-wrap">
      <select {...props}>{children}</select>
      <ChevronDown size={15} />
    </div>
  );
}

export function ImpactArt({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 210 190" fill="none" aria-hidden="true">
      <circle cx="112" cy="95" r="74" stroke="currentColor" strokeOpacity=".12" />
      <circle cx="112" cy="95" r="55" stroke="currentColor" strokeOpacity=".09" />
      <path d="M106 169C90 117 103 72 153 37" stroke="currentColor" strokeWidth="2" />
      <path
        d="M106 137C104 94 142 80 178 80C164 120 138 143 106 137Z"
        fill="currentColor"
        opacity=".65"
      />
      <path
        d="M107 107C97 64 121 29 163 16C165 54 144 92 107 107Z"
        fill="currentColor"
        opacity=".9"
      />
      <path
        d="M102 157C64 153 41 126 39 91C80 101 105 123 102 157Z"
        fill="currentColor"
        opacity=".4"
      />
      <path d="M108 135 166 88M104 155 49 102M109 100 156 28" stroke="#073d34" strokeWidth="1.4" />
    </svg>
  );
}

export function SuccessIcon() {
  return (
    <span className="success-icon">
      <Check size={24} />
    </span>
  );
}

export { useData };
