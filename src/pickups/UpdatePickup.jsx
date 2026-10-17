import { useEffect, useState } from 'react';
import { Check, Truck } from 'lucide-react';
import { useData } from '../hooks/useData.js';
import { api, currency, lotCode, number } from '../api.js';
import { Button, ErrorMessage, Field, LoadState, Modal } from '../components.jsx';

export function UpdatePickup({ pickup, carrier = false, assignOnly = false, onClose, onSuccess }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const companies = useData('/transport-companies');
  const initial =
    pickup.transport_kind === 'external'
      ? `external:${pickup.transport_company_id}`
      : pickup.transport_kind || '';
  const [choice, setChoice] = useState(initial);
  const [distance, setDistance] = useState(String(pickup.freight_distance_km ?? ''));
  const [payer, setPayer] = useState(pickup.freight_payer || 'buyer');
  const [quote, setQuote] = useState(null),
    [quoteError, setQuoteError] = useState(null),
    [quoting, setQuoting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const next = { awaiting: 'scheduled', scheduled: 'transit', transit: 'delivered' }[pickup.status];
  const titles = {
    scheduled: 'Agendar coleta',
    transit: 'Iniciar transporte',
    delivered: 'Confirmar entrega',
  };
  const choosing = !carrier && (assignOnly || next !== 'delivered');
  const external = choice.startsWith('external:');
  const pricingNeeded =
    choosing &&
    external &&
    (!pickup.freight_confirmed_by ||
      choice !== initial ||
      distance !== String(pickup.freight_distance_km ?? '') ||
      payer !== pickup.freight_payer);

  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    setConfirmed(false);
    setQuoting(false);
    if (!pricingNeeded || !distance || Number(distance) <= 0) return;
    const controller = new AbortController();
    setQuoting(true);
    api(`/pickups/${pickup.id}/freight-quote`, {
      method: 'POST',
      signal: controller.signal,
      body: {
        transportCompanyId: Number(choice.split(':')[1]),
        distanceKm: distance,
        freightPayer: payer,
      },
    })
      .then((data) => {
        if (!controller.signal.aborted) setQuote(data.quote);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setQuoteError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setQuoting(false);
      });
    return () => controller.abort();
  }, [pricingNeeded, choice, distance, payer, pickup.id, quoteRevision]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget));
      if (!assignOnly) body.status = next;
      if (choosing) {
        const [kind, companyId] = choice.split(':');
        body.transportKind = kind;
        if (kind === 'external') body.transportCompanyId = Number(companyId);
      }
      if (pricingNeeded) {
        if (!quote || !confirmed) throw new Error('Confira e confirme o orçamento do frete.');
        Object.assign(body, {
          distanceKm: distance,
          freightPayer: payer,
          confirmFreight: true,
          quoteToken: quote.quoteToken,
        });
      }
      await api(`/pickups/${pickup.id}`, { method: 'PATCH', body });
      onSuccess();
    } catch (err) {
      setError(err);
      if (err.status === 409 && pricingNeeded) setQuoteRevision((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={assignOnly ? 'Responsável e frete' : titles[next]}
      subtitle={`${lotCode(pickup.lot_id)} · ${pickup.title}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="modal-form">
        <ErrorMessage error={error} />
        {!assignOnly && next === 'scheduled' && (
          <Field label="Data da coleta">
            <input
              type="date"
              name="scheduledDate"
              min={new Date().toLocaleDateString('sv-SE')}
              defaultValue={pickup.scheduled_date || ''}
              required
            />
          </Field>
        )}
        {choosing && (
          <LoadState state={companies}>
            {({ companies: options }) => (
              <>
                <Field
                  label="Empresa responsável"
                  hint="Vendedor ou comprador pode confirmar o responsável e o orçamento antes do início do transporte."
                >
                  <select
                    value={choice}
                    onChange={(event) => setChoice(event.target.value)}
                    required
                  >
                    <option value="">Selecione uma empresa</option>
                    <optgroup label="Empresas da negociação">
                      <option value="seller">{pickup.seller_name} — frota do vendedor</option>
                      <option value="buyer">{pickup.buyer_name} — frota do comprador</option>
                    </optgroup>
                    <optgroup label="Transportadoras cadastradas">
                      {options.map((company) => (
                        <option key={company.id} value={`external:${company.id}`}>
                          {company.name}
                          {company.is_demo ? ' (demonstração)' : ''}
                          {!company.rate_count ? ' — sem tarifas' : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </Field>
                {external ? (
                  <>
                    <div className="form-row">
                      <Field
                        label="Distância do percurso (km)"
                        hint="Distância informada pelas partes; sem consulta a mapas."
                      >
                        <input
                          type="number"
                          min="0.1"
                          max="20000"
                          step="0.1"
                          value={distance}
                          onChange={(event) => setDistance(event.target.value)}
                          required
                        />
                      </Field>
                      <Field label="Quem paga o frete?">
                        <select value={payer} onChange={(event) => setPayer(event.target.value)}>
                          <option value="buyer">Comprador</option>
                          <option value="seller">Vendedor</option>
                        </select>
                      </Field>
                    </div>
                    <ErrorMessage error={quoteError} />
                    {quoteError && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setQuoteRevision((n) => n + 1)}
                      >
                        Atualizar orçamento
                      </Button>
                    )}
                    {quoting && <p role="status">Calculando o frete…</p>}
                    {quote && (
                      <div className="freight-quote">
                        <p>
                          {number(quote.weightKg, 3)} kg × {number(quote.distanceKm, 1)} km × R${' '}
                          {number(quote.pricePerKgKm, 6)} / kg / km
                        </p>
                        <small>Frete mínimo: {currency(quote.minimumCents / 100)}</small>
                        <div className="freight-breakdown">
                          <div>
                            <span>Material</span>
                            <strong>{currency(quote.materialCents / 100)}</strong>
                          </div>
                          <div>
                            <span>Frete</span>
                            <strong>{currency(quote.freightCents / 100)}</strong>
                          </div>
                          <div>
                            <span>Total da operação</span>
                            <strong>{currency(quote.finalTotalCents / 100)}</strong>
                          </div>
                        </div>
                        <label className="freight-confirm">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(event) => setConfirmed(event.target.checked)}
                            required
                          />
                          Confirmo o frete e seu pagamento pelo{' '}
                          {payer === 'buyer' ? 'comprador' : 'vendedor'}. Uma das partes pode
                          confirmar.
                        </label>
                      </div>
                    )}
                    {!pricingNeeded && pickup.freight_confirmed_by && (
                      <div className="transport-note">
                        <Check size={19} />
                        <p>
                          Frete confirmado: <strong>{currency(pickup.freight_cents / 100)}</strong>.
                          A tarifa salva será mantida. Alterar distância, pagador ou transportadora
                          exige uma nova confirmação.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="transport-note">
                    <Truck size={19} />
                    <p>
                      {choice
                        ? 'A própria organização fará o transporte. O custo da frota própria não é registrado nem acrescentado ao total pela plataforma.'
                        : 'Escolha uma transportadora ou a frota de uma das partes.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </LoadState>
        )}
        {!assignOnly && next !== 'scheduled' && (
          <div className="form-note">
            <Truck size={24} />
            <span>
              {next === 'transit'
                ? 'Confirme que o material foi coletado e está a caminho do comprador.'
                : 'Confirme que o material foi entregue ao comprador.'}{' '}
              As organizações serão notificadas.
            </span>
          </div>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button
            type="submit"
            loading={busy}
            disabled={
              (choosing && (companies.loading || Boolean(companies.error) || !choice)) ||
              (pricingNeeded && (quoting || !quote || !confirmed))
            }
          >
            {assignOnly ? 'Confirmar responsável e frete' : titles[next]}
            <Check size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
