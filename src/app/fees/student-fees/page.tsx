'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useFeedback } from '@/components/ui/feedback';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { IndianRupee, Save, RefreshCw } from 'lucide-react';

export default function StudentFeesPage() {
  const { toast } = useFeedback();
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [classDefault, setClassDefault] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({}); // studentId -> input value
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkVal, setBulkVal] = useState('');

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)).catch(() => {}); }, []);

  const sections = classes.find((c: any) => c.id === classId)?.sections || [];

  const load = async () => {
    if (!classId) { setRows([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get('/students/monthly-fees', { params: { classId, sectionId: sectionId || undefined } });
      setClassDefault(data.classDefault || 0);
      setRows(data.students || []);
      // seed edits from current override (blank if none)
      const seed: Record<string, string> = {};
      for (const s of data.students || []) seed[s.id] = s.monthlyFee != null ? String(Math.round(s.monthlyFee)) : '';
      setEdits(seed);
    } catch { setRows([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [classId, sectionId]);

  const dirty = rows.some(s => (edits[s.id] ?? '') !== (s.monthlyFee != null ? String(Math.round(s.monthlyFee)) : ''));

  const applyBulk = () => {
    const v = bulkVal.trim();
    setEdits(prev => { const n = { ...prev }; for (const s of rows) if (!s.feeExempt) n[s.id] = v; return n; });
  };

  const save = async () => {
    const updates = rows
      .filter(s => (edits[s.id] ?? '') !== (s.monthlyFee != null ? String(Math.round(s.monthlyFee)) : ''))
      .map(s => ({ studentId: s.id, monthlyFee: (edits[s.id] ?? '').trim() === '' ? null : Number(edits[s.id]) }));
    if (updates.length === 0) { toast('info', 'No changes to save'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/students/monthly-fees', { updates });
      toast('success', `${data.updated} student fee${data.updated === 1 ? '' : 's'} updated. Applies to future months only.`);
      load();
    } catch (e: any) { toast('error', e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const effectiveOf = (s: any) => {
    if (s.feeExempt) return 0;
    const v = (edits[s.id] ?? '').trim();
    return v === '' ? classDefault : (Number(v) || 0);
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center gap-3">
              <IndianRupee className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Student Monthly Fees</h1>
                <p className="text-xs text-slate-500">Set each student&apos;s own monthly fee. Blank = use the class default. Changes apply to <strong>future</strong> months only — past ledger entries are untouched.</p>
              </div>
            </div>
          </FadeIn>

          {/* Pickers */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-xs text-slate-600">Class
              <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">Select class…</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Section
              <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:bg-slate-50">
                <option value="">All sections</option>
                {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <div className="flex items-end text-xs text-slate-500">
              {classId && <span>Class default: <strong className="text-slate-700">{classDefault > 0 ? formatCurrency(classDefault) : 'not set'}</strong></span>}
            </div>
            <div className="flex items-end">
              <button onClick={load} disabled={!classId} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 disabled:opacity-50 flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          {classId && rows.length > 0 && (
            <>
              {/* Bulk apply + save bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Set all to</span>
                  <input type="number" value={bulkVal} onChange={e => setBulkVal(e.target.value)} placeholder="₹" className="w-28 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900" />
                  <button onClick={applyBulk} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">Apply to all</button>
                  <span className="text-[11px] text-slate-400">(then edit individuals)</span>
                </div>
                <button onClick={save} disabled={saving || !dirty} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  <Save className="h-4 w-4" /> {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left w-12">Roll</th>
                      <th className="px-3 py-2 text-left">Student</th>
                      <th className="px-3 py-2 text-left">Section</th>
                      <th className="px-3 py-2 text-left w-44">Monthly Fee (₹)</th>
                      <th className="px-3 py-2 text-right">Effective</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500">{s.rollNumber || '—'}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-slate-900">{s.name}</span>
                          <span className="text-xs text-slate-400 ml-1">{s.admissionNo}</span>
                          {s.feeExempt && <span className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">exempt</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{s.section || '—'}</td>
                        <td className="px-3 py-2">
                          <input type="number" value={edits[s.id] ?? ''} disabled={s.feeExempt}
                            onChange={e => setEdits(p => ({ ...p, [s.id]: e.target.value }))}
                            placeholder={classDefault > 0 ? `default ${Math.round(classDefault)}` : 'no default'}
                            className="w-36 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:bg-slate-50" />
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">
                          {s.feeExempt ? <span className="text-slate-400">exempt</span> : (effectiveOf(s) > 0 ? formatCurrency(effectiveOf(s)) : <span className="text-amber-500">no fee</span>)}
                          {(edits[s.id] ?? '').trim() === '' && !s.feeExempt && classDefault > 0 && <div className="text-[10px] text-slate-400">class default</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400">Leave a box blank to use the class default. A saved override only changes months generated <strong>after</strong> the change — to fix the current month, edit that entry in the student&apos;s Fee Ledger.</p>
            </>
          )}

          {classId && !loading && rows.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl py-12 text-center text-slate-400 text-sm">No active students in this class.</div>
          )}
          {!classId && (
            <div className="bg-white border border-slate-200 rounded-xl py-12 text-center text-slate-400 text-sm">Pick a class to set per-student monthly fees.</div>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
