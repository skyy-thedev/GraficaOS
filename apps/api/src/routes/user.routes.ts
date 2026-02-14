import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authMiddleware, adminOnly } from '../middlewares/auth';

const router = Router();

// Todas as rotas de usuários exigem autenticação + permissão de ADMIN
router.use(authMiddleware);
router.use(adminOnly);

router.get('/', userController.list);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.delete('/:id', userController.remove);

export { router as userRoutes };
