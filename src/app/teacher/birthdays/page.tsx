'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { Cake, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function TeacherBirthdaysPage() {
  const { user } = useAuthStore();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!user?.id) return;
    setLoading(true);
    api.get('/teacher/me/birthdays', { params: { userId: user.id, days } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, days]);

  // Group by daysUntil
  const groups: Record<string, any[]> = {};
  if (data?.students) {
    for (const s of data.students) {
      const key = s.isToday ? 'Today 🎉' : s.daysUntil === 1 ? 'Tomorrow' : `In ${s.daysUntil} days`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
  }

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Cake className="h-6 w-6 text-pink-600" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Upcoming Birthdays</h1>
                  <p className="text-xs text-slate-500">Students in your class-teacher sections.</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <select value={days} onChange={e => setDays(parseInt(e.target.value))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                  <option value={7}>Next 7 days</option>
                  <option value={14}>Next 14 days</option>
                  <option value={30}>Next 30 days</option>
                  <option value={60}>Next 60 days</option>
                </select>
                <button onClick={load}
                  className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 flex items-center gap-2">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </FadeIn>

          {/* Today's birthday banner */}
          {data && data.todayCount > 0 && (
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl p-5 flex items-center gap-4">
              <Cake className="h-8 w-8" />
              <div>
                <p className="text-lg font-bold">🎉 {data.todayCount} student{data.todayCount === 1 ? '' : 's'} birthday today!</p>
                <p className="text-sm opacity-90">Wish them in class.</p>
              </div>
            </div>
          )}

          {/* List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loading && <p className="text-center py-8 text-slate-400 text-sm">Loading…</p>}
            {!loading && (!data || data.students.length === 0) && (
              <div className="text-center py-12">
                <Cake className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-400">
                  {data?.sections?.length === 0
                    ? 'You are not assigned as class teacher to any section.'
                    : 'No birthdays in this range.'}
                </p>
              </div>
            )}
            {!loading && data?.students?.length > 0 && (
              <div className="divide-y divide-slate-100">
                {Object.entries(groups).map(([groupLabel, list]) => (
                  <div key={groupLabel}>
                    <div className="px-4 py-2 bg-pink-50 text-xs font-semibold text-pink-800 uppercase">
                      {groupLabel}
                    </div>
                    {list.map((s: any) => (
                      <div key={s.studentId} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${s.isToday ? 'bg-gradient-to-br from-pink-500 to-rose-500 ring-2 ring-pink-300' : 'bg-gradient-to-br from-blue-500 to-purple-500'}`}>
                          {s.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{s.name} {s.isToday && '🎂'}</p>
                          <p className="text-xs text-slate-500">
                            {s.class} · {s.section} · Roll {s.rollNumber || '—'} · turning {s.turning}
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-600">
                          <p className="font-semibold">{new Date(s.birthdayDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                          <p className="text-[11px] text-slate-400">{s.daysUntil === 0 ? 'Today' : `${s.daysUntil}d away`}</p>
                        </div>
                        <Link href={`/students/${s.studentId}`}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200">
                          Open
                        </Link>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
