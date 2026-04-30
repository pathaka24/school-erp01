'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { BookOpen, Save, Trash2, Sparkles, Frown, Meh, Smile, Coffee, ChevronDown, ChevronUp } from 'lucide-react';

const MOOD_OPTIONS: { value: 'HAPPY' | 'NEUTRAL' | 'TIRED' | 'STRESSED'; label: string; icon: any; color: string }[] = [
  { value: 'HAPPY',    label: 'Great',    icon: Smile,    color: '#16a34a' },
  { value: 'NEUTRAL',  label: 'Okay',     icon: Meh,      color: '#64748b' },
  { value: 'TIRED',    label: 'Tired',    icon: Coffee,   color: '#d97706' },
  { value: 'STRESSED', label: 'Stressed', icon: Frown,    color: '#dc2626' },
];

function todayISO() { return new Date().toISOString().slice(0, 10); }

type DailyLog = {
  id: string;
  date: string;
  summary: string | null;
  periodsTaught: number | null;
  highlights: string | null;
  concerns: string | null;
  tomorrowPlan: string | null;
  mood: 'HAPPY' | 'NEUTRAL' | 'TIRED' | 'STRESSED' | null;
  signature: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function TeacherDailyLogPage() {
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<any>(null);
  const [history, setHistory] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Today's form state
  const [form, setForm] = useState({
    date: todayISO(),
    summary: '',
    periodsTaught: '',
    highlights: '',
    concerns: '',
    tomorrowPlan: '',
    mood: '' as '' | 'HAPPY' | 'NEUTRAL' | 'TIRED' | 'STRESSED',
    signature: '',
  });

  const loadTeacher = useCallback(async () => {
    if (!user) return;
    const { data } = await api.get('/teachers/me', { params: { userId: user.id } });
    setTeacher(data);
  }, [user]);

  const loadHistory = useCallback(async (tId: string) => {
    const { data } = await api.get('/teacher-daily-log', { params: { teacherId: tId } });
    setHistory(data);

    // If there's an entry for the chosen date, prefill the form
    const existing = data.find((d: DailyLog) => d.date.slice(0, 10) === form.date);
    if (existing) {
      setForm({
        date: existing.date.slice(0, 10),
        summary: existing.summary || '',
        periodsTaught: existing.periodsTaught != null ? String(existing.periodsTaught) : '',
        highlights: existing.highlights || '',
        concerns: existing.concerns || '',
        tomorrowPlan: existing.tomorrowPlan || '',
        mood: (existing.mood as any) || '',
        signature: existing.signature || '',
      });
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date]);

  useEffect(() => { loadTeacher(); }, [loadTeacher]);
  useEffect(() => { if (teacher) loadHistory(teacher.id); }, [teacher, loadHistory]);

  const onDateChange = async (newDate: string) => {
    setForm(f => ({ ...f, date: newDate }));
    if (!teacher) return;
    const existing = history.find(d => d.date.slice(0, 10) === newDate);
    if (existing) {
      setForm({
        date: newDate,
        summary: existing.summary || '',
        periodsTaught: existing.periodsTaught != null ? String(existing.periodsTaught) : '',
        highlights: existing.highlights || '',
        concerns: existing.concerns || '',
        tomorrowPlan: existing.tomorrowPlan || '',
        mood: (existing.mood as any) || '',
        signature: existing.signature || '',
      });
    } else {
      setForm({
        date: newDate, summary: '', periodsTaught: '', highlights: '', concerns: '', tomorrowPlan: '', mood: '', signature: '',
      });
    }
  };

  const save = async () => {
    if (!teacher) return;
    setSaving(true);
    try {
      await api.post('/teacher-daily-log', {
        teacherId: teacher.id,
        date: form.date,
        summary: form.summary,
        periodsTaught: form.periodsTaught ? Number(form.periodsTaught) : null,
        highlights: form.highlights,
        concerns: form.concerns,
        tomorrowPlan: form.tomorrowPlan,
        mood: form.mood || null,
        signature: form.signature,
      });
      await loadHistory(teacher.id);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await api.delete(`/teacher-daily-log/${id}`);
    if (teacher) loadHistory(teacher.id);
  };

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
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Daily Log Book</h1>
            <p className="text-sm text-slate-500">Your personal daily teaching diary</p>
          </div>
        </div>

        {/* Today / pick date editor */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Entry for:</label>
              <input
                type="date"
                value={form.date}
                max={todayISO()}
                onChange={e => onDateChange(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 text-sm"
              />
              {form.date === todayISO() && (
                <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Today</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {savedFlash && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save entry'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Periods taught</label>
              <input
                type="number"
                min={0}
                max={20}
                value={form.periodsTaught}
                onChange={e => setForm({ ...form, periodsTaught: e.target.value })}
                placeholder="e.g. 6"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">How was your day?</label>
              <div className="flex gap-2">
                {MOOD_OPTIONS.map(m => {
                  const Icon = m.icon;
                  const active = form.mood === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setForm({ ...form, mood: active ? '' : m.value })}
                      className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-lg border transition ${
                        active ? 'border-2' : 'border'
                      }`}
                      style={{
                        backgroundColor: active ? m.color + '22' : '#fff',
                        borderColor: active ? m.color : '#e2e8f0',
                      }}
                    >
                      <Icon className="h-5 w-5" style={{ color: active ? m.color : '#94a3b8' }} />
                      <span className="text-xs font-medium" style={{ color: active ? m.color : '#64748b' }}>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Summary of the day</label>
            <textarea
              value={form.summary}
              onChange={e => setForm({ ...form, summary: e.target.value })}
              placeholder="What happened today? Topics covered, classes attended, events..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-emerald-500" /> Highlights
              </label>
              <textarea
                value={form.highlights}
                onChange={e => setForm({ ...form, highlights: e.target.value })}
                placeholder="Positive moments, student wins, breakthroughs..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Concerns / Issues</label>
              <textarea
                value={form.concerns}
                onChange={e => setForm({ ...form, concerns: e.target.value })}
                placeholder="Issues to escalate, students needing attention..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Plan for tomorrow</label>
            <textarea
              value={form.tomorrowPlan}
              onChange={e => setForm({ ...form, tomorrowPlan: e.target.value })}
              placeholder="What to prepare, topics to cover, materials needed..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Signature / Initials</label>
            <input
              value={form.signature}
              onChange={e => setForm({ ...form, signature: e.target.value })}
              placeholder="Type your initials"
              className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-serif italic"
            />
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Past entries ({history.length})</h2>
          {history.length === 0 ? (
            <p className="text-center py-8 text-slate-400">No entries yet. Fill in today&apos;s entry above and click Save.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map(h => {
                const expanded = expandedId === h.id;
                const moodOpt = MOOD_OPTIONS.find(m => m.value === h.mood);
                const MoodIcon = moodOpt?.icon;
                return (
                  <li key={h.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => setExpandedId(expanded ? null : h.id)}
                          className="flex items-center gap-2 text-left"
                        >
                          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          <span className="font-medium text-slate-900">{formatDate(h.date)}</span>
                          {moodOpt && MoodIcon && (
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: moodOpt.color + '22', color: moodOpt.color }}>
                              <MoodIcon className="h-3 w-3" /> {moodOpt.label}
                            </span>
                          )}
                          {h.periodsTaught != null && (
                            <span className="text-xs text-slate-500">· {h.periodsTaught} periods</span>
                          )}
                        </button>
                        {!expanded && h.summary && (
                          <p className="text-sm text-slate-600 mt-1 ml-6 line-clamp-1">{h.summary}</p>
                        )}
                        {expanded && (
                          <div className="ml-6 mt-2 space-y-2 text-sm">
                            {h.summary && <Detail label="Summary" value={h.summary} />}
                            {h.highlights && <Detail label="Highlights" value={h.highlights} color="text-emerald-700" />}
                            {h.concerns && <Detail label="Concerns" value={h.concerns} color="text-red-700" />}
                            {h.tomorrowPlan && <Detail label="Tomorrow's plan" value={h.tomorrowPlan} />}
                            {h.signature && <p className="text-sm font-serif italic text-slate-500 mt-2">— {h.signature}</p>}
                          </div>
                        )}
                      </div>
                      <button onClick={() => remove(h.id)} className="p-1.5 rounded hover:bg-red-50 transition flex-shrink-0">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function Detail({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`whitespace-pre-wrap ${color || 'text-slate-700'}`}>{value}</p>
    </div>
  );
}
