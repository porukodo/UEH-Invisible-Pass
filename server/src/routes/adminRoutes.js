import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { search, manualAdjustment, manualGateOpen, exportReport } from '../controllers/adminController.js';

const router = Router();

router.use(requireAuth, requireRole('staff', 'admin'));

router.get('/search', search);
router.post('/adjustment', manualAdjustment);
router.post('/gate/open', manualGateOpen);
router.get('/reports/export', exportReport);

export default router;
