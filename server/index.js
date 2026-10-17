import './config.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { createDatabase } from './database.js';
import { createApp } from './app.js';

const db = createDatabase();

const app = createApp(db);

const dist = resolve('dist');
if (existsSync(resolve(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get('/{*path}', (req, res) => res.sendFile(resolve(dist, 'index.html')));
}

const port = Number(process.env.PORT || 3001);

const host = process.env.HOST || '127.0.0.1';

const server = app.listen(port, host, () => console.log(`SmartScrap: http://${host}:${port}`));

function shutdown() {
  app.locals.visualAnalysis.close();
  app.locals.email.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
