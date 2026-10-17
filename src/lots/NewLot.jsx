import { useState } from 'react';
import { ArrowUpRight, Package } from 'lucide-react';
import { VisualUpload } from '../VisualAnalysis.jsx';
import { api, currency, examplePrices } from '../api.js';
import { Button, ErrorMessage, Field, Modal } from '../components.jsx';

export function NewLot({ onClose, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState('');
  const [material, setMaterial] = useState('Aço');
  const [visual, setVisual] = useState({
    analysis: null,
    filesCount: 0,
    busy: false,
    review: '',
    notes: '',
  });
  const needsReview = visual.analysis?.result?.scope === 'steel_corrosion';
  const ready =
    !visual.filesCount ||
    (visual.analysis?.status === 'completed' &&
      !visual.busy &&
      (!needsReview ||
        (visual.review && (visual.review !== 'disagree' || visual.notes.trim().length >= 5))));
  async function submit(event) {
    event.preventDefault();
    if (!ready) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget));
      if (visual.filesCount) {
        body.visualAnalysisId = visual.analysis.id;
        body.visualReview = visual.review;
        body.visualNotes = visual.notes;
      }
      const data = await api('/lots', {
        method: 'POST',
        body,
      });
      onSuccess(data.lot);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title="Um material. Uma nova oportunidade."
      subtitle="Publique um lote em nome da sua organização."
      onClose={onClose}
    >
      <form onSubmit={submit} className="modal-form">
        <ErrorMessage error={error} />
        <Field label="Título do lote">
          <input
            name="title"
            placeholder="Ex.: Retalhos de aço carbono A36"
            required
            minLength={4}
            maxLength={120}
          />
        </Field>
        <div className="form-row">
          <Field label="Tipo de metal">
            <select
              name="material"
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
            >
              {['Aço', 'Ferro', 'Alumínio', 'Cobre', 'Inox', 'Outros'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Peso total (toneladas)">
            <input
              name="weight"
              type="number"
              min="0.001"
              max="100000"
              step="0.001"
              placeholder="25,000"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field
          label="Preço desejado (R$ / kg)"
          hint={`Exemplo fictício para ${material.toLowerCase()}: ${currency(examplePrices[material])} / kg. Não é uma cotação de mercado. Você define o preço.`}
        >
          <input
            name="price"
            type="number"
            min="0.01"
            max="100000"
            step="0.01"
            placeholder={examplePrices[material].toFixed(2).replace('.', ',')}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </Field>
        <VisualUpload key={material} material={material} onChange={setVisual} />
        <Field label="Descrição do material">
          <textarea
            name="description"
            rows={4}
            minLength={10}
            maxLength={2000}
            placeholder="Conte sobre a origem, as condições do material e as orientações para retirada."
            required
          />
        </Field>
        <div className="form-note">
          <Package size={18} />
          <span>
            Valor estimado do lote{' '}
            <strong>{currency(Number(weight) * 1000 * Number(price))}</strong>
          </span>
        </div>
        {!ready && (
          <p className="visual-publish-hint" role="status">
            Conclua a análise das fotos e registre sua avaliação para publicar, ou remova as fotos.
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={busy} disabled={!ready} type="submit">
            Publicar lote
            <ArrowUpRight size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
