'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Plus, Trash2, Search, Shield, ShieldCheck, Key, Copy, Check, X, Lock, Unlock, Settings as SettingsIcon } from 'lucide-react';
import { ALL_SCOPES, SCOPES_BY_GROUP, type PermissionScope } from '@/lib/permissions';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  isActive: boolean;
  permissions?: string[];
  createdAt: string;
}

const ROLES = ['ADMIN', 'TEACHER', 'STAFF', 'STUDENT', 'PARENT'];

const roleBadge: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  TEACHER: 'bg-blue-100 text-blue-700',
  STAFF: 'bg-cyan-100 text-cyan-700',
  STUDENT: 'bg-green-100 text-green-700',
  PARENT: 'bg-amber-100 text-amber-700',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', role: 'STAFF',
    permissions: [] as string[],
  });
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);
  const [resetCopied, setResetCopied] = useState(false);
  // Permissions editor
  const [permsTarget, setPermsTarget] = useState<User | null>(null);
  const [permsDraft, setPermsDraft] = useState<string[]>([]);
  const [permsSaving, setPermsSaving] = useState(false);

  useEffect(() => { fetchUsers(); }, [search, roleFilter]);

  const fetchUsers = async () => {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const { data } = await api.get('/users', { params });
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...form };
      if (form.role !== 'STAFF') delete payload.permissions;
      await api.post('/users', payload);
      setShowForm(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'STAFF', permissions: [] });
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create user');
    }
  };

  const togglePerm = (scope: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(scope)
        ? f.permissions.filter(p => p !== scope)
        : [...f.permissions, scope],
    }));
  };

  const togglePermsDraft = (scope: string) => {
    setPermsDraft(d => d.includes(scope) ? d.filter(p => p !== scope) : [...d, scope]);
  };

  const openPerms = (user: User) => {
    setPermsTarget(user);
    setPermsDraft(user.permissions || []);
  };
  const savePerms = async () => {
    if (!permsTarget) return;
    setPermsSaving(true);
    try {
      await api.put(`/users/${permsTarget.id}`, { permissions: permsDraft });
      setPermsTarget(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save permissions');
    } finally {
      setPermsSaving(false);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await api.put(`/users/${user.id}`, { isActive: !user.isActive });
      fetchUsers();
    } catch {
      alert('Failed to update user');
    }
  };

  const openReset = (user: User) => {
    setResetTarget(user);
    setResetPassword('');
    setResetResult(null);
    setResetCopied(false);
  };

  const closeReset = () => {
    setResetTarget(null);
    setResetPassword('');
    setResetResult(null);
    setResetCopied(false);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetSaving(true);
    try {
      const { data } = await api.post(`/users/${resetTarget.id}/reset-password`, {
        password: resetPassword.trim() || undefined,
      });
      setResetResult({ email: data.user.email, password: data.password });
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reset password');
    } finally {
      setResetSaving(false);
    }
  };

  const copyResetPassword = async () => {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult.password);
      setResetCopied(true);
      setTimeout(() => setResetCopied(false), 1500);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will also delete any linked student/teacher/parent record.')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch {
      alert('Failed to delete user');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Users</h1>
            <p className="text-slate-500">{users.length} total users</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="h-4 w-4" /> Create User
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Create New User</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <input placeholder="First Name" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
                <input placeholder="Last Name" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
                <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
                <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                <input placeholder="Password (default: password123)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, permissions: [] })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Permissions — only for STAFF */}
              {form.role === 'STAFF' && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-cyan-900 mb-1">Grant access to:</p>
                  <p className="text-xs text-cyan-700 mb-3">Pick only what this staff member needs. They&apos;ll only see these sections in their sidebar.</p>
                  {Object.entries(SCOPES_BY_GROUP).map(([group, scopes]) => (
                    <div key={group} className="mb-3">
                      <p className="text-xs font-semibold text-cyan-800 uppercase mb-1.5">{group}</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                        {scopes.map(s => (
                          <label key={s.id} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer hover:bg-white/60 rounded px-1.5 py-1" title={s.description}>
                            <input type="checkbox" checked={form.permissions.includes(s.id)} onChange={() => togglePerm(s.id)} className="mt-0.5" />
                            {s.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {form.role === 'ADMIN' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-800">
                  Admin users have access to <strong>everything</strong>, including this Users page. Only create admin accounts for trusted people.
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Create</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Name</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Email</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Role</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Phone</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No users found</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">{user.firstName} {user.lastName}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{user.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleBadge[user.role] || 'bg-slate-100 text-slate-700'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{user.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={() => toggleActive(user)} title={user.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}>
                        {user.isActive
                          ? <ShieldCheck className="h-5 w-5 text-green-500" />
                          : <Shield className="h-5 w-5 text-slate-300" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-1">
                        {user.role === 'STAFF' && (
                          <button
                            onClick={() => openPerms(user)}
                            title="Edit permissions"
                            className="p-1 text-slate-500 hover:text-cyan-600"
                          >
                            <SettingsIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => toggleActive(user)}
                          title={user.isActive ? 'Block (deactivate)' : 'Unblock (activate)'}
                          className={`p-1 ${user.isActive ? 'text-slate-500 hover:text-amber-600' : 'text-amber-600 hover:text-emerald-600'}`}
                        >
                          {user.isActive ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => openReset(user)}
                          title="Reset password"
                          className="p-1 text-slate-500 hover:text-blue-600"
                        >
                          <Key className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          title="Delete user"
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">Reset password</h3>
              </div>
              <button onClick={closeReset} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm text-slate-500">User</p>
                <p className="font-medium text-slate-900">
                  {resetTarget.firstName} {resetTarget.lastName}
                </p>
                <p className="text-sm text-slate-500">{resetTarget.email}</p>
              </div>

              {!resetResult ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      New password
                    </label>
                    <input
                      type="text"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Leave blank to auto-generate"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                      autoFocus
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Minimum 6 characters. If left blank, a secure 12-character password is generated.
                    </p>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={closeReset}
                      className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleResetPassword}
                      disabled={resetSaving}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {resetSaving ? 'Resetting...' : 'Reset password'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    Copy this password now — it won't be shown again.
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      New password
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={resetResult.password}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-900 bg-slate-50"
                        onFocus={(e) => e.target.select()}
                      />
                      <button
                        onClick={copyResetPassword}
                        className="px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-1"
                      >
                        {resetCopied ? (
                          <>
                            <Check className="h-4 w-4 text-emerald-600" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={closeReset}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Permissions editor modal */}
      {permsTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPermsTarget(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Edit permissions — {permsTarget.firstName} {permsTarget.lastName}</p>
                <p className="text-[11px] text-slate-500">Pick the sections this staff member can access. They&apos;ll only see these in their sidebar.</p>
              </div>
              <button onClick={() => setPermsTarget(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {Object.entries(SCOPES_BY_GROUP).map(([group, scopes]) => (
                <div key={group} className="mb-4">
                  <p className="text-xs font-semibold text-slate-700 uppercase mb-2">{group}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {scopes.map(s => (
                      <label key={s.id} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-2 py-1.5">
                        <input type="checkbox" checked={permsDraft.includes(s.id)} onChange={() => togglePermsDraft(s.id)} className="mt-0.5" />
                        <div>
                          <div className="font-medium">{s.label}</div>
                          <div className="text-[11px] text-slate-400">{s.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-between items-center bg-slate-50">
              <p className="text-xs text-slate-500">{permsDraft.length} of {ALL_SCOPES.length} scopes selected</p>
              <div className="flex gap-2">
                <button onClick={() => setPermsTarget(null)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                <button onClick={savePerms} disabled={permsSaving}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 disabled:opacity-50">
                  {permsSaving ? 'Saving…' : 'Save permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
