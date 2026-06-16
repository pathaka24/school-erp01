'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { AlertTriangle, Phone, IndianRupee, Users, RefreshCw } from 'lucide-react';

// How-late severity → badge color
function lateBadge(monthsLate: number) {
  if (monthsLate >= 3) return 'bg-red-100 text-red-700';
  if (monthsLate >= 1) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-600';
}

export default function FeeDuesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [minMonths, setMinMonths] = useState('0');
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({ totalOutstanding: 0, studentCount: 0, threePlusMonths: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fees/dues', {
        params: { classId: classId || undefined, minMonths: minMonths || undefined },
      });
      setRows(data.rows || []);
      setTotals(data.totals || {});
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [classId, minMonths]);

  const monthLabel = (m: string | null) =>
    m ? new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—';

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Dues & Late Payers</h1>
                <p className="text-xs text-slate-500">Who owes, how much, and how many months behind — partial payments counted via FIFO.</p>
              </div>
            </div>
          </FadeIn>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center"><IndianRupee className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-xs text-slate-500">Total Outstanding</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totals.totalOutstanding || 0)}</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center"><Users className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-xs text-slate-500">Students with Dues</p>
                <p className="text-xl font-bold text-slate-900">{totals.studentCount || 0}</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-xs text-slate-500">3+ Months Behind</p>
                <p className="text-xl font-bold text-red-600">{totals.threePlusMonths || 0}</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-xs text-slate-600">
              Class
              <select value={classId} onChange={e => setClassId(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">All classes</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Behind by at least
              <select value={minMonths} onChange={e => setMinMonths(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="0">Any dues</option>
                <option value="1">1 month</option>
                <option value="2">2 months</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
              </select>
            </label>
            <div className="flex items-end">
              <button onClick={load}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            {loading && <div className="text-center py-10 text-slate-400 text-sm">Loading…</div>}
            {!loading && rows.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">No dues match the filters — everyone is paid up. 🎉</div>
            )}
            {!loading && rows.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Class</th>
                    <th className="px-3 py-2 text-left">Parent / Phone</th>
                    <th className="px-3 py-2 text-left">Due Since</th>
                    <th className="px-3 py-2 text-center">Months Late</th>
                    <th className="px-3 py-2 text-center">Unpaid Months</th>
                    <th className="px-3 py-2 text-left">Last Payment</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r: any) => (
                    <tr key={r.studentId} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{r.name}</div>
                        <div className="text-xs text-slate-400">{r.admissionNo}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{r.className}{r.sectionName ? ` - ${r.sectionName}` : ''}</td>
                      <td className="px-3 py-2">
                        <div className="text-xs text-slate-700">{r.fatherName || '—'}</div>
                        {r.phone ? (
                          <a href={`tel:${r.phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {r.phone}
                          </a>
                        ) : <span className="text-xs text-slate-300">no phone</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{monthLabel(r.oldestDueMonth)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${lateBadge(r.monthsLate)}`}>
                          {r.monthsLate === 0 ? 'current' : `${r.monthsLate} mo`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-slate-700">
                        {r.unpaidMonths}
                        {r.hasPartial && <span className="ml-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]" title="Some months are partially paid">partial</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {r.lastPaymentDate
                          ? <>{new Date(r.lastPaymentDate).toLocaleDateString('en-IN')}<div className="text-slate-400">{formatCurrency(r.lastPaymentAmount || 0)}</div></>
                          : <span className="text-slate-300">never</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-red-600">{formatCurrency(r.balance)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/students/${r.studentId}?tab=fees`}
                          className="px-2.5 py-1 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">
                          Collect
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
