'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ArrowRightLeft, Eye, CheckCircle, AlertTriangle, GraduationCap, ArrowUpCircle, Loader2 } from 'lucide-react';

interface PreviewItem {
  classId: string;
  className: string;
  numericGrade: number;
  studentCount: number;
  action: 'PROMOTE' | 'GRADUATE';
}

interface RolloverResult {
  promoted: number;
  graduated: number;
  totalBalanceCarried: number;
}

export default function RolloverPage() {
  const [fromYear, setFromYear] = useState('2025-2026');
  const [toYear, setToYear] = useState('2026-2027');
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [result, setResult] = useState<RolloverResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const loadPreview = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.get('/academic/rollover');
      setPreview(res.data);
    } catch {
      setError('Failed to load rollover preview');
    } finally {
      setLoading(false);
    }
  };

  const confirmRollover = async () => {
    if (!confirm('Are you sure you want to perform the academic year rollover? This action cannot be undone.')) {
      return;
    }
    setConfirming(true);
    setError('');
    try {
      const res = await api.post('/academic/rollover', { fromYear, toYear });
      setResult(res.data);
      setPreview(null);
    } catch {
      setError('Rollover failed. Please check data and try again.');
    } finally {
      setConfirming(false);
    }
  };

  const totalStudents = preview?.reduce((s, p) => s + p.studentCount, 0) ?? 0;
  const totalPromoting = preview?.filter((p) => p.action === 'PROMOTE').reduce((s, p) => s + p.studentCount, 0) ?? 0;
  const totalGraduating = preview?.filter((p) => p.action === 'GRADUATE').reduce((s, p) => s + p.studentCount, 0) ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Academic Year Rollover</h1>
        </div>

        {/* Year Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Configure Rollover</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Academic Year</label>
              <select
                value={fromYear}
                onChange={(e) => setFromYear(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
              >
                <option value="2024-2025">2024-2025</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Academic Year</label>
              <select
                value={toYear}
                onChange={(e) => setToYear(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
              >
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
                <option value="2027-2028">2027-2028</option>
              </select>
            </div>
            <div>
              <button
                onClick={loadPreview}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                {loading ? 'Loading...' : 'Preview Rollover'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Preview Table */}
        {preview && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                <p className="text-3xl font-bold text-slate-900">{totalStudents}</p>
                <p className="text-sm text-slate-500 mt-1">Total Students</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                <div className="flex items-center justify-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-green-600" />
                  <p className="text-3xl font-bold text-green-600">{totalPromoting}</p>
                </div>
                <p className="text-sm text-slate-500 mt-1">Will Be Promoted</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
                <div className="flex items-center justify-center gap-2">
                  <GraduationCap className="h-5 w-5 text-purple-600" />
                  <p className="text-3xl font-bold text-purple-600">{totalGraduating}</p>
                </div>
                <p className="text-sm text-slate-500 mt-1">Will Graduate</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-900">Class-wise Breakdown</h2>
                <span className="text-sm text-slate-500">
                  {fromYear} &rarr; {toYear}
                </span>
              </div>
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Class</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Class No.</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Students</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((item) => (
                    <tr key={item.classId} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-sm font-medium text-slate-900">{item.className}</td>
                      <td className="px-4 py-3 text-sm text-center text-slate-600">{item.numericGrade}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-slate-900">{item.studentCount}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            item.action === 'GRADUATE'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {item.action === 'GRADUATE' ? (
                            <GraduationCap className="h-3 w-3" />
                          ) : (
                            <ArrowUpCircle className="h-3 w-3" />
                          )}
                          {item.action === 'GRADUATE' ? 'Graduate' : `Promote to Class ${item.numericGrade + 1}`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Confirm Button */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-amber-800">Warning: This action is irreversible</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    Confirming will promote {totalPromoting} students to the next class, mark {totalGraduating} as
                    graduated, and carry forward any outstanding fee balances to {toYear}.
                  </p>
                  <button
                    onClick={confirmRollover}
                    disabled={confirming}
                    className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {confirming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    {confirming ? 'Processing Rollover...' : 'Confirm Rollover'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Results */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <h2 className="text-lg font-semibold text-green-800">Rollover Complete</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border border-green-200 p-4 text-center">
                <p className="text-3xl font-bold text-green-700">{result.promoted}</p>
                <p className="text-sm text-slate-600 mt-1">Students Promoted</p>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-4 text-center">
                <p className="text-3xl font-bold text-purple-700">{result.graduated}</p>
                <p className="text-sm text-slate-600 mt-1">Students Graduated</p>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-4 text-center">
                <p className="text-3xl font-bold text-amber-700">{formatCurrency(result.totalBalanceCarried)}</p>
                <p className="text-sm text-slate-600 mt-1">Balance Carried Forward</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
