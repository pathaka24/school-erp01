'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Plus } from 'lucide-react';

export default function TeacherExamsPage() {
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'UNIT_TEST', classId: '', startDate: '', endDate: '',
    subjects: [] as { subjectId: string; date: string; maxMarks: number; passingMarks: number }[],
  });

  useEffect(() => {
    if (!user) return;
    api.get('/teachers/me', { params: { userId: user.id } })
      .then(res => setTeacher(res.data))
      .catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!teacher) return;
    // Fetch exams for all classes this teacher teaches
    const classIds = [...new Set<string>(teacher.subjects?.map((s: any) => s.classId) || [])];
    Promise.all(classIds.map((cid: string) => api.get('/exams', { params: { classId: cid } })))
      .then(responses => {
        const all = responses.flatMap(r => r.data);
        // Deduplicate by id
        const unique = Array.from(new Map(all.map((e: any) => [e.id, e])).values());
        setExams(unique);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [teacher]);

  const handleAddSubject = () => {
    setForm({
      ...form,
      subjects: [...form.subjects, { subjectId: '', date: form.startDate, maxMarks: 100, passingMarks: 33 }],
    });
  };

  const handleSubjectChange = (idx: number, field: string, value: any) => {
    const updated = [...form.subjects];
    (updated[idx] as any)[field] = value;
    setForm({ ...form, subjects: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/exams', form);
      setShowForm(false);
      setForm({ name: '', type: 'UNIT_TEST', classId: '', startDate: '', endDate: '', subjects: [] });
      // Refresh
      const classIds = [...new Set<string>(teacher.subjects?.map((s: any) => s.classId) || [])];
      const responses = await Promise.all(classIds.map((cid: string) => api.get('/exams', { params: { classId: cid } })));
      const all = responses.flatMap(r => r.data);
      setExams(Array.from(new Map(all.map((e: any) => [e.id, e])).values()));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create exam');
    }
  };

  // Classes this teacher teaches
  const myClasses = teacher?.subjects
    ? Array.from(new Map(teacher.subjects.map((s: any) => [s.classId, s.class])).values()) as any[]
    : [];

  // Subjects for selected class
  const classSubjects = teacher?.subjects?.filter((s: any) => s.classId === form.classId) || [];

  const typeColors: Record<string, string> = {
    FA1: 'bg-teal-100 text-teal-700', FA2: 'bg-cyan-100 text-cyan-700',
    SA1: 'bg-indigo-100 text-indigo-700', SA2: 'bg-violet-100 text-violet-700',
    MIDTERM: 'bg-blue-100 text-blue-700', FINAL: 'bg-purple-100 text-purple-700',
    QUIZ: 'bg-green-100 text-green-700', UNIT_TEST: 'bg-orange-100 text-orange-700',
    ANNUAL: 'bg-red-100 text-red-700',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">My Exams</h1>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="h-4 w-4" /> Create Exam
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Create New Exam</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <input placeholder="Exam Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                  {['FA1', 'FA2', 'SA1', 'SA2', 'MIDTERM', 'FINAL', 'QUIZ', 'UNIT_TEST', 'ANNUAL'].map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
                <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value, subjects: [] })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required>
                  <option value="">Select Class</option>
                  {myClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
                <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
              </div>

              {/* Exam subjects */}
              {form.classId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-700">Exam Subjects</h3>
                    <button type="button" onClick={handleAddSubject} className="text-sm text-blue-600 hover:text-blue-700">+ Add Subject</button>
                  </div>
                  {form.subjects.map((sub, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-3">
                      <select value={sub.subjectId} onChange={e => handleSubjectChange(idx, 'subjectId', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required>
                        <option value="">Select Subject</option>
                        {classSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <input type="date" value={sub.date} onChange={e => handleSubjectChange(idx, 'date', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
                      <input type="number" placeholder="Max Marks" value={sub.maxMarks} onChange={e => handleSubjectChange(idx, 'maxMarks', parseInt(e.target.value) || 0)} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
                      <input type="number" placeholder="Pass Marks" value={sub.passingMarks} onChange={e => handleSubjectChange(idx, 'passingMarks', parseInt(e.target.value) || 0)} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Create Exam</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 text-center py-8 text-slate-400">Loading...</div>
          ) : exams.length === 0 ? (
            <div className="col-span-3 text-center py-8 text-slate-400">No exams found</div>
          ) : (
            exams.map((exam) => (
              <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">{exam.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[exam.type] || 'bg-slate-100 text-slate-700'}`}>
                    {exam.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-500">Class: {exam.class?.name}</p>
                <p className="text-sm text-slate-500">{formatDate(exam.startDate)} — {formatDate(exam.endDate)}</p>
                <p className="text-sm text-slate-400 mt-2">{exam.examSubjects?.length || 0} subjects</p>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
