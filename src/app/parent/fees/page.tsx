'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { IndianRupee, Printer } from 'lucide-react';

// Open a printable per-deposit receipt for the given ledger entry id
async function printDepositReceipt(entryId: string) {
  let data: any;
  try {
    const res = await api.get(`/fees/ledger/entry/${entryId}/receipt`);
    data = res.data;
  } catch (err: any) {
    alert(err.response?.data?.error || 'Failed to load receipt');
    return;
  }
  const monthLabel = new Date(data.deposit.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const allocationRows = (data.allocation || []).map((a: any) =>
    `<tr>
      <td style="padding:6px 12px;font-size:12px;border:1px solid #cbd5e1">${new Date(a.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
      <td style="padding:6px 12px;font-size:12px;border:1px solid #cbd5e1">${a.description}</td>
      <td style="padding:6px 12px;font-size:12px;border:1px solid #cbd5e1;text-align:right;font-weight:600">${fmt(a.amountPaid)}</td>
    </tr>`
  ).join('');
  const totalAllocated = (data.allocation || []).reduce((s: number, a: any) => s + a.amountPaid, 0);
  const advanceAmount = data.deposit.amount - totalAllocated;

  const html = `<!DOCTYPE html><html><head><title>Fee Receipt — ${data.deposit.receiptNumber || data.deposit.id.slice(0, 8)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;margin:20px;color:#1e293b;font-size:13px}
  .header{text-align:center;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:16px}
  .school{font-size:20px;font-weight:bold;color:#1e40af}
  .receipt-no{display:inline-block;background:#1e40af;color:white;padding:4px 20px;border-radius:4px;font-size:14px;font-weight:bold;margin:8px 0}
  .month-pill{display:inline-block;background:#16a34a;color:white;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:bold;margin-left:8px}
  h3{color:#1e40af;font-size:13px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:1px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}
  .field .label{font-size:10px;color:#64748b;text-transform:uppercase}
  .field .value{font-size:13px;font-weight:600}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  th{background:#1e40af;color:white;padding:6px 12px;font-size:11px;text-align:left;text-transform:uppercase}
  .total-row td{background:#dcfce7;font-weight:bold;font-size:14px}
  .balance-box{border:3px solid;border-radius:8px;padding:12px;text-align:center;margin:12px 0;font-size:16px;font-weight:bold}
  .sig-row{display:flex;justify-content:space-between;margin-top:40px}
  .sig-line{border-top:1px solid #000;width:180px;text-align:center;padding-top:4px;font-size:11px}
  @media print{body{margin:10px}}
</style></head><body>
  <div class="header">
    <div class="school">${data.schoolName}</div>
    <div style="font-size:14px;font-weight:bold;color:#1e293b;margin-top:6px">FEE RECEIPT <span class="month-pill">${monthLabel}</span></div>
    <div class="receipt-no">${data.deposit.receiptNumber || 'RCP-' + data.deposit.id.slice(0, 8).toUpperCase()}</div>
    <div style="font-size:11px;color:#666">Date: ${new Date(data.deposit.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  </div>

  <h3>Student</h3>
  <div class="grid">
    <div class="field"><div class="label">Name</div><div class="value">${data.student.name}</div></div>
    <div class="field"><div class="label">Admission No</div><div class="value">${data.student.admissionNo}</div></div>
    <div class="field"><div class="label">Class</div><div class="value">${data.student.class || '—'}${data.student.section ? ' · ' + data.student.section : ''}</div></div>
    <div class="field"><div class="label">Month</div><div class="value">${monthLabel}</div></div>
  </div>

  <h3>Payment</h3>
  <div class="grid">
    <div class="field"><div class="label">Amount Paid</div><div class="value" style="color:#16a34a;font-size:16px">${fmt(data.deposit.amount)}</div></div>
    <div class="field"><div class="label">Method</div><div class="value">${data.deposit.paymentMethod || 'CASH'}</div></div>
    ${data.deposit.receivedBy ? `<div class="field"><div class="label">Received By</div><div class="value">${data.deposit.receivedBy}</div></div>` : ''}
    <div class="field"><div class="label">Balance Before</div><div class="value">${fmt(data.balanceBeforeDeposit)}</div></div>
  </div>

  ${allocationRows ? `
    <h3>Applied To Charges (FIFO)</h3>
    <table>
      <thead><tr><th>Month</th><th>Description</th><th style="text-align:right;width:25%">Paid</th></tr></thead>
      <tbody>
        ${allocationRows}
        ${advanceAmount > 0.01 ? `<tr><td style="padding:6px 12px;font-size:12px;border:1px solid #cbd5e1;font-style:italic;color:#92400e" colspan="2">Advance (carried forward)</td><td style="padding:6px 12px;font-size:12px;border:1px solid #cbd5e1;text-align:right;font-weight:600;color:#92400e">${fmt(advanceAmount)}</td></tr>` : ''}
        <tr class="total-row">
          <td style="padding:8px 12px;border:1px solid #cbd5e1;font-size:14px" colspan="2">Total Paid</td>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;text-align:right;font-size:14px">${fmt(data.deposit.amount)}</td>
        </tr>
      </tbody>
    </table>
  ` : `<p style="font-style:italic;color:#92400e;margin-top:8px">This deposit has been carried forward as advance — no outstanding charges at the time of payment.</p>`}

  <div class="balance-box" style="border-color:${data.currentBalance > 0 ? '#dc2626' : '#16a34a'};color:${data.currentBalance > 0 ? '#dc2626' : '#16a34a'}">
    Current Balance: ${fmt(data.currentBalance)} ${data.currentBalance > 0 ? 'DUE' : 'CLEARED'}
  </div>

  <div class="sig-row">
    <div class="sig-line">Parent's Signature</div>
    <div class="sig-line">Accountant</div>
  </div>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

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
        {ledgerData?.ledger?.length > 0 ? (() => {
          // Pre-pass: per-row payment status using cumulative totals
          let cumMonthlyFee = 0;
          let cumDeposits = 0;
          const decoratedRows = ledgerData.ledger.map((row: any) => {
            cumMonthlyFee += row.monthlyFee || 0;
            cumDeposits += row.deposited || 0;
            const monthlyFeePaid = row.monthlyFee > 0 && cumDeposits >= cumMonthlyFee;
            let status: 'PAID' | 'PARTIAL' | 'DUE' | 'NONE';
            if (row.monthlyFee === 0 && row.otherCharges === 0 && row.deposited === 0) status = 'NONE';
            else if (row.balance <= 0) status = 'PAID';
            else if (cumDeposits > 0 || row.deposited > 0) status = 'PARTIAL';
            else status = 'DUE';
            return { ...row, monthlyFeePaid, status };
          });

          return (
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Date / Sign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {decoratedRows.map((row: any) => {
                  const year = getAcademicYear(row.month);
                  const showYearHeader = year !== lastYear;
                  lastYear = year;
                  const isPrevBalance = row.monthlyFee === 0 && row.otherCharges > 0 && row.otherDetails.some((d: string) => d.toLowerCase().includes('previous') || d.toLowerCase().includes('opening'));
                  const rowTint = row.status === 'PAID' ? 'bg-green-50/50' : row.status === 'PARTIAL' ? 'bg-amber-50/40' : '';

                  return (
                    <>{showYearHeader && (
                      <tr key={`year-${year}`} className="bg-blue-50">
                        <td colSpan={8} className="px-4 py-2 text-sm font-bold text-blue-700">Academic Year {year}</td>
                      </tr>
                    )}
                    <tr key={row.month} className={`hover:bg-slate-50 ${isPrevBalance ? 'bg-purple-50' : rowTint}`}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        {isPrevBalance && <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Prev. Balance</span>}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right ${row.monthlyFeePaid ? 'text-green-700 font-semibold' : 'text-slate-700'}`}>
                        {row.monthlyFee > 0 ? (
                          <span className={row.monthlyFeePaid ? 'inline-flex items-center gap-1' : ''}>
                            <span className={row.monthlyFeePaid ? 'line-through opacity-70' : ''}>{formatCurrency(row.monthlyFee)}</span>
                            {row.monthlyFeePaid && <span className="text-green-600">\u2713</span>}
                          </span>
                        ) : '\u2014'}
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
                      <td className="px-4 py-3">
                        {row.status === 'PAID' && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">PAID</span>}
                        {row.status === 'PARTIAL' && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">PARTIAL</span>}
                        {row.status === 'DUE' && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">DUE</span>}
                        {row.status === 'NONE' && <span className="text-slate-300 text-xs">\u2014</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {(ledgerData?.entries || [])
                          .filter((d: any) => d.type === 'DEPOSIT' && d.month === row.month && !d.voidedAt)
                          .map((d: any) => (
                            <div key={d.id} className="flex items-center justify-between gap-2 mb-1 last:mb-0">
                              <div>
                                <div>{new Date(d.date).toLocaleDateString('en-IN')}</div>
                                <div className="text-slate-500">{d.paymentMethod || '—'}</div>
                              </div>
                              <button onClick={() => printDepositReceipt(d.id)}
                                title="Print receipt"
                                className="p-1 rounded hover:bg-purple-50 text-purple-600 hover:text-purple-800">
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        {(!row.depositDates?.length) && <span className="text-slate-300">—</span>}
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
                  <td>
                    {ledgerData.currentBalance <= 0
                      ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">ALL PAID</span>
                      : <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">{formatCurrency(ledgerData.currentBalance)} DUE</span>}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          );
        })() : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            No fee ledger entries yet
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
