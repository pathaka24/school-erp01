'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { TrendingUp, IndianRupee, Users, AlertTriangle, Phone, Archive, RotateCcw, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { useFeedback } from '@/components/ui/feedback';

export default function CollectionDashboardPage() {
  const { toast, confirm: confirmDialog } = useFeedback();
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Archived data (per-entry archives, school-wide)
  const [arch, setArch] = useState<{ rows: any[]; totals: any } | null>(null);
  const [archListLoading, setArchListLoading] = useState(true);
  const [archQuery, setArchQuery] = useState('');
  const [archSel, setArchSel] = useState<Set<string>>(new Set());
  const [archActing, setArchActing] = useState(false);

  const loadArchived = async (search?: string) => {
    setArchListLoading(true);
    try {
      const { data } = await api.get('/fees/ledger/archived', { params: search ? { search } : {} });
      setArch(data); setArchSel(new Set());
    } catch { setArch({ rows: [], totals: { count: 0 } }); }
    finally { setArchListLoading(false); }
  };
  useEffect(() => { loadArchived(); }, []);

  const toggleArch = (id: string) => setArchSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const archAllSelected = !!arch?.rows.length && arch.rows.every(r => archSel.has(r.id));

  const restoreArchived = async (ids: string[]) => {
    if (ids.length === 0) return;
    const res = await confirmDialog({ title: `Restore ${ids.length} archived ${ids.length === 1 ? 'entry' : 'entries'}?`, message: 'They return to the students’ active ledgers and balances recompute.', confirmLabel: 'Restore' });
    if (!res.confirmed) return;
    setArchActing(true);
    try {
      await api.post('/fees/ledger/entry/archive', { ids, action: 'restore' });
      toast('success', `${ids.length} restored`);
      loadArchived(archQuery.trim() || undefined);
    } catch (e: any) { toast('error', e.response?.data?.error || 'Restore failed'); }
    finally { setArchActing(false); }
  };

  const deleteArchived = async (ids: string[]) => {
    if (ids.length === 0) return;
    const res = await confirmDialog({
      title: `Permanently delete ${ids.length} archived ${ids.length === 1 ? 'entry' : 'entries'}?`,
      message: 'This CANNOT be undone — the rows are removed from the database (an audit record is kept).',
      confirmLabel: 'Delete forever', danger: true,
      input: { label: 'Reason', placeholder: 'e.g. cleared old test data', required: true },
    });
    if (!res.confirmed) return;
    setArchActing(true);
    try {
      await api.post('/fees/ledger/entry/archive', { ids, action: 'delete', reason: res.value });
      toast('success', `${ids.length} permanently deleted`);
      loadArchived(archQuery.trim() || undefined);
    } catch (e: any) { toast('error', e.response?.data?.error || 'Delete failed'); }
    finally { setArchActing(false); }
  };

  // Archive / restore a student's fee ledger
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveResults, setArchiveResults] = useState<any[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState<string | null>(null);
  const [archiveMsg, setArchiveMsg] = useState('');

  const runStudentSearch = async () => {
    if (!archiveSearch.trim()) return;
    setArchiveLoading(true);
    setArchiveMsg('');
    try {
      const r = await api.get('/students', { params: { search: archiveSearch.trim() } });
      setArchiveResults(r.data.slice(0, 10));
      if (r.data.length === 0) setArchiveMsg('No active students matched.');
    } catch {
      setArchiveMsg('Search failed.');
    } finally {
      setArchiveLoading(false);
    }
  };

  const doArchive = async (s: any) => {
    const name = `${s.user.firstName} ${s.user.lastName}`.trim();
    if (!confirm(`Archive ALL fee records for ${name}?\n\nThey will be hidden from reports but stay recoverable.`)) return;
    setArchiveBusy(s.id);
    try {
      const r = await api.post(`/fees/ledger/${s.id}/archive`);
      setArchiveMsg(`Archived ${r.data.archived} entr${r.data.archived === 1 ? 'y' : 'ies'} for ${name}.`);
    } catch (e: any) {
      setArchiveMsg(e.response?.data?.error || 'Archive failed.');
    } finally {
      setArchiveBusy(null);
    }
  };

  const doRestore = async (s: any) => {
    const name = `${s.user.firstName} ${s.user.lastName}`.trim();
    if (!confirm(`Restore archived fee records for ${name}?`)) return;
    setArchiveBusy(s.id);
    try {
      const r = await api.delete(`/fees/ledger/${s.id}/archive`);
      setArchiveMsg(`Restored ${r.data.restored} entr${r.data.restored === 1 ? 'y' : 'ies'} for ${name}.`);
    } catch (e: any) {
      setArchiveMsg(e.response?.data?.error || 'Restore failed.');
    } finally {
      setArchiveBusy(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    api.get(`/fee-reports/collection-summary?month=${month}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [month]);

  const collectionRate = useMemo(() => {
    if (!data || !data.chargedThisMonth) return 0;
    return Math.min(100, (data.collectedThisMonth / data.chargedThisMonth) * 100);
  }, [data]);

  const maxDaily = useMemo(() => {
    if (!data?.daily?.length) return 0;
    return Math.max(...data.daily.map((d: any) => d.total));
  }, [data]);

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Collection Dashboard</h1>
                <p className="text-xs text-slate-500">Live snapshot of fee collection, outstanding, and defaulters.</p>
              </div>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </div>
          </FadeIn>

          {loading && <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>}

          {!loading && data && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Collected this month</p>
                      <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(data.collectedThisMonth)}</p>
                      <p className="text-xs text-slate-500 mt-1">{data.depositsThisMonth} deposit{data.depositsThisMonth === 1 ? '' : 's'}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <IndianRupee className="h-5 w-5 text-green-700" />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Charged this month</p>
                      <p className="text-2xl font-bold text-orange-700 mt-1">{formatCurrency(data.chargedThisMonth)}</p>
                      <p className="text-xs text-slate-500 mt-1">{data.chargeEntriesThisMonth} charge{data.chargeEntriesThisMonth === 1 ? '' : 's'}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-orange-700" />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Defaulters</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">{data.defaultersCount}</p>
                      <p className="text-xs text-slate-500 mt-1">of {data.totalStudents} students</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-slate-700" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Outstanding breakdown — this year vs previous years */}
              {data.outstandingBreakdown && (() => {
                const bd = data.outstandingBreakdown;
                const ayLabel = (y: number) => `${y}–${String((y + 1) % 100).padStart(2, '0')}`;
                return (
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <h3 className="text-sm font-semibold text-slate-700">Outstanding breakdown</h3>
                      </div>
                      <span className="text-xs text-slate-400">{bd.studentsOwing} student{bd.studentsOwing === 1 ? '' : 's'} owing</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">This year (AY {ayLabel(bd.currentAY)})</p>
                        <p className="text-xl font-bold text-slate-900">{formatCurrency(bd.currentYear)}</p>
                        <p className="text-[11px] text-slate-400">{bd.total > 0 ? Math.round((bd.currentYear / bd.total) * 100) : 0}% of dues · current year's fees</p>
                      </div>
                      <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                        <p className="text-xs text-amber-700">Previous years (carry-forward)</p>
                        <p className="text-xl font-bold text-amber-700">{formatCurrency(bd.previousYears)}</p>
                        <p className="text-[11px] text-amber-600">{bd.total > 0 ? Math.round((bd.previousYears / bd.total) * 100) : 0}% of dues · from earlier academic years</p>
                      </div>
                    </div>
                    {bd.previousBalanceEntries > 0 && (
                      <p className="text-xs text-slate-500 mt-2">Of the total, <strong className="text-slate-700">{formatCurrency(bd.previousBalanceEntries)}</strong> is carry-forward <em>opening balance</em> (entered at admission) — it may fall in either bucket above depending on the month it was recorded.</p>
                    )}
                    {bd.byYear.length > 1 && (
                      <div className="overflow-x-auto mt-3">
                        <table className="w-full text-sm">
                          <thead className="text-xs uppercase text-slate-500">
                            <tr>
                              <th className="text-left px-3 py-1.5">Academic Year</th>
                              <th className="text-right px-3 py-1.5">Students</th>
                              <th className="text-right px-3 py-1.5">Outstanding</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bd.byYear.map((y: any) => (
                              <tr key={y.ay} className="hover:bg-slate-50">
                                <td className="px-3 py-1.5 font-medium text-slate-800">AY {ayLabel(y.ay)} {y.ay === bd.currentAY && <span className="text-[10px] text-blue-600">current</span>}</td>
                                <td className="px-3 py-1.5 text-right text-slate-600">{y.students}</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-red-600">{formatCurrency(y.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 mt-2">Each unpaid charge is dated by its fee month; oldest dues (previous years) are settled first (FIFO). Excludes voided &amp; archived entries.</p>
                  </div>
                );
              })()}

              {/* Archive a student's fee records */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Archive className="h-4 w-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-700">Archive Student Fee Records</h3>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Hide a student&apos;s entire fee ledger from reports (e.g. a student who has left). Archived records are recoverable — restore them anytime.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      value={archiveSearch}
                      onChange={e => setArchiveSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') runStudentSearch(); }}
                      placeholder="Search student by name…"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <button onClick={runStudentSearch} disabled={archiveLoading}
                    className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50">
                    {archiveLoading ? 'Searching…' : 'Search'}
                  </button>
                </div>

                {archiveMsg && <p className="text-xs mt-2 text-slate-600">{archiveMsg}</p>}

                {archiveResults.length > 0 && (
                  <div className="mt-3 border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {archiveResults.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2 flex-wrap gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.user.firstName} {s.user.lastName}</p>
                          <p className="text-xs text-slate-500">
                            {s.admissionNo}{s.class?.name ? ` · ${s.class.name}` : ''}{s.section?.name ? ` · ${s.section.name}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => doArchive(s)} disabled={archiveBusy === s.id}
                            className="px-3 py-1 bg-amber-100 text-amber-700 text-xs rounded hover:bg-amber-200 disabled:opacity-50 flex items-center gap-1">
                            <Archive className="h-3 w-3" /> Archive fees
                          </button>
                          <button onClick={() => doRestore(s)} disabled={archiveBusy === s.id}
                            className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200 disabled:opacity-50 flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" /> Restore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Collection rate bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">Collection Rate (this month)</p>
                  <p className="text-sm font-bold text-slate-900">{collectionRate.toFixed(1)}%</p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${collectionRate >= 80 ? 'bg-green-500' : collectionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${collectionRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {formatCurrency(data.collectedThisMonth)} collected of {formatCurrency(data.chargedThisMonth)} charged
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Collection by method */}
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Collection by Payment Method</h3>
                  {data.byMethod.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-6">No collections this month yet.</p>
                  )}
                  <div className="space-y-3">
                    {data.byMethod.map((m: any) => {
                      const pct = data.collectedThisMonth ? (m.total / data.collectedThisMonth) * 100 : 0;
                      return (
                        <div key={m.method}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">{m.method.replace(/_/g, ' ')}</span>
                            <span className="text-slate-500">{formatCurrency(m.total)} · {m.count} txn{m.count === 1 ? '' : 's'}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Daily collection sparkline (last 30 days) */}
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Daily Collection (last 30 days)</h3>
                  {data.daily.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">No collections in the past 30 days.</p>
                  ) : (
                    <div className="flex items-end gap-1 h-32">
                      {data.daily.map((d: any) => {
                        const h = maxDaily ? (d.total / maxDaily) * 100 : 0;
                        return (
                          <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${formatCurrency(d.total)}`}>
                            <div className="w-full bg-blue-500 rounded-t" style={{ height: `${h}%`, minHeight: d.total > 0 ? '2px' : '0' }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {data.daily.length > 0 && (
                    <p className="text-xs text-slate-400 mt-2">
                      Peak: {formatCurrency(maxDaily)} on {data.daily.find((d: any) => d.total === maxDaily)?.date}
                    </p>
                  )}
                </div>
              </div>

              {/* Top defaulters */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Top 10 Defaulters</h3>
                  <p className="text-xs text-slate-400">By outstanding balance</p>
                </div>
                {data.topDefaulters.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No defaulters. All clear!</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Adm. No</th>
                        <th className="px-4 py-2 text-left">Class</th>
                        <th className="px-4 py-2 text-right">Outstanding</th>
                        <th className="px-4 py-2 text-left">Phone</th>
                        <th className="px-4 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.topDefaulters.map((d: any) => (
                        <tr key={d.studentId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{d.name}</td>
                          <td className="px-4 py-2.5 text-slate-600">{d.admissionNo}</td>
                          <td className="px-4 py-2.5 text-slate-600">{d.class} {d.section ? `· ${d.section}` : ''}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-700">{formatCurrency(d.balance)}</td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {d.phone ? (
                              <a href={`tel:${d.phone}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
                                <Phone className="h-3 w-3" /> {d.phone}
                              </a>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Link href={`/students/${d.studentId}#fees`}
                              className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200">
                              Open Ledger
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* Archived Data — per-entry archives, school-wide */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-slate-600" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Archived Data</h3>
                  <p className="text-xs text-slate-500">Individual fee entries set aside from totals — restore, or delete permanently.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input value={archQuery} onChange={e => setArchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') loadArchived(archQuery.trim() || undefined); }}
                    placeholder="Search student…" className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 w-52" />
                </div>
                <button onClick={() => loadArchived(archQuery.trim() || undefined)} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">Search</button>
              </div>
            </div>

            {arch && arch.rows.length > 0 && (
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-slate-500">
                  {arch.totals.count} entries · {arch.totals.students} students · charges {formatCurrency(arch.totals.charges || 0)} · credits {formatCurrency(arch.totals.credits || 0)}{arch.totals.capped ? ' · showing first 500' : ''}
                </span>
                {archSel.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">{archSel.size} selected</span>
                    <button onClick={() => restoreArchived([...archSel])} disabled={archActing}
                      className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50 flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Restore</button>
                    {isAdmin && (
                      <button onClick={() => deleteArchived([...archSel])} disabled={archActing}
                        className="px-2.5 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete forever</button>
                    )}
                  </div>
                )}
              </div>
            )}

            {archListLoading ? (
              <div className="py-10 text-center text-slate-400 text-sm">Loading archived data…</div>
            ) : !arch || arch.rows.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">No archived entries{archQuery ? ' match this search' : ''}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 w-8 text-center"><input type="checkbox" checked={archAllSelected} onChange={() => setArchSel(archAllSelected ? new Set() : new Set(arch.rows.map(r => r.id)))} /></th>
                      <th className="px-3 py-2 text-left">Student</th>
                      <th className="px-3 py-2 text-left">Entry</th>
                      <th className="px-3 py-2 text-left">Month</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Archived</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {arch.rows.map(r => (
                      <tr key={r.id} className={`hover:bg-slate-50 ${archSel.has(r.id) ? 'bg-blue-50/40' : ''}`}>
                        <td className="px-3 py-2 text-center"><input type="checkbox" checked={archSel.has(r.id)} onChange={() => toggleArch(r.id)} /></td>
                        <td className="px-3 py-2">
                          <Link href={`/students/${r.studentId}?tab=fees`} className="font-medium text-blue-600 hover:underline">{r.name}</Link>
                          <div className="text-xs text-slate-400">{r.admissionNo}{r.class ? ` · ${r.class}${r.section ? ` - ${r.section}` : ''}` : ''}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{r.description}<span className="ml-1 text-[10px] uppercase text-slate-400">{r.type}</span></td>
                        <td className="px-3 py-2 text-slate-600">{r.month}</td>
                        <td className={`px-3 py-2 text-right font-medium ${r.type === 'CHARGE' ? 'text-slate-700' : 'text-green-600'}`}>{r.type === 'CHARGE' ? '' : '− '}{formatCurrency(r.amount)}</td>
                        <td className="px-3 py-2 text-xs text-slate-400">{r.archivedAt ? new Date(r.archivedAt).toLocaleDateString('en-IN') : ''}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => restoreArchived([r.id])} disabled={archActing} className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50">Restore</button>
                            {isAdmin && <button onClick={() => deleteArchived([r.id])} disabled={archActing} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50">Delete</button>}
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
