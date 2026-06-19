import { useState } from 'react';
import { Search, Download, Wallet, DoorOpen } from 'lucide-react';
import { api } from '../../api/client';
import StaffNav from '../../components/StaffNav';
import { formatDbDateTime } from '../../utils/datetime';

export default function AdminPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [adjustMssv, setAdjustMssv] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }
  const [gateId, setGateId] = useState('1');

  async function handleSearch(e) {
    e.preventDefault();
    const { data } = await api.get('/admin/search', { params: { q: query } });
    setResults(data);
  }

  async function handleAdjustment(e) {
    e.preventDefault();
    setMessage(null);
    try {
      const { data } = await api.post('/admin/adjustment', {
        mssv: adjustMssv,
        amount: Number(adjustAmount),
        description: adjustDesc,
      });
      setMessage({
        type: 'success',
        text: `Điều chỉnh thành công. Số dư mới của ${adjustMssv}: ${Number(data.balance).toLocaleString('vi-VN')} đ`,
      });
      setAdjustAmount('');
      setAdjustDesc('');
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi điều chỉnh' });
    }
  }

  async function handleManualOpen() {
    setMessage(null);
    try {
      await api.post('/admin/gate/open', { gateId: Number(gateId) });
      setMessage({ type: 'success', text: 'Đã gửi lệnh mở cổng' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi mở cổng' });
    }
  }

  async function handleExport() {
    const { data } = await api.get('/admin/reports/export', { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reconciliation-report.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <StaffNav />
      <div className="p-6 space-y-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800">Bảng điều khiển Staff/Admin</h1>

        {message && (
          <p className={`text-sm font-bold px-4 py-2 rounded-xl ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}>
            {message.text}
          </p>
        )}

        <section className="bg-white rounded-2xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <Search className="w-4 h-4" /> Tra cứu (FR21)
          </h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="MSSV, biển số, họ tên..."
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            <button className="bg-ueh-green text-white px-5 rounded-xl font-bold">Tìm</button>
          </form>

          {results && (
            <div className="space-y-4 text-sm">
              <ResultTable
                title="Sinh viên"
                rows={results.users}
                columns={['mssv', 'full_name', 'email', 'license_plate', 'role', 'balance']}
              />
              <ResultTable
                title="Giao dịch"
                rows={results.transactions}
                columns={['mssv', 'type', 'amount', 'balance_after', 'gateway_ref', 'created_at']}
              />
              <ResultTable
                title="Lượt quét cổng"
                rows={results.parkingLogs}
                columns={['mssv', 'gate_name', 'gate_type', 'fee', 'result', 'scanned_at']}
              />
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Điều chỉnh số dư thủ công (FR22)
          </h2>
          <form onSubmit={handleAdjustment} className="grid grid-cols-2 gap-3">
            <input
              value={adjustMssv}
              onChange={(e) => setAdjustMssv(e.target.value)}
              placeholder="MSSV"
              required
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            <input
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="Số tiền (+/-)"
              type="number"
              required
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            <input
              value={adjustDesc}
              onChange={(e) => setAdjustDesc(e.target.value)}
              placeholder="Mô tả"
              className="col-span-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            <button className="col-span-2 bg-ueh-orange text-white py-2.5 rounded-xl font-bold">
              Áp dụng
            </button>
          </form>
        </section>

        <section className="bg-white rounded-2xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <DoorOpen className="w-4 h-4" /> Mở cổng thủ công (FR22)
          </h2>
          <div className="flex gap-2">
            <input
              value={gateId}
              onChange={(e) => setGateId(e.target.value)}
              placeholder="Gate ID"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            <button onClick={handleManualOpen} className="bg-ueh-green text-white px-5 rounded-xl font-bold">
              Mở cổng
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <Download className="w-4 h-4" /> Xuất báo cáo đối soát (FR23)
          </h2>
          <button onClick={handleExport} className="bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold">
            Xuất Excel
          </button>
        </section>
      </div>
    </div>
  );
}

const COLUMN_LABELS = {
  mssv: 'MSSV',
  full_name: 'Họ tên',
  email: 'Email',
  license_plate: 'Biển số',
  role: 'Vai trò',
  balance: 'Số dư (đ)',
  type: 'Loại',
  amount: 'Số tiền',
  balance_after: 'Số dư sau',
  gateway_ref: 'Mã tham chiếu',
  created_at: 'Thời gian',
  gate_name: 'Cổng',
  gate_type: 'Loại cổng',
  fee: 'Phí',
  result: 'Kết quả',
  scanned_at: 'Thời gian quét',
};

const CURRENCY_COLS = new Set(['amount', 'balance_after', 'fee', 'balance']);

function ResultTable({ title, rows, columns }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div>
      <h3 className="font-bold text-slate-600 mb-1">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-slate-100 rounded-xl overflow-hidden">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-2 py-1.5 text-left font-bold text-slate-500">
                  {COLUMN_LABELS[c] ?? c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-50">
                {columns.map((c) => {
                  const val = row[c];
                  let display;
                  if (c.endsWith('_at')) {
                    display = formatDbDateTime(val);
                  } else if (CURRENCY_COLS.has(c) && val != null) {
                    display = Number(val).toLocaleString('vi-VN') + ' đ';
                  } else {
                    display = String(val ?? '');
                  }
                  return (
                    <td key={c} className="px-2 py-1.5">
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
