import { Router } from 'express';
import * as pricingController from '../controllers/pricing.controller';
import { adminOnly, authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/settings', pricingController.getSettings);
router.get('/finishes', pricingController.listFinishes);
router.get('/products', pricingController.listProducts);
router.post('/preview', pricingController.preview);

router.put('/settings', adminOnly, pricingController.updateSettings);
router.post('/products', adminOnly, pricingController.createProduct);
router.put('/products/:id', adminOnly, pricingController.updateProduct);

export { router as pricingRoutes };
