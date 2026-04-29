'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CalendarOff, Plus, X, CheckCircle, XCircle, Clock } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

export default function ParentLeavePage() {
  const { user } = useAuthStore();
  const [children, setChildren] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', fromDate: '', toDate: '', reason: '' });

  const load = async () => {
    if (!user) return;
    const [childrenRes, leavesRes] = await Promise.all([
      api.get('/parent/children', { params: { userId: user.id } }),
      api.get('/leave', { params: { parentUserId: user.id } }),
    ]);
    setChildren(childrenRes.data.children);
    setLeaves(leavesRes.data);
    if (childrenRes.data.children.length > 0 && !form.studentId) {
      setForm(f => ({ ...f, studentId: childrenRes.data.children[0].id }));
    }
  };

  useEffect(() => { load(); }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await api.post('/leave', { ...form, appliedById: user.id });
      setForm({ studentId: form.studentId, fromDate: '', toDate: '', reason: '' });
      setShowForm(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit leave');
    }
  };

  const cancel = async (id: string) => {
    if (!confirm('Cancel this leave request?')) return;
    await api.put(`/leave/${id}`, { status: 'CANCELLED' });
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CalendarOff className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Leave Applications</h1>
              <p className="text-sm text-slate-500">{leaves.length} requests</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" /> Apply for leave
          </button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Apply for leave</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <select
              required
              value={form.studentId}
              onChange={e => setForm({ ...form, studentId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="">Select child</option>
              {children.map((c: any) => <option key={c.id} value={c.id}>{c.name} — {c.className} {c.sectionName}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">From</label>
                <input
                  required
                  type="date"
                  value={form.fromDate}
                  onChange={e => setForm({ ...form, fromDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">To</label>
                <input
                  required
                  type="date"
                  value={form.toDate}
                  onChange={e => setForm({ ...form, toDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>
            <textarea
              required
              placeholder="Reason for leave *"
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Submit</button>
            </div>
          </form>
        )}

        {leaves.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            No leave requests yet.
          </div>
        ) : (
          <div className="space-y-3">
            {leaves.map(l => (
              <div key={l.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">
                        {l.student.user.firstName} {l.student.user.lastName}
                      </h3>
                      <span className="text-xs text-slate-500">
                        {l.student.class.name} {l.student.section.name}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[l.status]}`}>
                        {l.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      {formatDate(l.fromDate)} to {formatDate(l.toDate)}
                    </div>
                    <p className="text-sm text-slate-700 mt-2">{l.reason}</p>
                    {l.reviewNote && (
                      <p className="text-sm text-slate-600 italic mt-2">
                        <strong>Teacher's note:</strong> {l.reviewNote}
                      </p>
                    )}
                    {l.reviewedBy && (
                      <p className="text-xs text-slate-400 mt-1">
                        Reviewed by {l.reviewedBy.firstName} {l.reviewedBy.lastName} on {formatDate(l.reviewedAt)}
                      </p>
                    )}
                  </div>
                  {l.status === 'PENDING' && (
                    <button onClick={() => cancel(l.id)} className="px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
