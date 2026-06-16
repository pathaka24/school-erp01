'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { useFeedback } from '@/components/ui/feedback';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { BookOpen, Save, RefreshCw, CheckCheck } from 'lucide-react';

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'DD'];
const CHARGE_CATEGORIES = ['AD_HOC', 'BOOK', 'DRESS', 'COPY', 'DAIRY', 'TIE_BELT', 'TRANSPORT', 'ANNUAL', 'FINE', 'ID_CARD', 'EXAM_FEE'];

type Row = {
  studentId: string;
  admissionNo: string;
  rollNumber: string | null;
  name: string;
  sectionName?: string;
  currentBalance: number;
  monthlyFeeEntryId: string | null;
  monthlyFeeAmount: number | null;
  paidThisMonth: number; // sum of existing (non-voided) deposits in the month
  // Form inputs
  monthlyFeeInput: string;
  otherCategory: string;
  otherDesc: string;
  otherAmount: string;
  depositAmount: string;
  paymentMethod: string;
  receivedBy: string;
  receiptNumber: string;
};

export default function RegisterEntryPage() {
  const authUser = useAuthStore(s => s.user);
  const actorName = authUser ? `${authUser.firstName} ${authUser.lastName}`.trim() : '';
  const { toast } = useFeedback();
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [classMonthlyFee, setClassMonthlyFee] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data)).catch(() => {});
  }, []);

  const sections = useMemo(() => classes.find((c: any) => c.id === classId)?.sections || [], [classes, classId]);

  const load = async () => {
    if (!classId || !month) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.get('/fees/register', {
        params: { classId, sectionId: sectionId || undefined, month },
      });
      setClassMonthlyFee(data.monthlyFee || 0);
      const newRows: Row[] = (data.students || []).map((s: any) => ({
        studentId: s.studentId,
        admissionNo: s.admissionNo,
        rollNumber: s.rollNumber,
        name: s.name,
        sectionName: s.sectionName,
        currentBalance: s.currentBalance,
        monthlyFeeEntryId: s.monthlyFeeEntryId,
        monthlyFeeAmount: s.monthlyFeeAmount,
        paidThisMonth: (s.deposits || []).reduce((t: number, d: any) => t + (d.amount || 0), 0),
        // Pre-fill monthly fee input with class amount only if no entry exists yet
        monthlyFeeInput: s.monthlyFeeEntryId ? '' : (data.monthlyFee ? String(data.monthlyFee) : ''),
        otherCategory: 'AD_HOC',
        otherDesc: '',
        otherAmount: '',
        depositAmount: '',
        paymentMethod: 'CASH',
        receivedBy: actorName,
        receiptNumber: '',
      }));
      setRows(newRows);
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const fillMonthlyFeeAll = () => {
    if (!classMonthlyFee) {
      toast('error', 'Class monthly fee not set in Annual Fee Plan');
      return;
    }
    setRows(rs => rs.map(r => r.monthlyFeeEntryId ? r : { ...r, monthlyFeeInput: String(classMonthlyFee) }));
  };

  // The month's fee for a row: already-charged amount, else the input, else the class fee
  const feeFor = (r: Row) =>
    r.monthlyFeeEntryId ? (r.monthlyFeeAmount || 0) : (parseFloat(r.monthlyFeeInput) || classMonthlyFee || 0);

  // Everything the student would owe after this save: existing balance + charges being entered now
  const dueAllFor = (r: Row) => {
    const newCharges = (r.monthlyFeeEntryId ? 0 : parseFloat(r.monthlyFeeInput) || 0) + (parseFloat(r.otherAmount) || 0);
    return Math.max(0, r.currentBalance + newCharges);
  };

  // One-click "mark paid": deposit = this month's fee for every row that hasn't paid yet
  const markAllPaidFee = () => {
    const updated = rows.map(r => {
      const fee = feeFor(r);
      if (fee <= 0 || r.paidThisMonth > 0 || r.depositAmount) return r;
      return { ...r, depositAmount: String(fee) };
    });
    const marked = updated.filter((r, i) => r !== rows[i]).length;
    setRows(updated);
    toast(marked > 0 ? 'success' : 'info',
      marked > 0 ? `Deposit filled for ${marked} unpaid students` : 'Everyone already has a deposit this month');
  };

  const totals = useMemo(() => {
    let charges = 0;
    let deposits = 0;
    for (const r of rows) {
      if (!r.monthlyFeeEntryId) charges += parseFloat(r.monthlyFeeInput) || 0;
      charges += parseFloat(r.otherAmount) || 0;
      deposits += parseFloat(r.depositAmount) || 0;
    }
    return { charges, deposits, net: charges - deposits };
  }, [rows]);

  const save = async () => {
    if (rows.length === 0) return;
    const payload = {
      month,
      rows: rows
        .map(r => {
          const monthlyFee = !r.monthlyFeeEntryId && parseFloat(r.monthlyFeeInput) > 0 ? parseFloat(r.monthlyFeeInput) : undefined;
          const otherAmount = parseFloat(r.otherAmount) || 0;
          const depositAmount = parseFloat(r.depositAmount) || 0;
          if (!monthlyFee && otherAmount === 0 && depositAmount === 0) return null;
          return {
            studentId: r.studentId,
            monthlyFee,
            otherCharge: otherAmount > 0 ? { category: r.otherCategory, description: r.otherDesc || r.otherCategory.replace(/_/g, ' '), amount: otherAmount } : undefined,
            deposit: depositAmount > 0 ? { amount: depositAmount, paymentMethod: r.paymentMethod, receivedBy: r.receivedBy || undefined, receiptNumber: r.receiptNumber || undefined } : undefined,
          };
        })
        .filter(Boolean),
    };
    if (payload.rows.length === 0) {
      toast('error', 'No values entered. Fill at least one row before saving.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/fees/ledger/batch-entry', payload);
      setResult(data);
      toast('success', `Saved — ${data.chargesCreated} charges, ${data.depositsCreated} deposits`);
      // Reload to reflect new ledger state
      await load();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Register Entry</h1>
                <p className="text-xs text-slate-500">Row-by-row monthly entry — pick class &amp; month, fill values, Save All.</p>
              </div>
            </div>
          </FadeIn>

          {/* Selectors */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <label className="text-xs text-slate-600">
              Class
              <select value={classId}
                onChange={e => { setClassId(e.target.value); setSectionId(''); setRows([]); }}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">Select class</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Section
              <select value={sectionId}
                onChange={e => { setSectionId(e.target.value); setRows([]); }}
                disabled={!classId}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:bg-slate-100">
                <option value="">All sections</option>
                {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Month
              <input type="month" value={month} onChange={e => { setMonth(e.target.value); setRows([]); }}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
            <div className="flex items-end">
              <button onClick={load} disabled={!classId || !month || loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Load Students'}
              </button>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={fillMonthlyFeeAll} disabled={rows.length === 0 || !classMonthlyFee}
                className="flex-1 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm hover:bg-amber-200 disabled:opacity-50">
                Fill Fees ({formatCurrency(classMonthlyFee)})
              </button>
              <button onClick={markAllPaidFee} disabled={rows.length === 0}
                title="Fill the deposit column with this month's fee for every student who hasn't paid yet"
                className="flex-1 px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm hover:bg-green-200 disabled:opacity-50 flex items-center justify-center gap-1">
                <CheckCheck className="h-4 w-4" /> Mark All Paid
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-green-800">Saved {result.monthLabel}</p>
              <p className="text-green-700">
                {result.chargesCreated} charges &amp; {result.depositsCreated} deposits posted across {result.studentsTouched} students.
              </p>
              {result.errors?.length > 0 && (
                <p className="text-red-700 text-xs mt-1">Errors: {result.errors.length} — first: {result.errors[0]?.reason}</p>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <>
              {/* Totals */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs text-orange-700">New Charges</p>
                  <p className="text-lg font-bold text-orange-900">{formatCurrency(totals.charges)}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-700">New Deposits</p>
                  <p className="text-lg font-bold text-green-900">{formatCurrency(totals.deposits)}</p>
                </div>
                <div className={`border rounded-lg p-3 ${totals.net > 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`text-xs ${totals.net > 0 ? 'text-red-700' : 'text-blue-700'}`}>Net Outstanding Added</p>
                  <p className={`text-lg font-bold ${totals.net > 0 ? 'text-red-900' : 'text-blue-900'}`}>{formatCurrency(totals.net)}</p>
                </div>
              </div>

              {/* Register table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase">
                    <tr>
                      <th className="px-2 py-2 text-left">Roll</th>
                      <th className="px-2 py-2 text-left">Name</th>
                      <th className="px-2 py-2 text-right">Prev Bal</th>
                      <th className="px-2 py-2 text-center w-20">Paid</th>
                      <th className="px-2 py-2 text-right w-28">Monthly Fee</th>
                      <th className="px-2 py-2 text-left w-32">Other Cat</th>
                      <th className="px-2 py-2 text-left w-40">Other Desc</th>
                      <th className="px-2 py-2 text-right w-28">Other Amt</th>
                      <th className="px-2 py-2 text-right w-28">Deposit</th>
                      <th className="px-2 py-2 text-left w-24">Method</th>
                      <th className="px-2 py-2 text-left w-32">Receipt #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <tr key={r.studentId} className="hover:bg-slate-50">
                        <td className="px-2 py-1.5 text-slate-700">{r.rollNumber || '—'}</td>
                        <td className="px-2 py-1.5">
                          <div className="font-medium text-slate-900">{r.name}</div>
                          <div className="text-slate-400 text-[10px]">{r.admissionNo} · {r.sectionName}</div>
                        </td>
                        <td className={`px-2 py-1.5 text-right font-semibold ${r.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(r.currentBalance)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {r.paidThisMonth > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-semibold"
                              title={`Already deposited ${formatCurrency(r.paidThisMonth)} this month`}>
                              ✓ {formatCurrency(r.paidThisMonth)}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.monthlyFeeEntryId ? (
                            <div className="text-right text-slate-400 text-[11px]" title="Already charged">
                              ✓ {formatCurrency(r.monthlyFeeAmount || 0)}
                            </div>
                          ) : (
                            <input type="number" value={r.monthlyFeeInput}
                              onChange={e => updateRow(i, { monthlyFeeInput: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-right text-slate-900" />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={r.otherCategory}
                            onChange={e => updateRow(i, { otherCategory: e.target.value })}
                            className="w-full px-1.5 py-1 border border-slate-300 rounded text-slate-900 text-[11px]">
                            {CHARGE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={r.otherDesc} onChange={e => updateRow(i, { otherDesc: e.target.value })}
                            placeholder="(optional)"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-slate-900" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" value={r.otherAmount}
                            onChange={e => updateRow(i, { otherAmount: e.target.value })}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-right text-slate-900" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" value={r.depositAmount}
                            onChange={e => updateRow(i, { depositAmount: e.target.value })}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-right text-slate-900" />
                          <div className="flex gap-1 mt-0.5 justify-end">
                            <button type="button" tabIndex={-1}
                              onClick={() => updateRow(i, { depositAmount: String(feeFor(r) || '') })}
                              disabled={feeFor(r) <= 0}
                              title={`Fill this month's fee (${formatCurrency(feeFor(r))})`}
                              className="px-1.5 py-0.5 text-[10px] bg-green-50 text-green-700 rounded hover:bg-green-100 disabled:opacity-40">
                              Fee
                            </button>
                            <button type="button" tabIndex={-1}
                              onClick={() => updateRow(i, { depositAmount: String(dueAllFor(r) || '') })}
                              disabled={dueAllFor(r) <= 0}
                              title={`Fill all dues incl. previous balance (${formatCurrency(dueAllFor(r))})`}
                              className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-40">
                              All dues
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={r.paymentMethod}
                            onChange={e => updateRow(i, { paymentMethod: e.target.value })}
                            className="w-full px-1.5 py-1 border border-slate-300 rounded text-slate-900 text-[11px]">
                            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={r.receiptNumber}
                            onChange={e => updateRow(i, { receiptNumber: e.target.value })}
                            placeholder="(optional)"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-slate-900" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 sticky bottom-4 shadow-lg">
                <p className="text-sm text-slate-600">
                  <strong>{rows.length}</strong> students loaded. Empty rows are skipped on save.
                </p>
                <button onClick={save} disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save All'}
                </button>
              </div>
            </>
          )}

          {!loading && rows.length === 0 && classId && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              Click <strong>Load Students</strong> to begin entry.
            </div>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
