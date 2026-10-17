export function registerNotificationRoutes(app, { db }) {
  app.get('/api/notifications', (req, res) =>
    res.json({
      notifications: db
        .prepare('SELECT * FROM notifications WHERE organization_id=? ORDER BY id DESC LIMIT 60')
        .all(req.user.organization_id),
    }),
  );
  app.patch('/api/notifications/read', (req, res) => {
    db.prepare('UPDATE notifications SET is_read=1 WHERE organization_id=?').run(
      req.user.organization_id,
    );
    res.json({
      ok: true,
    });
  });
}
