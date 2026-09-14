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
    { id: 'dashboard', label: 'En Vivo', icon: LayoutDashboard, roles: ['baseadv', 'traileradv'] },
    { id: 'dvr', label: 'DVR', icon: Video, roles: ['baseadv'] },
    { id: 'recordings', label: 'Archivo', icon: Film, roles: ['baseadv'] },
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
          className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 transition-all border-t-2 ${
            page === item.id
              ? 'text-accent border-accent bg-accent-bg/40'
              : 'text-text-secondary border-transparent'
          }`}
        >
          <item.icon size={22} />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]">{item.label}</span>
        </button>
      ))}
      <button
        onClick={onToggleTheme}
        className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 text-text-secondary border-t-2 border-transparent transition-colors"
      >
        {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]">Tema</span>
      </button>
      <button
        onClick={onLogout}
        className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 text-danger border-t-2 border-transparent transition-colors"
      >
        <LogOut size={22} />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]">Salir</span>
      </button>
    </nav>
  );
}
