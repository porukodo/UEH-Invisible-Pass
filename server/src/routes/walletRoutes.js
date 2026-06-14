import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireSepayApiKey } from '../middleware/sepayAuth.js';
import {
  getMe,
  getTransactions,
  createTopup,
  getTopupStatus,
  handleWebhook,
} from '../controllers/walletController.js';

const router = Router();

router.get('/me', requireAuth, getMe);
router.get('/transactions', requireAuth, getTransactions);
router.post('/topup', requireAuth, createTopup);
router.get('/topup/:gatewayRef', requireAuth, getTopupStatus);

// Called by SePay, not the client - no JWT, verified via API key header instead.
router.post('/webhook', requireSepayApiKey, handleWebhook);

export default router;
