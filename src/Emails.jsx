import { Mail, RefreshCw } from 'lucide-react';
import { useData } from './hooks/useData.js';
import { Button, Empty, LoadState, PageHeading } from './components.jsx';

const statusLabel = {
  pending: 'Aguardando envio',
  sending: 'Enviando',
  sent: 'Enviado',
  failed: 'Falha no envio',
};

export default function Emails({ revision }) {
  const state = useData('/emails', revision);
  return (
    <>
      <PageHeading
        eyebrow="ACOMPANHE SUAS CONFIRMAÇÕES"
        title="E-mails"
        description="Histórico das mensagens destinadas ao seu endereço de e-mail."
        action={
          <Button variant="secondary" onClick={state.retry}>
            <RefreshCw size={16} />
            Atualizar
          </Button>
        }
      />
      <LoadState state={state}>
        {({ configured, messages }) => (
          <>
            <div className="transport-note">
              <Mail size={20} />
              <p>
                {configured
                  ? 'O envio está configurado. O status Enviado confirma o aceite pelo serviço de e-mail; a entrega na caixa de entrada pode ocorrer depois.'
                  : 'O envio de e-mails ainda não foi configurado. As mensagens ficam registradas e aguardam a configuração para serem enviadas.'}{' '}
                Uma falha no e-mail não desfaz a publicação ou proposta.
              </p>
            </div>
            <div className="email-list">
              {messages.length ? (
                messages.map((message) => (
                  <article className="panel email-card" key={message.id}>
                    <div className="email-heading">
                      <h2>{message.subject}</h2>
                      <span className={`email-status email-${message.status}`}>
                        {statusLabel[message.status]}
                      </span>
                    </div>
                    <p>
                      Para: {message.recipient} ·{' '}
                      {new Date(message.created_at.replace(' ', 'T') + 'Z').toLocaleString('pt-BR')}
                    </p>
                    <pre>{message.body}</pre>
                    {message.error && (
                      <p className="email-error">
                        {message.error}
                        {message.attempts >= 3
                          ? ' Foram feitas três tentativas.'
                          : ' Uma nova tentativa será feita automaticamente.'}
                      </p>
                    )}
                  </article>
                ))
              ) : (
                <section className="panel">
                  <Empty
                    title="Nenhum e-mail registrado"
                    description="Confirmações de publicação e de propostas aparecerão aqui."
                  />
                </section>
              )}
            </div>
          </>
        )}
      </LoadState>
    </>
  );
}
