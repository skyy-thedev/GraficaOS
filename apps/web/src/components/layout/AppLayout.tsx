import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-app">
      <Sidebar />
      <main className="main-content min-h-screen transition-all">
        <Outlet />
      </main>
    </div>
  );
}
