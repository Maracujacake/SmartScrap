import { ArrowDownLeft, ArrowUpRight, TrendingUp } from 'lucide-react';
import { number } from '../api.js';

export function StatCard({ icon: Icon, label, value, unit, previous, current, footnote, index }) {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : null;
  return (
    <article
      className="stat-card"
      style={{
        '--card-index': index,
      }}
    >
      <div className="stat-top">
        <span className={`stat-icon stat-icon-${index}`}>
          <Icon size={21} strokeWidth={1.8} />
        </span>
        <span className="stat-label">{label}</span>
        <ArrowUpRight className="stat-arrow" size={17} />
      </div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="stat-bottom">
        {change !== null ? (
          <>
            <span className={change < 0 ? 'stat-change negative' : 'stat-change'}>
              {change >= 0 ? <TrendingUp size={13} /> : <ArrowDownLeft size={13} />}{' '}
              {change > 0 ? '+' : ''}
              {number(change, 0)}%
            </span>
            <span>vs. período anterior</span>
          </>
        ) : (
          <span className="stat-footnote">{footnote || 'Negociações no período selecionado'}</span>
        )}
        <span className="mini-bars" aria-hidden="true">
          {[7, 12, 10, 18, 23, 29].map((h, i) => (
            <i
              key={i}
              style={{
                height: h,
              }}
            />
          ))}
        </span>
      </div>
    </article>
  );
}
