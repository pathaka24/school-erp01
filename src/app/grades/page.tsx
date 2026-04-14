'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
export default function GradesPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/exams').then(res => setExams(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedExam) {
      setLoading(true);
      api.get(`/grades/exam/${selectedExam}`)
        .then(res => setGrades(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [selectedExam]);

  const gradeColor = (marks: number, max: number, passing: number) => {
    if (marks < passing) return 'text-red-600';
    if (marks >= max * 0.8) return 'text-green-600';
    return 'text-slate-900';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Grades</h1>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="max-w-md mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Exam</label>
            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
              <option value="">Choose an exam</option>
              {exams.map((exam: any) => (
                <option key={exam.id} value={exam.id}>{exam.name} ({exam.class?.name})</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading grades...</div>
          ) : grades.length > 0 ? (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Student</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Subject</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Marks</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Grade</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grades.map((grade: any) => (
                  <tr key={grade.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                      {grade.student?.user?.firstName} {grade.student?.user?.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {grade.examSubject?.subject?.name}
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium ${gradeColor(grade.marksObtained, grade.examSubject?.maxMarks || 100, grade.examSubject?.passingMarks || 33)}`}>
                      {grade.marksObtained} / {grade.examSubject?.maxMarks || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{grade.grade || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{grade.remarks || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : selectedExam ? (
            <div className="text-center py-8 text-slate-400">No grades found for this exam</div>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
