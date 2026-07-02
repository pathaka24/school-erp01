'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useFeedback } from '@/components/ui/feedback';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { AlertTriangle, Phone, IndianRupee, Users, RefreshCw, CalendarClock, Check, X, FileSpreadsheet, Printer, MessageCircle, FileText, Bell } from 'lucide-react';
import * as XLSX from 'xlsx';

function lateBadge(monthsLate: number) {
  if (monthsLate >= 3) return 'bg-red-100 text-red-700';
  if (monthsLate >= 1) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-600';
}
const dmy = (d: any) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const todayKey = () => { const d = new Date(); return d.toISOString().slice(0, 10); };
function promiseTone(p: any) {
  const today = todayKey();
  const pd = new Date(p.promisedDate).toISOString().slice(0, 10);
  if (p.status === 'PAID') return 'bg-green-100 text-green-700';
  if (p.status === 'BROKEN') return 'bg-red-100 text-red-700';
  if (p.status === 'CANCELLED') return 'bg-slate-100 text-slate-500';
  if (pd < today) return 'bg-red-100 text-red-700';     // overdue promise
  if (pd === today) return 'bg-amber-100 text-amber-800'; // due today
  return 'bg-blue-100 text-blue-700';                     // upcoming
}

export default function FeeDuesPage() {
  const { toast, confirm } = useFeedback();
  const [view, setView] = useState<'dues' | 'followups'>('dues');
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [minMonths, setMinMonths] = useState('0');
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({ totalOutstanding: 0, studentCount: 0, threePlusMonths: 0 });
  const [aging, setAging] = useState<any>(null);
  const [byClass, setByClass] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);

  // Promises (follow-ups)
  const [promises, setPromises] = useState<any[]>([]);
  const [fuFilter, setFuFilter] = useState(''); // '', overdue, today, week
  const [modal, setModal] = useState<{ studentId: string; name: string; balance: number; search?: boolean } | null>(null);
  const [form, setForm] = useState({ promisedDate: '', amount: '', reason: '' });
  const [saving, setSaving] = useState(false);
  // Student search — to add a follow-up for ANY student, not just the dues list
  const [stuSearch, setStuSearch] = useState('');
  const [stuResults, setStuResults] = useState<any[]>([]);
  const [stuSearching, setStuSearching] = useState(false);

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    const q = stuSearch.trim();
    if (q.length < 2) { setStuResults([]); return; }
    let active = true; setStuSearching(true);
    const t = setTimeout(() => {
      api.get('/students', { params: { search: q } })
        .then(r => { if (active) setStuResults((r.data || []).slice(0, 8)); })
        .catch(() => { if (active) setStuResults([]); })
        .finally(() => { if (active) setStuSearching(false); });
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [stuSearch]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fees/dues', { params: { classId: classId || undefined, minMonths: minMonths || undefined } });
      setRows(data.rows || []);
      setTotals(data.totals || {});
      setAging(data.aging || null);
      setByClass(data.byClass || []);
      setSel(new Set());
    } catch { setRows([]); } finally { setLoading(false); }
  };
  const loadPromises = async () => {
    try {
      const { data } = await api.get('/fees/promise', { params: { status: 'PENDING' } });
      setPromises(data.promises || []);
    } catch { setPromises([]); }
  };
  useEffect(() => { load(); loadPromises(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [classId, minMonths]);

  // Latest pending promise per student → shown on the dues row
  const promiseByStudent = new Map<string, any>();
  for (const p of promises) if (!promiseByStudent.has(p.studentId)) promiseByStudent.set(p.studentId, p);

  const openPromise = (studentId: string, name: string, balance: number) => {
    setModal({ studentId, name, balance });
    setForm({ promisedDate: '', amount: balance > 0 ? String(Math.round(balance)) : '', reason: '' });
  };
  const openBlankPromise = () => {
    setModal({ studentId: '', name: '', balance: 0, search: true });
    setForm({ promisedDate: '', amount: '', reason: '' });
    setStuSearch(''); setStuResults([]);
  };
  const pickStudent = (s: any) => {
    const name = `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim();
    setModal({ studentId: s.id, name, balance: s.currentBalance || 0, search: true });
    setForm(f => ({ ...f, amount: s.currentBalance > 0 ? String(Math.round(s.currentBalance)) : f.amount }));
    setStuSearch(''); setStuResults([]);
  };
  const savePromise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal || !modal.studentId) { toast('error', 'Pick a student first'); return; }
    if (!form.promisedDate) { toast('error', 'Pick a promised date'); return; }
    setSaving(true);
    try {
      await api.post('/fees/promise', { studentId: modal.studentId, promisedDate: form.promisedDate, amount: form.amount || undefined, reason: form.reason || undefined });
      toast('success', `Follow-up set for ${modal.name} — ${dmy(form.promisedDate)}`);
      setModal(null);
      loadPromises();
    } catch (err: any) { toast('error', err.response?.data?.error || 'Failed to save follow-up'); }
    finally { setSaving(false); }
  };
  const setStatus = async (p: any, status: string) => {
    if (status !== 'PAID') {
      const res = await confirm({ title: `Mark this follow-up ${status.toLowerCase()}?`, message: `${p.name} — promised ${dmy(p.promisedDate)}.`, confirmLabel: 'Confirm', danger: status === 'BROKEN' });
      if (!res.confirmed) return;
    }
    try { await api.patch(`/fees/promise/${p.id}`, { status }); toast('success', `Marked ${status.toLowerCase()}`); loadPromises(); }
    catch { toast('error', 'Failed to update'); }
  };

  const filteredPromises = promises.filter(p => {
    if (!fuFilter) return true;
    const today = todayKey(); const pd = new Date(p.promisedDate).toISOString().slice(0, 10);
    if (fuFilter === 'overdue') return pd < today;
    if (fuFilter === 'today') return pd === today;
    if (fuFilter === 'week') { const wk = new Date(); wk.setDate(wk.getDate() + 7); return pd >= today && pd <= wk.toISOString().slice(0, 10); }
    return true;
  });
  const overdueCount = promises.filter(p => new Date(p.promisedDate).toISOString().slice(0, 10) < todayKey()).length;

  // ── Exports ────────────────────────────────────────────────────────────
  const exportRows = () => rows.map((r: any, i: number) => ({
    '#': i + 1,
    Student: r.name,
    'Admission No': r.admissionNo || '',
    Class: `${r.className || ''}${r.sectionName ? ' - ' + r.sectionName : ''}`,
    Parent: r.fatherName || '',
    Phone: r.phone || '',
    'Months Late': r.monthsLate,
    'Unpaid Months': r.unpaidMonths,
    'Outstanding (₹)': Math.round(r.balance),
    'Last Payment': r.lastPaymentDate ? new Date(r.lastPaymentDate).toLocaleDateString('en-IN') : '',
    'Last Amount (₹)': r.lastPaymentAmount ? Math.round(r.lastPaymentAmount) : '',
  }));

  const exportExcel = () => {
    if (rows.length === 0) { toast('error', 'Nothing to export'); return; }
    const data = exportRows();
    const ws = XLSX.utils.json_to_sheet(data);
    // total row
    XLSX.utils.sheet_add_json(ws, [{ Student: `TOTAL (${rows.length} students)`, 'Outstanding (₹)': Math.round(totals.totalOutstanding || 0) }], { skipHeader: true, origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dues');
    XLSX.writeFile(wb, `dues-report-${todayKey()}.xlsx`);
  };

  const exportPDF = () => {
    if (rows.length === 0) { toast('error', 'Nothing to export'); return; }
    const body = rows.map((r: any, i: number) => `<tr>
      <td>${i + 1}</td>
      <td>${r.name}<div style="color:#94a3b8;font-size:10px">${r.admissionNo || ''}</div></td>
      <td>${r.className || ''}${r.sectionName ? ' - ' + r.sectionName : ''}</td>
      <td>${r.fatherName || ''}<div style="color:#64748b;font-size:10px">${r.phone || ''}</div></td>
      <td style="text-align:center">${r.monthsLate === 0 ? 'current' : r.monthsLate + ' mo'}</td>
      <td style="text-align:center">${r.unpaidMonths}</td>
      <td style="text-align:right;font-weight:600;color:#dc2626">${formatCurrency(r.balance)}</td>
    </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Dues &amp; Late Payers</title>
<style>body{font-family:Arial,sans-serif;margin:22px;color:#1e293b;font-size:12px}
h1{font-size:18px;color:#b91c1c;margin:0}.sub{font-size:12px;color:#64748b;margin:2px 0 14px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:5px 8px;text-align:left}
th{background:#b91c1c;color:#fff;font-size:11px;text-transform:uppercase}
tfoot td{background:#fee2e2;font-weight:bold}</style></head>
<body>
  <h1>Dues &amp; Late Payers</h1>
  <div class="sub">${rows.length} students · Total outstanding ${formatCurrency(totals.totalOutstanding || 0)} · Printed ${new Date().toLocaleDateString('en-IN')}</div>
  <table>
    <thead><tr><th>#</th><th>Student</th><th>Class</th><th>Parent / Phone</th><th style="text-align:center">Late</th><th style="text-align:center">Unpaid</th><th style="text-align:right">Outstanding</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td colspan="6">TOTAL (${rows.length} students)</td><td style="text-align:right">${formatCurrency(totals.totalOutstanding || 0)}</td></tr></tfoot>
  </table>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  // ── Reminders ──────────────────────────────────────────────────────────
  const toggleSel = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every((r: any) => sel.has(r.studentId));
  const reminderMsg = (r: any) =>
    `Dear Parent, this is a reminder that ${formatCurrency(r.balance)} in fees is pending for ${r.name} (${r.className}${r.sectionName ? '-' + r.sectionName : ''})${r.monthsLate > 0 ? `, ${r.monthsLate} month${r.monthsLate === 1 ? '' : 's'} overdue` : ''}. Kindly clear the dues at your earliest convenience. Thank you.`;
  const logReminder = async (ids: string[], channel: string) => {
    try { await api.post('/fees/reminders', { studentIds: ids, channel }); } catch { /* non-blocking */ }
  };
  const whatsappRow = (r: any) => {
    if (!r.phone) { toast('error', 'No phone number for this parent'); return; }
    const digits = String(r.phone).replace(/\D/g, '');
    const withCc = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${withCc}?text=${encodeURIComponent(reminderMsg(r))}`, '_blank');
    logReminder([r.studentId], 'WHATSAPP').then(() => load());
  };
  const notifyParents = async (ids: string[]) => {
    if (ids.length === 0) return;
    const res = await confirm({ title: `Send fee reminder to ${ids.length} parent${ids.length === 1 ? '' : 's'}?`, message: 'Posts an in-app "fees pending" message to each linked parent (visible in their portal) and logs the reminder.', confirmLabel: 'Send' });
    if (!res.confirmed) return;
    setActing(true);
    try {
      const { data } = await api.post('/fees/reminders', { studentIds: ids, channel: 'NOTICE' });
      toast('success', `${data.logged} logged · ${data.messaged} parent message${data.messaged === 1 ? '' : 's'} sent`);
      setSel(new Set());
      load();
    } catch (e: any) { toast('error', e.response?.data?.error || 'Failed to notify'); }
    finally { setActing(false); }
  };
  const printLetters = (list: any[]) => {
    if (list.length === 0) return;
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const pages = list.map((r: any) => `<div style="page-break-after:always;padding:16px 8px">
      <div style="text-align:right;color:#64748b;font-size:12px">${today}</div>
      <h2 style="font-size:16px;margin:8px 0 2px">Fee Payment Reminder</h2>
      <div style="font-size:12px;color:#64748b;margin-bottom:14px">${r.name} · ${r.admissionNo || ''} · Class ${r.className}${r.sectionName ? ' - ' + r.sectionName : ''}</div>
      <p style="font-size:13px;line-height:1.6">Dear Parent / Guardian,</p>
      <p style="font-size:13px;line-height:1.6">This is a gentle reminder that an amount of <strong>${formatCurrency(r.balance)}</strong> towards school fees is currently <strong>outstanding</strong> for your ward <strong>${r.name}</strong>${r.monthsLate > 0 ? `, pending for <strong>${r.monthsLate} month${r.monthsLate === 1 ? '' : 's'}</strong>` : ''}.</p>
      <p style="font-size:13px;line-height:1.6">We request you to kindly clear the dues at the earliest to avoid any inconvenience. Please ignore this notice if payment has already been made.</p>
      <table style="font-size:12px;border-collapse:collapse;margin:12px 0"><tr><td style="padding:3px 10px 3px 0;color:#64748b">Outstanding</td><td style="font-weight:700;color:#b91c1c">${formatCurrency(r.balance)}</td></tr>
        <tr><td style="padding:3px 10px 3px 0;color:#64748b">Months overdue</td><td>${r.monthsLate}</td></tr>
        <tr><td style="padding:3px 10px 3px 0;color:#64748b">Parent contact</td><td>${r.phone || '—'}</td></tr></table>
      <p style="font-size:13px;line-height:1.6;margin-top:24px">Regards,<br/>Accounts Office</p>
    </div>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Fee Reminder Letters</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#1e293b}</style></head><body>${pages}</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    logReminder(list.map((r: any) => r.studentId), 'LETTER').then(() => load());
    setSel(new Set());
  };
  const sinceDays = (d: any) => { if (!d) return null; return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Dues & Follow-ups</h1>
                <p className="text-xs text-slate-500">Who owes, call them, and log when they promise to pay.</p>
              </div>
            </div>
          </FadeIn>

          {/* View toggle + add-follow-up-for-any-student */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="inline-flex gap-1 bg-slate-100 rounded-lg p-1">
              <button onClick={() => setView('dues')} className={`px-3 py-1.5 text-sm rounded-md font-medium ${view === 'dues' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Dues</button>
              <button onClick={() => setView('followups')} className={`px-3 py-1.5 text-sm rounded-md font-medium ${view === 'followups' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>
                Follow-ups {promises.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px]">{promises.length}{overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}</span>}
              </button>
            </div>
            <button onClick={openBlankPromise} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" /> Add follow-up
            </button>
          </div>

          {view === 'dues' && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center"><IndianRupee className="h-5 w-5 text-red-600" /></div>
                  <div><p className="text-xs text-slate-500">Total Outstanding</p><p className="text-xl font-bold text-red-600">{formatCurrency(totals.totalOutstanding || 0)}</p></div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center"><Users className="h-5 w-5 text-amber-600" /></div>
                  <div><p className="text-xs text-slate-500">Students with Dues</p><p className="text-xl font-bold text-slate-900">{totals.studentCount || 0}</p></div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                  <div><p className="text-xs text-slate-500">3+ Months Behind</p><p className="text-xl font-bold text-red-600">{totals.threePlusMonths || 0}</p></div>
                </div>
              </div>

              {/* Aging + by-class */}
              {aging && (totals.totalOutstanding || 0) > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Outstanding aging</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[['Current', aging.current, 'text-slate-700'], ['1 mo', aging.m1, 'text-amber-700'], ['2–3 mo', aging.m23, 'text-orange-700'], ['3+ mo', aging.m4plus, 'text-red-700']].map(([l, v, c]: any) => (
                        <div key={l} className="text-center">
                          <p className="text-[11px] text-slate-500">{l}</p>
                          <p className={`text-sm font-bold ${c}`}>{formatCurrency(v)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Dues by class</p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {byClass.slice(0, 16).map((c: any) => (
                        <span key={c.name} className="px-2 py-0.5 rounded-lg bg-slate-100 text-xs text-slate-600">{c.name} <strong className="text-red-600">{formatCurrency(c.outstanding)}</strong> <span className="text-slate-400">·{c.students}</span></span>
                      ))}
                      {byClass.length === 0 && <span className="text-xs text-slate-400">No dues.</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="text-xs text-slate-600">Class
                  <select value={classId} onChange={e => setClassId(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                    <option value="">All classes</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-600">Behind by at least
                  <select value={minMonths} onChange={e => setMinMonths(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                    <option value="0">Any dues</option><option value="1">1 month</option><option value="2">2 months</option><option value="3">3 months</option><option value="6">6 months</option>
                  </select>
                </label>
                <div className="flex items-end gap-2 flex-wrap">
                  <button onClick={() => { load(); loadPromises(); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                  <button onClick={exportExcel} disabled={rows.length === 0} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" /> Excel
                  </button>
                  <button onClick={exportPDF} disabled={rows.length === 0} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                    <Printer className="h-4 w-4" /> PDF
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                {sel.size > 0 && (
                  <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-medium text-blue-800">{sel.size} selected</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSel(new Set())} className="px-3 py-1.5 text-xs bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Clear</button>
                      <button onClick={() => printLetters(rows.filter((r: any) => sel.has(r.studentId)))} disabled={acting} className="px-3 py-1.5 text-xs bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Print letters</button>
                      <button onClick={() => notifyParents([...sel])} disabled={acting} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Notify parents</button>
                    </div>
                  </div>
                )}
                {loading && <div className="text-center py-10 text-slate-400 text-sm">Loading…</div>}
                {!loading && rows.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">No dues match — everyone is paid up. 🎉</div>}
                {!loading && rows.length > 0 && (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 w-8 text-center"><input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(rows.map((r: any) => r.studentId)))} /></th>
                        <th className="px-3 py-2 text-left">Student</th>
                        <th className="px-3 py-2 text-left">Class</th>
                        <th className="px-3 py-2 text-left">Parent / Phone</th>
                        <th className="px-3 py-2 text-center">Late</th>
                        <th className="px-3 py-2 text-right">Outstanding</th>
                        <th className="px-3 py-2 text-left">Promised</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r: any) => {
                        const pr = promiseByStudent.get(r.studentId);
                        return (
                          <tr key={r.studentId} className={`hover:bg-slate-50 ${sel.has(r.studentId) ? 'bg-blue-50/40' : ''}`}>
                            <td className="px-3 py-2 text-center"><input type="checkbox" checked={sel.has(r.studentId)} onChange={() => toggleSel(r.studentId)} /></td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{r.name}</div>
                              <div className="text-xs text-slate-400">{r.admissionNo}</div>
                              {r.reminderCount > 0 && <div className="text-[10px] text-amber-600">reminded {sinceDays(r.lastReminderAt) === 0 ? 'today' : `${sinceDays(r.lastReminderAt)}d ago`} ·{r.reminderCount}×</div>}
                            </td>
                            <td className="px-3 py-2 text-slate-700">{r.className}{r.sectionName ? ` - ${r.sectionName}` : ''}</td>
                            <td className="px-3 py-2">
                              <div className="text-xs text-slate-700">{r.fatherName || '—'}</div>
                              {r.phone ? <a href={`tel:${r.phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Phone className="h-3 w-3" /> {r.phone}</a> : <span className="text-xs text-slate-300">no phone</span>}
                            </td>
                            <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${lateBadge(r.monthsLate)}`}>{r.monthsLate === 0 ? 'current' : `${r.monthsLate} mo`}</span></td>
                            <td className="px-3 py-2 text-right font-bold text-red-600">{formatCurrency(r.balance)}</td>
                            <td className="px-3 py-2">
                              {pr ? (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${promiseTone(pr)}`} title={pr.reason || ''}>
                                  {dmy(pr.promisedDate)}{pr.amount ? ` · ${formatCurrency(pr.amount)}` : ''}
                                </span>
                              ) : <span className="text-xs text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex gap-1 justify-end">
                                <button onClick={() => whatsappRow(r)} title="Send WhatsApp reminder" className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-1">
                                  <MessageCircle className="h-3 w-3" /> WA
                                </button>
                                <button onClick={() => openPromise(r.studentId, r.name, r.balance)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1">
                                  <CalendarClock className="h-3 w-3" /> {pr ? 'Update' : 'Follow-up'}
                                </button>
                                <Link href={`/students/${r.studentId}?tab=fees`} className="px-2.5 py-1 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">Collect</Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {view === 'followups' && (
            <>
              <div className="flex gap-1">
                {[['', 'All'], ['overdue', 'Overdue'], ['today', 'Today'], ['week', 'This week']].map(([v, l]) => (
                  <button key={v} onClick={() => setFuFilter(v)} className={`px-3 py-1.5 text-xs rounded-full font-medium ${fuFilter === v ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{l}</button>
                ))}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                {filteredPromises.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No follow-ups{fuFilter ? ' for this filter' : ' yet'}. Set one from the Dues tab.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Promised</th>
                        <th className="px-3 py-2 text-left">Student</th>
                        <th className="px-3 py-2 text-left">Phone</th>
                        <th className="px-3 py-2 text-right">Will pay</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                        <th className="px-3 py-2 text-left">Reason</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPromises.map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${promiseTone(p)}`}>{dmy(p.promisedDate)}</span></td>
                          <td className="px-3 py-2"><Link href={`/students/${p.studentId}?tab=fees`} className="font-medium text-blue-600 hover:underline">{p.name}</Link><div className="text-xs text-slate-400">{p.class}{p.section ? ` - ${p.section}` : ''}</div></td>
                          <td className="px-3 py-2">{p.phone ? <a href={`tel:${p.phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Phone className="h-3 w-3" /> {p.phone}</a> : <span className="text-xs text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{p.amount ? formatCurrency(p.amount) : '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-red-600">{formatCurrency(p.balance)}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 max-w-[200px] truncate" title={p.reason || ''}>{p.reason || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => setStatus(p, 'PAID')} title="Paid" className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check className="h-3.5 w-3.5" /></button>
                              <button onClick={() => setStatus(p, 'BROKEN')} title="Didn't pay" className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200"><X className="h-3.5 w-3.5" /></button>
                              <Link href={`/students/${p.studentId}?tab=fees`} className="px-2 py-1 text-xs font-semibold bg-green-600 text-white rounded hover:bg-green-700">Collect</Link>
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
        </div>
      </PageTransition>

      {/* Promise modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <form onClick={e => e.stopPropagation()} onSubmit={savePromise} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            {/* Header: student picker (any student) or chosen student */}
            {!modal.studentId ? (
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-slate-900">Add follow-up</h3>
                <p className="text-xs text-slate-500">Search any student, then set the date they promised to pay.</p>
                <input autoFocus value={stuSearch} onChange={e => setStuSearch(e.target.value)} placeholder="Search by name or admission no…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                {stuSearching && <p className="text-xs text-slate-400">Searching…</p>}
                {stuResults.length > 0 && (
                  <div className="border border-slate-200 rounded-lg max-h-48 overflow-auto divide-y divide-slate-100">
                    {stuResults.map((s: any) => (
                      <button type="button" key={s.id} onClick={() => pickStudent(s)} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">
                        <span className="font-medium text-slate-800">{s.user?.firstName} {s.user?.lastName}</span>
                        <span className="text-xs text-slate-400 ml-1">{s.class?.name}{s.section?.name ? ` - ${s.section.name}` : ''} · {s.admissionNo}</span>
                      </button>
                    ))}
                  </div>
                )}
                {stuSearch.trim().length >= 2 && !stuSearching && stuResults.length === 0 && <p className="text-xs text-slate-400">No students found.</p>}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Follow-up — {modal.name}</h3>
                  {modal.search && <button type="button" onClick={() => { setModal({ ...modal, studentId: '', name: '' }); setStuSearch(''); }} className="text-xs text-blue-600 hover:underline">change</button>}
                </div>
                <p className="text-xs text-slate-500">{modal.balance > 0 ? `Outstanding ${formatCurrency(modal.balance)}. ` : ''}Log what the parent said on the call.</p>
              </div>
            )}

            {modal.studentId && (
              <>
                <label className="block text-xs text-slate-600">Promised payment date
                  <input type="date" value={form.promisedDate} onChange={e => setForm({ ...form, promisedDate: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                </label>
                <label className="block text-xs text-slate-600">Amount they&apos;ll pay (optional)
                  <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="₹" className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                </label>
                <label className="block text-xs text-slate-600">Reason / note
                  <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. salary on 5th, will pay 2 months together" className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                </label>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">Cancel</button>
              {modal.studentId && <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save follow-up'}</button>}
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
