'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ShieldAlert, Plus, X, Trash2, ThumbsUp, ThumbsDown, MinusCircle } from 'lucide-react';

const TYPE_BADGE: Record<string, string> = {
  POSITIVE: 'bg-emerald-100 text-emerald-700',
  NEGATIVE: 'bg-red-100 text-red-700',
  NEUTRAL: 'bg-slate-100 text-slate-700',
};

const TYPE_ICON: Record<string, any> = {
  POSITIVE: ThumbsUp,
  NEGATIVE: ThumbsDown,
  NEUTRAL: MinusCircle,
};

export default function TeacherBehaviourPage() {
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    studentId: '', type: 'NEUTRAL', category: '', description: '',
    date: new Date().toISOString().slice(0, 10), severity: 1, parentNotified: true,
  });

  useEffect(() => {
    if (!user) return;
    api.get('/teachers/me', { params: { userId: user.id } }).then(r => setTeacher(r.data));
  }, [user]);

  const load = async () => {
    if (!teacher) return;
    const { data } = await api.get('/behaviour', { params: { teacherId: teacher.id } });
    setLogs(data);
  };

  useEffect(() => {
    if (!teacher) return;
    load();
    // students from class teacher's sections
    const sectionIds = teacher.classSections?.map((s: any) => s.id) || [];
    if (sectionIds.length === 0) { setStudents([]); return; }
    Promise.all(sectionIds.map((sid: string) => api.get('/students', { params: { sectionId: sid } })))
      .then(rs => setStudents(rs.flatMap(r => r.data)));
  }, [teacher]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;
    try {
      await api.post('/behaviour', { ...form, teacherId: teacher.id });
      setShowForm(false);
      setForm({ studentId: '', type: 'NEUTRAL', category: '', description: '', date: new Date().toISOString().slice(0, 10), severity: 1, parentNotified: true });
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to log behaviour');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await api.delete(`/behaviour/${id}`);
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Behaviour Log</h1>
              <p className="text-sm text-slate-500">{logs.length} entries</p>
            </div>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
            <Plus className="h-4 w-4" /> New entry
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            No behaviour logs yet.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map(l => {
              const Icon = TYPE_ICON[l.type];
              return (
                <div key={l.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 flex-shrink-0 ${l.type === 'POSITIVE' ? 'text-emerald-500' : l.type === 'NEGATIVE' ? 'text-red-500' : 'text-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900">
                          {l.student.user.firstName} {l.student.user.lastName}
                        </h3>
                        <span className="text-xs text-slate-500">{l.student.class.name} {l.student.section.name}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${TYPE_BADGE[l.type]}`}>{l.type}</span>
                        <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{l.category}</span>
                        {l.severity > 1 && <span className="text-xs text-red-600">Severity: {l.severity}/5</span>}
                      </div>
                      <p className="text-sm text-slate-700 mt-2">{l.description}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-2">
                        <span>{formatDate(l.date)}</span>
                        {l.parentNotified && <span className="text-emerald-600">Parent notified</span>}
                      </div>
                    </div>
                    <button onClick={() => remove(l.id)} className="p-1 rounded hover:bg-red-50 transition">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <form onSubmit={submit} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Log behaviour</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <select required value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                <option value="">Select student *</option>
                {students.map((s: any) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                  <option value="POSITIVE">Positive</option>
                  <option value="NEUTRAL">Neutral</option>
                  <option value="NEGATIVE">Negative</option>
                </select>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              </div>
              <input
                required
                placeholder="Category (e.g. Discipline, Helpfulness, Academic) *"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
              <textarea
                required
                placeholder="Describe what happened *"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
              {form.type === 'NEGATIVE' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Severity (1-5)</label>
                  <input type="number" min={1} max={5} value={form.severity} onChange={e => setForm({ ...form, severity: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.parentNotified} onChange={e => setForm({ ...form, parentNotified: e.target.checked })} />
                Make visible to parent
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Save</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
