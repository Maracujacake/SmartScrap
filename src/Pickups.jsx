import { useState } from 'react';
import { CalendarDays, Check, PackageCheck, Truck } from 'lucide-react';
import { useData } from './hooks/useData.js';
import { PickupCard } from './pickups/PickupCard.jsx';
import { UpdatePickup } from './pickups/UpdatePickup.jsx';
import { Empty, LoadState, PageHeading } from './components.jsx';

export default function Pickups({ user, revision, onChanged, toast, onOpenLot }) {
  const carrier = user.organization_type === 'carrier';
  const state = useData('/pickups', revision);
  const [filter, setFilter] = useState('active');
  const [selected, setSelected] = useState(null);
  const steps = [
    {
      status: 'awaiting',
      label: 'Negociado',
      icon: Check,
    },
    {
      status: 'scheduled',
      label: 'Agendado',
      icon: CalendarDays,
    },
    {
      status: 'transit',
      label: 'Em transporte',
      icon: Truck,
    },
    {
      status: 'delivered',
      label: 'Entregue',
      icon: PackageCheck,
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="ACOMPANHE CADA ETAPA DO NOVO CICLO"
        title={carrier ? 'Meus transportes' : 'Coletas e entregas'}
        description="Da negociação ao destino: tudo sob controle, em um só lugar."
      />
      <div className="tab-bar">
        {[
          ['active', 'Em andamento'],
          ['delivered', 'Concluídas'],
          ['all', 'Todas'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? 'active' : ''}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <LoadState state={state}>
        {({ pickups }) => {
          const filtered = pickups.filter(
            (p) =>
              filter === 'all' ||
              (filter === 'active' ? p.status !== 'delivered' : p.status === 'delivered'),
          );
          return filtered.length ? (
            <div className="pickups-list">
              {filtered.map((p) => {
                const selling = p.seller_id === user.organization_id;
                const step = steps.findIndex((s) => s.status === p.status);
                return (
                  <PickupCard
                    key={p.id}
                    pickup={p}
                    selling={selling}
                    carrier={carrier}
                    step={step}
                    steps={steps}
                    setSelected={setSelected}
                    onOpenLot={onOpenLot}
                  />
                );
              })}
            </div>
          ) : (
            <section className="panel">
              <Empty
                title={
                  filter === 'delivered'
                    ? 'Nenhuma entrega concluída ainda'
                    : 'Nenhuma coleta por aqui'
                }
                description={
                  carrier
                    ? 'Os transportes aparecem quando vendedor ou comprador seleciona sua empresa como responsável.'
                    : 'Após aceitar uma proposta, a coleta será criada automaticamente para as duas organizações.'
                }
              />
            </section>
          );
        }}
      </LoadState>
      {selected && (
        <UpdatePickup
          pickup={selected}
          carrier={carrier}
          assignOnly={selected.assignOnly}
          onClose={() => setSelected(null)}
          onSuccess={() => {
            setSelected(null);
            onChanged();
            toast('Situação da coleta atualizada.');
          }}
        />
      )}
    </>
  );
}
