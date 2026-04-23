'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatDate, formatCurrency, getAcademicYears, getCurrentAcademicYear } from '@/lib/utils';
import { ArrowLeft, Save, User, Heart, MapPin, GraduationCap, School, History, Clock, Syringe, FileText, IndianRupee, Printer, BookOpen, CalendarCheck, Award, Camera, X, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';

const TABS = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'parent', label: 'Parent Info', icon: User },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'admission', label: 'Admission', icon: GraduationCap },
  { id: 'previous', label: 'Previous School', icon: School },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'exams', label: 'Exam Results', icon: Award },
  { id: 'fees', label: 'Fee Ledger', icon: IndianRupee },
  { id: 'diary', label: 'Scholarship Diary', icon: BookOpen },
  { id: 'promotion', label: 'Promotion History', icon: History },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'health', label: 'Health', icon: Heart },
  { id: 'vaccination', label: 'Vaccination', icon: Syringe },
  { id: 'documents', label: 'Documents', icon: FileText },
];

export default function StudentProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerFamily, setLedgerFamily] = useState(false);
  const [ledgerView, setLedgerView] = useState<'all' | 'purchases'>('all');
  const [depositForm, setDepositForm] = useState({ amount: '', paymentMethod: 'CASH', receivedBy: '', month: '' });
  const [chargeForm, setChargeForm] = useState({ category: 'MONTHLY_FEE', description: '', amount: '', month: '' });
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [showOpeningBalance, setShowOpeningBalance] = useState(false);
  const [openingForm, setOpeningForm] = useState({ amount: '', year: '2024-2025', month: '' });
  // Exam results
  const [examData, setExamData] = useState<any[]>([]);
  const [examLoading, setExamLoading] = useState(false);
  // Attendance
  const [attData, setAttData] = useState<any>(null);
  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(new Date().getFullYear());
  // Monthly diary
  const [diaryData, setDiaryData] = useState<any>(null);
  const [diaryYear, setDiaryYear] = useState(() => getCurrentAcademicYear());
  const [editingDiary, setEditingDiary] = useState<string | null>(null);
  const [diaryForm, setDiaryForm] = useState({ discipline: '', comment: '', attendancePct: '', testMarksPct: '', feeSubmissionPct: '', feeAmount: '', rewardAmount: '', isHoliday: false });
  // Photo
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    api.get(`/students/${id}`)
      .then(res => {
        setStudent(res.data);
        setForm({
          firstName: res.data.user?.firstName || '',
          lastName: res.data.user?.lastName || '',
          email: res.data.user?.email || '',
          phone: res.data.user?.phone || '',
          dateOfBirth: res.data.dateOfBirth?.split('T')[0] || '',
          gender: res.data.gender || 'MALE',
          bloodGroup: res.data.bloodGroup || '',
          nationality: res.data.nationality || '',
          religion: res.data.religion || '',
          category: res.data.category || '',
          aadhaarNumber: res.data.aadhaarNumber || '',
          fatherName: res.data.fatherName || '',
          fatherOccupation: res.data.fatherOccupation || '',
          fatherPhone: res.data.fatherPhone || '',
          fatherEmail: res.data.fatherEmail || '',
          motherName: res.data.motherName || '',
          motherOccupation: res.data.motherOccupation || '',
          motherPhone: res.data.motherPhone || '',
          motherEmail: res.data.motherEmail || '',
          guardianName: res.data.guardianName || '',
          guardianRelation: res.data.guardianRelation || '',
          guardianPhone: res.data.guardianPhone || '',
          annualIncome: res.data.annualIncome || '',
          currentAddress: res.data.currentAddress || '',
          currentCity: res.data.currentCity || '',
          currentState: res.data.currentState || '',
          currentPincode: res.data.currentPincode || '',
          permanentAddress: res.data.permanentAddress || '',
          permanentCity: res.data.permanentCity || '',
          permanentState: res.data.permanentState || '',
          permanentPincode: res.data.permanentPincode || '',
          admissionDate: res.data.admissionDate?.split('T')[0] || '',
          admittedGrade: res.data.admittedGrade || '',
          house: res.data.house || '',
          stream: res.data.stream || 'NONE',
          rollNumber: res.data.rollNumber || '',
          prevSchoolName: res.data.prevSchoolName || '',
          prevSchoolBoard: res.data.prevSchoolBoard || '',
          prevLastGrade: res.data.prevLastGrade || '',
          prevTCNumber: res.data.prevTCNumber || '',
          height: res.data.height || '',
          weight: res.data.weight || '',
          vision: res.data.vision || '',
          hearing: res.data.hearing || '',
          allergies: res.data.allergies || '',
          medicalConditions: res.data.medicalConditions || '',
          disability: res.data.disability || '',
          emergencyContactName: res.data.emergencyContactName || '',
          emergencyContactPhone: res.data.emergencyContactPhone || '',
        });
      })
      .catch(() => alert('Student not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.annualIncome) payload.annualIncome = parseFloat(payload.annualIncome);
      if (payload.height) payload.height = parseFloat(payload.height);
      if (payload.weight) payload.weight = parseFloat(payload.weight);
      if (!payload.category) delete payload.category;
      await api.put(`/students/${id}`, payload);
      alert('Saved successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const { data } = await api.post(`/students/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStudent((prev: any) => ({ ...prev, photo: data.photo }));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
    }
    setUploadingPhoto(false);
    e.target.value = '';
  };

  const removePhoto = async () => {
    try {
      await api.delete(`/students/${id}/photo`);
      setStudent((prev: any) => ({ ...prev, photo: null }));
    } catch {}
  };

  const loadLedger = async () => {
    try {
      const r = await api.get(`/fees/ledger/${id}?family=${ledgerFamily}`);
      setLedgerData(r.data);
      // Auto-enable family view if student has siblings
      if (r.data.siblings?.length > 1 && !ledgerFamily) {
        setLedgerFamily(true);
      }
    } catch { setLedgerData(null); }
  };

  useEffect(() => {
    if (activeTab === 'fees') loadLedger();
  }, [activeTab, ledgerFamily]);

  // Attendance
  const loadAttendance = async () => {
    try {
      const r = await api.get(`/attendance/student/${id}`, { params: { month: attMonth, year: attYear } });
      setAttData(r.data);
    } catch { setAttData(null); }
  };

  useEffect(() => {
    if (activeTab === 'attendance') loadAttendance();
  }, [activeTab, attMonth, attYear]);

  // Exam results
  useEffect(() => {
    if (activeTab === 'exams' && examData.length === 0) {
      setExamLoading(true);
      api.get(`/grades/student/${id}`)
        .then(r => setExamData(r.data))
        .catch(() => setExamData([]))
        .finally(() => setExamLoading(false));
    }
  }, [activeTab]);

  const currentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const studentIds = ledgerFamily && ledgerData?.siblings?.length
      ? ledgerData.siblings.map((s: any) => s.id)
      : [id];
    await api.post('/fees/ledger/deposit', {
      studentIds,
      month: depositForm.month || currentMonth(),
      amount: parseFloat(depositForm.amount),
      paymentMethod: depositForm.paymentMethod,
      receivedBy: depositForm.receivedBy || undefined,
    });
    setDepositForm({ amount: '', paymentMethod: 'CASH', receivedBy: '', month: '' });
    setShowDepositForm(false);
    loadLedger();
  };

  const handleCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    const studentIds = ledgerFamily && ledgerData?.siblings?.length
      ? ledgerData.siblings.map((s: any) => s.id)
      : [id];
    await api.post('/fees/ledger/charge', {
      studentIds,
      month: chargeForm.month || currentMonth(),
      category: chargeForm.category,
      description: chargeForm.description || chargeForm.category.replace(/_/g, ' '),
      amount: parseFloat(chargeForm.amount),
    });
    setChargeForm({ category: 'MONTHLY_FEE', description: '', amount: '', month: '' });
    setShowChargeForm(false);
    loadLedger();
  };

  const handleOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const month = openingForm.month || (openingForm.year.split('-')[0] + '-04'); // default to April of first year
    await api.post('/fees/ledger/charge', {
      studentIds: [id],
      month,
      category: 'PREVIOUS_BALANCE',
      description: `Previous balance (${openingForm.year})`,
      amount: parseFloat(openingForm.amount),
    });
    setOpeningForm({ amount: '', year: '2024-2025', month: '' });
    setShowOpeningBalance(false);
    loadLedger();
  };

  const handlePrintLedger = () => {
    if (!ledgerData) return;
    const s = ledgerData.student;
    const sibs = ledgerData.siblings || [];
    const rows = ledgerData.ledger || [];
    const tot = ledgerData.totals || {};

    const getAcademicYear = (month: string) => {
      const [y, m] = month.split('-').map(Number);
      return m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    };

    const fmtCur = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    let lastYear = '';
    let tableRows = '';
    for (const row of rows) {
      const year = getAcademicYear(row.month);
      if (year !== lastYear) {
        tableRows += `<tr style="background:#e8f0fe"><td colspan="7" style="padding:6px 12px;font-weight:bold;color:#1a56db">Academic Year ${year}</td></tr>`;
        lastYear = year;
      }
      const monthName = new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const depositDate = row.depositDates?.length ? new Date(row.depositDates[0]).toLocaleDateString('en-IN') : '';
      const depositMethod = row.depositMethods?.length ? row.depositMethods[0] : '';
      tableRows += `<tr>
        <td style="padding:6px 12px">${monthName}</td>
        <td style="padding:6px 12px;text-align:right">${row.monthlyFee > 0 ? fmtCur(row.monthlyFee) : '—'}</td>
        <td style="padding:6px 12px;text-align:right;color:#c2410c">${row.otherCharges > 0 ? fmtCur(row.otherCharges) : '—'}</td>
        <td style="padding:6px 12px;text-align:right;font-weight:600">${fmtCur(row.balance + row.deposited)}</td>
        <td style="padding:6px 12px;text-align:right;color:#16a34a;font-weight:600">${row.deposited > 0 ? fmtCur(row.deposited) : '—'}</td>
        <td style="padding:6px 12px;text-align:right;font-weight:bold;color:${row.balance > 0 ? '#dc2626' : '#16a34a'}">${fmtCur(row.balance)}</td>
        <td style="padding:6px 12px;font-size:11px;color:#64748b">${depositDate}${depositMethod ? '<br/>' + depositMethod : ''}</td>
      </tr>`;
    }

    // Totals row
    tableRows += `<tr style="background:#f8fafc;border-top:2px solid #334155">
      <td style="padding:8px 12px;font-weight:bold">TOTAL</td>
      <td style="padding:8px 12px;text-align:right;font-weight:bold">${fmtCur(tot.totalMonthlyFees || 0)}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:bold;color:#c2410c">${fmtCur(tot.totalOtherCharges || 0)}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:bold">${fmtCur(tot.totalCharged || 0)}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:bold;color:#16a34a">${fmtCur(tot.totalDeposited || 0)}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:bold;color:${ledgerData.currentBalance > 0 ? '#dc2626' : '#16a34a'}">${fmtCur(ledgerData.currentBalance)}</td>
      <td></td>
    </tr>`;

    const siblingInfo = sibs.length > 1
      ? `<div style="margin-bottom:12px"><strong>Siblings:</strong> ${sibs.map((sb: any) => `${sb.name} (${sb.class}, ${sb.admissionNo})`).join(' | ')}</div>`
      : '';

    const html = `<!DOCTYPE html><html><head><title>Fee Ledger - ${s.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #1e293b; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; color: #64748b; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-size: 12px; color: #64748b; border-bottom: 2px solid #cbd5e1; }
        td { border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; }
        .school-name { font-size: 20px; font-weight: bold; color: #1e40af; }
        .balance-box { padding: 12px 20px; border: 2px solid ${ledgerData.currentBalance > 0 ? '#dc2626' : '#16a34a'}; border-radius: 8px; text-align: center; }
        .balance-label { font-size: 11px; color: #64748b; }
        .balance-amount { font-size: 22px; font-weight: bold; color: ${ledgerData.currentBalance > 0 ? '#dc2626' : '#16a34a'}; }
        @media print { body { margin: 10px; } }
      </style>
    </head><body>
      <div class="header">
        <div>
          <div class="school-name">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
          <h1>${s.name} — ${s.class} ${s.section ? '(' + s.section + ')' : ''}</h1>
          <h2>Adm. No: ${s.admissionNo || ''} ${s.familyName ? '| Family: ' + s.familyName : ''}</h2>
          ${siblingInfo}
        </div>
        <div class="balance-box">
          <div class="balance-label">Current Balance</div>
          <div class="balance-amount">${fmtCur(ledgerData.currentBalance)}</div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Month</th><th style="text-align:right">Monthly Fee</th><th style="text-align:right">Other</th>
          <th style="text-align:right">Total Due</th><th style="text-align:right">Deposited</th>
          <th style="text-align:right">Balance</th><th>Date / Sign</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div style="margin-top:24px;font-size:11px;color:#94a3b8;text-align:center">
        Printed on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  // Monthly diary
  const loadDiary = async () => {
    try {
      const r = await api.get(`/monthly-report/${id}?academicYear=${diaryYear}`);
      setDiaryData(r.data);
    } catch { setDiaryData(null); }
  };

  useEffect(() => {
    if (activeTab === 'diary') loadDiary();
  }, [activeTab, diaryYear]);

  const saveDiaryEntry = async (month: string) => {
    await api.post(`/monthly-report/${id}`, {
      month,
      academicYear: diaryYear,
      discipline: diaryForm.discipline || null,
      comment: diaryForm.comment || null,
      attendancePct: diaryForm.attendancePct || null,
      testMarksPct: diaryForm.testMarksPct || null,
      feeSubmissionPct: diaryForm.feeSubmissionPct || null,
      feeAmount: diaryForm.feeAmount || null,
      rewardAmount: diaryForm.rewardAmount || null,
      isHoliday: diaryForm.isHoliday,
    });
    setEditingDiary(null);
    loadDiary();
  };

  // Print single month diary card
  const handlePrintMonth = (d: any) => {
    if (!diaryData) return;
    const s = diaryData.student;
    const DISC_LABELS: Record<string, string> = { V_GOOD: 'V. Good', GOOD: 'Good', AVERAGE: 'Average', POOR: 'Poor' };
    const att = d.isHoliday ? 'Holiday' : (d.attendancePct != null ? d.attendancePct + '%' : '—');
    const test = d.testMarksPct != null ? d.testMarksPct + '%' : '0%';
    const fee = d.feeSubmissionPct != null ? d.feeSubmissionPct + '%' : '0%';
    const disc = d.discipline ? (DISC_LABELS[d.discipline] || d.discipline) : '—';
    const reward = d.rewardAmount > 0 ? '₹' + d.rewardAmount.toLocaleString('en-IN') : '₹0';
    const bal = d.runningBalance > 0 ? '₹' + d.runningBalance.toLocaleString('en-IN') : 'Clear';
    const paid = d.feeAmount > 0 ? '₹' + d.feeAmount.toLocaleString('en-IN') : '—';

    const html = `<!DOCTYPE html><html><head><title>${d.monthName} Diary - ${s.name}</title>
      <style>body{font-family:Arial;margin:20px;color:#1e293b}.header{text-align:center;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:24px}.school{font-size:20px;font-weight:bold;color:#1e40af}.card{border:3px solid #1e40af;border-radius:12px;overflow:hidden;max-width:500px;margin:0 auto}.month-header{text-align:center;background:#1e40af;color:white;padding:12px;font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:2px}.metrics{padding:20px 24px;background:#fffbeb}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dotted #cbd5e1;font-size:15px}.label{color:#475569}.value{font-weight:bold;color:#1e293b}.footer{background:#1e3a8a;color:white;padding:12px 24px;display:flex;justify-content:space-between;align-items:center}.comment{padding:8px 24px;font-size:12px;color:#64748b;background:#f8fafc}@media print{body{margin:10px}}</style>
    </head><body>
      <div class="header">
        <div class="school">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
        <div style="font-size:13px;color:#475569;margin-top:4px">${s.name} | ${s.class} ${s.section ? '- ' + s.section : ''} | Adm. No: ${s.admissionNo || ''}</div>
        <div style="display:inline-block;background:#dc2626;color:white;padding:3px 14px;border-radius:4px;font-weight:bold;font-size:13px;margin-top:8px">${diaryYear}</div>
      </div>
      <div class="card">
        <div class="month-header">${d.monthName}</div>
        <div class="metrics">
          <div class="row"><span class="label">Attendance</span><span class="value">${att}</span></div>
          <div class="row"><span class="label">Sunday Test Marks</span><span class="value">${test}</span></div>
          <div class="row"><span class="label">Fee Submission</span><span class="value">${fee}</span></div>
          <div class="row"><span class="label">Discipline</span><span class="value">${disc}</span></div>
        </div>
        <div class="footer">
          <span style="font-size:12px;opacity:0.8">Score: ${d.scholarshipBreakdown?.compositeScore || 0}%</span>
          <span style="font-size:22px;font-weight:bold">Scholarship: ${reward}</span>
        </div>
        ${d.comment ? `<div class="comment"><strong>Comment:</strong> ${d.comment}</div>` : ''}
      </div>
      <div style="margin-top:20px;font-size:11px;color:#94a3b8;text-align:center">Printed on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  // Print monthly fee receipt
  const handlePrintFeeMonth = (d: any) => {
    if (!diaryData) return;
    const s = diaryData.student;
    const paid = d.feeAmount || 0;
    const balance = d.runningBalance || 0;
    const charged = d.fee?.monthlyFee || 0;
    const other = d.fee?.otherCharges || 0;

    const html = `<!DOCTYPE html><html><head><title>Fee Receipt - ${d.monthName} - ${s.name}</title>
      <style>body{font-family:Arial;margin:20px;color:#1e293b}.header{text-align:center;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:20px}.school{font-size:20px;font-weight:bold;color:#1e40af}table{width:100%;border-collapse:collapse;margin:16px 0;max-width:500px;margin-left:auto;margin-right:auto}th{background:#f1f5f9;padding:8px 16px;text-align:left;font-size:12px;color:#64748b;border-bottom:2px solid #cbd5e1}td{padding:8px 16px;border-bottom:1px solid #e2e8f0;font-size:14px}.total-row{font-weight:bold;border-top:2px solid #334155}.bal{text-align:center;margin-top:20px;padding:12px;border:2px solid ${balance > 0 ? '#dc2626' : '#16a34a'};border-radius:8px;font-size:16px;color:${balance > 0 ? '#dc2626' : '#16a34a'}}@media print{body{margin:10px}}</style>
    </head><body>
      <div class="header">
        <div class="school">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
        <div style="font-size:13px;color:#475569">Monthly Fee Statement</div>
        <div style="font-size:16px;font-weight:bold;color:#1e40af;margin-top:8px">${d.monthName} ${d.year}</div>
      </div>
      <div style="max-width:500px;margin:0 auto">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;margin-bottom:16px">
          <div><strong>Name:</strong> ${s.name}</div>
          <div><strong>Class:</strong> ${s.class} ${s.section ? '- ' + s.section : ''}</div>
          <div><strong>Adm. No:</strong> ${s.admissionNo || '—'}</div>
          <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</div>
        </div>
        <table>
          <tr><th>Particulars</th><th style="text-align:right">Amount</th></tr>
          ${charged > 0 ? `<tr><td>Monthly Fee</td><td style="text-align:right">₹${charged.toLocaleString('en-IN')}</td></tr>` : ''}
          ${other > 0 ? `<tr><td>Other Charges</td><td style="text-align:right">₹${other.toLocaleString('en-IN')}</td></tr>` : ''}
          <tr class="total-row"><td>Total Due</td><td style="text-align:right">₹${(charged + other).toLocaleString('en-IN')}</td></tr>
          ${paid > 0 ? `<tr><td style="color:#16a34a">Amount Paid</td><td style="text-align:right;color:#16a34a;font-weight:bold">₹${paid.toLocaleString('en-IN')}</td></tr>` : ''}
        </table>
        <div class="bal"><strong>Outstanding Balance: ₹${balance.toLocaleString('en-IN')}</strong></div>
        <div style="margin-top:40px;display:flex;justify-content:space-between">
          <div style="border-top:1px solid #000;width:180px;text-align:center;padding-top:4px;font-size:11px">Parent's Signature</div>
          <div style="border-top:1px solid #000;width:180px;text-align:center;padding-top:4px;font-size:11px">Accountant</div>
        </div>
      </div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const printStudentProfile = () => {
    if (!student) return;
    const photoHtml = student.photo
      ? `<img src="${student.photo}" style="width:120px;height:150px;object-fit:cover;border-radius:8px;border:2px solid #e2e8f0" />`
      : `<div style="width:120px;height:150px;border-radius:8px;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-size:40px;font-weight:bold;color:#94a3b8">${form.firstName?.[0] || ''}${form.lastName?.[0] || ''}</div>`;

    const html = `<!DOCTYPE html><html><head><title>Student Profile - ${form.firstName} ${form.lastName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; margin:20px; color:#1e293b; font-size:13px; }
  .card { border:2px solid #006400; border-radius:12px; overflow:hidden; max-width:700px; margin:0 auto; }
  .card-header { background:#006400; color:white; text-align:center; padding:12px; }
  .school { font-size:18px; font-weight:bold; letter-spacing:1px; }
  .card-body { padding:20px; }
  .profile-row { display:flex; gap:20px; margin-bottom:16px; }
  .info-grid { flex:1; display:grid; grid-template-columns:1fr 1fr; gap:3px 16px; }
  .label { font-size:10px; color:#64748b; text-transform:uppercase; }
  .value { font-size:13px; font-weight:600; margin-bottom:4px; }
  .adm-badge { display:inline-block; background:#dc2626; color:white; padding:3px 20px; border-radius:4px; font-weight:bold; font-size:15px; }
  h3 { color:#006400; font-size:12px; border-bottom:2px solid #006400; padding-bottom:3px; margin:14px 0 8px; text-transform:uppercase; letter-spacing:1px; }
  .sig-row { display:flex; justify-content:space-between; margin-top:30px; padding:0 20px 16px; }
  .sig-line { border-top:1px solid #000; width:180px; text-align:center; padding-top:4px; font-size:10px; }
  @media print { body { margin:10px; } }
</style></head><body>
  <div class="card">
    <div class="card-header">
      <div class="school">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
      <div style="font-size:10px;opacity:0.8">Salarpur, Sector - 101 | Ph: 6397339902</div>
      <div style="font-size:13px;font-weight:bold;margin-top:4px;letter-spacing:2px">STUDENT PROFILE</div>
    </div>
    <div class="card-body">
      <div style="text-align:center;margin-bottom:12px"><span class="adm-badge">${student.admissionNo}</span></div>

      <div class="profile-row">
        ${photoHtml}
        <div class="info-grid">
          <div><div class="label">Name</div><div class="value" style="font-size:16px">${form.firstName} ${form.lastName}</div></div>
          <div><div class="label">Class / Section</div><div class="value">${student.class?.name || ''} — ${student.section?.name || ''}</div></div>
          <div><div class="label">Date of Birth</div><div class="value">${form.dateOfBirth ? new Date(form.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</div></div>
          <div><div class="label">Gender</div><div class="value">${form.gender === 'MALE' ? 'Male' : form.gender === 'FEMALE' ? 'Female' : form.gender || '—'}</div></div>
          <div><div class="label">Blood Group</div><div class="value" style="color:#dc2626">${form.bloodGroup || '—'}</div></div>
          <div><div class="label">Roll Number</div><div class="value">${form.rollNumber || '—'}</div></div>
          <div><div class="label">Category</div><div class="value">${form.category || '—'}</div></div>
          <div><div class="label">Religion</div><div class="value">${form.religion || '—'}</div></div>
          <div><div class="label">Nationality</div><div class="value">${form.nationality || '—'}</div></div>
          <div><div class="label">Aadhaar No.</div><div class="value">${form.aadhaarNumber || '—'}</div></div>
        </div>
      </div>

      <h3>Parent / Guardian Information</h3>
      <div class="info-grid" style="grid-template-columns:1fr 1fr 1fr">
        <div><div class="label">Father's Name</div><div class="value">${form.fatherName || '—'}</div></div>
        <div><div class="label">Occupation</div><div class="value">${form.fatherOccupation || '—'}</div></div>
        <div><div class="label">Phone</div><div class="value">${form.fatherPhone || '—'}</div></div>
        <div><div class="label">Mother's Name</div><div class="value">${form.motherName || '—'}</div></div>
        <div><div class="label">Occupation</div><div class="value">${form.motherOccupation || '—'}</div></div>
        <div><div class="label">Phone</div><div class="value">${form.motherPhone || '—'}</div></div>
        ${form.guardianName ? `<div><div class="label">Guardian</div><div class="value">${form.guardianName} (${form.guardianRelation || ''})</div></div>
        <div><div class="label">Guardian Phone</div><div class="value">${form.guardianPhone || '—'}</div></div>
        <div><div class="label">Annual Income</div><div class="value">${form.annualIncome ? '₹' + parseFloat(form.annualIncome).toLocaleString('en-IN') : '—'}</div></div>` : ''}
      </div>

      <h3>Address</h3>
      <div class="info-grid">
        <div><div class="label">Current Address</div><div class="value">${[form.currentAddress, form.currentCity, form.currentState, form.currentPincode].filter(Boolean).join(', ') || '—'}</div></div>
        <div><div class="label">Permanent Address</div><div class="value">${[form.permanentAddress, form.permanentCity, form.permanentState, form.permanentPincode].filter(Boolean).join(', ') || 'Same as current'}</div></div>
      </div>

      ${form.prevSchoolName ? `<h3>Previous School</h3>
      <div class="info-grid">
        <div><div class="label">School Name</div><div class="value">${form.prevSchoolName}</div></div>
        <div><div class="label">Board</div><div class="value">${form.prevSchoolBoard || '—'}</div></div>
        <div><div class="label">Last Class</div><div class="value">${form.prevLastGrade || '—'}</div></div>
        <div><div class="label">TC Number</div><div class="value">${form.prevTCNumber || '—'}</div></div>
      </div>` : ''}

      <h3>School Details</h3>
      <div class="info-grid">
        <div><div class="label">Admission No.</div><div class="value" style="color:#dc2626">${student.admissionNo}</div></div>
        <div><div class="label">Admission Date</div><div class="value">${form.admissionDate ? new Date(form.admissionDate).toLocaleDateString('en-IN') : '—'}</div></div>
        <div><div class="label">Class Teacher</div><div class="value">${student.section?.classTeacher ? student.section.classTeacher.user?.firstName + ' ' + student.section.classTeacher.user?.lastName : '—'}</div></div>
        <div><div class="label">House</div><div class="value">${form.house || '—'}</div></div>
      </div>
    </div>

    <div class="sig-row">
      <div class="sig-line">Parent's Signature</div>
      <div class="sig-line">Class Teacher</div>
      <div class="sig-line">Principal</div>
    </div>
  </div>
  <div style="text-align:center;font-size:10px;color:#94a3b8;margin-top:8px">Printed on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const handlePrintDiary = () => {
    if (!diaryData) return;
    const s = diaryData.student;
    const monthlyMax = diaryData.monthlyScholarship || 100;
    let cards = '';
    for (const d of diaryData.diary) {
      const att = d.isHoliday ? 'Holiday' : (d.attendance?.percentage != null ? d.attendance.percentage + '%' : '—');
      const test = d.testMarks?.percentage != null ? d.testMarks.percentage + '%' : '0%';
      const feeBal = d.feeBalancePct != null ? d.feeBalancePct + '%' : '0%';
      const grand = d.grandTotal || d.rewardAmount || 0;
      const br = d.scholarshipBreakdown;
      const breakdown = br ? `Att: ₹${br.attAmount} + Test: ₹${br.testAmount} + Fee: ₹${br.feeAmount}` : '';
      const quizLine = (d.quizBonus || 0) > 0 ? `<div style="background:#f3e8ff;padding:4px 16px;display:flex;justify-content:space-between;font-size:12px"><span style="color:#7c3aed;font-weight:bold">Quiz Bonus</span><span style="color:#7c3aed;font-weight:bold">+₹${d.quizBonus}</span></div>` : '';

      cards += `
        <div style="border:2px solid #1e40af;border-radius:8px;overflow:hidden;background:#fffbeb;page-break-inside:avoid">
          <div style="text-align:center;font-weight:bold;text-transform:uppercase;color:#1e40af;border-bottom:1px solid #cbd5e1;padding:8px;font-size:14px">${d.monthName}</div>
          <div style="padding:12px 16px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px">
              <div><strong>Attendance (10%):</strong> ${att}</div>
              <div><strong>Test marks (20%):</strong> ${test}</div>
              <div style="grid-column:span 2"><strong>Fee paid (70%):</strong> ${feeBal}</div>
            </div>
            ${breakdown ? `<div style="font-size:10px;color:#64748b;margin-top:4px">${breakdown}</div>` : ''}
          </div>
          ${quizLine}
          <div style="background:#1e3a8a;color:white;padding:8px 16px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;opacity:0.7">${(d.quizBonus || 0) > 0 ? 'Auto ₹' + (d.rewardAmount || 0) + ' + Quiz ₹' + d.quizBonus : 'of ₹' + monthlyMax + '/month'}</span>
            <span style="font-size:18px;font-weight:bold">${(d.quizBonus || 0) > 0 ? 'Grand Total' : 'Scholarship'}: ₹${grand.toLocaleString('en-IN')}</span>
          </div>
          ${d.comment ? `<div style="font-size:11px;color:#64748b;margin-top:4px;padding:0 16px"><strong>Comment:</strong> ${d.comment}</div>` : ''}
        </div>`;
    }

    const html = `<!DOCTYPE html><html><head><title>Scholarship Diary - ${s.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #1e293b; }
        .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 20px; }
        .school { font-size: 20px; font-weight: bold; color: #1e40af; }
        .student { font-size: 14px; color: #475569; margin-top: 4px; }
        .year-badge { display: inline-block; background: #dc2626; color: white; padding: 4px 16px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media print { body { margin: 10px; } .grid { gap: 12px; } }
      </style>
    </head><body>
      <div class="header">
        <div class="school">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
        <div class="student">${s.name} | ${s.class} ${s.section ? '- ' + s.section : ''} | Adm. No: ${s.admissionNo || ''}</div>
      </div>
      <div class="year-badge">${diaryYear}</div>
      <div style="text-align:center;font-size:11px;color:#666;margin-bottom:12px">Annual: ₹${(diaryData.annualScholarship || 1200).toLocaleString('en-IN')} | Monthly Max: ₹${monthlyMax} | Att 10% + Test 20% + Fee Balance 70%</div>
      <div class="grid">${cards}</div>
      <div style="margin-top:20px;font-size:11px;color:#94a3b8;text-align:center">Printed on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const updateField = (field: string, value: any) => setForm({ ...form, [field]: value });

  const bmi = form.height && form.weight
    ? (form.weight / ((form.height / 100) ** 2)).toFixed(1)
    : null;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/students')} className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            {/* Student Photo */}
            <div className="relative group">
              {student?.photo ? (
                <div className="relative">
                  <img src={student.photo} alt={`${form.firstName} ${form.lastName}`}
                    className="w-16 h-16 rounded-full object-cover border-2 border-blue-200" />
                  <button onClick={removePhoto}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                  {form.firstName?.[0]}{form.lastName?.[0]}
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition shadow-lg">
                {uploadingPhoto ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
              </label>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{form.firstName} {form.lastName}</h1>
              <p className="text-slate-500">Adm. No: {student?.admissionNo} | {student?.class?.name} - Section {student?.section?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* QR Code always visible */}
            <div className="flex flex-col items-center cursor-pointer group" onClick={() => setShowQR(true)}>
              <div className="bg-white border border-slate-200 rounded-lg p-1.5 group-hover:border-blue-400 transition">
                <QRCode value={`STU:${id}`} size={56} />
              </div>
              <span className="text-[9px] text-slate-400 mt-0.5 group-hover:text-blue-600">Print ID</span>
            </div>
            <button onClick={printStudentProfile} className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm">
              <Printer className="h-4 w-4" /> Print Profile
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">

          {/* PERSONAL TAB */}
          {activeTab === 'personal' && (
            <div className="space-y-5">
              {/* Hero Card — photo + key info at a glance */}
              <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-blue-800 rounded-2xl p-6 text-white flex flex-col md:flex-row gap-6 items-center">
                {/* Large Photo */}
                <div className="relative group shrink-0">
                  {student?.photo ? (
                    <img src={student.photo} alt="" className="w-32 h-32 rounded-2xl object-cover border-4 border-white/20 shadow-lg" />
                  ) : (
                    <div className="w-32 h-32 rounded-2xl bg-white/10 flex items-center justify-center text-5xl font-bold text-white/60">
                      {form.firstName?.[0]}{form.lastName?.[0]}
                    </div>
                  )}
                  <label className="absolute bottom-1 right-1 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-400 transition shadow-lg">
                    {uploadingPhoto ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="h-4 w-4" />}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
                  </label>
                </div>
                {/* Key Info */}
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-3xl font-bold">{form.firstName} {form.lastName}</h2>
                  <div className="flex flex-wrap gap-3 mt-2 justify-center md:justify-start">
                    <span className="px-3 py-1 bg-white/10 rounded-full text-sm">{student?.class?.name} — {student?.section?.name}</span>
                    <span className="px-3 py-1 bg-white/10 rounded-full text-sm">Adm: {student?.admissionNo}</span>
                    {form.rollNumber && <span className="px-3 py-1 bg-white/10 rounded-full text-sm">Roll: {form.rollNumber}</span>}
                    {form.gender && <span className="px-3 py-1 bg-white/10 rounded-full text-sm">{form.gender === 'MALE' ? 'Male' : form.gender === 'FEMALE' ? 'Female' : 'Other'}</span>}
                    {form.bloodGroup && <span className="px-3 py-1 bg-red-500/30 rounded-full text-sm font-bold">{form.bloodGroup}</span>}
                  </div>
                  {form.dateOfBirth && (
                    <p className="text-blue-200 text-sm mt-2">
                      DOB: {new Date(form.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                      {' '}({Math.floor((Date.now() - new Date(form.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years old)
                    </p>
                  )}
                </div>
                {/* QR */}
                <div className="shrink-0 bg-white rounded-xl p-2">
                  <QRCode value={`STU:${id}`} size={80} />
                </div>
              </div>

              {/* Editable Fields — two sections side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Basic Details */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><User className="h-4 w-4 text-blue-600" /></div>
                    <h3 className="text-sm font-semibold text-slate-900">Basic Details</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First Name" value={form.firstName} onChange={v => updateField('firstName', v)} />
                    <Field label="Last Name" value={form.lastName} onChange={v => updateField('lastName', v)} />
                    <Field label="Date of Birth" value={form.dateOfBirth} onChange={v => updateField('dateOfBirth', v)} type="date" />
                    <SelectField label="Gender" value={form.gender} onChange={v => updateField('gender', v)} options={[{v:'MALE',l:'Male'},{v:'FEMALE',l:'Female'},{v:'OTHER',l:'Other'}]} />
                    <Field label="Blood Group" value={form.bloodGroup} onChange={v => updateField('bloodGroup', v)} placeholder="e.g. O+, A-, B+" />
                    <Field label="Roll Number" value={form.rollNumber} onChange={v => updateField('rollNumber', v)} />
                  </div>
                </div>

                {/* Contact & Identity */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><FileText className="h-4 w-4 text-green-600" /></div>
                    <h3 className="text-sm font-semibold text-slate-900">Contact & Identity</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Email" value={form.email} onChange={v => updateField('email', v)} type="email" />
                    <Field label="Phone" value={form.phone} onChange={v => updateField('phone', v)} />
                    <Field label="Aadhaar Number" value={form.aadhaarNumber} onChange={v => updateField('aadhaarNumber', v)} placeholder="12-digit Aadhaar" />
                    <Field label="Nationality" value={form.nationality} onChange={v => updateField('nationality', v)} placeholder="e.g. Indian" />
                    <Field label="Religion" value={form.religion} onChange={v => updateField('religion', v)} />
                    <SelectField label="Category" value={form.category} onChange={v => updateField('category', v)} options={[{v:'',l:'Select'},{v:'GENERAL',l:'General'},{v:'OBC',l:'OBC'},{v:'SC',l:'SC'},{v:'ST',l:'ST'}]} />
                  </div>
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                  <CalendarCheck className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs text-blue-600 font-medium">Class</p>
                  <p className="text-lg font-bold text-blue-900">{student?.class?.name}</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
                  <GraduationCap className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs text-purple-600 font-medium">Section</p>
                  <p className="text-lg font-bold text-purple-900">{student?.section?.name || '—'}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                  <Award className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                  <p className="text-xs text-amber-600 font-medium">Admission No</p>
                  <p className="text-lg font-bold text-amber-900">{student?.admissionNo}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                  <School className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                  <p className="text-xs text-emerald-600 font-medium">Class Teacher</p>
                  <p className="text-sm font-bold text-emerald-900 truncate">{student?.section?.classTeacher ? `${student.section.classTeacher.user?.firstName} ${student.section.classTeacher.user?.lastName}` : '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* PARENT INFO TAB */}
          {activeTab === 'parent' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Father&apos;s Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Father's Name" value={form.fatherName} onChange={v => updateField('fatherName', v)} />
                <Field label="Occupation" value={form.fatherOccupation} onChange={v => updateField('fatherOccupation', v)} />
                <Field label="Phone" value={form.fatherPhone} onChange={v => updateField('fatherPhone', v)} />
                <Field label="Email" value={form.fatherEmail} onChange={v => updateField('fatherEmail', v)} type="email" />
              </div>

              <h2 className="text-lg font-semibold text-slate-900 pt-4">Mother&apos;s Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Mother's Name" value={form.motherName} onChange={v => updateField('motherName', v)} />
                <Field label="Occupation" value={form.motherOccupation} onChange={v => updateField('motherOccupation', v)} />
                <Field label="Phone" value={form.motherPhone} onChange={v => updateField('motherPhone', v)} />
                <Field label="Email" value={form.motherEmail} onChange={v => updateField('motherEmail', v)} type="email" />
              </div>

              <h2 className="text-lg font-semibold text-slate-900 pt-4">Guardian Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Guardian Name" value={form.guardianName} onChange={v => updateField('guardianName', v)} />
                <Field label="Relation" value={form.guardianRelation} onChange={v => updateField('guardianRelation', v)} />
                <Field label="Phone" value={form.guardianPhone} onChange={v => updateField('guardianPhone', v)} />
                <Field label="Annual Income (₹)" value={form.annualIncome} onChange={v => updateField('annualIncome', v)} type="number" />
              </div>
            </div>
          )}

          {/* ADDRESS TAB */}
          {activeTab === 'address' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Current Address</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Field label="Address" value={form.currentAddress} onChange={v => updateField('currentAddress', v)} />
                </div>
                <Field label="City" value={form.currentCity} onChange={v => updateField('currentCity', v)} />
                <Field label="State" value={form.currentState} onChange={v => updateField('currentState', v)} />
                <Field label="Pincode" value={form.currentPincode} onChange={v => updateField('currentPincode', v)} />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setForm({ ...form, permanentAddress: form.currentAddress, permanentCity: form.currentCity, permanentState: form.currentState, permanentPincode: form.currentPincode })}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Copy current address to permanent
                </button>
              </div>

              <h2 className="text-lg font-semibold text-slate-900 pt-4">Permanent Address</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Field label="Address" value={form.permanentAddress} onChange={v => updateField('permanentAddress', v)} />
                </div>
                <Field label="City" value={form.permanentCity} onChange={v => updateField('permanentCity', v)} />
                <Field label="State" value={form.permanentState} onChange={v => updateField('permanentState', v)} />
                <Field label="Pincode" value={form.permanentPincode} onChange={v => updateField('permanentPincode', v)} />
              </div>
            </div>
          )}

          {/* ADMISSION TAB */}
          {activeTab === 'admission' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Admission Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Admission Number" value={student?.admissionNo} disabled />
                <Field label="Admission Date" value={form.admissionDate} onChange={v => updateField('admissionDate', v)} type="date" />
                <Field label="Admitted Class" value={form.admittedGrade} onChange={v => updateField('admittedGrade', v)} />
                <Field label="Current Class" value={student?.class?.name} disabled />
                <Field label="Current Section" value={student?.section?.name} disabled />
                <Field label="House" value={form.house} onChange={v => updateField('house', v)} placeholder="e.g. Red, Blue, Green" />
                <SelectField label="Stream" value={form.stream} onChange={v => updateField('stream', v)} options={[{v:'NONE',l:'None'},{v:'SCIENCE',l:'Science'},{v:'COMMERCE',l:'Commerce'},{v:'ARTS',l:'Arts'}]} />
                <Field label="Class Teacher" value={student?.section?.classTeacher ? `${student.section.classTeacher.user?.firstName} ${student.section.classTeacher.user?.lastName}` : 'Not assigned'} disabled />
              </div>
            </div>
          )}

          {/* PREVIOUS SCHOOL TAB */}
          {activeTab === 'previous' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Previous School Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="School Name" value={form.prevSchoolName} onChange={v => updateField('prevSchoolName', v)} />
                <Field label="Board" value={form.prevSchoolBoard} onChange={v => updateField('prevSchoolBoard', v)} placeholder="e.g. CBSE, ICSE, State Board" />
                <Field label="Last Class Completed" value={form.prevLastGrade} onChange={v => updateField('prevLastGrade', v)} />
                <Field label="TC Number" value={form.prevTCNumber} onChange={v => updateField('prevTCNumber', v)} />
              </div>
            </div>
          )}

          {/* PROMOTION HISTORY TAB */}
          {activeTab === 'promotion' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Promotion History</h2>
              {student?.promotionHistory?.length === 0 ? (
                <p className="text-slate-400 py-4">No promotion history recorded</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Academic Year</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">From Class</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">To Class</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Result</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {student.promotionHistory.map((p: any) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 text-sm text-slate-900">{p.year}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{p.fromGrade}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{p.toGrade}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            p.result === 'PROMOTED' ? 'bg-green-100 text-green-700' :
                            p.result === 'DETAINED' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{p.result}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">{p.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TIMELINE TAB */}
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Student Timeline</h2>
              {student?.timeline?.length === 0 ? (
                <p className="text-slate-400 py-4">No events recorded</p>
              ) : (
                <div className="space-y-4">
                  {student.timeline.map((t: any) => (
                    <div key={t.id} className="flex gap-4 items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{t.event}</p>
                        <p className="text-sm text-slate-500">{t.description}</p>
                        <p className="text-xs text-slate-400 mt-1">{formatDate(t.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HEALTH TAB */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Health Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Height (cm)" value={form.height} onChange={v => updateField('height', v)} type="number" />
                <Field label="Weight (kg)" value={form.weight} onChange={v => updateField('weight', v)} type="number" />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">BMI</label>
                  <div className={`px-3 py-2 border rounded-lg text-sm font-medium ${
                    bmi ? (parseFloat(bmi) < 18.5 ? 'bg-yellow-50 border-yellow-300 text-yellow-700' :
                           parseFloat(bmi) > 25 ? 'bg-red-50 border-red-300 text-red-700' :
                           'bg-green-50 border-green-300 text-green-700') : 'bg-slate-50 border-slate-300 text-slate-500'
                  }`}>
                    {bmi || 'Enter height & weight'}
                  </div>
                </div>
                <Field label="Vision" value={form.vision} onChange={v => updateField('vision', v)} placeholder="e.g. Normal, 6/6" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Hearing" value={form.hearing} onChange={v => updateField('hearing', v)} placeholder="e.g. Normal" />
                <Field label="Allergies" value={form.allergies} onChange={v => updateField('allergies', v)} placeholder="e.g. Dust, Peanuts" />
                <Field label="Medical Conditions" value={form.medicalConditions} onChange={v => updateField('medicalConditions', v)} />
                <Field label="Disability" value={form.disability} onChange={v => updateField('disability', v)} placeholder="None or specify" />
                <Field label="Emergency Contact Name" value={form.emergencyContactName} onChange={v => updateField('emergencyContactName', v)} />
                <Field label="Emergency Contact Phone" value={form.emergencyContactPhone} onChange={v => updateField('emergencyContactPhone', v)} />
              </div>
            </div>
          )}

          {/* VACCINATION TAB */}
          {activeTab === 'vaccination' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Vaccination Tracker</h2>
              {student?.vaccinations?.length === 0 ? (
                <p className="text-slate-400 py-4">No vaccination records</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Vaccine</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Date</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Next Due</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {student.vaccinations.map((v: any) => (
                      <tr key={v.id}>
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">{v.vaccineName}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{v.date ? formatDate(v.date) : '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{v.nextDue ? formatDate(v.nextDue) : '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            v.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            v.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                            v.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{v.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ATTENDANCE TAB */}
          {activeTab === 'attendance' && (() => {
            const pct = attData?.summary?.percentage != null ? Number(attData.summary.percentage) : 0;
            const pctColor = pct >= 90 ? 'text-green-600' : pct >= 75 ? 'text-yellow-600' : 'text-red-600';
            const ringColor = pct >= 90 ? '#16a34a' : pct >= 75 ? '#ca8a04' : '#dc2626';
            const ringBg = pct >= 90 ? '#dcfce7' : pct >= 75 ? '#fef9c3' : '#fee2e2';
            const circumference = 2 * Math.PI * 54;
            const offset = circumference - (pct / 100) * circumference;

            // Absent dates list
            const absentDates = (attData?.records || [])
              .filter((r: any) => r.status === 'ABSENT')
              .map((r: any) => {
                const d = new Date(r.date);
                return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' });
              });

            const lateDates = (attData?.records || [])
              .filter((r: any) => r.status === 'LATE')
              .map((r: any) => {
                const d = new Date(r.date);
                return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' });
              });

            return (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Attendance</h2>
                <div className="flex items-center gap-2">
                  <select value={attMonth} onChange={e => setAttMonth(Number(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select value={attYear} onChange={e => setAttYear(Number(e.target.value))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {/* Top section: Ring + Stats */}
              {attData?.summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Attendance Ring */}
                  <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="relative w-36 h-36">
                      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="54" fill="none" stroke={ringBg} strokeWidth="10" />
                        <circle cx="60" cy="60" r="54" fill="none" stroke={ringColor} strokeWidth="10"
                          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-3xl font-black ${pctColor}`}>{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      {pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good' : pct >= 50 ? 'Needs Improvement' : 'Critical'}
                    </p>
                  </div>

                  {/* Stat Cards */}
                  <div className="grid grid-cols-2 gap-3 content-start">
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
                      <p className="text-3xl font-black text-slate-800">{attData.summary.total}</p>
                      <p className="text-xs text-slate-500 mt-1">Working Days</p>
                    </div>
                    <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
                      <p className="text-3xl font-black text-green-600">{attData.summary.present}</p>
                      <p className="text-xs text-green-600 mt-1">Present</p>
                    </div>
                    <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
                      <p className="text-3xl font-black text-red-600">{attData.summary.absent}</p>
                      <p className="text-xs text-red-600 mt-1">Absent</p>
                    </div>
                    <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-center">
                      <p className="text-3xl font-black text-yellow-600">{attData.summary.late}</p>
                      <p className="text-xs text-yellow-600 mt-1">Late</p>
                    </div>
                  </div>

                  {/* Absent & Late Dates */}
                  <div className="space-y-3">
                    {absentDates.length > 0 && (
                      <div className="bg-red-50 rounded-xl border border-red-200 p-4">
                        <p className="text-xs font-bold text-red-700 mb-2">ABSENT DATES ({absentDates.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {absentDates.map((d: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-red-100 text-red-700 rounded text-[11px] font-medium">{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {lateDates.length > 0 && (
                      <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
                        <p className="text-xs font-bold text-yellow-700 mb-2">LATE DATES ({lateDates.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {lateDates.map((d: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[11px] font-medium">{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {absentDates.length === 0 && lateDates.length === 0 && (
                      <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
                        <p className="text-green-700 font-bold text-sm">Perfect Attendance!</p>
                        <p className="text-xs text-green-600 mt-1">No absences or late arrivals this month</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Calendar grid */}
              {attData?.records?.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Daily View</h3>
                  <div className="grid grid-cols-7 gap-2 text-center mb-3">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                      <div key={d} className="text-xs font-bold text-slate-400 py-1 uppercase tracking-wider">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {(() => {
                      const firstDay = new Date(attYear, attMonth - 1, 1);
                      const lastDay = new Date(attYear, attMonth, 0).getDate();
                      let startDay = firstDay.getDay() - 1;
                      if (startDay < 0) startDay = 6;

                      const cells = [];
                      for (let i = 0; i < startDay; i++) {
                        cells.push(<div key={`empty-${i}`} />);
                      }
                      const recordMap = new Map(
                        attData.records.map((r: any) => {
                          const d = new Date(r.date);
                          return [d.getUTCDate(), r.status];
                        })
                      );
                      for (let day = 1; day <= lastDay; day++) {
                        const status = recordMap.get(day) as string | undefined;
                        const isSunday = new Date(attYear, attMonth - 1, day).getDay() === 0;

                        let bg, border, textColor, icon;
                        if (status === 'PRESENT') {
                          bg = 'bg-green-100'; border = 'border-green-300'; textColor = 'text-green-800'; icon = '✓';
                        } else if (status === 'ABSENT') {
                          bg = 'bg-red-100'; border = 'border-red-400 border-2'; textColor = 'text-red-700'; icon = '✗';
                        } else if (status === 'LATE') {
                          bg = 'bg-yellow-100'; border = 'border-yellow-400 border-2'; textColor = 'text-yellow-700'; icon = '!';
                        } else if (isSunday) {
                          bg = 'bg-blue-50'; border = 'border-blue-200'; textColor = 'text-blue-400'; icon = '';
                        } else {
                          bg = 'bg-slate-50'; border = 'border-slate-200'; textColor = 'text-slate-300'; icon = '';
                        }

                        cells.push(
                          <div key={day} className={`${bg} ${textColor} border ${border} rounded-xl p-1.5 text-center relative transition-transform hover:scale-110`} title={status || (isSunday ? 'Sunday' : 'No record')}>
                            <div className="text-sm font-bold">{day}</div>
                            {icon && <div className="text-[10px] font-black leading-none">{icon}</div>}
                          </div>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                  {/* Legend */}
                  <div className="flex gap-5 mt-5 justify-center text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-green-100 border border-green-300 flex items-center justify-center text-green-800 text-[9px] font-black">✓</span> Present</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-red-100 border-2 border-red-400 flex items-center justify-center text-red-700 text-[9px] font-black">✗</span> Absent</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-yellow-100 border-2 border-yellow-400 flex items-center justify-center text-yellow-700 text-[9px] font-black">!</span> Late</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-blue-50 border border-blue-200"></span> Sunday</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md bg-slate-50 border border-slate-200"></span> Holiday</span>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                  No attendance records for this month
                </div>
              )}
            </div>
            );
          })()}

          {/* EXAM RESULTS TAB */}
          {activeTab === 'exams' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Exam Results</h2>

              {examLoading ? (
                <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
              ) : examData.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">No exam results found</div>
              ) : (() => {
                // Group by exam
                const examMap = new Map<string, { exam: any; grades: any[] }>();
                for (const g of examData) {
                  const examId = g.examSubject?.exam?.id;
                  if (!examId) continue;
                  if (!examMap.has(examId)) {
                    examMap.set(examId, { exam: g.examSubject.exam, grades: [] });
                  }
                  examMap.get(examId)!.grades.push(g);
                }

                return (
                  <div className="space-y-6">
                    {/* Overall summary */}
                    {(() => {
                      const totalMarks = examData.reduce((s: number, g: any) => s + g.marksObtained, 0);
                      const totalMax = examData.reduce((s: number, g: any) => s + (g.examSubject?.maxMarks || 0), 0);
                      const overallPct = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                            <p className="text-sm text-slate-500">Total Exams</p>
                            <p className="text-2xl font-bold text-slate-900">{examMap.size}</p>
                          </div>
                          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                            <p className="text-sm text-slate-500">Subjects Graded</p>
                            <p className="text-2xl font-bold text-blue-600">{examData.length}</p>
                          </div>
                          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                            <p className="text-sm text-slate-500">Total Marks</p>
                            <p className="text-2xl font-bold text-slate-900">{totalMarks} / {totalMax}</p>
                          </div>
                          <div className={`rounded-xl border p-4 text-center ${overallPct >= 75 ? 'bg-green-50 border-green-200' : overallPct >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
                            <p className="text-sm text-slate-500">Overall %</p>
                            <p className={`text-2xl font-bold ${overallPct >= 75 ? 'text-green-600' : overallPct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{overallPct}%</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Per-exam cards */}
                    {Array.from(examMap.entries()).map(([examId, { exam, grades }]) => {
                      const examTotal = grades.reduce((s, g) => s + g.marksObtained, 0);
                      const examMax = grades.reduce((s, g) => s + (g.examSubject?.maxMarks || 0), 0);
                      const examPct = examMax > 0 ? Math.round((examTotal / examMax) * 100) : 0;
                      const examDate = exam.startDate ? new Date(exam.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';

                      const typeColors: Record<string, string> = {
                        FA1: 'bg-blue-100 text-blue-700', FA2: 'bg-indigo-100 text-indigo-700',
                        SA1: 'bg-purple-100 text-purple-700', SA2: 'bg-violet-100 text-violet-700',
                        ANNUAL: 'bg-red-100 text-red-700', MIDTERM: 'bg-orange-100 text-orange-700',
                        UNIT_TEST: 'bg-teal-100 text-teal-700', QUIZ: 'bg-cyan-100 text-cyan-700',
                        FINAL: 'bg-rose-100 text-rose-700',
                      };

                      return (
                        <div key={examId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                          {/* Exam header */}
                          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${typeColors[exam.type] || 'bg-slate-100 text-slate-600'}`}>{exam.type?.replace('_', ' ')}</span>
                              <h3 className="text-sm font-semibold text-slate-900">{exam.name}</h3>
                              {examDate && <span className="text-xs text-slate-400">{examDate}</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-slate-600">{examTotal}/{examMax}</span>
                              <span className={`text-sm font-bold ${examPct >= 75 ? 'text-green-600' : examPct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{examPct}%</span>
                            </div>
                          </div>
                          {/* Subject rows */}
                          <table className="w-full">
                            <thead>
                              <tr className="text-xs text-slate-400 uppercase">
                                <th className="text-left px-5 py-2">Subject</th>
                                <th className="text-center px-4 py-2">Marks</th>
                                <th className="text-center px-4 py-2">Max</th>
                                <th className="text-center px-4 py-2">Pass</th>
                                <th className="text-center px-4 py-2">%</th>
                                <th className="text-center px-4 py-2">Grade</th>
                                <th className="text-center px-4 py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {grades.map((g: any) => {
                                const pct = g.examSubject?.maxMarks > 0 ? Math.round((g.marksObtained / g.examSubject.maxMarks) * 100) : 0;
                                const passed = g.marksObtained >= (g.examSubject?.passingMarks || 0);
                                return (
                                  <tr key={g.id} className={`${passed ? '' : 'bg-red-50'}`}>
                                    <td className="px-5 py-2.5 text-sm font-medium text-slate-900">{g.examSubject?.subject?.name}</td>
                                    <td className={`px-4 py-2.5 text-sm text-center font-bold ${passed ? 'text-slate-900' : 'text-red-600'}`}>{g.marksObtained}</td>
                                    <td className="px-4 py-2.5 text-sm text-center text-slate-500">{g.examSubject?.maxMarks}</td>
                                    <td className="px-4 py-2.5 text-sm text-center text-slate-400">{g.examSubject?.passingMarks}</td>
                                    <td className={`px-4 py-2.5 text-sm text-center font-medium ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}%</td>
                                    <td className="px-4 py-2.5 text-center">
                                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                        g.grade === 'A+' || g.grade === 'A' ? 'bg-green-100 text-green-700' :
                                        g.grade === 'B+' || g.grade === 'B' ? 'bg-blue-100 text-blue-700' :
                                        g.grade === 'C+' || g.grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                                        g.grade === 'D' ? 'bg-orange-100 text-orange-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>{g.grade || '—'}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      {passed ? (
                                        <span className="text-green-600 text-xs font-bold">PASS</span>
                                      ) : (
                                        <span className="text-red-600 text-xs font-bold">FAIL</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* FEE LEDGER TAB */}
          {activeTab === 'fees' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Fee Ledger</h2>
                  {ledgerData?.student?.familyName && (
                    <p className="text-sm text-slate-500">Family: {ledgerData.student.familyName}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {ledgerData?.siblings?.length > 1 && (
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={ledgerFamily} onChange={e => setLedgerFamily(e.target.checked)} />
                      Family view
                    </label>
                  )}
                  <button onClick={() => { setShowOpeningBalance(!showOpeningBalance); setShowChargeForm(false); setShowDepositForm(false); }} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                    Opening Balance
                  </button>
                  <button onClick={() => { setShowChargeForm(!showChargeForm); setShowDepositForm(false); setShowOpeningBalance(false); }} className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">
                    + Charge
                  </button>
                  <button onClick={() => { setShowDepositForm(!showDepositForm); setShowChargeForm(false); setShowOpeningBalance(false); }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                    + Deposit
                  </button>
                  {ledgerData?.ledger?.length > 0 && (
                    <button onClick={handlePrintLedger} className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800">
                      <Printer className="h-3.5 w-3.5" /> Print
                    </button>
                  )}
                </div>
              </div>

              {/* Siblings info */}
              {ledgerData?.siblings?.length > 1 && (
                <div className="flex gap-3 flex-wrap">
                  {ledgerData.siblings.map((s: any) => (
                    <span key={s.id} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {s.name} — {s.class}
                    </span>
                  ))}
                </div>
              )}

              {/* Balance card */}
              <div className={`rounded-xl p-5 border ${ledgerData?.currentBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <p className="text-sm text-slate-600">Current Balance</p>
                <p className={`text-3xl font-bold ${ledgerData?.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(ledgerData?.currentBalance || 0)}
                </p>
                {ledgerData?.currentBalance > 0 && <p className="text-sm text-red-500 mt-1">Dues pending</p>}
                {ledgerData?.currentBalance <= 0 && <p className="text-sm text-green-600 mt-1">All dues cleared</p>}
              </div>

              {/* View toggle: all ledger vs purchases (admission-kit items) only */}
              {ledgerData?.entries?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-500 uppercase">View:</span>
                  <button onClick={() => setLedgerView('all')}
                    className={`px-3 py-1.5 text-xs rounded-full font-medium transition ${ledgerView === 'all' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    All (Fees & Purchases)
                  </button>
                  <button onClick={() => setLedgerView('purchases')}
                    className={`px-3 py-1.5 text-xs rounded-full font-medium transition ${ledgerView === 'purchases' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Purchases Only (Dress / Tie / Belt / Books / Copy / Dairy)
                  </button>
                </div>
              )}

              {/* Empty ledger — prompt to set opening balance */}
              {!ledgerData?.ledger?.length && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
                  <p className="text-sm text-purple-800 font-medium mb-2">No ledger entries yet</p>
                  <p className="text-xs text-purple-600 mb-4">Start by adding an opening balance if the student has previous year dues, or add the first monthly charge.</p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => setShowOpeningBalance(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                      Set Opening Balance
                    </button>
                    <button onClick={() => setShowChargeForm(true)} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">
                      Add First Charge
                    </button>
                  </div>
                </div>
              )}

              {/* Opening Balance form */}
              {showOpeningBalance && (
                <form onSubmit={handleOpeningBalance} className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-purple-800">Set Previous Year Balance</h3>
                  <p className="text-xs text-purple-600">Use this to carry forward unpaid balance from previous years (e.g. student is here 5 years but paid for only 2 years).</p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input type="number" placeholder="Previous balance amount (₹)" value={openingForm.amount} onChange={e => setOpeningForm({...openingForm, amount: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                    <select value={openingForm.year} onChange={e => setOpeningForm({...openingForm, year: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      {['2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <input type="month" value={openingForm.month} onChange={e => setOpeningForm({...openingForm, month: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" placeholder="Month (optional)" />
                    <div className="flex gap-2">
                      <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Save</button>
                      <button type="button" onClick={() => setShowOpeningBalance(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                    </div>
                  </div>
                </form>
              )}

              {/* Deposit form */}
              {showDepositForm && (
                <form onSubmit={handleDeposit} className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-green-800">Record Deposit</h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input type="month" value={depositForm.month} onChange={e => setDepositForm({...depositForm, month: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" placeholder="Month" />
                    <input type="number" placeholder="Amount (₹)" value={depositForm.amount} onChange={e => setDepositForm({...depositForm, amount: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                    <select value={depositForm.paymentMethod} onChange={e => setDepositForm({...depositForm, paymentMethod: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      {['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'DD'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                    </select>
                    <input placeholder="Received by" value={depositForm.receivedBy} onChange={e => setDepositForm({...depositForm, receivedBy: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    <div className="flex gap-2">
                      <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Save</button>
                      <button type="button" onClick={() => setShowDepositForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                    </div>
                  </div>
                </form>
              )}

              {/* Charge form */}
              {showChargeForm && (
                <form onSubmit={handleCharge} className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-orange-800">Add Charge</h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input type="month" value={chargeForm.month} onChange={e => setChargeForm({...chargeForm, month: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" placeholder="Month" />
                    <select value={chargeForm.category} onChange={e => setChargeForm({...chargeForm, category: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      {['MONTHLY_FEE', 'ANNUAL', 'BOOK', 'DRESS', 'COPY', 'DAIRY', 'TIE_BELT', 'TRANSPORT', 'REGISTRATION', 'ADMISSION', 'AD_HOC', 'PREVIOUS_BALANCE'].map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                    </select>
                    <input placeholder="Description (optional)" value={chargeForm.description} onChange={e => setChargeForm({...chargeForm, description: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    <input type="number" placeholder="Amount (₹)" value={chargeForm.amount} onChange={e => setChargeForm({...chargeForm, amount: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                    <div className="flex gap-2">
                      <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">Add</button>
                      <button type="button" onClick={() => setShowChargeForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                    </div>
                  </div>
                </form>
              )}

              {/* Ledger table — matches physical register */}
              {ledgerView === 'all' && ledgerData?.ledger?.length > 0 && (() => {
                // Group by academic year (Apr-Mar)
                const getAcademicYear = (month: string) => {
                  const [y, m] = month.split('-').map(Number);
                  return m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
                };
                let lastYear = '';

                return (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Month</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Monthly Fee</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Other</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Total Due</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Deposited</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Balance</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Date / Sign</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ledgerData.ledger.map((row: any) => {
                          const year = getAcademicYear(row.month);
                          const showYearHeader = year !== lastYear;
                          lastYear = year;
                          const isPrevBalance = row.monthlyFee === 0 && row.otherCharges > 0 && row.otherDetails.some((d: string) => d.toLowerCase().includes('previous') || d.toLowerCase().includes('opening'));

                          return (
                            <>{showYearHeader && (
                              <tr key={`year-${year}`} className="bg-blue-50">
                                <td colSpan={7} className="px-4 py-2 text-sm font-bold text-blue-700">Academic Year {year}</td>
                              </tr>
                            )}
                            <tr key={row.month} className={`hover:bg-slate-50 ${isPrevBalance ? 'bg-purple-50' : ''}`}>
                              <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                {new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                {isPrevBalance && <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Prev. Balance</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-700 text-right">
                                {row.monthlyFee > 0 ? formatCurrency(row.monthlyFee) : '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {row.otherCharges > 0 ? (
                                  <span className="text-orange-600 cursor-help" title={row.otherDetails.join('\n')}>
                                    {formatCurrency(row.otherCharges)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                                {formatCurrency(row.balance + row.deposited)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {row.deposited > 0 ? (
                                  <span className="text-green-600 font-semibold">{formatCurrency(row.deposited)}</span>
                                ) : '—'}
                              </td>
                              <td className={`px-4 py-3 text-sm font-bold text-right ${row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(row.balance)}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-400">
                                {row.depositDates.length > 0 && (
                                  <div>{new Date(row.depositDates[0]).toLocaleDateString('en-IN')}</div>
                                )}
                                {row.depositMethods.length > 0 && (
                                  <div>{row.depositMethods[0]}</div>
                                )}
                              </td>
                            </tr></>
                          );
                        })}
                        {/* Totals row */}
                        <tr className="bg-slate-100 border-t-2 border-slate-300">
                          <td className="px-4 py-3 text-sm font-bold text-slate-900">TOTAL</td>
                          <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(ledgerData.totals?.totalMonthlyFees || 0)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-orange-600 text-right">{formatCurrency(ledgerData.totals?.totalOtherCharges || 0)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(ledgerData.totals?.totalCharged || 0)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">{formatCurrency(ledgerData.totals?.totalDeposited || 0)}</td>
                          <td className={`px-4 py-3 text-sm font-bold text-right ${ledgerData.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(ledgerData.currentBalance)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Purchases-only table (admission-kit items: dress, tie/belt, books, copy, dairy) */}
              {ledgerView === 'purchases' && (() => {
                const PURCHASE_CATS = ['DRESS', 'TIE_BELT', 'BOOK', 'COPY', 'DAIRY'];
                const CAT_COLORS: Record<string, string> = {
                  DRESS: 'bg-pink-100 text-pink-700',
                  TIE_BELT: 'bg-amber-100 text-amber-700',
                  BOOK: 'bg-blue-100 text-blue-700',
                  COPY: 'bg-emerald-100 text-emerald-700',
                  DAIRY: 'bg-purple-100 text-purple-700',
                };
                const purchases = (ledgerData?.entries || []).filter(
                  (e: any) => e.type === 'CHARGE' && PURCHASE_CATS.includes(e.category)
                );
                const total = purchases.reduce((s: number, p: any) => s + p.amount, 0);

                // Breakup by category
                const breakup: Record<string, { count: number; total: number }> = {};
                for (const p of purchases) {
                  if (!breakup[p.category]) breakup[p.category] = { count: 0, total: 0 };
                  breakup[p.category].count += 1;
                  breakup[p.category].total += p.amount;
                }

                const fmtDateTime = (d: string | Date) =>
                  new Date(d).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  });

                if (purchases.length === 0) {
                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                      <p className="text-sm text-slate-600">No purchases recorded for this student.</p>
                      <p className="text-xs text-slate-400 mt-1">Admission-time items (Dress, Tie/Belt, Books, Copy, Dairy) will appear here.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Category breakup cards */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">Purchase Breakup</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {PURCHASE_CATS.map(cat => {
                          const b = breakup[cat];
                          if (!b) return null;
                          return (
                            <div key={cat} className="bg-white rounded-xl border border-slate-200 p-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${CAT_COLORS[cat]}`}>
                                {cat.replace(/_/g, ' ')}
                              </span>
                              <p className="text-lg font-bold text-slate-900 mt-2">{formatCurrency(b.total)}</p>
                              <p className="text-xs text-slate-400">{b.count} {b.count === 1 ? 'item' : 'items'}</p>
                            </div>
                          );
                        })}
                        <div className="bg-orange-50 rounded-xl border border-orange-200 p-3">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-orange-700 bg-orange-100">GRAND TOTAL</span>
                          <p className="text-lg font-bold text-orange-700 mt-2">{formatCurrency(total)}</p>
                          <p className="text-xs text-orange-600">{purchases.length} {purchases.length === 1 ? 'item' : 'items'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Detail table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Date &amp; Time</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Item</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Category</th>
                            <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {purchases.map((p: any) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                {fmtDateTime(p.date)}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.description}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CAT_COLORS[p.category] || 'bg-slate-100 text-slate-700'}`}>
                                  {p.category.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                                {formatCurrency(p.amount)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-100 border-t-2 border-slate-300">
                            <td colSpan={3} className="px-4 py-3 text-sm font-bold text-slate-900">TOTAL ({purchases.length} items)</td>
                            <td className="px-4 py-3 text-sm font-bold text-orange-600 text-right">{formatCurrency(total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* MONTHLY DIARY TAB */}
          {activeTab === 'diary' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Scholarship Diary</h2>
                  <p className="text-sm text-slate-500">Attendance, test marks, fee submission, discipline & scholarship</p>
                </div>
                <div className="flex items-center gap-3">
                  <select value={diaryYear} onChange={e => setDiaryYear(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
                    {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  {diaryData?.diary?.length > 0 && (
                    <button onClick={handlePrintDiary} className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800">
                      <Printer className="h-3.5 w-3.5" /> Print Diary
                    </button>
                  )}
                </div>
              </div>

              {!diaryData ? (
                <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
              ) : (
                <>
                {/* Year summary */}
                {(() => {
                  const totalScholarship = diaryData.diary.reduce((s: number, d: any) => s + (d.grandTotal || d.rewardAmount || 0), 0);
                  const annualBudget = diaryData.annualScholarship || 1200;
                  const monthlyMax = diaryData.monthlyScholarship || 100;
                  const monthsWithData = diaryData.diary.filter((d: any) => d.rewardAmount > 0).length;
                  return (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-blue-900 rounded-2xl p-5 text-white text-center">
                        <p className="text-xs text-blue-300 uppercase tracking-wider">Total Earned</p>
                        <p className="text-3xl font-black mt-1">{formatCurrency(totalScholarship)}</p>
                        <p className="text-xs text-blue-400 mt-1">{Math.round((totalScholarship / annualBudget) * 100)}% of ₹{annualBudget.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Annual Budget</p>
                        <p className="text-3xl font-black mt-1 text-slate-800">{formatCurrency(annualBudget)}</p>
                        <p className="text-xs text-slate-400 mt-1">₹{monthlyMax}/month max</p>
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Avg Earned/Month</p>
                        <p className="text-3xl font-black mt-1 text-blue-700">{formatCurrency(monthsWithData > 0 ? Math.round(totalScholarship / monthsWithData) : 0)}</p>
                        <p className="text-xs text-slate-400 mt-1">{monthsWithData} months</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {diaryData.diary.map((d: any) => {
                    const isEditing = editingDiary === d.month;
                    const DISC_LABELS: Record<string, string> = { V_GOOD: 'V. Good', GOOD: 'Good', AVERAGE: 'Average', POOR: 'Poor' };
                    const DISC_COLORS: Record<string, string> = { V_GOOD: 'text-green-700 bg-green-100', GOOD: 'text-blue-700 bg-blue-100', AVERAGE: 'text-yellow-700 bg-yellow-100', POOR: 'text-red-700 bg-red-100' };

                    // Use final values (override or auto-calculated)
                    const attVal = d.attendancePct;
                    const attDisplay = d.isHoliday ? 'Holiday' : (attVal != null ? attVal + '%' : '—');
                    const attColor = d.isHoliday ? 'text-blue-600' : (attVal >= 90 ? 'text-green-600' : attVal >= 75 ? 'text-yellow-600' : attVal != null ? 'text-red-600' : 'text-slate-400');

                    const testVal = d.testMarksPct;
                    const testDisplay = testVal != null ? testVal + '%' : '0%';
                    const testColor = testVal >= 80 ? 'text-green-600' : testVal >= 50 ? 'text-yellow-600' : 'text-red-600';

                    const feeBalVal = d.feeBalancePct;
                    const feeDisplay = feeBalVal != null ? feeBalVal + '%' : '0%';
                    const feeColor = feeBalVal >= 80 ? 'text-green-600' : feeBalVal > 0 ? 'text-yellow-600' : 'text-red-600';
                    const br = d.scholarshipBreakdown;

                    return (
                      <div key={d.month} className="border-2 border-blue-800 rounded-xl overflow-hidden bg-amber-50">
                        {/* Month header */}
                        <div className="bg-blue-800 text-white text-center py-2 font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2">
                          {d.monthName}
                          {d.hasOverrides && <span className="bg-blue-600 px-1.5 py-0.5 rounded text-[10px]">edited</span>}
                        </div>
                        <div className="p-4 space-y-3">
                          {isEditing ? (
                            /* ── EDIT MODE ── */
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[11px] text-slate-500">Attendance %</label>
                                  <input type="number" placeholder={d.auto?.attendancePct != null ? `Auto: ${d.auto.attendancePct}` : 'e.g. 92'} value={diaryForm.attendancePct} onChange={e => setDiaryForm({...diaryForm, attendancePct: e.target.value})} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900" />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Test Marks %</label>
                                  <input type="number" placeholder={d.auto?.testMarksPct != null ? `Auto: ${d.auto.testMarksPct}` : 'e.g. 75'} value={diaryForm.testMarksPct} onChange={e => setDiaryForm({...diaryForm, testMarksPct: e.target.value})} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900" />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Fee Submission %</label>
                                  <input type="number" placeholder={d.auto?.feeSubmissionPct != null ? `Auto: ${d.auto.feeSubmissionPct}` : 'e.g. 100'} value={diaryForm.feeSubmissionPct} onChange={e => setDiaryForm({...diaryForm, feeSubmissionPct: e.target.value})} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900" />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Amount (₹)</label>
                                  <input type="number" placeholder={d.auto?.feeAmount ? `Auto: ${d.auto.feeAmount}` : 'e.g. 1400'} value={diaryForm.feeAmount} onChange={e => setDiaryForm({...diaryForm, feeAmount: e.target.value})} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900" />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Scholarship (₹)</label>
                                  <input type="number" placeholder={d.auto?.rewardAmount ? `Auto: ${d.auto.rewardAmount}` : 'e.g. 251'} value={diaryForm.rewardAmount} onChange={e => setDiaryForm({...diaryForm, rewardAmount: e.target.value})} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900" />
                                </div>
                              </div>
                              <select value={diaryForm.discipline} onChange={e => setDiaryForm({...diaryForm, discipline: e.target.value})} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900">
                                <option value="">Discipline</option>
                                {['V_GOOD', 'GOOD', 'AVERAGE', 'POOR'].map(v => <option key={v} value={v}>{DISC_LABELS[v]}</option>)}
                              </select>
                              <input placeholder="Comment" value={diaryForm.comment} onChange={e => setDiaryForm({...diaryForm, comment: e.target.value})} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900" />
                              <label className="flex items-center gap-2 text-sm text-slate-600">
                                <input type="checkbox" checked={diaryForm.isHoliday} onChange={e => setDiaryForm({...diaryForm, isHoliday: e.target.checked})} /> Holiday month
                              </label>
                              <div className="flex gap-2">
                                <button onClick={() => saveDiaryEntry(d.month)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Save</button>
                                <button onClick={() => setEditingDiary(null)} className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded text-xs">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            /* ── VIEW MODE ── */
                            <>
                              {/* Breakdown table */}
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-[10px] text-slate-400 uppercase">
                                    <th className="text-left font-medium pb-1">Component</th>
                                    <th className="text-center font-medium pb-1">Score</th>
                                    <th className="text-center font-medium pb-1">Max</th>
                                    <th className="text-right font-medium pb-1">Earned</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t border-amber-200">
                                    <td className="py-1 text-slate-600">Attendance <span className="text-[10px] text-slate-400">(10%)</span></td>
                                    <td className={`text-center font-bold ${attColor}`}>{attDisplay}</td>
                                    <td className="text-center text-slate-400">₹{br ? Math.round(br.monthlyMax * 0.1) : 10}</td>
                                    <td className={`text-right font-bold ${(br?.attAmount || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>₹{br?.attAmount || 0}</td>
                                  </tr>
                                  <tr className="border-t border-amber-200">
                                    <td className="py-1 text-slate-600">Test Marks <span className="text-[10px] text-slate-400">(20%)</span></td>
                                    <td className={`text-center font-bold ${testColor}`}>{testDisplay}</td>
                                    <td className="text-center text-slate-400">₹{br ? Math.round(br.monthlyMax * 0.2) : 20}</td>
                                    <td className={`text-right font-bold ${(br?.testAmount || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>₹{br?.testAmount || 0}</td>
                                  </tr>
                                  <tr className="border-t border-amber-200">
                                    <td className="py-1 text-slate-600">
                                      Fee Paid <span className="text-[10px] text-slate-400">(70%)</span>
                                      {d.balanceBeforeDeposit > 0 && (
                                        <span className="block text-[9px] text-slate-500">
                                          Paid {formatCurrency(d.depositedThisMonth || 0)} of {formatCurrency(d.balanceBeforeDeposit)}
                                        </span>
                                      )}
                                      {(d.depositedThisMonth || 0) <= 0 && d.balanceBeforeDeposit > 0 && (
                                        <span className="block text-[9px] text-red-600 font-bold">Not paid</span>
                                      )}
                                    </td>
                                    <td className={`text-center font-bold ${feeColor}`}>{feeDisplay}</td>
                                    <td className="text-center text-slate-400">₹{br ? Math.round(br.monthlyMax * 0.7) : 70}</td>
                                    <td className={`text-right font-bold ${(br?.feeAmount || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>₹{br?.feeAmount || 0}</td>
                                  </tr>
                                </tbody>
                              </table>

                              {/* Quiz bonus + Grand total */}
                              {(d.quizBonus || 0) > 0 && (
                                <div className="flex justify-between items-center bg-purple-50 -mx-4 px-4 py-1.5 mt-1">
                                  <span className="text-xs font-bold text-purple-700">Quiz Bonus</span>
                                  <span className="text-sm font-bold text-purple-700">+{formatCurrency(d.quizBonus)}</span>
                                </div>
                              )}
                              <div className="bg-blue-900 -mx-4 px-4 py-3 mt-1 flex justify-between items-center">
                                <div className="text-left">
                                  <span className="text-[10px] text-blue-300 block uppercase tracking-wider">
                                    {(d.quizBonus || 0) > 0 ? 'Grand Total' : 'Scholarship'}
                                  </span>
                                  <span className="text-2xl font-black text-white">
                                    {formatCurrency(d.grandTotal || d.rewardAmount || 0)}
                                  </span>
                                </div>
                                <div className="text-right text-[11px] text-blue-300">
                                  {(d.quizBonus || 0) > 0 && <div>Auto: ₹{d.rewardAmount || 0} + Quiz: ₹{d.quizBonus}</div>}
                                  <div>of ₹{br?.monthlyMax || 100}/month</div>
                                </div>
                              </div>

                              {d.comment && (
                                <p className="text-xs text-slate-500 border-t border-slate-200 pt-2">
                                  <strong>Comment:</strong> {d.comment}
                                </p>
                              )}

                              <button
                                onClick={() => {
                                  setEditingDiary(d.month);
                                  setDiaryForm({
                                    discipline: d.discipline || '',
                                    comment: d.comment || '',
                                    attendancePct: d.hasOverrides && d.attendancePct != null ? String(d.attendancePct) : '',
                                    testMarksPct: d.hasOverrides && d.testMarksPct != null ? String(d.testMarksPct) : '',
                                    feeSubmissionPct: d.hasOverrides && d.feeSubmissionPct != null ? String(d.feeSubmissionPct) : '',
                                    feeAmount: d.hasOverrides && d.feeAmount ? String(d.feeAmount) : '',
                                    rewardAmount: d.rewardAmount && d.hasOverrides ? String(d.rewardAmount) : '',
                                    isHoliday: d.isHoliday || false,
                                  });
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                {d.reportId ? 'Edit' : 'Update'}
                              </button>
                              <button onClick={() => handlePrintMonth(d)} className="text-xs text-slate-500 hover:text-slate-800 ml-3">
                                Print Month
                              </button>
                              <button onClick={() => handlePrintFeeMonth(d)} className="text-xs text-purple-600 hover:text-purple-800 ml-2">
                                Print Fee
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          )}

          {/* DOCUMENTS TAB */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
              {student?.documents?.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {['BIRTH_CERTIFICATE', 'AADHAAR', 'TRANSFER_CERTIFICATE', 'PHOTO', 'MEDICAL_CERTIFICATE', 'CASTE_CERTIFICATE'].map(type => (
                    <div key={type} className="border border-dashed border-slate-300 rounded-lg p-4 text-center">
                      <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-600">{type.replace(/_/g, ' ')}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">MISSING</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {student.documents.map((doc: any) => (
                    <div key={doc.id} className="border border-slate-200 rounded-lg p-4">
                      <FileText className="h-8 w-8 text-blue-400 mb-2" />
                      <p className="text-sm font-medium text-slate-900">{doc.type.replace(/_/g, ' ')}</p>
                      {doc.fileName && <p className="text-xs text-slate-400 mt-1">{doc.fileName}</p>}
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
                        doc.status === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                        doc.status === 'UNDER_REVIEW' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{doc.status.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* QR Code / ID Card Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* ID Card Preview */}
            <div id="student-id-card" className="p-6">
              <div className="border-2 border-blue-800 rounded-xl overflow-hidden">
                {/* Card Header */}
                <div className="text-center py-3 text-white" style={{ background: '#006400' }}>
                  <p className="text-sm font-bold tracking-wider">PATHAK EDUCATIONAL FOUNDATION SCHOOL</p>
                  <p className="text-[10px] opacity-80">Salarpur, Sector - 101</p>
                </div>
                {/* Card Body */}
                <div className="p-4 flex gap-4">
                  <div className="flex-1">
                    {student?.photo ? (
                      <img src={student.photo} alt="" className="w-24 h-28 object-cover rounded-lg border border-slate-200" />
                    ) : (
                      <div className="w-24 h-28 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                        {form.firstName?.[0]}{form.lastName?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-xs space-y-1.5">
                    <div><span className="text-slate-400">Name</span><p className="font-bold text-slate-900">{form.firstName} {form.lastName}</p></div>
                    <div><span className="text-slate-400">Class</span><p className="font-bold text-slate-900">{student?.class?.name} - {student?.section?.name}</p></div>
                    <div><span className="text-slate-400">Adm. No</span><p className="font-bold text-blue-700">{student?.admissionNo}</p></div>
                    <div><span className="text-slate-400">Father</span><p className="font-bold text-slate-900">{form.fatherName || '—'}</p></div>
                  </div>
                </div>
                {/* QR Code */}
                <div className="flex items-center justify-center pb-4">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <QRCode value={`STU:${id}`} size={100} />
                  </div>
                </div>
                {/* Card Footer */}
                <div className="text-center py-2 bg-slate-100 text-[10px] text-slate-500">
                  Session {getCurrentAcademicYear()} | Scan for attendance
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-6 pb-6">
              <button onClick={() => {
                const el = document.getElementById('student-id-card');
                if (!el) return;
                const w = window.open('', '_blank');
                if (!w) return;
                w.document.write(`<html><head><title>ID Card - ${form.firstName} ${form.lastName}</title>
                  <style>body{margin:20px;font-family:Arial,sans-serif}@media print{body{margin:10px}}</style>
                </head><body>${el.innerHTML}</body></html>`);
                w.document.close();
                w.print();
              }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                <Printer className="h-4 w-4" /> Print ID Card
              </button>
              <button onClick={() => setShowQR(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── Reusable Field Components ─────────────────────────────

function Field({ label, value, onChange, type = 'text', placeholder, disabled }: {
  label: string; value: string; onChange?: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 ${disabled ? 'bg-slate-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500'} outline-none`}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
      >
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
