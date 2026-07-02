'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency, getAcademicYears, getCurrentAcademicYear } from '@/lib/utils';
import { useFeedback } from '@/components/ui/feedback';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { Grid3x3, RefreshCw, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

const mLabel = (m: string) => new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short' });
const CELL: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-amber-100 text-amber-800',
  UNPAID: 'bg-red-100 text-red-700',
  NONE: 'bg-slate-50 text-slate-300',
};

export default function FeeTrackerPage() {
  const { toast, confirm } = useFeedback();
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [session, setSession] = useState(getCurrentAcademicYear());
  const [data, setData] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)).catch(() => {}); }, []);
  const sections = classes.find((c: any) => c.id === classId)?.sections || [];

  const load = async () => {
    if (!classId) { setData(null); return; }
    setLoading(true);
    try {
      const { data } = await api.get('/fees/tracker', { params: { classId, sectionId: sectionId || undefined, session } });
      setData(data);
    } catch { setData(null); }
    finally { setLoading(false); }
  };
  const loadOverview = async () => {
    setLoading(true);
    try { const { data } = await api.get('/fees/tracker/overview', { params: { session } }); setOverview(data); }
    catch { setOverview(null); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    if (classId) load(); else loadOverview();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [classId, sectionId, session]);

  const generateMissing = async () => {
    const scope = classId ? (classes.find((c: any) => c.id === classId)?.name || 'this class') : 'the whole school';
    const res = await confirm({
      title: `Generate missing months for ${scope}?`,
      message: `Fills every missing monthly fee from April up to the current month (${session}), using each student's own fee. Existing months are untouched.`,
      confirmLabel: 'Generate',
    });
    if (!res.confirmed) return;
    setGenerating(true);
    try {
      const { data: r } = await api.post('/fees/ledger/generate-range', { session, classId: classId || undefined, sectionId: sectionId || undefined });
      toast('success', `${r.created} monthly fee${r.created === 1 ? '' : 's'} added across ${r.months} month${r.months === 1 ? '' : 's'} (${formatCurrency(r.totalAmount || 0)})`);
      if (classId) load(); else loadOverview();
    } catch (e: any) { toast('error', e.response?.data?.error || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const months: string[] = data?.months || [];
  const students: any[] = data?.students || [];

  const exportExcel = () => {
    if (students.length === 0) { toast('error', 'Nothing to export'); return; }
    const rows = students.map((s: any, i: number) => {
      const row: any = { '#': i + 1, Roll: s.roll || '', Student: s.name, 'Adm. No': s.admissionNo || '' };
      for (const m of months) {
        const c = s.cells[m];
        row[mLabel(m)] = c.status === 'NONE' ? '' : c.status === 'PAID' ? 'Paid' : `Due ${Math.round(c.due)}`;
      }
      row['Total Fee'] = Math.round(s.totalFee);
      row['Paid'] = Math.round(s.totalPaid);
      row['Due'] = Math.round(s.totalDue);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const cls = classes.find((c: any) => c.id === classId)?.name || 'class';
    XLSX.utils.book_append_sheet(wb, ws, 'Fee Tracker');
    XLSX.writeFile(wb, `fee-tracker-${cls}-${session}.xlsx`);
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Grid3x3 className="h-6 w-6 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Monthly Fee Tracker</h1>
                  <p className="text-xs text-slate-500">Every student&apos;s month-by-month fee status for the whole year.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={generateMissing} disabled={generating} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                  {generating && <span className="h-3 w-3 border-2 border-blue-200 border-t-white rounded-full animate-spin" />}
                  {generating ? 'Generating…' : 'Generate missing months'}
                </button>
                <Link href="/fees/dues/monthly" className="text-xs text-blue-600 hover:underline">Monthly dues →</Link>
              </div>
            </div>
          </FadeIn>

          {/* Pickers */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            <label className="text-xs text-slate-600">Class
              <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }} className="mt-1 w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">Select class…</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Section
              <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId} className="mt-1 w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:bg-slate-50">
                <option value="">All</option>
                {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Session
              <select value={session} onChange={e => setSession(e.target.value)} className="mt-1 w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <button onClick={load} disabled={!classId} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 disabled:opacity-50 flex items-center gap-2"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
            </div>
            <div className="flex items-end">
              <button onClick={exportExcel} disabled={students.length === 0} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
            </div>
          </div>

          {/* Legend + grand totals */}
          {data && (
            <div className="flex items-center justify-between flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-200" /> Paid</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-200" /> Partial</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-200" /> Unpaid</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-100 border border-slate-200" /> No fee</span>
              </div>
              <div className="text-slate-500">Billed <strong className="text-slate-700">{formatCurrency(data.grand.billed)}</strong> · Collected <strong className="text-green-700">{formatCurrency(data.grand.collected)}</strong> · Due <strong className="text-red-600">{formatCurrency(data.grand.due)}</strong></div>
            </div>
          )}

          {/* All-classes overview (when no class picked) */}
          {!classId && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
              {loading ? (
                <div className="py-12 text-center text-slate-400 text-sm">Loading overview…</div>
              ) : !overview || overview.rows.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">No collection data for {session} yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Class</th>
                      <th className="px-3 py-2 text-right">Students</th>
                      <th className="px-3 py-2 text-right">Billed</th>
                      <th className="px-3 py-2 text-right">Collected</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                      <th className="px-3 py-2 text-center">Collection %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overview.rows.map((c: any) => (
                      <tr key={c.classId} onClick={() => setClassId(c.classId)} className="hover:bg-blue-50 cursor-pointer" title="Open this class's tracker">
                        <td className="px-3 py-2 font-medium text-blue-700">{c.name}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{c.students}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(c.billed)}</td>
                        <td className="px-3 py-2 text-right text-green-600">{formatCurrency(c.collected)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${c.outstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}>{c.outstanding > 0 ? formatCurrency(c.outstanding) : '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.collectionRate >= 80 ? 'bg-green-100 text-green-700' : c.collectionRate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{c.collectionRate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-right">{overview.grand.students}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(overview.grand.billed)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{formatCurrency(overview.grand.collected)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{formatCurrency(overview.grand.outstanding)}</td>
                      <td className="px-3 py-2 text-center">{overview.grand.billed > 0 ? Math.round((overview.grand.collected / overview.grand.billed) * 100) : 0}%</td>
                    </tr>
                  </tfoot>
                </table>
              )}
              <p className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">Click a class to open its month-by-month grid. Figures are for session {session}.</p>
            </div>
          )}

          {/* Grid (class picked) */}
          {classId && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>
            ) : students.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No active students in this class.</div>
            ) : (
              <table className="text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase">
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left min-w-[180px] border-b border-slate-200">Student</th>
                    {months.map(m => <th key={m} className="px-2 py-2 text-center border-b border-slate-200 min-w-[52px]">{mLabel(m)}</th>)}
                    <th className="px-3 py-2 text-right border-b border-slate-200 min-w-[80px]">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-r border-slate-100">
                        <Link href={`/students/${s.id}?tab=fees`} className="font-medium text-blue-600 hover:underline">{s.name}</Link>
                        <div className="text-[10px] text-slate-400">{s.roll ? `#${s.roll} · ` : ''}{s.admissionNo}</div>
                      </td>
                      {months.map(m => {
                        const c = s.cells[m];
                        return (
                          <td key={m} className="px-1 py-1 text-center">
                            <div className={`rounded px-1 py-1 ${CELL[c.status]}`} title={c.status === 'NONE' ? 'No fee' : `Total ${formatCurrency(c.total)} · Paid ${formatCurrency(c.paid)} · Due ${formatCurrency(c.due)}`}>
                              {c.status === 'PAID' ? '✓' : c.status === 'NONE' ? '—' : Math.round(c.due)}
                            </div>
                          </td>
                        );
                      })}
                      <td className={`px-3 py-1.5 text-right font-bold ${s.totalDue > 0.5 ? 'text-red-600' : 'text-green-600'}`}>{s.totalDue > 0.5 ? formatCurrency(s.totalDue) : '✓'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-semibold text-slate-700">
                    <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2 border-t-2 border-slate-300">Collected / Billed</td>
                    {months.map(m => {
                      const t = data.monthTotals[m];
                      return (
                        <td key={m} className="px-1 py-2 text-center border-t-2 border-slate-300">
                          <div className="text-green-700">{t.collected > 0 ? Math.round(t.collected / 1000) + 'k' : '—'}</div>
                          <div className="text-[9px] text-slate-400">{t.billed > 0 ? Math.round(t.billed / 1000) + 'k' : ''}</div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right border-t-2 border-slate-300 text-red-600">{formatCurrency(data.grand.due)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          )}
          {classId && <p className="text-[11px] text-slate-400">Each cell = that month&apos;s fee. ✓ paid · number = amount still due · — no fee that month. Click a name to open their ledger. Column totals in ₹thousands.</p>}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
