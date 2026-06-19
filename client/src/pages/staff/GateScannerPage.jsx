import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, XCircle, ScanLine } from 'lucide-react';
import { api } from '../../api/client';
import { signGatePayload } from '../../utils/crypto';
import StaffNav from '../../components/StaffNav';

const SCANNER_ID = 'gate-qr-reader';

function gateLabel(g) {
  return `${g.name} - ${g.type === 'entry' ? 'Vào' : 'Ra'}`;
}

export default function GateScannerPage() {
  const [gates, setGates] = useState([]);
  const [gateId, setGateId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  // Ref keeps the callback always reading the current gateId without needing
  // to restart the camera when the user switches gates mid-session.
  const gateIdRef = useRef(gateId);

  useEffect(() => {
    gateIdRef.current = gateId;
  }, [gateId]);

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
      const body = { token: decodedText, gateId: Number(gateIdRef.current) };
      const payload = JSON.stringify(body);
      const signature = await signGatePayload(payload);

      const { data } = await api.post('/gate/verify', body, {
        headers: { 'X-Gate-Signature': signature },
      });
      setResult({ success: true, ...data });
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.error || 'Lỗi hệ thống' });
    } finally {
      setTimeout(() => {
        busyRef.current = false;
        setResult(null);
      }, 3000);
    }
  }

  async function startScanning() {
    if (!gateIdRef.current) return;
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
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <StaffNav />
      <div className="flex-1 flex flex-col items-center p-6 gap-6">
        <h1 className="text-xl font-bold">Gate Scanner - UEH Invisible Pass</h1>

        <div className="w-full max-w-sm space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400">Chọn cổng</label>
            <select
              value={gateId}
              onChange={(e) => setGateId(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm"
            >
              {gates.map((g) => (
                <option key={g.id} value={g.id}>
                  {gateLabel(g)}
                </option>
              ))}
            </select>
            {scanning && (
              <p className="text-xs text-amber-400 mt-1">
                Đang quét tại: {gateLabel(gates.find((g) => String(g.id) === gateId) ?? {})}
              </p>
            )}
          </div>

          <div id={SCANNER_ID} className="w-full rounded-2xl overflow-hidden bg-slate-800 min-h-[280px]" />

          <button
            onClick={scanning ? stopScanning : startScanning}
            className="w-full h-12 bg-ueh-green text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
          >
            <ScanLine className="w-5 h-5" /> {scanning ? 'Dừng quét' : 'Bắt đầu quét'}
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
                  <p className="text-sm">Phí: {Number(result.fee).toLocaleString('vi-VN')} đ</p>
                  {result.balance != null && (
                    <p className="text-xs opacity-70">
                      Số dư còn lại: {Number(result.balance).toLocaleString('vi-VN')} đ
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm font-bold text-center">{result.message}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
