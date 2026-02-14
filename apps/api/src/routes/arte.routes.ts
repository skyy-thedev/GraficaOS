import { Router } from 'express';
import * as arteController from '../controllers/arte.controller';
import { authMiddleware } from '../middlewares/auth';
import { upload } from '../middlewares/upload';

const router = Router();

// Todas as rotas de artes exigem autenticação
router.use(authMiddleware);

router.get('/', arteController.list);
router.post('/', arteController.create);
router.put('/:id', arteController.update);
router.put('/:id/status', arteController.updateStatus);
router.delete('/:id', arteController.remove);
router.post('/:id/arquivos', upload.array('arquivos', 10), arteController.uploadArquivos);
router.delete('/:id/arquivos/:arquivoId', arteController.deleteArquivo);

export { router as arteRoutes };
