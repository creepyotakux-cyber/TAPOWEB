import { LayoutDashboard, Settings, Sun, Moon, Video, Film } from 'lucide-react';
import logo from '../assets/logo-agarcorp.png';

interface Props {
  page: string;
  onNavigate: (page: string) => void;
  theme: string;
  onToggleTheme: () => void;
}

export function Sidebar({ page, onNavigate, theme, onToggleTheme }: Props) {
  const items = [
    { id: 'dashboard', label: 'Sistema de Vigilancia AGARVEN', icon: LayoutDashboard },
    { id: 'dvr', label: 'DVR', icon: Video },
    { id: 'recordings', label: 'Grabaciones', icon: Film },
    { id: 'config', label: 'Configuracion', icon: Settings },
  ];

  return (
    <div className="w-[260px] h-full bg-sidebar-bg border-r border-glass-border flex flex-col">
      <div className="p-6 flex flex-col items-center text-center">
        <img src={logo} alt="AGARCORP" className="w-24 h-24 object-contain mb-3" />
        <h1 className="text-base font-bold text-text-primary leading-tight">AGARCORP DE VENEZUELA C.A</h1>
      </div>

      <nav className="flex-1 flex flex-col justify-start items-center px-3 gap-5 pt-8">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-4 px-6 py-7 rounded-xl text-2xl border-2 transition-all ${
              page === item.id
                ? 'bg-accent-bg text-accent border-accent font-semibold'
                : 'text-text-secondary border-glass-border hover:bg-elevated hover:text-text-primary hover:border-accent/40'
            }`}
          >
            <item.icon size={26} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <button onClick={onToggleTheme} className="w-full flex items-center gap-4 px-5 py-3.5 rounded-xl text-[15px] text-text-secondary hover:bg-elevated hover:text-text-primary transition-all">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <p className="text-[10px] text-text-muted text-center mt-3">v1.0 &middot; AGARCORP</p>
      </div>
    </div>
  );
}
