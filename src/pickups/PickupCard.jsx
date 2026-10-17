import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  MapPin,
  Truck,
} from 'lucide-react';
import { lotCode, number } from '../api.js';
import { Badge, Button } from '../components.jsx';
import { FreightSummary } from './FreightSummary.jsx';

export function PickupCard({
  pickup,
  selling,
  carrier = false,
  step,
  steps,
  setSelected,
  onOpenLot,
}) {
  return (
    <article className="pickup-card panel" key={pickup.id}>
      <div className="pickup-top">
        <div>
          <span className={`trade-type ${selling ? 'selling' : 'buying'}`}>
            {selling ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}{' '}
            {carrier ? 'Serviço de transporte' : selling ? 'Venda · Coleta' : 'Compra · Entrega'}
          </span>
          <button onClick={() => onOpenLot(pickup.lot_id)}>
            {pickup.title}
            <ArrowUpRight size={14} />
          </button>
          <small>
            {lotCode(pickup.lot_id)} · {pickup.material} · {number(pickup.weight)} toneladas
          </small>
        </div>
        <Badge status={pickup.status} />
      </div>
      <div className="pickup-route">
        <div>
          <span>ORIGEM</span>
          <strong>{pickup.seller_name}</strong>
          <small>
            <MapPin size={12} />
            {pickup.city}, {pickup.state}
          </small>
        </div>
        <span className="route-line">
          <i />
          <Truck size={21} />
          <i />
        </span>
        <div>
          <span>DESTINO</span>
          <strong>{pickup.buyer_name}</strong>
          <small>
            {pickup.buyer_city}, {pickup.buyer_state}
          </small>
        </div>
        <div className="pickup-date">
          <span>
            <CalendarDays size={13} />
            DATA DE COLETA
          </span>
          <strong>
            {pickup.scheduled_date
              ? new Date(pickup.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')
              : 'A definir'}
          </strong>
          <small>
            {pickup.transport_kind ? pickup.carrier : 'Responsável a definir'}
            {pickup.transport_kind && (
              <span className="transport-role">
                {pickup.transport_kind === 'seller'
                  ? 'Frota do vendedor'
                  : pickup.transport_kind === 'buyer'
                    ? 'Frota do comprador'
                    : 'Transportadora terceirizada'}
              </span>
            )}
          </small>
        </div>
      </div>
      <FreightSummary pickup={pickup} />
      <div className="pickup-bottom">
        <div className="pickup-steps">
          {steps.map((s, i) => (
            <div key={s.status} className={i <= step ? 'complete' : ''}>
              <span>
                <s.icon size={13} />
              </span>
              <small>{s.label}</small>
            </div>
          ))}
        </div>
        {pickup.status !== 'delivered' ? (
          <div className="pickup-controls">
            {!carrier && ['awaiting', 'scheduled'].includes(pickup.status) && (
              <Button
                variant="secondary"
                onClick={() =>
                  setSelected({
                    ...pickup,
                    assignOnly: true,
                  })
                }
              >
                {pickup.transport_kind ? 'Alterar responsável' : 'Escolher responsável'}
                <Truck size={15} />
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={
                carrier &&
                ['awaiting', 'scheduled'].includes(pickup.status) &&
                !pickup.freight_confirmed_by
              }
              onClick={() => setSelected(pickup)}
            >
              {
                {
                  awaiting: 'Agendar coleta',
                  scheduled: 'Iniciar transporte',
                  transit: 'Confirmar entrega',
                }[pickup.status]
              }
              <ArrowRight size={15} />
            </Button>
          </div>
        ) : (
          <span className="delivery-success">
            <CheckCheck size={17} />
            Ciclo concluído
          </span>
        )}
      </div>
    </article>
  );
}
