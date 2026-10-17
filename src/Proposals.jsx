import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useData } from './hooks/useData.js';
import { currency, number } from './api.js';
import { Badge, Empty, LoadState, MaterialIcon, PageHeading } from './components.jsx';

export function Proposals({ revision, onOpenLot }) {
  const [direction, setDirection] = useState('received');
  const state = useData(`/proposals?direction=${direction}`, revision);
  return (
    <>
      <PageHeading
        eyebrow="CONEXÕES QUE GERAM VALOR"
        title="Propostas"
        description="Acompanhe as ofertas recebidas e enviadas pela sua organização."
      />
      <div className="tab-bar">
        <button
          className={direction === 'received' ? 'active' : ''}
          onClick={() => setDirection('received')}
        >
          <ArrowDownLeft size={16} />
          Recebidas
        </button>
        <button
          className={direction === 'sent' ? 'active' : ''}
          onClick={() => setDirection('sent')}
        >
          <ArrowUpRight size={16} />
          Enviadas
        </button>
      </div>
      <LoadState state={state}>
        {({ proposals }) => (
          <section className="panel">
            {proposals.length ? (
              <div className="proposal-list">
                {proposals.map((p) => (
                  <button
                    className="proposal-list-item"
                    key={p.id}
                    onClick={() => onOpenLot(p.lot_id)}
                  >
                    <MaterialIcon material={p.material} />
                    <div>
                      <strong>{p.title}</strong>
                      <span>
                        {direction === 'received' ? p.organization_name : p.seller_name} ·{' '}
                        {number(p.weight)} t
                      </span>
                    </div>
                    <div className="proposal-list-value">
                      <strong>{currency(p.price_cents / 100)} / kg</strong>
                      <span>{currency((p.price_cents / 100) * p.weight * 1000)} no total</span>
                    </div>
                    <Badge status={p.status} />
                    <ArrowUpRight size={17} />
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="Ainda não há propostas"
                description={
                  direction === 'received'
                    ? 'As ofertas para os lotes da sua organização aparecerão aqui.'
                    : 'Explore as postagens gerais e encontre sua próxima oportunidade.'
                }
              />
            )}
          </section>
        )}
      </LoadState>
    </>
  );
}
