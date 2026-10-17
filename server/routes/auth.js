import { fail, string, email, validatePassword } from '../validation.js';
import { hashPassword, verifyPassword, transaction } from '../database.js';
import { randomBytes } from 'node:crypto';
import { sessionHash } from '../services/auth.js';

export function registerPublicAuthRoutes(app, { db, auth }) {
  const { limitAuth, session } = auth;
  app.post('/api/auth/login', limitAuth, (req, res) => {
    const loginEmail = email(req.body.email);
    const password = string(req.body.password, 'Senha', 1, 128);
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(loginEmail);
    if (!user || !verifyPassword(password, user.password_hash)) {
      fail('E-mail ou senha incorretos.', 401);
    }
    res.json({
      user: session(req, res, user.id),
    });
  });
  app.post('/api/auth/register', limitAuth, (req, res) => {
    const name = string(req.body.name, 'Nome', 2, 80);
    const userEmail = email(req.body.email);
    const password = validatePassword(req.body.password);
    if (db.prepare('SELECT id FROM users WHERE email=?').get(userEmail)) {
      fail('Este e-mail já está cadastrado.', 409);
    }
    const userId = transaction(db, () => {
      let organizationId;
      if (req.body.inviteCode) {
        const org = db
          .prepare('SELECT id FROM organizations WHERE invite_code=?')
          .get(string(req.body.inviteCode, 'Código de convite', 4, 80).toUpperCase());
        if (!org) {
          fail('Código de convite não encontrado. Confira com sua organização.');
        }
        organizationId = org.id;
      } else {
        const orgName = string(req.body.organizationName, 'Nome da organização', 2, 120);
        const type = req.body.organizationType;
        if (!['company', 'ngo', 'carrier'].includes(type)) {
          fail('Selecione empresa, ONG/cooperativa ou transportadora.');
        }
        const city = string(req.body.city, 'Cidade', 2, 80);
        const state = string(req.body.state, 'UF', 2, 2).toUpperCase();
        if (
          !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(
            state,
          )
        ) {
          fail('Informe uma UF válida.');
        }
        organizationId = Number(
          db
            .prepare(
              'INSERT INTO organizations (name,type,city,state,invite_code) VALUES (?,?,?,?,?)',
            )
            .run(orgName, type, city, state, randomBytes(8).toString('hex').toUpperCase())
            .lastInsertRowid,
        );
        if (type === 'carrier') {
          if (db.prepare('SELECT id FROM transport_companies WHERE name=?').get(orgName))
            fail(
              'Já existe uma transportadora com este nome. Use o convite da equipe ou outro nome.',
              409,
            );
          db.prepare(
            'INSERT INTO transport_companies(name,city,state,organization_id) VALUES (?,?,?,?)',
          ).run(orgName, city, state, organizationId);
        }
      }
      return Number(
        db
          .prepare('INSERT INTO users (organization_id,name,email,password_hash) VALUES (?,?,?,?)')
          .run(organizationId, name, userEmail, hashPassword(password)).lastInsertRowid,
      );
    });
    res.status(201).json({
      user: session(req, res, userId),
    });
  });
}

export function registerPrivateAuthRoutes(app, { db, auth }) {
  const { readToken } = auth;
  app.get('/api/auth/me', (req, res) =>
    res.json({
      user: req.user,
    }),
  );
  app.post('/api/auth/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token=?').run(sessionHash(readToken(req)));
    res
      .clearCookie('smartscrap_session', {
        path: '/',
      })
      .json({
        ok: true,
      });
  });
}
