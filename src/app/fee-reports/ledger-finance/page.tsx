'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { IndianRupee, TrendingUp, TrendingDown, Wallet, Users, AlertTriangle, Tag, RefreshCw } from 'lucide-react';

const monthLabel = (m: string) => new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

function printItemList(label: string, rows: any[]) {
  const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
  const body = rows.map((r, i) => `<tr>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${i + 1}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${r.name} <span style="color:#94a3b8">${r.admissionNo}</span></td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${r.class}${r.section ? ' - ' + r.section : ''}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:right">${fmt(r.amount)}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:right;color:#15803d">${fmt(r.paid)}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:right;color:${r.due > 0 ? '#dc2626' : '#64748b'}">${r.due > 0 ? fmt(r.due) : '—'}</td>
  </tr>`).join('');
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const html = `<!DOCTYPE html><html><head><title>${label} — students</title>
<style>body{font-family:Arial,sans-serif;margin:22px;color:#1e293b;font-size:12px}
h1{font-size:18px;color:#1e40af;margin:0}.sub{font-size:12px;color:#64748b;margin:2px 0 14px}
table{width:100%;border-collapse:collapse}th{background:#1e40af;color:#fff;padding:6px 8px;text-align:left;font-size:11px;text-transform:uppercase}
.tot td{background:#dcfce7;font-weight:bold;padding:7px 8px;border:1px solid #e2e8f0}</style></head>
<body>
  <h1>${label} — Students</h1>
  <div class="sub">${rows.length} students · Printed ${new Date().toLocaleDateString('en-IN')}</div>
  <table>
    <thead><tr><th>#</th><th>Student</th><th>Class</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th style="text-align:right">Due</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr class="tot"><td colspan="3">TOTAL (${rows.length})</td><td style="text-align:right">${fmt(total)}</td><td colspan="2"></td></tr></tfoot>
  </table>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export default function LedgerFinancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Item drill-down: who bought a given item
  const [itemModal, setItemModal] = useState<{ category: string; label: string } | null>(null);
  const [itemRows, setItemRows] = useState<any[]>([]);
  const [itemLoading, setItemLoading] = useState(false);

  const openItem = async (category: string, label: string) => {
    setItemModal({ category, label });
    setItemRows([]);
    setItemLoading(true);
    try {
      const { data } = await api.get('/fee-reports/item-students', { params: { category } });
      setItemRows(data.students || []);
    } catch { setItemRows([]); }
    finally { setItemLoading(false); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fee-reports/ledger-finance');
      setData(data);
    } catch { setData(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div></DashboardLayout>;
  }
  if (!data) {
    return <DashboardLayout><div className="text-center py-16 text-slate-400">Could not load fee finance.</div></DashboardLayout>;
  }

  const t = data.totals;
  const maxMonth = Math.max(1, ...data.byMonth.map((m: any) => Math.max(m.billed, m.collected)));

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-5">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <IndianRupee className="h-6 w-6 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Fee Ledger Finance</h1>
                  <p className="text-xs text-slate-500">School-wide fee position computed entirely from the ledger.</p>
                </div>
              </div>
              <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
          </FadeIn>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi label="Total Billed" value={formatCurrency(t.billed)} icon={<TrendingUp className="h-4 w-4 text-slate-500" />} />
            <Kpi label="Collected" value={formatCurrency(t.collected)} accent="text-green-600" icon={<Wallet className="h-4 w-4 text-green-500" />} sub={`${t.depositCount} payments`} />
            <Kpi label="Discounts" value={formatCurrency(t.discount)} accent="text-violet-600" icon={<Tag className="h-4 w-4 text-violet-500" />} sub={t.scholarship > 0 ? `incl. ${formatCurrency(t.scholarship)} scholarship` : undefined} />
            <Kpi label="Outstanding" value={formatCurrency(t.outstanding)} accent="text-red-600" icon={<TrendingDown className="h-4 w-4 text-red-500" />} sub={`${data.counts.defaulters} defaulters`} />
            <Kpi label="Advance" value={formatCurrency(t.advance)} accent="text-blue-600" sub={`${data.counts.advance} students`} />
            <Kpi label="Collection Rate" value={`${t.collectionRate}%`} accent={t.collectionRate >= 80 ? 'text-green-600' : t.collectionRate >= 60 ? 'text-amber-600' : 'text-red-600'} />
          </div>

          {/* Counts strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-6 flex-wrap text-sm">
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" /> <strong>{data.counts.students}</strong> students on ledger</span>
            <span className="flex items-center gap-2 text-green-700"><strong>{data.counts.clear}</strong> cleared</span>
            <span className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-4 w-4" /> <strong>{data.counts.defaulters}</strong> with dues</span>
            <span className="flex items-center gap-2 text-blue-700"><strong>{data.counts.advance}</strong> in advance</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* By category — who bought what */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Items &amp; Charges — kids who bought</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="text-left px-2 py-2">Item</th>
                      <th className="text-right px-2 py-2">Kids</th>
                      <th className="text-right px-2 py-2">Qty</th>
                      <th className="text-right px-2 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byCategory.map((c: any) => (
                      <tr key={c.category} className="hover:bg-blue-50 cursor-pointer" onClick={() => openItem(c.category, c.label)} title="Click to see who bought this">
                        <td className="px-2 py-2 font-medium text-blue-700 underline decoration-dotted">{c.label}</td>
                        <td className="px-2 py-2 text-right text-blue-700 font-semibold">{c.students}</td>
                        <td className="px-2 py-2 text-right text-slate-500">{c.items}</td>
                        <td className="px-2 py-2 text-right font-semibold text-slate-900">{formatCurrency(c.total)}</td>
                      </tr>
                    ))}
                    {data.byCategory.length === 0 && <tr><td colSpan={4} className="px-2 py-6 text-center text-slate-400">No charges yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">&quot;Kids&quot; = distinct students charged for that item · &quot;Qty&quot; = number of charge entries.</p>
            </div>

            {/* By method */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Collected by Method</h2>
              <div className="space-y-2.5">
                {data.byMethod.map((m: any) => (
                  <div key={m.method} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{m.method.replace('_', ' ')} <span className="text-xs text-slate-400">· {m.count}</span></span>
                    <span className="text-sm font-semibold text-green-700">{formatCurrency(m.total)}</span>
                  </div>
                ))}
                {data.byMethod.length === 0 && <p className="text-sm text-slate-400">No collections yet.</p>}
              </div>
            </div>
          </div>

          {/* Month-by-month */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Billed vs Collected — by month</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">Month</th>
                    <th className="text-right px-3 py-2">Billed</th>
                    <th className="text-right px-3 py-2">Collected</th>
                    <th className="text-right px-3 py-2">Discount</th>
                    <th className="text-left px-3 py-2 w-1/3">Collected vs Billed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byMonth.map((m: any) => (
                    <tr key={m.month} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-900">{monthLabel(m.month)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(m.billed)}</td>
                      <td className="px-3 py-2 text-right text-green-600 font-medium">{formatCurrency(m.collected)}</td>
                      <td className="px-3 py-2 text-right text-violet-600">{m.discount > 0 ? formatCurrency(m.discount) : '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Bar pct={(m.collected / maxMonth) * 100} color="bg-green-500" />
                          <span className="text-xs text-slate-400 w-10 text-right">{m.billed > 0 ? Math.round((m.collected / m.billed) * 100) : 0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.byMonth.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No entries.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* By class */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">By Class</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">Class</th>
                    <th className="text-right px-3 py-2">Billed</th>
                    <th className="text-right px-3 py-2">Collected</th>
                    <th className="text-right px-3 py-2">Discount</th>
                    <th className="text-right px-3 py-2">Outstanding</th>
                    <th className="text-center px-3 py-2">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byClass.map((c: any) => (
                    <tr key={c.name} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-900">{c.name}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(c.billed)}</td>
                      <td className="px-3 py-2 text-right text-green-600">{formatCurrency(c.collected)}</td>
                      <td className="px-3 py-2 text-right text-violet-600">{c.discount > 0 ? formatCurrency(c.discount) : '—'}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${c.outstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}>{c.outstanding > 0 ? formatCurrency(c.outstanding) : '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.collectionRate >= 80 ? 'bg-green-100 text-green-700' : c.collectionRate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{c.collectionRate}%</span>
                      </td>
                    </tr>
                  ))}
                  {data.byClass.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No data.</td></tr>}
                </tbody>
                {data.byClass.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(t.billed)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{formatCurrency(t.collected)}</td>
                      <td className="px-3 py-2 text-right text-violet-700">{formatCurrency(t.discount)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{formatCurrency(t.outstanding)}</td>
                      <td className="px-3 py-2 text-center">{t.collectionRate}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Who-bought drill-down modal */}
          {itemModal && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setItemModal(null)}>
              <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Who bought — {itemModal.label}</h3>
                    <p className="text-xs text-slate-500">{itemRows.length} student{itemRows.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {itemRows.length > 0 && (
                      <button onClick={() => printItemList(itemModal.label, itemRows)}
                        className="px-3 py-1.5 text-xs bg-slate-700 text-white rounded-lg hover:bg-slate-800">Print / Save</button>
                    )}
                    <button onClick={() => setItemModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
                  </div>
                </div>
                <div className="overflow-y-auto">
                  {itemLoading ? (
                    <div className="py-10 text-center text-slate-400 text-sm">Loading…</div>
                  ) : itemRows.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-sm">No students.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-2">#</th>
                          <th className="text-left px-4 py-2">Student</th>
                          <th className="text-left px-4 py-2">Class</th>
                          <th className="text-right px-4 py-2">Amount</th>
                          <th className="text-right px-4 py-2">Paid</th>
                          <th className="text-right px-4 py-2">Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {itemRows.map((r: any, i: number) => (
                          <tr key={r.studentId} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                            <td className="px-4 py-2">
                              <a href={`/students/${r.studentId}?tab=fees`} className="font-medium text-blue-600 hover:underline">{r.name}</a>
                              <span className="text-xs text-slate-400 ml-2">{r.admissionNo}</span>
                              {!r.active && <span className="text-[10px] text-amber-600 ml-1">(left)</span>}
                            </td>
                            <td className="px-4 py-2 text-slate-600">{r.class}{r.section ? ` - ${r.section}` : ''}</td>
                            <td className="px-4 py-2 text-right text-slate-900">{formatCurrency(r.amount)}</td>
                            <td className="px-4 py-2 text-right text-green-600">{formatCurrency(r.paid)}</td>
                            <td className={`px-4 py-2 text-right font-medium ${r.due > 0 ? 'text-red-600' : 'text-slate-300'}`}>{r.due > 0 ? formatCurrency(r.due) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}

function Kpi({ label, value, accent, icon, sub }: { label: string; value: string; accent?: string; icon?: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        {icon}
      </div>
      <p className={`text-lg font-bold ${accent || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
