'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { ArrowUpCircle, Search, RefreshCw, GraduationCap } from 'lucide-react';
import { getCurrentAcademicYear } from '@/lib/utils';

const RESULTS = [
  { id: 'PROMOTED', label: 'Promoted (move to target class)', desc: 'Standard end-of-year promotion.' },
  { id: 'DETAINED', label: 'Detained (stays in same class)', desc: 'Student repeats the year. Class is not changed.' },
  { id: 'TRANSFERRED', label: 'Transferred / Section change', desc: 'Move to a different class/section mid-year.' },
];

export default function StudentPromotePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [sourceClassId, setSourceClassId] = useState('');
  const [sourceSectionId, setSourceSectionId] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Promotion config
  const [targetClassId, setTargetClassId] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [year, setYear] = useState(getCurrentAcademicYear());
  const [resultType, setResultType] = useState<'PROMOTED' | 'DETAINED' | 'TRANSFERRED'>('PROMOTED');
  const [carryBalance, setCarryBalance] = useState(true);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data)).catch(() => {});
  }, []);

  const sourceSections = useMemo(
    () => classes.find(c => c.id === sourceClassId)?.sections || [],
    [classes, sourceClassId],
  );
  const targetSections = useMemo(
    () => classes.find(c => c.id === targetClassId)?.sections || [],
    [classes, targetClassId],
  );

  // Auto-select Section A (or first) when target class changes
  useEffect(() => {
    if (!targetClassId) { setTargetSectionId(''); return; }
    const cls = classes.find(c => c.id === targetClassId);
    if (!cls) return;
    const a = cls.sections.find((s: any) => s.name.toUpperCase() === 'A') || cls.sections[0];
    if (a) setTargetSectionId(a.id);
  }, [targetClassId, classes]);

  const loadStudents = async () => {
    if (!sourceClassId) { setStudents([]); return; }
    setLoading(true);
    setSelected(new Set());
    setResult(null);
    try {
      const params: any = { classId: sourceClassId };
      if (sourceSectionId) params.sectionId = sourceSectionId;
      const { data } = await api.get('/students', { params });
      const list = Array.isArray(data) ? data : (data.rows || []);
      setStudents(list);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceClassId, sourceSectionId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter((s: any) =>
      `${s.user?.firstName || ''} ${s.user?.lastName || ''} ${s.admissionNo || ''}`.toLowerCase().includes(q),
    );
  }, [students, search]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s: any) => s.id)));
  };
  const toggle = (id: string) => {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const targetClass = classes.find(c => c.id === targetClassId);
  const sourceClass = classes.find(c => c.id === sourceClassId);
  const isJump = targetClass && sourceClass &&
    targetClass.numericGrade != null && sourceClass.numericGrade != null &&
    Math.abs(targetClass.numericGrade - sourceClass.numericGrade) > 1;
  const isBackward = targetClass && sourceClass &&
    targetClass.numericGrade != null && sourceClass.numericGrade != null &&
    targetClass.numericGrade < sourceClass.numericGrade;

  const submit = async () => {
    if (selected.size === 0) {
      alert('Select at least one student.');
      return;
    }
    if (resultType !== 'DETAINED' && (!targetClassId || !targetSectionId)) {
      alert('Pick a target class and section.');
      return;
    }
    const confirmMsg = `Apply ${resultType} to ${selected.size} student(s)`
      + (resultType !== 'DETAINED' ? ` → ${targetClass?.name} · ${targetSections.find((s: any) => s.id === targetSectionId)?.name}` : '')
      + `\n\nAcademic year: ${year}`
      + `\nFee balances will ${carryBalance ? '' : 'NOT '}be carried forward.`
      + `\n\nProceed?`;
    if (!window.confirm(confirmMsg)) return;

    setSubmitting(true);
    setResult(null);
    try {
      const { data } = await api.post('/students/bulk-promote', {
        studentIds: Array.from(selected),
        targetClassId: resultType === 'DETAINED' ? sourceClassId : targetClassId,
        targetSectionId: resultType === 'DETAINED' ? (sourceSectionId || sourceSections[0]?.id) : targetSectionId,
        year,
        result: resultType,
        carryBalance,
        remarks: remarks || undefined,
      });
      setResult(data);
      // Reload source list — promoted students will move out
      await loadStudents();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Promotion failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center gap-3">
              <ArrowUpCircle className="h-6 w-6 text-emerald-700" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Student Promotion</h1>
                <p className="text-xs text-slate-500">
                  Promote students to any class — sequential, jump (skip a grade), or repeat the year. Records to PromotionHistory; carries forward fee balance.
                </p>
              </div>
            </div>
          </FadeIn>

          {/* Source picker */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">1. Pick students from</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label className="text-xs text-slate-600">
                Source Class
                <select value={sourceClassId} onChange={e => { setSourceClassId(e.target.value); setSourceSectionId(''); }}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                  <option value="">Select class</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Source Section
                <select value={sourceSectionId} onChange={e => setSourceSectionId(e.target.value)} disabled={!sourceClassId}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:bg-slate-100">
                  <option value="">All sections</option>
                  {sourceSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Search
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name / admission no"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                </div>
              </label>
              <div className="flex items-end">
                <button onClick={loadStudents} disabled={!sourceClassId}
                  className="w-full px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 disabled:opacity-50 flex items-center justify-center gap-2">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Target picker */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">2. Promotion result</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
              {RESULTS.map(r => (
                <button key={r.id} onClick={() => setResultType(r.id as any)}
                  className={`text-left px-4 py-3 rounded-lg border transition ${
                    resultType === r.id
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}>
                  <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>

            {resultType !== 'DETAINED' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-xs text-slate-600">
                  Target Class
                  <select value={targetClassId} onChange={e => setTargetClassId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                    <option value="">Select class</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {isJump && <p className="text-[10px] text-amber-700 mt-1">⚠ Class jump detected ({sourceClass?.name} → {targetClass?.name})</p>}
                  {isBackward && <p className="text-[10px] text-red-600 mt-1">⚠ Backward promotion (lower grade)</p>}
                </label>
                <label className="text-xs text-slate-600">
                  Target Section
                  <select value={targetSectionId} onChange={e => setTargetSectionId(e.target.value)} disabled={!targetClassId}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:bg-slate-100">
                    <option value="">Select section</option>
                    {targetSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Academic Year (closing)
                  <input value={year} onChange={e => setYear(e.target.value)} placeholder="2025-2026"
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={carryBalance} onChange={e => setCarryBalance(e.target.checked)} />
                Carry forward outstanding fee balance to new year
              </label>
              <label className="text-xs text-slate-600">
                Remarks (optional)
                <input value={remarks} onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Excellent performance"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </label>
            </div>
          </div>

          {/* Selection list */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-slate-600">
                <strong>{selected.size}</strong> selected of {filtered.length} students
              </p>
              <div className="flex gap-2">
                <button onClick={toggleAll} disabled={filtered.length === 0}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200 disabled:opacity-50">
                  {selected.size === filtered.length && filtered.length > 0 ? 'Deselect all' : 'Select all'}
                </button>
                <button onClick={submit} disabled={selected.size === 0 || submitting}
                  className="px-4 py-1.5 bg-emerald-700 text-white rounded text-xs hover:bg-emerald-800 disabled:opacity-50 flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {submitting ? 'Processing…' : `Apply ${resultType} to ${selected.size}`}
                </button>
              </div>
            </div>

            {loading ? (
              <p className="text-center py-8 text-slate-400 text-sm">Loading students…</p>
            ) : !sourceClassId ? (
              <p className="text-center py-8 text-slate-400 text-sm">Pick a source class to begin.</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">No students.</p>
            ) : (
              <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100">
                {filtered.map((s: any) => (
                  <label key={s.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{s.user?.firstName} {s.user?.lastName}</div>
                      <div className="text-xs text-slate-500">
                        {s.admissionNo} · {s.class?.name || ''}{s.section?.name ? ` · ${s.section.name}` : ''}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-emerald-900 mb-1">✓ Promotion applied</p>
              <p className="text-emerald-800">
                {result.processed} students {result.result.toLowerCase()}
                {result.targetClass && result.result !== 'DETAINED' && <> → <strong>{result.targetClass} · {result.targetSection}</strong></>}
              </p>
              {result.totalBalanceCarried > 0 && (
                <p className="text-emerald-800 text-xs mt-1">Total fee balance carried forward: ₹{result.totalBalanceCarried.toLocaleString('en-IN')}</p>
              )}
              {result.errors && result.errors.length > 0 && (
                <p className="text-red-700 text-xs mt-1">Errors on {result.errors.length} student(s) — first: {result.errors[0]?.reason}</p>
              )}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            <strong>Tip:</strong> for the simple year-end promote-everyone-by-one, use <a href="/academics/rollover" className="underline">Academics → Rollover</a>. This page is for granular promotions: skip a grade, repeat a year, mid-year section transfers.
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
