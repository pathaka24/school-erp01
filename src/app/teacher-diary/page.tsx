'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CalendarDays, NotebookPen, ClipboardCheck, BookOpen, GraduationCap } from 'lucide-react';

const DAY_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

type Diary = {
  teacher: { id: string; employeeId: string; name: string };
  range: { from: string; to: string };
  days: any[];
  counts: { lessons: number; tests: number; days: number; completedLessons: number; dailyLogs: number };
};

export default function AdminTeacherDiaryPage() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState<Diary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/teachers')
      .then(res => {
        setTeachers(res.data);
        if (res.data.length > 0) setSelectedTeacherId(res.data[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTeacherId) return;
    let cancelled = false;
    api.get(`/teachers/${selectedTeacherId}/diary`, { params: { from: isoDaysAgo(rangeDays) } })
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [selectedTeacherId, rangeDays]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <NotebookPen className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Teacher Diary</h1>
              <p className="text-sm text-slate-500">Daily teaching log per teacher</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedTeacherId}
              onChange={e => setSelectedTeacherId(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900"
            >
              {teachers.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.user?.firstName} {t.user?.lastName} ({t.employeeId})
                </option>
              ))}
            </select>
            <select
              value={rangeDays}
              onChange={e => setRangeDays(Number(e.target.value))}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900"
            >
              {DAY_RANGES.map(r => <option key={r.days} value={r.days}>{r.label}</option>)}
            </select>
          </div>
        </div>

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <SummaryCard label="Days with entries" value={data.counts.days} icon={CalendarDays} color="bg-blue-500" />
              <SummaryCard label="Daily log entries" value={data.counts.dailyLogs} icon={BookOpen} color="bg-cyan-500" />
              <SummaryCard label="Lessons logged" value={data.counts.lessons} icon={BookOpen} color="bg-emerald-500" />
              <SummaryCard label="Lessons completed" value={data.counts.completedLessons} icon={GraduationCap} color="bg-indigo-500" />
              <SummaryCard label="Class tests" value={data.counts.tests} icon={ClipboardCheck} color="bg-amber-500" />
            </div>

            {data.days.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
                No diary entries from {data.teacher.name} in this period.
              </div>
            ) : (
              <div className="space-y-4">
                {data.days.map((day: any) => <DayCard key={day.date} day={day} />)}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function DayCard({ day }: { day: any }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <h3 className="font-semibold text-slate-900">{formatDate(day.date)}</h3>
          <span className="text-xs text-slate-500">
            ({new Date(day.date).toLocaleDateString('en-IN', { weekday: 'long' })})
          </span>
        </div>
        <div className="flex gap-2 text-xs">
          {day.dailyLog && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Daily log ✓</span>}
          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{day.lessons.length} lessons</span>
          {day.tests.length > 0 && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{day.tests.length} tests</span>
          )}
        </div>
      </div>
      <div className="p-5 space-y-4">
        {day.dailyLog && (
          <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-2">Daily Log</p>
            {day.dailyLog.summary && <p className="text-sm text-slate-700">{day.dailyLog.summary}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {day.dailyLog.highlights && (
                <div>
                  <p className="text-xs font-medium text-emerald-600 uppercase">Highlights</p>
                  <p className="text-sm text-slate-700">{day.dailyLog.highlights}</p>
                </div>
              )}
              {day.dailyLog.concerns && (
                <div>
                  <p className="text-xs font-medium text-red-600 uppercase">Concerns</p>
                  <p className="text-sm text-slate-700">{day.dailyLog.concerns}</p>
                </div>
              )}
            </div>
            {day.dailyLog.tomorrowPlan && (
              <p className="text-sm text-slate-600 mt-2"><strong className="text-xs uppercase text-slate-400">Tomorrow:</strong> {day.dailyLog.tomorrowPlan}</p>
            )}
            <div className="flex gap-3 text-xs text-slate-500 mt-2">
              {day.dailyLog.periodsTaught != null && <span>{day.dailyLog.periodsTaught} periods</span>}
              {day.dailyLog.mood && <span>Mood: {day.dailyLog.mood}</span>}
              {day.dailyLog.signature && <span className="font-serif italic">— {day.dailyLog.signature}</span>}
            </div>
          </div>
        )}
        {day.tests.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Tests</p>
            {day.tests.map((t: any) => (
              <div key={t.id} className="border border-amber-200 bg-amber-50/50 rounded-lg p-3">
                <p className="font-medium text-slate-900">
                  {t.name} <span className="text-slate-500 font-normal text-sm">— {t.subject.name}</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.class.name} {t.section.name} · Max {t.maxMarks} · {t._count.marks} marks recorded
                  {t.syllabusTopic && (
                    <> · Topic: {t.syllabusTopic.chapter ? `${t.syllabusTopic.chapter} — ` : ''}{t.syllabusTopic.name}</>
                  )}
                </p>
                {t.description && <p className="text-sm text-slate-600 mt-1">{t.description}</p>}
              </div>
            ))}
          </div>
        )}

        {day.lessons.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Lessons</p>
            {day.lessons.map((l: any) => (
              <div key={l.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    {l.subject.name}
                  </span>
                  <span className="font-medium text-slate-900">{l.topic}</span>
                  <span className="text-xs text-slate-400">
                    — {l.class.name} {l.section.name}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    l.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    l.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {l.status}
                  </span>
                </div>
                {l.objectives && (
                  <p className="text-sm text-slate-600 mt-2">
                    <span className="text-xs font-medium text-slate-400 uppercase">Objectives: </span>
                    {l.objectives}
                  </p>
                )}
                {l.content && <p className="text-sm text-slate-600 mt-1">{l.content}</p>}
                {l.homework && (
                  <p className="text-sm text-slate-700 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                    <span className="font-medium">Homework: </span>{l.homework}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
