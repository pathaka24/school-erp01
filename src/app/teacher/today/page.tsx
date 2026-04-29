'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import {
  CalendarDays, Clock, MapPin, CheckCircle2, AlertCircle, NotebookPen,
  ClipboardList, Award, ChevronRight, Users,
} from 'lucide-react';

type Period = {
  id: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  startTime: string;
  endTime: string;
  room: string | null;
  totalStudents: number;
  attendanceMarked: boolean;
  attendanceSummary: { present: number; absent: number; late: number; excused: number; total: number } | null;
  lessonPlan: { id: string; status: string; topic: string; homework: string | null } | null;
};

type ClassSectionToday = {
  sectionId: string;
  sectionName: string;
  className: string;
  classId: string;
  totalStudents: number;
  attendanceMarked: boolean;
  attendanceSummary: { present: number; absent: number; late: number; excused: number; total: number } | null;
};

type PendingGrade = {
  examId: string;
  examName: string;
  examType: string;
  className: string;
  subjectId: string;
  subjectName: string;
  examSubjectId: string;
  totalStudents: number;
  gradedCount: number;
  missingCount: number;
};

type TodayData = {
  date: string;
  dayOfWeek: string;
  teacher: { id: string; employeeId: string; firstName: string; lastName: string };
  periods: Period[];
  classTeacherSections: ClassSectionToday[];
  pendingGrades: PendingGrade[];
  counts: {
    periods: number;
    periodsWithPlan: number;
    sectionsNeedingAttendance: number;
    pendingGradeSubjects: number;
  };
};

function formatDay(iso: string, day: string) {
  const d = new Date(iso);
  return `${day.charAt(0) + day.slice(1).toLowerCase()}, ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

export default function TeacherTodayPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'TEACHER') { router.push('/dashboard'); return; }
    api.get('/teacher/today', { params: { userId: user.id } })
      .then(res => setData(res.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load today'))
      .finally(() => setLoading(false));
  }, [user, router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          {error || 'Unable to load your day.'}
        </div>
      </DashboardLayout>
    );
  }

  const { periods, classTeacherSections, pendingGrades, counts } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {data.teacher.firstName}
            </h1>
            <p className="text-slate-500 flex items-center gap-2 mt-1">
              <CalendarDays className="h-4 w-4" />
              {formatDay(data.date, data.dayOfWeek)}
            </p>
          </div>
        </div>

        {/* At-a-glance counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CountCard label="Periods today" value={counts.periods} icon={Clock} color="bg-blue-500" />
          <CountCard
            label="Attendance pending"
            value={counts.sectionsNeedingAttendance}
            icon={ClipboardList}
            color={counts.sectionsNeedingAttendance > 0 ? 'bg-amber-500' : 'bg-emerald-500'}
          />
          <CountCard
            label="Lessons planned"
            value={`${counts.periodsWithPlan}/${counts.periods}`}
            icon={NotebookPen}
            color={counts.periodsWithPlan === counts.periods && counts.periods > 0 ? 'bg-emerald-500' : 'bg-slate-500'}
          />
          <CountCard
            label="Grades pending"
            value={counts.pendingGradeSubjects}
            icon={Award}
            color={counts.pendingGradeSubjects > 0 ? 'bg-amber-500' : 'bg-emerald-500'}
          />
        </div>

        {/* Class teacher attendance section — only if this teacher is a class teacher */}
        {classTeacherSections.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">My class sections</h2>
              <Link href="/teacher/attendance" className="text-sm text-blue-600 hover:text-blue-700">Go to attendance →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classTeacherSections.map(s => (
                <div key={s.sectionId} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{s.className} — {s.sectionName}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Users className="h-3 w-3" /> {s.totalStudents} students
                      </p>
                    </div>
                    {s.attendanceMarked ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                        <CheckCircle2 className="h-3 w-3" /> Marked
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">
                        <AlertCircle className="h-3 w-3" /> Pending
                      </span>
                    )}
                  </div>
                  {s.attendanceSummary && (
                    <div className="flex gap-3 text-xs text-slate-600 mt-2">
                      <span>Present: <b className="text-emerald-700">{s.attendanceSummary.present}</b></span>
                      <span>Absent: <b className="text-red-700">{s.attendanceSummary.absent}</b></span>
                      <span>Late: <b className="text-amber-700">{s.attendanceSummary.late}</b></span>
                    </div>
                  )}
                  <Link
                    href="/teacher/attendance"
                    className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    {s.attendanceMarked ? 'Review' : 'Mark attendance'}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Today's schedule */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Today's schedule</h2>
            <span className="text-xs text-slate-500">{periods.length} periods</span>
          </div>
          {periods.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No periods scheduled for you today.
            </div>
          ) : (
            <div className="space-y-2">
              {periods.map((p, idx) => (
                <PeriodCard key={p.id} period={p} index={idx + 1} />
              ))}
            </div>
          )}
        </section>

        {/* Pending grades */}
        {pendingGrades.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Pending grade entry</h2>
              <Link href="/teacher/grades" className="text-sm text-blue-600 hover:text-blue-700">Enter grades →</Link>
            </div>
            <div className="space-y-2">
              {pendingGrades.map(pg => (
                <div
                  key={pg.examSubjectId}
                  className="flex items-center justify-between border border-slate-200 rounded-lg p-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {pg.subjectName} · {pg.examName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {pg.className} · {pg.examType}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-amber-700">{pg.missingCount} to go</p>
                      <p className="text-xs text-slate-500">{pg.gradedCount}/{pg.totalStudents} graded</p>
                    </div>
                    <Link
                      href="/teacher/grades"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

function CountCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
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

function PeriodCard({ period, index }: { period: Period; index: number }) {
  const attendanceHref = `/teacher/attendance`;
  const lessonHref = `/teacher/lesson-plans`;
  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">
                {period.subjectName} <span className="text-slate-400 font-normal text-sm">({period.subjectCode})</span>
              </h3>
              <p className="text-sm text-slate-600 mt-0.5">
                {period.className} — Section {period.sectionName} · {period.totalStudents} students
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {period.startTime} – {period.endTime}
                </span>
                {period.room && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {period.room}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {period.attendanceMarked ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                  <CheckCircle2 className="h-3 w-3" /> Attendance marked
                </span>
              ) : (
                <Link
                  href={attendanceHref}
                  className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded"
                >
                  <AlertCircle className="h-3 w-3" /> Mark attendance
                </Link>
              )}
              {period.lessonPlan ? (
                <span className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded max-w-[220px] truncate">
                  <NotebookPen className="h-3 w-3 flex-shrink-0" /> {period.lessonPlan.topic}
                </span>
              ) : (
                <Link
                  href={lessonHref}
                  className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded"
                >
                  <NotebookPen className="h-3 w-3" /> Add lesson plan
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
