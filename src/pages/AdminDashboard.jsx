import { db } from '@/api/client';

import { useState, useEffect, useCallback } from 'react';

import { useAuth } from '@/lib/AuthContext';
import { APP_NAME } from '@/lib/config';
import { getRarityStyle, formatEP, getRarityInfo } from '@/lib/rollEngine';
import { Shield, Users, Dices, Trash2, TrendingUp, AlertCircle, ShieldCheck, ShieldOff, Ban, RotateCcw, UserCog, KeyRound, Copy } from 'lucide-react';

export default function AdminDashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const [rolls, setRolls] = useState([]);
  const [users, setUsers] = useState([]);
  const [pendingCodes, setPendingCodes] = useState([]);
  const [codesError, setCodesError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // user id being acted on
  const [tab, setTab] = useState('users');
  const [usersError, setUsersError] = useState(null);

  const isAdmin = isAuthenticated && user?.role === 'admin';
  const isSuperAdmin = isAdmin;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUsersError(null);
    try {
      const allRolls = await db.entities.Roll.list('-created_date', 200);
      setRolls(allRolls || []);
    } catch {
      setError('Failed to load admin data.');
    }
    try {
      const allUsers = await db.entities.User.list();
      setUsers(allUsers || []);
    } catch (err) {
      setUsers([]);
      setUsersError(`Unable to load users: ${err?.message || 'permission denied'}. If you were recently promoted, please log out and log back in.`);
    }
    try {
      const codes = await db.auth.pendingCodes();
      setPendingCodes(codes || []);
    } catch (err) {
      setPendingCodes([]);
      setCodesError(err?.message || 'Failed to load pending codes.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchData();
    else setLoading(false);
  }, [isAdmin, fetchData]);

  useEffect(() => {
    if (isAdmin && tab === 'codes') {
      db.auth.pendingCodes().then(setPendingCodes).catch((err) => setCodesError(err?.message || 'Failed to load pending codes.'));
    }
  }, [isAdmin, tab]);

  const handleUserRole = async (userId, makeAdmin) => {
    if (userId === user?.id) return;
    if (!isSuperAdmin) return;
    setActionLoading(userId);
    try {
      await db.entities.User.update(userId, { role: makeAdmin ? 'admin' : 'user' });
      setUsers(users.map(u => u.id === userId ? { ...u, role: makeAdmin ? 'admin' : 'user' } : u));
      if (makeAdmin) {
        const target = users.find(u => u.id === userId);
        if (target?.email) {
          db.integrations.Core.SendEmail({
            to: target.email,
            subject: `You are now an admin on ${APP_NAME}!`,
            body: `Hi ${target.full_name || target.email},\n\nYou've been promoted to admin on ${APP_NAME}. To activate your admin access, please log out and log back in.\n\nAfter re-logging in, visit: ${window.location.origin}/admin`
          }).catch(() => {});
        }
        alert('User promoted to admin. They must log out and log back in to access the admin panel.');
      }
    } catch {
      alert('Failed to update role — admin access required.');
    }
    setActionLoading(null);
  };

  const handleBan = async (userId, ban) => {
    if (userId === user?.id) return;
    if (!isSuperAdmin) return;
    const msg = ban
      ? 'Ban this user? They will be logged out and unable to use the app.'
      : 'Unban this user?';
    if (!confirm(msg)) return;
    setActionLoading(userId);
    try {
      await db.entities.User.update(userId, { banned: ban });
      setUsers(users.map(u => u.id === userId ? { ...u, banned: ban } : u));
    } catch {
      alert('Failed to update ban status — admin access required.');
    }
    setActionLoading(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this roll?')) return;
    try {
      await db.entities.Roll.delete(id);
      setRolls(rolls.filter(r => r.id !== id));
    } catch {
      alert('Could not delete — admin role required.');
    }
  };

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-zinc-600" />
        <h1 className="mb-2 text-xl font-bold">Admin Access Required</h1>
        <p className="text-sm text-zinc-500">
          This area is restricted to administrators. Sign in with an admin account to access this page.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-violet-500" />
      </div>
    );
  }

  const totalEP = rolls.reduce((s, r) => s + (r.ep || 0), 0);
  const uniqueRollers = new Set(rolls.map(r => r.roller_name)).size;
  const todayStr = new Date().toISOString().split('T')[0];
  const rollsToday = rolls.filter(r => r.roll_date === todayStr).length;
  const bannedCount = users.filter(u => u.banned).length;

  const tabs = [
    { id: 'users', label: 'Users', icon: UserCog },
    { id: 'rolls', label: 'Rolls', icon: Dices },
    { id: 'codes', label: 'Codes', icon: KeyRound },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <Shield className="h-6 w-6 text-violet-400" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <Dices className="mx-auto mb-1 h-5 w-5 text-violet-400" />
          <div className="text-xl font-bold">{rolls.length}</div>
          <div className="text-xs text-zinc-500">Total Rolls</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <Users className="mx-auto mb-1 h-5 w-5 text-blue-400" />
          <div className="text-xl font-bold">{users.length || uniqueRollers}</div>
          <div className="text-xs text-zinc-500">Users</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <TrendingUp className="mx-auto mb-1 h-5 w-5 text-emerald-400" />
          <div className="text-xl font-bold">{rollsToday}</div>
          <div className="text-xs text-zinc-500">Rolls Today</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="mx-auto mb-1 text-sm font-bold text-amber-400">EP</div>
          <div className="text-xl font-bold">{formatEP(totalEP)}</div>
          <div className="text-xs text-zinc-500">Total EP</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === t.id ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Users ({users.length})</h2>
            {bannedCount > 0 && (
              <span className="text-xs text-red-400">{bannedCount} banned</span>
            )}
          </div>
          {users.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 py-8 text-center text-sm text-zinc-600">
              {usersError || 'No users found.'}
              {usersError && (
                <button
                  onClick={() => logout()}
                  className="mt-4 inline-block rounded-lg bg-violet-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-violet-500"
                >
                  Log Out Now
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {users.map(u => {
                const isSelf = u.id === user?.id;
                const isAdminUser = u.role === 'admin';
                return (
                  <div
                    key={u.id}
                    className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                      u.banned ? 'border-red-800/60 bg-red-950/20' : 'border-zinc-800 bg-zinc-900/40'
                    }`}
                  >
                    {/* User info */}
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        isAdminUser ? 'bg-violet-500/20' : 'bg-zinc-800'
                      }`}>
                        {isAdminUser ? (
                          <ShieldCheck className="h-5 w-5 text-violet-400" />
                        ) : (
                          <Users className="h-5 w-5 text-zinc-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{u.full_name || u.email?.split('@')[0]}</span>
                          {isSelf && <span className="text-[10px] text-zinc-500">(you)</span>}
                          {u.banned && (
                            <span className="rounded-full bg-red-950/60 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400">Banned</span>
                          )}
                        </div>
                        {u.email && <span className="text-xs text-zinc-500">{u.email}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* Promote / Demote — super admin only */}
                      {!isSelf && isSuperAdmin && (
                        <button
                          onClick={() => handleUserRole(u.id, !isAdminUser)}
                          disabled={actionLoading === u.id}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                            isAdminUser
                              ? 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                              : 'border border-violet-700 text-violet-400 hover:bg-violet-950/40'
                          }`}
                          title={isAdminUser ? 'Demote to user' : 'Promote to admin'}
                        >
                          {isAdminUser ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          {isAdminUser ? 'Demote' : 'Promote'}
                        </button>
                      )}

                      {/* Ban / Unban — super admin only */}
                      {!isSelf && isSuperAdmin && (
                        <button
                          onClick={() => handleBan(u.id, !u.banned)}
                          disabled={actionLoading === u.id}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                            u.banned
                              ? 'border border-emerald-700 text-emerald-400 hover:bg-emerald-950/40'
                              : 'border border-red-800 text-red-400 hover:bg-red-950/40'
                          }`}
                          title={u.banned ? 'Unban user' : 'Ban user'}
                        >
                          {u.banned ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                          {u.banned ? 'Unban' : 'Ban'}
                        </button>
                      )}

                      {isSelf && (
                        <span className="text-xs text-zinc-600">Cannot modify yourself</span>
                      )}
                      {!isSelf && !isSuperAdmin && (
                        <span className="text-xs text-zinc-600">Super admin only</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rolls tab */}
      {tab === 'rolls' && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">All Rolls ({rolls.length})</h2>
          <div className="space-y-1.5">
            {rolls.map(r => {
              const style = getRarityStyle(r.rarity);
              const info = getRarityInfo(r.rarity);
              return (
                <div key={r.id} className={`flex items-center gap-3 rounded-lg border ${style.border} bg-zinc-900/40 px-4 py-2.5`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-bold tabular-nums ${style.text}`}>
                        {r.number?.toLocaleString('en-US')}
                      </span>
                      <span className="text-xs text-zinc-500">{info.name}</span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {r.roller_name || 'Unknown'} · {r.roll_date} · {r.badges?.length || 0} badges · {formatEP(r.ep)} EP
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded-lg p-2 text-zinc-600 transition hover:bg-red-950/40 hover:text-red-400"
                    title="Delete roll"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
          {rolls.length === 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 py-12 text-center text-sm text-zinc-600">
              No rolls yet.
            </div>
          )}
        </div>
      )}

      {/* Pending verification codes tab */}
      {tab === 'codes' && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Pending Codes ({pendingCodes.length})
            </h2>
            <p className="text-xs text-zinc-600">Only shows unexpired codes (24 hour lifetime)</p>
          </div>
          {codesError && (
            <div className="mb-3 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400">
              {codesError}
            </div>
          )}
          {pendingCodes.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 py-12 text-center text-sm text-zinc-600">
              No pending codes right now.
            </div>
          ) : (
            <div className="space-y-1.5">
              {pendingCodes.map((c, i) => {
                const msLeft = Math.max(0, new Date(c.expiresAt) - Date.now());
                const hoursLeft = Math.floor(msLeft / 3600000);
                const minutesLeft = Math.round((msLeft % 3600000) / 60000);
                const timeLeftLabel = hoursLeft > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`;
                return (
                  <div
                    key={`${c.email}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2.5"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-200">{c.email}</div>
                      <div className="text-xs text-zinc-500">Expires in {timeLeftLabel}</div>
                    </div>
                    <div className="rounded-lg bg-zinc-800 px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-violet-300">
                      {c.code}
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText(c.code)}
                      className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                      title="Copy code"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}