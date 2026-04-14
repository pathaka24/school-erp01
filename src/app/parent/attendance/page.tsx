'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { Calendar } from 'lucide-react';

export default function ParentAttendancePage() {
  const { user } = useAuthStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Attendance state
  const [attData, setAttData] = useState<any>(null);
  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/parent/children?userId=${user.id}`)
      .then(res => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) {
          setSelectedChild(res.data.children[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!selectedChild) return;
    api.get(`/attendance/student/${selectedChild}`, { params: { month: attMonth, year: attYear } })
      .then(res => setAttData(res.data))
      .catch(() => setAttData(null));
  }, [selectedChild, attMonth, attYear]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  const pct = attData?.summary?.percentage != null ? Number(attData.summary.percentage) : 0;
  const pctColor = pct >= 90 ? 'text-green-600' : pct >= 75 ? 'text-yellow-600' : 'text-red-600';
  const ringColor = pct >= 90 ? '#16a34a' : pct >= 75 ? '#ca8a04' : '#dc2626';
  const ringBg = pct >= 90 ? '#dcfce7' : pct >= 75 ? '#fef9c3' : '#fee2e2';
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;

  const absentDates = (attData?.records || [])
    .filter((r: any) => r.status === 'ABSENT')
    .map((r: any) => new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' }));

  const lateDates = (attData?.records || [])
    .filter((r: any) => r.status === 'LATE')
    .map((r: any) => new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
          </div>
          <div className="flex items-center gap-2">
            {children.length > 1 && (
              <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
                {children.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.className})</option>
                ))}
              </select>
            )}
            <select value={attMonth} onChange={e => setAttMonth(Number(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select value={attYear} onChange={e => setAttYear(Number(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {children.length === 1 && (
          <p className="text-sm text-slate-500">{children[0].name} - {children[0].className} {children[0].sectionName}</p>
        )}

        {/* Ring + Stats */}
        {attData?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="relative w-36 h-36">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke={ringBg} strokeWidth="10" />
                  <circle cx="60" cy="60" r="54" fill="none" stroke={ringColor} strokeWidth="10"
                    strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black ${pctColor}`}>{pct.toFixed(1)}%</span>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-500">
                {pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good' : pct >= 50 ? 'Needs Improvement' : 'Critical'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 content-start">
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-3xl font-black text-slate-800">{attData.summary.total}</p>
                <p className="text-xs text-slate-500 mt-1">Working Days</p>
              </div>
              <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
                <p className="text-3xl font-black text-green-600">{attData.summary.present}</p>
                <p className="text-xs text-green-600 mt-1">Present</p>
              </div>
              <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
                <p className="text-3xl font-black text-red-600">{attData.summary.absent}</p>
                <p className="text-xs text-red-600 mt-1">Absent</p>
              </div>
              <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-center">
                <p className="text-3xl font-black text-yellow-600">{attData.summary.late}</p>
                <p className="text-xs text-yellow-600 mt-1">Late</p>
              </div>
            </div>

            <div className="space-y-3">
              {absentDates.length > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-200 p-4">
                  <p className="text-xs font-bold text-red-700 mb-2">ABSENT DATES ({absentDates.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {absentDates.map((d: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-red-100 text-red-700 rounded text-[11px] font-medium">{d}</span>
                    ))}
                  </div>
                </div>
              )}
              {lateDates.length > 0 && (
                <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
                  <p className="text-xs font-bold text-yellow-700 mb-2">LATE DATES ({lateDates.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lateDates.map((d: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[11px] font-medium">{d}</span>
                    ))}
                  </div>
                </div>
              )}
              {absentDates.length === 0 && lateDates.length === 0 && (
                <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
                  <p className="text-green-700 font-bold text-sm">Perfect Attendance!</p>
                  <p className="text-xs text-green-600 mt-1">No absences or late arrivals this month</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar grid */}
        {attData?.records?.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Daily View</h3>
            <div className="grid grid-cols-7 gap-2 text-center mb-3">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="text-xs font-bold text-slate-400 py-1 uppercase tracking-wider">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {(() => {
                const firstDay = new Date(attYear, attMonth - 1, 1);
                const lastDayNum = new Date(attYear, attMonth, 0).getDate();
                let startDay = firstDay.getDay() - 1;
                if (startDay < 0) startDay = 6;

                const cells = [];
                for (let i = 0; i < startDay; i++) cells.push(<div key={`empty-${i}`} />);
                const recordMap = new Map(attData.records.map((r: any) => [new Date(r.date).getUTCDate(), r.status]));
                for (let day = 1; day <= lastDayNum; day++) {
                  const status = recordMap.get(day) as string | undefined;
                  const isSunday = new Date(attYear, attMonth - 1, day).getDay() === 0;
                  let bg, border, textColor, icon;
                  if (status === 'PRESENT') { bg = 'bg-green-100'; border = 'border-green-300'; textColor = 'text-green-800'; icon = '\u2713'; }
                  else if (status === 'ABSENT') { bg = 'bg-red-100'; border = 'border-red-400 border-2'; textColor = 'text-red-700'; icon = '\u2717'; }
                  else if (status === 'LATE') { bg = 'bg-yellow-100'; border = 'border-yellow-400 border-2'; textColor = 'text-yellow-700'; icon = '!'; }
                  else if (isSunday) { bg = 'bg-blue-50'; border = 'border-blue-200'; textColor = 'text-blue-400'; icon = ''; }
                  else { bg = 'bg-slate-50'; border = 'border-slate-200'; textColor = 'text-slate-300'; icon = ''; }
                  cells.push(
                    <div key={day} className={`${bg} ${textColor} border ${border} rounded-xl p-1.5 text-center transition-transform hover:scale-110`} title={status || (isSunday ? 'Sunday' : 'No record')}>
                      <div className="text-sm font-bold">{day}</div>
                      {icon && <div className="text-[10px] font-black leading-none">{icon}</div>}
                    </div>
                  );
                }
                return cells;
              })()}
            </div>
            <div className="flex gap-5 mt-5 justify-center text-xs">
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-green-100 border border-green-300 flex items-center justify-center text-green-800 text-[9px] font-black">{'\u2713'}</span> Present</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-red-100 border-2 border-red-400 flex items-center justify-center text-red-700 text-[9px] font-black">{'\u2717'}</span> Absent</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-yellow-100 border-2 border-yellow-400 flex items-center justify-center text-yellow-700 text-[9px] font-black">!</span> Late</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-blue-50 border border-blue-200"></span> Sunday</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-slate-50 border border-slate-200"></span> Holiday</span>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            No attendance records for this month
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
