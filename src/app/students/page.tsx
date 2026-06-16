'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem, ScaleHover } from '@/components/ui/motion';
import { Search, Eye, Trash2, ArrowLeft, Users, UserPlus, GraduationCap, Upload, UserMinus, RotateCcw } from 'lucide-react';
import { useFeedback } from '@/components/ui/feedback';
import { formatCurrency } from '@/lib/utils';

const CLASS_COLORS = [
  'from-blue-500 to-blue-600',
  'from-indigo-500 to-indigo-600',
  'from-purple-500 to-purple-600',
  'from-violet-500 to-violet-600',
  'from-fuchsia-500 to-fuchsia-600',
  'from-pink-500 to-pink-600',
  'from-rose-500 to-rose-600',
  'from-orange-500 to-orange-600',
  'from-amber-500 to-amber-600',
  'from-teal-500 to-teal-600',
];

export default function StudentsPage() {
  const router = useRouter();
  const { toast, confirm: confirmDialog } = useFeedback();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedSection, setSelectedSection] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  // Left (deactivated) students view
  const [view, setView] = useState<'classes' | 'left'>('classes');
  const [leftStudents, setLeftStudents] = useState<any[]>([]);
  const [leftLoading, setLeftLoading] = useState(false);

  const loadLeft = async () => {
    setLeftLoading(true);
    try {
      const { data } = await api.get('/students', { params: { status: 'left' } });
      setLeftStudents(data);
    } catch { setLeftStudents([]); }
    setLeftLoading(false);
  };

  const openLeftView = () => {
    setView('left');
    setSelectedClass(null);
    loadLeft();
  };

  const handleReadmit = async (s: any) => {
    const name = `${s.user.firstName} ${s.user.lastName}`.trim();
    const res = await confirmDialog({
      title: `Re-admit ${name}?`,
      message: `They will be reactivated in ${s.class?.name || 'their previous class'}${s.section?.name ? ` - ${s.section.name}` : ''} and reappear on all rolls.`,
      confirmLabel: 'Re-admit',
    });
    if (!res.confirmed) return;
    const fees = await confirmDialog({
      title: 'Restore archived fee records too?',
      message: 'Only applies if their fee ledger was archived when they left. Manually voided entries stay voided either way.',
      confirmLabel: 'Restore fees',
      cancelLabel: 'Skip',
    });
    try {
      const { data } = await api.post(`/students/${s.id}/restore`, { restoreFees: fees.confirmed });
      toast('success', `${name} re-admitted${data.feesRestored ? ` (${data.feesRestored} fee entries restored)` : ''}`);
      loadLeft();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to re-admit');
    }
  };

  useEffect(() => {
    api.get('/classes').then(r => { setClasses(r.data); setLoading(false); });
  }, []);

  const loadStudents = async (classId: string, sectionId?: string) => {
    setStudentsLoading(true);
    try {
      const params: any = { classId };
      if (sectionId) params.sectionId = sectionId;
      const { data } = await api.get('/students', { params });
      setStudents(data);
    } catch { setStudents([]); }
    setStudentsLoading(false);
  };

  const selectClass = (cls: any) => {
    setSelectedClass(cls);
    setSelectedSection('');
    setSearch('');
    loadStudents(cls.id);
  };

  const selectSection = (sectionId: string) => {
    setSelectedSection(sectionId);
    if (selectedClass) loadStudents(selectedClass.id, sectionId || undefined);
  };

  const goBack = () => {
    setSelectedClass(null);
    setSelectedSection('');
    setStudents([]);
    setSearch('');
  };

  const handleDelete = async (id: string) => {
    const res = await confirmDialog({
      title: 'Mark this student as left?',
      message: 'They will be deactivated and moved to the Left Students list — nothing is deleted, and they can be re-admitted later.',
      confirmLabel: 'Mark as left',
      danger: true,
      input: { label: 'Reason / TC number', placeholder: 'e.g. Transferred — TC-2026-014', required: true },
    });
    if (!res.confirmed) return;
    const archive = await confirmDialog({
      title: 'Also archive their fee records?',
      message: 'Archive = hidden from all reports (recoverable on re-admit).\nKeep = any unpaid dues stay live on the books for recovery.',
      confirmLabel: 'Archive fees',
      cancelLabel: 'Keep records',
    });
    try {
      await api.delete(`/students/${id}`, {
        params: { reason: res.value, ...(archive.confirmed ? { archiveFees: 'true' } : {}) },
      });
      toast('success', 'Student marked as left');
      if (selectedClass) loadStudents(selectedClass.id, selectedSection || undefined);
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to mark as left');
    }
  };

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggle = (id: string) => {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = (list: any[]) => {
    if (selected.size === list.length) setSelected(new Set());
    else setSelected(new Set(list.map((s: any) => s.id)));
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const res = await confirmDialog({
      title: `Mark ${selected.size} students as left?`,
      message: 'They will be deactivated and moved to the Left Students list — recoverable via Re-admit.',
      confirmLabel: 'Mark as left',
      danger: true,
    });
    if (!res.confirmed) return;
    const archive = await confirmDialog({
      title: 'Also archive their fee records?',
      message: 'Archive = hidden from all reports (recoverable).\nKeep = unpaid dues stay live on the books.',
      confirmLabel: 'Archive fees',
      cancelLabel: 'Keep records',
    });
    setBulkDeleting(true);
    try {
      await api.post('/students/bulk-delete', { studentIds: Array.from(selected), archiveFees: archive.confirmed });
      toast('success', `${selected.size} students marked as left`);
      setSelected(new Set());
      if (selectedClass) loadStudents(selectedClass.id, selectedSection || undefined);
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Bulk action failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Clear selection when class/section changes
  useEffect(() => { setSelected(new Set()); }, [selectedClass, selectedSection]);

  const filteredStudents = search
    ? students.filter(s => `${s.user.firstName} ${s.user.lastName} ${s.admissionNo}`.toLowerCase().includes(search.toLowerCase()))
    : students;

  const totalStudents = classes.reduce((s: number, c: any) => s + (c._count?.students || 0), 0);

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">

          {/* ─── CLASS CARDS VIEW ─── */}
          {view === 'classes' && !selectedClass && (
            <>
              <FadeIn>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Students</h1>
                    <p className="text-sm text-slate-500">{totalStudents} total students across {classes.length} classes</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={openLeftView} className="flex-1 sm:flex-none">
                      <UserMinus className="h-4 w-4" />
                      <span className="hidden sm:inline">Left Students</span>
                      <span className="sm:hidden">Left</span>
                    </Button>
                    <Button variant="outline" onClick={() => router.push('/students/import')} className="flex-1 sm:flex-none">
                      <Upload className="h-4 w-4" />
                      <span className="hidden sm:inline">Import from Excel/CSV</span>
                      <span className="sm:hidden">Import</span>
                    </Button>
                    <Button onClick={() => router.push('/admission')} className="flex-1 sm:flex-none">
                      <UserPlus className="h-4 w-4" />
                      <span className="hidden sm:inline">New Admission</span>
                      <span className="sm:hidden">New</span>
                    </Button>
                  </div>
                </div>
              </FadeIn>

              {loading ? (
                <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
              ) : (
                <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {classes.map((cls: any, i: number) => {
                    const studentCount = cls._count?.students || 0;
                    const sectionCount = cls.sections?.length || 0;
                    return (
                      <StaggerItem key={cls.id}>
                        <ScaleHover>
                          <button onClick={() => selectClass(cls)} className="w-full text-left">
                            <div className={`bg-gradient-to-br ${CLASS_COLORS[i % CLASS_COLORS.length]} rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow`}>
                              <div className="flex items-center justify-between mb-3">
                                <GraduationCap className="h-6 w-6 opacity-80" />
                                <Badge className="bg-white/20 text-white border-0 text-[10px]">
                                  {sectionCount} sec
                                </Badge>
                              </div>
                              <h3 className="text-lg font-bold">{cls.name}</h3>
                              <div className="flex items-center gap-1.5 mt-2">
                                <Users className="h-4 w-4 opacity-70" />
                                <span className="text-2xl font-black">{studentCount}</span>
                                <span className="text-sm opacity-70">students</span>
                              </div>
                              {cls.sections?.length > 0 && (
                                <div className="flex gap-1.5 mt-3">
                                  {cls.sections.map((sec: any) => (
                                    <span key={sec.id} className="px-2 py-0.5 bg-white/20 rounded text-[11px] font-medium">
                                      {sec.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        </ScaleHover>
                      </StaggerItem>
                    );
                  })}
                </StaggerContainer>
              )}
            </>
          )}

          {/* ─── LEFT STUDENTS VIEW ─── */}
          {view === 'left' && (
            <>
              <FadeIn>
                <div className="flex items-center gap-3">
                  <button onClick={() => setView('classes')} className="p-2 hover:bg-slate-100 rounded-xl transition shrink-0">
                    <ArrowLeft className="h-5 w-5 text-slate-600" />
                  </button>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Left Students</h1>
                    <p className="text-sm text-slate-500">
                      {leftStudents.length} students who left — dues stay recoverable, and anyone can be re-admitted.
                    </p>
                  </div>
                </div>
              </FadeIn>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                {leftLoading && <div className="text-center py-10 text-slate-400 text-sm">Loading…</div>}
                {!leftLoading && leftStudents.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-sm">No students have left yet.</div>
                )}
                {!leftLoading && leftStudents.length > 0 && (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Student</th>
                        <th className="px-3 py-2 text-left">Class</th>
                        <th className="px-3 py-2 text-left">Left On</th>
                        <th className="px-3 py-2 text-left">Reason / TC</th>
                        <th className="px-3 py-2 text-right">Dues</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leftStudents.map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-900">{s.user.firstName} {s.user.lastName}</div>
                            <div className="text-xs text-slate-400">{s.admissionNo}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{s.class?.name}{s.section?.name ? ` - ${s.section.name}` : ''}</td>
                          <td className="px-3 py-2 text-slate-600 text-xs">
                            {s.user.deletedAt ? new Date(s.user.deletedAt).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 max-w-[220px] truncate" title={s.leftReason || ''}>
                            {s.leftReason || '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {s.currentBalance > 0
                              ? <span className="font-bold text-red-600">{formatCurrency(s.currentBalance)}</span>
                              : <span className="text-green-600 text-xs font-semibold">Clear</span>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <button onClick={() => router.push(`/students/${s.id}?tab=fees`)}
                                className="px-2.5 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1">
                                <Eye className="h-3 w-3" /> View
                              </button>
                              <button onClick={() => handleReadmit(s)}
                                className="px-2.5 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 flex items-center gap-1">
                                <RotateCcw className="h-3 w-3" /> Re-admit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ─── STUDENT LIST VIEW (after class selected) ─── */}
          {view === 'classes' && selectedClass && (
            <>
              <FadeIn>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={goBack} className="p-2 hover:bg-slate-100 rounded-xl transition shrink-0">
                      <ArrowLeft className="h-5 w-5 text-slate-600" />
                    </button>
                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{selectedClass.name}</h1>
                      <p className="text-sm text-slate-500">{students.length} students</p>
                    </div>
                  </div>
                  <Button onClick={() => router.push('/admission')} className="shrink-0">
                    <UserPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">New Admission</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </div>
              </FadeIn>

              {/* Section tabs + search */}
              <FadeIn delay={0.1}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto -mx-1 px-1 scrollbar-thin">
                    <button onClick={() => selectSection('')}
                      className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${!selectedSection ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      All
                    </button>
                    {selectedClass.sections?.map((sec: any) => (
                      <button key={sec.id} onClick={() => selectSection(sec.id)}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${selectedSection === sec.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Section {sec.name}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 sm:min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input placeholder="Search by name or adm. no..." value={search} onChange={e => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </FadeIn>

              {/* Student cards */}
              <FadeIn delay={0.15}>
                {/* Bulk action bar — visible when something is selected */}
                {selected.size > 0 && (
                  <div className="bg-blue-600 text-white rounded-xl px-4 py-2.5 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-sm font-medium">
                      <strong>{selected.size}</strong> selected
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => setSelected(new Set())}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs">
                        Clear
                      </button>
                      <button onClick={() => router.push('/students/promote')}
                        className="px-3 py-1 bg-white text-emerald-700 rounded text-xs font-semibold hover:bg-slate-100">
                        Promote selected →
                      </button>
                      <button onClick={handleBulkDelete} disabled={bulkDeleting}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded text-xs font-semibold">
                        {bulkDeleting ? 'Deleting…' : `Delete ${selected.size}`}
                      </button>
                    </div>
                  </div>
                )}
                {studentsLoading ? (
                  <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
                ) : filteredStudents.length === 0 ? (
                  <Card className="p-12 text-center text-slate-400">No students found</Card>
                ) : (
                  <>
                    {/* Desktop / tablet: table */}
                    <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-3 py-3 w-8" onClick={e => e.stopPropagation()}>
                              <input type="checkbox"
                                checked={filteredStudents.length > 0 && selected.size === filteredStudents.length}
                                onChange={() => toggleAll(filteredStudents)} />
                            </th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">#</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Adm. No</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Section</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Phone</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredStudents.map((student: any, idx: number) => (
                            <tr key={student.id} className={`hover:bg-slate-50 transition cursor-pointer ${selected.has(student.id) ? 'bg-blue-50' : ''}`} onClick={() => router.push(`/students/${student.id}`)}>
                              <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={selected.has(student.id)} onChange={() => toggle(student.id)} />
                              </td>
                              <td className="px-5 py-3 text-sm text-slate-400">{idx + 1}</td>
                              <td className="px-5 py-3">
                                <span className="text-sm font-mono text-blue-600">{student.admissionNo}</span>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  {student.photo ? (
                                    <img src={student.photo} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                      {student.user.firstName[0]}{student.user.lastName[0]}
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">{student.user.firstName} {student.user.lastName}</p>
                                    <p className="text-xs text-slate-400">{student.user.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <Badge variant="secondary">{student.section?.name}</Badge>
                              </td>
                              <td className="px-5 py-3 text-sm text-slate-500">{student.user.phone || '—'}</td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => router.push(`/students/${student.id}`)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition">
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleDelete(student.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile: card list */}
                    <div className="md:hidden space-y-2">
                      <label className="flex items-center gap-2 px-1 text-xs text-slate-500">
                        <input type="checkbox"
                          checked={filteredStudents.length > 0 && selected.size === filteredStudents.length}
                          onChange={() => toggleAll(filteredStudents)} />
                        Select all ({filteredStudents.length})
                      </label>
                      {filteredStudents.map((student: any) => (
                        <div key={student.id}
                          onClick={() => router.push(`/students/${student.id}`)}
                          className={`bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 ${selected.has(student.id) ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}>
                          <input type="checkbox"
                            checked={selected.has(student.id)}
                            onChange={() => toggle(student.id)}
                            onClick={e => e.stopPropagation()}
                            className="shrink-0" />
                          {student.photo ? (
                            <img src={student.photo} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {student.user.firstName[0]}{student.user.lastName[0]}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {student.user.firstName} {student.user.lastName}
                              </p>
                              <Badge variant="secondary" className="shrink-0">{student.section?.name}</Badge>
                            </div>
                            <p className="text-xs font-mono text-blue-600 truncate">{student.admissionNo}</p>
                            <p className="text-xs text-slate-400 truncate">{student.user.phone || student.user.email || '—'}</p>
                          </div>
                          <button onClick={e => { e.stopPropagation(); handleDelete(student.id); }}
                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition shrink-0">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </FadeIn>
            </>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
