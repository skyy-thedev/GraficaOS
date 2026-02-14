import { Router } from 'express';
import * as pontoController from '../controllers/ponto.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Todas as rotas de ponto exigem autenticação
router.use(authMiddleware);

router.get('/', pontoController.list);
router.get('/hoje', pontoController.hoje);
router.post('/bater', pontoController.bater);
router.get('/relatorio', pontoController.relatorio);

export { router as pontoRoutes };
