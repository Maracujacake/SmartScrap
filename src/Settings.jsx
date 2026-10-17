import { useState } from 'react';
import { Building2, Check, Copy, KeyRound, Users } from 'lucide-react';
import { useData } from './hooks/useData.js';
import { api, initials } from './api.js';
import {
  Button,
  ErrorMessage,
  Field,
  LoadState,
  PageHeading,
  PanelHeading,
} from './components.jsx';

export default function Settings({ user, onUserChanged, toast, revision }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const team = useData('/team', revision);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = event.currentTarget;
    try {
      const { user: updated } = await api('/profile', {
        method: 'PATCH',
        body: Object.fromEntries(new FormData(form)),
      });
      onUserChanged(updated);
      form.elements.currentPassword.value = '';
      form.elements.newPassword.value = '';
      toast('Perfil atualizado com sucesso.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(user.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast('Selecione e copie o código de convite.');
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="SEU ESPAÇO NA ECONOMIA CIRCULAR"
        title="Configurações"
        description="Cuide do seu perfil e conecte sua equipe à organização."
      />
      <div className="settings-grid">
        <section className="panel settings-profile">
          <PanelHeading icon={Users} title="Meu perfil" />
          <div className="profile-intro">
            <span className="profile-avatar large">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.organization_name}</span>
            </div>
            <span className="profile-tag">Membro da equipe</span>
          </div>
          <form className="settings-form" onSubmit={save}>
            <ErrorMessage error={error} />
            <Field label="Nome completo">
              <input
                name="name"
                autoComplete="name"
                defaultValue={user.name}
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
            <Field label="E-mail de acesso">
              <input
                type="email"
                name="email"
                autoComplete="email"
                defaultValue={user.email}
                required
                maxLength={180}
              />
            </Field>
            <div className="form-divider">
              <KeyRound size={16} />
              <h3>Alterar senha</h3>
              <span>Opcional</span>
            </div>
            <div className="form-row">
              <Field label="Senha atual">
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  placeholder="Digite sua senha atual"
                  maxLength={128}
                />
              </Field>
              <Field label="Nova senha">
                <input
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  placeholder="Pelo menos 8 caracteres"
                  minLength={8}
                  maxLength={128}
                />
              </Field>
            </div>
            <div className="settings-save">
              <Button type="submit" loading={busy}>
                Salvar alterações
                <Check size={16} />
              </Button>
            </div>
          </form>
        </section>
        <div className="settings-side">
          <section className="panel org-settings">
            <PanelHeading icon={Building2} title="Minha organização" />
            <div className="org-settings-name">
              <span className="org-avatar">{initials(user.organization_name)}</span>
              <div>
                <h3>{user.organization_name}</h3>
                <span>
                  {user.organization_type === 'carrier'
                    ? 'Transportadora'
                    : user.organization_type === 'ngo'
                      ? 'ONG / Cooperativa'
                      : 'Empresa privada'}{' '}
                  · {user.city}, {user.state}
                </span>
              </div>
            </div>
            <p className="muted">
              {user.organization_type === 'carrier'
                ? 'Transportes, tarifas e indicadores são compartilhados entre todos os membros desta transportadora.'
                : 'Lotes, propostas, negociações e indicadores são compartilhados entre todos os membros desta organização.'}
            </p>
            <div className="invite-code">
              <strong>Convide sua equipe</strong>
              <p>Compartilhe o código para que colegas se cadastrem na mesma organização.</p>
              <div>
                <code>{user.invite_code}</code>
                <button
                  className="icon-button"
                  aria-label="Copiar código de convite"
                  onClick={copy}
                >
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                </button>
              </div>
              <small>Compartilhe apenas com pessoas da sua organização.</small>
            </div>
          </section>
          <section className="panel team-panel">
            <PanelHeading icon={Users} title="Pessoas da organização" />
            <LoadState state={team}>
              {({ members }) => (
                <div className="team-list">
                  {members.map((member) => (
                    <div key={member.id}>
                      <span className="team-avatar">{initials(member.name)}</span>
                      <span>
                        <strong>
                          {member.name}
                          {member.id === user.id && <small> (você)</small>}
                        </strong>
                        <small>{member.email}</small>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </LoadState>
          </section>
        </div>
      </div>
    </>
  );
}
