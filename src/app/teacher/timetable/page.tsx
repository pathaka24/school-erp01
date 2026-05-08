'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { Calendar, Clock, MapPin, Sun } from 'lucide-react';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_SHORT: Record<string, string> = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat' };

function todayDayOfWeek(): string {
  return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date().getDay()];
}

export default function TeacherTimetablePage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'today' | 'week'>('today');
  const today = todayDayOfWeek();

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    api.get('/teacher/me/timetable', { params: { userId: user.id } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Periods (unique by start-end time across all days)
  const periods = useMemo(() => {
    if (!data?.slots) return [];
    const map = new Map<string, { startTime: string; endTime: string }>();
    for (const s of data.slots) {
      const key = `${s.startTime}-${s.endTime}`;
      if (!map.has(key)) map.set(key, { startTime: s.startTime, endTime: s.endTime });
    }
    return Array.from(map.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [data]);

  // day+period -> slot lookup
  const lookup = useMemo(() => {
    const m = new Map<string, any>();
    for (const s of (data?.slots || [])) {
      m.set(`${s.dayOfWeek}|${s.startTime}-${s.endTime}`, s);
    }
    return m;
  }, [data]);

  // Today's periods only
  const todayPeriods = useMemo(() => {
    if (!data?.slots) return [];
    return data.slots
      .filter((s: any) => s.dayOfWeek === today)
      .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
  }, [data, today]);

  // Per-day counts for the summary cards
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of DAYS) counts[d] = 0;
    for (const s of (data?.slots || [])) counts[s.dayOfWeek] = (counts[s.dayOfWeek] || 0) + 1;
    return counts;
  }, [data]);

  const isToday = (day: string) => day === today;

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">My Timetable</h1>
                  <p className="text-xs text-slate-500">Your weekly teaching schedule.</p>
                </div>
              </div>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                <button onClick={() => setView('today')}
                  className={`px-4 py-1.5 text-xs font-medium rounded ${view === 'today' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}>
                  Today ({DAY_SHORT[today] || '—'})
                </button>
                <button onClick={() => setView('week')}
                  className={`px-4 py-1.5 text-xs font-medium rounded ${view === 'week' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}>
                  Full week
                </button>
              </div>
            </div>
          </FadeIn>

          {loading && <p className="text-center py-12 text-slate-400 text-sm">Loading…</p>}

          {!loading && data && (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                <div className="bg-blue-600 text-white rounded-lg p-3">
                  <p className="text-[10px] uppercase opacity-80">Total / week</p>
                  <p className="text-xl font-bold">{data.totalPeriods}</p>
                </div>
                {DAYS.map(d => (
                  <div key={d} className={`rounded-lg p-3 ${isToday(d) ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-white border border-slate-200'}`}>
                    <p className="text-[10px] uppercase text-slate-500">{DAY_SHORT[d]}</p>
                    <p className="text-lg font-bold text-slate-900">{dayCounts[d]}</p>
                  </div>
                ))}
              </div>

              {/* TODAY VIEW */}
              {view === 'today' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-200 bg-amber-50 flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-slate-900">Today — {DAY_SHORT[today] || today}</p>
                    <span className="ml-auto text-xs text-slate-600">{todayPeriods.length} period{todayPeriods.length === 1 ? '' : 's'}</span>
                  </div>
                  {todayPeriods.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 text-sm">No classes today. Enjoy the break.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {todayPeriods.map((s: any, i: number) => (
                        <div key={s.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                          <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-700 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[9px] uppercase opacity-70">P</span>
                            <span className="text-lg font-bold leading-none">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{s.subject?.name || 'Free'}</p>
                            <p className="text-xs text-slate-500">{s.class?.name} · {s.section?.name}{s.room ? ` · Room ${s.room}` : ''}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1 text-xs text-slate-700 font-medium">
                              <Clock className="h-3 w-3" /> {s.startTime}–{s.endTime}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* WEEK VIEW */}
              {view === 'week' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  {periods.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 text-sm">No timetable assigned yet. Ask the admin.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          <th className="px-3 py-3 text-left font-semibold w-24">Day</th>
                          {periods.map((p: any, i: number) => (
                            <th key={i} className="px-2 py-3 text-center font-semibold">
                              <div>P {i + 1}</div>
                              <div className="text-[10px] font-normal opacity-70">{p.startTime}–{p.endTime}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map(day => (
                          <tr key={day} className={`border-t border-slate-100 ${isToday(day) ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                            <td className={`px-3 py-3 font-bold ${isToday(day) ? 'text-amber-700' : 'text-slate-700'}`}>
                              {DAY_SHORT[day]}
                              {isToday(day) && <span className="ml-1 text-[9px] uppercase">today</span>}
                            </td>
                            {periods.map((p: any, i: number) => {
                              const slot = lookup.get(`${day}|${p.startTime}-${p.endTime}`);
                              return (
                                <td key={i} className="px-2 py-2 text-center">
                                  {slot ? (
                                    <div>
                                      <div className="font-bold text-blue-700 text-[11px]">{slot.subject?.name || '—'}</div>
                                      <div className="text-[10px] text-slate-500">{slot.class?.name}-{slot.section?.name}</div>
                                      {slot.room && <div className="text-[9px] text-slate-400">📍 {slot.room}</div>}
                                    </div>
                                  ) : (
                                    <span className="text-slate-200">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
