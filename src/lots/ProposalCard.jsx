import { Check } from 'lucide-react';
import { currency } from '../api.js';
import { Badge, Button } from '../components.jsx';

export function ProposalCard({ proposal, owned, user, lot, busy, confirm, setConfirm, decide }) {
  return (
    <div className="proposal-card" key={proposal.id}>
      <div className="proposal-top">
        <strong>{owned ? proposal.organization_name : user.organization_name}</strong>
        <Badge status={proposal.status} />
      </div>
      <p>{proposal.message || 'Interesse no lote completo.'}</p>
      <div className="proposal-bottom">
        <div>
          <strong>
            {currency(proposal.price_cents / 100)}
            <small> / kg</small>
          </strong>
          <span>Total: {currency((proposal.price_cents / 100) * lot.weight * 1000)}</span>
        </div>
        {owned && proposal.status === 'pending' && (
          <div className="proposal-buttons">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  proposal,
                  status: 'rejected',
                })
              }
            >
              Recusar
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                setConfirm({
                  proposal,
                  status: 'accepted',
                })
              }
            >
              Aceitar
              <Check size={14} />
            </Button>
          </div>
        )}
      </div>
      {confirm?.proposal.id === proposal.id && (
        <div className="confirm-inline">
          <p>
            {confirm.status === 'accepted'
              ? 'Ao confirmar, o lote será negociado integralmente e uma coleta será criada.'
              : 'Deseja recusar esta proposta? A organização será notificada.'}
          </p>
          <div>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
              Voltar
            </Button>
            <Button loading={busy} onClick={() => decide(proposal, confirm.status)}>
              Confirmar {confirm.status === 'accepted' ? 'negociação' : 'recusa'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
