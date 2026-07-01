'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useFeedback } from '@/components/ui/feedback';
import { useAuthStore } from '@/lib/store';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { UserMinus, IndianRupee, Users, Search, RotateCcw, Archive, RefreshCw, Trash2 } from 'lucide-react';

export default function LeftStudentsFeesPage() {
  const { toast, confirm: confirmDialog } = useFeedback();
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/students', { params: { status: 'left' } });
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const name = (s: any) => `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim();

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(s => name(s).toLowerCase().includes(t) || (s.admissionNo || '').toLowerCase().includes(t));
  }, [rows, q]);

  const totals = useMemo(() => ({
    count: rows.length,
    outstanding: rows.reduce((sum, s) => sum + Math.max(0, s.currentBalance || 0), 0),
    owing: rows.filter(s => (s.currentBalance || 0) > 0.5).length,
  }), [rows]);

  const reAdmit = async (s: any) => {
    const res = await confirmDialog({
      title: `Re-admit ${name(s)}?`,
      message: 'Reactivates the student. Any archived fee records are restored too so their ledger is live again.',
      confirmLabel: 'Re-admit',
    });
    if (!res.confirmed) return;
    setBusy(s.id);
    try {
      const r = await api.post(`/students/${s.id}/restore`, { restoreFees: true });
      toast('success', `${name(s)} re-admitted${r.data.feesRestored ? ` · ${r.data.feesRestored} fee entries restored` : ''}`);
      load();
    } catch (e: any) { toast('error', e.response?.data?.error || 'Re-admit failed'); }
    finally { setBusy(null); }
  };

  const archiveFees = async (s: any) => {
    const res = await confirmDialog({
      title: `Archive ${name(s)}'s fee records?`,
      message: 'Sets aside all their fee entries from every total (dues stop showing in reports). Fully recoverable.',
      confirmLabel: 'Archive fees',
    });
    if (!res.confirmed) return;
    setBusy(s.id);
    try {
      const r = await api.post(`/fees/ledger/${s.id}/archive`);
      toast('success', r.data.archived ? `Archived ${r.data.archived} entries` : 'Nothing to archive');
      load();
    } catch (e: any) { toast('error', e.response?.data?.error || 'Archive failed'); }
    finally { setBusy(null); }
  };

  const restoreFees = async (s: any) => {
    setBusy(s.id);
    try {
      const r = await api.delete(`/fees/ledger/${s.id}/archive`);
      toast('success', r.data.restored ? `Restored ${r.data.restored} entries` : 'Nothing archived to restore');
      load();
    } catch (e: any) { toast('error', e.response?.data?.error || 'Restore failed'); }
    finally { setBusy(null); }
  };

  const deleteForever = async (s: any) => {
    const res = await confirmDialog({
      title: `Permanently delete ${name(s)}?`,
      message: `This CANNOT be undone. ${name(s)} and ALL their records — fees, grades, attendance, everything — are removed from the database.`,
      confirmLabel: 'Delete forever', danger: true,
      input: { label: 'Reason', placeholder: 'e.g. left last year, records no longer needed', required: true },
    });
    if (!res.confirmed) return;
    setBusy(s.id);
    try {
      await api.delete(`/students/${s.id}`, { params: { permanent: 'true', reason: res.value || '' } });
      toast('success', `${name(s)} permanently deleted`);
      load();
    } catch (e: any) { toast('error', e.response?.data?.error || 'Delete failed'); }
    finally { setBusy(null); }
  };

  const toggleSel = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = filtered.length > 0 && filtered.every(s => sel.has(s.id));

  const bulkDelete = async () => {
    const ids = [...sel];
    if (ids.length === 0) return;
    const res = await confirmDialog({
      title: `Permanently delete ${ids.length} left student${ids.length === 1 ? '' : 's'}?`,
      message: 'This CANNOT be undone. Every selected student and ALL their records — fees, grades, attendance — are removed from the database.',
      confirmLabel: 'Delete forever', danger: true,
      input: { label: 'Reason', placeholder: 'e.g. cleared out students who left last year', required: true },
    });
    if (!res.confirmed) return;
    setBulkBusy(true);
    try {
      const r = await api.post('/students/bulk-delete', { studentIds: ids, permanent: true });
      toast('success', `${r.data.deleted} deleted${r.data.skippedActive ? ` · ${r.data.skippedActive} skipped (still active)` : ''}${r.data.failed ? ` · ${r.data.failed} failed` : ''}`);
      setSel(new Set());
      load();
    } catch (e: any) { toast('error', e.response?.data?.error || 'Bulk delete failed'); }
    finally { setBulkBusy(false); }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <UserMinus className="h-6 w-6 text-slate-600" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Left Students — Fees</h1>
                  <p className="text-xs text-slate-500">Students who left, with any outstanding dues. Chase, archive their records, or re-admit.</p>
                </div>
              </div>
              <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </FadeIn>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center"><Users className="h-5 w-5 text-slate-600" /></div>
              <div><p className="text-xs text-slate-500">Left students</p><p className="text-xl font-bold text-slate-900">{totals.count}</p></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center"><IndianRupee className="h-5 w-5 text-red-600" /></div>
              <div><p className="text-xs text-slate-500">Outstanding (unrecovered)</p><p className="text-xl font-bold text-red-600">{formatCurrency(totals.outstanding)}</p></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center"><UserMinus className="h-5 w-5 text-amber-600" /></div>
              <div><p className="text-xs text-slate-500">Left owing money</p><p className="text-xl font-bold text-slate-900">{totals.owing}</p></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or admission no…"
                  className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 w-64" />
              </div>
              <span className="text-xs text-slate-400">Balance excludes archived entries · archived dues won&apos;t show here</span>
            </div>

            {isAdmin && sel.size > 0 && (
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium text-red-800">{sel.size} selected</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSel(new Set())} disabled={bulkBusy} className="px-3 py-1.5 text-xs bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50">Clear</button>
                  <button onClick={bulkDelete} disabled={bulkBusy} className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5">
                    {bulkBusy && <span className="h-3 w-3 border-2 border-red-200 border-t-white rounded-full animate-spin" />}
                    {bulkBusy ? 'Deleting…' : 'Delete selected'}
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No left students{q ? ' match this search' : ''}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      {isAdmin && <th className="px-3 py-2 w-8 text-center"><input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(filtered.map((s: any) => s.id)))} /></th>}
                      <th className="px-3 py-2 text-left">Student</th>
                      <th className="px-3 py-2 text-left">Class</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((s: any) => (
                      <tr key={s.id} className={`hover:bg-slate-50 ${sel.has(s.id) ? 'bg-red-50/40' : ''}`}>
                        {isAdmin && <td className="px-3 py-2 text-center"><input type="checkbox" checked={sel.has(s.id)} onChange={() => toggleSel(s.id)} /></td>}
                        <td className="px-3 py-2">
                          <Link href={`/students/${s.id}?tab=fees`} className="font-medium text-blue-600 hover:underline">{name(s)}</Link>
                          <div className="text-xs text-slate-400">{s.admissionNo}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{s.class?.name || '—'}{s.section?.name ? ` - ${s.section.name}` : ''}</td>
                        <td className="px-3 py-2 text-xs text-slate-500 max-w-[200px] truncate" title={s.leftReason || ''}>{s.leftReason || '—'}</td>
                        <td className={`px-3 py-2 text-right font-bold ${(s.currentBalance || 0) > 0.5 ? 'text-red-600' : 'text-slate-400'}`}>
                          {(s.currentBalance || 0) > 0.5 ? formatCurrency(s.currentBalance) : (s.currentBalance < -0.5 ? `${formatCurrency(-s.currentBalance)} adv` : '—')}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {busy === s.id ? (
                            <span className="text-xs text-slate-400">working…</span>
                          ) : (
                            <div className="flex gap-1 justify-end flex-wrap">
                              <Link href={`/students/${s.id}?tab=fees`} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Ledger</Link>
                              <button onClick={() => archiveFees(s)} className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 flex items-center gap-1"><Archive className="h-3 w-3" /> Archive</button>
                              <button onClick={() => restoreFees(s)} className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200">Restore</button>
                              <button onClick={() => reAdmit(s)} className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Re-admit</button>
                              {isAdmin && <button onClick={() => deleteForever(s)} title="Permanently remove this student and all their records" className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button>}
                            </div>
                          )}
                        </td>
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
