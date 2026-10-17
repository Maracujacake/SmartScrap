import express from 'express';

export function configureRequests(app) {
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    res.set('Cache-Control', 'no-store');
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      req.headers['sec-fetch-site'] === 'cross-site'
    ) {
      return res.status(403).json({
        error: 'Origem não permitida.',
      });
    }
    next();
  });
  app.use(
    express.json({
      limit: '32kb',
    }),
  );
  app.use('/api', (req, res, next) => {
    if (
      ['POST', 'PATCH', 'DELETE'].includes(req.method) &&
      (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
    ) {
      return res.status(400).json({
        error: 'Envie um objeto JSON válido.',
      });
    }
    next();
  });
}

export function configureErrors(app) {
  app.use('/api', (req, res) =>
    res.status(404).json({
      error: 'Recurso não encontrado.',
    }),
  );
  app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') {
      return res.status(413).json({
        error:
          req.method === 'PUT'
            ? 'Cada fotografia deve ter até 8 MB.'
            : 'Os dados enviados excedem o limite permitido.',
      });
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({
        error: 'JSON inválido.',
      });
    }
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
      });
    }
    console.error(error);
    res.status(500).json({
      error: 'Não foi possível concluir a operação. Tente novamente.',
    });
  });
}
