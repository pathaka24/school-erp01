'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency, getAcademicYears } from '@/lib/utils';
import { ArrowLeft, CalendarCheck, IndianRupee, BookOpen, Award, TrendingUp } from 'lucide-react';

const TABS = [
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'exams', label: 'Exam Results', icon: Award },
  { id: 'fees', label: 'Fee Ledger', icon: IndianRupee },
  { id: 'diary', label: 'Scholarship Diary', icon: BookOpen },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
];

export default function ParentChildDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('attendance');
  const [loading, setLoading] = useState(true);

  // Attendance state
  const [attData, setAttData] = useState<any>(null);
  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(new Date().getFullYear());

  // Fee ledger state
  const [ledgerData, setLedgerData] = useState<any>(null);

  // Exam results state
  const [exams, setExams] = useState<any[]>([]);
  const [examGrades, setExamGrades] = useState<Record<string, any[]>>({});

  // Monthly diary state
  const [diaryData, setDiaryData] = useState<any>(null);
  const [diaryYear, setDiaryYear] = useState(() => { const n = new Date(); const y = n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1; return `${y}-${y+1}`; });

  // Load student info
  useEffect(() => {
    api.get(`/students/${id}`)
      .then(res => setStudent(res.data))
      .catch(() => alert('Student not found'))
      .finally(() => setLoading(false));
  }, [id]);

  // Attendance
  const loadAttendance = async () => {
    try {
      const r = await api.get(`/attendance/student/${id}`, { params: { month: attMonth, year: attYear } });
      setAttData(r.data);
    } catch { setAttData(null); }
  };

  useEffect(() => {
    if (activeTab === 'attendance') loadAttendance();
  }, [activeTab, attMonth, attYear]);

  // Fee ledger
  const loadLedger = async () => {
    try {
      const r = await api.get(`/fees/ledger/${id}`);
      setLedgerData(r.data);
    } catch { setLedgerData(null); }
  };

  useEffect(() => {
    if (activeTab === 'fees') loadLedger();
  }, [activeTab]);

  // Exam results
  useEffect(() => {
    if (activeTab === 'exams' && student) {
      api.get('/exams', { params: { classId: student.classId } }).then(r => {
        setExams(r.data);
        r.data.forEach((exam: any) => {
          api.get(`/grades/student/${id}`, { params: { examId: exam.id } }).then(gr => {
            setExamGrades(prev => ({ ...prev, [exam.id]: gr.data }));
          }).catch(() => {});
        });
      }).catch(() => setExams([]));
    }
  }, [activeTab, student]);

  // Monthly diary
  const loadDiary = async () => {
    try {
      const r = await api.get(`/monthly-report/${id}?academicYear=${diaryYear}`);
      setDiaryData(r.data);
    } catch { setDiaryData(null); }
  };

  useEffect(() => {
    if (activeTab === 'diary') loadDiary();
  }, [activeTab, diaryYear]);

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
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/parent')} className="p-2 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {student?.user?.firstName} {student?.user?.lastName}
            </h1>
            <p className="text-slate-500">
              Adm. No: {student?.admissionNo} | {student?.class?.name} - Section {student?.section?.name}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">

          {/* ATTENDANCE TAB */}
          {activeTab === 'attendance' && (() => {
            const pct = attData?.summary?.percentage != null ? Number(attData.summary.percentage) : 0;
            const pctColor = pct >= 90 ? 'text-green-600' : pct >= 75 ? 'text-yellow-600' : 'text-red-600';
            const ringColor = pct >= 90 ? '#16a34a' : pct >= 75 ? '#ca8a04' : '#dc2626';
            const ringBg = pct >= 90 ? '#dcfce7' : pct >= 75 ? '#fef9c3' : '#fee2e2';
            const circumference = 2 * Math.PI * 54;
            const offset = circumference - (pct / 100) * circumference;

            const absentDates = (attData?.records || [])
              .filter((r: any) => r.status === 'ABSENT')
              .map((r: any) => {
                const d = new Date(r.date);
                return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' });
              });

            const lateDates = (attData?.records || [])
              .filter((r: any) => r.status === 'LATE')
              .map((r: any) => {
                const d = new Date(r.date);
                return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' });
              });

            return (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">Attendance</h2>
                  <div className="flex items-center gap-2">
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

                {/* Ring + Stats */}
                {attData?.summary && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Attendance Ring */}
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

                    {/* Stat Cards */}
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

                    {/* Absent & Late Dates */}
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
                        const lastDay = new Date(attYear, attMonth, 0).getDate();
                        let startDay = firstDay.getDay() - 1;
                        if (startDay < 0) startDay = 6;

                        const cells = [];
                        for (let i = 0; i < startDay; i++) {
                          cells.push(<div key={`empty-${i}`} />);
                        }
                        const recordMap = new Map(
                          attData.records.map((r: any) => {
                            const d = new Date(r.date);
                            return [d.getUTCDate(), r.status];
                          })
                        );
                        for (let day = 1; day <= lastDay; day++) {
                          const status = recordMap.get(day) as string | undefined;
                          const isSunday = new Date(attYear, attMonth - 1, day).getDay() === 0;

                          let bg, border, textColor, icon;
                          if (status === 'PRESENT') {
                            bg = 'bg-green-100'; border = 'border-green-300'; textColor = 'text-green-800'; icon = '\u2713';
                          } else if (status === 'ABSENT') {
                            bg = 'bg-red-100'; border = 'border-red-400 border-2'; textColor = 'text-red-700'; icon = '\u2717';
                          } else if (status === 'LATE') {
                            bg = 'bg-yellow-100'; border = 'border-yellow-400 border-2'; textColor = 'text-yellow-700'; icon = '!';
                          } else if (isSunday) {
                            bg = 'bg-blue-50'; border = 'border-blue-200'; textColor = 'text-blue-400'; icon = '';
                          } else {
                            bg = 'bg-slate-50'; border = 'border-slate-200'; textColor = 'text-slate-300'; icon = '';
                          }

                          cells.push(
                            <div key={day} className={`${bg} ${textColor} border ${border} rounded-xl p-1.5 text-center relative transition-transform hover:scale-110`} title={status || (isSunday ? 'Sunday' : 'No record')}>
                              <div className="text-sm font-bold">{day}</div>
                              {icon && <div className="text-[10px] font-black leading-none">{icon}</div>}
                            </div>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                    {/* Legend */}
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
            );
          })()}

          {/* FEE LEDGER TAB — read-only */}
          {activeTab === 'fees' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Fee Ledger</h2>
                {ledgerData?.student?.familyName && (
                  <p className="text-sm text-slate-500">Family: {ledgerData.student.familyName}</p>
                )}
              </div>

              {/* Balance card */}
              <div className={`rounded-xl p-5 border ${ledgerData?.currentBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <p className="text-sm text-slate-600">Current Balance</p>
                <p className={`text-3xl font-bold ${ledgerData?.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(ledgerData?.currentBalance || 0)}
                </p>
                {ledgerData?.currentBalance > 0 && <p className="text-sm text-red-500 mt-1">Dues pending</p>}
                {ledgerData?.currentBalance <= 0 && <p className="text-sm text-green-600 mt-1">All dues cleared</p>}
              </div>

              {/* Siblings info */}
              {ledgerData?.siblings?.length > 1 && (
                <div className="flex gap-3 flex-wrap">
                  {ledgerData.siblings.map((s: any) => (
                    <span key={s.id} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {s.name} — {s.class}
                    </span>
                  ))}
                </div>
              )}

              {/* Ledger table — read-only */}
              {ledgerData?.ledger?.length > 0 ? (() => {
                const getAcademicYear = (month: string) => {
                  const [y, m] = month.split('-').map(Number);
                  return m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
                };
                let lastYear = '';

                return (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Month</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Monthly Fee</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Other</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Total Due</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Deposited</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Balance</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Date / Sign</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ledgerData.ledger.map((row: any) => {
                          const year = getAcademicYear(row.month);
                          const showYearHeader = year !== lastYear;
                          lastYear = year;
                          const isPrevBalance = row.monthlyFee === 0 && row.otherCharges > 0 && row.otherDetails.some((d: string) => d.toLowerCase().includes('previous') || d.toLowerCase().includes('opening'));

                          return (
                            <>{showYearHeader && (
                              <tr key={`year-${year}`} className="bg-blue-50">
                                <td colSpan={7} className="px-4 py-2 text-sm font-bold text-blue-700">Academic Year {year}</td>
                              </tr>
                            )}
                            <tr key={row.month} className={`hover:bg-slate-50 ${isPrevBalance ? 'bg-purple-50' : ''}`}>
                              <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                {new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                {isPrevBalance && <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Prev. Balance</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-700 text-right">
                                {row.monthlyFee > 0 ? formatCurrency(row.monthlyFee) : '\u2014'}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {row.otherCharges > 0 ? (
                                  <span className="text-orange-600 cursor-help" title={row.otherDetails.join('\n')}>
                                    {formatCurrency(row.otherCharges)}
                                  </span>
                                ) : '\u2014'}
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                                {formatCurrency(row.balance + row.deposited)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {row.deposited > 0 ? (
                                  <span className="text-green-600 font-semibold">{formatCurrency(row.deposited)}</span>
                                ) : '\u2014'}
                              </td>
                              <td className={`px-4 py-3 text-sm font-bold text-right ${row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(row.balance)}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-400">
                                {row.depositDates.length > 0 && (
                                  <div>{new Date(row.depositDates[0]).toLocaleDateString('en-IN')}</div>
                                )}
                                {row.depositMethods.length > 0 && (
                                  <div>{row.depositMethods[0]}</div>
                                )}
                              </td>
                            </tr></>
                          );
                        })}
                        {/* Totals row */}
                        <tr className="bg-slate-100 border-t-2 border-slate-300">
                          <td className="px-4 py-3 text-sm font-bold text-slate-900">TOTAL</td>
                          <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(ledgerData.totals?.totalMonthlyFees || 0)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-orange-600 text-right">{formatCurrency(ledgerData.totals?.totalOtherCharges || 0)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(ledgerData.totals?.totalCharged || 0)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">{formatCurrency(ledgerData.totals?.totalDeposited || 0)}</td>
                          <td className={`px-4 py-3 text-sm font-bold text-right ${ledgerData.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(ledgerData.currentBalance)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })() : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                  No fee ledger entries yet
                </div>
              )}
            </div>
          )}

          {/* MONTHLY DIARY TAB — read-only */}
          {activeTab === 'diary' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Scholarship Diary</h2>
                  <p className="text-sm text-slate-500">Attendance, test marks, fee submission & discipline</p>
                </div>
                <select value={diaryYear} onChange={e => setDiaryYear(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
                  {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {!diaryData ? (
                <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {diaryData.diary.map((d: any) => {
                    const DISC_LABELS: Record<string, string> = { V_GOOD: 'V. Good', GOOD: 'Good', AVERAGE: 'Average', POOR: 'Poor' };
                    const DISC_COLORS: Record<string, string> = { V_GOOD: 'text-green-700 bg-green-100', GOOD: 'text-blue-700 bg-blue-100', AVERAGE: 'text-yellow-700 bg-yellow-100', POOR: 'text-red-700 bg-red-100' };

                    const attVal = d.attendancePct;
                    const attDisplay = d.isHoliday ? 'Holiday' : (attVal != null ? attVal + '%' : '\u2014');
                    const attColor = d.isHoliday ? 'text-blue-600' : (attVal >= 90 ? 'text-green-600' : attVal >= 75 ? 'text-yellow-600' : attVal != null ? 'text-red-600' : 'text-slate-400');

                    const testVal = d.testMarksPct;
                    const testDisplay = testVal != null ? testVal + '%' : '0%';
                    const testColor = testVal >= 80 ? 'text-green-600' : testVal >= 50 ? 'text-yellow-600' : 'text-red-600';

                    const feeVal = d.feeSubmissionPct;
                    const feeDisplay = feeVal != null ? feeVal + '%' : '0%';
                    const feeColor = feeVal >= 80 ? 'text-green-600' : feeVal > 0 ? 'text-yellow-600' : 'text-red-600';

                    return (
                      <div key={d.month} className="border-2 border-blue-800 rounded-xl overflow-hidden bg-amber-50">
                        {/* Month header */}
                        <div className="bg-blue-800 text-white text-center py-2 font-bold text-sm uppercase tracking-wide">
                          {d.monthName}
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Attendance:</span>
                              <span className={`font-bold ${attColor}`}>{attDisplay}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Test Marks:</span>
                              <span className={`font-bold ${testColor}`}>{testDisplay}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Fee Submission:</span>
                              <span className={`font-bold ${feeColor}`}>{feeDisplay}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Discipline:</span>
                              {d.discipline ? (
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${DISC_COLORS[d.discipline] || 'bg-slate-100 text-slate-600'}`}>
                                  {DISC_LABELS[d.discipline] || d.discipline}
                                </span>
                              ) : <span className="text-slate-400">{'\u2014'}</span>}
                            </div>
                          </div>

                          <div className="flex justify-between items-end border-t border-slate-200 pt-2 mt-1">
                            {d.runningBalance > 0 ? (
                              <span className="text-xs text-red-500">Bal: {formatCurrency(d.runningBalance)}</span>
                            ) : d.runningBalance != null ? (
                              <span className="text-xs text-green-500">Clear</span>
                            ) : <span />}
                            <span className="text-lg font-bold text-blue-800">
                              {d.feeAmount > 0 ? formatCurrency(d.feeAmount) : '\u2014'}
                            </span>
                          </div>

                          {d.comment && (
                            <p className="text-xs text-slate-500 border-t border-slate-200 pt-2">
                              <strong>Comment:</strong> {d.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* EXAM RESULTS TAB */}
          {activeTab === 'exams' && (
            <div className="space-y-4">
              {exams.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No exams found</p>
              ) : exams.map((exam: any) => {
                const grades = examGrades[exam.id] || [];
                const total = grades.reduce((s: number, g: any) => s + (g.marksObtained || 0), 0);
                const max = grades.reduce((s: number, g: any) => s + (g.examSubject?.maxMarks || 0), 0);
                const pct = max > 0 ? Math.round((total / max) * 100) : 0;
                return (
                  <div key={exam.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-800 text-white px-5 py-3 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold">{exam.name}</h3>
                        <p className="text-xs text-slate-300">{exam.type}</p>
                      </div>
                      {grades.length > 0 && <div className="text-right"><p className="text-xl font-bold">{pct}%</p><p className="text-[10px] text-slate-300">{total}/{max}</p></div>}
                    </div>
                    {grades.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50"><tr>
                          <th className="text-left px-4 py-2 text-xs text-slate-500">Subject</th>
                          <th className="text-center px-3 py-2 text-xs text-slate-500">Max</th>
                          <th className="text-center px-3 py-2 text-xs text-slate-500">Marks</th>
                          <th className="text-center px-3 py-2 text-xs text-slate-500">Grade</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {grades.map((g: any) => (
                            <tr key={g.id}>
                              <td className="px-4 py-2 font-medium">{g.examSubject?.subject?.name}</td>
                              <td className="text-center px-3 py-2 text-slate-500">{g.examSubject?.maxMarks}</td>
                              <td className="text-center px-3 py-2 font-bold">{g.marksObtained}</td>
                              <td className="text-center px-3 py-2 font-bold">{g.grade || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="px-5 py-4 text-sm text-slate-400">Not yet published</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* PERFORMANCE TAB */}
          {activeTab === 'performance' && (
            <div className="space-y-5">
              {/* Attendance trend */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Attendance Overview</h3>
                {attData?.summary ? (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-blue-50 rounded-xl">
                      <p className="text-xs text-blue-600">Total Days</p>
                      <p className="text-2xl font-bold text-blue-800">{attData.summary.totalDays}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl">
                      <p className="text-xs text-green-600">Present</p>
                      <p className="text-2xl font-bold text-green-700">{attData.summary.present}</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-xl">
                      <p className="text-xs text-red-600">Absent</p>
                      <p className="text-2xl font-bold text-red-700">{attData.summary.absent}</p>
                    </div>
                    <div className={`text-center p-3 rounded-xl ${Number(attData.summary.percentage) >= 90 ? 'bg-green-50' : Number(attData.summary.percentage) >= 75 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                      <p className="text-xs text-slate-600">Percentage</p>
                      <p className="text-2xl font-bold">{Number(attData.summary.percentage).toFixed(1)}%</p>
                    </div>
                  </div>
                ) : <p className="text-sm text-slate-400">Load attendance data from the Attendance tab first</p>}
              </div>

              {/* Fee Status */}
              {ledgerData && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Fee Status</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                      <p className="text-xs text-slate-500">Total Charged</p>
                      <p className="text-xl font-bold text-slate-800">{formatCurrency(ledgerData.totals?.totalCharged || 0)}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl">
                      <p className="text-xs text-green-600">Total Paid</p>
                      <p className="text-xl font-bold text-green-700">{formatCurrency(ledgerData.totals?.totalDeposited || 0)}</p>
                    </div>
                    <div className={`text-center p-3 rounded-xl ${(ledgerData.currentBalance || 0) > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <p className="text-xs text-slate-500">Balance</p>
                      <p className={`text-xl font-bold ${(ledgerData.currentBalance || 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>{formatCurrency(ledgerData.currentBalance || 0)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Scholarship Summary */}
              {diaryData && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Scholarship Earnings ({diaryData.academicYear})</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-purple-50 rounded-xl">
                      <p className="text-xs text-purple-600">Annual Budget</p>
                      <p className="text-xl font-bold text-purple-800">{formatCurrency(diaryData.annualScholarship || 1200)}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-xl">
                      <p className="text-xs text-purple-600">Earned</p>
                      <p className="text-xl font-bold text-purple-800">
                        {formatCurrency(diaryData.diary?.reduce((s: number, d: any) => s + (d.grandTotal || d.rewardAmount || 0), 0) || 0)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-xl">
                      <p className="text-xs text-purple-600">Monthly Avg</p>
                      <p className="text-xl font-bold text-purple-800">
                        {(() => {
                          const months = diaryData.diary?.filter((d: any) => (d.grandTotal || d.rewardAmount || 0) > 0).length || 0;
                          const total = diaryData.diary?.reduce((s: number, d: any) => s + (d.grandTotal || d.rewardAmount || 0), 0) || 0;
                          return formatCurrency(months > 0 ? Math.round(total / months) : 0);
                        })()}
                      </p>
                    </div>
                  </div>
                  {/* Monthly bars */}
                  <div className="mt-4 space-y-1.5">
                    {diaryData.diary?.map((d: any) => {
                      const earned = d.grandTotal || d.rewardAmount || 0;
                      const max = diaryData.monthlyScholarship || 100;
                      const pct = max > 0 ? Math.min((earned / max) * 100, 100) : 0;
                      return (
                        <div key={d.month} className="flex items-center gap-2 text-xs">
                          <span className="w-16 text-slate-500 text-right">{d.monthName?.slice(0, 3)}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="w-12 font-bold text-slate-700">₹{earned}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Exam Performance */}
              {exams.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Exam Performance</h3>
                  <div className="space-y-2">
                    {exams.map((exam: any) => {
                      const grades = examGrades[exam.id] || [];
                      const total = grades.reduce((s: number, g: any) => s + (g.marksObtained || 0), 0);
                      const max = grades.reduce((s: number, g: any) => s + (g.examSubject?.maxMarks || 0), 0);
                      const pct = max > 0 ? Math.round((total / max) * 100) : 0;
                      const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
                      return (
                        <div key={exam.id} className="flex items-center gap-3">
                          <span className="w-28 text-xs text-slate-600 truncate">{exam.name}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="w-16 text-right text-sm font-bold text-slate-700">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}
