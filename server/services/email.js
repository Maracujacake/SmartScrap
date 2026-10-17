import nodemailer from 'nodemailer';

export function createEmailService(db, options = {}) {
  const env = options.env || process.env;
  const configured = Boolean(env.SMTP_HOST && env.SMTP_FROM);
  const transport =
    options.transport ||
    (configured
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT || 587),
          secure: env.SMTP_SECURE === 'true',
          requireTLS: env.SMTP_SECURE !== 'true',
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
          disableFileAccess: true,
          disableUrlAccess: true,
        })
      : null);
  const from = options.from || env.SMTP_FROM;
  let closed = false,
    running = false,
    timer;
  // SMTP acceptance cannot be atomically committed with SQLite. Interrupted deliveries
  // are retried with a stable Message-ID; an ambiguous SMTP disconnect can duplicate mail.
  db.prepare("UPDATE email_outbox SET status='pending' WHERE status='sending'").run();

  function enqueue(userId, eventKey, subject, body) {
    const user = db.prepare('SELECT email FROM users WHERE id=?').get(userId);
    if (user)
      db.prepare(
        'INSERT OR IGNORE INTO email_outbox(user_id,event_key,recipient,subject,body) VALUES (?,?,?,?,?)',
      ).run(userId, eventKey, user.email, subject, body);
  }
  function organization(organizationId, eventKey, subject, body) {
    for (const member of db
      .prepare('SELECT id FROM users WHERE organization_id=?')
      .all(organizationId))
      enqueue(member.id, eventKey, subject, body);
  }
  async function flush() {
    if (running || closed || !transport || !from) return;
    running = true;
    try {
      const messages = db
        .prepare(
          "SELECT * FROM email_outbox WHERE status IN ('pending','failed') AND attempts<3 AND next_attempt_at<=? ORDER BY id LIMIT 20",
        )
        .all(Date.now());
      for (const message of messages) {
        if (closed) break;
        db.prepare("UPDATE email_outbox SET status='sending',attempts=attempts+1 WHERE id=?").run(
          message.id,
        );
        try {
          const result = await transport.sendMail({
            from,
            to: message.recipient,
            subject: message.subject,
            text: message.body,
            messageId: `<smartscrap-${message.id}-${message.user_id}@notifications.smartscrap.local>`,
          });
          if (result.rejected?.length) throw new Error('Destinatário recusado pelo servidor SMTP.');
          if (!closed)
            db.prepare(
              "UPDATE email_outbox SET status='sent',error=NULL,sent_at=datetime('now') WHERE id=?",
            ).run(message.id);
        } catch {
          // Never persist raw SMTP errors, which may contain provider details or credentials.
          if (!closed)
            db.prepare(
              "UPDATE email_outbox SET status='failed',error=?,next_attempt_at=? WHERE id=?",
            ).run(
              'Não foi possível enviar. Confira o endereço e a configuração SMTP.',
              Date.now() + (message.attempts + 1) * 60000,
              message.id,
            );
        }
      }
    } finally {
      running = false;
    }
  }
  if (transport && from && options.autoStart !== false) {
    timer = setInterval(() => {
      void flush().catch(() => console.error('Falha ao consultar a fila de e-mails.'));
    }, 2000);
    timer.unref();
  }
  return {
    enqueue,
    organization,
    flush,
    status: () => ({ configured: Boolean(transport && from), mode: 'smtp' }),
    close() {
      closed = true;
      clearInterval(timer);
      transport?.close?.();
    },
  };
}
