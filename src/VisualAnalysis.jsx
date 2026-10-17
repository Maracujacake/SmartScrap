import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, ScanLine, X } from 'lucide-react';
import { VisualResult } from './visual-analysis/VisualResult.jsx';
import { api } from './api.js';
import { Button, ErrorMessage, Field } from './components.jsx';

const supported = (material) => ['Aço', 'Ferro'].includes(material);

const emptyReview = {
  analysis: null,
  filesCount: 0,
  busy: false,
  review: '',
  notes: '',
};

export function VisualUpload({ material, onChange }) {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [review, setReview] = useState('');
  const [notes, setNotes] = useState('');
  const requestRef = useRef(null);
  const analysisRef = useRef(null);
  const inputId = useId();
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  useEffect(() => {
    onChange({
      ...emptyReview,
      analysis,
      filesCount: files.length,
      busy,
      review,
      notes,
    });
  }, [analysis, files.length, busy, review, notes, onChange]);
  useEffect(() => () => requestRef.current?.abort(), []);
  function clearAnalysis() {
    requestRef.current?.abort();
    setBusy(false);
    setError(null);
    setReview('');
    setAnalysis(null);
    const old = analysisRef.current;
    analysisRef.current = null;
    if (old && !['queued', 'processing'].includes(old.status)) {
      void api(`/visual-analyses/${old.id}`, {
        method: 'DELETE',
        body: {},
      }).catch(() => {});
    }
  }
  useEffect(() => {
    if (!analysis || !['queued', 'processing'].includes(analysis.status)) {
      return;
    }
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const data = await api(`/visual-analyses/${analysis.id}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        analysisRef.current = data.analysis;
        setAnalysis(data.analysis);
        setError(null);
        if (['queued', 'processing'].includes(data.analysis.status)) {
          timer = setTimeout(poll, 1100);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err);
          timer = setTimeout(poll, 3500);
        }
      }
    }
    timer = setTimeout(poll, 700);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [analysis?.id, analysis?.status]);
  function select(incoming) {
    const next = [...files, ...Array.from(incoming)];
    if (next.length > 3) {
      setError(new Error('Escolha no máximo três fotografias.'));
      return;
    }
    if (
      next.some(
        (file) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
          file.size > 8 * 1024 * 1024,
      )
    ) {
      setError(new Error('Use fotografias JPG, PNG ou WebP de até 8 MB cada.'));
      return;
    }
    clearAnalysis();
    setFiles(next);
  }
  async function analyze() {
    setError(null);
    setBusy(true);
    setReview('');
    const controller = new AbortController();
    requestRef.current = controller;
    let created = null;
    try {
      if (analysis?.status === 'failed') {
        created = analysis;
      } else {
        created = (
          await api('/visual-analyses', {
            method: 'POST',
            signal: controller.signal,
            body: {
              material,
              photos: files.map((file) => file.name),
            },
          })
        ).analysis;
        analysisRef.current = created;
        for (let index = 0; index < files.length; index++)
          await api(`/visual-analyses/${created.id}/photos/${index}`, {
            method: 'PUT',
            body: files[index],
            signal: controller.signal,
          });
      }
      const data = await api(`/visual-analyses/${created.id}/start`, {
        method: 'POST',
        body: {},
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        analysisRef.current = data.analysis;
        setAnalysis(data.analysis);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err);
        if (created && created.status !== 'failed') {
          void api(`/visual-analyses/${created.id}`, {
            method: 'DELETE',
            body: {},
          }).catch(() => {});
          analysisRef.current = null;
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }
  const running = busy || ['queued', 'processing'].includes(analysis?.status);
  return (
    <section className="visual-upload" aria-labelledby={`${inputId}-title`}>
      <div className="visual-heading">
        <span className="visual-icon">
          <ScanLine size={21} />
        </span>
        <div>
          <h3 id={`${inputId}-title`}>Um olhar a mais sobre o seu material</h3>
          <p>Adicione até 3 fotos e registre a avaliação visual do lote.</p>
        </div>
        <span className="visual-optional">Opcional</span>
      </div>
      <p className="photo-guidance">
        Fotografe apenas o material, de perto e sob luz uniforme. Evite carrocerias, pessoas e
        objetos ao fundo. Use ângulos diferentes do mesmo lote.
      </p>
      {!supported(material) && (
        <div className="visual-notice">
          As fotos serão publicadas com o lote. A avaliação de corrosão está disponível apenas para
          aço e ferro; este modelo não avalia {material.toLowerCase()}.
        </div>
      )}
      <div
        className="upload-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!running) {
            select(event.dataTransfer.files);
          }
        }}
      >
        <label htmlFor={inputId}>
          <ImagePlus size={25} />
          <strong>Escolher fotografias</strong>
          <span>ou arraste aqui · JPG, PNG ou WebP · até 8 MB cada</span>
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={running || files.length === 3}
          onChange={(event) => {
            select(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {files.length > 0 && (
        <div className="photo-previews">
          {files.map((file, index) => (
            <div key={`${index}-${file.name}`}>
              <img src={previews[index]} alt={`Fotografia ${index + 1} selecionada`} />
              <span>
                {index + 1}. {file.name}
              </span>
              <button
                type="button"
                className="icon-button"
                disabled={running}
                aria-label={`Remover fotografia ${index + 1}`}
                onClick={() => {
                  clearAnalysis();
                  setFiles((current) => current.filter((_, i) => i !== index));
                }}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <ErrorMessage error={error || analysis?.error} />
      {files.length > 0 && analysis?.status !== 'completed' && (
        <div className="analysis-action">
          <Button type="button" variant="secondary" loading={running} onClick={analyze}>
            {running
              ? busy
                ? 'Enviando fotografias…'
                : analysis.status === 'queued'
                  ? 'Aguardando na fila…'
                  : 'Analisando fotografias…'
              : analysis?.status === 'failed'
                ? 'Tentar novamente'
                : supported(material)
                  ? 'Analisar fotografias'
                  : 'Preparar fotografias'}
            {!running && <ScanLine size={17} />}
          </Button>
          {running && (
            <small role="status">
              Você pode continuar preenchendo o lote. A primeira análise pode levar alguns
              instantes.
            </small>
          )}
        </div>
      )}
      {analysis?.status === 'completed' && (
        <>
          <VisualResult analysis={analysis} />
          {analysis.result.scope === 'steel_corrosion' && (
            <fieldset className="visual-review">
              <legend>Como você avalia este resultado?</legend>
              <label>
                <input
                  type="radio"
                  name="visualReview"
                  value="agree"
                  checked={review === 'agree'}
                  onChange={() => setReview('agree')}
                />
                Concordo com a avaliação visual
              </label>
              <label>
                <input
                  type="radio"
                  name="visualReview"
                  value="disagree"
                  checked={review === 'disagree'}
                  onChange={() => setReview('disagree')}
                />
                Discordo e quero registrar uma observação
              </label>
            </fieldset>
          )}
          <Field
            label="Observações do operador"
            hint="Sua observação acompanha o lote e não altera a classificação original do modelo."
          >
            <textarea
              rows={3}
              maxLength={2000}
              minLength={review === 'disagree' ? 5 : undefined}
              required={review === 'disagree'}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                review === 'disagree'
                  ? 'Explique o que o modelo interpretou incorretamente.'
                  : 'Conte algum detalhe que as fotos não mostram.'
              }
            />
          </Field>
        </>
      )}
    </section>
  );
}

export { VisualResult };
