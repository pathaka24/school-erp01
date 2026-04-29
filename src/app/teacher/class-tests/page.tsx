'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Plus, Trash2, Pencil, ClipboardCheck, FileText, X } from 'lucide-react';

type ClassTest = {
  id: string;
  name: string;
  description: string | null;
  date: string;
  maxMarks: number;
  classId: string;
  sectionId: string;
  subjectId: string;
  syllabusTopicId: string | null;
  class: { id: string; name: string };
  section: { id: string; name: string };
  subject: { id: string; name: string; code: string };
  syllabusTopic: { id: string; name: string; chapter: string | null } | null;
  _count?: { marks: number };
};

type Student = {
  id: string;
  user: { firstName: string; lastName: string };
  rollNumber: string | null;
};

export default function TeacherClassTestsPage() {
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<any>(null);
  const [tests, setTests] = useState<ClassTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    classId: '',
    sectionId: '',
    subjectId: '',
    name: '',
    description: '',
    date: '',
    maxMarks: 20,
    syllabusTopicId: '',
  });
  const [topics, setTopics] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Marks panel
  const [marksTest, setMarksTest] = useState<ClassTest | null>(null);
  const [marksStudents, setMarksStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, { marksObtained: string | number; remarks: string }>>({});
  const [savingMarks, setSavingMarks] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get('/teachers/me', { params: { userId: user.id } })
      .then(res => setTeacher(res.data))
      .catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!teacher) return;
    fetchTests();
  }, [teacher]);

  const fetchTests = async () => {
    setLoading(true);
    const { data } = await api.get('/class-tests', { params: { teacherId: teacher.id } });
    setTests(data);
    setLoading(false);
  };

  const myClasses = useMemo(() => {
    if (!teacher?.subjects) return [];
    return Array.from(new Map(teacher.subjects.map((s: any) => [s.classId, s.class])).values()) as any[];
  }, [teacher]);

  const formClassSections = useMemo(() => {
    return teacher?.classSections?.filter((s: any) => s.classId === form.classId) || [];
  }, [teacher, form.classId]);

  const formClassSubjects = useMemo(() => {
    return teacher?.subjects?.filter((s: any) => s.classId === form.classId) || [];
  }, [teacher, form.classId]);

  // Load topics when class+subject are picked in the form
  useEffect(() => {
    if (!form.classId || !form.subjectId) { setTopics([]); return; }
    const acadYear = (() => {
      const n = new Date(); const y = n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1;
      return `${y}-${y + 1}`;
    })();
    api.get('/syllabus', { params: { classId: form.classId, subjectId: form.subjectId, academicYear: acadYear } })
      .then(res => {
        const syllabus = res.data[0];
        setTopics(syllabus?.topics || []);
      })
      .catch(() => setTopics([]));
  }, [form.classId, form.subjectId]);

  const resetForm = () => {
    setForm({ classId: '', sectionId: '', subjectId: '', name: '', description: '', date: '', maxMarks: 20, syllabusTopicId: '' });
    setEditingId(null);
  };

  const submitTest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/class-tests/${editingId}`, {
          name: form.name,
          description: form.description,
          date: form.date,
          maxMarks: form.maxMarks,
          syllabusTopicId: form.syllabusTopicId || null,
        });
      } else {
        await api.post('/class-tests', {
          teacherId: teacher.id,
          ...form,
          syllabusTopicId: form.syllabusTopicId || null,
        });
      }
      resetForm();
      setShowForm(false);
      fetchTests();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save test');
    }
  };

  const startEdit = (t: ClassTest) => {
    setEditingId(t.id);
    setForm({
      classId: t.classId,
      sectionId: t.sectionId,
      subjectId: t.subjectId,
      name: t.name,
      description: t.description || '',
      date: t.date.slice(0, 10),
      maxMarks: t.maxMarks,
      syllabusTopicId: t.syllabusTopicId || '',
    });
    setShowForm(true);
  };

  const deleteTest = async (id: string) => {
    if (!confirm('Delete this class test and all its marks?')) return;
    await api.delete(`/class-tests/${id}`);
    fetchTests();
  };

  const openMarks = async (test: ClassTest) => {
    setMarksTest(test);
    const [studentsRes, detailRes] = await Promise.all([
      api.get('/students', { params: { sectionId: test.sectionId } }),
      api.get(`/class-tests/${test.id}`),
    ]);
    setMarksStudents(studentsRes.data);
    const existing: Record<string, any> = {};
    detailRes.data.marks?.forEach((m: any) => {
      existing[m.studentId] = { marksObtained: m.marksObtained, remarks: m.remarks || '' };
    });
    setMarks(existing);
  };

  const closeMarks = () => {
    setMarksTest(null);
    setMarksStudents([]);
    setMarks({});
  };

  const saveMarks = async () => {
    if (!marksTest) return;
    setSavingMarks(true);
    try {
      const payload = Object.entries(marks)
        .filter(([, v]) => v.marksObtained !== '' && v.marksObtained !== null && v.marksObtained !== undefined)
        .map(([studentId, v]) => ({
          studentId,
          marksObtained: Number(v.marksObtained),
          remarks: v.remarks || null,
        }));
      await api.post(`/class-tests/${marksTest.id}/marks`, { marks: payload });
      alert('Marks saved');
      fetchTests();
      closeMarks();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save marks');
    } finally {
      setSavingMarks(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Class Tests</h1>
              <p className="text-slate-500 text-sm">{tests.length} total tests</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" /> New test
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={submitTest} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Edit class test' : 'Create class test'}
              </h2>
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                required
                disabled={!!editingId}
                value={form.classId}
                onChange={e => setForm({ ...form, classId: e.target.value, sectionId: '', subjectId: '', syllabusTopicId: '' })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-50"
              >
                <option value="">Class *</option>
                {myClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                required
                disabled={!!editingId || !form.classId}
                value={form.sectionId}
                onChange={e => setForm({ ...form, sectionId: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-50"
              >
                <option value="">Section *</option>
                {formClassSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select
                required
                disabled={!!editingId || !form.classId}
                value={form.subjectId}
                onChange={e => setForm({ ...form, subjectId: e.target.value, syllabusTopicId: '' })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-50"
              >
                <option value="">Subject *</option>
                {formClassSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                required
                placeholder="Test name (e.g. Ch 4 Unit Test) *"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
              <input
                required
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                required
                type="number"
                min={1}
                placeholder="Max marks *"
                value={form.maxMarks}
                onChange={e => setForm({ ...form, maxMarks: Number(e.target.value) })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
              <select
                value={form.syllabusTopicId}
                onChange={e => setForm({ ...form, syllabusTopicId: e.target.value })}
                disabled={topics.length === 0}
                className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-50"
              >
                <option value="">{topics.length === 0 ? 'No syllabus topics for this subject' : 'Link syllabus topic (optional)'}</option>
                {topics.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.chapter ? `${t.chapter} — ` : ''}{t.name}</option>
                ))}
              </select>
            </div>

            <textarea
              placeholder="Description / instructions (optional)"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                {editingId ? 'Save changes' : 'Create test'}
              </button>
            </div>
          </form>
        )}

        {/* Tests list */}
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : tests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            No class tests yet. Create your first one!
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map(t => (
              <div key={t.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 text-lg">{t.name}</h3>
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {t.subject.name} ({t.subject.code})
                      </span>
                      <span className="text-xs text-slate-500">{t.class.name} — {t.section.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-2">
                      <span>{formatDate(t.date)}</span>
                      <span>Max: {t.maxMarks}</span>
                      {t._count && <span>{t._count.marks} marks recorded</span>}
                      {t.syllabusTopic && (
                        <span className="text-blue-700">
                          Topic: {t.syllabusTopic.chapter ? `${t.syllabusTopic.chapter} — ` : ''}{t.syllabusTopic.name}
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-sm text-slate-600 mt-2">{t.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openMarks(t)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                    >
                      <FileText className="h-4 w-4" /> Marks
                    </button>
                    <button onClick={() => startEdit(t)} className="p-1.5 rounded hover:bg-slate-100 transition">
                      <Pencil className="h-5 w-5 text-slate-500" />
                    </button>
                    <button onClick={() => deleteTest(t.id)} className="p-1.5 rounded hover:bg-red-50 transition">
                      <Trash2 className="h-5 w-5 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Marks panel modal */}
      {marksTest && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Enter marks — {marksTest.name}</h2>
                <p className="text-sm text-slate-500">
                  {marksTest.class.name} {marksTest.section.name} · {marksTest.subject.name} · Max {marksTest.maxMarks}
                </p>
              </div>
              <button onClick={closeMarks} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {marksStudents.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No students in this section.</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">#</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Student</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Marks (/{marksTest.maxMarks})</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {marksStudents.map((s, idx) => {
                      const m = marks[s.id] || { marksObtained: '', remarks: '' };
                      return (
                        <tr key={s.id}>
                          <td className="px-3 py-2 text-sm text-slate-500">{s.rollNumber || idx + 1}</td>
                          <td className="px-3 py-2 text-sm text-slate-900">{s.user.firstName} {s.user.lastName}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={marksTest.maxMarks}
                              value={m.marksObtained}
                              onChange={e => setMarks({ ...marks, [s.id]: { ...m, marksObtained: e.target.value } })}
                              className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-slate-900"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={m.remarks}
                              onChange={e => setMarks({ ...marks, [s.id]: { ...m, remarks: e.target.value } })}
                              placeholder="Optional"
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-slate-900"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={closeMarks} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">
                Close
              </button>
              <button
                onClick={saveMarks}
                disabled={savingMarks || marksStudents.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {savingMarks ? 'Saving...' : 'Save marks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
