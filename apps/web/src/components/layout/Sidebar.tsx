import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  ClipboardList,
  Palette,
  Users,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Arte } from '@/types';

export function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();
  const location = useLocation();

  const artesCache = queryClient.getQueryData<Arte[]>(['artes']);
  const artesAtivasCount = artesCache?.filter((a) => a.status !== 'DONE').length ?? 0;

  // Fechar mobile ao navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1023) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Seções de navegação conforme protótipo
  const sections = [
    {
      title: 'VISÃO GERAL',
      items: [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard', badge: 0 },
      ],
    },
    {
      title: 'MÓDULOS',
      items: [
        { to: '/ponto', icon: Clock, label: 'Registro de Ponto', badge: 0 },
        ...(isAdmin ? [{ to: '/gestao-pontos', icon: ClipboardList, label: 'Gestão de Pontos', badge: 0 }] : []),
        { to: '/artes', icon: Palette, label: 'Artes / Gráfica', badge: artesAtivasCount },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: 'ADMINISTRAÇÃO',
            items: [
              { to: '/funcionarios', icon: Users, label: 'Funcionários', badge: 0 },
            ],
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Botão hamburger mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="sidebar-toggle sidebar-hamburger fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg lg-hidden"
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay lg-hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`sidebar sidebar-aside fixed left-0 top-0 z-50 h-screen w-13vw flex flex-col transition-all ${
          mobileOpen ? 'sidebar-open' : ''
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2-5 px-5 pt-6 pb-5 border-b-theme">
          <span className="text-22 font-extrabold font-ui text-primary tracking-tight">
            Gráfica<span className="text-accent">OS</span>
          </span>

          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg-hidden text-muted"
            aria-label="Fechar menu"
          >
            <X size={30} />
          </button>
        </div>

        {/* Perfil do usuário — topo */}
        <div className="px-5 py-4 border-b-theme">
          <div className="flex items-center gap-5-5">
            <div
              className="bg-dynamic flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shrink-0"
              data-color={user?.avatarColor ?? '#6c63ff'}
            >
              {user?.initials}
            </div>
            <div className="min-w-0">
              <p className="text-20 font-bold truncate text-primary">{user?.name}</p>
              <p className="text-18 truncate text-muted">
                {user?.role === 'ADMIN' ? 'Admin' : 'Funcionário'}
              </p>
            </div>
          </div>
        </div>

        {/* Navegação com seções */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="sidebar-section-title px-3 pt-3 pb-1-5">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-4 py-3 text-18 font-semibold transition-all ${
                        isActive ? 'sidebar-nav-active' : 'sidebar-nav-inactive'
                      }`
                    }
                  >
                    <item.icon size={50} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge > 0 && (
                      <span
                        className="sidebar-badge inline-flex items-center justify-center rounded-full"
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sair da conta — bottom */}
        <div className="px-4 py-4 border-t-theme">
          <button
            onClick={logout}
            className="sidebar-logout flex w-full items-center gap-2 rounded-lg px-4 py-3 text-20 font-semibold transition-all text-muted"
          >
            <LogOut size={50} />
            <span>← Sair da conta</span>
          </button>
        </div>
      </aside>
    </>
  );
}
