'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Plus, UsersRound, ChevronRight } from 'lucide-react';

const SIBLING_DISCOUNT_RATE = 0.05; // 5%

export default function FamilyPage() {
  const [families, setFamilies] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<any>(null);
  const [form, setForm] = useState({ name: '', studentIds: [] as string[] });

  // Payment wizard
  const [payStep, setPayStep] = useState(0);
  const [paySelectedStudents, setPaySelectedStudents] = useState<string[]>([]);
  const [payAmounts, setPayAmounts] = useState<Record<string, number>>({});
  const [payMethod, setPayMethod] = useState('UPI');
  // Fee selection per student: { studentId: { feeId, feeName, amount } }
  const [studentPendingFees, setStudentPendingFees] = useState<Record<string, any[]>>({});
  const [selectedFees, setSelectedFees] = useState<Record<string, string>>({});
  const [payingFamily, setPayingFamily] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/families').then(r => setFamilies(r.data)),
      api.get('/students').then(r => setStudents(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  const createFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/families', form);
    setShowForm(false);
    setForm({ name: '', studentIds: [] });
    const r = await api.get('/families');
    setFamilies(r.data);
  };

  const loadFamily = async (id: string) => {
    const r = await api.get(`/families/${id}`);
    setSelectedFamily(r.data);
    setPayStep(0);
    setPaySelectedStudents([]);
    setPayAmounts({});
    setSelectedFees({});
    // Load pending fees for each student
    const feesMap: Record<string, any[]> = {};
    await Promise.all(
      r.data.students.map(async (s: any) => {
        try {
          const res = await api.get(`/fees/student/${s.id}`);
          feesMap[s.id] = res.data.filter((f: any) => f.status !== 'PAID');
        } catch { feesMap[s.id] = []; }
      })
    );
    setStudentPendingFees(feesMap);
  };

  const subtotal = Object.values(payAmounts).reduce((s, a) => s + a, 0);
  const siblingDiscount = paySelectedStudents.length >= 2 ? subtotal * SIBLING_DISCOUNT_RATE : 0;
  const netPayable = subtotal - siblingDiscount;

  const handleFamilyPayment = async () => {
    setPayingFamily(true);
    try {
      const paymentItems = paySelectedStudents
        .filter(sid => payAmounts[sid] > 0 && selectedFees[sid])
        .map(sid => ({
          studentId: sid,
          feeStructureId: selectedFees[sid],
          amount: payAmounts[sid],
        }));
      if (paymentItems.length === 0) { alert('No valid payments'); return; }

      await api.post('/fees/pay-family', {
        payments: paymentItems,
        paymentMethod: payMethod,
      });
      alert('Family payment recorded!');
      setPayStep(0);
      await loadFamily(selectedFamily.id);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Payment failed';
      alert(msg);
    } finally {
      setPayingFamily(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Family & Siblings</h1>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            <Plus className="h-4 w-4" /> Create Family
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Create Family Group</h2>
            <form onSubmit={createFamily} className="space-y-4">
              <input placeholder="Family Name (e.g. Patel Family)" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Siblings</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {students.map((s: any) => (
                    <label key={s.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded text-sm">
                      <input type="checkbox" checked={form.studentIds.includes(s.id)} onChange={e => {
                        setForm({ ...form, studentIds: e.target.checked ? [...form.studentIds, s.id] : form.studentIds.filter(id => id !== s.id) });
                      }} />
                      {s.user.firstName} {s.user.lastName} ({s.admissionNo})
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Create</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Family List */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-slate-500 uppercase">Families</h2>
            {families.map((f: any) => (
              <button key={f.id} onClick={() => loadFamily(f.id)} className={`w-full text-left bg-white rounded-xl border p-4 hover:border-blue-300 transition ${selectedFamily?.id === f.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UsersRound className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{f.name}</p>
                      <p className="text-xs text-slate-500">{f.totalStudents} student(s) | {f.familyId}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </button>
            ))}
            {families.length === 0 && <p className="text-sm text-slate-400">No families created</p>}
          </div>

          {/* Family Detail */}
          <div className="lg:col-span-2">
            {selectedFamily ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{selectedFamily.name}</h2>
                    <p className="text-sm text-slate-500">{selectedFamily.familyId}</p>
                  </div>
                  {payStep === 0 && selectedFamily.students.length >= 1 && (
                    <button onClick={() => setPayStep(1)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                      Combined Payment
                    </button>
                  )}
                </div>

                {/* Students in family */}
                {payStep === 0 && (
                  <div className="space-y-3">
                    {selectedFamily.students.map((s: any) => (
                      <div key={s.id} className="bg-slate-50 rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.user.firstName} {s.user.lastName}</p>
                          <p className="text-xs text-slate-500">{s.class?.name} - {s.section?.name} | {s.admissionNo}</p>
                        </div>
                        <p className="text-sm text-slate-600">
                          Paid: {formatCurrency(s.payments.filter((p: any) => p.status === 'PAID').reduce((sum: number, p: any) => sum + p.amountPaid, 0))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Step 1: Select siblings */}
                {payStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-slate-700">Step 1: Select siblings to pay for</h3>
                    {selectedFamily.students.map((s: any) => (
                      <label key={s.id} className="flex items-center gap-3 bg-slate-50 rounded-lg p-4">
                        <input type="checkbox" checked={paySelectedStudents.includes(s.id)} onChange={e => {
                          setPaySelectedStudents(e.target.checked ? [...paySelectedStudents, s.id] : paySelectedStudents.filter(id => id !== s.id));
                        }} />
                        <span className="text-sm text-slate-900">{s.user.firstName} {s.user.lastName} — {s.class?.name}</span>
                      </label>
                    ))}
                    <button onClick={() => setPayStep(2)} disabled={paySelectedStudents.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Next</button>
                  </div>
                )}

                {/* Step 2: Select fee & enter amounts */}
                {payStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-slate-700">Step 2: Select fee & amount per student</h3>
                    {paySelectedStudents.map(sid => {
                      const s = selectedFamily.students.find((st: any) => st.id === sid);
                      const pending = studentPendingFees[sid] || [];
                      return (
                        <div key={sid} className="bg-slate-50 rounded-lg p-4 space-y-2">
                          <p className="text-sm font-medium text-slate-900">{s?.user.firstName} {s?.user.lastName} <span className="text-slate-400 font-normal">— {s?.class?.name}</span></p>
                          {pending.length === 0 ? (
                            <p className="text-xs text-green-600">All fees paid</p>
                          ) : (
                            <div className="flex items-center gap-3">
                              <select value={selectedFees[sid] || ''} onChange={e => {
                                const fee = pending.find((f: any) => f.id === e.target.value);
                                setSelectedFees({...selectedFees, [sid]: e.target.value});
                                if (fee) setPayAmounts({...payAmounts, [sid]: fee.amount});
                              }} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                                <option value="">Select fee</option>
                                {pending.map((f: any) => <option key={f.id} value={f.id}>{f.name} — {formatCurrency(f.amount)}</option>)}
                              </select>
                              <input type="number" placeholder="Amount" value={payAmounts[sid] || ''} onChange={e => setPayAmounts({...payAmounts, [sid]: parseFloat(e.target.value) || 0})} className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex gap-2">
                      <button onClick={() => setPayStep(1)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Back</button>
                      <button onClick={() => setPayStep(3)} disabled={paySelectedStudents.every(sid => !selectedFees[sid])} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Next</button>
                    </div>
                  </div>
                )}

                {/* Step 3: Payment mode */}
                {payStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-slate-700">Step 3: Payment details</h3>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      {['UPI', 'CARD', 'NET_BANKING', 'CASH', 'CHEQUE', 'DD'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => setPayStep(2)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Back</button>
                      <button onClick={() => setPayStep(4)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Review</button>
                    </div>
                  </div>
                )}

                {/* Step 4: Confirmation */}
                {payStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-slate-700">Step 4: Confirm Payment</h3>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                      {paySelectedStudents.filter(sid => selectedFees[sid] && payAmounts[sid]).map(sid => {
                        const s = selectedFamily.students.find((st: any) => st.id === sid);
                        const fee = (studentPendingFees[sid] || []).find((f: any) => f.id === selectedFees[sid]);
                        return (
                          <div key={sid} className="flex justify-between text-sm">
                            <span>{s?.user.firstName} {s?.user.lastName} <span className="text-slate-400">({fee?.name})</span></span>
                            <span>{formatCurrency(payAmounts[sid] || 0)}</span>
                          </div>
                        );
                      })}
                      <hr className="border-slate-300" />
                      <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                      {siblingDiscount > 0 && (
                        <div className="flex justify-between text-sm text-green-600"><span>Sibling Discount (5%)</span><span>-{formatCurrency(siblingDiscount)}</span></div>
                      )}
                      <div className="flex justify-between text-sm font-bold"><span>Net Payable</span><span>{formatCurrency(netPayable)}</span></div>
                      <div className="text-xs text-slate-500">Mode: {payMethod.replace('_', ' ')}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setPayStep(3)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm" disabled={payingFamily}>Back</button>
                      <button onClick={handleFamilyPayment} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50" disabled={payingFamily}>
                        {payingFamily ? 'Processing...' : 'Confirm & Pay'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                Select a family to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
