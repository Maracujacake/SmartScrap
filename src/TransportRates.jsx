import { useState } from 'react';
import { Check, Truck } from 'lucide-react';
import { useData } from './hooks/useData.js';
import { api, currency } from './api.js';
import { Button, ErrorMessage, Field, LoadState, PageHeading } from './components.jsx';

const materials = ['Aço', 'Ferro', 'Alumínio', 'Cobre', 'Inox', 'Outros'];

function RatesForm({ initial, onSaved, toast }) {
  const [rows, setRows] = useState(
    materials.map((material) => {
      const existing = initial.find((rate) => rate.material === material);
      return {
        material,
        enabled: Boolean(existing),
        pricePerKgKm: existing?.pricePerKgKm ?? '',
        minimumFreight: existing?.minimumFreight ?? 0,
      };
    }),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  function update(index, key, value) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/transport/rates', {
        method: 'PUT',
        body: {
          rates: rows
            .filter((row) => row.enabled)
            .map(({ material, pricePerKgKm, minimumFreight }) => ({
              material,
              pricePerKgKm,
              minimumFreight,
            })),
        },
      });
      toast('Tarifas de frete atualizadas. Os valores já confirmados foram preservados.');
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const example = rows.find((row) => row.enabled && Number(row.pricePerKgKm) > 0);
  return (
    <form onSubmit={save} className="panel rates-form">
      <ErrorMessage error={error} />
      <p>
        Ative os metais que sua empresa transporta. O frete será o maior valor entre peso ×
        distância × tarifa e o frete mínimo cadastrado. Todos os valores abaixo são definidos pela
        sua equipe.
      </p>
      <div className="rate-list">
        {rows.map((row, index) => (
          <div className="rate-row" key={row.material}>
            <label className="rate-material">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(event) => update(index, 'enabled', event.target.checked)}
              />
              {row.material}
            </label>
            <Field label={`Tarifa de ${row.material} (R$ / kg / km)`}>
              <input
                type="number"
                inputMode="decimal"
                step="0.000001"
                min="0.000001"
                max="100"
                required={row.enabled}
                disabled={!row.enabled}
                value={row.pricePerKgKm}
                placeholder="0,0002"
                onChange={(event) => update(index, 'pricePerKgKm', event.target.value)}
              />
            </Field>
            <Field label={`Frete mínimo de ${row.material} (R$)`}>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1000000"
                required={row.enabled}
                disabled={!row.enabled}
                value={row.minimumFreight}
                onChange={(event) => update(index, 'minimumFreight', event.target.value)}
              />
            </Field>
          </div>
        ))}
      </div>
      {example && (
        <div className="transport-note">
          <Truck size={20} />
          <p>
            Exemplo com {example.material}: 25.000 kg × 100 km × R${' '}
            {Number(example.pricePerKgKm).toLocaleString('pt-BR', { maximumFractionDigits: 6 })} ={' '}
            <strong>
              {currency(
                Math.max(
                  25000 * 100 * Number(example.pricePerKgKm),
                  Number(example.minimumFreight),
                ),
              )}
            </strong>
            , considerando o mínimo.
          </p>
        </div>
      )}
      <p>
        Alterações valem para novos orçamentos. Os fretes já confirmados mantêm a tarifa registrada
        na negociação.
      </p>
      <div className="modal-actions">
        <Button loading={busy} type="submit">
          Salvar tarifas
          <Check size={16} />
        </Button>
      </div>
    </form>
  );
}

export default function TransportRates({ revision, onChanged, toast }) {
  const state = useData('/transport/profile', revision);
  return (
    <>
      <PageHeading
        eyebrow="SUA OPERAÇÃO, SUAS TARIFAS"
        title="Tarifas de frete"
        description="Defina o preço por metal, quilograma e quilômetro."
      />
      <LoadState state={state}>
        {({ rates }) => <RatesForm initial={rates} onSaved={onChanged} toast={toast} />}
      </LoadState>
    </>
  );
}
