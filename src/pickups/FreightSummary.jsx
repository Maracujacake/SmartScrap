import { currency, number } from '../api.js';

export function FreightSummary({ pickup }) {
  const external = pickup.transport_kind === 'external';
  const confirmed = Boolean(pickup.freight_confirmed_by);
  return (
    <div className="pickup-freight">
      <div className="freight-breakdown">
        <div>
          <span>Valor do material</span>
          <strong>{currency(pickup.total_cents / 100)}</strong>
        </div>
        <div>
          <span>
            Frete{' '}
            {external && confirmed
              ? `· pago pelo ${pickup.freight_payer === 'buyer' ? 'comprador' : 'vendedor'}`
              : ''}
          </span>
          <strong>
            {external
              ? confirmed
                ? currency(pickup.freight_cents / 100)
                : 'A confirmar'
              : 'Custo não registrado'}
          </strong>
        </div>
        <div>
          <span>Total registrado da operação</span>
          <strong>{currency(pickup.final_total_cents / 100)}</strong>
        </div>
      </div>
      {external && confirmed && (
        <p>
          {number(pickup.freight_distance_km, 1)} km · R${' '}
          {number(pickup.freight_rate_micros / 1000000, 6)} / kg / km · mínimo{' '}
          {currency(pickup.freight_minimum_cents / 100)}. Confirmado por{' '}
          {pickup.freight_confirmed_by_name}.
        </p>
      )}
      {external && !confirmed && (
        <p>
          O frete ainda não está incluído no total registrado. Coletas antigas podem não ter
          orçamento salvo.
        </p>
      )}
      {!external && (
        <p>
          O total inclui apenas o material. Custos de frota própria são combinados entre as partes.
        </p>
      )}
    </div>
  );
}
