import { Router } from 'express';
import * as vendaController from '../controllers/venda.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', vendaController.list);
router.post('/', vendaController.create);
router.put('/:id', vendaController.update);

export { router as vendaRoutes };
