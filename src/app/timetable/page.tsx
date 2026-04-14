'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { Calendar, Plus, Trash2, Printer, Save, X, Users } from 'lucide-react';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_SHORT: Record<string, string> = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat' };
const PERIOD_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export default function TimetablePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'class' | 'teacher'>('class');
  const [selectedTeacher, setSelectedTeacher] = useState('');

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [addForm, setAddForm] = useState({ subjectId: '', newSubject: '', teacherId: '', dayOfWeek: 'MONDAY', startTime: '', endTime: '', period: 0 });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/classes').then(r => setClasses(r.data)),
      api.get('/teachers').then(r => setTeachers(r.data)),
    ]);
  }, []);

  // Load class timetable
  useEffect(() => {
    if (tab === 'class' && selectedClass && selectedSection) {
      setLoading(true);
      api.get('/timetable', { params: { classId: selectedClass, sectionId: selectedSection } })
        .then(r => setTimetable(r.data)).finally(() => setLoading(false));
    }
  }, [tab, selectedClass, selectedSection]);

  // Load subjects for selected class
  useEffect(() => {
    if (selectedClass) {
      api.get('/academics').then(r => {
        const allSubs = r.data.flatMap ? r.data : [];
        setSubjects(Array.isArray(allSubs) ? allSubs : []);
      }).catch(() => {
        // Fallback: get subjects from timetable
        const subs = new Map();
        timetable.forEach(s => { if (s.subject) subs.set(s.subject.id, s.subject); });
        setSubjects(Array.from(subs.values()));
      });
    }
  }, [selectedClass]);

  // Load teacher timetable
  useEffect(() => {
    if (tab === 'teacher' && selectedTeacher) {
      setLoading(true);
      api.get('/timetable', { params: { teacherId: selectedTeacher } })
        .then(r => setTimetable(r.data)).finally(() => setLoading(false));
    }
  }, [tab, selectedTeacher]);

  const selectedClassData = classes.find((c: any) => c.id === selectedClass);

  // Build period-wise grid from timetable
  const buildPeriodGrid = () => {
    // Find unique time slots sorted
    const timeSet = new Map<string, { startTime: string; endTime: string }>();
    timetable.forEach(s => {
      const key = `${s.startTime}-${s.endTime}`;
      if (!timeSet.has(key)) timeSet.set(key, { startTime: s.startTime, endTime: s.endTime });
    });
    const periods = Array.from(timeSet.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Build lookup
    const lookup = new Map<string, any>();
    timetable.forEach(s => {
      lookup.set(`${s.dayOfWeek}|${s.startTime}-${s.endTime}`, s);
    });

    return { periods, lookup };
  };

  const handleAddSlot = async () => {
    if (!addForm.newSubject.trim() || !addForm.teacherId || !addForm.startTime || !addForm.endTime) { alert('Fill all fields'); return; }
    try {
      // Find or create subject by name
      const { data: sub } = await api.post('/academics/subjects', { name: addForm.newSubject.trim(), classId: selectedClass, teacherId: addForm.teacherId });

      await api.post('/timetable', {
        classId: selectedClass, sectionId: selectedSection,
        subjectId: sub.id, teacherId: addForm.teacherId,
        dayOfWeek: addForm.dayOfWeek, startTime: addForm.startTime, endTime: addForm.endTime,
      });
      setAddForm({ subjectId: '', newSubject: '', teacherId: '', dayOfWeek: 'MONDAY', startTime: '', endTime: '', period: 0 });
      // Reload
      const r = await api.get('/timetable', { params: { classId: selectedClass, sectionId: selectedSection } });
      setTimetable(r.data);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Delete this period?')) return;
    try {
      await api.delete(`/timetable/${slotId}`);
      setTimetable(prev => prev.filter(s => s.id !== slotId));
    } catch { alert('Failed to delete'); }
  };

  const handlePrint = () => {
    const { periods, lookup } = buildPeriodGrid();
    const className = tab === 'class' ? selectedClassData?.name : teachers.find(t => t.id === selectedTeacher)?.user?.firstName;
    const isTeacherView = tab === 'teacher';

    let headerCols = periods.map((p, i) => `<th style="background:#c9a227;color:white;padding:8px 6px;font-size:11px;text-align:center;border:1px solid #ddd">Period ${PERIOD_LABELS[i] || i + 1}<br><span style="font-size:9px;font-weight:normal">${p.startTime}–${p.endTime}</span></th>`).join('');

    let bodyRows = DAYS.map(day => {
      const cells = periods.map(p => {
        const slot = lookup.get(`${day}|${p.startTime}-${p.endTime}`);
        if (!slot) return `<td style="padding:6px;text-align:center;border:1px solid #ddd;color:#ccc">—</td>`;
        const sub = slot.subject?.name || '—';
        const teacher = slot.teacher ? `${slot.teacher.user.firstName}` : '';
        const cls = isTeacherView ? `${slot.class?.name}-${slot.section?.name}` : '';
        return `<td style="padding:6px;text-align:center;border:1px solid #ddd"><div style="font-weight:bold;color:#1e40af;font-size:12px">${sub}</div><div style="font-size:10px;color:#64748b">${isTeacherView ? cls : teacher}</div></td>`;
      }).join('');
      return `<tr><td style="padding:8px 12px;font-weight:bold;background:#f8fafc;border:1px solid #ddd;font-size:12px">${DAY_SHORT[day]}</td>${cells}</tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Timetable - ${className}</title>
<style>body{font-family:Arial;margin:20px;color:#1e293b}table{width:100%;border-collapse:collapse}@media print{body{margin:10px}}</style>
</head><body>
<div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:bold;color:#006400">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div><div style="font-size:11px;color:#666">Salarpur, Sector-101</div>
<div style="font-size:16px;font-weight:bold;margin-top:8px;color:#1e3a8a">${isTeacherView ? 'Teacher' : 'Class'} Timetable — ${className}</div></div>
<table><thead><tr><th style="background:#1e3a8a;color:white;padding:8px 12px;text-align:left;border:1px solid #ddd">Day</th>${headerCols}</tr></thead><tbody>${bodyRows}</tbody></table>
<div style="text-align:center;font-size:10px;color:#94a3b8;margin-top:12px">Generated: ${new Date().toLocaleDateString('en-IN')}</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const { periods, lookup } = timetable.length > 0 ? buildPeriodGrid() : { periods: [], lookup: new Map() };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-slate-900">Timetable</h1>
              </div>
              <div className="flex gap-2">
                {timetable.length > 0 && <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4" /> Print</Button>}
                {tab === 'class' && selectedClass && selectedSection && (
                  <Button size="sm" onClick={() => setEditing(!editing)} variant={editing ? 'destructive' : 'default'}>
                    {editing ? 'Done Editing' : 'Edit Timetable'}
                  </Button>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Tabs + Filters */}
          <FadeIn delay={0.05}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                <button onClick={() => { setTab('class'); setTimetable([]); }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'class' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>By Class</button>
                <button onClick={() => { setTab('teacher'); setTimetable([]); }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'teacher' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>By Teacher</button>
              </div>

              {tab === 'class' && (
                <>
                  <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); setTimetable([]); }}
                    className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                    <option value="">Select Class</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={selectedSection} onChange={e => { setSelectedSection(e.target.value); setTimetable([]); }}
                    className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                    <option value="">Section</option>
                    {selectedClassData?.sections?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </>
              )}

              {tab === 'teacher' && (
                <select value={selectedTeacher} onChange={e => { setSelectedTeacher(e.target.value); setTimetable([]); }}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                  <option value="">Select Teacher</option>
                  {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName} ({t.employeeId})</option>)}
                </select>
              )}
            </div>
          </FadeIn>

          {loading && <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>}

          {/* Period Grid Table */}
          {!loading && periods.length > 0 && (
            <FadeIn delay={0.1}>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-4 py-3 text-left font-semibold w-20">Day</th>
                      {periods.map((p, i) => (
                        <th key={i} className="px-2 py-3 text-center font-semibold min-w-[100px]">
                          <div className="text-sm">Period {PERIOD_LABELS[i] || i + 1}</div>
                          <div className="text-[10px] font-normal opacity-70">{p.startTime} – {p.endTime}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day, di) => (
                      <tr key={day} className={`border-t border-slate-100 ${di % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50`}>
                        <td className="px-4 py-3 font-bold text-slate-700 bg-slate-100 text-sm">{DAY_SHORT[day]}</td>
                        {periods.map((p, pi) => {
                          const slot = lookup.get(`${day}|${p.startTime}-${p.endTime}`);
                          return (
                            <td key={pi} className="px-2 py-2 text-center border-l border-slate-100 relative group">
                              {slot ? (
                                <div>
                                  <div className="font-bold text-blue-700 text-sm">{slot.subject?.name}</div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    {tab === 'teacher' ? `${slot.class?.name}-${slot.section?.name}` : slot.teacher?.user?.firstName || ''}
                                  </div>
                                  {editing && (
                                    <button onClick={() => handleDeleteSlot(slot.id)}
                                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-[8px]">
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-200">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FadeIn>
          )}

          {/* No data */}
          {!loading && periods.length === 0 && (tab === 'class' ? (selectedClass && selectedSection) : selectedTeacher) && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">No timetable data</div>
          )}

          {/* Add Period Form */}
          {editing && (
            <FadeIn delay={0.15}>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Add Period</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Day</label>
                    <select value={addForm.dayOfWeek} onChange={e => setAddForm({ ...addForm, dayOfWeek: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      {DAYS.map(d => <option key={d} value={d}>{DAY_SHORT[d]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Subject</label>
                    <input placeholder="e.g. Maths, Hindi, EVS..." value={addForm.newSubject}
                      onChange={e => setAddForm({ ...addForm, newSubject: e.target.value })}
                      list="subject-list"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    <datalist id="subject-list">
                      {(() => {
                        const seen = new Set<string>();
                        return [...subjects, ...timetable.map(s => s.subject).filter(Boolean)]
                          .filter(s => s && !seen.has(s.name) && seen.add(s.name))
                          .map(s => <option key={s.id} value={s.name} />);
                      })()}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Teacher</label>
                    <select value={addForm.teacherId} onChange={e => setAddForm({ ...addForm, teacherId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      <option value="">Select</option>
                      {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Start</label>
                    <input type="time" value={addForm.startTime} onChange={e => setAddForm({ ...addForm, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">End</label>
                    <input type="time" value={addForm.endTime} onChange={e => setAddForm({ ...addForm, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddSlot} className="w-full"><Plus className="h-4 w-4" /> Add Period</Button>
                  </div>
                </div>
              </Card>
            </FadeIn>
          )}

          {/* Quick info - no selection */}
          {!selectedClass && !selectedTeacher && !loading && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              Select a class or teacher to view timetable
            </div>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
