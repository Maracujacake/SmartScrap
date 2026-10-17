import {
  ArrowUpRight,
  BarChart3,
  Box,
  Check,
  ChevronRight,
  CircleDollarSign,
  Leaf,
  Package,
  Plus,
  ShoppingCart,
  Sprout,
  Truck,
} from 'lucide-react';
import { useData } from './hooks/useData.js';
import { Composition } from './dashboard/Composition.jsx';
import { Chart } from './dashboard/Chart.jsx';
import { StatCard } from './dashboard/StatCard.jsx';
import {
  Badge,
  Button,
  LoadState,
  LotTable,
  PageHeading,
  PanelHeading,
  TextLink,
} from './components.jsx';
import { currency, number } from './api.js';

export default function Dashboard({ user, days, revision, navigate, onNewLot, onOpenLot }) {
  const state = useData(`/dashboard?days=${days}`, revision);
  return (
    <>
      <PageHeading
        eyebrow="CADA CONEXÃO GERA UMA NOVA POSSIBILIDADE"
        title="Dashboard da empresa"
        description={
          <>
            Olá, {user.name.split(' ')[0]}. Veja o impacto da{' '}
            <strong>{user.organization_name}</strong>.
          </>
        }
        action={
          <Button onClick={onNewLot}>
            <Plus size={17} />
            Publicar lote
          </Button>
        }
      />
      <LoadState state={state}>
        {(data) => (
          <>
            <div className="stats-grid">
              <StatCard
                icon={ShoppingCart}
                label="Vendido no período"
                value={number(data.stats.sold)}
                unit="toneladas"
                previous={data.previous.sold}
                current={data.stats.sold}
                index={0}
              />
              <StatCard
                icon={Box}
                label="Comprado no período"
                value={number(data.stats.bought)}
                unit="toneladas"
                previous={data.previous.bought}
                current={data.stats.bought}
                index={1}
              />
              <StatCard
                icon={Package}
                label="Lotes ativos"
                value={data.stats.active}
                unit={data.stats.active === 1 ? 'lote' : 'lotes'}
                footnote={`${data.stats.pending} propostas aguardando avaliação`}
                index={2}
              />
              <StatCard
                icon={CircleDollarSign}
                label="Valor movimentado"
                value={
                  data.stats.value >= 1e6
                    ? `R$ ${number(data.stats.value / 1e6, 2)}`
                    : data.stats.value >= 1000
                      ? `R$ ${number(data.stats.value / 1000, 1)}`
                      : currency(data.stats.value)
                }
                unit={
                  data.stats.value >= 1e6
                    ? data.stats.value >= 2e6
                      ? 'milhões'
                      : 'milhão'
                    : data.stats.value >= 1000
                      ? 'mil'
                      : ''
                }
                previous={data.previous.value}
                current={data.stats.value}
                index={3}
              />
            </div>
            <div className="charts-grid">
              <section className="panel sales-panel">
                <PanelHeading
                  icon={BarChart3}
                  title="Vendas e compras"
                  action={
                    <div className="chart-legend">
                      <span>
                        <i className="sales-dot" />
                        Vendas
                      </span>
                      <span>
                        <i className="buys-dot" />
                        Compras
                      </span>
                    </div>
                  }
                />
                <div className="chart-caption">Volume negociado em toneladas</div>
                <Chart data={data.chart} />
              </section>
              <section className="panel composition-panel">
                <PanelHeading icon={Box} title="Composição por metal" />
                <div className="chart-caption">Distribuição do volume vendido</div>
                <Composition data={data.composition} total={data.stats.sold} />
              </section>
            </div>
            <div className="dashboard-bottom">
              <section className="panel recent-lots">
                <PanelHeading
                  icon={Package}
                  title="Meus lotes recentes"
                  action={<TextLink onClick={() => navigate('lots')}>Ver todos</TextLink>}
                />
                {data.lots.length ? (
                  <LotTable lots={data.lots} onOpen={onOpenLot} compact />
                ) : (
                  <div className="dashboard-empty">
                    <p>Publique seu primeiro lote e dê início a um novo ciclo.</p>
                    <Button variant="secondary" onClick={onNewLot}>
                      Publicar lote
                      <Plus size={16} />
                    </Button>
                  </div>
                )}
                <div className="table-footer">
                  <span>
                    <span className="live-dot" />
                    Dados de toda a organização
                  </span>
                  <span>
                    Atualizado agora
                    <Check size={12} />
                  </span>
                </div>
              </section>
              <section className="panel upcoming-panel">
                <PanelHeading
                  icon={Truck}
                  title="Próximas coletas"
                  action={<TextLink onClick={() => navigate('pickups')}>Ver todas</TextLink>}
                />
                <div className="upcoming-list">
                  {data.pickups.length ? (
                    data.pickups.map((pickup) => (
                      <button
                        className="upcoming-item"
                        key={pickup.id}
                        onClick={() => navigate('pickups')}
                      >
                        <div className="date-tile">
                          <strong>
                            {pickup.scheduled_date
                              ? new Date(pickup.scheduled_date + 'T12:00:00').getDate()
                              : '—'}
                          </strong>
                          <span>
                            {pickup.scheduled_date
                              ? new Date(pickup.scheduled_date + 'T12:00:00')
                                  .toLocaleDateString('pt-BR', {
                                    month: 'short',
                                  })
                                  .replace('.', '')
                              : 'DATA'}
                          </span>
                        </div>
                        <div className="upcoming-detail">
                          <strong>
                            {pickup.buyer_id === user.organization_id
                              ? 'Entrega de material'
                              : 'Coleta de material'}
                          </strong>
                          <small>
                            {pickup.material} · {number(pickup.weight)} t
                          </small>
                          <Badge status={pickup.status} />
                        </div>
                        <ChevronRight size={15} />
                      </button>
                    ))
                  ) : (
                    <p className="small-empty">
                      Suas coletas aparecerão após a primeira negociação.
                    </p>
                  )}
                </div>
              </section>
            </div>
            <section className="impact-banner">
              <span className="impact-banner-icon">
                <Sprout size={25} />
              </span>
              <div>
                <h3>Bom para o seu negócio. Melhor para o planeta.</h3>
                <p>
                  {data.stats.sold > 0 ? (
                    <>
                      <strong>{number(data.stats.sold)} toneladas</strong> de materiais ganharam a
                      oportunidade de um novo ciclo neste período.
                    </>
                  ) : (
                    'Cada material reaproveitado é uma nova oportunidade para construir um futuro mais circular.'
                  )}
                </p>
              </div>
              <button onClick={() => navigate('market')}>
                Encontre sua próxima oportunidade
                <ArrowUpRight size={17} />
              </button>
              <Leaf className="impact-watermark" size={105} />
            </section>
          </>
        )}
      </LoadState>
    </>
  );
}
