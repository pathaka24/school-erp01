'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { AlertTriangle, Phone, RefreshCw, Users } from 'lucide-react';
import Link from 'next/link';

function isoToday() { return new Date().toISOString().slice(0, 10); }
function isoFirstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function TeacherAbsenteesPage() {
  const { user } = useAuthStore();
  const [from, setFrom] = useState(isoFirstOfMonth());
  const [to, setTo] = useState(isoToday());
  const [threshold, setThreshold] = useState(75);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!user?.id) return;
    setLoading(true);
    api.get('/teacher/me/absentees', { params: { userId: user.id, from, to, threshold } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, from, to, threshold]);

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Chronic Absentees</h1>
                <p className="text-xs text-slate-500">Students in your class-teacher sections falling below the attendance threshold.</p>
              </div>
            </div>
          </FadeIn>

          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label className="text-xs text-slate-600">
              From
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-600">
              To
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-600">
              Below threshold (%)
              <input type="number" min="1" max="100" value={threshold}
                onChange={e => setThreshold(parseFloat(e.target.value) || 75)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
            <button onClick={load}
              className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 flex items-center justify-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {/* Summary */}
          {data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase">Sections</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{data.sections.join(', ') || '—'}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase">Total students</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data.totalStudents || 0}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-xs text-red-700 uppercase">Below threshold</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{data.flaggedCount || 0}</p>
              </div>
            </div>
          )}

          {/* List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loading && <p className="text-center py-8 text-slate-400 text-sm">Loading…</p>}
            {!loading && data?.message && (
              <p className="text-center py-12 text-slate-400 text-sm">{data.message}</p>
            )}
            {!loading && data && !data.message && data.students.length === 0 && (
              <p className="text-center py-12 text-emerald-600 text-sm">
                <Users className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
                Great — no chronic absentees in this range.
              </p>
            )}
            {!loading && data?.students?.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Roll</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Section</th>
                    <th className="px-4 py-2 text-right">Present / Total</th>
                    <th className="px-4 py-2 text-right">%</th>
                    <th className="px-4 py-2 text-left">Contact</th>
                    <th className="px-4 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.students.map((s: any) => {
                    const tone = (s.pct ?? 0) < 50 ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50';
                    return (
                      <tr key={s.studentId} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-600">{s.rollNumber || '—'}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          {s.name}
                          <div className="text-xs text-slate-500">{s.admissionNo}</div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{s.class} · {s.section}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {s.present} / {s.total - s.excused}
                          {s.excused > 0 && <span className="text-[10px] text-slate-400"> ({s.excused} exc.)</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`px-2 py-0.5 rounded font-bold ${tone}`}>
                            {s.pct?.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {(s.fatherPhone || s.motherPhone || s.phone) ? (
                            <a href={`tel:${s.fatherPhone || s.motherPhone || s.phone}`}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
                              <Phone className="h-3 w-3" /> {s.fatherPhone || s.motherPhone || s.phone}
                            </a>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Link href={`/students/${s.studentId}`}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200">
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Note: students with no attendance records in the range are not listed (they may be new admissions). Excused absences are excluded from the denominator.
          </p>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
