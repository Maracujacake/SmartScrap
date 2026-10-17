import { useState } from 'react';
import { Building2, Check, Clock3, MapPin, MessageSquare, Sprout } from 'lucide-react';
import { useData } from '../hooks/useData.js';
import { OfferForm } from './OfferForm.jsx';
import { ProposalCard } from './ProposalCard.jsx';
import { VisualResult } from '../VisualAnalysis.jsx';
import { api, currency, dateLabel, lotCode, number, visualLabel } from '../api.js';
import { Badge, ErrorMessage, LoadState, MaterialIcon, Modal } from '../components.jsx';
import { FreightSummary } from '../pickups/FreightSummary.jsx';

export function LotDetail({ id, user, revision, onClose, onChanged, toast }) {
  const state = useData(`/lots/${id}`, revision);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/lots/${id}/proposals`, {
        method: 'POST',
        body: {
          price,
          message,
        },
      });
      onChanged();
      toast('Proposta enviada para a organização.');
      setMessage('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function decide(proposal, status) {
    setBusy(true);
    setError(null);
    try {
      await api(`/proposals/${proposal.id}`, {
        method: 'PATCH',
        body: {
          status,
        },
      });
      setConfirm(null);
      onChanged();
      toast(
        status === 'accepted'
          ? 'Proposta aceita! A coleta já está disponível.'
          : 'Proposta recusada.',
      );
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal wide title="Detalhes do lote" subtitle={lotCode(id)} onClose={onClose}>
      <LoadState state={state}>
        {({ lot, proposals, visualAnalysis, pickup }) => {
          const owned = lot.organization_id === user.organization_id;
          const pending = proposals.some((p) => p.status === 'pending');
          return (
            <div className="lot-detail">
              <div className="lot-detail-title">
                <MaterialIcon material={lot.material} size={29} />
                <div>
                  <h3>{lot.title}</h3>
                  <span>
                    <Building2 size={14} />
                    {lot.organization_name}
                  </span>
                </div>
                <Badge status={lot.status} />
              </div>
              <div className="detail-metrics">
                <div>
                  <span>Peso disponível</span>
                  <strong>
                    {number(lot.weight, 3)} <small>toneladas</small>
                  </strong>
                </div>
                <div>
                  <span>Preço desejado</span>
                  <strong>
                    {currency(lot.price_cents / 100)} <small>/ kg</small>
                  </strong>
                </div>
                <div>
                  <span>Valor estimado</span>
                  <strong>{currency((lot.weight * 1000 * lot.price_cents) / 100)}</strong>
                </div>
              </div>
              <div className="lot-description">
                <h4>Sobre o material</h4>
                <p>{lot.description}</p>
                <div className="detail-tags">
                  <span>
                    <Check size={14} />
                    {visualLabel(lot)}
                  </span>
                  <span>
                    <MapPin size={14} />
                    {lot.city}, {lot.state}
                  </span>
                  <span>
                    <Clock3 size={14} />
                    Publicado em {dateLabel(lot.created_at)}
                  </span>
                  {lot.organization_type === 'ngo' && (
                    <span>
                      <Sprout size={14} />
                      ONG / Cooperativa
                    </span>
                  )}
                </div>
              </div>
              {visualAnalysis && (
                <VisualResult key={visualAnalysis.id} analysis={visualAnalysis} showReview />
              )}
              <ErrorMessage error={error} />
              {pickup && <FreightSummary pickup={pickup} />}
              {user.organization_type !== 'carrier' && (
                <div className="proposals-section">
                  <h4>
                    <MessageSquare size={17} />
                    {owned ? 'Propostas recebidas' : 'Propostas da sua organização'}
                    <span>{proposals.length}</span>
                  </h4>
                  {proposals.length ? (
                    proposals.map((proposal) => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        owned={owned}
                        user={user}
                        lot={lot}
                        busy={busy}
                        confirm={confirm}
                        setConfirm={setConfirm}
                        decide={decide}
                      />
                    ))
                  ) : (
                    <p className="muted proposal-empty">
                      {owned
                        ? 'Assim que outra organização enviar uma proposta, ela aparecerá aqui.'
                        : 'Você ainda não enviou uma proposta para este lote.'}
                    </p>
                  )}
                </div>
              )}
              {user.organization_type !== 'carrier' &&
                !owned &&
                lot.status !== 'sold' &&
                !pending && (
                  <OfferForm
                    lot={lot}
                    price={price}
                    setPrice={setPrice}
                    message={message}
                    setMessage={setMessage}
                    busy={busy}
                    send={send}
                  />
                )}
              {!owned && pending && (
                <div className="form-note">
                  <Clock3 size={18} />
                  <span>
                    Sua proposta está em análise. Todos da sua organização podem acompanhar por
                    aqui.
                  </span>
                </div>
              )}
            </div>
          );
        }}
      </LoadState>
    </Modal>
  );
}
