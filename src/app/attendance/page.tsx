'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getStatusColor(pct: number) {
  if (pct >= 90) return 'bg-green-100 text-green-700 border-green-200';
  if (pct >= 75) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function getStatusDot(status: string) {
  if (status === 'PRESENT') return 'bg-green-500';
  if (status === 'ABSENT') return 'bg-red-500';
  if (status === 'LATE') return 'bg-yellow-500';
  return 'bg-blue-500';
}

export default function AttendancePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'daily' | 'monthly' | 'alerts'>('daily');
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const autoSelectDone = useRef(false);

  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    api.get('/classes').then(res => setClasses(res.data));
  }, []);

  // Auto-select class and section for TEACHER users
  useEffect(() => {
    if (autoSelectDone.current || !user || user.role !== 'TEACHER' || classes.length === 0) return;
    autoSelectDone.current = true;

    api.get('/teachers/me', { params: { userId: user.id } }).then(res => {
      const teacher = res.data;
      // classSections contains sections where this teacher is classTeacher
      if (teacher.classSections && teacher.classSections.length > 0) {
        const section = teacher.classSections[0];
        const classId = section.classId || section.class?.id;
        const sectionId = section.id;
        if (classId) setSelectedClass(classId);
        if (sectionId) setSelectedSection(sectionId);
      }
    }).catch(() => {
      // Silently fail — teacher may not be a class teacher
    });
  }, [user, classes]);

  useEffect(() => {
    if (selectedClass && selectedSection) {
      api.get('/students', { params: { classId: selectedClass, sectionId: selectedSection } }).then(r => setStudents(r.data));
    }
  }, [selectedClass, selectedSection]);

  useEffect(() => {
    if (selectedClass && selectedSection && tab === 'daily') fetchDailyAttendance();
  }, [selectedClass, selectedSection, date]);

  useEffect(() => {
    if (selectedClass && selectedSection && (tab === 'monthly' || tab === 'alerts')) fetchMonthlySummary();
  }, [selectedClass, selectedSection, selectedMonth, selectedYear, tab]);

  const fetchDailyAttendance = async () => {
    if (!selectedClass || !selectedSection) return;
    const { data } = await api.get('/students', { params: { classId: selectedClass, sectionId: selectedSection } });
    setStudents(data);
    const attRes = await api.get('/attendance', { params: { classId: selectedClass, sectionId: selectedSection, date } });
    const existing: Record<string, string> = {};
    attRes.data.forEach((a: any) => { existing[a.studentId] = a.status; });
    data.forEach((s: any) => { if (!existing[s.id]) existing[s.id] = 'PRESENT'; });
    setAttendance(existing);
  };

  const fetchMonthlySummary = async () => {
    const summaries = await Promise.all(
      students.map(async (s: any) => {
        const res = await api.get(`/attendance/student/${s.id}`, { params: { month: selectedMonth, year: selectedYear } });
        return { student: s, ...res.data.summary };
      })
    );
    setMonthlyData(summaries);
  };

  const handleSubmit = async () => {
    const records = Object.entries(attendance).map(([studentId, status]) => ({ studentId, status }));
    try {
      await api.post('/attendance/mark', { date, records });
      alert('Attendance saved!');
    } catch { alert('Failed to save'); }
  };

  const selectedClassData = classes.find((c: any) => c.id === selectedClass);
  const alerts = monthlyData.filter(d => parseFloat(d.percentage) < 75);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">Select</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
              <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">Select</option>
                {selectedClassData?.sections?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {tab === 'daily' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </div>
            )}
            {(tab === 'monthly' || tab === 'alerts') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
                  <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { id: 'daily', label: 'Daily Attendance' },
            { id: 'monthly', label: 'Monthly Summary' },
            { id: 'alerts', label: `Alerts ${alerts.length > 0 ? `(${alerts.length})` : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >{t.label}</button>
          ))}
        </div>

        {/* DAILY TAB */}
        {tab === 'daily' && students.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">#</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Student</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Admission No</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">{student.user.firstName} {student.user.lastName}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{student.admissionNo}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map(status => (
                          <button key={status} onClick={() => setAttendance({ ...attendance, [student.id]: status })}
                            className={`px-3 py-1 rounded text-xs font-medium transition ${
                              attendance[student.id] === status
                                ? status === 'PRESENT' ? 'bg-green-500 text-white'
                                  : status === 'ABSENT' ? 'bg-red-500 text-white'
                                  : status === 'LATE' ? 'bg-yellow-500 text-white'
                                  : 'bg-blue-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >{status}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end">
              <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Save Attendance</button>
            </div>
          </div>
        )}

        {/* MONTHLY SUMMARY TAB */}
        {tab === 'monthly' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">{MONTHS[selectedMonth - 1]} {selectedYear} — Summary</h2>
            {monthlyData.length === 0 ? (
              <p className="text-slate-400">Select class and section, then data will load</p>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Student</th>
                    <th className="text-center px-4 py-2 text-sm font-medium text-slate-500">Working Days</th>
                    <th className="text-center px-4 py-2 text-sm font-medium text-slate-500">Present</th>
                    <th className="text-center px-4 py-2 text-sm font-medium text-slate-500">Absent</th>
                    <th className="text-center px-4 py-2 text-sm font-medium text-slate-500">Late</th>
                    <th className="text-center px-4 py-2 text-sm font-medium text-slate-500">%</th>
                    <th className="text-center px-4 py-2 text-sm font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyData.map((d: any) => {
                    const pct = parseFloat(d.percentage);
                    return (
                      <tr key={d.student.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">{d.student.user.firstName} {d.student.user.lastName}</td>
                        <td className="text-center px-4 py-3 text-sm text-slate-600">{d.total}</td>
                        <td className="text-center px-4 py-3 text-sm text-green-600 font-medium">{d.present}</td>
                        <td className="text-center px-4 py-3 text-sm text-red-600 font-medium">{d.absent}</td>
                        <td className="text-center px-4 py-3 text-sm text-yellow-600 font-medium">{d.late}</td>
                        <td className="text-center px-4 py-3 text-sm font-bold">{d.percentage}%</td>
                        <td className="text-center px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(pct)}`}>
                            {pct >= 90 ? 'Good' : pct >= 75 ? 'Average' : 'Low'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ALERTS TAB */}
        {tab === 'alerts' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4 text-red-600">Attendance Below 75%</h2>
            {alerts.length === 0 ? (
              <p className="text-slate-400">No students below 75% attendance this month</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((d: any) => (
                  <div key={d.student.id} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{d.student.user.firstName} {d.student.user.lastName}</p>
                      <p className="text-xs text-slate-500">{d.student.admissionNo} | Present: {d.present}/{d.total}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">{d.percentage}%</p>
                      <p className="text-xs text-red-500">Below threshold</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
