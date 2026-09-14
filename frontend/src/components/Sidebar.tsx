import { LayoutDashboard, Settings, Video, Film, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import logo from '../assets/LOGO_AGAR_SVG_FONDOBLANCO.svg';
import { useUIStore } from '../lib/store';

interface Props {
  page: string;
  onNavigate: (page: string) => void;
  role: string;
}

export function Sidebar({ page, onNavigate, role }: Props) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleCollapsed = useUIStore((s) => s.toggleSidebar);

  const allItems = [
    { id: 'dashboard', label: 'En Vivo', icon: LayoutDashboard, roles: ['baseadv', 'traileradv'] },
    { id: 'dvr', label: 'DVR', icon: Video, roles: ['baseadv'] },
    { id: 'recordings', label: 'Grabaciones', icon: Film, roles: ['baseadv'] },
    { id: 'config', label: 'Configuracion', icon: Settings, roles: ['baseadv'] },
  ];

  const items = allItems.filter(item => item.roles.includes(role));

  return (
    <div className={`h-full bg-sidebar-bg border-r border-glass-border flex flex-col shrink-0 transition-[width] duration-200 ${collapsed ? 'w-14' : 'w-64'}`}>
      {collapsed ? (
        <div className="h-14 flex items-center justify-center border-b border-glass-border">
          <img src={logo} alt="AGARCORP" className="w-10 h-10 object-contain" />
        </div>
      ) : (
        <div className="px-4 py-5 flex flex-col items-center gap-3 text-center border-b border-glass-border">
          <img src={logo} alt="AGARCORP" className="w-32 h-auto max-h-[112px] object-contain" />
          <div className="leading-tight">
            <p className="text-lg font-bold text-text-primary tracking-wide">AGARCORP</p>
            <p className="text-lg font-bold text-text-primary leading-tight tracking-wide">DE VENEZUELA</p>
          </div>
        </div>
      )}

      <nav className="flex-1 flex flex-col gap-2 px-2 py-3">
        {items.map(item => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center gap-3 rounded-sm border border-glass-border/50 transition-all ${
                collapsed ? 'justify-center px-0 py-6' : 'px-3 py-6'
              } ${
                active
                  ? 'bg-accent-bg text-accent border-accent/40'
                  : 'text-text-secondary hover:bg-elevated hover:text-text-primary hover:border-glass-border'
              }`}
            >
              {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent rounded-full" />}
              <item.icon size={30} className="shrink-0" />
              {!collapsed && <span className="text-[22px] font-semibold truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-glass-border p-2 flex flex-col gap-2">
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expandir menu' : 'Colapsar menu'}
          className={`flex items-center gap-3 rounded-sm border border-glass-border/50 text-text-muted hover:bg-elevated hover:text-text-primary hover:border-glass-border transition-all ${
            collapsed ? 'justify-center px-0 py-5' : 'px-3 py-5'
          }`}
        >
          {collapsed ? <PanelLeftOpen size={26} /> : <PanelLeftClose size={26} />}
          {!collapsed && <span className="text-base font-semibold">Colapsar</span>}
        </button>
        {!collapsed && (
          <p className="font-mono text-[9px] text-text-muted text-center pb-1 tracking-wider">v1.0</p>
        )}
      </div>
    </div>
  );
}
