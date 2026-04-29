'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { FolderOpen, Plus, X, Trash2, ExternalLink, FileText, Video, Link as LinkIcon, FileType, Image as ImageIcon } from 'lucide-react';

const TYPES = ['LINK', 'PDF', 'VIDEO', 'NOTE', 'IMAGE', 'DOC', 'OTHER'];
const TYPE_ICON: Record<string, any> = {
  PDF: FileType, VIDEO: Video, LINK: LinkIcon, NOTE: FileText, IMAGE: ImageIcon, DOC: FileText, OTHER: FileText,
};

export default function TeacherMaterialsPage() {
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ classId: '', subjectId: '', type: 'LINK', title: '', description: '', url: '' });

  useEffect(() => {
    if (!user) return;
    api.get('/teachers/me', { params: { userId: user.id } }).then(r => setTeacher(r.data));
  }, [user]);

  const load = async () => {
    if (!teacher) return;
    const { data } = await api.get('/study-materials', { params: { teacherId: teacher.id } });
    setMaterials(data);
  };

  useEffect(() => { load(); }, [teacher]);

  const myClasses = useMemo(() => {
    if (!teacher?.subjects) return [];
    return Array.from(new Map(teacher.subjects.map((s: any) => [s.classId, s.class])).values()) as any[];
  }, [teacher]);

  const formSubjects = useMemo(() => {
    return teacher?.subjects?.filter((s: any) => s.classId === form.classId) || [];
  }, [teacher, form.classId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;
    try {
      await api.post('/study-materials', { ...form, teacherId: teacher.id });
      setForm({ classId: '', subjectId: '', type: 'LINK', title: '', description: '', url: '' });
      setShowForm(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add material');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this material?')) return;
    await api.delete(`/study-materials/${id}`);
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Study Materials</h1>
              <p className="text-sm text-slate-500">{materials.length} items shared</p>
            </div>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
            <Plus className="h-4 w-4" /> Add material
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>Tip:</strong> Upload your file to Google Drive, Dropbox, or OneDrive — set sharing to &ldquo;Anyone with link&rdquo; — then paste the link here. Direct file upload requires Supabase Storage setup.
        </div>

        {materials.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            No materials shared yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {materials.map(m => {
              const Icon = TYPE_ICON[m.type] || FileText;
              return (
                <div key={m.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900">{m.title}</h3>
                        <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{m.type}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {m.class.name} · {m.subject.name} · {formatDate(m.createdAt)}
                      </p>
                      {m.description && <p className="text-sm text-slate-600 mt-2">{m.description}</p>}
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-700">
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <button onClick={() => remove(m.id)} className="p-1 rounded hover:bg-red-50 transition">
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
                <h2 className="text-lg font-semibold text-slate-900">Share material</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <input required placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              <div className="grid grid-cols-2 gap-3">
                <select required value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value, subjectId: '' })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                  <option value="">Class *</option>
                  {myClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select required value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })} disabled={!form.classId} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-50">
                  <option value="">Subject *</option>
                  {formSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input required type="url" placeholder="URL (Google Drive / Dropbox / YouTube...) *" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Share</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
