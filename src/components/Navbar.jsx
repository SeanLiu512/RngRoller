import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { APP_NAME } from '@/lib/config';
import { Dices, Trophy, Info, User, LogOut, LogIn, Shield, Menu, X, ShoppingBag, Swords } from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = isAuthenticated && user?.role === 'admin';
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Player';

  const links = [
    { to: '/', label: 'Play', icon: Dices },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { to: '/arena', label: 'Arena', icon: Swords },
    { to: '/shop', label: 'Shop', icon: ShoppingBag },
    { to: '/about', label: 'About', icon: Info },
  ];
  if (isAuthenticated) links.push({ to: '/profile', label: 'Profile', icon: User });
  if (isAdmin) links.push({ to: '/admin', label: 'Admin', icon: Shield });

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/30">
            <Dices className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(to) ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {isAuthenticated ? (
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-200"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:opacity-90"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Link>
          )}
        </nav>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 md:hidden">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-zinc-800/60 px-4 py-3 md:hidden">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                isActive(to) ? 'bg-zinc-800 text-white' : 'text-zinc-400'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {isAuthenticated ? (
            <button onClick={() => logout()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400">
              <LogOut className="h-4 w-4" />
              Logout ({displayName})
            </button>
          ) : (
            <Link to="/login" onClick={() => setMobileOpen(false)} className="mt-2 flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-600 px-3 py-2.5 text-sm font-semibold text-white">
              <LogIn className="h-4 w-4" />
              Sign In
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}