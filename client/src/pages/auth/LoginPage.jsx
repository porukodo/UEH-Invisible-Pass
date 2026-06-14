import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from './AuthLayout';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/verify-login-otp', { state: { email } });
    } catch (err) {
      setError(err.response?.data?.error || 'Dang nhap khong thanh cong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Dang nhap" subtitle="UEH Invisible Pass">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500">Email sinh vien</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ten@st.ueh.edu.vn"
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-ueh-green"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">Mat khau</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-ueh-green"
          />
        </div>
        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-ueh-green text-white rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? 'Dang xu ly...' : 'Dang nhap'}
        </button>
      </form>
      <p className="text-center text-xs text-slate-400">
        Chua co tai khoan?{' '}
        <Link to="/register" className="text-ueh-orange font-bold">
          Dang ky
        </Link>
      </p>
    </AuthLayout>
  );
}
