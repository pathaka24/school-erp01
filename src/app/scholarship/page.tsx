'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Sparkles, TrendingUp } from 'lucide-react';

const TIER_COLORS: Record<string, string> = {
  DIAMOND: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  GOLD: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  SILVER: 'bg-slate-200 text-slate-700 border-slate-400',
  BRONZE: 'bg-orange-100 text-orange-700 border-orange-300',
  NONE: 'bg-slate-100 text-slate-500 border-slate-300',
};

const TIER_PCT: Record<string, number> = { DIAMOND: 25, GOLD: 15, SILVER: 10, BRONZE: 5, NONE: 0 };

export default function ScholarshipPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [walletData, setWalletData] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [tab, setTab] = useState<'wallet' | 'ledger' | 'calculator' | 'advisor'>('wallet');

  // Calculator
  const [calcExam, setCalcExam] = useState('75');
  const [calcAttendance, setCalcAttendance] = useState('90');
  const [calcTuition, setCalcTuition] = useState('5000');
  const [calcResult, setCalcResult] = useState<any>(null);

  useEffect(() => {
    api.get('/students').then(r => setStudents(r.data));
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      api.get(`/scholarship/wallet/${selectedStudent}`).then(r => setWalletData(r.data));
      api.get(`/scholarship/ledger/${selectedStudent}`).then(r => setLedger(r.data));
    }
  }, [selectedStudent]);

  const runCalculator = async () => {
    const r = await api.post('/scholarship/calculate', {
      examAvg: parseFloat(calcExam), attendancePct: parseFloat(calcAttendance), tuitionAmount: parseFloat(calcTuition),
    });
    setCalcResult(r.data);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Scholarship Module</h1>

        {/* Student selector */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Student</label>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
            <option value="">Choose a student</option>
            {students.map((s: any) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName} ({s.admissionNo})</option>)}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {[{ id: 'wallet', l: 'Wallet' }, { id: 'ledger', l: 'Ledger' }, { id: 'calculator', l: 'Calculator' }, { id: 'advisor', l: 'Upgrade Advisor' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>{t.l}</button>
          ))}
        </div>

        {/* WALLET TAB */}
        {tab === 'wallet' && (
          <div className="space-y-4">
            {walletData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold border ${TIER_COLORS[walletData.wallet.tier]}`}>
                      {walletData.wallet.tier} {walletData.wallet.tier !== 'NONE' && `${TIER_PCT[walletData.wallet.tier]}%`}
                    </span>
                    <p className="text-xs text-slate-500 mt-2">Current Tier</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(walletData.wallet.balance)}</p>
                    <p className="text-xs text-slate-500">Wallet Balance</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(walletData.totalCredited)}</p>
                    <p className="text-xs text-slate-500">Total Credited</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(walletData.totalDebited)}</p>
                    <p className="text-xs text-slate-500">Total Applied</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Recent Transactions</h3>
                  {walletData.recentTransactions.length === 0 ? (
                    <p className="text-slate-400 text-sm">No transactions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {walletData.recentTransactions.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                          <div>
                            <p className="text-sm text-slate-900">{t.description || t.type}</p>
                            <p className="text-xs text-slate-400">{t.month} | {new Date(t.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`text-sm font-semibold ${t.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                            {t.type === 'CREDIT' ? '+' : '-'}{formatCurrency(t.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">Select a student to view wallet</div>
            )}
          </div>
        )}

        {/* LEDGER TAB */}
        {tab === 'ledger' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Date</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Type</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Description</th>
                  <th className="text-right px-4 py-2 text-sm font-medium text-slate-500">Amount</th>
                  <th className="text-right px-4 py-2 text-sm font-medium text-slate-500">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No transactions</td></tr>
                ) : (
                  ledger.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm"><span className={`px-2 py-0.5 rounded text-xs font-medium ${t.type === 'CREDIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.type}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-900">{t.description || '-'}</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${t.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'CREDIT' ? '+' : '-'}{formatCurrency(t.amount)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{formatCurrency(t.balance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* CALCULATOR TAB */}
        {tab === 'calculator' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
            <h2 className="text-lg font-semibold">Eligibility Calculator</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Exam Average (%)</label>
                <input type="number" min="0" max="100" value={calcExam} onChange={e => setCalcExam(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Attendance (%)</label>
                <input type="number" min="0" max="100" value={calcAttendance} onChange={e => setCalcAttendance(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Tuition (₹)</label>
                <input type="number" value={calcTuition} onChange={e => setCalcTuition(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </div>
            </div>
            <button onClick={runCalculator} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Calculate</button>

            {calcResult && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-500">Combined Score</p>
                  <p className="text-2xl font-bold">{calcResult.combined}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold border ${TIER_COLORS[calcResult.tier]}`}>
                    {calcResult.tier} — {calcResult.discountPct}%
                  </span>
                  <p className="text-sm text-slate-500 mt-2">Monthly Credit: {formatCurrency(calcResult.credit)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-500">Net Payable</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(calcResult.netPayable)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* UPGRADE ADVISOR TAB */}
        {tab === 'advisor' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-blue-500" /> Upgrade Advisor</h2>
            {calcResult?.nextTier ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <p className="text-sm text-blue-800 mb-4">
                  To reach <strong className={TIER_COLORS[calcResult.nextTier.name]?.split(' ')[1]}>{calcResult.nextTier.name}</strong> ({calcResult.nextTier.pct}% discount):
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-xs text-slate-500">Combined Score Needed</p>
                    <p className="text-xl font-bold text-slate-900">≥ {calcResult.nextTier.needCombined}</p>
                    <p className="text-xs text-slate-400">Currently: {calcResult.combined}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-xs text-slate-500">Exam Average Needed</p>
                    <p className="text-xl font-bold text-slate-900">≥ {calcResult.nextTier.needExam}%</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-xs text-slate-500">Attendance Needed</p>
                    <p className="text-xl font-bold text-slate-900">≥ {calcResult.nextTier.needAttendance}%</p>
                  </div>
                </div>
                <p className="text-sm text-blue-700 mt-4">
                  Projected annual saving: <strong>{formatCurrency(calcResult.nextTier.projectedAnnualSaving)}</strong>
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-6 text-center text-slate-400">
                {calcResult ? 'Already at highest tier!' : 'Run the Calculator first to see upgrade recommendations'}
              </div>
            )}

            {/* Tier reference table */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Tier Requirements</h3>
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Tier</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-slate-500">Combined ≥</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-slate-500">Exam ≥</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-slate-500">Attendance ≥</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-slate-500">Discount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { t: 'DIAMOND', c: 90, e: 88, a: 95, d: '25%' },
                    { t: 'GOLD', c: 80, e: 75, a: 85, d: '15%' },
                    { t: 'SILVER', c: 70, e: 65, a: 80, d: '10%' },
                    { t: 'BRONZE', c: 60, e: 55, a: 75, d: '5%' },
                  ].map(r => (
                    <tr key={r.t}>
                      <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-bold border ${TIER_COLORS[r.t]}`}>{r.t}</span></td>
                      <td className="text-center px-4 py-2 text-sm">{r.c}%</td>
                      <td className="text-center px-4 py-2 text-sm">{r.e}%</td>
                      <td className="text-center px-4 py-2 text-sm">{r.a}%</td>
                      <td className="text-center px-4 py-2 text-sm font-bold">{r.d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
