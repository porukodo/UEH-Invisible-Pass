import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import AuthLayout from './AuthLayout';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ mssv: '', fullName: '', email: '', password: '', licensePlate: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      navigate('/verify-email', { state: { email: form.email, devOtp: data.devOtp } });
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng ký không thành công');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Đăng ký tài khoản" subtitle="Dành cho sinh viên UEH (@st.ueh.edu.vn)">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="MSSV" value={form.mssv} onChange={(v) => update('mssv', v)} required />
        <Field label="Họ và tên" value={form.fullName} onChange={(v) => update('fullName', v)} required />
        <Field
          label="Email sinh viên"
          type="email"
          value={form.email}
          onChange={(v) => update('email', v)}
          placeholder="ten@st.ueh.edu.vn"
          required
        />
        <Field label="Mật khẩu" type="password" value={form.password} onChange={(v) => update('password', v)} required />
        <Field label="Biển số xe (tuỳ chọn)" value={form.licensePlate} onChange={(v) => update('licensePlate', v)} />

        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-ueh-green text-white rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? 'Đang xử lý...' : 'Đăng ký'}
        </button>
      </form>
      <p className="text-center text-xs text-slate-400">
        Đã có tài khoản?{' '}
        <Link to="/login" className="text-ueh-orange font-bold">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}

function Field({ label, value, onChange, type = 'text', required, placeholder }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-ueh-green"
      />
    </div>
  );
}
