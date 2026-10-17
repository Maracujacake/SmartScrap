import { materialColors, number } from '../api.js';

export function Composition({ data, total }) {
  let offset = 0;
  const segments = data.map((item) => {
    const start = offset;
    offset += (item.weight / (total || 1)) * 100;
    return `${materialColors[item.material]} ${start}% ${offset}%`;
  });
  return (
    <div className="composition">
      <div
        className="donut"
        style={{
          background: segments.length ? `conic-gradient(${segments.join(',')})` : '#edf2f0',
        }}
      >
        <div>
          <strong>
            {number(total)}
            <small> t</small>
          </strong>
          <span>vendidas no período</span>
        </div>
      </div>
      <div className="donut-legend">
        {data.length ? (
          data.map((item) => (
            <div key={item.material}>
              <span
                className="legend-dot"
                style={{
                  background: materialColors[item.material],
                }}
              />
              <span>{item.material}</span>
              <strong>{number((item.weight / (total || 1)) * 100, 0)}%</strong>
            </div>
          ))
        ) : (
          <p className="muted">Suas vendas aparecerão aqui.</p>
        )}
      </div>
    </div>
  );
}
