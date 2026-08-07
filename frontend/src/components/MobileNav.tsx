import { LayoutDashboard, Settings, Sun, Moon, Video, Film, LogOut } from 'lucide-react';

interface Props {
  page: string;
  onNavigate: (page: string) => void;
  theme: string;
  onToggleTheme: () => void;
  role: string;
  onLogout: () => void;
}

export function MobileNav({ page, onNavigate, theme, onToggleTheme, role, onLogout }: Props) {
  const allItems = [
    { id: 'dashboard', label: 'Camaras', icon: LayoutDashboard, roles: ['baseadv', 'traileradv'] },
    { id: 'dvr', label: 'DVR', icon: Video, roles: ['baseadv'] },
    { id: 'recordings', label: 'Grabaciones', icon: Film, roles: ['baseadv'] },
    { id: 'config', label: 'Config', icon: Settings, roles: ['baseadv'] },
  ];

  const items = allItems.filter(item => item.roles.includes(role));

  return (
    <nav
      className="shrink-0 bg-sidebar-bg border-t border-glass-border flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
            page === item.id ? 'text-accent bg-accent-bg' : 'text-text-secondary'
          }`}
        >
          <item.icon size={20} />
          {item.label}
        </button>
      ))}
      <button
        onClick={onToggleTheme}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-text-secondary transition-colors"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        Tema
      </button>
      <button
        onClick={onLogout}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-danger transition-colors"
      >
        <LogOut size={20} />
        Salir
      </button>
    </nav>
  );
}
