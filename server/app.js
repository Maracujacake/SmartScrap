import express from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { hashPassword, verifyPassword, transaction } from './database.js';

const materials = ['Aço','Ferro','Alumínio','Cobre','Inox','Outros'];
const sessionHash = token => createHash('sha256').update(token).digest('hex');
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function string(value, label, min = 1, max = 200) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(`${label}: informe entre ${min} e ${max} caracteres.`);
  return value.trim();
}
function money(value) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0.01 || result > 100000) fail('Informe um preço válido entre R$ 0,01 e R$ 100.000 por kg.');
  return Math.round(result * 100);
}
function email(value) {
  const result = string(value, 'E-mail', 5, 180).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('Informe um e-mail válido.');
  return result;
}
function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) fail('A senha deve ter entre 8 e 128 caracteres.');
  return value;
}
function id(value) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) fail('Identificador inválido.');
  return result;
}

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req,res,next) => {
    res.set('X-Content-Type-Options','nosniff');
    res.set('Referrer-Policy','same-origin');
    res.set('Cache-Control','no-store');
    if (['POST','PATCH','DELETE'].includes(req.method) && req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({error:'Origem não permitida.'});
    next();
  });
  app.use(express.json({limit:'32kb'}));
  app.use('/api',(req,res,next)=>{
    if (['POST','PATCH','DELETE'].includes(req.method) && (!req.body || typeof req.body!=='object' || Array.isArray(req.body))) return res.status(400).json({error:'Envie um objeto JSON válido.'});
    next();
  });
  const attempts = new Map();
  function limitAuth(req,res,next) {
    const now = Date.now();
    for (const [key,value] of attempts) if (value.until < now) attempts.delete(key);
    const key = req.ip;
    const state = attempts.get(key) || {count:0,until:now+15*60*1000};
    state.count++;
    attempts.set(key,state);
    if (state.count > 60) return res.status(429).json({error:'Muitas tentativas. Aguarde 15 minutos e tente novamente.'});
    next();
  }
  function currentUser(userId) {
    return db.prepare(`SELECT u.id,u.name,u.email,u.organization_id,o.name AS organization_name,o.type AS organization_type,
      o.city,o.state,o.sector,o.description,o.invite_code FROM users u JOIN organizations o ON o.id=u.organization_id WHERE u.id=?`).get(userId);
  }
  function session(req,res,userId) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').run(sessionHash(token),userId,Date.now()+7*86400000);
    res.cookie('smartscrap_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true',maxAge:7*86400000,path:'/'});
    return currentUser(userId);
  }
  function readToken(req) { return /(?:^|;\s*)smartscrap_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]; }
  const notify = db.prepare('INSERT INTO notifications (organization_id,title,message,lot_id) VALUES (?,?,?,?)');

  app.get('/api/health', (req,res) => res.json({status:'ok'}));
  app.post('/api/auth/login',limitAuth,(req,res) => {
    const loginEmail = email(req.body.email);
    const password = string(req.body.password,'Senha',1,128);
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(loginEmail);
    if (!user || !verifyPassword(password,user.password_hash)) fail('E-mail ou senha incorretos.',401);
    res.json({user:session(req,res,user.id)});
  });
  app.post('/api/auth/register',limitAuth,(req,res) => {
    const name = string(req.body.name,'Nome',2,80);
    const userEmail = email(req.body.email);
    const password = validatePassword(req.body.password);
    if (db.prepare('SELECT id FROM users WHERE email=?').get(userEmail)) fail('Este e-mail já está cadastrado.',409);
    const userId = transaction(db,() => {
      let organizationId;
      if (req.body.inviteCode) {
        const org = db.prepare('SELECT id FROM organizations WHERE invite_code=?').get(string(req.body.inviteCode,'Código de convite',4,80).toUpperCase());
        if (!org) fail('Código de convite não encontrado. Confira com sua organização.');
        organizationId = org.id;
      } else {
        const orgName = string(req.body.organizationName,'Nome da organização',2,120);
        const type = req.body.organizationType;
        if (!['company','ngo'].includes(type)) fail('Selecione empresa ou ONG.');
        const city = string(req.body.city,'Cidade',2,80);
        const state = string(req.body.state,'UF',2,2).toUpperCase();
        if (!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(state)) fail('Informe uma UF válida.');
        organizationId = Number(db.prepare('INSERT INTO organizations (name,type,city,state,invite_code) VALUES (?,?,?,?,?)').run(orgName,type,city,state,randomBytes(8).toString('hex').toUpperCase()).lastInsertRowid);
      }
      return Number(db.prepare('INSERT INTO users (organization_id,name,email,password_hash) VALUES (?,?,?,?)').run(organizationId,name,userEmail,hashPassword(password)).lastInsertRowid);
    });
    res.status(201).json({user:session(req,res,userId)});
  });

  app.use('/api',(req,res,next) => {
    const token = readToken(req);
    const record = token && db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires_at>?').get(sessionHash(token),Date.now());
    if (!record) return res.status(401).json({error:'Entre na sua conta para continuar.'});
    req.user = currentUser(record.user_id);
    next();
  });
  app.get('/api/auth/me',(req,res) => res.json({user:req.user}));
  app.post('/api/auth/logout',(req,res) => {
    db.prepare('DELETE FROM sessions WHERE token=?').run(sessionHash(readToken(req)));
    res.clearCookie('smartscrap_session',{path:'/'}).json({ok:true});
  });

  const lotQuery = `SELECT l.*,o.name AS organization_name,o.type AS organization_type,
    (SELECT COUNT(*) FROM proposals p WHERE p.lot_id=l.id AND p.status='pending') AS proposal_count
    FROM lots l JOIN organizations o ON o.id=l.organization_id`;
  app.get('/api/lots',(req,res) => {
    const clauses = [], values = [];
    if (req.query.scope === 'mine') { clauses.push('l.organization_id=?'); values.push(req.user.organization_id); }
    else { clauses.push("l.status!='sold'"); clauses.push('l.organization_id!=?'); values.push(req.user.organization_id); }
    if (req.query.company) {clauses.push('l.organization_id=?');values.push(id(req.query.company));}
    if (req.query.material && materials.includes(req.query.material)) {clauses.push('l.material=?');values.push(req.query.material);}
    if (req.query.status && ['available','negotiating','sold'].includes(req.query.status)) {clauses.push('l.status=?');values.push(req.query.status);}
    if (req.query.q) {
      clauses.push('(l.title LIKE ? OR o.name LIKE ? OR l.material LIKE ?)');
      const term = `%${String(req.query.q).slice(0,120)}%`; values.push(term,term,term);
    }
    const lots = db.prepare(`${lotQuery} WHERE ${clauses.join(' AND ')} ORDER BY l.id DESC`).all(...values);
    res.json({lots});
  });
  app.get('/api/lots/:id',(req,res) => {
    const lot = db.prepare(`${lotQuery} WHERE l.id=?`).get(id(req.params.id));
    if (!lot) fail('Lote não encontrado.',404);
    const owned = lot.organization_id===req.user.organization_id;
    const proposals = db.prepare(`SELECT p.*,o.name AS organization_name,o.type AS organization_type FROM proposals p JOIN organizations o ON o.id=p.organization_id WHERE p.lot_id=? ${owned?'':'AND p.organization_id=?'} ORDER BY p.id DESC`).all(...(owned?[lot.id]:[lot.id,req.user.organization_id]));
    res.json({lot,proposals});
  });
  app.post('/api/lots',(req,res) => {
    const title = string(req.body.title,'Título',4,120);
    const material = req.body.material;
    if (!materials.includes(material)) fail('Selecione um material válido.');
    const weight = Number(req.body.weight);
    if (!Number.isFinite(weight) || weight<0.001 || weight>100000) fail('Informe o peso entre 0,001 e 100.000 toneladas.');
    const price = money(req.body.price);
    const quality = string(req.body.quality,'Qualidade',2,100);
    const description = string(req.body.description,'Descrição',10,2000);
    const lotId = Number(db.prepare('INSERT INTO lots (organization_id,title,material,weight,price_cents,quality,description,city,state,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.user.organization_id,title,material,weight,price,quality,description,req.user.city,req.user.state,req.user.id).lastInsertRowid);
    res.status(201).json({lot:db.prepare(`${lotQuery} WHERE l.id=?`).get(lotId)});
  });
  app.post('/api/lots/:id/proposals',(req,res) => {
    const lotId = id(req.params.id), price = money(req.body.price);
    const message = req.body.message ? string(req.body.message,'Mensagem',1,1000) : '';
    transaction(db,() => {
      const lot = db.prepare('SELECT * FROM lots WHERE id=?').get(lotId);
      if (!lot) fail('Lote não encontrado.',404);
      if (lot.organization_id===req.user.organization_id) fail('Sua organização não pode enviar propostas para seus próprios lotes.');
      if (lot.status==='sold') fail('Este lote já foi negociado.',409);
      if (db.prepare("SELECT id FROM proposals WHERE lot_id=? AND organization_id=? AND status='pending'").get(lotId,req.user.organization_id)) fail('Sua organização já tem uma proposta em análise para este lote.',409);
      db.prepare('INSERT INTO proposals (lot_id,organization_id,created_by,price_cents,message) VALUES (?,?,?,?,?)').run(lotId,req.user.organization_id,req.user.id,price,message);
      db.prepare("UPDATE lots SET status='negotiating' WHERE id=?").run(lotId);
      notify.run(lot.organization_id,'Nova proposta recebida',`${req.user.organization_name} enviou uma proposta para ${lot.title}.`,lotId);
    });
    res.status(201).json({ok:true});
  });
  app.get('/api/proposals',(req,res) => {
    const received = req.query.direction !== 'sent';
    const proposals = db.prepare(`SELECT p.*,l.title,l.material,l.weight,l.organization_id AS seller_id,o.name AS organization_name,
      s.name AS seller_name FROM proposals p JOIN lots l ON l.id=p.lot_id JOIN organizations o ON o.id=p.organization_id
      JOIN organizations s ON s.id=l.organization_id WHERE ${received?'l.organization_id':'p.organization_id'}=? ORDER BY p.id DESC`).all(req.user.organization_id);
    res.json({proposals});
  });
  app.patch('/api/proposals/:id',(req,res) => {
    const proposalId = id(req.params.id), status = req.body.status;
    if (!['accepted','rejected'].includes(status)) fail('Ação inválida.');
    transaction(db,() => {
      const proposal = db.prepare('SELECT p.*,l.organization_id AS seller_id,l.status AS lot_status,l.title,l.weight FROM proposals p JOIN lots l ON l.id=p.lot_id WHERE p.id=?').get(proposalId);
      if (!proposal) fail('Proposta não encontrada.',404);
      if (proposal.seller_id!==req.user.organization_id) fail('Somente a organização vendedora pode avaliar esta proposta.',403);
      if (proposal.status!=='pending' || proposal.lot_status==='sold') fail('Esta proposta já foi avaliada.',409);
      db.prepare('UPDATE proposals SET status=? WHERE id=?').run(status,proposalId);
      if (status==='accepted') {
        const tradeId = Number(db.prepare('INSERT INTO trades (lot_id,proposal_id,seller_id,buyer_id,total_cents) VALUES (?,?,?,?,?)').run(proposal.lot_id,proposalId,proposal.seller_id,proposal.organization_id,Math.round(proposal.weight*1000*proposal.price_cents)).lastInsertRowid);
        db.prepare('INSERT INTO pickups (trade_id) VALUES (?)').run(tradeId);
        db.prepare("UPDATE lots SET status='sold' WHERE id=?").run(proposal.lot_id);
        const other = db.prepare("SELECT organization_id FROM proposals WHERE lot_id=? AND id!=? AND status='pending'").all(proposal.lot_id,proposalId);
        db.prepare("UPDATE proposals SET status='rejected' WHERE lot_id=? AND id!=? AND status='pending'").run(proposal.lot_id,proposalId);
        other.forEach(p => notify.run(p.organization_id,'Lote negociado',`O lote ${proposal.title} foi negociado com outra organização.`,proposal.lot_id));
        notify.run(proposal.seller_id,'Negociação concluída',`A venda de ${proposal.title} foi confirmada. Organize a coleta.`,proposal.lot_id);
        notify.run(proposal.organization_id,'Sua proposta foi aceita',`A compra de ${proposal.title} foi confirmada. Organize a coleta.`,proposal.lot_id);
      } else {
        if (!db.prepare("SELECT id FROM proposals WHERE lot_id=? AND status='pending'").get(proposal.lot_id)) db.prepare("UPDATE lots SET status='available' WHERE id=?").run(proposal.lot_id);
        notify.run(proposal.organization_id,'Proposta avaliada',`Sua proposta para ${proposal.title} não foi aceita. Você pode enviar uma nova oferta.`,proposal.lot_id);
      }
    });
    res.json({ok:true});
  });
  app.get('/api/organizations',(req,res) => {
    const type = req.query.type === 'ngo' ? 'ngo' : 'company';
    const organizations = db.prepare(`SELECT o.id,o.name,o.type,o.city,o.state,o.sector,o.description,
      COUNT(l.id) AS total_lots,COALESCE(SUM(CASE WHEN l.status!='sold' THEN 1 ELSE 0 END),0) AS active_lots,
      COALESCE(SUM(l.weight),0) AS total_weight FROM organizations o JOIN lots l ON l.organization_id=o.id
      WHERE o.type=? GROUP BY o.id ORDER BY active_lots DESC,o.name`).all(type);
    res.json({organizations});
  });
  const pickupQuery = `SELECT p.*,t.lot_id,t.seller_id,t.buyer_id,t.total_cents,l.title,l.material,l.weight,l.city,l.state,
    s.name AS seller_name,b.name AS buyer_name FROM pickups p JOIN trades t ON t.id=p.trade_id
    JOIN lots l ON l.id=t.lot_id JOIN organizations s ON s.id=t.seller_id JOIN organizations b ON b.id=t.buyer_id`;
  app.get('/api/pickups',(req,res) => res.json({pickups:db.prepare(`${pickupQuery} WHERE t.seller_id=? OR t.buyer_id=? ORDER BY CASE WHEN p.status='delivered' THEN 1 ELSE 0 END,p.scheduled_date,p.id DESC`).all(req.user.organization_id,req.user.organization_id)}));
  app.patch('/api/pickups/:id',(req,res) => {
    transaction(db,() => {
      const pickup = db.prepare(`${pickupQuery} WHERE p.id=?`).get(id(req.params.id));
      if (!pickup) fail('Coleta não encontrada.',404);
      if (![pickup.seller_id,pickup.buyer_id].includes(req.user.organization_id)) fail('Você não participa desta negociação.',403);
      const next = {awaiting:'scheduled',scheduled:'transit',transit:'delivered'}[pickup.status];
      if (!next || req.body.status!==next) fail('Atualização inválida. Siga as etapas da coleta.',409);
      const date = req.body.scheduledDate || pickup.scheduled_date;
      if (next==='scheduled') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date || date<new Date().toISOString().slice(0,10)) fail('Escolha uma data válida a partir de hoje.');
      }
      const carrier = req.body.carrier !== undefined ? string(req.body.carrier,'Transportadora',2,120) : pickup.carrier;
      db.prepare("UPDATE pickups SET status=?,scheduled_date=?,carrier=?,updated_at=datetime('now') WHERE id=?").run(next,date,carrier,pickup.id);
      const label = {scheduled:'Coleta agendada',transit:'Material em transporte',delivered:'Entrega concluída'}[next];
      [pickup.seller_id,pickup.buyer_id].forEach(org => notify.run(org,label,`${pickup.title}: ${label.toLowerCase()}.`,pickup.lot_id));
    });
    res.json({ok:true});
  });
  app.get('/api/dashboard',(req,res) => {
    const orgId = req.user.organization_id;
    const days = [7,30,90,365].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const start = new Date(Date.now()-days*86400000).toISOString().slice(0,19).replace('T',' ');
    const previous = new Date(Date.now()-2*days*86400000).toISOString().slice(0,19).replace('T',' ');
    const trades = db.prepare(`SELECT t.*,l.weight,l.material FROM trades t JOIN lots l ON l.id=t.lot_id WHERE (t.seller_id=? OR t.buyer_id=?) AND t.created_at>=? ORDER BY t.created_at`).all(orgId,orgId,previous);
    const aggregate = rows => ({sold:rows.filter(t=>t.seller_id===orgId).reduce((s,t)=>s+t.weight,0),bought:rows.filter(t=>t.buyer_id===orgId).reduce((s,t)=>s+t.weight,0),value:rows.reduce((s,t)=>s+t.total_cents,0)/100});
    const currentTrades = trades.filter(t=>t.created_at>=start);
    const stats = aggregate(currentTrades), prev = aggregate(trades.filter(t=>t.created_at<start));
    const active = db.prepare("SELECT COUNT(*) AS count FROM lots WHERE organization_id=? AND status!='sold'").get(orgId).count;
    const pending = db.prepare("SELECT COUNT(*) AS count FROM proposals p JOIN lots l ON l.id=p.lot_id WHERE l.organization_id=? AND p.status='pending'").get(orgId).count;
    const composition = materials.map(material=>({material,weight:currentTrades.filter(t=>t.material===material && t.seller_id===orgId).reduce((s,t)=>s+t.weight,0)})).filter(m=>m.weight>0);
    const chart = Array.from({length:8},(_,i)=>{
      const from = Date.now()-days*86400000+i*days*86400000/8;
      const to = from+days*86400000/8;
      const rows = currentTrades.filter(t=>{const time=Date.parse(t.created_at.replace(' ','T')+'Z');return time>=from && time<to;});
      return {date:new Date(to).toISOString().slice(0,10),...aggregate(rows)};
    });
    const lots = db.prepare(`${lotQuery} WHERE l.organization_id=? AND l.status!='sold' ORDER BY l.id LIMIT 5`).all(orgId);
    const pickups = db.prepare(`${pickupQuery} WHERE (t.seller_id=? OR t.buyer_id=?) AND p.status!='delivered' ORDER BY p.scheduled_date LIMIT 3`).all(orgId,orgId);
    res.json({stats:{...stats,active,pending},previous:prev,composition,chart,lots,pickups,days});
  });
  app.get('/api/notifications',(req,res) => res.json({notifications:db.prepare('SELECT * FROM notifications WHERE organization_id=? ORDER BY id DESC LIMIT 60').all(req.user.organization_id)}));
  app.patch('/api/notifications/read',(req,res) => {
    db.prepare('UPDATE notifications SET is_read=1 WHERE organization_id=?').run(req.user.organization_id);
    res.json({ok:true});
  });
  app.get('/api/team',(req,res) => res.json({members:db.prepare('SELECT id,name,email,created_at FROM users WHERE organization_id=? ORDER BY id').all(req.user.organization_id)}));
  app.patch('/api/profile',(req,res) => {
    const name = string(req.body.name,'Nome',2,80), userEmail = email(req.body.email);
    const existing = db.prepare('SELECT id FROM users WHERE email=? AND id!=?').get(userEmail,req.user.id);
    if (existing) fail('Este e-mail já está em uso.',409);
    if (req.body.newPassword) {
      const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);
      const oldPassword = string(req.body.currentPassword,'Senha atual',1,128);
      if (!verifyPassword(oldPassword,user.password_hash)) fail('A senha atual está incorreta.');
      const password = validatePassword(req.body.newPassword);
      transaction(db,()=>{
        db.prepare('UPDATE users SET name=?,email=?,password_hash=? WHERE id=?').run(name,userEmail,hashPassword(password),req.user.id);
        db.prepare('DELETE FROM sessions WHERE user_id=? AND token!=?').run(req.user.id,sessionHash(readToken(req)));
      });
    } else db.prepare('UPDATE users SET name=?,email=? WHERE id=?').run(name,userEmail,req.user.id);
    res.json({user:currentUser(req.user.id)});
  });
  app.use('/api',(req,res) => res.status(404).json({error:'Recurso não encontrado.'}));
  app.use((error,req,res,next) => {
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({error:'JSON inválido.'});
    if (error.status) return res.status(error.status).json({error:error.message});
    console.error(error);
    res.status(500).json({error:'Não foi possível concluir a operação. Tente novamente.'});
  });
  return app;
}
