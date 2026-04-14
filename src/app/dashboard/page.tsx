'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Users,
  GraduationCap,
  BookOpen,
  TrendingUp,
  IndianRupee,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  Receipt,
  UserX,
  Ban,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  PageTransition,
  FadeIn,
  ScaleHover,
  StaggerContainer,
  StaggerItem,
  AnimatedRing,
  AnimatedNumber,
  SlideIn,
} from '@/components/ui/motion';

interface DashboardData {
  quickStats: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    lowAttendanceCount: number;
    overdueCount: number;
  };
  attendance: {
    totalStudents: number;
    totalMarkedToday: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    excusedToday: number;
    attendancePct: number;
    unmarkedClasses: { className: string; sectionName: string; studentCount: number }[];
  };
  fees: {
    collectedThisMonth: number;
    totalOutstanding: number;
    depositCount: number;
    recentDeposits: {
      id: string;
      studentName: string;
      className: string;
      amount: number;
      method: string | null;
      date: string;
      receiptNumber: string | null;
    }[];
  };
  alerts: {
    lowAttendanceCount: number;
    lowAttendanceStudents: { studentName: string; className: string; pct: number }[];
    overdueCount: number;
    overdueStudents: { studentName: string; className: string; balance: number }[];
  };
}

function KPICard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  delay,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  delay: number;
}) {
  return (
    <FadeIn delay={delay}>
      <ScaleHover>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
              </p>
              {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
            </div>
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>
      </ScaleHover>
    </FadeIn>
  );
}

function AttendanceBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-600 w-16 shrink-0">{label}</span>
      <Progress value={pct} max={100} color={color} className="flex-1 h-3" />
      <span className="text-sm font-semibold text-slate-700 w-10 text-right">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard');
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch dashboard:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <PageTransition>
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500">Overview of your school</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="p-5 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
                  <div className="h-8 bg-slate-200 rounded w-16" />
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="p-6 animate-pulse h-64" />
              ))}
            </div>
          </div>
        </PageTransition>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <PageTransition>
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500">Overview of your school</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-700">{error || 'Something went wrong'}</p>
            </div>
          </div>
        </PageTransition>
      </DashboardLayout>
    );
  }

  const { quickStats, attendance, fees, alerts } = data;
  const totalAlerts = alerts.lowAttendanceCount + alerts.overdueCount;
  const collectionTotal = fees.totalOutstanding + fees.collectedThisMonth;
  const collectionPct = collectionTotal > 0 ? Math.round((fees.collectedThisMonth / collectionTotal) * 100) : 0;

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <FadeIn>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500">
                Overview of your school &mdash;{' '}
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </FadeIn>

          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Students"
              value={quickStats.totalStudents}
              icon={Users}
              color="bg-blue-500"
              delay={0.05}
            />
            <KPICard
              title="Teachers"
              value={quickStats.totalTeachers}
              icon={GraduationCap}
              color="bg-emerald-500"
              delay={0.1}
            />
            <KPICard
              title="Classes"
              value={quickStats.totalClasses}
              icon={BookOpen}
              color="bg-violet-500"
              delay={0.15}
            />
            <KPICard
              title="Today's Attendance"
              value={attendance.totalMarkedToday > 0 ? `${attendance.attendancePct}%` : '--'}
              icon={CalendarCheck}
              color={
                attendance.attendancePct >= 90 ? 'bg-emerald-500' :
                attendance.attendancePct >= 75 ? 'bg-blue-500' :
                attendance.attendancePct >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }
              subtitle={attendance.totalMarkedToday > 0 ? `${attendance.totalMarkedToday} of ${attendance.totalStudents} marked` : 'Not yet marked'}
              delay={0.2}
            />
            <KPICard
              title="Monthly Collection"
              value={formatCurrency(fees.collectedThisMonth)}
              icon={IndianRupee}
              color="bg-orange-500"
              subtitle={`${fees.depositCount} deposits`}
              delay={0.25}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Attendance Card */}
            <SlideIn direction="left" delay={0.15}>
              <ScaleHover>
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle>Today&apos;s Attendance</CardTitle>
                      <a href="/attendance">
                        <Button variant="ghost" size="sm">
                          View details <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {attendance.totalMarkedToday > 0 ? (
                      <div className="flex gap-6">
                        {/* Animated attendance ring */}
                        <div className="flex flex-col items-center justify-center">
                          <div className="relative" style={{ width: 120, height: 120 }}>
                            <AnimatedRing
                              percentage={attendance.attendancePct}
                              size={120}
                              strokeWidth={10}
                              color={
                                attendance.attendancePct >= 90 ? '#22c55e' :
                                attendance.attendancePct >= 75 ? '#3b82f6' :
                                attendance.attendancePct >= 50 ? '#f59e0b' : '#ef4444'
                              }
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-2xl font-bold text-slate-900">{attendance.attendancePct}%</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Present</span>
                            </div>
                          </div>
                        </div>

                        {/* Breakdown bars */}
                        <div className="flex-1 space-y-3 justify-center flex flex-col">
                          <AttendanceBar label="Present" value={attendance.presentToday} total={attendance.totalMarkedToday} color="bg-emerald-500" />
                          <AttendanceBar label="Absent" value={attendance.absentToday} total={attendance.totalMarkedToday} color="bg-red-500" />
                          <AttendanceBar label="Late" value={attendance.lateToday} total={attendance.totalMarkedToday} color="bg-amber-500" />
                          {attendance.excusedToday > 0 && (
                            <AttendanceBar label="Excused" value={attendance.excusedToday} total={attendance.totalMarkedToday} color="bg-sky-400" />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                        <Clock className="h-10 w-10 mb-2" />
                        <p className="text-sm">No attendance marked today yet</p>
                      </div>
                    )}

                    {/* Unmarked classes */}
                    {attendance.unmarkedClasses.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Not yet marked ({attendance.unmarkedClasses.length})
                        </p>
                        <StaggerContainer className="flex flex-wrap gap-2">
                          {attendance.unmarkedClasses.slice(0, 12).map((c, i) => (
                            <StaggerItem key={i}>
                              <Badge variant="warning" className="gap-1">
                                <Clock className="h-3 w-3" />
                                {c.className} - {c.sectionName}
                              </Badge>
                            </StaggerItem>
                          ))}
                          {attendance.unmarkedClasses.length > 12 && (
                            <StaggerItem>
                              <Badge variant="secondary">
                                +{attendance.unmarkedClasses.length - 12} more
                              </Badge>
                            </StaggerItem>
                          )}
                        </StaggerContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </ScaleHover>
            </SlideIn>

            {/* Fee Collection Card */}
            <SlideIn direction="right" delay={0.15}>
              <ScaleHover>
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle>Fee Collection</CardTitle>
                      <a href="/fees">
                        <Button variant="ghost" size="sm">
                          View details <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Collection summary */}
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div className="bg-emerald-50 rounded-lg p-3.5">
                        <p className="text-xs text-emerald-600 font-medium">Collected This Month</p>
                        <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(fees.collectedThisMonth)}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3.5">
                        <p className="text-xs text-red-600 font-medium">Outstanding Balance</p>
                        <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(fees.totalOutstanding)}</p>
                      </div>
                    </div>

                    {/* Collection progress bar */}
                    {collectionTotal > 0 && (
                      <div className="mb-5">
                        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                          <span>Collection progress</span>
                          <span>{collectionPct}%</span>
                        </div>
                        <Progress
                          value={fees.collectedThisMonth}
                          max={collectionTotal}
                          color="bg-emerald-500"
                          className="h-2.5"
                        />
                      </div>
                    )}

                    {/* Recent deposits */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Deposits</p>
                      {fees.recentDeposits.length > 0 ? (
                        <StaggerContainer className="space-y-2">
                          {fees.recentDeposits.map(d => (
                            <StaggerItem key={d.id}>
                              <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-700 truncate">{d.studentName}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-xs text-slate-400">{d.className}</span>
                                    {d.method && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {d.method}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="success" className="shrink-0 ml-3 font-semibold">
                                  +{formatCurrency(d.amount)}
                                </Badge>
                              </div>
                            </StaggerItem>
                          ))}
                        </StaggerContainer>
                      ) : (
                        <p className="text-sm text-slate-400 text-center py-4">No deposits this month</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </ScaleHover>
            </SlideIn>
          </div>

          {/* Alerts Section */}
          <FadeIn delay={0.3}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-5 w-5 ${totalAlerts > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
                  <CardTitle>
                    Alerts
                    {totalAlerts > 0 && (
                      <Badge variant="danger" className="ml-2 rounded-full min-w-[1.5rem] justify-center">
                        {totalAlerts}
                      </Badge>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {totalAlerts === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <CheckCircle2 className="h-10 w-10 mb-2 text-emerald-400" />
                    <p className="text-sm text-slate-500">No alerts at this time</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Low Attendance */}
                    {alerts.lowAttendanceCount > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <UserX className="h-4 w-4 text-amber-500" />
                          <h3 className="text-sm font-semibold text-slate-700">
                            Low Attendance (&lt;75%)
                            <Badge variant="warning" className="ml-1.5">
                              {alerts.lowAttendanceCount} student{alerts.lowAttendanceCount !== 1 ? 's' : ''}
                            </Badge>
                          </h3>
                        </div>
                        <StaggerContainer className="space-y-1.5">
                          {alerts.lowAttendanceStudents.map((s, i) => (
                            <StaggerItem key={i}>
                              <div className="flex items-center justify-between py-1.5 px-3 bg-amber-50 rounded-lg">
                                <div className="min-w-0">
                                  <p className="text-sm text-slate-700 truncate">{s.studentName}</p>
                                  <p className="text-xs text-slate-400">{s.className}</p>
                                </div>
                                <Badge variant={s.pct < 50 ? 'danger' : 'warning'} className="shrink-0 ml-3 font-semibold">
                                  {s.pct}%
                                </Badge>
                              </div>
                            </StaggerItem>
                          ))}
                          {alerts.lowAttendanceCount > 10 && (
                            <StaggerItem>
                              <Button variant="ghost" size="sm" className="w-full" asChild>
                                <a href="/attendance">
                                  View all {alerts.lowAttendanceCount} students
                                </a>
                              </Button>
                            </StaggerItem>
                          )}
                        </StaggerContainer>
                      </div>
                    )}

                    {/* Overdue Fees */}
                    {alerts.overdueCount > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Ban className="h-4 w-4 text-red-500" />
                          <h3 className="text-sm font-semibold text-slate-700">
                            Overdue Fees (&gt;2 months)
                            <Badge variant="danger" className="ml-1.5">
                              {alerts.overdueCount} student{alerts.overdueCount !== 1 ? 's' : ''}
                            </Badge>
                          </h3>
                        </div>
                        <StaggerContainer className="space-y-1.5">
                          {alerts.overdueStudents.map((s, i) => (
                            <StaggerItem key={i}>
                              <div className="flex items-center justify-between py-1.5 px-3 bg-red-50 rounded-lg">
                                <div className="min-w-0">
                                  <p className="text-sm text-slate-700 truncate">{s.studentName}</p>
                                  <p className="text-xs text-slate-400">{s.className}</p>
                                </div>
                                <Badge variant="danger" className="shrink-0 ml-3 font-semibold">
                                  {formatCurrency(s.balance)}
                                </Badge>
                              </div>
                            </StaggerItem>
                          ))}
                          {alerts.overdueCount > 10 && (
                            <StaggerItem>
                              <Button variant="ghost" size="sm" className="w-full" asChild>
                                <a href="/fees">
                                  View all {alerts.overdueCount} students
                                </a>
                              </Button>
                            </StaggerItem>
                          )}
                        </StaggerContainer>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeIn>

          {/* Quick Actions */}
          <FadeIn delay={0.4}>
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <ScaleHover>
                    <a href="/students" className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition text-center">
                      <Users className="h-5 w-5 text-blue-600 mx-auto mb-1.5" />
                      <p className="text-sm font-medium text-blue-700">Manage Students</p>
                    </a>
                  </ScaleHover>
                  <ScaleHover>
                    <a href="/attendance" className="block p-4 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition text-center">
                      <CalendarCheck className="h-5 w-5 text-emerald-600 mx-auto mb-1.5" />
                      <p className="text-sm font-medium text-emerald-700">Mark Attendance</p>
                    </a>
                  </ScaleHover>
                  <ScaleHover>
                    <a href="/grades" className="block p-4 bg-violet-50 rounded-lg hover:bg-violet-100 transition text-center">
                      <TrendingUp className="h-5 w-5 text-violet-600 mx-auto mb-1.5" />
                      <p className="text-sm font-medium text-violet-700">View Grades</p>
                    </a>
                  </ScaleHover>
                  <ScaleHover>
                    <a href="/fees" className="block p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition text-center">
                      <Receipt className="h-5 w-5 text-orange-600 mx-auto mb-1.5" />
                      <p className="text-sm font-medium text-orange-700">Fee Management</p>
                    </a>
                  </ScaleHover>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
