import { Router } from 'express';
import * as pontoController from '../controllers/ponto.controller';
import { authMiddleware, adminOnly } from '../middlewares/auth';

const router = Router();

// Todas as rotas de ponto exigem autenticação
router.use(authMiddleware);

router.get('/', pontoController.list);
router.get('/hoje', pontoController.hoje);
router.post('/bater', pontoController.bater);
router.get('/relatorio', pontoController.relatorio);
router.get('/metricas', pontoController.metricas);

// Exportações (somente admin)
router.get('/export/csv', adminOnly, pontoController.exportCSV);
router.get('/export/xlsx', adminOnly, pontoController.exportXLSX);
router.get('/export/pdf', adminOnly, pontoController.exportPDF);
router.post('/export/email', adminOnly, pontoController.enviarEmail);

export { router as pontoRoutes };
