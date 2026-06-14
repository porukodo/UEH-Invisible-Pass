import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from './Header';
import BottomNav from './BottomNav';

const TITLES = {
  '/': 'Invisible Pass',
  '/topup': 'Nạp tiền',
  '/qr': 'Thẻ xe kỹ thuật số',
  '/profile': 'Tài khoản',
};

export default function MobileFrame() {
  const location = useLocation();
  const title = TITLES[location.pathname] || 'Invisible Pass';
  const isProfile = location.pathname === '/profile';

  return (
    <div className="flex justify-center w-full min-h-screen bg-slate-200">
      <div className="w-full max-w-[390px] h-[844px] bg-background relative overflow-hidden flex flex-col shadow-2xl my-auto md:rounded-[40px] border-[8px] border-slate-900">
        <Header title={title} dark={!isProfile} />

        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="absolute inset-0 overflow-y-auto"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
