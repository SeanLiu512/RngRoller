import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { ShieldX } from 'lucide-react';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import About from './pages/About';
import Shop from './pages/Shop';
import Arena from './pages/Arena';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminCodeNotifier from '@/components/AdminCodeNotifier';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, logout } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'user_banned') {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0f] px-4 text-center">
          <ShieldX className="h-16 w-16 text-red-500" />
          <h1 className="text-2xl font-bold text-zinc-100">Account Banned</h1>
          <p className="max-w-sm text-sm text-zinc-500">
            Your account has been banned by an administrator. If you believe this is a mistake, please contact support.
          </p>
          <button
            onClick={() => logout()}
            className="mt-4 rounded-xl bg-zinc-800 px-6 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-700"
          >
            Log Out
          </button>
        </div>
      );
    }
  }

  // Render the main app
  return (
    <>
      <AdminCodeNotifier />
      <Routes>
        {/* Add your page Route elements here */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/about" element={<About />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/arena" element={<Arena />} />
          <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
};

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App