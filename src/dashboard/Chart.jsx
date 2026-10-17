import { dateLabel, number } from '../api.js';

export function Chart({ data }) {
  const width = 690;
  const height = 210;
  const left = 42;
  const right = 15;
  const top = 16;
  const bottom = 32;
  const max = Math.max(20, ...data.flatMap((d) => [d.sold, d.bought]));
  const ceil = Math.ceil(max / 20) * 20;
  const x = (i) => left + (i * (width - left - right)) / (data.length - 1);
  const y = (v) => top + (height - top - bottom) * (1 - v / ceil);
  const path = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[key])}`).join(' ');
  const area = (key) =>
    `${path(key)} L${x(data.length - 1)},${height - bottom} L${left},${height - bottom} Z`;
  return (
    <svg
      className="line-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Gráfico de toneladas vendidas e compradas no período"
    >
      <defs>
        <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#09a57a" stopOpacity=".2" />
          <stop offset="100%" stopColor="#09a57a" stopOpacity=".015" />
        </linearGradient>
        <linearGradient id="buy-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#58a6eb" stopOpacity=".16" />
          <stop offset="100%" stopColor="#58a6eb" stopOpacity=".01" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line
            x1={left}
            x2={width - right}
            y1={y((ceil * i) / 4)}
            y2={y((ceil * i) / 4)}
            stroke="#ecf0f2"
            strokeDasharray={i ? '3 4' : ''}
          />
          <text x={left - 12} y={y((ceil * i) / 4) + 4} textAnchor="end" className="chart-label">
            {number((ceil * i) / 4, 0)}
          </text>
        </g>
      ))}
      <path d={area('sold')} fill="url(#sales-fill)" />
      <path d={area('bought')} fill="url(#buy-fill)" />
      <path
        d={path('sold')}
        fill="none"
        stroke="#059d75"
        strokeWidth="2.7"
        strokeLinejoin="round"
      />
      <path
        d={path('bought')}
        fill="none"
        stroke="#5a9fe0"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {data.map((d, i) => (
        <g key={d.date}>
          <circle cx={x(i)} cy={y(d.sold)} r="4" fill="#059d75" stroke="white" strokeWidth="2">
            <title>{`${dateLabel(d.date)}: ${number(d.sold)} t vendidas`}</title>
          </circle>
          <circle cx={x(i)} cy={y(d.bought)} r="3.7" fill="#5a9fe0" stroke="white" strokeWidth="2">
            <title>{`${dateLabel(d.date)}: ${number(d.bought)} t compradas`}</title>
          </circle>
          <text x={x(i)} y={height - 9} textAnchor="middle" className="chart-label">
            {dateLabel(d.date)}
          </text>
        </g>
      ))}
    </svg>
  );
}
