import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import nodemailer from 'nodemailer';
import { createDatabase } from '../server/database.js';
import { createEmailService } from '../server/services/email.js';

test('fila usa SMTP real em servidor local de teste e evita repetir eventos', async () => {
  const received = [];
  const server = createServer((socket) => {
    socket.setEncoding('utf8');
    socket.write('220 localhost SMTP test\r\n');
    let buffer = '',
      data = false;
    socket.on('data', (chunk) => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        if (data) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end < 0) return;
          received.push(buffer.slice(0, end));
          buffer = buffer.slice(end + 5);
          data = false;
          socket.write('250 2.0.0 accepted\r\n');
        } else {
          const end = buffer.indexOf('\r\n'),
            command = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (/^EHLO/.test(command)) socket.write('250-localhost\r\n250 PIPELINING\r\n');
          else if (command === 'DATA') {
            data = true;
            socket.write('354 Send message\r\n');
          } else if (command === 'QUIT') socket.end('221 Goodbye\r\n');
          else socket.write('250 OK\r\n');
        }
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const db = createDatabase(':memory:');
  const transport = nodemailer.createTransport({
    host: '127.0.0.1',
    port: server.address().port,
    secure: false,
    ignoreTLS: true,
  });
  const email = createEmailService(db, {
    env: {},
    transport,
    from: 'SmartScrap <test@smartscrap.example>',
    autoStart: false,
  });
  try {
    email.enqueue(1, 'lot:123', 'Lote publicado', 'Seu lote foi publicado com sucesso.');
    email.enqueue(1, 'lot:123', 'Lote publicado', 'Mensagem repetida.');
    await email.flush();
    await email.flush();
    assert.equal(received.length, 1);
    assert.match(received[0], /To: ana@horizonte.com.br/);
    assert.match(received[0], /Seu lote foi publicado/);
    assert.equal(db.prepare('SELECT status,attempts FROM email_outbox').get().status, 'sent');
    assert.equal(db.prepare('SELECT attempts FROM email_outbox').get().attempts, 1);
  } finally {
    email.close();
    db.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('falha SMTP não expõe detalhes, tem limite de tentativas e recupera fila interrompida', async () => {
  const db = createDatabase(':memory:');
  let attempts = 0;
  const email = createEmailService(db, {
    env: {},
    autoStart: false,
    from: 'test@example.test',
    transport: {
      async sendMail() {
        attempts++;
        throw new Error('password=segredo-de-teste');
      },
    },
  });
  try {
    email.enqueue(1, 'event:failure', 'Teste', 'Conteúdo');
    for (let index = 0; index < 4; index++) {
      db.prepare('UPDATE email_outbox SET next_attempt_at=0').run();
      await email.flush();
    }
    const message = db.prepare('SELECT * FROM email_outbox').get();
    assert.equal(attempts, 3);
    assert.equal(message.status, 'failed');
    assert.equal(message.attempts, 3);
    assert.ok(!message.error.includes('segredo'));
    db.prepare("UPDATE email_outbox SET status='sending',attempts=1").run();
    const restarted = createEmailService(db, { env: {}, autoStart: false });
    assert.equal(db.prepare('SELECT status FROM email_outbox').get().status, 'pending');
    restarted.close();
  } finally {
    email.close();
    db.close();
  }
});
