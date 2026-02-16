import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title }: TopbarProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = format(now, "EEEE dd/MM/yyyy", { locale: ptBR });
  const timeStr = format(now, 'HH:mm:ss');

  return (
    <header
      className="topbar sticky top-0 z-30 flex h-8vh items-center justify-between px-7"
    >
      <div className="topbar-title-area flex items-center gap-3">
        {/* App name — visível só no mobile (sidebar escondida) */}
        <span className="topbar-app-name font-extrabold font-ui text-primary tracking-tight">
          Gráfica<span className="text-accent">OS</span>
        </span>
        {/* Page title — visível só no desktop */}
        <h2 className="topbar-page-title text-22 font-extrabold font-ui text-primary tracking-tight">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <span className="topbar-date capitalize hidden sm-block" >
          {dateStr}
        </span>
        <span
          className="topbar-clock inline-flex items-center rounded-lg"
        >
          {timeStr}
        </span>
      </div>
    </header>
  );
}
