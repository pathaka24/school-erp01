'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';

export default function TeacherStudentsPage() {
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<any>(null);
  const [selectedSection, setSelectedSection] = useState('');
  const [loading, setLoading] = useState(true);

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

  const section = teacher?.classSections?.find((s: any) => s.id === selectedSection);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Students</h1>
          <p className="text-slate-500">Students in your class sections</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : !teacher?.classSections?.length ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            You are not assigned as class teacher to any section yet.
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              {teacher.classSections.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSection(s.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedSection === s.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s.class.name} — {s.name}
                </button>
              ))}
            </div>

            {section && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h2 className="font-semibold text-slate-900">{section.class.name} — Section {section.name}</h2>
                  <p className="text-sm text-slate-500">{section.students?.length || 0} students</p>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">#</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Name</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Admission No</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Roll No</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Gender</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {section.students?.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No students in this section</td></tr>
                    ) : (
                      section.students?.map((student: any, idx: number) => (
                        <tr key={student.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-500">{idx + 1}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                            {student.user.firstName} {student.user.lastName}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">{student.admissionNo}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{student.rollNumber || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{student.gender}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
