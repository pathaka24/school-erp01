'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { IndianRupee, Wallet, AlertTriangle, RefreshCw, Archive } from 'lucide-react';

const monthLabel = (m: string) => new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
const ayLabel = (y: number) => `${y}–${String((y + 1) % 100).padStart(2, '0')}`;

// Compact Indian currency for big headline numbers (full precision stays in tables)
function compactINR(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

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

// Collection-rate progress ring
function Ring({ pct }: { pct: number }) {
  const r = 40, c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, pct));
  const color = p >= 80 ? '#16a34a' : p >= 60 ? '#d97706' : '#dc2626';
  return (
    <svg width="104" height="104" viewBox="0 0 104 104">
      <circle cx="52" cy="52" r={r} fill="none" stroke="#eef2f6" strokeWidth="10" />
      <circle cx="52" cy="52" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform="rotate(-90 52 52)"
        style={{ transition: 'stroke-dashoffset .6s ease' }} />
      <text x="52" y="50" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">{Math.round(p)}%</text>
      <text x="52" y="66" textAnchor="middle" fontSize="9" fill="#94a3b8">collected</text>
    </svg>
  );
}

// Billed vs collected grouped bar chart (inline SVG — no chart dependency)
function MonthChart({ data }: { data: any[] }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.billed, d.collected)));
  const group = 48, barW = 16, H = 150, padX = 10;
  const width = Math.max(data.length * group + padX * 2, 320);
  const bh = (v: number) => Math.round((v / max) * H);
  return (
    <div className="overflow-x-auto">
      <svg width={width} height={H + 30} className="block">
        {[0.25, 0.5, 0.75, 1].map(g => (
          <line key={g} x1={0} x2={width} y1={H - H * g} y2={H - H * g} stroke="#f1f5f9" strokeWidth={1} />
        ))}
        {data.map((d, i) => {
          const x = i * group + padX;
          return (
            <g key={d.month}>
              <rect x={x} y={H - bh(d.billed)} width={barW} height={bh(d.billed)} rx={3} fill="#cbd5e1">
                <title>{`Billed ${formatCurrency(d.billed)}`}</title>
              </rect>
              <rect x={x + barW + 4} y={H - bh(d.collected)} width={barW} height={bh(d.collected)} rx={3} fill="#22c55e">
                <title>{`Collected ${formatCurrency(d.collected)}`}</title>
              </rect>
              <text x={x + barW + 2} y={H + 16} textAnchor="middle" fontSize="9.5" fill="#94a3b8">{monthLabel(d.month)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const AG_TONE: Record<string, { text: string; bar: string }> = {
  slate: { text: 'text-slate-700', bar: 'bg-slate-400' },
  amber: { text: 'text-amber-700', bar: 'bg-amber-400' },
  orange: { text: 'text-orange-700', bar: 'bg-orange-500' },
  red: { text: 'text-red-700', bar: 'bg-red-500' },
};
function AgingCell({ label, value, tone, total }: { label: string; value: number; tone: string; total: number }) {
  const t = AG_TONE[tone];
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${t.text}`}>{compactINR(value)}</p>
      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5"><div className={`h-1.5 rounded-full ${t.bar}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function LedgerFinancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ay, setAy] = useState<number | null>(null);
  const [itemModal, setItemModal] = useState<{ category: string; label: string } | null>(null);
  const [itemRows, setItemRows] = useState<any[]>([]);
  const [itemLoading, setItemLoading] = useState(false);

  const openItem = async (category: string, label: string) => {
    setItemModal({ category, label }); setItemRows([]); setItemLoading(true);
    try { const { data } = await api.get('/fee-reports/item-students', { params: { category } }); setItemRows(data.students || []); }
    catch { setItemRows([]); } finally { setItemLoading(false); }
  };

  const load = async (year?: number) => {
    setLoading(true);
    try {
      const { data } = await api.get('/fee-reports/ledger-finance', { params: year ? { ay: year } : {} });
      setData(data); setAy(data.ay);
    } catch { setData(null); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Re-fetch when the tab regains focus, so a void/edit made on a student's
  // ledger is reflected here without a manual refresh.
  useEffect(() => {
    const refetch = () => { if (!document.hidden) load(ay ?? undefined); };
    window.addEventListener('focus', refetch);
    document.addEventListener('visibilitychange', refetch);
    return () => { window.removeEventListener('focus', refetch); document.removeEventListener('visibilitychange', refetch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ay]);

  if (loading && !data) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div></DashboardLayout>;
  }
  if (!data) {
    return <DashboardLayout><div className="text-center py-16 text-slate-400">Could not load fee finance.</div></DashboardLayout>;
  }

  const t = data.totals;
  const ag = data.aging || { current: 0, m1: 0, m23: 0, m4plus: 0 };
  const agTotal = ag.current + ag.m1 + ag.m23 + ag.m4plus;

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
                  <p className="text-xs text-slate-500">School-wide fee position, computed entirely from the ledger.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href="/fee-reports/archived" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200" title="View and restore archived fee entries">
                  <Archive className="h-4 w-4" /> Archived
                </a>
                <select value={ay ?? data.ay} onChange={e => { const y = parseInt(e.target.value, 10); setAy(y); load(y); }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
                  {data.availableYears.map((y: number) => <option key={y} value={y}>AY {ayLabel(y)}</option>)}
                </select>
                <button onClick={() => load(ay ?? undefined)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
            </div>
          </FadeIn>

          {/* Headline band */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex flex-col items-center md:pr-6 md:border-r border-slate-100">
                <Ring pct={t.collectionRate} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500">Collected · AY {ayLabel(data.ay)}</p>
                <p className="text-3xl font-bold text-green-600 leading-tight">{compactINR(t.collected)}</p>
                <p className="text-xs text-slate-400 mt-1">of {compactINR(t.billed)} billed · {compactINR(t.discount)} discount{t.scholarship > 0 ? ` (incl. ${compactINR(t.scholarship)} scholarship)` : ''}</p>
                <p className="text-[11px] text-slate-400">{t.depositCount} payments</p>
              </div>
              <div className="flex-1 md:pl-6 md:border-l border-slate-100">
                <p className="text-xs text-slate-500">Outstanding · as of today</p>
                <p className="text-3xl font-bold text-red-600 leading-tight">{compactINR(t.outstanding)}</p>
                <p className="text-xs text-slate-400 mt-1">{data.counts.defaulters} defaulters · {compactINR(t.advance)} advance ({data.counts.advance} students)</p>
                <p className="text-[11px] text-slate-400">{data.counts.students} students on ledger · {data.counts.clear} cleared</p>
              </div>
            </div>
          </div>

          {/* Outstanding aging */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Outstanding aging <span className="text-xs font-normal text-slate-400">— how overdue the dues are (as of today)</span></h2>
              <a href="/fees/dues" className="text-xs text-blue-600 hover:underline">Chase dues →</a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <AgingCell label="Current (not overdue)" value={ag.current} tone="slate" total={agTotal} />
              <AgingCell label="1 month overdue" value={ag.m1} tone="amber" total={agTotal} />
              <AgingCell label="2–3 months overdue" value={ag.m23} tone="orange" total={agTotal} />
              <AgingCell label="Over 3 months overdue" value={ag.m4plus} tone="red" total={agTotal} />
            </div>
          </div>

          {/* Month chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">Billed vs Collected — AY {ayLabel(data.ay)}</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Billed</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-500" /> Collected</span>
              </div>
            </div>
            <MonthChart data={data.byMonth} />
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
                    {data.byCategory.length === 0 && <tr><td colSpan={4} className="px-2 py-6 text-center text-slate-400">No charges this year.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">&quot;Kids&quot; = distinct students charged · &quot;Qty&quot; = number of charge entries. Click a row for the list.</p>
            </div>

            {/* By method */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Collected by Method</h2>
              <div className="space-y-2.5">
                {data.byMethod.map((m: any) => {
                  const pct = t.collected > 0 ? Math.round((m.total / t.collected) * 100) : 0;
                  return (
                    <div key={m.method}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 flex items-center gap-1"><Wallet className="h-3.5 w-3.5 text-slate-300" /> {m.method.replace('_', ' ')} <span className="text-xs text-slate-400">· {m.count}</span></span>
                        <span className="font-semibold text-green-700">{formatCurrency(m.total)} <span className="text-xs text-slate-400 font-normal">{pct}%</span></span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1"><div className="h-1.5 rounded-full bg-green-400" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
                {data.byMethod.length === 0 && <p className="text-sm text-slate-400">No collections this year.</p>}
              </div>
            </div>
          </div>

          {/* By class */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">By Class — AY {ayLabel(data.ay)}</h2>
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
                      <button onClick={() => printItemList(itemModal.label, itemRows)} className="px-3 py-1.5 text-xs bg-slate-700 text-white rounded-lg hover:bg-slate-800">Print / Save</button>
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
