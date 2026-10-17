import { fail, string, email, validatePassword } from '../validation.js';
import { hashPassword, verifyPassword, transaction } from '../database.js';
import { sessionHash } from '../services/auth.js';

export function registerProfileRoutes(app, { db, auth }) {
  const { currentUser, readToken } = auth;
  app.get('/api/team', (req, res) =>
    res.json({
      members: db
        .prepare('SELECT id,name,email,created_at FROM users WHERE organization_id=? ORDER BY id')
        .all(req.user.organization_id),
    }),
  );
  app.patch('/api/profile', (req, res) => {
    const name = string(req.body.name, 'Nome', 2, 80);
    const userEmail = email(req.body.email);
    const existing = db
      .prepare('SELECT id FROM users WHERE email=? AND id!=?')
      .get(userEmail, req.user.id);
    if (existing) {
      fail('Este e-mail já está em uso.', 409);
    }
    if (req.body.newPassword) {
      const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);
      const oldPassword = string(req.body.currentPassword, 'Senha atual', 1, 128);
      if (!verifyPassword(oldPassword, user.password_hash)) {
        fail('A senha atual está incorreta.');
      }
      const password = validatePassword(req.body.newPassword);
      transaction(db, () => {
        db.prepare('UPDATE users SET name=?,email=?,password_hash=? WHERE id=?').run(
          name,
          userEmail,
          hashPassword(password),
          req.user.id,
        );
        db.prepare('DELETE FROM sessions WHERE user_id=? AND token!=?').run(
          req.user.id,
          sessionHash(readToken(req)),
        );
      });
    } else {
      db.prepare('UPDATE users SET name=?,email=? WHERE id=?').run(name, userEmail, req.user.id);
    }
    res.json({
      user: currentUser(req.user.id),
    });
  });
}
