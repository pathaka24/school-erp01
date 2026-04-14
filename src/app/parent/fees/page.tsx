'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { IndianRupee } from 'lucide-react';

export default function ParentFeesPage() {
  const { user } = useAuthStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState<any>(null);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/parent/children?userId=${user.id}`)
      .then(res => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) {
          setSelectedChild(res.data.children[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!selectedChild) return;
    api.get(`/fees/ledger/${selectedChild}`)
      .then(res => setLedgerData(res.data))
      .catch(() => setLedgerData(null));
  }, [selectedChild]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  const getAcademicYear = (month: string) => {
    const [y, m] = month.split('-').map(Number);
    return m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  };
  let lastYear = '';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <IndianRupee className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Fee Ledger</h1>
          </div>
          {children.length > 1 && (
            <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
              {children.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.className})</option>
              ))}
            </select>
          )}
        </div>

        {children.length === 1 && (
          <p className="text-sm text-slate-500">{children[0].name} - {children[0].className} {children[0].sectionName}</p>
        )}

        {/* Balance card */}
        <div className={`rounded-xl p-5 border ${ledgerData?.currentBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-sm text-slate-600">Current Balance</p>
          <p className={`text-3xl font-bold ${ledgerData?.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(ledgerData?.currentBalance || 0)}
          </p>
          {ledgerData?.currentBalance > 0 && <p className="text-sm text-red-500 mt-1">Dues pending</p>}
          {ledgerData?.currentBalance <= 0 && <p className="text-sm text-green-600 mt-1">All dues cleared</p>}
        </div>

        {/* Ledger table — read-only */}
        {ledgerData?.ledger?.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Month</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Monthly Fee</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Other</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Total Due</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Deposited</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Balance</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Date / Sign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerData.ledger.map((row: any) => {
                  const year = getAcademicYear(row.month);
                  const showYearHeader = year !== lastYear;
                  lastYear = year;
                  const isPrevBalance = row.monthlyFee === 0 && row.otherCharges > 0 && row.otherDetails.some((d: string) => d.toLowerCase().includes('previous') || d.toLowerCase().includes('opening'));

                  return (
                    <>{showYearHeader && (
                      <tr key={`year-${year}`} className="bg-blue-50">
                        <td colSpan={7} className="px-4 py-2 text-sm font-bold text-blue-700">Academic Year {year}</td>
                      </tr>
                    )}
                    <tr key={row.month} className={`hover:bg-slate-50 ${isPrevBalance ? 'bg-purple-50' : ''}`}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        {isPrevBalance && <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Prev. Balance</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">
                        {row.monthlyFee > 0 ? formatCurrency(row.monthlyFee) : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {row.otherCharges > 0 ? (
                          <span className="text-orange-600 cursor-help" title={row.otherDetails.join('\n')}>
                            {formatCurrency(row.otherCharges)}
                          </span>
                        ) : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                        {formatCurrency(row.balance + row.deposited)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {row.deposited > 0 ? (
                          <span className="text-green-600 font-semibold">{formatCurrency(row.deposited)}</span>
                        ) : '\u2014'}
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold text-right ${row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(row.balance)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {row.depositDates.length > 0 && (
                          <div>{new Date(row.depositDates[0]).toLocaleDateString('en-IN')}</div>
                        )}
                        {row.depositMethods.length > 0 && (
                          <div>{row.depositMethods[0]}</div>
                        )}
                      </td>
                    </tr></>
                  );
                })}
                <tr className="bg-slate-100 border-t-2 border-slate-300">
                  <td className="px-4 py-3 text-sm font-bold text-slate-900">TOTAL</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(ledgerData.totals?.totalMonthlyFees || 0)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-orange-600 text-right">{formatCurrency(ledgerData.totals?.totalOtherCharges || 0)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(ledgerData.totals?.totalCharged || 0)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">{formatCurrency(ledgerData.totals?.totalDeposited || 0)}</td>
                  <td className={`px-4 py-3 text-sm font-bold text-right ${ledgerData.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(ledgerData.currentBalance)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            No fee ledger entries yet
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
