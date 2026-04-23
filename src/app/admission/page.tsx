'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion';
import { UserPlus, ChevronRight, ChevronLeft, Check, Printer, User, MapPin, Users as UsersIcon, School, Hash, ShoppingBag, IndianRupee, Search, Link2, X, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const STEPS = [
  { id: 'basic', label: 'Basic Info', icon: User },
  { id: 'parent', label: 'Parent Info', icon: UsersIcon },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'academic', label: 'Academic', icon: School },
  { id: 'charges', label: 'Charges & Fees', icon: ShoppingBag },
  { id: 'review', label: 'Review', icon: Check },
];

const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST'];
const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Other'];
const HOUSES = ['Red', 'Blue', 'Green', 'Yellow'];
const STREAMS = ['NONE', 'SCIENCE', 'COMMERCE', 'ARTS'];

export default function AdmissionPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [classes, setClasses] = useState<any[]>([]);
  const [nextAdmNo, setNextAdmNo] = useState('');
  const [admissionStats, setAdmissionStats] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<any>(null);

  // Charges at admission
  const [charges, setCharges] = useState<{ category: string; description: string; amount: string }[]>([
    { category: 'ADMISSION', description: 'Admission Charge', amount: '' },
    { category: 'ANNUAL', description: 'Annual Charge', amount: '' },
    { category: 'REGISTRATION', description: 'Registration Charge', amount: '' },
    { category: 'BOOK', description: 'Book', amount: '' },
    { category: 'DRESS', description: 'Dress-I', amount: '' },
    { category: 'COPY', description: 'Copy', amount: '' },
    { category: 'DAIRY', description: 'Dairy', amount: '' },
    { category: 'TIE_BELT', description: 'Tie / Belt', amount: '' },
  ]);
  const [deposit, setDeposit] = useState({ amount: '', paymentMethod: 'CASH', receivedBy: '' });
  const [previousBalance, setPreviousBalance] = useState('');
  // Sibling
  const [siblingSearch, setSiblingSearch] = useState('');
  const [siblingResult, setSiblingResult] = useState<any>(null);
  const [siblingLinked, setSiblingLinked] = useState(false);
  const [searchingsibling, setSearchingSibling] = useState(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    dateOfBirth: '', gender: 'MALE', bloodGroup: '', nationality: 'Indian',
    religion: '', category: '', aadhaarNumber: '',
    fatherName: '', fatherOccupation: '', fatherPhone: '', fatherEmail: '',
    motherName: '', motherOccupation: '', motherPhone: '', motherEmail: '',
    currentAddress: '', currentCity: '', currentState: '', currentPincode: '',
    classId: '', sectionId: '',
    prevSchoolName: '', prevSchoolBoard: '', prevLastGrade: '', prevTCNumber: '',
    house: '', stream: 'NONE',
  });

  const [feePlanClasses, setFeePlanClasses] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/classes').then(r => setClasses(r.data)),
      api.get('/admission').then(r => {
        setNextAdmNo(r.data.admissionNo);
        setAdmissionStats(r.data);
        if (r.data.feePlan) setFeePlanClasses(r.data.feePlan);
      }),
    ]);
  }, []);

  const u = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
    // Auto-fill charges from fee plan when class changes
    if (field === 'classId' && value) {
      const classPlan = feePlanClasses.find((c: any) => c.classId === value);
      if (classPlan && classPlan.charges) {
        setCharges(classPlan.charges.map((c: any) => ({ category: c.category, description: c.description, amount: c.amount > 0 ? String(c.amount) : '' })));
      }
    }
  };

  const selectedClass = classes.find((c: any) => c.id === form.classId);
  const sections = selectedClass?.sections || [];

  const searchSibling = async () => {
    if (!siblingSearch.trim()) return;
    setSearchingSibling(true);
    try {
      const { data } = await api.get('/students', { params: { search: siblingSearch } });
      if (data.length > 0) {
        setSiblingResult(data.slice(0, 5)); // show top 5 matches
      } else {
        setSiblingResult([]);
      }
    } catch { setSiblingResult([]); }
    setSearchingSibling(false);
  };

  const linkSibling = (student: any) => {
    setSiblingLinked(true);
    setSiblingSearch(student.admissionNo);
    setSiblingResult(null);
    // Auto-fill parent info from sibling
    if (student.fatherName) setForm(f => ({ ...f, fatherName: student.fatherName || f.fatherName, fatherPhone: student.fatherPhone || f.fatherPhone, motherName: student.motherName || f.motherName, motherPhone: student.motherPhone || f.motherPhone, currentAddress: student.currentAddress || f.currentAddress, currentCity: student.currentCity || f.currentCity, currentState: student.currentState || f.currentState, currentPincode: student.currentPincode || f.currentPincode }));
  };

  const chargesTotal = charges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0) + (parseFloat(previousBalance) || 0);
  const depositAmount = parseFloat(deposit.amount) || 0;
  const balanceAfterDeposit = chargesTotal - depositAmount;

  const canProceed = () => {
    if (step === 0) return form.firstName && form.dateOfBirth && form.gender && form.classId && form.sectionId;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        charges: charges.filter(c => parseFloat(c.amount) > 0).map(c => ({ category: c.category, description: c.description, amount: parseFloat(c.amount) })),
        initialDeposit: depositAmount > 0 ? { amount: depositAmount, paymentMethod: deposit.paymentMethod, receivedBy: deposit.receivedBy } : undefined,
        previousBalance: parseFloat(previousBalance) || 0,
        siblingAdmissionNo: siblingLinked ? siblingSearch : undefined,
      };
      const { data } = await api.post('/admission', payload);
      setSuccess(data);
      // Refresh admission number for next use
      const r = await api.get('/admission');
      setNextAdmNo(r.data.admissionNo);
      setAdmissionStats(r.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Admission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      firstName: '', lastName: '', email: '', phone: '',
      dateOfBirth: '', gender: 'MALE', bloodGroup: '', nationality: 'Indian',
      religion: '', category: '', aadhaarNumber: '',
      fatherName: '', fatherOccupation: '', fatherPhone: '', fatherEmail: '',
      motherName: '', motherOccupation: '', motherPhone: '', motherEmail: '',
      currentAddress: '', currentCity: '', currentState: '', currentPincode: '',
      classId: '', sectionId: '',
      prevSchoolName: '', prevSchoolBoard: '', prevLastGrade: '', prevTCNumber: '',
      house: '', stream: 'NONE',
    });
    setStep(0);
    setSuccess(null);
  };

  const printAdmission = () => {
    if (!success) return;
    const chargesRows = charges.filter(c => parseFloat(c.amount) > 0).map(c =>
      `<tr><td style="padding:6px 12px;font-size:13px;border:1px solid #cbd5e1">${c.description}</td><td style="padding:6px 12px;font-size:13px;border:1px solid #cbd5e1;text-align:right;font-weight:600">₹${parseFloat(c.amount).toLocaleString('en-IN')}</td></tr>`
    ).join('');
    const prevBal = parseFloat(previousBalance) || 0;
    const ledger = success.ledger;
    const html = `<!DOCTYPE html><html><head><title>Admission - ${success.admissionNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; margin:20px; color:#1e293b; font-size:13px; }
  .header { text-align:center; border-bottom:3px solid #006400; padding-bottom:12px; margin-bottom:16px; }
  .school { font-size:20px; font-weight:bold; color:#006400; }
  .adm-no { display:inline-block; background:#dc2626; color:white; padding:4px 20px; border-radius:4px; font-size:16px; font-weight:bold; margin:8px 0; }
  h3 { color:#006400; font-size:13px; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin:16px 0 8px; text-transform:uppercase; letter-spacing:1px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 24px; }
  .field .label { font-size:10px; color:#64748b; text-transform:uppercase; }
  .field .value { font-size:13px; font-weight:600; }
  table { width:100%; border-collapse:collapse; margin:8px 0; }
  th { background:#006400; color:white; padding:6px 12px; font-size:11px; text-align:left; text-transform:uppercase; }
  .total-row td { background:#f0fdf4; font-weight:bold; font-size:14px; }
  .balance-box { border:3px solid; border-radius:8px; padding:12px; text-align:center; margin:12px 0; font-size:18px; font-weight:bold; }
  .sig-row { display:flex; justify-content:space-between; margin-top:40px; }
  .sig-line { border-top:1px solid #000; width:180px; text-align:center; padding-top:4px; font-size:11px; }
  @media print { body { margin:10px; } }
</style></head><body>
  <div class="header">
    <div class="school">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
    <div style="font-size:11px;color:#666">Salarpur, Sector - 101 | Ph: 6397339902</div>
    <div style="font-size:14px;font-weight:bold;color:#1e293b;margin-top:6px">ADMISSION RECEIPT</div>
    <div class="adm-no">${success.admissionNo}</div>
    <div style="font-size:11px;color:#666">Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  </div>

  <h3>Student Details</h3>
  <div class="grid">
    <div class="field"><div class="label">Name</div><div class="value">${form.firstName} ${form.lastName}</div></div>
    <div class="field"><div class="label">Class</div><div class="value">${success.class?.name} — ${success.section?.name || ''}</div></div>
    <div class="field"><div class="label">Date of Birth</div><div class="value">${form.dateOfBirth ? new Date(form.dateOfBirth).toLocaleDateString('en-IN') : '—'}</div></div>
    <div class="field"><div class="label">Gender</div><div class="value">${form.gender}</div></div>
  </div>

  <h3>Parent / Guardian</h3>
  <div class="grid">
    <div class="field"><div class="label">Father</div><div class="value">${form.fatherName || '—'} ${form.fatherPhone ? '| ' + form.fatherPhone : ''}</div></div>
    <div class="field"><div class="label">Mother</div><div class="value">${form.motherName || '—'} ${form.motherPhone ? '| ' + form.motherPhone : ''}</div></div>
    <div class="field" style="grid-column:span 2"><div class="label">Address</div><div class="value">${[form.currentAddress, form.currentCity, form.currentState, form.currentPincode].filter(Boolean).join(', ') || '—'}</div></div>
  </div>

  <h3>Admission Charges</h3>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right;width:30%">Amount</th></tr></thead>
    <tbody>
      ${chargesRows}
      ${prevBal > 0 ? `<tr><td style="padding:6px 12px;font-size:13px;border:1px solid #cbd5e1;color:#dc2626">Previous Balance</td><td style="padding:6px 12px;font-size:13px;border:1px solid #cbd5e1;text-align:right;font-weight:600;color:#dc2626">₹${prevBal.toLocaleString('en-IN')}</td></tr>` : ''}
      <tr class="total-row">
        <td style="padding:8px 12px;border:1px solid #cbd5e1;font-size:14px">Total Charges</td>
        <td style="padding:8px 12px;border:1px solid #cbd5e1;text-align:right;font-size:14px">₹${(ledger?.totalCharged || chargesTotal).toLocaleString('en-IN')}</td>
      </tr>
      ${depositAmount > 0 ? `<tr>
        <td style="padding:6px 12px;border:1px solid #cbd5e1;color:#16a34a;font-weight:600">Paid at Admission (${deposit.paymentMethod})</td>
        <td style="padding:6px 12px;border:1px solid #cbd5e1;text-align:right;color:#16a34a;font-weight:bold;font-size:14px">- ₹${depositAmount.toLocaleString('en-IN')}</td>
      </tr>` : ''}
    </tbody>
  </table>

  <div class="balance-box" style="border-color:${(ledger?.currentBalance || 0) > 0 ? '#dc2626' : '#16a34a'}; color:${(ledger?.currentBalance || 0) > 0 ? '#dc2626' : '#16a34a'}">
    Balance Due: ₹${(ledger?.currentBalance || chargesTotal - depositAmount).toLocaleString('en-IN')}
  </div>

  ${ledger?.depositReceipt ? `<div style="text-align:center;font-size:11px;color:#64748b">Receipt No: <strong style="color:#1e40af">${ledger.depositReceipt}</strong></div>` : ''}

  <div class="sig-row">
    <div class="sig-line">Parent's Signature</div>
    <div class="sig-line">Accountant</div>
    <div class="sig-line">Principal</div>
  </div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const printStudentProfile = () => {
    if (!success) return;
    const html = `<!DOCTYPE html><html><head><title>Student Profile - ${form.firstName} ${form.lastName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; margin:20px; color:#1e293b; font-size:13px; }
  .card { border:2px solid #006400; border-radius:12px; overflow:hidden; max-width:600px; margin:0 auto; }
  .card-header { background:#006400; color:white; text-align:center; padding:12px; }
  .card-header .school { font-size:16px; font-weight:bold; letter-spacing:1px; }
  .card-body { padding:20px; }
  .profile-row { display:flex; gap:20px; margin-bottom:16px; }
  .photo-box { width:120px; height:150px; border:2px solid #e2e8f0; border-radius:8px; display:flex; align-items:center; justify-content:center; background:#f8fafc; font-size:40px; font-weight:bold; color:#94a3b8; }
  .info-grid { flex:1; display:grid; grid-template-columns:1fr 1fr; gap:4px 16px; }
  .info-grid .label { font-size:10px; color:#64748b; text-transform:uppercase; }
  .info-grid .value { font-size:13px; font-weight:600; margin-bottom:4px; }
  .adm-badge { display:inline-block; background:#dc2626; color:white; padding:3px 16px; border-radius:4px; font-weight:bold; font-size:14px; }
  h3 { color:#006400; font-size:12px; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin:12px 0 8px; text-transform:uppercase; letter-spacing:1px; }
  .sig-row { display:flex; justify-content:space-between; margin-top:30px; padding:0 20px 16px; }
  .sig-line { border-top:1px solid #000; width:160px; text-align:center; padding-top:4px; font-size:10px; }
  @media print { body { margin:10px; } }
</style></head><body>
  <div class="card">
    <div class="card-header">
      <div class="school">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
      <div style="font-size:10px;opacity:0.8">Salarpur, Sector - 101 | Student Profile</div>
    </div>
    <div class="card-body">
      <div style="text-align:center;margin-bottom:12px"><span class="adm-badge">${success.admissionNo}</span></div>
      <div class="profile-row">
        <div class="photo-box">${form.firstName[0] || ''}${form.lastName[0] || ''}</div>
        <div class="info-grid">
          <div><div class="label">Name</div><div class="value">${form.firstName} ${form.lastName}</div></div>
          <div><div class="label">Class</div><div class="value">${success.class?.name} — ${success.section?.name || ''}</div></div>
          <div><div class="label">Date of Birth</div><div class="value">${form.dateOfBirth ? new Date(form.dateOfBirth).toLocaleDateString('en-IN') : '—'}</div></div>
          <div><div class="label">Gender</div><div class="value">${form.gender}</div></div>
          <div><div class="label">Blood Group</div><div class="value">${form.bloodGroup || '—'}</div></div>
          <div><div class="label">Category</div><div class="value">${form.category || '—'}</div></div>
          <div><div class="label">Religion</div><div class="value">${form.religion || '—'}</div></div>
          <div><div class="label">Aadhaar</div><div class="value">${form.aadhaarNumber || '—'}</div></div>
        </div>
      </div>

      <h3>Parent / Guardian</h3>
      <div class="info-grid">
        <div><div class="label">Father's Name</div><div class="value">${form.fatherName || '—'}</div></div>
        <div><div class="label">Father's Phone</div><div class="value">${form.fatherPhone || '—'}</div></div>
        <div><div class="label">Mother's Name</div><div class="value">${form.motherName || '—'}</div></div>
        <div><div class="label">Mother's Phone</div><div class="value">${form.motherPhone || '—'}</div></div>
        ${form.fatherOccupation ? `<div><div class="label">Father's Occupation</div><div class="value">${form.fatherOccupation}</div></div>` : ''}
        ${form.motherOccupation ? `<div><div class="label">Mother's Occupation</div><div class="value">${form.motherOccupation}</div></div>` : ''}
      </div>

      <h3>Address</h3>
      <div style="font-size:13px;font-weight:500">${[form.currentAddress, form.currentCity, form.currentState, form.currentPincode].filter(Boolean).join(', ') || '—'}</div>

      ${form.prevSchoolName ? `<h3>Previous School</h3>
      <div class="info-grid">
        <div><div class="label">School</div><div class="value">${form.prevSchoolName}</div></div>
        <div><div class="label">Board</div><div class="value">${form.prevSchoolBoard || '—'}</div></div>
        <div><div class="label">Last Class</div><div class="value">${form.prevLastGrade || '—'}</div></div>
        <div><div class="label">TC No.</div><div class="value">${form.prevTCNumber || '—'}</div></div>
      </div>` : ''}
    </div>
    <div class="sig-row">
      <div class="sig-line">Parent's Signature</div>
      <div class="sig-line">Principal</div>
    </div>
  </div>
  <div style="text-align:center;font-size:10px;color:#94a3b8;margin-top:8px">Printed on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  // ─── SUCCESS VIEW ───
  if (success) {
    return (
      <DashboardLayout>
        <PageTransition>
          <div className="max-w-lg mx-auto mt-12">
            <FadeIn>
              <Card className="text-center p-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Admission Successful!</h2>
                <p className="text-slate-500 mb-4">Student has been admitted to the school.</p>

                <div className="bg-slate-50 rounded-xl p-5 mb-6 text-left space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Admission No</span>
                    <span className="text-lg font-bold text-red-600">{success.admissionNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Name</span>
                    <span className="text-sm font-medium text-slate-900">{success.user?.firstName} {success.user?.lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Class</span>
                    <span className="text-sm font-medium text-slate-900">{success.class?.name} - {success.section?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Email</span>
                    <span className="text-sm text-slate-600">{success.user?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Default Password</span>
                    <Badge variant="warning">student123</Badge>
                  </div>
                  {success.sibling && (
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Sibling</span>
                      <Badge variant="default">{success.sibling.name}</Badge>
                    </div>
                  )}
                  {success.family && (
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Family</span>
                      <span className="text-sm font-medium text-slate-900">{success.family.name}</span>
                    </div>
                  )}
                  {success.ledger && (
                    <>
                      <hr className="border-slate-200" />
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Total Charged</span>
                        <span className="text-sm font-bold text-slate-900">{formatCurrency(success.ledger.totalCharged)}</span>
                      </div>
                      {success.ledger.depositAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-500">Paid at Admission</span>
                          <span className="text-sm font-bold text-green-600">{formatCurrency(success.ledger.depositAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Balance</span>
                        <span className={`text-sm font-bold ${success.ledger.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(success.ledger.currentBalance)}
                        </span>
                      </div>
                      {success.ledger.depositReceipt && (
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-500">Receipt</span>
                          <span className="text-sm font-mono text-blue-600">{success.ledger.depositReceipt}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap justify-center">
                  <Button variant="outline" onClick={printAdmission}>
                    <Printer className="h-4 w-4" /> Print Receipt
                  </Button>
                  <Button variant="outline" onClick={printStudentProfile}>
                    <User className="h-4 w-4" /> Print Profile
                  </Button>
                  <Button onClick={resetForm}>
                    <UserPlus className="h-4 w-4" /> New Admission
                  </Button>
                  <Button variant="secondary" onClick={() => router.push(`/students/${success.id}`)}>
                    View Profile
                  </Button>
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
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <FadeIn>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">New Admission</h1>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-sm text-slate-500">Register a new student</p>
                  <button onClick={() => router.push('/admission/family')} className="text-xs text-blue-600 hover:text-blue-800 font-medium underline">
                    Admitting siblings? Use Family Admission
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">Next Admission No:</span>
                </div>
                <span className="text-xl font-bold text-red-600">{nextAdmNo}</span>
                {admissionStats && (
                  <p className="text-xs text-slate-400 mt-1">
                    {admissionStats.thisYearAdmissions} admissions this year | {admissionStats.totalStudents} total students
                  </p>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Step Indicator */}
          <FadeIn delay={0.1}>
            <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4">
              {STEPS.map((s, i) => (
                <button key={s.id} onClick={() => i <= step && setStep(i)} className="flex items-center gap-2 group">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    i < step ? 'bg-green-500 text-white' :
                    i === step ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-sm font-medium hidden md:block ${i === step ? 'text-blue-600' : i < step ? 'text-green-600' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300 mx-2 hidden md:block" />}
                </button>
              ))}
            </div>
          </FadeIn>

          {/* Form Card */}
          <FadeIn delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle>{STEPS[step].label}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* STEP 0: Basic Info */}
                {step === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Input label="First Name *" value={form.firstName} onChange={v => u('firstName', v)} />
                    <Input label="Last Name (optional)" value={form.lastName} onChange={v => u('lastName', v)} />
                    <Input label="Email (auto-generated if empty)" value={form.email} onChange={v => u('email', v)} type="email" placeholder="optional" />
                    <Input label="Phone" value={form.phone} onChange={v => u('phone', v)} />
                    <Input label="Date of Birth *" value={form.dateOfBirth} onChange={v => u('dateOfBirth', v)} type="date" />
                    <Select label="Gender *" value={form.gender} onChange={v => u('gender', v)} options={GENDERS.map(g => ({ v: g, l: g }))} />
                    <Select label="Blood Group" value={form.bloodGroup} onChange={v => u('bloodGroup', v)} options={[{ v: '', l: 'Select' }, ...BLOOD_GROUPS.map(b => ({ v: b, l: b }))]} />
                    <Select label="Class *" value={form.classId} onChange={v => { u('classId', v); setForm(f => ({ ...f, classId: v, sectionId: '' })); }} options={[{ v: '', l: 'Select Class' }, ...classes.map((c: any) => ({ v: c.id, l: c.name }))]} />
                    <Select label="Section *" value={form.sectionId} onChange={v => u('sectionId', v)} options={[{ v: '', l: form.classId ? 'Select Section' : 'Select class first' }, ...sections.map((s: any) => ({ v: s.id, l: s.name }))]} />
                    <Select label="Category" value={form.category} onChange={v => u('category', v)} options={[{ v: '', l: 'Select' }, ...CATEGORIES.map(c => ({ v: c, l: c }))]} />
                    <Select label="Religion" value={form.religion} onChange={v => u('religion', v)} options={[{ v: '', l: 'Select' }, ...RELIGIONS.map(r => ({ v: r, l: r }))]} />
                    <Input label="Aadhaar Number" value={form.aadhaarNumber} onChange={v => u('aadhaarNumber', v)} placeholder="12-digit" />
                  </div>
                )}

                {/* STEP 1: Parent Info */}
                {step === 1 && (
                  <div className="space-y-6">
                    <h3 className="text-sm font-semibold text-slate-700">Father&apos;s Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Input label="Father's Name" value={form.fatherName} onChange={v => u('fatherName', v)} />
                      <Input label="Occupation" value={form.fatherOccupation} onChange={v => u('fatherOccupation', v)} />
                      <Input label="Phone" value={form.fatherPhone} onChange={v => u('fatherPhone', v)} />
                      <Input label="Email" value={form.fatherEmail} onChange={v => u('fatherEmail', v)} type="email" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700 pt-2">Mother&apos;s Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Input label="Mother's Name" value={form.motherName} onChange={v => u('motherName', v)} />
                      <Input label="Occupation" value={form.motherOccupation} onChange={v => u('motherOccupation', v)} />
                      <Input label="Phone" value={form.motherPhone} onChange={v => u('motherPhone', v)} />
                      <Input label="Email" value={form.motherEmail} onChange={v => u('motherEmail', v)} type="email" />
                    </div>
                  </div>
                )}

                {/* STEP 2: Address */}
                {step === 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Input label="Address" value={form.currentAddress} onChange={v => u('currentAddress', v)} />
                    </div>
                    <Input label="City" value={form.currentCity} onChange={v => u('currentCity', v)} />
                    <Input label="State" value={form.currentState} onChange={v => u('currentState', v)} />
                    <Input label="Pincode" value={form.currentPincode} onChange={v => u('currentPincode', v)} />
                  </div>
                )}

                {/* STEP 3: Academic */}
                {step === 3 && (
                  <div className="space-y-6">
                    <h3 className="text-sm font-semibold text-slate-700">Previous School (if any)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label="School Name" value={form.prevSchoolName} onChange={v => u('prevSchoolName', v)} />
                      <Input label="Board" value={form.prevSchoolBoard} onChange={v => u('prevSchoolBoard', v)} placeholder="CBSE, ICSE, State Board" />
                      <Input label="Last Class Completed" value={form.prevLastGrade} onChange={v => u('prevLastGrade', v)} />
                      <Input label="TC Number" value={form.prevTCNumber} onChange={v => u('prevTCNumber', v)} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700 pt-2">School Assignment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Select label="House" value={form.house} onChange={v => u('house', v)} options={[{ v: '', l: 'Select' }, ...HOUSES.map(h => ({ v: h, l: h }))]} />
                      <Select label="Stream" value={form.stream} onChange={v => u('stream', v)} options={STREAMS.map(s => ({ v: s, l: s === 'NONE' ? 'None' : s }))} />
                    </div>
                  </div>
                )}

                {/* STEP 4: Charges & Fees */}
                {step === 4 && (
                  <div className="space-y-6">
                    {/* Sibling lookup */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <Link2 className="h-4 w-4" /> Sibling (if any)
                      </h3>
                      {siblingLinked ? (
                        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                          <span className="text-sm text-green-700 font-medium">Linked to: {siblingSearch}</span>
                          <button onClick={() => { setSiblingLinked(false); setSiblingSearch(''); }} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input placeholder="Search sibling by name..." value={siblingSearch} onChange={e => setSiblingSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchSibling()} className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900" />
                          <Button size="sm" variant="outline" onClick={searchSibling} disabled={searchingsibling}>
                            <Search className="h-4 w-4" /> {searchingsibling ? '...' : 'Search'}
                          </Button>
                        </div>
                      )}
                      {siblingResult && siblingResult.length > 0 && !siblingLinked && (
                        <div className="mt-2 space-y-1">
                          {siblingResult.map((s: any) => (
                            <button key={s.id} onClick={() => linkSibling(s)} className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2.5 text-left hover:border-blue-300 transition">
                              <div>
                                <span className="text-sm font-medium text-slate-900">{s.user.firstName} {s.user.lastName}</span>
                                <span className="text-xs text-slate-500 ml-2">{s.admissionNo} | {s.class?.name}</span>
                              </div>
                              <Badge variant="default">Link</Badge>
                            </button>
                          ))}
                        </div>
                      )}
                      {siblingResult && siblingResult.length === 0 && (
                        <p className="text-xs text-slate-400 mt-2">No students found</p>
                      )}
                    </div>

                    {/* Previous balance */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Previous Year Balance (if any)</label>
                      <input type="number" placeholder="₹ 0" value={previousBalance} onChange={e => setPreviousBalance(e.target.value)}
                        className="w-full max-w-xs px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>

                    {/* Admission charges — like the physical register */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Admission Charges</h3>
                      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Item</th>
                              <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 w-40">Amount (₹)</th>
                              <th className="w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {charges.map((charge, i) => (
                              <tr key={i} className="bg-white">
                                <td className="px-4 py-2">
                                  <input value={charge.description} onChange={e => { const c = [...charges]; c[i].description = e.target.value; setCharges(c); }}
                                    className="w-full text-sm text-slate-900 bg-transparent outline-none" />
                                </td>
                                <td className="px-4 py-2">
                                  <input type="number" placeholder="0" value={charge.amount} onChange={e => { const c = [...charges]; c[i].amount = e.target.value; setCharges(c); }}
                                    className="w-full text-sm text-slate-900 text-right bg-transparent outline-none font-medium" />
                                </td>
                                <td className="px-2">
                                  {i >= 8 && <button onClick={() => setCharges(charges.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="px-4 py-2 border-t border-slate-200 flex justify-between items-center">
                          <button onClick={() => setCharges([...charges, { category: 'AD_HOC', description: '', amount: '' }])} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <Plus className="h-3 w-3" /> Add item
                          </button>
                          <div className="text-sm font-bold text-slate-900">Total: {formatCurrency(chargesTotal)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Initial deposit */}
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <IndianRupee className="h-4 w-4" /> Fees Paid at Admission
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input type="number" placeholder="Amount (₹)" value={deposit.amount} onChange={e => setDeposit({ ...deposit, amount: e.target.value })}
                          className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-green-500 outline-none" />
                        <select value={deposit.paymentMethod} onChange={e => setDeposit({ ...deposit, paymentMethod: e.target.value })}
                          className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900">
                          {['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'DD'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                        </select>
                        <input placeholder="Received by" value={deposit.receivedBy} onChange={e => setDeposit({ ...deposit, receivedBy: e.target.value })}
                          className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900" />
                      </div>
                      {chargesTotal > 0 && (
                        <div className="mt-3 flex gap-4 text-sm">
                          <span className="text-slate-600">Charged: <strong>{formatCurrency(chargesTotal)}</strong></span>
                          <span className="text-green-700">Paid: <strong>{formatCurrency(depositAmount)}</strong></span>
                          <span className={balanceAfterDeposit > 0 ? 'text-red-600' : 'text-green-600'}>
                            Balance: <strong>{formatCurrency(balanceAfterDeposit)}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 5: Review */}
                {step === 5 && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600">Admission Number</p>
                        <p className="text-2xl font-bold text-blue-800">{nextAdmNo}</p>
                      </div>
                      <Badge variant="default">Auto-generated</Badge>
                    </div>

                    {siblingLinked && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700">Sibling linked: <strong>{siblingSearch}</strong> — will be added to same family</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ReviewSection title="Student" items={[
                        ['Name', `${form.firstName} ${form.lastName}`],
                        ['Class', `${selectedClass?.name || ''} - ${sections.find((s: any) => s.id === form.sectionId)?.name || ''}`],
                        ['DOB', form.dateOfBirth],
                        ['Gender', form.gender],
                        ['Blood Group', form.bloodGroup || '—'],
                        ['Category', form.category || '—'],
                        ['Religion', form.religion || '—'],
                      ]} />
                      <ReviewSection title="Parent" items={[
                        ['Father', form.fatherName || '—'],
                        ['Father Phone', form.fatherPhone || '—'],
                        ['Mother', form.motherName || '—'],
                        ['Mother Phone', form.motherPhone || '—'],
                      ]} />
                      <ReviewSection title="Address" items={[
                        ['Address', form.currentAddress || '—'],
                        ['City', `${form.currentCity || '—'}, ${form.currentState || ''} ${form.currentPincode || ''}`],
                      ]} />

                      {/* Charges summary */}
                      <div className="bg-slate-50 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Charges & Payment</h4>
                        <div className="space-y-1.5">
                          {parseFloat(previousBalance) > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-purple-600">Previous Balance</span>
                              <span className="font-medium text-purple-700">{formatCurrency(parseFloat(previousBalance))}</span>
                            </div>
                          )}
                          {charges.filter(c => parseFloat(c.amount) > 0).map((c, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-slate-500">{c.description}</span>
                              <span className="font-medium">{formatCurrency(parseFloat(c.amount))}</span>
                            </div>
                          ))}
                          <hr className="border-slate-200" />
                          <div className="flex justify-between text-sm font-bold">
                            <span>Total Charged</span>
                            <span>{formatCurrency(chargesTotal)}</span>
                          </div>
                          {depositAmount > 0 && (
                            <div className="flex justify-between text-sm text-green-600 font-bold">
                              <span>Paid ({deposit.paymentMethod})</span>
                              <span>-{formatCurrency(depositAmount)}</span>
                            </div>
                          )}
                          <div className={`flex justify-between text-sm font-bold ${balanceAfterDeposit > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            <span>Balance</span>
                            <span>{formatCurrency(balanceAfterDeposit)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
                  <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  {step < 5 ? (
                    <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="success" onClick={handleSubmit} disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Confirm Admission'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}

// ─── Helper Components ─────────────────────────────────────

function Input({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function ReviewSection({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map(([label, val]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-900 font-medium">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
