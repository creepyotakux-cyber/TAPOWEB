import { LayoutDashboard, Settings, Sun, Moon, Camera, Video, Film } from 'lucide-react';

interface Props {
  page: string;
  onNavigate: (page: string) => void;
  theme: string;
  onToggleTheme: () => void;
}

export function Sidebar({ page, onNavigate, theme, onToggleTheme }: Props) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'dvr', label: 'DVR', icon: Video },
    { id: 'recordings', label: 'Grabaciones', icon: Film },
    { id: 'config', label: 'Configuracion', icon: Settings },
  ];

  return (
    <div className="w-[220px] h-full bg-sidebar-bg border-r border-glass-border flex flex-col">
      <div className="p-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
          <Camera size={20} className="text-accent" />
        </div>
        <div>
          <h1 className="text-base font-bold text-text-primary">WebTapo</h1>
          <p className="text-[10px] text-text-muted">Camera Hub v1.0</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
              page === item.id
                ? 'bg-accent-bg text-accent border-l-3 border-accent font-semibold'
                : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
            }`}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <button onClick={onToggleTheme} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-elevated hover:text-text-primary transition-all">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <p className="text-[10px] text-text-muted text-center mt-3">v1.0 &middot; WebTapo</p>
      </div>
    </div>
  );
}
