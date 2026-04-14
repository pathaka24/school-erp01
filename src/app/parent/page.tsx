'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatCurrency, getCurrentAcademicYear } from '@/lib/utils';
import { Users, GraduationCap, CalendarCheck, IndianRupee, ChevronRight, AlertTriangle, Award, BookOpen, Sparkles, TrendingUp, Clock } from 'lucide-react';

interface Child {
  id: string;
  name: string;
  admissionNo: string;
  className: string;
  sectionName: string;
  attendancePct: number;
  totalDays: number;
  presentDays: number;
  feeBalance: number;
  familyName: string | null;
}

export default function ParentDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [parentName, setParentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scholarshipData, setScholarshipData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/parent/children?userId=${user.id}`)
      .then(res => {
        setChildren(res.data.children);
        setParentName(res.data.parent.name);
        // Load scholarship data for each child
        const year = getCurrentAcademicYear();
        res.data.children.forEach((child: Child) => {
          api.get(`/monthly-report/${child.id}?academicYear=${year}`).then(r => {
            setScholarshipData(prev => ({ ...prev, [child.id]: r.data }));
          }).catch(() => {});
        });
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></DashboardLayout>;
  }

  const totalFeeBalance = children.reduce((sum, c) => sum + c.feeBalance, 0);
  const avgAttendance = children.length > 0 ? Number((children.reduce((sum, c) => sum + c.attendancePct, 0) / children.length).toFixed(1)) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-2xl p-6 text-white">
          <p className="text-blue-200 text-sm">Welcome back,</p>
          <h1 className="text-2xl font-bold mt-1">{parentName || user?.firstName || 'Parent'}</h1>
          <p className="text-blue-300 text-sm mt-1">{children.length} {children.length === 1 ? 'child' : 'children'} enrolled</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 rounded-lg"><Users className="h-4 w-4 text-blue-600" /></div>
              <span className="text-xs text-slate-500">Children</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{children.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-green-100 rounded-lg"><CalendarCheck className="h-4 w-4 text-green-600" /></div>
              <span className="text-xs text-slate-500">Avg Attendance</span>
            </div>
            <p className={`text-2xl font-bold ${avgAttendance >= 90 ? 'text-green-600' : avgAttendance >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>{avgAttendance}%</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${totalFeeBalance > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                <IndianRupee className={`h-4 w-4 ${totalFeeBalance > 0 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <span className="text-xs text-slate-500">Fee Balance</span>
            </div>
            <p className={`text-2xl font-bold ${totalFeeBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(totalFeeBalance)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-purple-100 rounded-lg"><Sparkles className="h-4 w-4 text-purple-600" /></div>
              <span className="text-xs text-slate-500">Scholarship</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">
              {formatCurrency(Object.values(scholarshipData).reduce((sum: number, d: any) => sum + (d?.diary?.reduce((s: number, m: any) => s + (m.grandTotal || m.rewardAmount || 0), 0) || 0), 0))}
            </p>
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Attendance', href: '/parent/attendance', icon: CalendarCheck, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Exam Results', href: '/parent/exams', icon: Award, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Fee Ledger', href: '/parent/fees', icon: IndianRupee, color: 'text-red-700', bg: 'bg-red-50' },
            { label: 'Scholarship', href: '/parent/diary', icon: Sparkles, color: 'text-purple-700', bg: 'bg-purple-50' },
            { label: 'Report Card', href: '/parent/report-card', icon: BookOpen, color: 'text-amber-700', bg: 'bg-amber-50' },
          ].map(item => (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`${item.bg} rounded-xl p-4 text-center hover:shadow-md transition`}>
              <item.icon className={`h-6 w-6 ${item.color} mx-auto mb-1`} />
              <span className={`text-xs font-bold ${item.color}`}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Children Cards */}
        {children.length === 0 && !error && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No children linked to your account.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {children.map(child => {
            const attColor = child.attendancePct >= 90 ? 'text-green-600' : child.attendancePct >= 75 ? 'text-yellow-600' : 'text-red-600';
            const diary = scholarshipData[child.id];
            const totalScholarship = diary?.diary?.reduce((s: number, m: any) => s + (m.grandTotal || m.rewardAmount || 0), 0) || 0;

            return (
              <div key={child.id} onClick={() => router.push(`/parent/child/${child.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition cursor-pointer group">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">{child.name}</h3>
                    <p className="text-sm text-slate-500">{child.className} — {child.sectionName} | Adm: {child.admissionNo}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-400 mt-1" />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className={`rounded-lg p-3 ${child.attendancePct >= 90 ? 'bg-green-50' : child.attendancePct >= 75 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                    <p className="text-[10px] text-slate-400 uppercase">Attendance</p>
                    <p className={`text-xl font-bold ${attColor}`}>{child.attendancePct}%</p>
                    <p className="text-[10px] text-slate-400">{child.presentDays}/{child.totalDays}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${child.feeBalance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className="text-[10px] text-slate-400 uppercase">Fee Balance</p>
                    <p className={`text-lg font-bold ${child.feeBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(child.feeBalance)}</p>
                    <p className="text-[10px] text-slate-400">{child.feeBalance > 0 ? 'Pending' : 'Cleared'}</p>
                  </div>
                  <div className="rounded-lg p-3 bg-purple-50">
                    <p className="text-[10px] text-slate-400 uppercase">Scholarship</p>
                    <p className="text-lg font-bold text-purple-700">{formatCurrency(totalScholarship)}</p>
                    <p className="text-[10px] text-slate-400">This year</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
