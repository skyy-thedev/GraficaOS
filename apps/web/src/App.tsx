import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { PontoPage } from '@/pages/Ponto';
import { GestaoPontosPage } from '@/pages/GestaoPontos';
import { PontoAnalyticsPage } from '@/pages/PontoAnalytics';
import { ArtesPage } from '@/pages/Artes';
import { AgendaProducaoPage } from '@/pages/AgendaProducao';
import { GestaoOperacionalPage } from '@/pages/GestaoOperacional';
import { ClientesRecorrentesPage } from '@/pages/ClientesRecorrentes';
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
          <Route path="/ponto/analytics" element={<PontoAnalyticsPage />} />
          <Route path="/artes" element={<ArtesPage />} />
          <Route path="/agenda-producao" element={<AgendaProducaoPage />} />
          <Route path="/gestao-operacional" element={<GestaoOperacionalPage />} />
          <Route path="/clientes-recorrentes" element={<ClientesRecorrentesPage />} />
          <Route path="/funcionarios" element={<FuncionariosPage />} />
        </Route>
      </Route>

      {/* Rota fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
