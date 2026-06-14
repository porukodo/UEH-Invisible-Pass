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
      await api.post('/auth/register', form);
      navigate('/verify-email', { state: { email: form.email } });
    } catch (err) {
      setError(err.response?.data?.error || 'Dang ky khong thanh cong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Dang ky tai khoan" subtitle="Danh cho sinh vien UEH (@st.ueh.edu.vn)">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="MSSV" value={form.mssv} onChange={(v) => update('mssv', v)} required />
        <Field label="Ho va ten" value={form.fullName} onChange={(v) => update('fullName', v)} required />
        <Field
          label="Email sinh vien"
          type="email"
          value={form.email}
          onChange={(v) => update('email', v)}
          placeholder="ten@st.ueh.edu.vn"
          required
        />
        <Field label="Mat khau" type="password" value={form.password} onChange={(v) => update('password', v)} required />
        <Field label="Bien so xe (tuy chon)" value={form.licensePlate} onChange={(v) => update('licensePlate', v)} />

        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-ueh-green text-white rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? 'Dang xu ly...' : 'Dang ky'}
        </button>
      </form>
      <p className="text-center text-xs text-slate-400">
        Da co tai khoan?{' '}
        <Link to="/login" className="text-ueh-orange font-bold">
          Dang nhap
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
