import { useState } from 'react';
import { Search, Download, Wallet, DoorOpen } from 'lucide-react';
import { api } from '../../api/client';

export default function AdminPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [adjustMssv, setAdjustMssv] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');
  const [message, setMessage] = useState('');
  const [gateId, setGateId] = useState('1');

  async function handleSearch(e) {
    e.preventDefault();
    const { data } = await api.get('/admin/search', { params: { q: query } });
    setResults(data);
  }

  async function handleAdjustment(e) {
    e.preventDefault();
    setMessage('');
    try {
      const { data } = await api.post('/admin/adjustment', {
        mssv: adjustMssv,
        amount: Number(adjustAmount),
        description: adjustDesc,
      });
      setMessage(`Da dieu chinh. So du moi: ${Number(data.balance).toLocaleString('vi-VN')} d`);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Loi dieu chinh');
    }
  }

  async function handleManualOpen() {
    setMessage('');
    try {
      await api.post('/admin/gate/open', { gateId: Number(gateId) });
      setMessage('Da gui lenh mo cong');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Loi mo cong');
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
    <div className="min-h-screen bg-slate-100 p-6 space-y-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800">Bang dieu khien Staff/Admin</h1>

      <section className="bg-white rounded-2xl shadow-card p-5 space-y-4">
        <h2 className="font-bold text-slate-700 flex items-center gap-2">
          <Search className="w-4 h-4" /> Tra cuu (FR21)
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="MSSV, bien so, ho ten..."
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
          <button className="bg-ueh-green text-white px-5 rounded-xl font-bold">Tim</button>
        </form>

        {results && (
          <div className="space-y-4 text-sm">
            <ResultTable title="Sinh vien" rows={results.users} columns={['mssv', 'full_name', 'email', 'license_plate', 'role']} />
            <ResultTable
              title="Giao dich"
              rows={results.transactions}
              columns={['mssv', 'type', 'amount', 'balance_after', 'gateway_ref', 'created_at']}
            />
            <ResultTable
              title="Luot quet cong"
              rows={results.parkingLogs}
              columns={['mssv', 'gate_name', 'gate_type', 'fee', 'result', 'scanned_at']}
            />
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow-card p-5 space-y-4">
        <h2 className="font-bold text-slate-700 flex items-center gap-2">
          <Wallet className="w-4 h-4" /> Dieu chinh so du thu cong (FR22)
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
            placeholder="So tien (+/-)"
            type="number"
            required
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
          <input
            value={adjustDesc}
            onChange={(e) => setAdjustDesc(e.target.value)}
            placeholder="Mo ta"
            className="col-span-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
          <button className="col-span-2 bg-ueh-orange text-white py-2.5 rounded-xl font-bold">Ap dung</button>
        </form>
      </section>

      <section className="bg-white rounded-2xl shadow-card p-5 space-y-4">
        <h2 className="font-bold text-slate-700 flex items-center gap-2">
          <DoorOpen className="w-4 h-4" /> Mo cong thu cong (FR22)
        </h2>
        <div className="flex gap-2">
          <input
            value={gateId}
            onChange={(e) => setGateId(e.target.value)}
            placeholder="Gate ID"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
          <button onClick={handleManualOpen} className="bg-ueh-green text-white px-5 rounded-xl font-bold">
            Mo cong
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-card p-5 space-y-4">
        <h2 className="font-bold text-slate-700 flex items-center gap-2">
          <Download className="w-4 h-4" /> Xuat bao cao doi soat (FR23)
        </h2>
        <button onClick={handleExport} className="bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold">
          Xuat Excel
        </button>
      </section>

      {message && <p className="text-sm font-bold text-ueh-green">{message}</p>}
    </div>
  );
}

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
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-50">
                {columns.map((c) => (
                  <td key={c} className="px-2 py-1.5">
                    {String(row[c] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
