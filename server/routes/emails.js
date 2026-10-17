export function registerEmailRoutes(app, { db, email }) {
  app.get('/api/emails', (req, res) => {
    const messages = db
      .prepare(
        `SELECT id,recipient,subject,body,status,attempts,error,created_at,sent_at
      FROM email_outbox WHERE user_id=? ORDER BY id DESC LIMIT 60`,
      )
      .all(req.user.id);
    res.json({ ...email.status(), messages });
  });
}
