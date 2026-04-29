'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CalendarDays, NotebookPen, ClipboardCheck, BookOpen } from 'lucide-react';

type LessonPlan = {
  id: string;
  date: string;
  topic: string;
  objectives: string | null;
  content: string | null;
  homework: string | null;
  resources: string | null;
  status: string;
  subject: { id: string; name: string; code: string };
  teacher: { user: { firstName: string; lastName: string } };
};

type ClassTestEntry = {
  id: string;
  date: string;
  name: string;
  description: string | null;
  maxMarks: number;
  subject: { id: string; name: string; code: string };
  teacher: { user: { firstName: string; lastName: string } };
  syllabusTopic: { name: string; chapter: string | null } | null;
  marks: { marksObtained: number; remarks: string | null }[];
};

type Day = {
  date: string;
  lessons: LessonPlan[];
  tests: ClassTestEntry[];
};

type DiaryData = {
  student: { id: string; name: string; className: string; sectionName: string };
  range: { from: string; to: string };
  days: Day[];
  counts: { lessons: number; tests: number; days: number };
};

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

export default function ParentDailyDiaryPage() {
  const { user } = useAuthStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState<DiaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    api.get('/parent/children', { params: { userId: user.id } })
      .then(res => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) setSelectedChild(res.data.children[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!selectedChild) return;
    let cancelled = false;
    api.get(`/parent/daily-diary/${selectedChild}`, { params: { from: isoDaysAgo(rangeDays) } })
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [selectedChild, rangeDays]);

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
              <h1 className="text-2xl font-bold text-slate-900">Daily Diary</h1>
              <p className="text-sm text-slate-500">What was taught and tested in your child's class</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {children.length > 1 && (
              <select
                value={selectedChild}
                onChange={e => setSelectedChild(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900"
              >
                {children.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.className})</option>
                ))}
              </select>
            )}
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
            <div className="grid grid-cols-3 gap-4">
              <SummaryCard label="Days with entries" value={data.counts.days} icon={CalendarDays} color="bg-blue-500" />
              <SummaryCard label="Lessons taught" value={data.counts.lessons} icon={BookOpen} color="bg-emerald-500" />
              <SummaryCard label="Class tests" value={data.counts.tests} icon={ClipboardCheck} color="bg-amber-500" />
            </div>

            {data.days.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
                No diary entries yet for {data.student.name} in this period.
              </div>
            ) : (
              <div className="space-y-4">
                {data.days.map(day => <DayCard key={day.date} day={day} />)}
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

function DayCard({ day }: { day: Day }) {
  const isHoliday = day.lessons.length === 0 && day.tests.length === 0;
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
          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{day.lessons.length} lessons</span>
          {day.tests.length > 0 && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{day.tests.length} tests</span>
          )}
        </div>
      </div>
      <div className="p-5 space-y-4">
        {day.tests.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Tests</p>
            {day.tests.map(t => (
              <div key={t.id} className="border border-amber-200 bg-amber-50/50 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">
                      {t.name} <span className="text-slate-500 font-normal text-sm">— {t.subject.name}</span>
                    </p>
                    {t.syllabusTopic && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Topic: {t.syllabusTopic.chapter ? `${t.syllabusTopic.chapter} — ` : ''}{t.syllabusTopic.name}
                      </p>
                    )}
                    {t.description && <p className="text-sm text-slate-600 mt-1">{t.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {t.marks.length > 0 ? (
                      <p className="font-bold text-amber-700">
                        {t.marks[0].marksObtained}<span className="text-slate-500 font-normal text-sm">/{t.maxMarks}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">Marks pending · /{t.maxMarks}</p>
                    )}
                    {t.marks[0]?.remarks && (
                      <p className="text-xs text-slate-500 italic mt-0.5">&ldquo;{t.marks[0].remarks}&rdquo;</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {day.lessons.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Lessons</p>
            {day.lessons.map(l => (
              <div key={l.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {l.subject.name}
                      </span>
                      <span className="font-medium text-slate-900">{l.topic}</span>
                      <span className="text-xs text-slate-400">
                        — {l.teacher.user.firstName} {l.teacher.user.lastName}
                      </span>
                    </div>
                    {l.objectives && (
                      <p className="text-sm text-slate-600 mt-2">
                        <span className="text-xs font-medium text-slate-400 uppercase">Objectives: </span>
                        {l.objectives}
                      </p>
                    )}
                    {l.content && (
                      <p className="text-sm text-slate-600 mt-1">{l.content}</p>
                    )}
                    {l.homework && (
                      <p className="text-sm text-slate-700 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                        <span className="font-medium">Homework: </span>{l.homework}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isHoliday && (
          <p className="text-center text-sm text-slate-400 italic">No entries recorded for this day.</p>
        )}
      </div>
    </div>
  );
}
