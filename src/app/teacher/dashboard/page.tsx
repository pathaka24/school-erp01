'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { Users, ClipboardList, FileText, NotebookPen, BookOpen, Calendar, Sun, ChevronRight } from 'lucide-react';

function StatCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'TEACHER') { router.push('/dashboard'); return; }
    api.get('/teachers/me', { params: { userId: user.id } })
      .then(res => setTeacher(res.data))
      .catch(console.error)
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

  const totalStudents = teacher?.classSections?.reduce((sum: number, s: any) => sum + (s.students?.length || 0), 0) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {user?.firstName}!
          </h1>
          <p className="text-slate-500">Employee ID: {teacher?.employeeId}</p>
        </div>

        {/* Today banner */}
        <a
          href="/teacher/today"
          className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-5 hover:from-blue-700 hover:to-indigo-700 transition shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-white/20 flex items-center justify-center">
              <Sun className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-lg">See your day</p>
              <p className="text-sm text-blue-100">Today's periods, attendance status, lesson plans and pending grades</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5" />
        </a>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="My Students" value={totalStudents} icon={Users} color="bg-blue-500" />
          <StatCard title="My Subjects" value={teacher?.subjects?.length || 0} icon={BookOpen} color="bg-green-500" />
          <StatCard title="Class Teacher Of" value={teacher?.classSections?.length || 0} icon={Calendar} color="bg-purple-500" />
          <StatCard title="Employee ID" value={teacher?.employeeId || '-'} icon={FileText} color="bg-orange-500" />
        </div>

        {/* Class teacher sections */}
        {teacher?.classSections?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">My Class Sections</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teacher.classSections.map((section: any) => (
                <div key={section.id} className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900">{section.class.name} — Section {section.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{section.students?.length || 0} students</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My subjects */}
        {teacher?.subjects?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">My Subjects</h2>
            <div className="flex flex-wrap gap-2">
              {teacher.subjects.map((sub: any) => (
                <span key={sub.id} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                  {sub.name} ({sub.code}) — {sub.class?.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <a href="/teacher/attendance" className="flex items-center gap-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition">
              <ClipboardList className="h-5 w-5 text-green-600" />
              <p className="font-medium text-green-700">Mark Attendance</p>
            </a>
            <a href="/teacher/exams" className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition">
              <FileText className="h-5 w-5 text-purple-600" />
              <p className="font-medium text-purple-700">Manage Exams</p>
            </a>
            <a href="/teacher/grades" className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition">
              <BookOpen className="h-5 w-5 text-orange-600" />
              <p className="font-medium text-orange-700">Enter Grades</p>
            </a>
            <a href="/teacher/lesson-plans" className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition">
              <NotebookPen className="h-5 w-5 text-blue-600" />
              <p className="font-medium text-blue-700">Lesson Plans</p>
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
