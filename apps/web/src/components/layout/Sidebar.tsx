import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  ClipboardList,
  Palette,
  Users,
  LogOut,
  ChevronRight,
  CheckSquare,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import type { Arte, ItemHoje } from '@/types';

export function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const queryClient = useQueryClient();

  const artesCache = queryClient.getQueryData<Arte[]>(['artes']);
  const artesAtivasCount = artesCache?.filter((a) => a.status !== 'DONE').length ?? 0;

  const checklistCache = queryClient.getQueryData<ItemHoje[]>(['checklist', 'hoje']);
  const checklistPendentes = checklistCache?.filter((i) => !i.feito).length ?? 0;
  const checklistAtrasados = checklistCache?.some((i) => i.atrasado) ?? false;

  const sections = [
    {
      title: 'VISÃO GERAL',
      items: [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard', badge: 0, badgeType: 'normal' as const },
      ],
    },
    {
      title: 'MÓDULOS',
      items: [
        ...(!isAdmin ? [{ to: '/ponto', icon: Clock, label: 'Registro de Ponto', badge: 0, badgeType: 'normal' as const }] : []),
        { to: '/checklist', icon: CheckSquare, label: 'Checklist Diário', badge: checklistPendentes, badgeType: (checklistAtrasados ? 'warning' : 'normal') as 'warning' | 'normal' },
        ...(isAdmin ? [
          { to: '/gestao-pontos', icon: ClipboardList, label: 'Gestão de Pontos', badge: 0, badgeType: 'normal' as const },
          { to: '/ponto/analytics', icon: BarChart3, label: 'Analytics de Ponto', badge: 0, badgeType: 'normal' as const },
        ] : []),
        { to: '/artes', icon: Palette, label: 'Artes / Gráfica', badge: artesAtivasCount, badgeType: 'normal' as const },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: 'ADMINISTRAÇÃO',
            items: [
              { to: '/funcionarios', icon: Users, label: 'Funcionários', badge: 0, badgeType: 'normal' as const },
            ],
          },
        ]
      : []),
  ];

  return (
    <aside className="sidebar-aside sidebar-desktop">
      {/* Logo */}
      <div className="sb-logo">
        <span className="sb-logo-text">
          Gráfica<span className="sb-logo-accent">OS</span>
        </span>
      </div>

      {/* Perfil do usuário */}
      <div className="sb-profile">
        <div
          className="sb-avatar"
          data-color={user?.avatarColor ?? '#6c63ff'}
        >
          {user?.initials}
        </div>
        <div className="sb-profile-info">
          <span className="sb-profile-name">{user?.name}</span>
          <span className="sb-profile-role">
            {user?.role === 'ADMIN' ? 'Administrador' : 'Funcionário'}
          </span>
        </div>
      </div>

      {/* Navegação */}
      <nav className="sb-nav">
        {sections.map((section) => (
          <div key={section.title} className="sb-section">
            <span className="sb-section-title">{section.title}</span>
            <div className="sb-section-items">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `sb-nav-item${isActive ? ' sb-nav-active' : ''}`
                  }
                >
                  <item.icon size={18} />
                  <span className="sb-nav-label">{item.label}</span>
                  {item.badge > 0 && (
                    <span className={`sb-badge ${item.badgeType === 'warning' ? 'sb-badge-warning' : ''}`}>
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight size={14} className="sb-nav-chevron" />
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Sair */}
      <div className="sb-footer">
        <button onClick={logout} className="sb-logout">
          <LogOut size={16} />
          <span>Sair da conta</span>
        </button>
      </div>
    </aside>
  );
}
