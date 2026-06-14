import cron from 'node-cron';
import {
  getPendingTopupsForRetry,
  incrementTopupRetry,
  expireStaleTopups,
  markTopupStatus,
} from '../models/topupModel.js';
import { applyLedgerEntry } from '../models/walletModel.js';
import { expireOldGateEvents } from '../models/gateEventModel.js';

const RETRY_INTERVAL_MINUTES = 15;
const MAX_RETRIES = 3;

/**
 * NFR09: re-check top-up requests that never received an IPN webhook.
 * Placeholder for a real gateway "lookup transaction" call - returns
 * true if the gateway confirms the transfer happened.
 */
async function checkGatewayTransaction() {
  return false;
}

/**
 * NFR09 fallback sweep: re-check unconfirmed top-ups and clean up old
 * anti-replay/gate-event rows. SePay's webhook is the primary, instant
 * confirmation path - this just catches requests that never received one.
 */
export async function runRetryPass() {
  const pending = await getPendingTopupsForRetry(MAX_RETRIES, RETRY_INTERVAL_MINUTES);

  for (const topup of pending) {
    const confirmed = await checkGatewayTransaction(topup.gateway_ref);

    if (confirmed) {
      await applyLedgerEntry({
        userId: topup.user_id,
        type: 'topup',
        amount: topup.amount,
        gatewayRef: topup.gateway_ref,
        description: 'Nạp tiền qua VietQR (xác nhận qua retry job)',
      });
      await markTopupStatus(topup.id, 'confirmed');
      console.log(`[topup-retry] confirmed ${topup.gateway_ref}`);
    } else {
      await incrementTopupRetry(topup.id);
      console.log(`[topup-retry] still pending ${topup.gateway_ref} (retry ${topup.retry_count + 1}/${MAX_RETRIES})`);
    }
  }

  await expireStaleTopups(MAX_RETRIES);
  await expireOldGateEvents();
}

/** Local dev only - on Vercel this runs via Vercel Cron hitting /api/cron/topup-retry instead. */
export function startTopupRetryJob() {
  // Runs every minute; each individual request is only re-checked once
  // it has been pending for RETRY_INTERVAL_MINUTES.
  cron.schedule('* * * * *', () => {
    runRetryPass().catch((err) => console.error('[topup-retry] error', err));
  });
}
