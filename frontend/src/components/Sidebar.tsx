import { LayoutDashboard, Settings, Sun, Moon, Video, Film, LogOut } from 'lucide-react';
import logo from '../assets/logo-agarcorp.png';

interface Props {
  page: string;
  onNavigate: (page: string) => void;
  theme: string;
  onToggleTheme: () => void;
  role: string;
  onLogout: () => void;
}

export function Sidebar({ page, onNavigate, theme, onToggleTheme, role, onLogout }: Props) {
  const allItems = [
    { id: 'dashboard', label: 'Sistema de Vigilancia AGARVEN', icon: LayoutDashboard, roles: ['baseadv', 'traileradv'] },
    { id: 'dvr', label: 'DVR', icon: Video, roles: ['baseadv'] },
    { id: 'recordings', label: 'Grabaciones', icon: Film, roles: ['baseadv'] },
    { id: 'config', label: 'Configuracion', icon: Settings, roles: ['baseadv'] },
  ];

  const items = allItems.filter(item => item.roles.includes(role));

  return (
    <div className="w-[360px] h-full bg-sidebar-bg border-r border-glass-border flex flex-col">
      <div className="pt-9 px-5 pb-0 flex flex-col items-center text-center">
        <img src={logo} alt="AGARCORP" className="w-28 h-28 object-contain mb-4" />
        <h1 className="text-sm font-bold text-text-primary leading-tight">AGARCORP DE VENEZUELA C.A</h1>
        <span className={`mt-2.5 text-xs px-3 py-1 rounded-full font-bold tracking-wide ${role === 'baseadv' ? 'bg-accent/20 text-accent' : 'bg-warning/20 text-warning'}`}>
          {role === 'baseadv' ? 'ADMINISTRADOR' : 'OPERADOR'}
        </span>
      </div>

      <div className="mx-5 my-5 border-t border-glass-border" />

      <nav className="flex-1 flex flex-col justify-start items-center px-3 gap-3.5 pt-1">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-start gap-4 px-6 py-6 rounded-xl text-2xl leading-snug border-2 transition-all ${
              page === item.id
                ? 'bg-accent-bg text-accent border-accent font-bold'
                : 'text-text-secondary border-glass-border hover:bg-elevated hover:text-text-primary hover:border-accent/40 font-semibold'
            }`}
          >
            <item.icon size={36} className="shrink-0 mt-0.5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mx-5 mb-2 border-t border-glass-border" />

      <div className="px-4 pb-5 flex flex-col gap-3">
        <button onClick={onToggleTheme} className="w-full flex items-center gap-4 px-6 py-6 rounded-xl text-2xl font-semibold text-text-secondary hover:bg-elevated hover:text-text-primary border border-glass-border hover:border-accent/40 transition-all">
          {theme === 'dark' ? <Sun size={36} /> : <Moon size={36} />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button onClick={onLogout} className="w-full flex items-center gap-4 px-6 py-6 rounded-xl text-2xl font-semibold text-danger hover:bg-danger-dim hover:text-danger border border-glass-border hover:border-danger transition-all">
          <LogOut size={36} />
          Cerrar sesion
        </button>
        <p className="text-xs text-text-muted text-center mt-2">v1.0 &middot; AGARCORP</p>
      </div>
    </div>
  );
}
