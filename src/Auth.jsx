import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
  Recycle,
  ShieldCheck,
  Sprout,
  Truck,
} from 'lucide-react';
import { api } from './api.js';
import { Brand, Button, ErrorMessage, Field, ImpactArt } from './components.jsx';

export default function Auth({ onLogin }) {
  const [register, setRegister] = useState(false);
  const [join, setJoin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [orgType, setOrgType] = useState('company');
  async function submit(event, demo = false) {
    event?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const form = demo
        ? {
            email: 'ana@horizonte.com.br',
            password: 'Demo@123',
          }
        : Object.fromEntries(new FormData(event.currentTarget));
      if (register && !demo) {
        form.organizationType = orgType;
        if (!join) {
          delete form.inviteCode;
        }
      }
      const data = await api(`/auth/${register && !demo ? 'register' : 'login'}`, {
        method: 'POST',
        body: form,
      });
      onLogin(data.user);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <span className="story-tag">
            <span /> A indústria se transforma aqui
          </span>
          <h1>
            O fim de um ciclo.
            <br />O começo de
            <br />
            <em>novas possibilidades.</em>
          </h1>
          <p>
            Conectamos quem tem materiais a quem vê oportunidades. Mais valor para sua empresa,
            menos resíduos para o planeta.
          </p>
          <div className="auth-benefits">
            <span>
              <Recycle size={19} /> Economia circular na prática
            </span>
            <span>
              <Building2 size={19} /> Empresas e ONGs conectadas
            </span>
            <span>
              <ShieldCheck size={19} /> Negociações em um só lugar
            </span>
          </div>
        </div>
        <ImpactArt className="auth-art" />
        <div className="auth-story-footer">
          <span>Transformar é seguir em frente.</span>
          <Leaf size={19} />
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-form-container">
          <div className="auth-mobile-brand">
            <Brand dark />
          </div>
          <span className="eyebrow">BEM-VINDO À ECONOMIA CIRCULAR</span>
          <h2>{register ? 'Vamos transformar juntos?' : 'Bom ter você de volta.'}</h2>
          <p className="auth-intro">
            {register
              ? 'Crie sua conta e conecte sua organização a novas oportunidades.'
              : 'Entre para acompanhar os resultados da sua empresa e encontrar novas oportunidades.'}
          </p>
          <form onSubmit={submit} className="auth-form">
            <ErrorMessage error={error} />
            {register && (
              <>
                <Field label="Seu nome">
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Como podemos chamar você?"
                  />
                </Field>
                <div className="segmented">
                  <button
                    type="button"
                    className={!join ? 'active' : ''}
                    onClick={() => setJoin(false)}
                  >
                    Nova organização
                  </button>
                  <button
                    type="button"
                    className={join ? 'active' : ''}
                    onClick={() => setJoin(true)}
                  >
                    Já faço parte de uma
                  </button>
                </div>
                {join ? (
                  <Field
                    label="Código de convite"
                    hint="Peça o código a um colega nas configurações da organização."
                  >
                    <input
                      name="inviteCode"
                      required
                      minLength={4}
                      placeholder="Código da empresa ou ONG"
                    />
                  </Field>
                ) : (
                  <>
                    <div className="org-type-choice">
                      <button
                        type="button"
                        className={orgType === 'company' ? 'selected' : ''}
                        aria-pressed={orgType === 'company'}
                        onClick={() => setOrgType('company')}
                      >
                        <Building2 size={20} />
                        <span>Empresa privada</span>
                      </button>
                      <button
                        type="button"
                        className={orgType === 'ngo' ? 'selected' : ''}
                        aria-pressed={orgType === 'ngo'}
                        onClick={() => setOrgType('ngo')}
                      >
                        <Sprout size={20} />
                        <span>ONG / Cooperativa</span>
                      </button>
                      <button
                        type="button"
                        className={orgType === 'carrier' ? 'selected' : ''}
                        aria-pressed={orgType === 'carrier'}
                        onClick={() => setOrgType('carrier')}
                      >
                        <Truck size={20} />
                        <span>Transportadora</span>
                      </button>
                    </div>
                    <Field label="Nome da organização">
                      <input
                        name="organizationName"
                        autoComplete="organization"
                        required
                        minLength={2}
                        maxLength={120}
                        placeholder="Nome da sua empresa ou ONG"
                      />
                    </Field>
                    <div className="form-row city-row">
                      <Field label="Cidade">
                        <input
                          name="city"
                          required
                          minLength={2}
                          maxLength={80}
                          placeholder="São Paulo"
                        />
                      </Field>
                      <Field label="UF">
                        <select name="state" defaultValue="SP">
                          {'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'
                            .split(' ')
                            .map((state) => (
                              <option key={state}>{state}</option>
                            ))}
                        </select>
                      </Field>
                    </div>
                  </>
                )}
              </>
            )}
            <Field label="E-mail">
              <div className="input-icon">
                <Mail size={18} />
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={180}
                  placeholder="voce@empresa.com.br"
                />
              </div>
            </Field>
            <Field label="Senha" hint={register ? 'Use pelo menos 8 caracteres.' : undefined}>
              <div className="input-icon">
                <LockKeyhole size={18} />
                <input
                  name="password"
                  aria-label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  required
                  minLength={register ? 8 : 1}
                  maxLength={128}
                  placeholder={register ? 'Crie uma senha segura' : 'Digite sua senha'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <Button className="auth-submit" loading={busy} type="submit">
              {register ? 'Criar minha conta' : 'Entrar na plataforma'}
              <ArrowRight size={18} />
            </Button>
          </form>
          <p className="auth-switch">
            {register ? 'Já tem uma conta?' : 'Sua empresa ainda não faz parte?'}{' '}
            <button
              onClick={() => {
                setRegister(!register);
                setError(null);
              }}
            >
              {register ? 'Entrar' : 'Cadastre-se'}
            </button>
          </p>
          {!register && (
            <div className="demo-box">
              <div>
                <span className="demo-icon">
                  <Leaf size={21} />
                </span>
                <div>
                  <strong>Conheça a SmartScrap</strong>
                  <small>Explore a plataforma com dados de exemplo.</small>
                </div>
              </div>
              <Button variant="secondary" onClick={() => submit(null, true)} loading={busy}>
                Explorar demonstração
                <ArrowUpRight size={16} />
              </Button>
            </div>
          )}
          <p className="auth-footnote">
            <ShieldCheck size={14} /> Seu próximo ciclo começa com uma conexão.
          </p>
        </div>
        <span className="auth-copyright">© {new Date().getFullYear()} SmartScrap Exchange</span>
      </section>
    </main>
  );
}
