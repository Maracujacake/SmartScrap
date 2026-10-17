import { useState } from 'react';
import { Camera, Check } from 'lucide-react';
import { number } from '../api.js';

export function VisualResult({ analysis, showReview = false }) {
  const [position, setPosition] = useState(0);
  const [view, setView] = useState('original');
  const result = analysis.result;
  const isSteel = result?.scope === 'steel_corrosion';
  const photo = analysis.photos[position] || analysis.photos[0];
  const prediction = result?.photos[position];
  if (!photo) {
    return null;
  }
  const image = photo[`${view}_url`] || photo.original_url;
  return (
    <section className="visual-result">
      <div className="visual-result-heading">
        <h4>
          <Camera size={17} />
          {isSteel ? 'Avaliação visual de corrosão' : 'Fotografias do material'}
        </h4>
        <span>
          <Check size={13} /> {analysis.photos.length}{' '}
          {analysis.photos.length === 1 ? 'foto registrada' : 'fotos registradas'}
        </span>
      </div>
      <div className="visual-tabs" role="group" aria-label="Escolher fotografia">
        {analysis.photos.map((item, index) => (
          <button
            type="button"
            key={item.position}
            aria-pressed={position === index}
            className={position === index ? 'active' : ''}
            onClick={() => setPosition(index)}
          >
            Foto {index + 1}
          </button>
        ))}
      </div>
      {isSteel && (
        <div className="visual-tabs image-tabs" role="group" aria-label="Visualização da análise">
          {[
            ['original', 'Original'],
            ['overlay', 'Sobreposição'],
            ['mask', 'Máscara'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={view === value}
              className={view === value ? 'active' : ''}
              onClick={() => setView(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <a
        href={image}
        target="_blank"
        rel="noreferrer"
        className="analysis-image-link"
        aria-label="Abrir imagem ampliada"
      >
        <img
          className="analysis-image"
          src={image}
          alt={`${view === 'mask' ? 'Máscara de classes' : view === 'overlay' ? 'Classificação sobre a fotografia' : 'Fotografia original'} ${position + 1} do lote`}
        />
      </a>
      {isSteel ? (
        <>
          <div className="corrosion-summary">
            <strong>{number(prediction.corrosion_predicted_percent_pixels, 2)}%</strong>
            <span>dos pixels classificados como corrosão nesta foto</span>
          </div>
          <div className="corrosion-legend">
            {prediction.classes.map((item) => (
              <div key={item.id}>
                <i
                  style={{
                    background: `rgb(${item.color.join(',')})`,
                  }}
                />
                <span>
                  {item.id === 0
                    ? 'Fundo / bom estado'
                    : item.id === 1
                      ? 'Leve · Fair'
                      : item.id === 2
                        ? 'Moderada · Poor'
                        : 'Severa · Severe'}
                </span>
                <strong>{number(item.percent_pixels, 2)}%</strong>
              </div>
            ))}
          </div>
          <p className="visual-disclaimer">
            Percentuais da imagem inteira, incluindo o fundo. Não representam pureza, composição
            química ou porcentagem do peso do lote. Fundo e metal em bom estado compartilham a mesma
            classe.
          </p>
          <small className="model-caption">
            DeepLabV3+ · ResNet101 · avaliação experimental, sujeita a revisão humana
          </small>
        </>
      ) : (
        <p className="visual-disclaimer">{result.message}</p>
      )}
      {showReview && (
        <div className="operator-review">
          <strong>
            {analysis.operator_verdict === 'disagree'
              ? 'O operador discorda da avaliação'
              : analysis.operator_verdict === 'agree'
                ? 'Avaliação revisada pelo operador'
                : 'Registro do operador'}
          </strong>
          <span>{analysis.reviewed_by_name}</span>
          {analysis.operator_notes && <p>{analysis.operator_notes}</p>}
        </div>
      )}
    </section>
  );
}
