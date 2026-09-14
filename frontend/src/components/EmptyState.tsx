import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, subtitle, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="w-12 h-12 rounded-[4px] bg-void border border-glass-border/60 flex items-center justify-center">
        <Icon size={22} className="text-text-muted" />
      </div>
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-text-primary">{title}</p>
        {subtitle && <p className="font-mono text-[11px] text-text-muted mt-1 max-w-sm mx-auto">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
