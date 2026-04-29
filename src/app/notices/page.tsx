'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Megaphone, Plus, Pin, Trash2, X } from 'lucide-react';

const AUDIENCE_OPTIONS = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'ADMINS', label: 'Admins only' },
  { value: 'TEACHERS', label: 'Teachers only' },
  { value: 'PARENTS', label: 'All Parents' },
  { value: 'STUDENTS', label: 'All Students' },
  { value: 'CLASS', label: 'Specific Class' },
  { value: 'SECTION', label: 'Specific Section' },
];

const AUDIENCE_BADGE: Record<string, string> = {
  ALL: 'bg-blue-100 text-blue-700',
  ADMINS: 'bg-purple-100 text-purple-700',
  TEACHERS: 'bg-indigo-100 text-indigo-700',
  PARENTS: 'bg-green-100 text-green-700',
  STUDENTS: 'bg-amber-100 text-amber-700',
  CLASS: 'bg-cyan-100 text-cyan-700',
  SECTION: 'bg-pink-100 text-pink-700',
};

export default function NoticesPage() {
  const { user } = useAuthStore();
  const [notices, setNotices] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', body: '', audience: 'ALL', classId: '', sectionId: '', isPinned: false, expiresAt: '',
  });
  const canCreate = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const params: any = { role: user.role, userId: user.id };
    const { data } = await api.get('/notices', { params });
    setNotices(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!canCreate) return;
    api.get('/classes').then(r => setClasses(r.data)).catch(() => {});
  }, [canCreate]);

  useEffect(() => {
    if (form.audience !== 'SECTION' || !form.classId) return;
    const cls = classes.find((c: any) => c.id === form.classId);
    setSections(cls?.sections || []);
  }, [form.audience, form.classId, classes]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await api.post('/notices', {
        title: form.title,
        body: form.body,
        audience: form.audience,
        classId: form.audience === 'CLASS' || form.audience === 'SECTION' ? form.classId : null,
        sectionId: form.audience === 'SECTION' ? form.sectionId : null,
        isPinned: form.isPinned,
        expiresAt: form.expiresAt || null,
        authorId: user.id,
      });
      setForm({ title: '', body: '', audience: 'ALL', classId: '', sectionId: '', isPinned: false, expiresAt: '' });
      setShowForm(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to publish notice');
    }
  };

  const togglePin = async (n: any) => {
    await api.put(`/notices/${n.id}`, { isPinned: !n.isPinned });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this notice?')) return;
    await api.delete(`/notices/${id}`);
    load();
  };

  const markRead = async (n: any) => {
    if (n.read || !user) return;
    await api.post(`/notices/${n.id}/read`, { userId: user.id });
    setNotices(notices.map(x => x.id === n.id ? { ...x, read: true } : x));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Megaphone className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Notices</h1>
              <p className="text-sm text-slate-500">{notices.length} notices</p>
            </div>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" /> New notice
            </button>
          )}
        </div>

        {showForm && canCreate && (
          <form onSubmit={submit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Publish notice</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              required
              placeholder="Title *"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
            <textarea
              required
              placeholder="Notice body *"
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={form.audience}
                onChange={e => setForm({ ...form, audience: e.target.value, classId: '', sectionId: '' })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              >
                {AUDIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {(form.audience === 'CLASS' || form.audience === 'SECTION') && (
                <select
                  required
                  value={form.classId}
                  onChange={e => setForm({ ...form, classId: e.target.value, sectionId: '' })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="">Select class</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {form.audience === 'SECTION' && form.classId && (
                <select
                  required
                  value={form.sectionId}
                  onChange={e => setForm({ ...form, sectionId: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="">Select section</option>
                  {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.isPinned} onChange={e => setForm({ ...form, isPinned: e.target.checked })} />
                Pin this notice
              </label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                placeholder="Expires on"
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Publish</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : notices.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            No notices yet.
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map(n => {
              const audLabel = n.audience === 'CLASS' && n.class ? `Class ${n.class.name}`
                : n.audience === 'SECTION' && n.section ? `${n.class?.name} ${n.section.name}`
                : AUDIENCE_OPTIONS.find(a => a.value === n.audience)?.label || n.audience;
              const isAuthor = n.authorId === user?.id;
              return (
                <div
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={`bg-white rounded-xl shadow-sm border p-5 cursor-pointer transition ${
                    n.isPinned ? 'border-amber-300' : 'border-slate-200'
                  } ${user?.role !== 'ADMIN' && user?.role !== 'TEACHER' && !n.read ? 'border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {n.isPinned && <Pin className="h-4 w-4 text-amber-500 fill-amber-500" />}
                        <h3 className="font-semibold text-slate-900 text-lg">{n.title}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${AUDIENCE_BADGE[n.audience]}`}>
                          {audLabel}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{n.body}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-3">
                        <span>By {n.author?.firstName} {n.author?.lastName} ({n.author?.role})</span>
                        <span>· {formatDate(n.publishedAt)}</span>
                        {n.expiresAt && <span>· Expires {formatDate(n.expiresAt)}</span>}
                      </div>
                    </div>
                    {(canCreate && (isAuthor || user?.role === 'ADMIN')) && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); togglePin(n); }} className="p-1.5 rounded hover:bg-slate-100 transition" title={n.isPinned ? 'Unpin' : 'Pin'}>
                          <Pin className={`h-4 w-4 ${n.isPinned ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); remove(n.id); }} className="p-1.5 rounded hover:bg-red-50 transition">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
