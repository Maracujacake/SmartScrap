import express from 'express';

export function registerVisualAnalysisRoutes(app, { visual }) {
  app.get('/api/visual-analyses/status', (req, res) => res.json(visual.status()));
  app.post('/api/visual-analyses', async (req, res) =>
    res.status(201).json({
      analysis: await visual.create(req.user, req.body),
    }),
  );
  app.put(
    '/api/visual-analyses/:id/photos/:position',
    express.raw({
      type: 'application/octet-stream',
      limit: '8mb',
      inflate: false,
    }),
    async (req, res) => {
      await visual.upload(req.user, req.params.id, req.params.position, req.body);
      res.json({
        ok: true,
      });
    },
  );
  app.post('/api/visual-analyses/:id/start', (req, res) =>
    res.status(202).json({
      analysis: visual.start(req.user, req.params.id),
    }),
  );
  app.get('/api/visual-analyses/:id', (req, res) =>
    res.json({
      analysis: visual.get(req.user, req.params.id),
    }),
  );
  app.get('/api/visual-analyses/:id/images/:position/:kind', (req, res) =>
    res.sendFile(visual.image(req.user, req.params.id, req.params.position, req.params.kind)),
  );
  app.delete('/api/visual-analyses/:id', async (req, res) => {
    await visual.discard(req.user, req.params.id);
    res.json({
      ok: true,
    });
  });
}
