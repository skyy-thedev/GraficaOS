import { Router } from 'express';
import * as checklistController from '../controllers/checklist.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Todas as rotas de checklist exigem autenticação
router.use(authMiddleware);

// Itens (gerenciamento — POST/PUT/PATCH/DELETE somente ADMIN, controlado no controller)
router.get('/itens', checklistController.listarItens);
router.post('/itens', checklistController.criarItem);
router.put('/itens/:id', checklistController.editarItem);
router.patch('/itens/:id/toggle', checklistController.toggleItem);
router.delete('/itens/:id', checklistController.deletarItem);

// Registros do dia (todos os perfis)
router.get('/hoje', checklistController.checklistHoje);
router.post('/marcar/:itemId', checklistController.marcarItem);

// Relatório (ADMIN — controlado no controller)
router.get('/relatorio', checklistController.relatorio);

export { router as checklistRoutes };
