import { NavLink, useNavigate } from 'react-router-dom';
import { Wallet, ScanLine, DoorOpen, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { to: '/admin', label: 'Quản trị', icon: Wallet },
  { to: '/gate-scanner', label: 'Máy quét', icon: ScanLine },
  { to: '/barrier', label: 'Thanh chắn', icon: DoorOpen },
];

/** Top navigation shared by the staff/admin pages, which live outside the
 *  student MobileFrame and otherwise have no way to move between each other. */
export default function StaffNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="w-full bg-slate-950 text-white flex items-center gap-1 px-4 py-2.5 shadow-md">
      <span className="font-bold text-sm mr-3 select-none">UEH Pass</span>
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isActive ? 'bg-ueh-green text-white' : 'text-slate-300 hover:bg-slate-800'
            }`
          }
        >
          <l.icon className="w-4 h-4" />
          <span className="hidden sm:inline">{l.label}</span>
        </NavLink>
      ))}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-[11px] text-slate-400 hidden md:block">
          {user?.fullName} · {user?.role}
        </span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </nav>
  );
}
