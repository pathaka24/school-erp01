'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { useAuthStore } from '@/lib/store';
import { useFeedback } from '@/components/ui/feedback';
import { Archive, RotateCcw, Search, Trash2, RefreshCw } from 'lucide-react';

export default function ArchivedFeesPage() {
  const { toast, confirm: confirmDialog } = useFeedback();
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN');

  const [tab, setTab] = useState<'archived' | 'voided'>('archived');
  const [arch, setArch] = useState<{ rows: any[]; totals: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);

  const load = async (search?: string, state: 'archived' | 'voided' = tab) => {
    setLoading(true);
    try {
      const { data } = await api.get('/fees/ledger/archived', { params: { ...(search ? { search } : {}), state } });
      setArch(data); setSel(new Set());
    } catch { setArch({ rows: [], totals: { count: 0 } }); }
    finally { setLoading(false); }
  };
  // (re)load on mount and whenever the tab changes
  useEffect(() => { load(query.trim() || undefined, tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  const noun = tab === 'voided' ? 'voided' : 'archived';
  const endpoint = tab === 'voided' ? '/fees/ledger/entry/void-restore' : '/fees/ledger/entry/archive';

  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = !!arch?.rows.length && arch.rows.every(r => sel.has(r.id));

  const restore = async (ids: string[]) => {
    if (ids.length === 0) return;
    const res = await confirmDialog({ title: `Restore ${ids.length} ${noun} ${ids.length === 1 ? 'entry' : 'entries'}?`, message: 'They return to the students’ active ledgers and balances recompute.', confirmLabel: 'Restore' });
    if (!res.confirmed) return;
    setActing(true);
    try {
      await api.post(endpoint, { ids, action: 'restore' });
      toast('success', `${ids.length} restored`);
      load(query.trim() || undefined);
    } catch (e: any) { toast('error', e.response?.data?.error || 'Restore failed'); }
    finally { setActing(false); }
  };

  const remove = async (ids: string[]) => {
    if (ids.length === 0) return;
    const res = await confirmDialog({
      title: `Permanently delete ${ids.length} ${noun} ${ids.length === 1 ? 'entry' : 'entries'}?`,
      message: 'This CANNOT be undone — the rows are removed from the database (an audit record is kept).',
      confirmLabel: 'Delete forever', danger: true,
      input: { label: 'Reason', placeholder: 'e.g. cleared old test data', required: true },
    });
    if (!res.confirmed) return;
    setActing(true);
    try {
      await api.post(endpoint, { ids, action: 'delete', reason: res.value });
      toast('success', `${ids.length} permanently deleted`);
      load(query.trim() || undefined);
    } catch (e: any) { toast('error', e.response?.data?.error || 'Delete failed'); }
    finally { setActing(false); }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Archive className="h-6 w-6 text-slate-600" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Archived &amp; Voided Fees</h1>
                  <p className="text-xs text-slate-500">Set-aside fee entries — restore in bulk, or delete permanently. <strong>Archived</strong> = kept aside from totals · <strong>Voided</strong> = soft-deleted.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input value={query} onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') load(query.trim() || undefined); }}
                    placeholder="Search student…" className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 w-52" />
                </div>
                <button onClick={() => load(query.trim() || undefined)} className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
            </div>
          </FadeIn>

          {/* Archived / Voided tabs */}
          <div className="inline-flex gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setTab('archived')} className={`px-4 py-1.5 text-sm rounded-md font-medium ${tab === 'archived' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'}`}>Archived</button>
            <button onClick={() => setTab('voided')} className={`px-4 py-1.5 text-sm rounded-md font-medium ${tab === 'voided' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600'}`}>Voided</button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {arch && arch.rows.length > 0 && (
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-slate-500">
                  {arch.totals.count} entries · {arch.totals.students} students · charges {formatCurrency(arch.totals.charges || 0)} · credits {formatCurrency(arch.totals.credits || 0)}
                  {(() => { const lc = arch.rows.filter((r: any) => r.active === false).length; return lc > 0 ? ` · ${lc} from left students` : ''; })()}
                  {arch.totals.capped ? ' · showing first 500' : ''}
                </span>
                {sel.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">{sel.size} selected</span>
                    <button onClick={() => restore([...sel])} disabled={acting}
                      className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50 flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Restore</button>
                    {isAdmin && (
                      <button onClick={() => remove([...sel])} disabled={acting}
                        className="px-2.5 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete forever</button>
                    )}
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading archived data…</div>
            ) : !arch || arch.rows.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No {noun} entries{query ? ' match this search' : ' yet'}.
                <div className="text-xs text-slate-400 mt-1">
                  {tab === 'voided'
                    ? <>Void an entry from a student&apos;s Fee Ledger tab (the red <strong>Void</strong> button) and it shows up here to restore in bulk.</>
                    : <>Archive an entry from a student&apos;s Fee Ledger tab (the grey <strong>Archive</strong> button) and it shows up here.</>}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 w-8 text-center"><input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(arch.rows.map(r => r.id)))} /></th>
                      <th className="px-3 py-2 text-left">Student</th>
                      <th className="px-3 py-2 text-left">Entry</th>
                      <th className="px-3 py-2 text-left">Month</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      {tab === 'voided' && <th className="px-3 py-2 text-left">Reason</th>}
                      <th className="px-3 py-2 text-left">{tab === 'voided' ? 'Voided' : 'Archived'}</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {arch.rows.map(r => (
                      <tr key={r.id} className={`hover:bg-slate-50 ${sel.has(r.id) ? 'bg-blue-50/40' : ''}`}>
                        <td className="px-3 py-2 text-center"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                        <td className="px-3 py-2">
                          <Link href={`/students/${r.studentId}?tab=fees`} className="font-medium text-blue-600 hover:underline">{r.name}</Link>
                          {r.active === false && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">left</span>}
                          <div className="text-xs text-slate-400">{r.admissionNo}{r.class ? ` · ${r.class}${r.section ? ` - ${r.section}` : ''}` : ''}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{r.description}<span className="ml-1 text-[10px] uppercase text-slate-400">{r.type}</span></td>
                        <td className="px-3 py-2 text-slate-600">{r.month}</td>
                        <td className={`px-3 py-2 text-right font-medium ${r.type === 'CHARGE' ? 'text-slate-700' : 'text-green-600'}`}>{r.type === 'CHARGE' ? '' : '− '}{formatCurrency(r.amount)}</td>
                        {tab === 'voided' && <td className="px-3 py-2 text-xs text-slate-500 max-w-[220px] truncate" title={r.voidReason || ''}>{r.voidReason || '—'}</td>}
                        <td className="px-3 py-2 text-xs text-slate-400">{(tab === 'voided' ? r.voidedAt : r.archivedAt) ? new Date(tab === 'voided' ? r.voidedAt : r.archivedAt).toLocaleDateString('en-IN') : ''}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => restore([r.id])} disabled={acting} className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50">Restore</button>
                            {isAdmin && <button onClick={() => remove([r.id])} disabled={acting} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50">Delete</button>}
                          </div>
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
