import { NavLink } from 'react-router-dom';
import { Wallet, QrCode, CreditCard, User } from 'lucide-react';

const tabs = [
  { to: '/', label: 'Ví', icon: Wallet },
  { to: '/topup', label: 'Nạp tiền', icon: CreditCard },
  { to: '/qr', label: 'Thẻ QR', icon: QrCode },
  { to: '/profile', label: 'Tài khoản', icon: User },
];

export default function BottomNav() {
  return (
    <nav className="bg-white border-t border-slate-100 w-full z-[100] flex justify-around items-center px-4 pt-3 pb-6 shadow-[0_-4px_20px_rgba(0,92,64,0.08)] rounded-t-3xl mt-auto">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 transition-all duration-200 relative ${
              isActive ? 'text-ueh-green font-bold scale-105' : 'text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <div className="absolute -top-3 w-1 h-1 rounded-full bg-ueh-green"></div>}
              <tab.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium tracking-wide uppercase">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
