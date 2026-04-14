'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Trash2, IndianRupee, TrendingUp, TrendingDown, Wallet, CheckCircle } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'SALARY', 'INFRASTRUCTURE', 'UTILITIES', 'STATIONERY', 'TRANSPORT',
  'MAINTENANCE', 'EVENTS', 'SPORTS', 'TECHNOLOGY', 'MARKETING', 'INSURANCE', 'MISCELLANEOUS',
];
const PAYMENT_MODES = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const categoryColors: Record<string, string> = {
  SALARY: 'bg-blue-100 text-blue-700',
  INFRASTRUCTURE: 'bg-purple-100 text-purple-700',
  UTILITIES: 'bg-yellow-100 text-yellow-700',
  STATIONERY: 'bg-pink-100 text-pink-700',
  TRANSPORT: 'bg-green-100 text-green-700',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
  EVENTS: 'bg-indigo-100 text-indigo-700',
  SPORTS: 'bg-teal-100 text-teal-700',
  TECHNOLOGY: 'bg-cyan-100 text-cyan-700',
  MARKETING: 'bg-rose-100 text-rose-700',
  INSURANCE: 'bg-amber-100 text-amber-700',
  MISCELLANEOUS: 'bg-slate-100 text-slate-700',
};

export default function FinancePage() {
  const [tab, setTab] = useState<'overview' | 'expenses' | 'salaries'>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [expForm, setExpForm] = useState({
    category: 'MISCELLANEOUS', title: '', description: '', amount: '', date: '', paidTo: '', paymentMode: 'CASH', receiptRef: '',
  });
  const [salForm, setSalForm] = useState({
    teacherId: '', month: new Date().toISOString().slice(0, 7), basicPay: '', hra: '', da: '', ta: '', deductions: '',
  });

  // Filters
  const [salaryMonth, setSalaryMonth] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/finance/summary').then(r => setSummary(r.data)),
      api.get('/finance/expenses').then(r => setExpenses(r.data)),
      api.get('/finance/salaries').then(r => setSalaries(r.data)),
      api.get('/teachers').then(r => setTeachers(r.data)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  const refreshData = async () => {
    const [sumR, expR, salR] = await Promise.all([
      api.get('/finance/summary'),
      api.get('/finance/expenses', { params: expenseCategory ? { category: expenseCategory } : {} }),
      api.get('/finance/salaries', { params: salaryMonth ? { month: salaryMonth } : {} }),
    ]);
    setSummary(sumR.data);
    setExpenses(expR.data);
    setSalaries(salR.data);
  };

  useEffect(() => {
    if (!loading) api.get('/finance/expenses', { params: expenseCategory ? { category: expenseCategory } : {} }).then(r => setExpenses(r.data));
  }, [expenseCategory]);

  useEffect(() => {
    if (!loading) api.get('/finance/salaries', { params: salaryMonth ? { month: salaryMonth } : {} }).then(r => setSalaries(r.data));
  }, [salaryMonth]);

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/finance/expenses', expForm);
      setShowExpenseForm(false);
      setExpForm({ category: 'MISCELLANEOUS', title: '', description: '', amount: '', date: '', paidTo: '', paymentMode: 'CASH', receiptRef: '' });
      refreshData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed');
    }
  };

  const handleSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/finance/salaries', salForm);
      setShowSalaryForm(false);
      setSalForm({ teacherId: '', month: new Date().toISOString().slice(0, 7), basicPay: '', hra: '', da: '', ta: '', deductions: '' });
      refreshData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed');
    }
  };

  const markSalaryPaid = async (id: string) => {
    await api.put(`/finance/salaries/${id}`, { status: 'PAID', paymentMode: 'BANK_TRANSFER' });
    refreshData();
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/finance/expenses/${id}`);
    refreshData();
  };

  // Monthly chart data
  const allMonths = summary ? [...new Set([
    ...Object.keys(summary.monthlyIncome || {}),
    ...Object.keys(summary.monthlyExpenses || {}),
  ])].sort() : [];

  const maxMonthly = Math.max(
    ...allMonths.map(m => Math.max(summary?.monthlyIncome?.[m] || 0, summary?.monthlyExpenses?.[m] || 0)),
    1
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">School Finance</h1>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Income</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(summary?.totalIncome || 0)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Expenses</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(summary?.totalExpenses || 0)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <IndianRupee className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Salaries Paid</p>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(summary?.totalSalariesPaid || 0)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <IndianRupee className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Salaries Pending</p>
                    <p className="text-lg font-bold text-orange-600">{formatCurrency(summary?.totalSalariesPending || 0)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Net Balance</p>
                    <p className={`text-lg font-bold ${(summary?.netBalance || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(summary?.netBalance || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'expenses', label: 'Expenses' },
                { id: 'salaries', label: 'Salaries' },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id as any)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >{t.label}</button>
              ))}
            </div>

            {/* OVERVIEW TAB */}
            {tab === 'overview' && summary && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Income vs Expenses bar chart */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold mb-4">Monthly Income vs Expenses</h2>
                  {allMonths.length === 0 ? (
                    <p className="text-slate-400 text-sm">No data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {allMonths.slice(-6).map(m => {
                        const inc = summary.monthlyIncome?.[m] || 0;
                        const exp = summary.monthlyExpenses?.[m] || 0;
                        const [y, mo] = m.split('-');
                        const label = `${MONTHS[parseInt(mo) - 1]} ${y}`;
                        return (
                          <div key={m}>
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                              <span>{label}</span>
                              <span>{formatCurrency(inc)} / {formatCurrency(exp)}</span>
                            </div>
                            <div className="flex gap-1 h-5">
                              <div className="bg-green-400 rounded-l h-full transition-all" style={{ width: `${(inc / maxMonthly) * 100}%` }} title={`Income: ${formatCurrency(inc)}`}></div>
                              <div className="bg-red-400 rounded-r h-full transition-all" style={{ width: `${(exp / maxMonthly) * 100}%` }} title={`Expense: ${formatCurrency(exp)}`}></div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded"></span> Income</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded"></span> Expenses</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expense by category */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold mb-4">Expenses by Category</h2>
                  {Object.keys(summary.byCategory || {}).length === 0 ? (
                    <p className="text-slate-400 text-sm">No expenses recorded yet</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(summary.byCategory as Record<string, number>)
                        .sort(([, a], [, b]) => b - a)
                        .map(([cat, amt]) => {
                          const total = summary.totalExpenses || 1;
                          const pct = ((amt / total) * 100).toFixed(1);
                          return (
                            <div key={cat}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[cat] || 'bg-slate-100 text-slate-700'}`}>{cat}</span>
                                <span className="text-slate-600 font-medium">{formatCurrency(amt)} ({pct}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* EXPENSES TAB */}
            {tab === 'expenses' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                    <option value="">All Categories</option>
                    {EXPENSE_CATEGORIES.filter(c => c !== 'SALARY').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                    <Plus className="h-4 w-4" /> Add Expense
                  </button>
                </div>

                {showExpenseForm && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">Record Expense</h2>
                    <form onSubmit={handleExpenseSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <select value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        {EXPENSE_CATEGORIES.filter(c => c !== 'SALARY').map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input placeholder="Title *" value={expForm.title} onChange={e => setExpForm({ ...expForm, title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      <input placeholder="Amount (₹) *" type="number" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      <input type="date" value={expForm.date} onChange={e => setExpForm({ ...expForm, date: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      <input placeholder="Paid To" value={expForm.paidTo} onChange={e => setExpForm({ ...expForm, paidTo: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <select value={expForm.paymentMode} onChange={e => setExpForm({ ...expForm, paymentMode: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                      </select>
                      <input placeholder="Receipt/Invoice Ref" value={expForm.receiptRef} onChange={e => setExpForm({ ...expForm, receiptRef: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <input placeholder="Description" value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <div className="flex gap-2">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Save</button>
                        <button type="button" onClick={() => setShowExpenseForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Date</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Category</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Title</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Paid To</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Mode</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Amount</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expenses.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No expenses recorded</td></tr>
                      ) : expenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-500">{formatDate(exp.date)}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[exp.category] || 'bg-slate-100'}`}>{exp.category}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900 font-medium">{exp.title}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">{exp.paidTo || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">{exp.paymentMode || '-'}</td>
                          <td className="px-4 py-3 text-sm text-red-600 font-semibold text-right">{formatCurrency(exp.amount)}</td>
                          <td className="px-4 py-3 text-sm">
                            <button onClick={() => deleteExpense(exp.id)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SALARIES TAB */}
            {tab === 'salaries' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <input type="month" value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                  <button onClick={() => setShowSalaryForm(!showSalaryForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                    <Plus className="h-4 w-4" /> Generate Salary
                  </button>
                </div>

                {showSalaryForm && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">Generate Salary</h2>
                    <form onSubmit={handleSalarySubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <select value={salForm.teacherId} onChange={e => setSalForm({ ...salForm, teacherId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required>
                        <option value="">Select Teacher</option>
                        {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName} ({t.employeeId})</option>)}
                      </select>
                      <input type="month" value={salForm.month} onChange={e => setSalForm({ ...salForm, month: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      <input placeholder="Basic Pay *" type="number" value={salForm.basicPay} onChange={e => setSalForm({ ...salForm, basicPay: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      <input placeholder="HRA" type="number" value={salForm.hra} onChange={e => setSalForm({ ...salForm, hra: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <input placeholder="DA" type="number" value={salForm.da} onChange={e => setSalForm({ ...salForm, da: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <input placeholder="TA" type="number" value={salForm.ta} onChange={e => setSalForm({ ...salForm, ta: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <input placeholder="Deductions (PF, Tax)" type="number" value={salForm.deductions} onChange={e => setSalForm({ ...salForm, deductions: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <div className="flex gap-2">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Generate</button>
                        <button type="button" onClick={() => setShowSalaryForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Teacher</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Month</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Basic</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">HRA</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">DA</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">TA</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Deductions</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Net Pay</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Status</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {salaries.length === 0 ? (
                        <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No salary records</td></tr>
                      ) : salaries.map(sal => (
                        <tr key={sal.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-900 font-medium">{sal.teacher?.user?.firstName} {sal.teacher?.user?.lastName}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">{sal.month}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatCurrency(sal.basicPay)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatCurrency(sal.hra)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatCurrency(sal.da)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatCurrency(sal.ta)}</td>
                          <td className="px-4 py-3 text-sm text-red-600 text-right">{formatCurrency(sal.deductions)}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 font-bold text-right">{formatCurrency(sal.netPay)}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${sal.status === 'PAID' ? 'bg-green-100 text-green-700' : sal.status === 'ON_HOLD' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {sal.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {sal.status === 'PENDING' && (
                              <button onClick={() => markSalaryPaid(sal.id)} title="Mark as Paid" className="p-1 text-green-500 hover:text-green-700">
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
