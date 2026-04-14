'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { formatCurrency } from '@/lib/utils';
import { UserPlus, Check, Printer, Trash2, Plus, IndianRupee, Users } from 'lucide-react';

const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const CHARGE_TEMPLATES = [
  { category: 'ADMISSION', description: 'Admission Charge', amount: '' },
  { category: 'ANNUAL', description: 'Annual Charge', amount: '' },
  { category: 'REGISTRATION', description: 'Registration', amount: '' },
  { category: 'BOOK', description: 'Book', amount: '' },
  { category: 'DRESS', description: 'Dress-I', amount: '' },
  { category: 'COPY', description: 'Copy', amount: '' },
  { category: 'DAIRY', description: 'Dairy', amount: '' },
  { category: 'TIE_BELT', description: 'Tie / Belt', amount: '' },
];

interface Child {
  firstName: string; lastName: string; dateOfBirth: string; gender: string;
  bloodGroup: string; classId: string; sectionId: string;
  charges: { category: string; description: string; amount: string }[];
}

const emptyChild = (): Child => ({
  firstName: '', lastName: '', dateOfBirth: '', gender: 'MALE',
  bloodGroup: '', classId: '', sectionId: '',
  charges: CHARGE_TEMPLATES.map(c => ({ ...c })),
});

