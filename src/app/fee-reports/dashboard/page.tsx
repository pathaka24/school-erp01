'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { TrendingUp, IndianRupee, Users, AlertTriangle, Phone, Archive, RotateCcw, Search } from 'lucide-react';
import Link from 'next/link';

export default function CollectionDashboardPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      <p className="text-xs text-slate-500 uppercase">Outstanding total</p>
                      <p className="text-2xl font-bold text-red-700 mt-1">{formatCurrency(data.totalOutstanding)}</p>
                      <p className="text-xs text-slate-500 mt-1">across all months</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-700" />
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
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
