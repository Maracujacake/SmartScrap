import { ArrowUpRight } from 'lucide-react';
import { currency, number } from '../api.js';
import { Button, Field } from '../components.jsx';

export function OfferForm({ lot, price, setPrice, message, setMessage, busy, send }) {
  return (
    <form className="offer-form" onSubmit={send}>
      <h4>Faça sua proposta de compra</h4>
      <div className="form-row">
        <Field label="Sua oferta (R$ / kg)">
          <input
            type="number"
            min="0.01"
            max="100000"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            placeholder={(lot.price_cents / 100).toFixed(2)}
          />
        </Field>
        <div className="offer-total">
          <span>Total para {number(lot.weight)} toneladas</span>
          <strong>{currency(Number(price) * lot.weight * 1000)}</strong>
        </div>
      </div>
      <Field label="Mensagem para a organização">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Apresente seu interesse e as condições de retirada."
        />
      </Field>
      <Button loading={busy} type="submit">
        Enviar proposta
        <ArrowUpRight size={16} />
      </Button>
    </form>
  );
}
