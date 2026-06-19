import { decryptPayload, verifyTotp } from '../utils/crypto.js';
import { claimToken } from '../models/tokenModel.js';
import { calculateFee } from '../utils/feeCalculator.js';
import { findUserByMssv } from '../models/userModel.js';
import { applyLedgerEntry, getWallet } from '../models/walletModel.js';
import {
  insertParkingLog,
  findOpenSession,
  createSession,
  closeSession,
} from '../models/parkingModel.js';
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
 * Shared QR verification: decrypt, TOTP check, anti-replay claim.
 * Returns { user, payload } on success, throws ApiError on any failure.
 */
async function verifyQrToken(token, gateId) {
  let payload;
  try {
    payload = decryptPayload(token);
  } catch {
    throw new ApiError(400, 'QR không hợp lệ');
  }

  const { mssv, totp } = payload;
  const user = await findUserByMssv(mssv);
  if (!user) throw new ApiError(404, 'Không tìm thấy sinh viên');
  if (user.status !== 'active') throw new ApiError(403, 'Tài khoản đã bị khóa');

  if (!verifyTotp(user.totp_secret, totp)) {
    await insertParkingLog({ userId: user.id, gateId, fee: 0, result: 'invalid_token' });
    throw new ApiError(401, 'QR không hợp lệ hoặc đã hết hạn');
  }

  if (!(await claimToken(token))) {
    await insertParkingLog({ userId: user.id, gateId, fee: 0, result: 'duplicate_token' });
    throw new ApiError(409, 'QR đã được sử dụng');
  }

  return { user };
}

function formatVnd(amount) {
  return amount.toLocaleString('vi-VN') + '₫';
}

/**
 * FR13/14/15/16/17/18: gate scanner submits the encrypted QR payload.
 *
 * Entry gate  → opens a new parking session (no charge). Rejected if the
 *               student already has an open session.
 * Exit gate   → closes the open session, calculates the time-based fee,
 *               and debits the wallet atomically. If balance is insufficient,
 *               the gate stays closed and the student is told to top up.
 */
export async function verifyQr(req, res, next) {
  try {
    const { token, gateId } = req.body;
    if (!token || !gateId) throw new ApiError(400, 'Thiếu token hoặc gateId');

    const gate = await findGateById(gateId);
    if (!gate) throw new ApiError(404, 'Không tìm thấy cổng');

    const { user } = await verifyQrToken(token, gateId);

    if (gate.type === 'entry') {
      return await handleEntry({ user, gate, res });
    } else {
      return await handleExit({ user, gate, res });
    }
  } catch (err) {
    next(err);
  }
}

async function handleEntry({ user, gate, res }) {
  const openSession = await findOpenSession(user.id);
  if (openSession) {
    await insertParkingLog({ userId: user.id, gateId: gate.id, fee: 0, result: 'already_parked' });
    throw new ApiError(409, 'Bạn đang có phiên gửi xe chưa kết thúc. Vui lòng ra cổng trước.');
  }

  const sessionId = await createSession({ userId: user.id, entryGateId: gate.id });
  await insertParkingLog({ userId: user.id, gateId: gate.id, fee: 0, result: 'success', sessionId });

  const wallet = await getWallet(user.id);

  await emitToGate(gate.id, 'GATE_OPEN', {
    gateId: gate.id,
    mssv: user.mssv,
    fullName: user.full_name,
    fee: 0,
    balance: wallet ? Number(wallet.balance) : 0,
  });

  return res.json({
    success: true,
    fee: 0,
    fullName: user.full_name,
    sessionId,
  });
}

async function handleExit({ user, gate, res }) {
  const session = await findOpenSession(user.id);
  if (!session) {
    await insertParkingLog({ userId: user.id, gateId: gate.id, fee: 0, result: 'no_session' });
    throw new ApiError(404, 'Không tìm thấy phiên gửi xe. Vui lòng liên hệ nhân viên.');
  }

  const entryAt = new Date(session.entry_at);
  const exitAt = new Date();
  const fee = calculateFee(entryAt, exitAt);

  try {
    const { transactionId, balance } = await applyLedgerEntry({
      userId: user.id,
      type: 'charge',
      amount: -fee,
      description: `Ra bãi - ${gate.name}`,
    });

    await closeSession({ sessionId: session.id, exitGateId: gate.id, fee, transactionId });
    await insertParkingLog({
      userId: user.id,
      gateId: gate.id,
      transactionId,
      fee,
      result: 'success',
      sessionId: session.id,
    });

    await emitToGate(gate.id, 'GATE_OPEN', {
      gateId: gate.id,
      mssv: user.mssv,
      fullName: user.full_name,
      fee,
      balance,
    });

    return res.json({ success: true, fee, balance, fullName: user.full_name });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_BALANCE') {
      await insertParkingLog({
        userId: user.id,
        gateId: gate.id,
        fee,
        result: 'insufficient_balance',
        sessionId: session.id,
      });
      throw new ApiError(
        402,
        `Số dư không đủ (cần ${formatVnd(fee)}, có ${formatVnd(err.currentBalance)}). ` +
        `Vui lòng qua làn chờ, nạp thêm tiền và quét lại.`
      );
    }
    throw err;
  }
}
