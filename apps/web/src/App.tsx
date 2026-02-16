import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { PontoPage } from '@/pages/Ponto';
import { GestaoPontosPage } from '@/pages/GestaoPontos';
import { ArtesPage } from '@/pages/Artes';
import { ChecklistPage } from '@/pages/ChecklistDiario';
import { FuncionariosPage } from '@/pages/Funcionarios';

export function App() {
  return (
    <Routes>
      {/* Rota pública */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rotas protegidas */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/ponto" element={<PontoPage />} />
          <Route path="/checklist" element={<ChecklistPage />} />
          <Route path="/gestao-pontos" element={<GestaoPontosPage />} />
          <Route path="/artes" element={<ArtesPage />} />
          <Route path="/funcionarios" element={<FuncionariosPage />} />
        </Route>
      </Route>

      {/* Rota fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
