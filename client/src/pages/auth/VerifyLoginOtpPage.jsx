import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import AuthLayout from './AuthLayout';

export default function VerifyLoginOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyLoginOtp } = useAuth();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState(location.state?.devOtp || '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await verifyLoginOtp(email, code);
      // Staff/admin land on their dashboard; students on the wallet.
      navigate(loggedInUser.role === 'student' ? '/' : '/admin');
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
      const { data } = await api.post('/auth/resend-otp', { email, purpose: 'login' });
      setMessage('Đã gửi lại mã OTP');
      if (data.devOtp) setCode(data.devOtp);
    } catch (err) {
      setError(err.response?.data?.error || 'Không gửi được OTP');
    }
  }

  return (
    <AuthLayout title="Xác thực đăng nhập" subtitle="Nhập email và mã OTP đã được gửi đến email của bạn">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ten@st.ueh.edu.vn"
            required
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-ueh-green"
          />
        </div>
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
          {loading ? 'Đang xử lý...' : 'Xác nhận'}
        </button>
        <button type="button" onClick={handleResend} className="w-full text-xs text-ueh-orange font-bold">
          Gửi lại mã
        </button>
      </form>
    </AuthLayout>
  );
}
