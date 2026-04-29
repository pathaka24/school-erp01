'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CalendarOff, CheckCircle, XCircle, Clock } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

export default function TeacherLeavePage() {
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<any>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [tab, setTab] = useState<'PENDING' | 'ALL'>('PENDING');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!user) return;
    api.get('/teachers/me', { params: { userId: user.id } }).then(r => setTeacher(r.data));
  }, [user]);

  const load = async () => {
    if (!teacher) return;
    const params: any = { teacherId: teacher.id };
    if (tab === 'PENDING') params.status = 'PENDING';
    const { data } = await api.get('/leave', { params });
    setLeaves(data);
  };

  useEffect(() => { load(); }, [teacher, tab]);

  const review = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    if (!user) return;
    await api.put(`/leave/${id}`, { status, reviewedById: user.id, reviewNote: note });
    setReviewing(null);
    setNote('');
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CalendarOff className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Leave Requests</h1>
            <p className="text-sm text-slate-500">Approve or reject leave for students in your sections</p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200">
          {(['PENDING', 'ALL'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'PENDING' ? 'Pending' : 'All'}
            </button>
          ))}
        </div>

        {leaves.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            No {tab === 'PENDING' ? 'pending' : ''} leave requests.
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
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[l.status]}`}>{l.status}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      {formatDate(l.fromDate)} to {formatDate(l.toDate)}
                    </div>
                    <p className="text-sm text-slate-700 mt-2">{l.reason}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Applied by {l.appliedBy.firstName} {l.appliedBy.lastName} ({l.appliedBy.role})
                    </p>
                    {l.reviewNote && (
                      <p className="text-sm text-slate-600 italic mt-2"><strong>Note:</strong> {l.reviewNote}</p>
                    )}

                    {reviewing === l.id && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          placeholder="Optional note to parent..."
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => review(l.id, 'APPROVED')} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm">
                            <CheckCircle className="h-4 w-4" /> Approve
                          </button>
                          <button onClick={() => review(l.id, 'REJECTED')} className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm">
                            <XCircle className="h-4 w-4" /> Reject
                          </button>
                          <button onClick={() => { setReviewing(null); setNote(''); }} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                  {l.status === 'PENDING' && reviewing !== l.id && (
                    <button onClick={() => setReviewing(l.id)} className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                      Review
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
