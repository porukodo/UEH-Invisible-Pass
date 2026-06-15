import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../api/client';

const AMOUNTS = [20000, 50000, 100000, 200000, 500000];

export default function TopUpPage() {
  const [selectedAmount, setSelectedAmount] = useState(50000);
  const [showQR, setShowQR] = useState(false);
  const [topup, setTopup] = useState(null);
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  async function startTopup() {
    setError('');
    try {
      const { data } = await api.post('/wallet/topup', { amount: selectedAmount });
      setTopup(data);
      setStatus('pending');
      setShowQR(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Không tạo được yêu cầu nạp tiền');
    }
  }

  useEffect(() => {
    if (!showQR || !topup) return;

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/wallet/topup/${topup.gatewayRef}`);
        setStatus(data.status);
        if (data.status === 'confirmed' || data.status === 'expired') {
          clearInterval(pollRef.current);
        }
      } catch {
        setStatus('offline');
      }
    }, 3000);

    return () => clearInterval(pollRef.current);
  }, [showQR, topup]);

  function closeQR() {
    setShowQR(false);
    setTopup(null);
    clearInterval(pollRef.current);
  }

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="bg-ueh-green w-full py-4 px-4 flex flex-col justify-center text-white">
        <div className="text-sm opacity-90">Nạp tiền vào ví qua VietQR</div>
        <div className="text-[10px] opacity-60 mt-0.5 italic">Số dư tối thiểu khuyến nghị: 20.000 đ</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-6">
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Chọn mệnh giá</h2>
          <div className="grid grid-cols-2 gap-3">
            {AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => setSelectedAmount(amount)}
                className={`py-3.5 rounded-xl text-sm font-bold border transition-all ${
                  selectedAmount === amount
                    ? 'bg-orange-50 border-ueh-orange text-ueh-orange shadow-md'
                    : 'bg-white border-slate-100 text-slate-800 hover:border-slate-200'
                }`}
              >
                {amount.toLocaleString('vi-VN')} đ
              </button>
            ))}
          </div>
        </div>

        <div className="bg-emerald-50/50 rounded-2xl p-4 space-y-3 border border-emerald-100">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-slate-800">Tổng thanh toán</span>
            <span className="text-lg font-bold text-ueh-dark-green">{selectedAmount.toLocaleString('vi-VN')} đ</span>
          </div>
        </div>

        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
      </div>

      <div className="absolute bottom-6 left-0 w-full p-4 bg-white border-t border-slate-100 z-10 box-border">
        <button
          onClick={startTopup}
          className="w-full h-14 bg-ueh-orange text-white rounded-xl font-bold shadow-lg hover:brightness-110 active:scale-[0.98] transition-all"
        >
          Nạp {selectedAmount.toLocaleString('vi-VN')} đ qua VietQR
        </button>
      </div>

      <AnimatePresence>
        {showQR && topup && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center p-6"
          >
            <button
              onClick={closeQR}
              className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold text-slate-800 mb-2">Quét mã để nạp tiền</h2>
            <p className="text-sm text-slate-500 mb-8 text-center max-w-xs">
              Mở ứng dụng ngân hàng để quét mã. Hệ thống sẽ tự động cộng tiền sau vài giây.
            </p>

            <div className="bg-white p-4 rounded-3xl shadow-2xl border border-slate-100 mb-8 relative">
              <img src={topup.qrUrl} alt="VietQR" className="w-64 h-64 object-contain" />
            </div>

            <StatusBadge status={status} />

            <p className="text-xs text-slate-500 mt-6 text-center">
              Nội dung chuyển khoản: <span className="font-bold text-slate-700">{topup.content}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1 italic">
              Vui lòng giữ nguyên nội dung này khi chuyển khoản
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'confirmed') {
    return (
      <div className="bg-emerald-50 text-ueh-green px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-sm">
        <CheckCircle2 className="w-5 h-5" /> Nạp tiền thành công!
      </div>
    );
  }
  if (status === 'offline') {
    return (
      <div className="bg-amber-50 text-amber-600 px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-sm">
        <WifiOff className="w-5 h-5" /> Mất kết nối - đang thử lại...
      </div>
    );
  }
  if (status === 'expired' || status === 'failed') {
    return (
      <div className="bg-rose-50 text-rose-500 px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-sm">
        Không xác nhận được giao dịch. Vui lòng liên hệ quầy hỗ trợ.
      </div>
    );
  }
  return (
    <div className="bg-emerald-50 text-ueh-green px-6 py-3 rounded-full font-bold flex items-center gap-2 animate-pulse shadow-sm">
      <CheckCircle2 className="w-5 h-5" /> Đang chờ thanh toán...
    </div>
  );
}
