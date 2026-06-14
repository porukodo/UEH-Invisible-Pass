import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import AuthLayout from './AuthLayout';

export default function VerifyLoginOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyLoginOtp } = useAuth();
  const email = location.state?.email || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyLoginOtp(email, code);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Xac thuc khong thanh cong');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setMessage('');
    try {
      await api.post('/auth/resend-otp', { email, purpose: 'login' });
      setMessage('Da gui lai ma OTP');
    } catch (err) {
      setError(err.response?.data?.error || 'Khong gui duoc OTP');
    }
  }

  return (
    <AuthLayout title="Xac thuc dang nhap" subtitle={`Ma OTP da duoc gui den ${email}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500">Ma OTP (6 so)</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            required
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-lg tracking-[6px] font-bold focus:outline-none focus:border-ueh-green"
          />
        </div>
        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        {message && <p className="text-xs text-ueh-green font-medium">{message}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-ueh-green text-white rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? 'Dang xu ly...' : 'Xac nhan'}
        </button>
        <button type="button" onClick={handleResend} className="w-full text-xs text-ueh-orange font-bold">
          Gui lai ma
        </button>
      </form>
    </AuthLayout>
  );
}
