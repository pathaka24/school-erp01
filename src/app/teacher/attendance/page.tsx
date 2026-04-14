'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';

export default function TeacherAttendancePage() {
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<any>(null);
  const [selectedSection, setSelectedSection] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get('/teachers/me', { params: { userId: user.id } })
      .then(res => {
        setTeacher(res.data);
        if (res.data.classSections?.length > 0) setSelectedSection(res.data.classSections[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!selectedSection || !teacher) return;
    const section = teacher.classSections.find((s: any) => s.id === selectedSection);
    if (!section) return;
    fetchAttendance(section);
  }, [selectedSection, date, teacher]);

  const fetchAttendance = async (section: any) => {
    const studentList = section.students || [];
    setStudents(studentList);

    const { data } = await api.get('/attendance', {
      params: { classId: section.classId, sectionId: section.id, date },
    });
    const existing: Record<string, string> = {};
    data.forEach((a: any) => { existing[a.studentId] = a.status; });
    studentList.forEach((s: any) => { if (!existing[s.id]) existing[s.id] = 'PRESENT'; });
    setAttendance(existing);
  };

  const handleSubmit = async () => {
    setSaving(true);
    const records = Object.entries(attendance).map(([studentId, status]) => ({ studentId, status }));
    try {
      await api.post('/attendance/mark', { date, records });
      alert('Attendance saved!');
    } catch {
      alert('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const section = teacher?.classSections?.find((s: any) => s.id === selectedSection);

  const statusBtn = (studentId: string, status: string) => {
    const colors: Record<string, string> = {
      PRESENT: 'bg-green-500 text-white',
      ABSENT: 'bg-red-500 text-white',
      LATE: 'bg-yellow-500 text-white',
      EXCUSED: 'bg-blue-500 text-white',
    };
    const isActive = attendance[studentId] === status;
    return (
      <button
        key={status}
        onClick={() => setAttendance({ ...attendance, [studentId]: status })}
        className={`px-3 py-1 rounded text-xs font-medium transition ${
          isActive ? colors[status] : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        {status}
      </button>
    );
  };

  // Count summary
  const presentCount = Object.values(attendance).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(attendance).filter(s => s === 'ABSENT').length;
  const lateCount = Object.values(attendance).filter(s => s === 'LATE').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Mark Attendance</h1>

        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : !teacher?.classSections?.length ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            You are not assigned as class teacher to any section yet.
          </div>
        ) : (
          <>
            {/* Section selector + date */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
                  <select
                    value={selectedSection}
                    onChange={e => setSelectedSection(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  >
                    {teacher.classSections.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.class.name} — {s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                </div>
              </div>
            </div>

            {/* Summary bar */}
            {students.length > 0 && (
              <div className="flex gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-green-700 font-medium">Present: {presentCount}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg text-sm">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-red-700 font-medium">Absent: {absentCount}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg text-sm">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span className="text-yellow-700 font-medium">Late: {lateCount}</span>
                </div>
              </div>
            )}

            {/* Student list */}
            {students.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">#</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Student</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student, idx) => (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                          {student.user.firstName} {student.user.lastName}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                            {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map(s => statusBtn(student.id, s))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Attendance'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
