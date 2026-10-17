import { ArrowUpRight, Building2, MapPin, Sprout } from 'lucide-react';
import { currency, lotCode, number, visualLabel } from '../api.js';
import { Badge } from '../components.jsx';

export function LotCard({ lot, mine, onOpenLot }) {
  return (
    <article className="lot-card" key={lot.id}>
      <div className={`lot-card-visual metal-${lot.material}`}>
        {lot.visual_analysis_id ? (
          <img
            className="lot-cover-photo"
            src={`/api/visual-analyses/${lot.visual_analysis_id}/images/0/original`}
            alt={`Material do lote ${lot.title}`}
            loading="lazy"
          />
        ) : (
          <div className="metal-illustration" aria-hidden="true">
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>
        )}
        <span className="material-chip">{lot.material}</span>
        <span className="lot-code">{lotCode(lot.id)}</span>
        {lot.organization_type === 'ngo' && (
          <span className="ngo-chip">
            <Sprout size={13} />
            Impacto social
          </span>
        )}
      </div>
      <div className="lot-card-body">
        <div className="lot-card-org">
          <Building2 size={13} />
          {lot.organization_name}
        </div>
        <h3>{lot.title}</h3>
        <div className="lot-card-location">
          <MapPin size={13} />
          {lot.city}, {lot.state}
          <span>·</span>
          {visualLabel(lot)}
        </div>
        <div className="lot-card-numbers">
          <div>
            <span>Peso disponível</span>
            <strong>
              {number(lot.weight)} <small>t</small>
            </strong>
          </div>
          <div>
            <span>Preço / kg</span>
            <strong>{currency(lot.price_cents / 100)}</strong>
          </div>
        </div>
        <div className="lot-card-footer">
          <Badge status={lot.status} />
          <button onClick={() => onOpenLot(lot.id)}>
            {mine ? 'Ver detalhes' : 'Ver oportunidade'}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
