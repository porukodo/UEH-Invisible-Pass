import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import AuthLayout from './AuthLayout';

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';
  const [code, setCode] = useState(location.state?.devOtp || '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/verify-email', { email, code });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Xác thực không thành công');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/auth/resend-otp', { email, purpose: 'email_verify' });
      setMessage('Đã gửi lại mã OTP');
      if (data.devOtp) setCode(data.devOtp);
    } catch (err) {
      setError(err.response?.data?.error || 'Không gửi được OTP');
    }
  }

  return (
    <AuthLayout title="Xác thực email" subtitle={`Mã OTP đã được gửi đến ${email}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500">Mã OTP (6 số)</label>
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
          {loading ? 'Đang xử lý...' : 'Xác thực'}
        </button>
        <button type="button" onClick={handleResend} className="w-full text-xs text-ueh-orange font-bold">
          Gửi lại mã
        </button>
      </form>
      <p className="text-center text-xs text-slate-400">
        <Link to="/login" className="text-ueh-orange font-bold">
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
