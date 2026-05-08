'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { TrendingUp, IndianRupee, Users, AlertTriangle, Phone } from 'lucide-react';
import Link from 'next/link';

export default function CollectionDashboardPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
