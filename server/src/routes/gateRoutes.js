import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireGateSignature } from '../middleware/gateHmac.js';
import { getGates, verifyQr, getGateEvents } from '../controllers/gateController.js';

const router = Router();

router.get('/list', requireAuth, getGates);
// Defense in depth: the gate scanner is staff-operated and already sends a JWT,
// so require a staff/admin session in addition to the shared HMAC signature -
// a leaked client-side HMAC secret alone is then not enough to hit this route.
router.post('/verify', requireAuth, requireRole('staff', 'admin'), requireGateSignature, verifyQr);
router.get('/:gateId/events', requireAuth, requireRole('staff', 'admin'), getGateEvents);

export default router;
