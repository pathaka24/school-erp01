'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { Shield, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-blue-100 text-blue-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  VOID: 'bg-red-100 text-red-700',
  RESTORE: 'bg-emerald-100 text-emerald-700',
};

export default function FeeAuditLogPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const limit = 50;

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (studentFilter) params.set('studentId', studentFilter);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const { data } = await api.get(`/fee-reports/audit-log?${params.toString()}`);
      setRows(data.rows);
      setTotal(data.total);
    } catch {
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [actionFilter, from, to, studentFilter, offset]);

  const toggle = (id: string) => {
    setExpanded(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const fmtJson = (obj: any) => obj ? JSON.stringify(obj, null, 2) : '—';

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Fee Ledger Audit Log</h1>
                <p className="text-xs text-slate-500">Every change to a fee entry: who, what, when, and why.</p>
              </div>
            </div>
          </FadeIn>

          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <label className="text-xs text-slate-600">
              Action
              <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setOffset(0); }}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">All actions</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="VOID">VOID</option>
                <option value="RESTORE">RESTORE</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">
              From
              <input type="date" value={from} onChange={e => { setFrom(e.target.value); setOffset(0); }}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-600">
              To
              <input type="date" value={to} onChange={e => { setTo(e.target.value); setOffset(0); }}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-600">
              Student ID
              <input value={studentFilter} onChange={e => { setStudentFilter(e.target.value); setOffset(0); }}
                placeholder="(optional)"
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
            <div className="flex items-end">
              <button onClick={() => { setActionFilter(''); setFrom(''); setTo(''); setStudentFilter(''); setOffset(0); }}
                className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">
                Clear filters
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loading && <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>}
            {!loading && rows.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">No audit entries match the filters.</div>
            )}
            {!loading && rows.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left w-8"></th>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Entry</th>
                    <th className="px-3 py-2 text-left">By</th>
                    <th className="px-3 py-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(r => {
                    const isOpen = expanded.has(r.id);
                    const summary = r.action === 'UPDATE'
                      ? `Amount ${formatCurrency(r.before?.amount ?? 0)} → ${formatCurrency(r.after?.amount ?? 0)}`
                      : r.action === 'VOID'
                        ? `${r.before?.type || '?'} of ${formatCurrency(r.before?.amount ?? 0)}`
                        : r.action === 'RESTORE'
                          ? `Restored ${r.after?.type || '?'} of ${formatCurrency(r.after?.amount ?? 0)}`
                          : '';
                    return (
                      <>
                        <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => toggle(r.id)}>
                          <td className="px-3 py-2 text-slate-400">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-700">
                            <div>{new Date(r.createdAt).toLocaleString('en-IN')}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[r.action] || 'bg-slate-100 text-slate-700'}`}>
                              {r.action}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {r.studentName || <span className="text-slate-400">{r.studentId.slice(0, 8)}</span>}
                            {r.studentId && (
                              <Link href={`/students/${r.studentId}`}
                                onClick={e => e.stopPropagation()}
                                className="ml-2 text-xs text-blue-600 hover:underline">view</Link>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{summary}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">{r.userName || r.userId || '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">{r.reason || '—'}</td>
                        </tr>
                        {isOpen && (
                          <tr key={`${r.id}-details`}>
                            <td colSpan={7} className="bg-slate-50 px-6 py-3">
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <p className="font-semibold text-slate-700 mb-1">Before</p>
                                  <pre className="bg-white border border-slate-200 rounded p-2 overflow-auto max-h-48 text-slate-700">{fmtJson(r.before)}</pre>
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-700 mb-1">After</p>
                                  <pre className="bg-white border border-slate-200 rounded p-2 overflow-auto max-h-48 text-slate-700">{fmtJson(r.after)}</pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm">
                <p className="text-slate-600">
                  Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700 disabled:opacity-40">
                    Previous
                  </button>
                  <button onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total}
                    className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700 disabled:opacity-40">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
