import { useState, useRef, FormEvent, KeyboardEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import { login as doLogin } from '../lib/auth';
import logoAgarcorp from '../assets/LOGO_AGAR_SVG_FONDOBLANCO.svg';

const NAVY = {
  void: '#070B12',
  surface: '#0D1420',
  elevated: '#141E30',
  border: '#1E2B40',
  accent: '#3B82F6',
  accentDim: '#1D4ED8',
  textPrimary: '#E8EEF7',
  textSecondary: '#8FA3BD',
  textMuted: '#4A5B73',
  danger: '#DC2626',
  dangerDim: '#3F0E0E',
};

export function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Usuario y contraseña requeridos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.login(username.trim(), password);
      doLogin(res.access_token, res.user);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: NAVY.elevated,
    border: `1px solid ${NAVY.border}`,
    borderRadius: 3,
    padding: '10px 14px',
    color: NAVY.textPrimary,
    fontSize: '0.875rem',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  const onFocusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = NAVY.accent;
    e.target.style.boxShadow = `0 0 0 2px rgba(59,130,246,0.18)`;
  };
  const onBlurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = NAVY.border;
    e.target.style.boxShadow = 'none';
  };

  return (
    <div
      className="h-full flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: NAVY.void }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(59,130,246,0.16) 0%, rgba(59,130,246,0.04) 45%, rgba(7,11,18,0) 100%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 40% at 50% 0%, rgba(59,130,246,0.12), transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-scanline"
      />

      <div
        className="relative w-full max-w-[400px] rounded-md"
        style={{
          background: NAVY.surface,
          border: `1px solid ${NAVY.border}`,
          boxShadow: '0 24px 64px -16px rgba(0,0,0,0.8)',
        }}
      >
        <div
          className="h-1 w-full rounded-t-md"
          style={{ background: `linear-gradient(90deg, ${NAVY.accentDim}, ${NAVY.accent}, ${NAVY.accentDim})` }}
        />

        <div
          className="absolute left-1/2 -top-7 -translate-x-1/2 z-10"
          style={{ animation: 'tileIn 0.5s ease both' }}
        >
          <div className="relative flex flex-col items-center" style={{ width: 58 }}>
            <div
              style={{
                width: 16,
                height: 8,
                borderRadius: '50%',
                background: NAVY.elevated,
                border: `1px solid ${NAVY.border}`,
                boxShadow: `0 0 10px rgba(59,130,246,0.3)`,
                marginBottom: -1,
              }}
            />
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: 46,
                  height: 22,
                  borderRadius: 5,
                  background: NAVY.elevated,
                  border: `1px solid ${NAVY.border}`,
                  boxShadow: `0 4px 14px rgba(0,0,0,0.5), 0 0 16px rgba(59,130,246,0.25)`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 6px',
                }}
              >
                <div
                  className="animate-cctv-pan"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: NAVY.void,
                    border: `2px solid ${NAVY.accent}`,
                    boxShadow: 'inset 0 0 4px rgba(59,130,246,0.6)',
                    flexShrink: 0,
                  }}
                />
                <span
                  className="absolute flex items-center justify-center rounded-full"
                  style={{ width: 8, height: 8, background: NAVY.danger, top: -4, right: -2, zIndex: 2 }}
                >
                  <span
                    className="absolute inset-0 rounded-full animate-ping"
                    style={{ background: 'rgba(220,38,38,0.6)' }}
                  />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-10 pt-10 pb-7">
          <div className="flex flex-col items-center mb-7">
            <img src={logoAgarcorp} alt="AGARCORP" style={{ width: 150, height: 'auto', display: 'block' }} />
            <h1
              className="font-mono text-center"
              style={{ fontSize: '1.05rem', fontWeight: 600, color: NAVY.textPrimary, letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 18, lineHeight: 1.3 }}
            >
              Sistema de VideoVigilancia
              <br />
              <span style={{ color: NAVY.accent }}>AGARVEN</span>
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="w-full">
            <div style={{ marginBottom: 16 }}>
              <label
                className="font-mono"
                style={{ display: 'block', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: NAVY.textSecondary, marginBottom: 7 }}
              >
                Usuario
              </label>
              <input
                type="text"
                placeholder="Ingrese su usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                style={inputStyle}
                onFocus={onFocusInput}
                onBlur={onBlurInput}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    passwordRef.current?.focus();
                  }
                }}
              />
            </div>

            <div>
              <label
                className="font-mono"
                style={{ display: 'block', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: NAVY.textSecondary, marginBottom: 7 }}
              >
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  ref={passwordRef}
                  style={{ ...inputStyle, paddingRight: 42 }}
                  onFocus={onFocusInput}
                  onBlur={onBlurInput}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{
                    position: 'absolute',
                    right: 11,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: NAVY.textMuted,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="font-mono"
                style={{
                  marginTop: 14,
                  padding: '9px 12px',
                  borderRadius: 3,
                  border: `1px solid ${NAVY.danger}`,
                  background: NAVY.dangerDim,
                  fontSize: '0.72rem',
                  color: '#FCA5A5',
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ marginTop: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ accentColor: NAVY.accent, width: 15, height: 15 }}
              />
              <label htmlFor="remember" style={{ fontSize: '0.82rem', color: NAVY.textSecondary, cursor: 'pointer' }}>
                Recordarme
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="font-mono"
              style={{
                width: '100%',
                background: NAVY.accent,
                border: 'none',
                borderRadius: 3,
                padding: '11px 12px',
                fontWeight: 600,
                color: '#FFFFFF',
                fontSize: '0.78rem',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = NAVY.accentDim; }}
              onMouseLeave={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = NAVY.accent; }}
            >
              {loading ? 'Verificando...' : 'Acceder'}
            </button>
          </form>

          <div
            className="flex items-center justify-center gap-2"
            style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${NAVY.border}` }}
          >
            <span
              className="font-mono"
              style={{ fontSize: '0.6rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: NAVY.textMuted }}
            >
              Agarcorp de Venezuela C.A
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
