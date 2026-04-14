'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { Award } from 'lucide-react';

export default function ParentExamsPage() {
  const { user } = useAuthStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/parent/children?userId=${user.id}`).then(r => {
      setChildren(r.data.children);
      if (r.data.children.length > 0) setSelectedChild(r.data.children[0].id);
    }).finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!selectedChild) return;
    const child = children.find(c => c.id === selectedChild);
    if (!child) return;
    api.get('/exams', { params: { classId: child.classId } }).then(r => {
      setExams(r.data);
      // Load grades for each exam
      r.data.forEach((exam: any) => {
        api.get(`/grades/student/${selectedChild}`, { params: { examId: exam.id } }).then(gr => {
          setGrades(prev => ({ ...prev, [exam.id]: gr.data }));
        }).catch(() => {});
      });
    }).catch(() => setExams([]));
  }, [selectedChild]);

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Exam Results</h1>

        {/* Child Selector */}
        {children.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {children.map(c => (
              <button key={c.id} onClick={() => setSelectedChild(c.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${selectedChild === c.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300'}`}>
                {c.name} <span className="opacity-60">({c.className})</span>
              </button>
            ))}
          </div>
        )}

        {/* Exam Results */}
        {exams.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <Award className="h-10 w-10 mx-auto mb-2 opacity-30" />
            No exams found
          </div>
        ) : (
          <div className="space-y-4">
            {exams.map((exam: any) => {
              const examGrades = grades[exam.id] || [];
              const totalMarks = examGrades.reduce((s: number, g: any) => s + (g.marksObtained || 0), 0);
              const maxMarks = examGrades.reduce((s: number, g: any) => s + (g.examSubject?.maxMarks || 0), 0);
              const pct = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;
              const pctColor = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-blue-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-600';

              return (
                <div key={exam.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">{exam.name}</h3>
                      <p className="text-xs text-slate-300">{exam.type} | {exam.startDate ? new Date(exam.startDate).toLocaleDateString('en-IN') : ''}</p>
                    </div>
                    {examGrades.length > 0 && (
                      <div className="text-right">
                        <p className={`text-xl font-bold ${pctColor}`}>{pct}%</p>
                        <p className="text-[10px] text-slate-400">{totalMarks}/{maxMarks}</p>
                      </div>
                    )}
                  </div>
                  {examGrades.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs text-slate-500">Subject</th>
                          <th className="text-center px-3 py-2 text-xs text-slate-500">Max</th>
                          <th className="text-center px-3 py-2 text-xs text-slate-500">Obtained</th>
                          <th className="text-center px-3 py-2 text-xs text-slate-500">%</th>
                          <th className="text-center px-3 py-2 text-xs text-slate-500">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {examGrades.map((g: any) => {
                          const subPct = g.examSubject?.maxMarks > 0 ? Math.round((g.marksObtained / g.examSubject.maxMarks) * 100) : 0;
                          const fail = g.examSubject?.passingMarks && g.marksObtained < g.examSubject.passingMarks;
                          return (
                            <tr key={g.id} className={fail ? 'bg-red-50' : ''}>
                              <td className="px-4 py-2.5 font-medium text-slate-900">{g.examSubject?.subject?.name || '—'}</td>
                              <td className="text-center px-3 py-2.5 text-slate-500">{g.examSubject?.maxMarks}</td>
                              <td className={`text-center px-3 py-2.5 font-bold ${fail ? 'text-red-600' : 'text-slate-900'}`}>{g.marksObtained}</td>
                              <td className="text-center px-3 py-2.5">{subPct}%</td>
                              <td className="text-center px-3 py-2.5 font-bold">{g.grade || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="px-5 py-4 text-sm text-slate-400">Results not yet published</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
