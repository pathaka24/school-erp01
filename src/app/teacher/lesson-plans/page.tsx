'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';

export default function TeacherLessonPlansPage() {
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    classId: '', sectionId: '', subjectId: '', date: '', topic: '',
    objectives: '', content: '', homework: '', resources: '',
  });

  useEffect(() => {
    if (!user) return;
    api.get('/teachers/me', { params: { userId: user.id } })
      .then(res => setTeacher(res.data))
      .catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!teacher) return;
    fetchPlans();
  }, [teacher]);

  const fetchPlans = async () => {
    if (!teacher) return;
    const { data } = await api.get('/lesson-plans', { params: { teacherId: teacher.id } });
    setPlans(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/lesson-plans', { ...form, teacherId: teacher.id });
      setShowForm(false);
      setForm({ classId: '', sectionId: '', subjectId: '', date: '', topic: '', objectives: '', content: '', homework: '', resources: '' });
      fetchPlans();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create lesson plan');
    }
  };

  const toggleStatus = async (plan: any) => {
    const newStatus = plan.status === 'PLANNED' ? 'COMPLETED' : 'PLANNED';
    await api.put(`/lesson-plans/${plan.id}`, { status: newStatus });
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lesson plan?')) return;
    await api.delete(`/lesson-plans/${id}`);
    fetchPlans();
  };

  // Classes & sections this teacher has
  const myClasses = teacher?.subjects
    ? Array.from(new Map(teacher.subjects.map((s: any) => [s.classId, s.class])).values()) as any[]
    : [];
  const selectedClassSections = teacher?.classSections?.filter((s: any) => s.classId === form.classId) || [];
  const classSubjects = teacher?.subjects?.filter((s: any) => s.classId === form.classId) || [];

  const statusColors: Record<string, string> = {
    PLANNED: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Lesson Plans</h1>
            <p className="text-slate-500">{plans.length} total plans</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="h-4 w-4" /> New Plan
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Create Lesson Plan</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value, sectionId: '', subjectId: '' })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required>
                  <option value="">Select Class</option>
                  {myClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={form.sectionId} onChange={e => setForm({ ...form, sectionId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required>
                  <option value="">Select Section</option>
                  {selectedClassSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required>
                  <option value="">Select Subject</option>
                  {classSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
              </div>
              <input placeholder="Topic *" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" required />
              <textarea placeholder="Learning Objectives" value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              <textarea placeholder="Lesson Content / Activities" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <textarea placeholder="Homework" value={form.homework} onChange={e => setForm({ ...form, homework: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                <textarea placeholder="Resources / Materials" value={form.resources} onChange={e => setForm({ ...form, resources: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Create</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Plans list */}
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            No lesson plans yet. Create your first one!
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map(plan => (
              <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900 text-lg">{plan.topic}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[plan.status]}`}>
                        {plan.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mb-3">
                      <span>{plan.class?.name} — Section {plan.section?.name}</span>
                      <span>{plan.subject?.name} ({plan.subject?.code})</span>
                      <span>{formatDate(plan.date)}</span>
                    </div>
                    {plan.objectives && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-slate-400 uppercase">Objectives</p>
                        <p className="text-sm text-slate-700">{plan.objectives}</p>
                      </div>
                    )}
                    {plan.content && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-slate-400 uppercase">Content</p>
                        <p className="text-sm text-slate-700">{plan.content}</p>
                      </div>
                    )}
                    {plan.homework && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-slate-400 uppercase">Homework</p>
                        <p className="text-sm text-slate-700">{plan.homework}</p>
                      </div>
                    )}
                    {plan.resources && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase">Resources</p>
                        <p className="text-sm text-slate-700">{plan.resources}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => toggleStatus(plan)} title={plan.status === 'PLANNED' ? 'Mark Completed' : 'Mark Planned'} className="p-1.5 rounded hover:bg-slate-100 transition">
                      {plan.status === 'COMPLETED'
                        ? <XCircle className="h-5 w-5 text-slate-400" />
                        : <CheckCircle className="h-5 w-5 text-green-500" />}
                    </button>
                    <button onClick={() => handleDelete(plan.id)} className="p-1.5 rounded hover:bg-red-50 transition">
                      <Trash2 className="h-5 w-5 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
