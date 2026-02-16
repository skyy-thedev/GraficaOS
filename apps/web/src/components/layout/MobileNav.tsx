import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  Palette,
  Users,
  ClipboardList,
  LogOut,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

export function MobileNav() {
  const { isAdmin, logout } = useAuth();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  // Itens principais (sempre visíveis)
  const mainItems = [
    { to: '/', icon: LayoutDashboard, label: 'Início' },
    ...(!isAdmin ? [{ to: '/ponto', icon: Clock, label: 'Ponto' }] : []),
    { to: '/checklist', icon: CheckSquare, label: 'Checklist' },
    { to: '/artes', icon: Palette, label: 'Artes' },
  ];

  // Itens extras (admin)
  const extraItems = [
    ...(isAdmin ? [{ to: '/gestao-pontos', icon: ClipboardList, label: 'Gestão' }] : []),
    ...(isAdmin ? [{ to: '/funcionarios', icon: Users, label: 'Equipe' }] : []),
  ];

  const allItems = [...mainItems, ...extraItems];

  // Se couber tudo (até 5 itens), mostrar tudo direto
  if (allItems.length <= 5) {
    return (
      <nav className="mobile-nav">
        {allItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? 'mobile-nav-active' : ''}`
            }
          >
            <item.icon size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          onClick={logout}
          className="mobile-nav-item mobile-nav-logout"
        >
          <LogOut size={22} />
          <span>Sair</span>
        </button>
      </nav>
    );
  }

  return (
    <>
      {/* Menu "Mais" overlay */}
      {showMore && (
        <div
          className="fixed inset-0 z-90 bg-overlay"
          onClick={() => setShowMore(false)}
        />
      )}

      {showMore && (
        <div className="mobile-more-menu">
          {extraItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `mobile-more-item ${isActive ? 'mobile-nav-active' : ''}`
              }
              onClick={() => setShowMore(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => { setShowMore(false); logout(); }}
            className="mobile-more-item mobile-nav-logout"
          >
            <LogOut size={20} />
            <span>Sair da conta</span>
          </button>
        </div>
      )}

      <nav className="mobile-nav">
        {mainItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? 'mobile-nav-active' : ''}`
            }
          >
            <item.icon size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setShowMore(!showMore)}
          className={`mobile-nav-item ${
            extraItems.some(i => location.pathname === i.to) ? 'mobile-nav-active' : ''
          }`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
          <span>Mais</span>
        </button>
      </nav>
    </>
  );
}
