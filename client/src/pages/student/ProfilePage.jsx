import { LogOut, Car, IdCard, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-28 overflow-y-auto">
      <section className="flex flex-col items-center gap-3 mt-4">
        <div className="w-24 h-24 bg-white rounded-full shadow-card flex items-center justify-center border-2 border-ueh-green/10">
          <span className="text-4xl font-black text-ueh-green select-none">{user?.fullName?.charAt(0)}</span>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">{user?.fullName}</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">MSSV: {user?.mssv}</p>
        </div>
      </section>

      <div className="bg-white rounded-2xl shadow-card border border-slate-50 overflow-hidden">
        <InfoRow icon={Mail} label="Email" value={user?.email} />
        <InfoRow icon={IdCard} label="Vai trò" value={user?.role} />
        <InfoRow icon={Car} label="Biển số xe" value={user?.licensePlate || 'Chưa cập nhật'} last />
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-white text-rose-500 font-bold text-sm py-4 rounded-xl border border-rose-100 shadow-sm active:scale-[0.98] transition-transform mb-12 flex items-center justify-center gap-2"
      >
        <LogOut className="w-5 h-5" /> Đăng xuất
      </button>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, last }) {
  return (
    <div className={`px-5 py-4 flex items-center gap-4 ${!last ? 'border-b border-slate-50' : ''}`}>
      <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-ueh-green">
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 text-left">
        <div className="text-[10px] text-slate-400 font-medium uppercase">{label}</div>
        <div className="text-xs font-bold text-slate-700">{value}</div>
      </div>
    </div>
  );
}
