'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { User as UserIcon, Lock, Check } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone(false);
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/users/me/password', { currentPassword, newPassword });
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4 max-w-2xl">
          <FadeIn>
            <div className="flex items-center gap-3">
              <UserIcon className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
                <p className="text-xs text-slate-500">Account info and password.</p>
              </div>
            </div>
          </FadeIn>

          {/* Profile card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Account</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500 uppercase">Name</p>
                <p className="font-medium text-slate-900">{user?.firstName} {user?.lastName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Email</p>
                <p className="font-medium text-slate-900">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Role</p>
                <p className="font-medium text-slate-900">{user?.role}</p>
              </div>
              {user?.role === 'STAFF' && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 uppercase">Granted permissions</p>
                  {user.permissions && user.permissions.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.permissions.map(p => (
                        <span key={p} className="px-2 py-0.5 bg-cyan-50 text-cyan-700 text-xs rounded">{p}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic mt-1">None — ask your admin to grant access.</p>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-4">
              To change your name or email, contact the admin.
            </p>
          </div>

          {/* Change password */}
          <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4" /> Change password
            </h2>
            <div className="space-y-3">
              <label className="block text-xs text-slate-600">
                Current password
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  required
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </label>
              <label className="block text-xs text-slate-600">
                New password
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  required minLength={6}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </label>
              <label className="block text-xs text-slate-600">
                Confirm new password
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  required minLength={6}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </label>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">{error}</div>
              )}
              {done && (
                <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-sm text-emerald-700 flex items-center gap-2">
                  <Check className="h-4 w-4" /> Password updated successfully.
                </div>
              )}

              <button type="submit" disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
