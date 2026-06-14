import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { buildQrToken, TOTP_STEP } from '../../utils/crypto';

export default function QRPage() {
  const { user } = useAuth();
  const [token, setToken] = useState('');
  const [timeLeft, setTimeLeft] = useState(TOTP_STEP);

  async function refreshToken() {
    const t = await buildQrToken(user.mssv, user.totpSecret);
    setToken(t);
  }

  useEffect(() => {
    refreshToken();

    const timer = setInterval(() => {
      const secondsIntoWindow = Math.floor(Date.now() / 1000) % TOTP_STEP;
      const remaining = TOTP_STEP - secondsIntoWindow;
      setTimeLeft(remaining);
      if (remaining === TOTP_STEP) refreshToken();
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6 p-4 pb-28 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-4 shadow-card border-t-4 border-ueh-green flex items-center gap-4"
      >
        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-ueh-green font-bold text-xl border border-slate-100">
          {user?.fullName?.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-slate-800">{user?.fullName}</h2>
          <p className="text-[10px] text-slate-500 font-medium tracking-tight">MSSV: {user?.mssv}</p>
          {user?.licensePlate && (
            <p className="text-[10px] text-slate-500 font-medium tracking-tight">Biển số: {user.licensePlate}</p>
          )}
        </div>
        <div className="bg-emerald-50 text-ueh-green text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
          Đã xác thực <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
      </motion.div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-6 shadow-card flex flex-col items-center gap-6 border border-slate-50"
      >
        <div className="bg-ueh-orange text-white text-[10px] font-bold px-4 py-2 rounded-full flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> TOTP ĐỘNG - Tự động đổi mới {TOTP_STEP}s
        </div>

        <div className="w-full aspect-square max-w-[240px] rounded-2xl border-2 border-ueh-green p-3 bg-white shadow-inner flex items-center justify-center overflow-hidden">
          {token && <QRCodeSVG value={token} size={240} level="M" className="w-full h-full" />}
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="2" />
              <motion.circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="#007A55"
                strokeWidth="2"
                strokeDasharray="100, 100"
                animate={{ strokeDashoffset: (1 - timeLeft / TOTP_STEP) * 100 }}
              />
            </svg>
            <span className="absolute text-sm font-bold text-ueh-green">{timeLeft}s</span>
          </div>
          <p className="text-[10px] text-slate-400 italic">Mã mới sau {timeLeft} giây - Không chụp màn hình</p>
        </div>
      </motion.div>

      <div className="flex flex-wrap justify-center gap-2">
        {['Mã hoá AES-256', 'Offline hoạt động', 'Chống gian lận'].map((tag) => (
          <span
            key={tag}
            className="bg-emerald-50 text-ueh-green text-[10px] font-bold px-4 py-2 rounded-full border border-emerald-100/50 shadow-sm"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-50 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Info className="w-4 h-4 text-ueh-green" /> Cách dùng
        </h3>
        <div className="space-y-4">
          {[
            { step: 1, text: 'Mở màn hình này' },
            { step: 2, text: 'Đưa điện thoại vào máy quét' },
            { step: 3, text: 'Cổng tự mở' },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-4">
              <div className="w-7 h-7 rounded-full bg-slate-50 text-slate-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                {item.step}
              </div>
              <p className="text-xs text-slate-600 font-medium">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
