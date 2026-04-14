'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Plus } from 'lucide-react';

export default function ExamsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'MIDTERM', classId: '', startDate: '', endDate: '',
  });

  useEffect(() => {
    Promise.all([
      api.get('/exams').then(res => setExams(res.data)),
      api.get('/classes').then(res => setClasses(res.data)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/exams', form);
      setShowForm(false);
      setForm({ name: '', type: 'MIDTERM', classId: '', startDate: '', endDate: '' });
      const { data } = await api.get('/exams');
      setExams(data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create exam');
    }
  };

  const typeColors: Record<string, string> = {
    MIDTERM: 'bg-blue-100 text-blue-700',
    FINAL: 'bg-purple-100 text-purple-700',
    QUIZ: 'bg-green-100 text-green-700',
    UNIT_TEST: 'bg-orange-100 text-orange-700',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Exams</h1>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="h-4 w-4" /> Create Exam
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Create New Exam</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <input placeholder="Exam Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                <option value="MIDTERM">Midterm</option>
                <option value="FINAL">Final</option>
                <option value="QUIZ">Quiz</option>
                <option value="UNIT_TEST">Unit Test</option>
              </select>
              <select value={form.classId} onChange={e => setForm({...form, classId: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required>
                <option value="">Select Class</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="date" placeholder="Start Date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
              <input type="date" placeholder="End Date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Create</button>
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
                <p className="text-sm text-slate-500">
                  {formatDate(exam.startDate)} - {formatDate(exam.endDate)}
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  {exam.examSubjects?.length || 0} subjects
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
