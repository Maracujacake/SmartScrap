import {
  Box,
  CircleDollarSign,
  MapPin,
  PackageCheck,
  SlidersHorizontal,
  Truck,
} from 'lucide-react';
import { useData } from './hooks/useData.js';
import { Button, LoadState, PageHeading } from './components.jsx';
import { StatCard } from './dashboard/StatCard.jsx';
import { currency, number } from './api.js';

export default function TransportDashboard({ user, days, revision, navigate }) {
  const state = useData(`/transport/dashboard?days=${days}`, revision);
  return (
    <>
      <PageHeading
        eyebrow="CADA ENTREGA CONECTA UM NOVO CICLO"
        title="Painel da transportadora"
        description={
          <>
            Olá, {user.name.split(' ')[0]}. Acompanhe os serviços da{' '}
            <strong>{user.organization_name}</strong>.
          </>
        }
        action={
          <Button onClick={() => navigate('rates')}>
            <SlidersHorizontal size={17} />
            Minhas tarifas
          </Button>
        }
      />
      <LoadState state={state}>
        {({ stats }) => (
          <>
            <div className="stats-grid">
              <StatCard
                icon={Box}
                label="Quantidade transportada"
                value={number(stats.transportedTonnes, 3)}
                unit="toneladas"
                footnote="Entregas concluídas no período"
                index={0}
              />
              <StatCard
                icon={PackageCheck}
                label="Lotes transportados"
                value={stats.deliveredLots}
                unit={stats.deliveredLots === 1 ? 'lote' : 'lotes'}
                footnote="Entregas concluídas no período"
                index={1}
              />
              <StatCard
                icon={CircleDollarSign}
                label="Valor dos fretes concluídos"
                value={currency(stats.completedFreightCents / 100)}
                footnote="Valor acordado; pagamento não controlado"
                index={2}
              />
              <StatCard
                icon={Truck}
                label="Transportes em andamento"
                value={stats.activeJobs}
                unit={stats.activeJobs === 1 ? 'serviço' : 'serviços'}
                footnote="Todos os serviços ainda não concluídos"
                index={3}
              />
            </div>
            <section className="panel logistics-summary">
              <h2>Seu próximo percurso</h2>
              <p>
                Os transportes atribuídos à sua empresa aparecem em Meus transportes. Vendedor ou
                comprador confirma a distância, quem paga e o orçamento antes do agendamento.
              </p>
              <div className="freight-breakdown">
                <div>
                  <span>
                    <MapPin size={15} />
                    Distância das entregas no período
                  </span>
                  <strong>{number(stats.distanceKm, 1)} km</strong>
                </div>
                <div>
                  <span>Fretes confirmados em andamento</span>
                  <strong>{currency(stats.contractedFreightCents / 100)}</strong>
                </div>
              </div>
              <p>
                Os quilômetros são informados pelas partes. Não há cálculo automático de rota.
                Serviços antigos sem preço registrado não acrescentam valor ao indicador de fretes.
              </p>
              <Button onClick={() => navigate('pickups')}>
                Ver meus transportes
                <Truck size={17} />
              </Button>
            </section>
          </>
        )}
      </LoadState>
    </>
  );
}
