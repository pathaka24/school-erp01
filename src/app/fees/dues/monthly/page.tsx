'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency, getAcademicYears, getCurrentAcademicYear } from '@/lib/utils';
import { useFeedback } from '@/components/ui/feedback';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { CalendarRange, IndianRupee, Users, Wallet, RefreshCw, FileSpreadsheet, Printer, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';

const MONTHS: [string, string][] = [
  ['04', 'April'], ['05', 'May'], ['06', 'June'], ['07', 'July'], ['08', 'August'], ['09', 'September'],
  ['10', 'October'], ['11', 'November'], ['12', 'December'], ['01', 'January'], ['02', 'February'], ['03', 'March'],
];
const STATUS_TONE: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-amber-100 text-amber-800',
  UNPAID: 'bg-slate-100 text-slate-600',
  OVERDUE: 'bg-red-100 text-red-700',
};
const dmy = (d: any) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

function resolveMonth(session: string, mm: string) {
  const startYear = parseInt(session.split('-')[0], 10);
  const num = parseInt(mm, 10);
  const year = num >= 4 ? startYear : startYear + 1;
  return `${year}-${mm}`;
}

export default function MonthlyDuesPage() {
  const { toast, confirm } = useFeedback();
  const [session, setSession] = useState(getCurrentAcademicYear());
  const [mm, setMm] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const month = useMemo(() => resolveMonth(session, mm), [session, mm]);
  const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const sections = classes.find((c: any) => c.id === classId)?.sections || [];

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)).catch(() => {}); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fees/dues/monthly', {
        params: { month, classId: classId || undefined, sectionId: sectionId || undefined, status: status || undefined, search: search.trim() || undefined },
      });
      setData(data);
    } catch { setData(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [month, classId, sectionId, status]);

  const generate = async () => {
    const n = data?.pendingGeneration || 0;
    const res = await confirm({
      title: `Generate ${monthLabel} fees?`,
      message: `${n} student${n === 1 ? '' : 's'} don't have their ${monthLabel} monthly fee yet. This adds it using each student's own fee (or the class default).`,
      confirmLabel: 'Generate',
    });
    if (!res.confirmed) return;
    setGenerating(true);
    try {
      const { data: r } = await api.post('/fees/ledger/generate-monthly', { month, classId: classId || undefined, sectionId: sectionId || undefined });
      toast('success', `${r.studentsCharged} charged (${formatCurrency(r.totalAmount || 0)})${r.studentsSkipped ? ` · ${r.studentsSkipped} skipped` : ''}`);
      load();
    } catch (e: any) { toast('error', e.response?.data?.error || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const rows = data?.rows || [];
  const sm = data?.summary || {};

  const exportRows = () => rows.map((r: any, i: number) => ({
    '#': i + 1, Student: r.name, 'Admission No': r.admissionNo || '',
    Class: `${r.className}${r.sectionName ? ' - ' + r.sectionName : ''}`, 'Fee Month': monthLabel,
    'Total Fee': Math.round(r.totalFee), 'Paid': Math.round(r.paid), 'Outstanding': Math.round(r.outstanding),
    'Due Date': dmy(r.dueDate), Status: r.status,
  }));
  const exportExcel = () => {
    if (rows.length === 0) { toast('error', 'Nothing to export'); return; }
    const ws = XLSX.utils.json_to_sheet(exportRows());
    XLSX.utils.sheet_add_json(ws, [{ Student: `TOTAL (${rows.length})`, 'Total Fee': Math.round(sm.totalBilled || 0), Paid: Math.round(sm.totalCollected || 0), Outstanding: Math.round(sm.totalOutstanding || 0) }], { skipHeader: true, origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Dues ${monthLabel}`);
    XLSX.writeFile(wb, `monthly-dues-${month}.xlsx`);
  };
  const exportPDF = () => {
    if (rows.length === 0) { toast('error', 'Nothing to export'); return; }
    const body = rows.map((r: any, i: number) => `<tr>
      <td>${i + 1}</td><td>${r.name}<div style="color:#94a3b8;font-size:10px">${r.admissionNo || ''}</div></td>
      <td>${r.className}${r.sectionName ? ' - ' + r.sectionName : ''}</td>
      <td style="text-align:right">${formatCurrency(r.totalFee)}</td>
      <td style="text-align:right;color:#15803d">${formatCurrency(r.paid)}</td>
      <td style="text-align:right;font-weight:600;color:#dc2626">${formatCurrency(r.outstanding)}</td>
      <td>${dmy(r.dueDate)}</td><td>${r.status}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Monthly Dues — ${monthLabel}</title>
<style>body{font-family:Arial,sans-serif;margin:20px;color:#1e293b;font-size:12px}
h1{font-size:18px;color:#b45309;margin:0}.sub{font-size:12px;color:#64748b;margin:2px 0 12px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:5px 8px;text-align:left}
th{background:#b45309;color:#fff;font-size:11px;text-transform:uppercase}tfoot td{background:#fef3c7;font-weight:bold}</style></head>
<body><h1>Monthly Dues — ${monthLabel}</h1>
<div class="sub">${rows.length} students · Billed ${formatCurrency(sm.totalBilled || 0)} · Collected ${formatCurrency(sm.totalCollected || 0)} · Outstanding ${formatCurrency(sm.totalOutstanding || 0)} · Printed ${new Date().toLocaleDateString('en-IN')}</div>
<table><thead><tr><th>#</th><th>Student</th><th>Class</th><th style="text-align:right">Total Fee</th><th style="text-align:right">Paid</th><th style="text-align:right">Outstanding</th><th>Due Date</th><th>Status</th></tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td colspan="3">TOTAL (${rows.length})</td><td style="text-align:right">${formatCurrency(sm.totalBilled || 0)}</td><td style="text-align:right">${formatCurrency(sm.totalCollected || 0)}</td><td style="text-align:right">${formatCurrency(sm.totalOutstanding || 0)}</td><td colspan="2"></td></tr></tfoot>
</table></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <CalendarRange className="h-6 w-6 text-amber-600" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Monthly Dues</h1>
                  <p className="text-xs text-slate-500">Outstanding fees for a specific month — {monthLabel}.</p>
                </div>
              </div>
              <Link href="/fees/dues" className="text-xs text-blue-600 hover:underline">← All-months dues</Link>
            </div>
          </FadeIn>

          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
            <label className="text-xs text-slate-600">Academic Session
              <select value={session} onChange={e => setSession(e.target.value)} className="mt-1 w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Month
              <select value={mm} onChange={e => setMm(e.target.value)} className="mt-1 w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                {MONTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Class
              <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }} className="mt-1 w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">All</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Section
              <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId} className="mt-1 w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:bg-slate-50">
                <option value="">All</option>
                {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Status
              <select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">All</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partial</option>
                <option value="OVERDUE">Overdue</option>
                <option value="PAID">Paid</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">Student / Adm. No
              <div className="flex gap-1 mt-1">
                <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load(); }}
                  placeholder="search…" className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                <button onClick={load} className="px-2 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
              </div>
            </label>
          </div>

          {/* Generate banner */}
          {data && data.pendingGeneration > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm text-blue-800 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> <strong>{data.pendingGeneration}</strong> student{data.pendingGeneration === 1 ? '' : 's'} don&apos;t have their {monthLabel} monthly fee yet.
              </span>
              <button onClick={generate} disabled={generating} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {generating && <span className="h-3 w-3 border-2 border-blue-200 border-t-white rounded-full animate-spin" />}
                {generating ? 'Generating…' : `Generate ${monthLabel} fees`}
              </button>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center"><Users className="h-5 w-5 text-amber-600" /></div>
              <div><p className="text-xs text-slate-500">Students with Dues</p><p className="text-xl font-bold text-slate-900">{sm.studentsWithDues || 0}</p></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center"><IndianRupee className="h-5 w-5 text-red-600" /></div>
              <div><p className="text-xs text-slate-500">Total Outstanding</p><p className="text-xl font-bold text-red-600">{formatCurrency(sm.totalOutstanding || 0)}</p></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center"><Wallet className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-xs text-slate-500">Total Collected</p><p className="text-xl font-bold text-green-600">{formatCurrency(sm.totalCollected || 0)}</p></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center"><IndianRupee className="h-5 w-5 text-slate-600" /></div>
              <div><p className="text-xs text-slate-500">Total Pending</p><p className="text-xl font-bold text-slate-900">{formatCurrency(sm.totalPending || 0)}</p></div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-slate-500">{rows.length} record{rows.length === 1 ? '' : 's'} · Due {dmy(data?.dueDate)}</span>
              <div className="flex gap-2">
                <button onClick={exportExcel} disabled={rows.length === 0} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</button>
                <button onClick={exportPDF} disabled={rows.length === 0} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> PDF</button>
              </div>
            </div>
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No records for {monthLabel}{status ? ` (${status.toLowerCase()})` : ''}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Student</th>
                      <th className="px-3 py-2 text-left">Class</th>
                      <th className="px-3 py-2 text-left">Month</th>
                      <th className="px-3 py-2 text-right">Total Fee</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                      <th className="px-3 py-2 text-left">Due Date</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r: any) => (
                      <tr key={r.studentId} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <Link href={`/students/${r.studentId}?tab=fees`} className="font-medium text-blue-600 hover:underline">{r.name}</Link>
                          <div className="text-xs text-slate-400">{r.admissionNo}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{r.className}{r.sectionName ? ` - ${r.sectionName}` : ''}</td>
                        <td className="px-3 py-2 text-slate-600">{monthLabel}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(r.totalFee)}</td>
                        <td className="px-3 py-2 text-right text-green-600">{formatCurrency(r.paid)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${r.outstanding > 0.5 ? 'text-red-600' : 'text-slate-400'}`}>{r.outstanding > 0.5 ? formatCurrency(r.outstanding) : '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{dmy(r.dueDate)}</td>
                        <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_TONE[r.status]}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
