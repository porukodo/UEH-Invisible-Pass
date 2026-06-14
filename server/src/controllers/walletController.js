import { getWallet, applyLedgerEntry } from '../models/walletModel.js';
import { listTransactionsByUser } from '../models/transactionModel.js';
import {
  createTopupRequest,
  findTopupByGatewayRef,
  markTopupStatus,
} from '../models/topupModel.js';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/errorHandler.js';

/** Underlying balance data needed by FR08/09/15/16/17 (no dedicated FR07 screen, but the wallet view uses it). */
export async function getMe(req, res, next) {
  try {
    const wallet = await getWallet(req.user.id);
    if (!wallet) throw new ApiError(404, 'Wallet not found');
    res.json({ balance: Number(wallet.balance), updatedAt: wallet.updated_at });
  } catch (err) {
    next(err);
  }
}

/** Underlying history data needed for the wallet view (FR10 not built as a separate feature). */
export async function getTransactions(req, res, next) {
  try {
    const rows = await listTransactionsByUser(req.user.id, 50);
    res.json({ transactions: rows });
  } catch (err) {
    next(err);
  }
}

/** FR08: create a top-up request and return a VietQR code to pay it. */
export async function createTopup(req, res, next) {
  try {
    const { amount } = req.body;
    const amt = Number(amount);
    if (!amt || amt <= 0) throw new ApiError(400, 'So tien khong hop le');

    const gatewayRef = `UEHIP${req.user.id}${Date.now()}`;
    await createTopupRequest({ userId: req.user.id, amount: amt, gatewayRef });

    const { bankId, accountNo, accountName } = env.vietqr;
    const addInfo = encodeURIComponent(gatewayRef);
    const accName = encodeURIComponent(accountName);
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amt}&addInfo=${addInfo}&accountName=${accName}`;

    res.status(201).json({ gatewayRef, qrUrl, amount: amt });
  } catch (err) {
    next(err);
  }
}

/** Poll for FR08/09 confirmation (and to drive NFR08 "pending -> retry" UI state). */
export async function getTopupStatus(req, res, next) {
  try {
    const { gatewayRef } = req.params;
    const topup = await findTopupByGatewayRef(gatewayRef);
    if (!topup) throw new ApiError(404, 'Khong tim thay yeu cau nap tien');
    if (topup.user_id !== req.user.id) throw new ApiError(403, 'Forbidden');
    res.json({ status: topup.status, retryCount: topup.retry_count });
  } catch (err) {
    next(err);
  }
}

/**
 * FR09: SePay IPN webhook for incoming bank transfers to the shared merchant
 * account. Idempotent via gateway_ref - a duplicate notification for an
 * already-confirmed top-up is a no-op. Always replies 200 + success:true so
 * SePay does not retry, even for transfers unrelated to this app.
 */
export async function handleWebhook(req, res, next) {
  try {
    const { content, code, transferAmount, transferType } = req.body;

    // Only incoming transfers can fund a top-up; ignore outgoing entries.
    if (transferType && transferType !== 'in') {
      return res.json({ success: true, message: 'Ignored (not an incoming transfer)' });
    }

    // Banks/apps may strip spaces or change case when relaying the transfer
    // content, so normalize before searching for our reference code.
    const raw = `${content || ''} ${code || ''}`.toUpperCase().replace(/\s+/g, '');
    const match = /UEHIP\d+/.exec(raw);
    if (!match) return res.json({ success: true, message: 'No matching reference' });

    const gatewayRef = match[0];
    const topup = await findTopupByGatewayRef(gatewayRef);
    if (!topup) return res.json({ success: true, message: 'Unknown reference' });

    if (topup.status === 'confirmed') {
      return res.json({ success: true, message: 'Already processed' });
    }

    if (Number(transferAmount) !== Number(topup.amount)) {
      return res.json({ success: true, message: 'Amount mismatch' });
    }

    await applyLedgerEntry({
      userId: topup.user_id,
      type: 'topup',
      amount: topup.amount,
      gatewayRef,
      description: 'Nap tien qua VietQR (SePay)',
    });
    await markTopupStatus(topup.id, 'confirmed');

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
