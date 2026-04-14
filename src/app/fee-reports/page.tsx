'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

function getCollectionColor(rate: number) {
  if (rate >= 80) return 'bg-green-500';
  if (rate >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function FeeReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'classwise' | 'feetype' | 'defaulters' | 'behavior' | 'transactions'>('overview');
  const [searchTxn, setSearchTxn] = useState('');

  useEffect(() => {
    api.get('/fee-reports').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></DashboardLayout>;
  }

  const filteredTxns = data.transactions.filter((t: any) => {
    if (!searchTxn) return true;
    const q = searchTxn.toLowerCase();
    return (t.student?.user?.firstName?.toLowerCase().includes(q) || t.student?.user?.lastName?.toLowerCase().includes(q) || t.receiptNumber?.toLowerCase().includes(q));
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Fee Collection Report</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Total Billed</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(data.kpis.totalBilled)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Collected</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(data.kpis.totalCollected)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Outstanding</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(data.kpis.totalOutstanding)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Overdue {'>'}30d</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(data.kpis.overdueAmount)}</p>
            <p className="text-xs text-slate-400">{data.kpis.overdueCount} payments</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Collection Rate</p>
            <p className="text-xl font-bold text-blue-600">{data.kpis.totalBilled > 0 ? (data.kpis.totalCollected / data.kpis.totalBilled * 100).toFixed(1) : 0}%</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
          {[
            { id: 'overview', l: 'Monthly Trend' },
            { id: 'classwise', l: 'Class-wise' },
            { id: 'feetype', l: 'Fee Type' },
            { id: 'defaulters', l: `Defaulters (${data.defaulters.length})` },
            { id: 'behavior', l: 'Payment Behavior' },
            { id: 'transactions', l: 'Transactions' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>{t.l}</button>
          ))}
        </div>

        {/* MONTHLY TREND */}
        {tab === 'overview' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Monthly Collection Trend</h2>
            <div className="space-y-3">
              {data.monthlyTrend.length === 0 ? (
                <p className="text-slate-400">No collection data yet</p>
              ) : (
                data.monthlyTrend.map((m: any) => (
                  <div key={m.month} className="flex items-center gap-4">
                    <span className="text-sm text-slate-600 w-20">{m.month}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 relative">
                      <div className={`h-6 rounded-full ${getCollectionColor(m.rate)}`} style={{ width: `${Math.min(m.rate || 1, 100)}%` }}></div>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">{formatCurrency(m.collected)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* CLASS-WISE */}
        {tab === 'classwise' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Class</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-500">Students</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Billed</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Collected</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Outstanding</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-500">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.classWise.map((c: any) => (
                  <tr key={c.class}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.class}</td>
                    <td className="text-center px-4 py-3 text-sm text-slate-600">{c.students}</td>
                    <td className="text-right px-4 py-3 text-sm text-slate-600">{formatCurrency(c.billed)}</td>
                    <td className="text-right px-4 py-3 text-sm text-green-600 font-medium">{formatCurrency(c.collected)}</td>
                    <td className="text-right px-4 py-3 text-sm text-orange-600">{formatCurrency(Math.max(c.billed - c.collected, 0))}</td>
                    <td className="text-center px-4 py-3 text-sm font-bold">{c.collectionPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* FEE TYPE */}
        {tab === 'feetype' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Fee Type</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Total</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Collected</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.feeTypeWise.map((f: any) => (
                  <tr key={f.type}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{f.type}</td>
                    <td className="text-right px-4 py-3 text-sm text-slate-600">{formatCurrency(f.total)}</td>
                    <td className="text-right px-4 py-3 text-sm text-green-600 font-medium">{formatCurrency(f.collected)}</td>
                    <td className="text-right px-4 py-3 text-sm text-orange-600">{formatCurrency(Math.max(f.total - f.collected, 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* DEFAULTERS */}
        {tab === 'defaulters' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4 text-red-600">Defaulter List</h2>
            {data.defaulters.length === 0 ? (
              <p className="text-slate-400">No defaulters</p>
            ) : (
              <div className="space-y-3">
                {data.defaulters.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{d.name}</p>
                      <p className="text-xs text-slate-500">{d.class} | {d.phone || 'No phone'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Last payment: {d.lastPayment ? formatDate(d.lastPayment) : 'Never'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PAYMENT BEHAVIOR */}
        {tab === 'behavior' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Payment Behavior Tracker</h2>
              <p className="text-sm text-slate-500">Based on fee ledger — tracks who pays regularly vs irregularly</p>
            </div>
            {!data.paymentBehavior?.length ? (
              <div className="p-8 text-center text-slate-400">No ledger data yet. Add charges and deposits to the fee ledger to see payment behavior.</div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                  {[
                    { label: 'Clear', count: data.paymentBehavior.filter((s: any) => s.status === 'CLEAR').length, color: 'bg-green-100 text-green-700' },
                    { label: 'Regular', count: data.paymentBehavior.filter((s: any) => s.status === 'REGULAR').length, color: 'bg-blue-100 text-blue-700' },
                    { label: 'Irregular', count: data.paymentBehavior.filter((s: any) => s.status === 'IRREGULAR').length, color: 'bg-yellow-100 text-yellow-700' },
                    { label: 'Defaulter', count: data.paymentBehavior.filter((s: any) => s.status === 'DEFAULTER').length, color: 'bg-red-100 text-red-700' },
                  ].map(c => (
                    <div key={c.label} className={`rounded-lg p-3 ${c.color}`}>
                      <p className="text-2xl font-bold">{c.count}</p>
                      <p className="text-sm">{c.label}</p>
                    </div>
                  ))}
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Student</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Class</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Family</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Total Charged</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Total Deposited</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Balance</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-500">Regularity</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-500">Status</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Last Deposit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.paymentBehavior.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{s.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{s.class}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{s.family || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatCurrency(s.totalCharges)}</td>
                        <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">{formatCurrency(s.totalDeposits)}</td>
                        <td className={`px-4 py-3 text-sm font-bold text-right ${s.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(s.balance)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="w-full bg-slate-100 rounded-full h-2 max-w-[80px] mx-auto">
                            <div className={`h-2 rounded-full ${s.regularity >= 80 ? 'bg-green-500' : s.regularity >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${s.regularity}%` }}></div>
                          </div>
                          <span className="text-xs text-slate-500">{s.regularity}%</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            s.status === 'CLEAR' ? 'bg-green-100 text-green-700' :
                            s.status === 'REGULAR' ? 'bg-blue-100 text-blue-700' :
                            s.status === 'IRREGULAR' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>{s.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">{s.lastDeposit ? formatDate(s.lastDeposit) : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* TRANSACTIONS */}
        {tab === 'transactions' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4">
              <input placeholder="Search by student name or receipt number..." value={searchTxn} onChange={e => setSearchTxn(e.target.value)} className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </div>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Date</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Receipt</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Student</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Fee</th>
                  <th className="text-right px-4 py-2 text-sm font-medium text-slate-500">Amount</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Mode</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTxns.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm text-slate-500">{formatDate(t.paidDate)}</td>
                    <td className="px-4 py-2 text-sm text-blue-600 font-mono">{t.receiptNumber || '-'}</td>
                    <td className="px-4 py-2 text-sm text-slate-900">{t.student?.user?.firstName} {t.student?.user?.lastName}</td>
                    <td className="px-4 py-2 text-sm text-slate-500">{t.feeStructure?.name}</td>
                    <td className="px-4 py-2 text-sm text-slate-900 font-medium text-right">{formatCurrency(t.amountPaid)}</td>
                    <td className="px-4 py-2 text-sm text-slate-500">{t.paymentMethod || '-'}</td>
                    <td className="px-4 py-2 text-sm"><span className={`px-2 py-0.5 rounded text-xs font-medium ${t.status === 'PAID' ? 'bg-green-100 text-green-700' : t.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
