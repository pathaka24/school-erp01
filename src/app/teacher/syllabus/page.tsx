'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate, getCurrentAcademicYear, getAcademicYears } from '@/lib/utils';
import { Plus, Trash2, BookOpen, CheckCircle2, Circle, Clock, Pencil, X } from 'lucide-react';

type Topic = {
  id: string;
  chapter: string | null;
  name: string;
  description: string | null;
  expectedDate: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  completedDate: string | null;
  order: number;
};

type Syllabus = {
  id: string;
  classId: string;
  subjectId: string;
  academicYear: string;
  class: { id: string; name: string };
  subject: { id: string; name: string; code: string };
  topics: Topic[];
};

export default function TeacherSyllabusPage() {
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<any>(null);
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Topic form
  const [topicForm, setTopicForm] = useState<{ chapter: string; name: string; description: string; expectedDate: string }>({
    chapter: '', name: '', description: '', expectedDate: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get('/teachers/me', { params: { userId: user.id } })
      .then(res => setTeacher(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  // Distinct classes the teacher teaches
  const myClasses = useMemo(() => {
    if (!teacher?.subjects) return [];
    return Array.from(new Map(teacher.subjects.map((s: any) => [s.classId, s.class])).values()) as any[];
  }, [teacher]);

  // Subjects this teacher teaches in the selected class
  const classSubjects = useMemo(() => {
    if (!teacher?.subjects) return [];
    return teacher.subjects.filter((s: any) => s.classId === classId);
  }, [teacher, classId]);

  // Auto-load or offer-to-create syllabus when filters chosen
  useEffect(() => {
    if (!classId || !subjectId || !academicYear) {
      setSyllabus(null);
      return;
    }
    api.get('/syllabus', { params: { classId, subjectId, academicYear } })
      .then(res => {
        setSyllabus(res.data[0] || null);
      })
      .catch(() => setSyllabus(null));
  }, [classId, subjectId, academicYear]);

  const createSyllabus = async () => {
    if (!classId || !subjectId || !academicYear) return;
    setBusy(true);
    try {
      const res = await api.post('/syllabus', { classId, subjectId, academicYear });
      setSyllabus({ ...res.data, topics: [] });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create syllabus');
    } finally {
      setBusy(false);
    }
  };

  const reloadSyllabus = async () => {
    if (!syllabus) return;
    const res = await api.get(`/syllabus/${syllabus.id}`);
    setSyllabus(res.data);
  };

  const submitTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syllabus || !topicForm.name.trim()) return;
    setBusy(true);
    try {
      if (editingId) {
        await api.put(`/syllabus/topics/${editingId}`, {
          chapter: topicForm.chapter,
          name: topicForm.name,
          description: topicForm.description,
          expectedDate: topicForm.expectedDate,
        });
        setEditingId(null);
      } else {
        await api.post(`/syllabus/${syllabus.id}/topics`, {
          chapter: topicForm.chapter,
          name: topicForm.name,
          description: topicForm.description,
          expectedDate: topicForm.expectedDate,
        });
      }
      setTopicForm({ chapter: '', name: '', description: '', expectedDate: '' });
      await reloadSyllabus();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save topic');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (t: Topic) => {
    setEditingId(t.id);
    setTopicForm({
      chapter: t.chapter || '',
      name: t.name,
      description: t.description || '',
      expectedDate: t.expectedDate ? t.expectedDate.slice(0, 10) : '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTopicForm({ chapter: '', name: '', description: '', expectedDate: '' });
  };

  const setStatus = async (topic: Topic, status: Topic['status']) => {
    await api.put(`/syllabus/topics/${topic.id}`, { status });
    await reloadSyllabus();
  };

  const deleteTopic = async (id: string) => {
    if (!confirm('Delete this topic?')) return;
    await api.delete(`/syllabus/topics/${id}`);
    await reloadSyllabus();
  };

  const stats = useMemo(() => {
    if (!syllabus) return { total: 0, completed: 0, inProgress: 0, pending: 0, pct: 0 };
    const total = syllabus.topics.length;
    const completed = syllabus.topics.filter(t => t.status === 'COMPLETED').length;
    const inProgress = syllabus.topics.filter(t => t.status === 'IN_PROGRESS').length;
    const pending = total - completed - inProgress;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, pending, pct };
  }, [syllabus]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Syllabus</h1>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
              <select
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              >
                {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select
                value={classId}
                onChange={e => { setClassId(e.target.value); setSubjectId(''); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="">Select class</option>
                {myClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <select
                value={subjectId}
                onChange={e => setSubjectId(e.target.value)}
                disabled={!classId}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-50"
              >
                <option value="">Select subject</option>
                {classSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Empty state — offer to create */}
        {classId && subjectId && !syllabus && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 mb-4">No syllabus exists for this class, subject and year.</p>
            <button
              onClick={createSyllabus}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Create syllabus
            </button>
          </div>
        )}

        {/* Syllabus content */}
        {syllabus && (
          <>
            {/* Coverage stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Topics" value={stats.total} color="bg-slate-500" icon={BookOpen} />
              <StatCard label="Completed" value={stats.completed} color="bg-emerald-500" icon={CheckCircle2} />
              <StatCard label="In progress" value={stats.inProgress} color="bg-amber-500" icon={Clock} />
              <StatCard label="Coverage" value={`${stats.pct}%`} color="bg-blue-500" icon={CheckCircle2} />
            </div>

            {/* Add / edit topic form */}
            <form onSubmit={submitTopic} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingId ? 'Edit topic' : 'Add topic'}
                </h2>
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
                    <X className="h-4 w-4" /> Cancel edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  placeholder="Chapter (e.g. Ch 4)"
                  value={topicForm.chapter}
                  onChange={e => setTopicForm({ ...topicForm, chapter: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
                <input
                  placeholder="Topic name *"
                  required
                  value={topicForm.name}
                  onChange={e => setTopicForm({ ...topicForm, name: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900 md:col-span-2"
                />
                <input
                  type="date"
                  value={topicForm.expectedDate}
                  onChange={e => setTopicForm({ ...topicForm, expectedDate: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
              <textarea
                placeholder="Description / notes (optional)"
                value={topicForm.description}
                onChange={e => setTopicForm({ ...topicForm, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> {editingId ? 'Save changes' : 'Add topic'}
                </button>
              </div>
            </form>

            {/* Topics list */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                {syllabus.subject.name} — {syllabus.class.name} ({syllabus.academicYear})
              </h2>
              {syllabus.topics.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No topics yet. Add your first topic above.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {syllabus.topics.map((t, idx) => (
                    <TopicRow
                      key={t.id}
                      topic={t}
                      index={idx + 1}
                      onSetStatus={setStatus}
                      onEdit={() => startEdit(t)}
                      onDelete={() => deleteTopic(t.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function TopicRow({ topic, index, onSetStatus, onEdit, onDelete }: {
  topic: Topic;
  index: number;
  onSetStatus: (t: Topic, s: Topic['status']) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusBadge = topic.status === 'COMPLETED'
    ? 'bg-emerald-100 text-emerald-700'
    : topic.status === 'IN_PROGRESS'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-600';

  return (
    <li className="py-3 flex items-start gap-4">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {topic.chapter && (
            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {topic.chapter}
            </span>
          )}
          <h3 className="font-medium text-slate-900">{topic.name}</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusBadge}`}>
            {topic.status.replace('_', ' ')}
          </span>
        </div>
        {topic.description && (
          <p className="text-sm text-slate-600 mt-1">{topic.description}</p>
        )}
        <div className="flex gap-3 text-xs text-slate-500 mt-1">
          {topic.expectedDate && <span>Expected: {formatDate(topic.expectedDate)}</span>}
          {topic.completedDate && <span>Completed: {formatDate(topic.completedDate)}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onSetStatus(topic, topic.status === 'PENDING' ? 'IN_PROGRESS' : 'PENDING')}
          title="Toggle In Progress"
          className="p-1.5 rounded hover:bg-slate-100 transition"
        >
          {topic.status === 'IN_PROGRESS'
            ? <Clock className="h-4 w-4 text-amber-500" />
            : <Circle className="h-4 w-4 text-slate-400" />}
        </button>
        <button
          onClick={() => onSetStatus(topic, topic.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
          title={topic.status === 'COMPLETED' ? 'Mark Pending' : 'Mark Completed'}
          className="p-1.5 rounded hover:bg-slate-100 transition"
        >
          <CheckCircle2 className={`h-4 w-4 ${topic.status === 'COMPLETED' ? 'text-emerald-500' : 'text-slate-300'}`} />
        </button>
        <button onClick={onEdit} className="p-1.5 rounded hover:bg-slate-100 transition">
          <Pencil className="h-4 w-4 text-slate-500" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 transition">
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
      </div>
    </li>
  );
}
