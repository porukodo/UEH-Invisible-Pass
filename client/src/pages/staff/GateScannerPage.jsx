import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, XCircle, ScanLine } from 'lucide-react';
import { api } from '../../api/client';
import { signGatePayload } from '../../utils/crypto';

const SCANNER_ID = 'gate-qr-reader';

export default function GateScannerPage() {
  const [gates, setGates] = useState([]);
  const [gateId, setGateId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // { success, message, fee, balance, fullName }
  const scannerRef = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    api.get('/gate/list').then(({ data }) => {
      setGates(data.gates);
      if (data.gates[0]) setGateId(String(data.gates[0].id));
    });
  }, []);

  async function handleScanSuccess(decodedText) {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      const body = { token: decodedText, gateId: Number(gateId) };
      const payload = JSON.stringify(body);
      const signature = await signGatePayload(payload);

      const { data } = await api.post('/gate/verify', body, {
        headers: { 'X-Gate-Signature': signature },
      });
      setResult({ success: true, ...data });
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.error || 'Loi he thong' });
    } finally {
      setTimeout(() => {
        busyRef.current = false;
        setResult(null);
      }, 3000);
    }
  }

  async function startScanning() {
    if (!gateId) return;
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;
    setScanning(true);

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        handleScanSuccess,
        () => {}
      );
    } catch (err) {
      console.error('Camera error', err);
      setScanning(false);
    }
  }

  async function stopScanning() {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      await scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => () => stopScanning(), []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-6 gap-6">
      <h1 className="text-xl font-bold">Gate Scanner - UEH Invisible Pass</h1>

      <div className="w-full max-w-sm space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-400">Chon cong</label>
          <select
            value={gateId}
            onChange={(e) => setGateId(e.target.value)}
            disabled={scanning}
            className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm"
          >
            {gates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.type === 'entry' ? 'Vao' : 'Ra'})
              </option>
            ))}
          </select>
        </div>

        <div id={SCANNER_ID} className="w-full rounded-2xl overflow-hidden bg-slate-800 min-h-[280px]" />

        <button
          onClick={scanning ? stopScanning : startScanning}
          className="w-full h-12 bg-ueh-green text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
        >
          <ScanLine className="w-5 h-5" /> {scanning ? 'Dung quet' : 'Bat dau quet'}
        </button>

        {result && (
          <div
            className={`rounded-2xl p-4 flex flex-col items-center gap-2 ${
              result.success ? 'bg-emerald-900/50 text-emerald-300' : 'bg-rose-900/50 text-rose-300'
            }`}
          >
            {result.success ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
            {result.success ? (
              <>
                <p className="font-bold">{result.fullName}</p>
                <p className="text-sm">Phi: {Number(result.fee).toLocaleString('vi-VN')} d</p>
                <p className="text-xs opacity-70">So du con lai: {Number(result.balance).toLocaleString('vi-VN')} d</p>
              </>
            ) : (
              <p className="text-sm font-bold text-center">{result.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
