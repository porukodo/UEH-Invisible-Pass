import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Car, History as HistoryIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function WalletPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);

  async function load() {
    try {
      const [walletRes, txRes] = await Promise.all([
        api.get('/wallet/me'),
        api.get('/wallet/transactions'),
      ]);
      setBalance(walletRes.data.balance);
      setUpdatedAt(walletRes.data.updatedAt);
      setTransactions(txRes.data.transactions);
    } catch (err) {
      console.error('Failed to load wallet', err);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentTime = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-ueh-dark-green rounded-[20px] p-6 relative overflow-hidden text-white shadow-xl"
      >
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-ueh-green rounded-full opacity-50 blur-xl"></div>
        <div className="relative z-10 space-y-4">
          <p className="text-sm text-white/70 font-medium">So du kha dung ({user?.fullName})</p>
          <h2 className="text-4xl font-bold tracking-tight">{Number(balance).toLocaleString('vi-VN')} d</h2>
          <p className="text-[10px] text-white/50">Cap nhat luc {currentTime}</p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => navigate('/topup')}
              className="bg-ueh-orange text-white px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform"
            >
              Nap tien <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/qr')}
              className="bg-white/20 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-white/30 transition-colors"
            >
              The QR
            </button>
          </div>
        </div>
      </motion.div>

      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-bold text-slate-800">Giao dich gan day</h3>
        </div>

        <div className="flex flex-col gap-3">
          {transactions.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">Chua co giao dich nao</p>
          )}
          {transactions.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className="bg-white h-16 rounded-xl p-3 flex items-center justify-between shadow-card"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    Number(tx.amount) < 0 ? 'bg-emerald-50 text-ueh-green' : 'bg-orange-50 text-ueh-orange'
                  }`}
                >
                  {Number(tx.amount) < 0 ? <Car className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">{tx.description || tx.type}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(tx.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>
              <span className={`text-xs font-bold ${Number(tx.amount) < 0 ? 'text-rose-500' : 'text-ueh-green'}`}>
                {Number(tx.amount) > 0 ? '+' : ''}
                {Number(tx.amount).toLocaleString('vi-VN')} d
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
