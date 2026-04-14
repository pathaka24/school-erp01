'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { IndianRupee, CheckCircle, Users, Printer } from 'lucide-react';

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE'];

export default function ExamFeesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Form
  const [examName, setExamName] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [action, setAction] = useState<'charge' | 'collect'>('charge');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [receivedBy, setReceivedBy] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)); }, []);

  useEffect(() => {
    if (selectedClass) {
      setLoading(true);
      api.get('/exam-fees', { params: { classId: selectedClass } }).then(r => setData(r.data)).finally(() => setLoading(false));
    }
  }, [selectedClass]);

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => {
    if (selectedStudents.size === data?.students?.length) setSelectedStudents(new Set());
    else setSelectedStudents(new Set(data?.students?.map((s: any) => s.id)));
  };

  const handleSubmit = async () => {
    if (selectedStudents.size === 0 || !feeAmount) { alert('Select students and enter amount'); return; }
    setSubmitting(true);
    try {
      const { data: res } = await api.post('/exam-fees', {
        studentIds: Array.from(selectedStudents),
        examName: examName || undefined,
        amount: parseFloat(feeAmount),
        type: action === 'charge' ? 'CHARGE' : 'DEPOSIT',
        paymentMethod: action === 'collect' ? paymentMethod : undefined,
        receivedBy: action === 'collect' ? receivedBy : undefined,
      });
      setSuccess(res.message);
      setSelectedStudents(new Set());
      setFeeAmount('');
      // Reload
      const r = await api.get('/exam-fees', { params: { classId: selectedClass } });
      setData(r.data);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    setSubmitting(false);
  };

  const handlePrint = () => {
    if (!data) return;
    const cls = classes.find(c => c.id === selectedClass);
    const rows = data.students.map((s: any, i: number) =>
      `<tr><td style="padding:5px 10px;border:1px solid #ddd">${i + 1}</td><td style="padding:5px 10px;border:1px solid #ddd">${s.admissionNo}</td><td style="padding:5px 10px;border:1px solid #ddd;font-weight:600">${s.name}</td><td style="padding:5px 10px;border:1px solid #ddd">${s.section || ''}</td><td style="padding:5px 10px;border:1px solid #ddd;text-align:right">${formatCurrency(s.totalCharged)}</td><td style="padding:5px 10px;border:1px solid #ddd;text-align:right;color:#16a34a">${formatCurrency(s.totalPaid)}</td><td style="padding:5px 10px;border:1px solid #ddd;text-align:right;font-weight:bold;color:${s.totalCharged - s.totalPaid > 0 ? '#dc2626' : '#16a34a'}">${formatCurrency(s.totalCharged - s.totalPaid)}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><title>Exam Fees - ${cls?.name}</title><style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse}th{background:#1e3a8a;color:white;padding:8px 10px;font-size:11px;border:1px solid #ddd}@media print{body{margin:10px}}</style></head><body>
    <div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:bold;color:#006400">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div><div style="font-size:14px;font-weight:bold;margin-top:8px">Exam Fee Collection — ${cls?.name}</div>${examName ? `<div style="font-size:12px;color:#64748b">${examName}</div>` : ''}</div>
    <table><thead><tr><th>#</th><th>Adm No</th><th style="text-align:left">Name</th><th>Sec</th><th style="text-align:right">Charged</th><th style="text-align:right">Paid</th><th style="text-align:right">Balance</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          <FadeIn>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Exam Fee Collection</h1>
                <p className="text-sm text-slate-500">Charge and collect exam fees per class</p>
              </div>
              {data && <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4" /> Print</Button>}
            </div>
          </FadeIn>

          {/* Success */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" /><span className="text-sm font-medium text-green-800">{success}</span></div>
              <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-600 text-sm">Dismiss</button>
            </div>
          )}

          {/* Filters + Action Form */}
          <FadeIn delay={0.05}>
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
                    <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setData(null); setSelectedStudents(new Set()); }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      <option value="">Select Class</option>
                      {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Exam Name</label>
                    <input value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g. SA-1, Annual, Unit Test"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" list="exam-names" />
                    <datalist id="exam-names">
                      {data?.exams?.map((e: any) => <option key={e.id} value={e.name} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Action</label>
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                      <button onClick={() => setAction('charge')} className={`flex-1 px-3 py-1.5 rounded text-xs font-medium ${action === 'charge' ? 'bg-red-500 text-white' : 'text-slate-500'}`}>Charge Fee</button>
                      <button onClick={() => setAction('collect')} className={`flex-1 px-3 py-1.5 rounded text-xs font-medium ${action === 'collect' ? 'bg-green-500 text-white' : 'text-slate-500'}`}>Collect Fee</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₹)</label>
                    <input type="number" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} placeholder="Enter amount"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 font-bold text-center" />
                  </div>
                </div>
                {action === 'collect' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Received By</label>
                      <input value={receivedBy} onChange={e => setReceivedBy(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                  </div>
                )}
                {selectedStudents.size > 0 && feeAmount && (
                  <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                    <span className="text-sm text-slate-600">{selectedStudents.size} students × {formatCurrency(parseFloat(feeAmount))} = <strong>{formatCurrency(selectedStudents.size * parseFloat(feeAmount))}</strong></span>
                    <Button onClick={handleSubmit} disabled={submitting} variant={action === 'charge' ? 'destructive' : 'success'}>
                      {submitting ? 'Processing...' : action === 'charge' ? `Charge ${formatCurrency(selectedStudents.size * parseFloat(feeAmount))}` : `Collect ${formatCurrency(selectedStudents.size * parseFloat(feeAmount))}`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeIn>

          {loading && <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>}

          {/* Student Table */}
          {data && !loading && (
            <FadeIn delay={0.1}>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left"><input type="checkbox" checked={selectedStudents.size === data.students.length && data.students.length > 0} onChange={selectAll} /></th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Adm No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Name</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Sec</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Charged</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Paid</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.students.map((s: any, i: number) => {
                      const balance = s.totalCharged - s.totalPaid;
                      return (
                        <tr key={s.id} className={`hover:bg-slate-50 ${selectedStudents.has(s.id) ? 'bg-blue-50' : ''}`}>
                          <td className="px-4 py-2.5"><input type="checkbox" checked={selectedStudents.has(s.id)} onChange={() => toggleStudent(s.id)} /></td>
                          <td className="px-4 py-2.5 text-xs text-slate-400">{i + 1}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-blue-600">{s.admissionNo}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{s.name}</td>
                          <td className="px-4 py-2.5 text-center text-slate-500">{s.section}</td>
                          <td className="px-4 py-2.5 text-right text-slate-700">{s.totalCharged > 0 ? formatCurrency(s.totalCharged) : '—'}</td>
                          <td className="px-4 py-2.5 text-right text-green-600 font-medium">{s.totalPaid > 0 ? formatCurrency(s.totalPaid) : '—'}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{balance !== 0 ? formatCurrency(balance) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </FadeIn>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
