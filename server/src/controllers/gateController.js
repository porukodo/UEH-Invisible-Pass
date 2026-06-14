import { decryptPayload, verifyTotp } from '../utils/crypto.js';
import { isTokenUsed, markTokenUsed } from '../models/tokenModel.js';
import { calculateFee } from '../utils/feeCalculator.js';
import { findUserByMssv } from '../models/userModel.js';
import { applyLedgerEntry } from '../models/walletModel.js';
import { insertParkingLog } from '../models/parkingModel.js';
import { listGates, findGateById } from '../models/gateModel.js';
import { emitToGate } from '../utils/realtime.js';
import { listGateEventsAfter } from '../models/gateEventModel.js';
import { ApiError } from '../middleware/errorHandler.js';

export async function getGates(req, res, next) {
  try {
    res.json({ gates: await listGates() });
  } catch (err) {
    next(err);
  }
}

/** Polled by the Barrier Simulator in place of the old Socket.io GATE_OPEN push. */
export async function getGateEvents(req, res, next) {
  try {
    const { gateId } = req.params;
    const after = Number(req.query.after) || 0;
    const events = await listGateEventsAfter(gateId, after);
    res.json({ events });
  } catch (err) {
    next(err);
  }
}

/**
 * FR13/14/15/16/17/18: gate scanner submits the encrypted QR payload.
 * - decrypt + verify TOTP against the user's secret (FR13)
 * - reject already-used tokens (FR13 anti-replay)
 * - calculate fee and debit the wallet atomically (FR15/16)
 * - on success, broadcast GATE_OPEN to the barrier simulator (FR18)
 * - on insufficient balance, return a friendly error (FR17)
 */
export async function verifyQr(req, res, next) {
  try {
    const { token, gateId } = req.body;
    if (!token || !gateId) throw new ApiError(400, 'Thieu token hoac gateId');

    const gate = await findGateById(gateId);
    if (!gate) throw new ApiError(404, 'Khong tim thay cong');

    let payload;
    try {
      payload = decryptPayload(token);
    } catch {
      throw new ApiError(400, 'QR khong hop le');
    }

    const { mssv, totp } = payload;
    const user = await findUserByMssv(mssv);
    if (!user) throw new ApiError(404, 'Khong tim thay sinh vien');

    if (await isTokenUsed(token)) {
      await insertParkingLog({ userId: user.id, gateId, fee: 0, result: 'duplicate_token' });
      throw new ApiError(409, 'QR da duoc su dung');
    }

    if (!verifyTotp(user.totp_secret, totp)) {
      await insertParkingLog({ userId: user.id, gateId, fee: 0, result: 'invalid_token' });
      throw new ApiError(401, 'QR khong hop le hoac da het han');
    }

    await markTokenUsed(token);

    const fee = calculateFee();

    try {
      const { transactionId, balance } = await applyLedgerEntry({
        userId: user.id,
        type: 'charge',
        amount: -fee,
        description: `${gate.type === 'entry' ? 'Vao' : 'Ra'} bai - ${gate.name}`,
      });

      await insertParkingLog({ userId: user.id, gateId, transactionId, fee, result: 'success' });

      await emitToGate(gateId, 'GATE_OPEN', {
        gateId,
        mssv: user.mssv,
        fullName: user.full_name,
        fee,
        balance,
      });

      return res.json({ success: true, fee, balance, fullName: user.full_name });
    } catch (err) {
      if (err.code === 'INSUFFICIENT_BALANCE') {
        await insertParkingLog({ userId: user.id, gateId, fee, result: 'insufficient_balance' });
        throw new ApiError(402, 'So du khong du. Vui long nap them tien.');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}
