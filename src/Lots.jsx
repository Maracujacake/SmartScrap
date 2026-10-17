import { useState } from 'react';
import { LayoutGrid, List, Plus, Search, X } from 'lucide-react';
import { useData } from './hooks/useData.js';
import { LotCard } from './lots/LotCard.jsx';
import { Proposals } from './Proposals.jsx';
import { LotDetail } from './lots/LotDetail.jsx';
import { NewLot } from './lots/NewLot.jsx';
import { Button, Empty, LoadState, LotTable, PageHeading, Select } from './components.jsx';

export default function Lots({
  mine = false,
  revision,
  onNewLot,
  onOpenLot,
  search,
  setSearch,
  companyFilter,
  setCompanyFilter,
}) {
  const [material, setMaterial] = useState('');
  const [status, setStatus] = useState('');
  const [layout, setLayout] = useState(mine ? 'list' : 'grid');
  const params = new URLSearchParams({
    scope: mine ? 'mine' : 'market',
    q: search,
    material,
    status,
    company: mine ? '' : companyFilter,
  });
  const state = useData(`/lots?${params}`, revision);
  const companies = useData('/organizations?type=company', revision);
  const ngos = useData('/organizations?type=ngo', revision);
  const organizations = [
    ...(companies.data?.organizations || []),
    ...(ngos.data?.organizations || []),
  ];
  const filtered = Boolean(search || material || status || (!mine && companyFilter));
  return (
    <>
      <PageHeading
        eyebrow={mine ? 'NOVOS CICLOS COMEÇAM COM VOCÊ' : 'UM MATERIAL, INÚMERAS POSSIBILIDADES'}
        title={mine ? 'Meus lotes' : 'Postagens gerais'}
        description={
          mine
            ? 'Gerencie os materiais e acompanhe as propostas de toda a sua organização.'
            : 'Encontre materiais de outras organizações e faça sua proposta.'
        }
        action={
          <Button onClick={onNewLot}>
            <Plus size={17} />
            Publicar lote
          </Button>
        }
      />
      <div className="filter-bar">
        <div className="filter-search">
          <Search size={17} />
          <input
            aria-label="Buscar lotes"
            placeholder="Buscar por lote, material ou empresa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          aria-label="Filtrar por metal"
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
        >
          <option value="">Todos os metais</option>
          {['Aço', 'Ferro', 'Alumínio', 'Cobre', 'Inox', 'Outros'].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
        {mine ? (
          <Select
            aria-label="Filtrar por status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="available">Disponível</option>
            <option value="negotiating">Em negociação</option>
            <option value="sold">Negociado</option>
          </Select>
        ) : (
          <Select
            aria-label="Filtrar por empresa"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="">Todas as organizações</option>
            {organizations.map((org) => (
              <option value={org.id} key={org.id}>
                {org.name}
              </option>
            ))}
          </Select>
        )}
        <div className="view-toggle">
          <button
            className={layout === 'grid' ? 'active' : ''}
            aria-label="Visualizar em cartões"
            onClick={() => setLayout('grid')}
          >
            <LayoutGrid size={17} />
          </button>
          <button
            className={layout === 'list' ? 'active' : ''}
            aria-label="Visualizar em lista"
            onClick={() => setLayout('list')}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      <LoadState state={state}>
        {({ lots }) => (
          <>
            <div className="results-bar">
              <span>
                <strong>{lots.length}</strong>{' '}
                {lots.length === 1 ? 'lote encontrado' : 'lotes encontrados'}
                {mine ? ' na sua organização' : ''}
              </span>
              {filtered && (
                <button
                  className="text-link"
                  onClick={() => {
                    setSearch('');
                    setMaterial('');
                    setStatus('');
                    setCompanyFilter('');
                  }}
                >
                  Limpar filtros
                  <X size={14} />
                </button>
              )}
            </div>
            {!lots.length ? (
              <div className="panel">
                <Empty
                  title={filtered ? 'Nenhum lote com esses filtros' : 'O próximo ciclo começa aqui'}
                  description={
                    filtered
                      ? 'Experimente outro material, empresa ou termo de busca.'
                      : mine
                        ? 'Publique o primeiro lote da sua organização e receba propostas.'
                        : 'Novos lotes de outras organizações aparecerão aqui.'
                  }
                  action={
                    mine && !filtered ? (
                      <Button onClick={onNewLot}>
                        Publicar meu primeiro lote
                        <Plus size={16} />
                      </Button>
                    ) : null
                  }
                />
              </div>
            ) : layout === 'list' ? (
              <section className="panel">
                <LotTable lots={lots} onOpen={onOpenLot} />
              </section>
            ) : (
              <div className="lot-grid">
                {lots.map((lot) => (
                  <LotCard key={lot.id} lot={lot} mine={mine} onOpenLot={onOpenLot} />
                ))}
              </div>
            )}
          </>
        )}
      </LoadState>
    </>
  );
}

export { NewLot, LotDetail, Proposals };
