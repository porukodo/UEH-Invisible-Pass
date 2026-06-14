import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MobileFrame from './components/MobileFrame';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import VerifyLoginOtpPage from './pages/auth/VerifyLoginOtpPage';

import WalletPage from './pages/student/WalletPage';
import TopUpPage from './pages/student/TopUpPage';
import QRPage from './pages/student/QRPage';
import ProfilePage from './pages/student/ProfilePage';

import GateScannerPage from './pages/staff/GateScannerPage';
import BarrierSimulatorPage from './pages/staff/BarrierSimulatorPage';
import AdminPage from './pages/staff/AdminPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-login-otp" element={<VerifyLoginOtpPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MobileFrame />}>
            <Route path="/" element={<WalletPage />} />
            <Route path="/topup" element={<TopUpPage />} />
            <Route path="/qr" element={<QRPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['staff', 'admin']} />}>
          <Route path="/gate-scanner" element={<GateScannerPage />} />
          <Route path="/barrier" element={<BarrierSimulatorPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
