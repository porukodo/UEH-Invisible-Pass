import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireGateSignature } from '../middleware/gateHmac.js';
import { getGates, verifyQr, getGateEvents } from '../controllers/gateController.js';

const router = Router();

router.get('/list', requireAuth, getGates);
router.post('/verify', requireGateSignature, verifyQr);
router.get('/:gateId/events', requireAuth, requireRole('staff', 'admin'), getGateEvents);

export default router;