export default function FamilyAdmissionPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [step, setStep] = useState<'children' | 'parent' | 'charges' | 'review'>('children');

  const [children, setChildren] = useState<Child[]>([emptyChild(), emptyChild()]);
  const [parentForm, setParentForm] = useState({
    familyName: '',
    fatherName: '', fatherOccupation: '', fatherPhone: '', fatherEmail: '',
    motherName: '', motherOccupation: '', motherPhone: '', motherEmail: '',
    currentAddress: '', currentCity: '', currentState: '', currentPincode: '',
  });
  const [deposit, setDeposit] = useState({ amount: '', paymentMethod: 'CASH', receivedBy: '' });
  const [previousBalance, setPreviousBalance] = useState('');

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)); }, []);

  const updateChild = (idx: number, field: string, value: string) => {
    const c = [...children];
    (c[idx] as any)[field] = value;
    if (field === 'classId') c[idx].sectionId = '';
    // Auto-set family name from first child's last name
    if (field === 'lastName' && idx === 0 && !parentForm.familyName) {
      setParentForm(p => ({ ...p, familyName: value ? `${value} Family` : '' }));
    }
    setChildren(c);
  };

  const updateCharge = (childIdx: number, chargeIdx: number, field: string, value: string) => {
    const c = [...children];
    (c[childIdx].charges[chargeIdx] as any)[field] = value;
    setChildren(c);
  };

  const addChild = () => setChildren([...children, emptyChild()]);
  const removeChild = (idx: number) => { if (children.length > 2) setChildren(children.filter((_, i) => i !== idx)); };

  const getChildChargesTotal = (child: Child) => child.charges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  const grandTotal = children.reduce((s, c) => s + getChildChargesTotal(c), 0) + (parseFloat(previousBalance) || 0);
  const depositAmt = parseFloat(deposit.amount) || 0;
  const finalBalance = grandTotal - depositAmt;

  const canProceedChildren = children.every(c => c.firstName && c.lastName && c.dateOfBirth && c.gender && c.classId && c.sectionId);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...parentForm,
        previousBalance: parseFloat(previousBalance) || 0,
        children: children.map(c => ({
          ...c,
          charges: c.charges.filter(ch => parseFloat(ch.amount) > 0).map(ch => ({ ...ch, amount: parseFloat(ch.amount) })),
        })),
        deposit: depositAmt > 0 ? { amount: depositAmt, paymentMethod: deposit.paymentMethod, receivedBy: deposit.receivedBy } : undefined,
      };
      const { data } = await api.post('/admission/family', payload);
      setSuccess(data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Admission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = () => {
    if (!success) return;
    const s = success;
    let childRows = s.children.map((c: any) =>
      `<tr><td style="padding:6px 12px">${c.user.firstName} ${c.user.lastName}</td><td style="padding:6px 12px">${c.admissionNo}</td><td style="padding:6px 12px">${c.class?.name} - ${c.section?.name}</td><td style="padding:6px 12px;text-align:right">${c.childBalance?.toLocaleString('en-IN') || '—'}</td><td style="padding:6px 12px;text-align:right;color:green">${c.depositAmount?.toLocaleString('en-IN') || '—'}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><title>Family Admission - ${s.family.name}</title>
      <style>body{font-family:Arial;margin:20px;color:#1e293b}.header{text-align:center;border-bottom:3px solid #1e40af;padding-bottom:16px;margin-bottom:20px}.school{font-size:22px;font-weight:bold;color:#1e40af}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f1f5f9;padding:8px 12px;text-align:left;font-size:12px;color:#64748b}td{border-bottom:1px solid #e2e8f0;font-size:13px}.summary{margin:20px 0;padding:16px;border:2px solid #1e40af;border-radius:8px}@media print{body{margin:10px}}</style>
    </head><body>
      <div class="header">
        <div class="school">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
        <div style="font-size:13px;color:#64748b">Family Admission Receipt</div>
        <div style="font-size:16px;font-weight:bold;color:#dc2626;margin-top:8px">${s.family.name} (${s.family.familyId})</div>
        <div style="font-size:12px;color:#64748b">Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
      <table><thead><tr><th>Name</th><th>Adm. No</th><th>Class</th><th style="text-align:right">Charges</th><th style="text-align:right">Paid</th></tr></thead><tbody>${childRows}</tbody></table>
      <div class="summary">
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px"><span>Total Charged</span><strong>₹${s.summary.totalCharged.toLocaleString('en-IN')}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px;color:green"><span>Total Deposited (${deposit.paymentMethod})</span><strong>₹${s.summary.totalDeposited.toLocaleString('en-IN')}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;color:${s.summary.finalBalance > 0 ? '#dc2626' : '#16a34a'}"><span>Balance</span><span>₹${s.summary.finalBalance.toLocaleString('en-IN')}</span></div>
        <div style="font-size:11px;color:#64748b;margin-top:8px">Receipt: ${s.summary.familyReceiptId}</div>
      </div>
      <div style="margin-top:40px;display:flex;justify-content:space-between"><div style="border-top:1px solid #000;width:200px;text-align:center;padding-top:4px;font-size:12px">Parent's Signature</div><div style="border-top:1px solid #000;width:200px;text-align:center;padding-top:4px;font-size:12px">Principal's Signature</div></div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  // ─── SUCCESS ───
  if (success) {
    return (
      <DashboardLayout>
        <PageTransition>
          <div className="max-w-2xl mx-auto mt-8">
            <FadeIn>
              <Card className="p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Family Admission Successful!</h2>
                <p className="text-slate-500 mb-1">{success.children.length} children admitted to <strong>{success.family.name}</strong></p>
                <p className="text-xs text-slate-400 mb-6">{success.family.familyId}</p>

                {/* Children cards */}
                <div className="space-y-3 mb-6 text-left">
                  {success.children.map((c: any) => (
                    <div key={c.id} className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{c.user.firstName} {c.user.lastName}</p>
                        <p className="text-xs text-slate-500">{c.class?.name} - {c.section?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{c.admissionNo}</p>
                        {c.finalBalance != null && (
                          <p className={`text-xs font-medium ${c.finalBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            Bal: {formatCurrency(c.finalBalance)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Total Charged</span><span className="font-bold">{formatCurrency(success.summary.totalCharged)}</span></div>
                  <div className="flex justify-between text-sm text-green-600"><span>Total Paid</span><span className="font-bold">{formatCurrency(success.summary.totalDeposited)}</span></div>
                  <div className={`flex justify-between text-sm font-bold ${success.summary.finalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <span>Balance</span><span>{formatCurrency(success.summary.finalBalance)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400"><span>Receipt</span><span className="font-mono">{success.summary.familyReceiptId}</span></div>
                </div>

                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={printReceipt}><Printer className="h-4 w-4" /> Print Receipt</Button>
                  <Button onClick={() => router.push('/admission')}><UserPlus className="h-4 w-4" /> New Admission</Button>
                </div>
              </Card>
            </FadeIn>
          </div>
        </PageTransition>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="max-w-5xl mx-auto space-y-6">
          <FadeIn>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-6 w-6 text-blue-600" /> Family Admission
                </h1>
                <p className="text-sm text-slate-500 mt-1">Admit multiple siblings together with combined fees</p>
              </div>
              <Button variant="outline" onClick={() => router.push('/admission')}>Single Admission</Button>
            </div>
          </FadeIn>

          {/* Step tabs */}
          <FadeIn delay={0.1}>
            <div className="flex gap-1 border-b border-slate-200">
              {(['children', 'parent', 'charges', 'review'] as const).map((s, i) => (
                <button key={s} onClick={() => { if (s === 'children' || (s === 'parent' && canProceedChildren) || (s === 'charges' && canProceedChildren) || s === 'review') setStep(s); }}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${step === s ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  {i + 1}. {s === 'children' ? 'Children' : s === 'parent' ? 'Parent & Address' : s === 'charges' ? 'Charges & Payment' : 'Review'}
                </button>
              ))}
            </div>
          </FadeIn>

          {/* STEP 1: Children */}
          {step === 'children' && (
            <FadeIn delay={0.2}>
              <div className="space-y-4">
                {children.map((child, ci) => {
                  const cls = classes.find((c: any) => c.id === child.classId);
                  const secs = cls?.sections || [];
                  return (
                    <Card key={ci}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Child {ci + 1}</CardTitle>
                          {children.length > 2 && (
                            <button onClick={() => removeChild(ci)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Inp label="First Name *" value={child.firstName} onChange={v => updateChild(ci, 'firstName', v)} />
                          <Inp label="Last Name *" value={child.lastName} onChange={v => updateChild(ci, 'lastName', v)} />
                          <Inp label="Date of Birth *" type="date" value={child.dateOfBirth} onChange={v => updateChild(ci, 'dateOfBirth', v)} />
                          <Sel label="Gender *" value={child.gender} onChange={v => updateChild(ci, 'gender', v)} options={GENDERS.map(g => ({ v: g, l: g }))} />
                          <Sel label="Blood Group" value={child.bloodGroup} onChange={v => updateChild(ci, 'bloodGroup', v)} options={BLOOD_GROUPS.map(b => ({ v: b, l: b || 'Select' }))} />
                          <Sel label="Class *" value={child.classId} onChange={v => updateChild(ci, 'classId', v)} options={[{ v: '', l: 'Select' }, ...classes.map((c: any) => ({ v: c.id, l: c.name }))]} />
                          <Sel label="Section *" value={child.sectionId} onChange={v => updateChild(ci, 'sectionId', v)} options={[{ v: '', l: child.classId ? 'Select' : 'Pick class' }, ...secs.map((s: any) => ({ v: s.id, l: s.name }))]} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                <Button variant="outline" onClick={addChild} className="w-full"><Plus className="h-4 w-4" /> Add Another Child</Button>
                <div className="flex justify-end">
                  <Button onClick={() => setStep('parent')} disabled={!canProceedChildren}>Next: Parent Info</Button>
                </div>
              </div>
            </FadeIn>
          )}

          {/* STEP 2: Parent + Address */}
          {step === 'parent' && (
            <FadeIn delay={0.2}>
              <Card>
                <CardContent className="pt-6 space-y-6">
                  <Inp label="Family Name" value={parentForm.familyName} onChange={v => setParentForm({ ...parentForm, familyName: v })} placeholder="e.g. Pathak Family" />
                  <h3 className="text-sm font-semibold text-slate-700">Father</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Inp label="Name" value={parentForm.fatherName} onChange={v => setParentForm({ ...parentForm, fatherName: v })} />
                    <Inp label="Occupation" value={parentForm.fatherOccupation} onChange={v => setParentForm({ ...parentForm, fatherOccupation: v })} />
                    <Inp label="Phone" value={parentForm.fatherPhone} onChange={v => setParentForm({ ...parentForm, fatherPhone: v })} />
                    <Inp label="Email" value={parentForm.fatherEmail} onChange={v => setParentForm({ ...parentForm, fatherEmail: v })} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-700">Mother</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Inp label="Name" value={parentForm.motherName} onChange={v => setParentForm({ ...parentForm, motherName: v })} />
                    <Inp label="Occupation" value={parentForm.motherOccupation} onChange={v => setParentForm({ ...parentForm, motherOccupation: v })} />
                    <Inp label="Phone" value={parentForm.motherPhone} onChange={v => setParentForm({ ...parentForm, motherPhone: v })} />
                    <Inp label="Email" value={parentForm.motherEmail} onChange={v => setParentForm({ ...parentForm, motherEmail: v })} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-700">Address</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="col-span-2"><Inp label="Address" value={parentForm.currentAddress} onChange={v => setParentForm({ ...parentForm, currentAddress: v })} /></div>
                    <Inp label="City" value={parentForm.currentCity} onChange={v => setParentForm({ ...parentForm, currentCity: v })} />
                    <Inp label="State" value={parentForm.currentState} onChange={v => setParentForm({ ...parentForm, currentState: v })} />
                    <Inp label="Pincode" value={parentForm.currentPincode} onChange={v => setParentForm({ ...parentForm, currentPincode: v })} />
                  </div>
                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep('children')}>Back</Button>
                    <Button onClick={() => setStep('charges')}>Next: Charges</Button>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* STEP 3: Charges per child + combined payment */}
          {step === 'charges' && (
            <FadeIn delay={0.2}>
              <div className="space-y-6">
                {/* Previous balance */}
                <div className="max-w-xs">
                  <Inp label="Previous Year Balance (total, if any)" type="number" value={previousBalance} onChange={v => setPreviousBalance(v)} placeholder="₹ 0" />
                </div>

                {/* Per-child charges */}
                {children.map((child, ci) => (
                  <Card key={ci}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{child.firstName || `Child ${ci + 1}`} {child.lastName} — {classes.find((c: any) => c.id === child.classId)?.name || ''}</span>
                        <Badge variant="secondary">{formatCurrency(getChildChargesTotal(child))}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {child.charges.map((charge, chi) => (
                          <div key={chi} className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-20 truncate" title={charge.description}>{charge.description}</span>
                            <input type="number" placeholder="₹" value={charge.amount}
                              onChange={e => updateCharge(ci, chi, 'amount', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 text-right" />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Combined total + payment */}
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <h3 className="text-sm font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <IndianRupee className="h-4 w-4" /> Combined Family Payment
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {children.map((child, ci) => (
                        <div key={ci} className="bg-white rounded-lg p-3 text-center border border-green-200">
                          <p className="text-xs text-slate-500">{child.firstName || `Child ${ci + 1}`}</p>
                          <p className="text-lg font-bold text-slate-900">{formatCurrency(getChildChargesTotal(child))}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-green-200 mb-4">
                      <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">Grand Total</span><span className="font-bold text-lg">{formatCurrency(grandTotal)}</span></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input type="number" placeholder="Amount paid (₹)" value={deposit.amount} onChange={e => setDeposit({ ...deposit, amount: e.target.value })}
                        className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900" />
                      <select value={deposit.paymentMethod} onChange={e => setDeposit({ ...deposit, paymentMethod: e.target.value })}
                        className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900">
                        {['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'DD'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                      </select>
                      <input placeholder="Received by" value={deposit.receivedBy} onChange={e => setDeposit({ ...deposit, receivedBy: e.target.value })}
                        className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900" />
                    </div>
                    {grandTotal > 0 && (
                      <div className="flex gap-6 mt-3 text-sm">
                        <span>Charged: <strong>{formatCurrency(grandTotal)}</strong></span>
                        <span className="text-green-700">Paid: <strong>{formatCurrency(depositAmt)}</strong></span>
                        <span className={finalBalance > 0 ? 'text-red-600' : 'text-green-600'}>Balance: <strong>{formatCurrency(finalBalance)}</strong></span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep('parent')}>Back</Button>
                  <Button onClick={() => setStep('review')}>Review & Confirm</Button>
                </div>
              </div>
            </FadeIn>
          )}

          {/* STEP 4: Review */}
          {step === 'review' && (
            <FadeIn delay={0.2}>
              <Card>
                <CardContent className="pt-6 space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-blue-600">Family</p>
                    <p className="text-xl font-bold text-blue-800">{parentForm.familyName || `${children[0]?.lastName} Family`}</p>
                    <p className="text-sm text-blue-500">{children.length} children</p>
                  </div>

                  {/* Children summary */}
                  <div className="space-y-3">
                    {children.map((child, ci) => (
                      <div key={ci} className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{child.firstName} {child.lastName}</p>
                          <p className="text-xs text-slate-500">{classes.find((c: any) => c.id === child.classId)?.name} | DOB: {child.dateOfBirth}</p>
                        </div>
                        <span className="text-sm font-bold text-slate-700">{formatCurrency(getChildChargesTotal(child))}</span>
                      </div>
                    ))}
                  </div>

                  {/* Parent */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-slate-500">Father:</span> <span className="font-medium">{parentForm.fatherName || '—'}</span> <span className="text-slate-400">({parentForm.fatherPhone || '—'})</span></div>
                    <div><span className="text-slate-500">Mother:</span> <span className="font-medium">{parentForm.motherName || '—'}</span> <span className="text-slate-400">({parentForm.motherPhone || '—'})</span></div>
                  </div>

                  {/* Totals */}
                  <div className="bg-slate-100 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm"><span>Total Charges</span><span className="font-bold">{formatCurrency(grandTotal)}</span></div>
                    {depositAmt > 0 && <div className="flex justify-between text-sm text-green-600"><span>Deposit ({deposit.paymentMethod})</span><span className="font-bold">-{formatCurrency(depositAmt)}</span></div>}
                    <div className={`flex justify-between text-base font-bold ${finalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <span>Balance</span><span>{formatCurrency(finalBalance)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep('charges')}>Back</Button>
                    <Button variant="success" onClick={handleSubmit} disabled={submitting}>
                      {submitting ? 'Submitting...' : `Confirm ${children.length} Admissions`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}

function Inp({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
