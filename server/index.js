import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { createDatabase } from './database.js';
import { createApp } from './app.js';

const db = createDatabase();
const app = createApp(db);
const dist = resolve('dist');
if (existsSync(resolve(dist,'index.html'))) {
  app.use(express.static(dist));
  app.get('/{*path}',(req,res) => res.sendFile(resolve(dist,'index.html')));
}
const port = Number(process.env.PORT || 3001);
const server = app.listen(port,'127.0.0.1',()=>console.log(`SmartScrap API: http://127.0.0.1:${port}`));
function shutdown() { server.close(()=>{db.close();process.exit(0);}); }
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
