'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';

export default function TeacherGradesPage() {
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedExamSubject, setSelectedExamSubject] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, { marksObtained: number; grade: string; remarks: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get('/teachers/me', { params: { userId: user.id } })
      .then(res => setTeacher(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!teacher) return;
    const classIds = [...new Set(teacher.subjects?.map((s: any) => s.classId) || [])];
    Promise.all(classIds.map((cid: string) => api.get('/exams', { params: { classId: cid } })))
      .then(responses => {
        const all = responses.flatMap(r => r.data);
        setExams(Array.from(new Map(all.map((e: any) => [e.id, e])).values()));
      })
      .catch(console.error);
  }, [teacher]);

  const exam = exams.find(e => e.id === selectedExam);
  const examSubjects = exam?.examSubjects || [];
  const examSubject = examSubjects.find((es: any) => es.id === selectedExamSubject);

  useEffect(() => {
    if (!selectedExamSubject || !exam) return;
    // Fetch students for the exam's class
    api.get('/students', { params: { classId: exam.classId } })
      .then(res => {
        setStudents(res.data);
        // Fetch existing grades
        return api.get(`/grades/exam/${exam.id}`);
      })
      .then(res => {
        const existing: Record<string, any> = {};
        res.data
          .filter((g: any) => g.examSubjectId === selectedExamSubject)
          .forEach((g: any) => {
            existing[g.studentId] = {
              marksObtained: g.marksObtained,
              grade: g.grade || '',
              remarks: g.remarks || '',
            };
          });
        setMarks(existing);
      })
      .catch(console.error);
  }, [selectedExamSubject, exam]);

  const handleMarkChange = (studentId: string, field: string, value: any) => {
    setMarks({
      ...marks,
      [studentId]: { ...(marks[studentId] || { marksObtained: 0, grade: '', remarks: '' }), [field]: value },
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    const grades = Object.entries(marks).map(([studentId, data]) => ({
      studentId,
      marksObtained: Number(data.marksObtained),
      grade: data.grade || null,
      remarks: data.remarks || null,
    }));
    try {
      await api.post('/grades/submit', { examSubjectId: selectedExamSubject, grades });
      alert('Grades saved!');
    } catch {
      alert('Failed to save grades');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Enter Grades</h1>

        {/* Selectors */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Exam</label>
              <select
                value={selectedExam}
                onChange={e => { setSelectedExam(e.target.value); setSelectedExamSubject(''); setMarks({}); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="">Choose exam</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.class?.name})</option>)}
              </select>
            </div>
            {selectedExam && examSubjects.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Subject</label>
                <select
                  value={selectedExamSubject}
                  onChange={e => setSelectedExamSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="">Choose subject</option>
                  {examSubjects.map((es: any) => (
                    <option key={es.id} value={es.id}>
                      {es.subject?.name} (Max: {es.maxMarks}, Pass: {es.passingMarks})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Grade entry table */}
        {selectedExamSubject && students.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">
              {examSubject?.subject?.name} — Max: {examSubject?.maxMarks}, Pass: {examSubject?.passingMarks}
            </h2>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">#</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Student</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Marks</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Grade</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, idx) => {
                  const m = marks[student.id] || { marksObtained: '', grade: '', remarks: '' };
                  const isFail = m.marksObtained !== '' && Number(m.marksObtained) < (examSubject?.passingMarks || 0);
                  return (
                    <tr key={student.id} className={isFail ? 'bg-red-50' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                        {student.user.firstName} {student.user.lastName}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          max={examSubject?.maxMarks || 100}
                          value={m.marksObtained}
                          onChange={e => handleMarkChange(student.id, 'marksObtained', e.target.value)}
                          className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-slate-900"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={m.grade}
                          onChange={e => handleMarkChange(student.id, 'grade', e.target.value)}
                          placeholder="A/B/C"
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-slate-900"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={m.remarks}
                          onChange={e => handleMarkChange(student.id, 'remarks', e.target.value)}
                          placeholder="Optional"
                          className="w-32 px-2 py-1 border border-slate-300 rounded text-sm text-slate-900"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Grades'}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
