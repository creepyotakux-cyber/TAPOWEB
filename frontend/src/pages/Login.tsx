import { useState, FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import { login as doLogin } from '../lib/auth';
import logoAgarcorp from '../assets/LOGO_AGAR_SVG_FONDOBLANCO.svg';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div
      className="h-full flex items-center justify-center p-6"
      style={{
        background: '#06080D',
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#0D1117',
          border: '1px solid #1A2030',
          borderRadius: 16,
          padding: '36px 32px 24px 32px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex flex-col items-center">
          <img
            src={logoAgarcorp}
            alt="AGARCORP"
            style={{ width: 180, height: 'auto', marginBottom: 20 }}
          />

          <h1 style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', fontWeight: 800, color: '#F1F5F9', textAlign: 'center' }}>
            Sistema de Vigilancia AgarVen
          </h1>
          <p style={{ fontSize: '0.70rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 600, marginTop: 4, marginBottom: 32 }}>
            PLATAFORMA DE VIDEOVIGILANCIA
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full">
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#F1F5F9', marginBottom: 8 }}>
              Usuario <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Ingrese su usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              style={{
                width: '100%',
                background: '#161B22',
                border: '1px solid #1A2030',
                borderRadius: 8,
                padding: '12px 16px',
                color: '#F1F5F9',
                fontSize: '0.9rem',
                outline: 'none',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#22D3EE'; e.target.style.boxShadow = '0 0 0 2px rgba(34,211,238,0.15)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#1A2030'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#F1F5F9', marginBottom: 8 }}>
              Contraseña <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{
                  width: '100%',
                  background: '#161B22',
                  border: '1px solid #1A2030',
                  borderRadius: 8,
                  padding: '12px 44px 12px 16px',
                  color: '#F1F5F9',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#22D3EE'; e.target.style.boxShadow = '0 0 0 2px rgba(34,211,238,0.15)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#1A2030'; e.target.style.boxShadow = 'none'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 16, marginBottom: 0, padding: '10px 14px', borderRadius: 8, border: '1px solid #7F1D1D', background: '#7F1D1D', textAlign: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#FCA5A5' }}>{error}</span>
            </div>
          )}

          <div style={{ marginTop: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ accentColor: '#22D3EE', width: 16, height: 16 }}
            />
            <label htmlFor="remember" style={{ fontSize: '0.85rem', color: '#F1F5F9', cursor: 'pointer' }}>
              Recordarme
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#22D3EE',
              border: 'none',
              borderRadius: 8,
              padding: 12,
              fontWeight: 600,
              color: '#06080D',
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = '#06B6D4'; }}
            onMouseLeave={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = '#22D3EE'; }}
          >
            {loading ? 'Ingresando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <span style={{ fontSize: '0.8rem', color: '#475569' }}>Agarcorp de Venezuela C.A</span>
        </div>
      </div>
    </div>
  );
}
