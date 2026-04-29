'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Calendar as CalendarIcon, Plus, X, Trash2, MapPin, Clock } from 'lucide-react';

const EVENT_TYPES = ['HOLIDAY', 'EXAM', 'PTM', 'EVENT', 'SPORTS', 'CULTURAL', 'ACADEMIC', 'OTHER'];
const TYPE_COLORS: Record<string, string> = {
  HOLIDAY: 'bg-red-100 text-red-700 border-red-300',
  EXAM: 'bg-purple-100 text-purple-700 border-purple-300',
  PTM: 'bg-blue-100 text-blue-700 border-blue-300',
  EVENT: 'bg-amber-100 text-amber-700 border-amber-300',
  SPORTS: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  CULTURAL: 'bg-pink-100 text-pink-700 border-pink-300',
  ACADEMIC: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  OTHER: 'bg-slate-100 text-slate-700 border-slate-300',
};

const AUDIENCE_OPTIONS = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'TEACHERS', label: 'Teachers' },
  { value: 'PARENTS', label: 'Parents' },
  { value: 'STUDENTS', label: 'Students' },
  { value: 'CLASS', label: 'Specific Class' },
  { value: 'SECTION', label: 'Specific Section' },
];

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function ymd(d: Date) { return d.toISOString().slice(0, 10); }

export default function CalendarPage() {
  const { user } = useAuthStore();
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', startDate: '', endDate: '', startTime: '', endTime: '',
    type: 'EVENT', audience: 'ALL', classId: '', sectionId: '', location: '',
  });
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);

  const load = async () => {
    if (!user) return;
    const params: any = {
      from: ymd(monthStart),
      to: ymd(monthEnd),
      role: user.role,
    };
    const { data } = await api.get('/events', { params });
    setEvents(data);
  };

  useEffect(() => { load(); }, [cursor, user]);

  useEffect(() => {
    if (!canEdit) return;
    api.get('/classes').then(r => setClasses(r.data));
  }, [canEdit]);

  useEffect(() => {
    if (form.audience !== 'SECTION' || !form.classId) return;
    const cls = classes.find((c: any) => c.id === form.classId);
    setSections(cls?.sections || []);
  }, [form.audience, form.classId, classes]);

  // Build calendar grid (6 weeks)
  const grid = useMemo(() => {
    const first = new Date(monthStart);
    const startOffset = first.getDay();
    const cells: { date: Date; inMonth: boolean }[] = [];
    const startCell = new Date(first);
    startCell.setDate(first.getDate() - startOffset);
    for (let i = 0; i < 42; i++) {
      const d = new Date(startCell);
      d.setDate(startCell.getDate() + i);
      cells.push({ date: d, inMonth: d.getMonth() === cursor.getMonth() });
    }
    return cells;
  }, [cursor, monthStart]);

  // Group events by date string
  const eventsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const ev of events) {
      const start = new Date(ev.startDate);
      const end = new Date(ev.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        const key = ymd(cur);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [events]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await api.post('/events', { ...form, createdById: user.id });
      setForm({ title: '', description: '', startDate: '', endDate: '', startTime: '', endTime: '', type: 'EVENT', audience: 'ALL', classId: '', sectionId: '', location: '' });
      setShowForm(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create event');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    await api.delete(`/events/${id}`);
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition">
              ←
            </button>
            <button onClick={() => setCursor(new Date())} className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition">
              Today
            </button>
            <span className="font-semibold text-slate-900 px-3 min-w-32 text-center">
              {cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition">
              →
            </button>
            {canEdit && (
              <button onClick={() => setShowForm(true)} className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                <Plus className="h-4 w-4" /> Event
              </button>
            )}
          </div>
        </div>

        {/* Month grid */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="p-2 text-center text-xs font-medium text-slate-500 bg-slate-50">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((cell, idx) => {
              const dayEvents = eventsByDate.get(ymd(cell.date)) || [];
              const isToday = ymd(cell.date) === ymd(new Date());
              return (
                <div key={idx} className={`min-h-24 p-2 border-b border-r border-slate-100 ${cell.inMonth ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <div className={`text-xs font-medium mb-1 ${
                    isToday ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white' :
                    cell.inMonth ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    {cell.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} className={`text-xs px-1.5 py-0.5 rounded truncate border ${TYPE_COLORS[ev.type]}`} title={ev.title}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-slate-400">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event list */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Events this month</h2>
          {events.length === 0 ? (
            <p className="text-sm text-slate-400">No events.</p>
          ) : (
            <ul className="space-y-2">
              {events.map(ev => (
                <li key={ev.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
                  <div className="flex items-start gap-3 flex-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${TYPE_COLORS[ev.type]}`}>{ev.type}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{ev.title}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(ev.startDate)}{ev.startDate !== ev.endDate ? ` – ${formatDate(ev.endDate)}` : ''}</span>
                        {ev.startTime && <span>{ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}</span>}
                        {ev.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {ev.location}</span>}
                        {ev.class && <span>Class: {ev.class.name}{ev.section ? ` ${ev.section.name}` : ''}</span>}
                      </div>
                      {ev.description && <p className="text-xs text-slate-600 mt-1">{ev.description}</p>}
                    </div>
                  </div>
                  {canEdit && (ev.createdById === user?.id || user?.role === 'ADMIN') && (
                    <button onClick={() => remove(ev.id)} className="p-1 rounded hover:bg-red-50 transition">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <form onSubmit={submit} className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">New event</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <input
                required
                placeholder="Event title *"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">From *</label>
                  <input required type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value, endDate: form.endDate || e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">To *</label>
                  <input required type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                </div>
                <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} placeholder="Start time" className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} placeholder="End time" className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value, classId: '', sectionId: '' })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                  {AUDIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {(form.audience === 'CLASS' || form.audience === 'SECTION') && (
                <div className="grid grid-cols-2 gap-3">
                  <select required value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value, sectionId: '' })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                    <option value="">Class</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {form.audience === 'SECTION' && (
                    <select required value={form.sectionId} onChange={e => setForm({ ...form, sectionId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                      <option value="">Section</option>
                      {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>
              )}
              <input
                placeholder="Location"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Create event</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
