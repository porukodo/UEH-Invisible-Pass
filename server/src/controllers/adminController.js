import ExcelJS from 'exceljs';
import { searchUsers, findUserByMssv } from '../models/userModel.js';
import { searchTransactions } from '../models/transactionModel.js';
import { searchParkingLogs } from '../models/parkingModel.js';
import { applyLedgerEntry } from '../models/walletModel.js';
import { emitToGate } from '../utils/realtime.js';
import { findGateById } from '../models/gateModel.js';
import { ApiError } from '../middleware/errorHandler.js';

/** FR21: admin/staff search by MSSV, license plate, or time range. */
export async function search(req, res, next) {
  try {
    const { q, from, to } = req.query;

    const [users, transactions, parkingLogs] = await Promise.all([
      q ? searchUsers({ q }) : [],
      searchTransactions({ q, from, to }),
      searchParkingLogs({ q, from, to }),
    ]);

    res.json({ users, transactions, parkingLogs });
  } catch (err) {
    next(err);
  }
}

/** FR22: staff manually adjusts a user's wallet balance (e.g. failed-scan correction). */
export async function manualAdjustment(req, res, next) {
  try {
    const { mssv, amount, description } = req.body;
    const amt = Number(amount);
    if (!mssv || !amt) throw new ApiError(400, 'Thiếu MSSV hoặc số tiền');

    const user = await findUserByMssv(mssv);
    if (!user) throw new ApiError(404, 'Không tìm thấy sinh viên');

    const { transactionId, balance } = await applyLedgerEntry({
      userId: user.id,
      type: 'adjustment',
      amount: amt,
      description: description || 'Điều chỉnh bởi nhân viên',
      createdBy: req.user.id,
    });

    res.json({ transactionId, balance });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_BALANCE') return next(new ApiError(402, 'Số dư không đủ để trừ'));
    next(err);
  }
}

/** FR22: staff remotely opens a gate (e.g. malfunctioning scanner). */
export async function manualGateOpen(req, res, next) {
  try {
    const { gateId } = req.body;
    const gate = await findGateById(gateId);
    if (!gate) throw new ApiError(404, 'Không tìm thấy cổng');

    await emitToGate(gateId, 'GATE_OPEN', {
      gateId,
      manual: true,
      openedBy: req.user.fullName,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/** FR23: export a reconciliation report (transactions) as an Excel file. */
export async function exportReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const transactions = await searchTransactions({ from, to });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reconciliation');
    sheet.columns = [
      { header: 'Transaction ID', key: 'id', width: 15 },
      { header: 'MSSV', key: 'mssv', width: 15 },
      { header: 'Họ tên', key: 'full_name', width: 25 },
      { header: 'Loại', key: 'type', width: 12 },
      { header: 'Số tiền', key: 'amount', width: 15 },
      { header: 'Số dư sau GD', key: 'balance_after', width: 15 },
      { header: 'Trạng thái', key: 'status', width: 12 },
      { header: 'Mã tham chiếu', key: 'gateway_ref', width: 25 },
      { header: 'Mô tả', key: 'description', width: 30 },
      { header: 'Thời gian', key: 'created_at', width: 22 },
    ];
    sheet.addRows(transactions);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reconciliation-report.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}
