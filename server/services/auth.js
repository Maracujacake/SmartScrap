import { randomBytes, createHash } from 'node:crypto';

const sessionHash = (token) => createHash('sha256').update(token).digest('hex');

export function createAuthService(db) {
  const attempts = new Map();
  function limitAuth(req, res, next) {
    const now = Date.now();
    for (const [key, value] of attempts)
      if (value.until < now) {
        attempts.delete(key);
      }
    const key = req.ip;
    const state = attempts.get(key) || {
      count: 0,
      until: now + 15 * 60 * 1000,
    };
    state.count++;
    attempts.set(key, state);
    if (state.count > 60) {
      return res.status(429).json({
        error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.',
      });
    }
    next();
  }
  function currentUser(userId) {
    return db
      .prepare(
        `SELECT u.id,u.name,u.email,u.organization_id,o.name AS organization_name,o.type AS organization_type,
      o.city,o.state,o.sector,o.description,o.invite_code,
      (SELECT id FROM transport_companies WHERE organization_id=o.id) AS transport_company_id
      FROM users u JOIN organizations o ON o.id=u.organization_id WHERE u.id=?`,
      )
      .get(userId);
  }
  function session(req, res, userId) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').run(
      sessionHash(token),
      userId,
      Date.now() + 7 * 86400000,
    );
    res.cookie('smartscrap_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 7 * 86400000,
      path: '/',
    });
    return currentUser(userId);
  }
  function readToken(req) {
    return /(?:^|;\s*)smartscrap_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  }
  const authenticate = (req, res, next) => {
    const token = readToken(req);
    const record =
      token &&
      db
        .prepare('SELECT user_id FROM sessions WHERE token=? AND expires_at>?')
        .get(sessionHash(token), Date.now());
    if (!record) {
      return res.status(401).json({
        error: 'Entre na sua conta para continuar.',
      });
    }
    req.user = currentUser(record.user_id);
    next();
  };
  return {
    limitAuth,
    currentUser,
    session,
    readToken,
    authenticate,
  };
}

export { sessionHash };
