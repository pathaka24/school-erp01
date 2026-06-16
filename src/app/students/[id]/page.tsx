'use client';

import { Fragment, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useFeedback } from '@/components/ui/feedback';
import { formatDate, formatCurrency, getAcademicYears, getCurrentAcademicYear, compressImage } from '@/lib/utils';
import PhotoCropper from '@/components/PhotoCropper';
import { ArrowLeft, Save, User, Heart, MapPin, GraduationCap, School, History, Clock, Syringe, FileText, IndianRupee, Printer, BookOpen, CalendarCheck, Award, Camera, X, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';

const TABS = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'idcard', label: 'ID Card', icon: QrCode },
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
  const authUser = useAuthStore(s => s.user);
  const actorName = authUser ? `${authUser.firstName} ${authUser.lastName}`.trim() : undefined;
  const { toast, confirm: confirmDialog } = useFeedback();
  const [student, setStudent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('personal');

  // Allow deep links like /students/<id>?tab=fees (used by the Dues report's
  // Collect button). Mount effect, not initializer — runs after client-side
  // navigation has settled the URL.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && TABS.some(x => x.id === t)) setActiveTab(t);
  }, []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerFamily, setLedgerFamily] = useState(false);
  const [ledgerView, setLedgerView] = useState<'all' | 'purchases' | 'entries' | 'summary'>('all');
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [entrySaving, setEntrySaving] = useState(false);
  const [showVoided, setShowVoided] = useState(false);
  const [chargeSaving, setChargeSaving] = useState(false);
  const [depositSaving, setDepositSaving] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);     // loading the ledger
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null); // per-row void/restore/delete in progress
  const [bulkVoiding, setBulkVoiding] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  // Inline amount correction (click the number to fix it)
  const [inlineAmount, setInlineAmount] = useState<{ id: string; value: string } | null>(null);
  const [inlineAmountSaving, setInlineAmountSaving] = useState(false);
  const [depositForm, setDepositForm] = useState({ amount: '', paymentMethod: 'CASH', receivedBy: '', month: '' });
  const [chargeForm, setChargeForm] = useState({ category: 'MONTHLY_FEE', description: '', amount: '', month: '' });
  // Family view: per-child charge amounts (studentId -> amount string)
  const [chargePerStudent, setChargePerStudent] = useState<Record<string, string>>({});
  // Siblings (Parent Info tab)
  const [siblingsInfo, setSiblingsInfo] = useState<{ familyName: string | null; siblings: any[] } | null>(null);
  const [sibSearch, setSibSearch] = useState('');
  const [sibResults, setSibResults] = useState<any[]>([]);
  const [sibSearching, setSibSearching] = useState(false);
  const [sibBusy, setSibBusy] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showChargeForm, setShowChargeForm] = useState(false);
  // Inline per-month deposit inside the ledger table
  const [inlineDeposit, setInlineDeposit] = useState<{ month: string; amount: string; paymentMethod: string; receivedBy: string } | null>(null);
  const [inlineDepositSaving, setInlineDepositSaving] = useState(false);
  const [showOpeningBalance, setShowOpeningBalance] = useState(false);
  const [openingForm, setOpeningForm] = useState({ amount: '', paidAmount: '', paymentMethod: 'CASH', year: '2024-2025', month: '' });
  // Buy Class Kit form
  const [showKitForm, setShowKitForm] = useState(false);
  const [kitItems, setKitItems] = useState<{ selected: boolean; category: string; description: string; amount: string }[]>([]);
  const [kitDeposit, setKitDeposit] = useState({ amount: '', paymentMethod: 'CASH', receivedBy: '' });
  const [kitDiscount, setKitDiscount] = useState({ amount: '', reason: '' });
  // Combined "kit + fees" bill — include this month's fee in the same transaction
  const [kitMonthlyFee, setKitMonthlyFee] = useState(0);
  const [kitMonthlyCharged, setKitMonthlyCharged] = useState(false);
  const [kitIncludeFee, setKitIncludeFee] = useState(false);
  const [kitLoading, setKitLoading] = useState(false);
  const [kitSubmitting, setKitSubmitting] = useState(false);
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
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [idTemplate, setIdTemplate] = useState<any>(null);
  const [idCardHtml, setIdCardHtml] = useState<string>('');
  const [schoolLogo, setSchoolLogo] = useState<string>('');

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
      .catch(() => toast('error', 'Student not found'))
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
      toast('success', 'Saved successfully');
    } catch (error: any) {
      toast('error', error.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // File picker → opens cropper (instead of uploading raw file).
  // Cropper produces the final framed photo, then we compress + upload.
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingPhoto(file);
    e.target.value = '';
  };

  const handleCroppedPhoto = async (cropped: File) => {
    setPendingPhoto(null);
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(cropped, { targetKB: 40, maxDim: 500 });
      const formData = new FormData();
      formData.append('photo', compressed);
      const { data } = await api.post(`/students/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStudent((prev: any) => ({ ...prev, photo: data.photo }));
    } catch (err: any) {
      toast('error', err.response?.data?.error || err.message || 'Upload failed');
    }
    setUploadingPhoto(false);
  };

  const removePhoto = async () => {
    try {
      await api.delete(`/students/${id}/photo`);
      setStudent((prev: any) => ({ ...prev, photo: null }));
    } catch {}
  };

  const loadLedger = async () => {
    setLedgerLoading(true);
    try {
      const r = await api.get(`/fees/ledger/${id}?family=${ledgerFamily}&includeVoided=${showVoided}`);
      setLedgerData(r.data);
      // Auto-enable family view if student has siblings
      if (r.data.siblings?.length > 1 && !ledgerFamily) {
        setLedgerFamily(true);
      }
    } catch { setLedgerData(null); }
    finally { setLedgerLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'fees') loadLedger();
  }, [activeTab, ledgerFamily, showVoided]);

  // Load default Student ID template + school logo
  useEffect(() => {
    api.get('/print-templates', { params: { type: 'STUDENT_ID' } })
      .then(r => {
        const list = r.data || [];
        const def = list.find((t: any) => t.isDefault) || list[0] || null;
        setIdTemplate(def);
      })
      .catch(() => setIdTemplate(null));
    api.get('/settings/general').then(r => setSchoolLogo(r.data?.schoolLogo || '')).catch(() => {});
  }, []);

  // Build the preview HTML when modal opens, ID tab is active, or student/template changes
  useEffect(() => {
    if (!student) return;
    if (!showQR && activeTab !== 'idcard') return;
    (async () => {
      const { buildIdCardSheetHtml } = await import('@/lib/idCardHtml');
      const html = await buildIdCardSheetHtml([student], idTemplate, true, schoolLogo);
      setIdCardHtml(html);
    })();
  }, [showQR, activeTab, student, idTemplate, schoolLogo]);

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
    if (depositSaving) return; // guard against double-submit
    const studentIds = ledgerFamily && ledgerData?.siblings?.length
      ? ledgerData.siblings.map((s: any) => s.id)
      : [id];
    setDepositSaving(true);
    try {
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
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to record deposit');
    } finally {
      setDepositSaving(false);
    }
  };

  const handleCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chargeSaving) return; // guard against double-submit
    const isFamily = ledgerFamily && (ledgerData?.siblings?.length || 0) > 1;
    setChargeSaving(true);
    try {
      const payload: any = {
        month: chargeForm.month || currentMonth(),
        category: chargeForm.category,
        description: chargeForm.description || chargeForm.category.replace(/_/g, ' '),
      };
      if (isFamily) {
        // Per-child amounts (Saurya ₹700, Somya ₹650…)
        const perStudentAmounts: Record<string, number> = {};
        let rep = 0;
        for (const sib of ledgerData.siblings) {
          const v = parseFloat(chargePerStudent[sib.id]) || 0;
          if (v > 0) { perStudentAmounts[sib.id] = v; rep = Math.max(rep, v); }
        }
        if (rep <= 0) { toast('error', 'Enter an amount for at least one child'); setChargeSaving(false); return; }
        payload.studentIds = ledgerData.siblings.map((s: any) => s.id);
        payload.amount = rep; // representative (per-student map overrides)
        payload.perStudentAmounts = perStudentAmounts;
      } else {
        payload.studentIds = [id];
        payload.amount = parseFloat(chargeForm.amount);
      }
      await api.post('/fees/ledger/charge', payload);
      setChargeForm({ category: 'MONTHLY_FEE', description: '', amount: '', month: '' });
      setChargePerStudent({});
      setShowChargeForm(false);
      loadLedger();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to add charge');
    } finally {
      setChargeSaving(false);
    }
  };

  const openInlineDeposit = (row: any) => {
    const monthDue = Math.max(0, (row.monthlyFee || 0) + (row.otherCharges || 0) - (row.deposited || 0));
    setInlineDeposit({
      month: row.month,
      amount: monthDue > 0 ? String(monthDue) : '',
      paymentMethod: 'CASH',
      receivedBy: actorName || '',
    });
  };

  const saveInlineDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineDeposit) return;
    setInlineDepositSaving(true);
    try {
      await api.post('/fees/ledger/deposit', {
        studentIds: [id],
        month: inlineDeposit.month,
        amount: parseFloat(inlineDeposit.amount),
        paymentMethod: inlineDeposit.paymentMethod,
        receivedBy: inlineDeposit.receivedBy || undefined,
      });
      const label = new Date(inlineDeposit.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      toast('success', `Deposit recorded for ${label}`);
      setInlineDeposit(null);
      loadLedger();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to record deposit');
    } finally {
      setInlineDepositSaving(false);
    }
  };

  const loadSiblings = async () => {
    try {
      const { data } = await api.get(`/students/${id}/siblings`);
      setSiblingsInfo({ familyName: data.familyName, siblings: data.siblings || [] });
    } catch { setSiblingsInfo({ familyName: null, siblings: [] }); }
  };

  const searchSiblingStudents = async () => {
    if (!sibSearch.trim()) return;
    setSibSearching(true);
    try {
      const { data } = await api.get('/students', { params: { search: sibSearch.trim() } });
      // exclude self and current siblings
      const existing = new Set([id, ...(siblingsInfo?.siblings || []).map((s: any) => s.id)]);
      setSibResults((data || []).filter((s: any) => !existing.has(s.id)).slice(0, 6));
    } catch { setSibResults([]); }
    finally { setSibSearching(false); }
  };

  const connectSibling = async (siblingId: string, name: string) => {
    setSibBusy(true);
    try {
      await api.post(`/students/${id}/link-sibling`, { siblingId });
      toast('success', `${name} connected as sibling`);
      setSibSearch(''); setSibResults([]);
      loadSiblings();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to connect sibling');
    } finally {
      setSibBusy(false);
    }
  };

  const removeSibling = async (sibling: any) => {
    const res = await confirmDialog({
      title: `Remove ${sibling.name} as a sibling?`,
      message: 'They will be disconnected from this family. No student records are deleted. You can reconnect them later.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!res.confirmed) return;
    setSibBusy(true);
    try {
      await api.delete(`/students/${id}/link-sibling`, { params: { siblingId: sibling.id } });
      toast('success', `${sibling.name} removed from family`);
      loadSiblings();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to remove sibling');
    } finally {
      setSibBusy(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'parent') loadSiblings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const toggleFeeExempt = async (checked: boolean) => {
    try {
      await api.put(`/students/${id}`, { feeExempt: checked });
      setStudent((prev: any) => ({ ...prev, feeExempt: checked }));
      toast('success', checked
        ? 'Monthly fee generation disabled for this student'
        : 'Monthly fee generation re-enabled');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to update');
    }
  };

  const handleEntrySave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setEntrySaving(true);
    try {
      await api.patch(`/fees/ledger/entry/${editingEntry.id}`, {
        type: editingEntry.type,
        category: editingEntry.category,
        description: editingEntry.description,
        amount: parseFloat(editingEntry.amount),
        month: editingEntry.month,
        paymentMethod: editingEntry.paymentMethod,
        receivedBy: editingEntry.receivedBy,
        receiptNumber: editingEntry.receiptNumber,
        _actor: actorName,
        reason: editingEntry._reason,
      });
      setEditingEntry(null);
      toast('success', 'Entry updated');
      loadLedger();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to update entry');
    } finally {
      setEntrySaving(false);
    }
  };

  const handleEntryDelete = async (entry: any) => {
    const res = await confirmDialog({
      title: `Void this ${entry.type.toLowerCase()} of ${formatCurrency(entry.amount)}?`,
      message: 'The row will be hidden from the ledger but kept for audit. It can be restored later.',
      confirmLabel: 'Void entry',
      danger: true,
      input: { label: 'Reason', placeholder: 'e.g. Duplicate entry, wrong student…', required: true },
    });
    if (!res.confirmed) return;
    setBusyEntryId(entry.id);
    try {
      await api.delete(`/fees/ledger/entry/${entry.id}`, { params: { reason: res.value || 'No reason given', actor: actorName } });
      toast('success', 'Entry voided');
      await loadLedger();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to void entry');
    } finally {
      setBusyEntryId(null);
    }
  };

  // Void every previous-record entry (PREVIOUS_BALANCE charges + their
  // backdated deposits) in one go, with a single reason
  const removeAllPreviousRecords = async (records: any[]) => {
    const res = await confirmDialog({
      title: `Remove all ${records.length} previous-record entries?`,
      message: 'Each entry is voided — recoverable later via All Entries → Show voided. Balances recalculate immediately.',
      confirmLabel: 'Remove all',
      danger: true,
      input: { label: 'Reason', placeholder: 'e.g. Wrong amounts, re-entering previous record…', required: true },
    });
    if (!res.confirmed) return;
    try {
      for (const e of records) {
        await api.delete(`/fees/ledger/entry/${e.id}`, { params: { reason: res.value, actor: actorName } });
      }
      toast('success', `${records.length} previous-record entries removed`);
      loadLedger();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to remove previous records');
      loadLedger();
    }
  };

  const handleEntryHardDelete = async (entry: any) => {
    const res = await confirmDialog({
      title: `Permanently delete this ${entry.type.toLowerCase()} of ${formatCurrency(entry.amount)}?`,
      message: 'This cannot be undone. The row is removed from the database entirely — only the audit log keeps a snapshot of it.',
      confirmLabel: 'Delete forever',
      danger: true,
      input: { label: 'Reason', placeholder: 'e.g. Test data, entered on wrong student…', required: true },
    });
    if (!res.confirmed) return;
    setBusyEntryId(entry.id);
    try {
      await api.delete(`/fees/ledger/entry/${entry.id}`, { params: { hard: 'true', reason: res.value, actor: actorName } });
      toast('success', 'Entry permanently deleted');
      await loadLedger();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to delete entry');
    } finally {
      setBusyEntryId(null);
    }
  };

  // Can this entry be voided right now? (not already voided, not in a locked month)
  const isEntryVoidable = (e: any) =>
    !e.voidedAt && !(ledgerData?.feeLockMonth && e.month <= ledgerData.feeLockMonth);

  // Quick inline amount fix — auto-records a descriptive reason for the audit log
  const saveInlineAmount = async (entry: any) => {
    if (!inlineAmount) return;
    const newAmt = parseFloat(inlineAmount.value);
    if (isNaN(newAmt) || newAmt < 0) { toast('error', 'Enter a valid amount'); return; }
    if (Math.abs(newAmt - entry.amount) < 0.005) { setInlineAmount(null); return; }
    setInlineAmountSaving(true);
    try {
      await api.patch(`/fees/ledger/entry/${entry.id}`, {
        amount: newAmt,
        reason: `Amount corrected: ${formatCurrency(entry.amount)} → ${formatCurrency(newAmt)}`,
        _actor: actorName,
      });
      toast('success', `Amount changed to ${formatCurrency(newAmt)}`);
      setInlineAmount(null);
      loadLedger();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to update amount');
    } finally {
      setInlineAmountSaving(false);
    }
  };

  const toggleEntrySelect = (id: string) => {
    setSelectedEntries(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleBulkVoid = async () => {
    const entries = (ledgerData?.entries || []).filter((e: any) => selectedEntries.has(e.id) && isEntryVoidable(e));
    if (entries.length === 0) return;
    const total = entries.reduce((s: number, e: any) => s + e.amount, 0);
    const res = await confirmDialog({
      title: `Void ${entries.length} selected ${entries.length === 1 ? 'entry' : 'entries'}?`,
      message: `Total ${formatCurrency(total)}. Each is voided (hidden but kept for audit, restorable later). Balances recalculate.`,
      confirmLabel: 'Void selected',
      danger: true,
      input: { label: 'Reason (applied to all)', placeholder: 'e.g. Duplicate entries, correcting…', required: true },
    });
    if (!res.confirmed) return;
    setBulkVoiding(true);
    try {
      for (const e of entries) {
        await api.delete(`/fees/ledger/entry/${e.id}`, { params: { reason: res.value, actor: actorName } });
      }
      toast('success', `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} voided`);
      setSelectedEntries(new Set());
      await loadLedger();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to void some entries');
      await loadLedger();
    } finally {
      setBulkVoiding(false);
    }
  };

  const handleEntryRestore = async (entry: any) => {
    const res = await confirmDialog({
      title: `Restore this voided ${entry.type.toLowerCase()} of ${formatCurrency(entry.amount)}?`,
      message: 'The entry will reappear in the ledger and balances will be recalculated.',
      confirmLabel: 'Restore',
    });
    if (!res.confirmed) return;
    setBusyEntryId(entry.id);
    try {
      await api.post(`/fees/ledger/entry/${entry.id}`, { actor: actorName });
      toast('success', 'Entry restored');
      await loadLedger();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to restore entry');
    } finally {
      setBusyEntryId(null);
    }
  };

  // Open a printable per-deposit receipt
  const printDepositReceipt = async (entryId: string) => {
    let data: any;
    try {
      const res = await api.get(`/fees/ledger/entry/${entryId}/receipt`);
      data = res.data;
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to load receipt');
      return;
    }
    const monthLabel = new Date(data.deposit.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const allocationRows = (data.allocation || []).map((a: any) =>
      `<tr>
        <td style="padding:6px 12px;font-size:12px;border:1px solid #cbd5e1">${new Date(a.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
        <td style="padding:6px 12px;font-size:12px;border:1px solid #cbd5e1">${a.description}</td>
        <td style="padding:6px 12px;font-size:12px;border:1px solid #cbd5e1;text-align:right;font-weight:600">${fmt(a.amountPaid)}</td>
      </tr>`
    ).join('');
    const totalAllocated = (data.allocation || []).reduce((s: number, a: any) => s + a.amountPaid, 0);
    const advanceAmount = data.deposit.amount - totalAllocated;

    const html = `<!DOCTYPE html><html><head><title>Fee Receipt — ${data.deposit.receiptNumber || data.deposit.id.slice(0, 8)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;margin:20px;color:#1e293b;font-size:13px}
  .header{text-align:center;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:16px}
  .school{font-size:20px;font-weight:bold;color:#1e40af}
  .receipt-no{display:inline-block;background:#1e40af;color:white;padding:4px 20px;border-radius:4px;font-size:14px;font-weight:bold;margin:8px 0}
  .month-pill{display:inline-block;background:#16a34a;color:white;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:bold;margin-left:8px}
  h3{color:#1e40af;font-size:13px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:1px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}
  .field .label{font-size:10px;color:#64748b;text-transform:uppercase}
  .field .value{font-size:13px;font-weight:600}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  th{background:#1e40af;color:white;padding:6px 12px;font-size:11px;text-align:left;text-transform:uppercase}
  .total-row td{background:#dcfce7;font-weight:bold;font-size:14px}
  .balance-box{border:3px solid;border-radius:8px;padding:12px;text-align:center;margin:12px 0;font-size:16px;font-weight:bold}
  .sig-row{display:flex;justify-content:space-between;margin-top:40px}
  .sig-line{border-top:1px solid #000;width:180px;text-align:center;padding-top:4px;font-size:11px}
  @media print{body{margin:10px}}
</style></head><body>
  <div class="header">
    <div class="school">${data.schoolName}</div>
    <div style="font-size:14px;font-weight:bold;color:#1e293b;margin-top:6px">FEE RECEIPT <span class="month-pill">${monthLabel}</span></div>
    <div class="receipt-no">${data.deposit.receiptNumber || 'RCP-' + data.deposit.id.slice(0, 8).toUpperCase()}</div>
    <div style="font-size:11px;color:#666">Date: ${new Date(data.deposit.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  </div>

  <h3>Student</h3>
  <div class="grid">
    <div class="field"><div class="label">Name</div><div class="value">${data.student.name}</div></div>
    <div class="field"><div class="label">Admission No</div><div class="value">${data.student.admissionNo}</div></div>
    <div class="field"><div class="label">Class</div><div class="value">${data.student.class || '—'}${data.student.section ? ' · ' + data.student.section : ''}</div></div>
    <div class="field"><div class="label">Month</div><div class="value">${monthLabel}</div></div>
  </div>

  <h3>Payment</h3>
  <div class="grid">
    <div class="field"><div class="label">Amount Paid</div><div class="value" style="color:#16a34a;font-size:16px">${fmt(data.deposit.amount)}</div></div>
    <div class="field"><div class="label">Method</div><div class="value">${data.deposit.paymentMethod || 'CASH'}</div></div>
    ${data.deposit.receivedBy ? `<div class="field"><div class="label">Received By</div><div class="value">${data.deposit.receivedBy}</div></div>` : ''}
    <div class="field"><div class="label">Balance Before</div><div class="value">${fmt(data.balanceBeforeDeposit)}</div></div>
  </div>

  ${allocationRows ? `
    <h3>Applied To Charges (FIFO)</h3>
    <table>
      <thead><tr><th>Month</th><th>Description</th><th style="text-align:right;width:25%">Paid</th></tr></thead>
      <tbody>
        ${allocationRows}
        ${advanceAmount > 0.01 ? `<tr><td style="padding:6px 12px;font-size:12px;border:1px solid #cbd5e1;font-style:italic;color:#92400e" colspan="2">Advance (carried forward)</td><td style="padding:6px 12px;font-size:12px;border:1px solid #cbd5e1;text-align:right;font-weight:600;color:#92400e">${fmt(advanceAmount)}</td></tr>` : ''}
        <tr class="total-row">
          <td style="padding:8px 12px;border:1px solid #cbd5e1;font-size:14px" colspan="2">Total Paid</td>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;text-align:right;font-size:14px">${fmt(data.deposit.amount)}</td>
        </tr>
      </tbody>
    </table>
  ` : `<p style="font-style:italic;color:#92400e;margin-top:8px">This deposit has been carried forward as advance — no outstanding charges at the time of payment.</p>`}

  <div class="balance-box" style="border-color:${data.currentBalance > 0 ? '#dc2626' : '#16a34a'};color:${data.currentBalance > 0 ? '#dc2626' : '#16a34a'}">
    Current Balance: ${fmt(data.currentBalance)} ${data.currentBalance > 0 ? 'DUE' : 'CLEARED'}
  </div>

  <div class="sig-row">
    <div class="sig-line">Parent's Signature</div>
    <div class="sig-line">Accountant</div>
  </div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const handleOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chargeSaving) return; // guard against double-submit
    const month = openingForm.month || (openingForm.year.split('-')[0] + '-04'); // default to April of first year
    const charged = parseFloat(openingForm.amount) || 0;
    const paid = parseFloat(openingForm.paidAmount) || 0;
    setChargeSaving(true);
    try {
      if (charged > 0) {
        await api.post('/fees/ledger/charge', {
          studentIds: [id],
          month,
          category: 'PREVIOUS_BALANCE',
          description: `Previous balance (${openingForm.year})`,
          amount: charged,
        });
      }
      // Previous payments already made — backdated deposit in the same month
      if (paid > 0) {
        await api.post('/fees/ledger/deposit', {
          studentIds: [id],
          month,
          amount: paid,
          paymentMethod: openingForm.paymentMethod,
          receivedBy: actorName || undefined,
          entryDate: month + '-01T00:00:00Z',
        });
      }
      toast('success', `Previous record saved — ${formatCurrency(charged)} charged, ${formatCurrency(paid)} paid, net ${formatCurrency(Math.max(0, charged - paid))} carried forward`);
      setOpeningForm({ amount: '', paidAmount: '', paymentMethod: 'CASH', year: '2024-2025', month: '' });
      setShowOpeningBalance(false);
      loadLedger();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to save previous record');
    } finally {
      setChargeSaving(false);
    }
  };

  // ─── Buy Class Kit ───
  const openKitForm = async () => {
    setShowDepositForm(false); setShowChargeForm(false); setShowOpeningBalance(false);
    setShowKitForm(true);
    setKitLoading(true);
    try {
      const { data } = await api.get('/settings/fee-plan');
      const classId = student?.class?.id || student?.classId;
      const classPlan = data?.classes?.find((c: any) => c.classId === classId);
      // Monthly fee for "kit + fees together" — offer it only if not already
      // charged this month
      const mFee = Number(classPlan?.monthlyFee) || 0;
      const alreadyCharged = (ledgerData?.entries || []).some(
        (e: any) => !e.voidedAt && e.type === 'CHARGE' && e.category === 'MONTHLY_FEE' && e.month === currentMonth()
      );
      setKitMonthlyFee(mFee);
      setKitMonthlyCharged(alreadyCharged);
      setKitIncludeFee(false);
      const charges = (classPlan?.charges || []).map((c: any) => ({
        selected: parseFloat(c.amount) > 0,
        category: c.category || 'AD_HOC',
        description: c.description || String(c.category || 'Item').replace(/_/g, ' '),
        amount: c.amount > 0 ? String(c.amount) : '',
      }));
      setKitItems(charges.length > 0 ? charges : [
        { selected: true, category: 'BOOK', description: 'Books', amount: '' },
        { selected: true, category: 'COPY', description: 'Notebooks', amount: '' },
        { selected: true, category: 'DRESS', description: 'Dress', amount: '' },
        { selected: false, category: 'TIE_BELT', description: 'Tie / Belt', amount: '' },
        { selected: false, category: 'DAIRY', description: 'Diary', amount: '' },
      ]);
    } catch {
      setKitItems([
        { selected: true, category: 'BOOK', description: 'Books', amount: '' },
        { selected: true, category: 'COPY', description: 'Notebooks', amount: '' },
        { selected: true, category: 'DRESS', description: 'Dress', amount: '' },
      ]);
    } finally {
      setKitLoading(false);
    }
  };

  const kitSelectedTotal = kitItems
    .filter(k => k.selected)
    .reduce((s, k) => s + (parseFloat(k.amount) || 0), 0);

  const kitDiscountAmount = Math.min(parseFloat(kitDiscount.amount) || 0, kitSelectedTotal);
  const kitNetTotal = kitSelectedTotal - kitDiscountAmount;

  // Combined bill: kit (net) + this month's fee (if included) = new charges.
  // Previous dues are already on the ledger; total payable includes them.
  const kitFeeAmount = kitIncludeFee && !kitMonthlyCharged ? kitMonthlyFee : 0;
  const kitNewCharges = kitNetTotal + kitFeeAmount;
  const kitPrevDues = (ledgerData?.currentBalance || 0) > 0 ? ledgerData.currentBalance : 0;
  const kitTotalPayable = kitNewCharges + kitPrevDues;
  const kitPaidNow = parseFloat(kitDeposit.amount) || 0;
  const kitBalanceAfter = kitTotalPayable - kitPaidNow;

  const handleKitSubmit = async () => {
    const picked = kitItems.filter(k => k.selected && (parseFloat(k.amount) || 0) > 0);
    if (picked.length === 0) { toast('error', 'Select at least one item with an amount'); return; }
    setKitSubmitting(true);
    try {
      const items = picked.map(k => ({ category: k.category, description: k.description, amount: parseFloat(k.amount) }));
      // Add this month's fee as a charge in the same transaction (kit + fees)
      if (kitFeeAmount > 0) {
        const label = new Date(currentMonth() + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        items.push({ category: 'MONTHLY_FEE', description: `Monthly Fee - ${label}`, amount: kitFeeAmount });
      }
      const payload: any = { items };
      const discAmt = parseFloat(kitDiscount.amount) || 0;
      if (discAmt > 0) {
        payload.discount = { amount: discAmt, reason: kitDiscount.reason || null };
      }
      const depositAmt = parseFloat(kitDeposit.amount) || 0;
      if (depositAmt > 0) {
        payload.deposit = { amount: depositAmt, paymentMethod: kitDeposit.paymentMethod, receivedBy: kitDeposit.receivedBy || null };
      }
      const { data } = await api.post(`/fees/ledger/kit-purchase/${id}`, payload);
      // Receipt lists everything billed in this transaction, incl. the fee line
      printKitReceipt(data, items.map(it => ({ category: it.category, description: it.description, amount: String(it.amount) })));
      setShowKitForm(false);
      setKitItems([]);
      setKitDeposit({ amount: '', paymentMethod: 'CASH', receivedBy: '' });
      setKitDiscount({ amount: '', reason: '' });
      setKitIncludeFee(false);
      toast('success', 'Bill saved' + (kitPaidNow > 0 ? ` — ₹${kitPaidNow.toLocaleString('en-IN')} collected` : ''));
      loadLedger();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Kit purchase failed');
    } finally {
      setKitSubmitting(false);
    }
  };

  const printKitReceipt = (data: any, items: { category: string; description: string; amount: string }[]) => {
    const rows = items.map(it =>
      `<tr><td style="padding:6px 12px;font-size:13px;border:1px solid #cbd5e1">${it.description}</td><td style="padding:6px 12px;font-size:13px;border:1px solid #cbd5e1;text-align:right;font-weight:600">₹${parseFloat(it.amount).toLocaleString('en-IN')}</td></tr>`
    ).join('');
    const paid = data.totalPaid || 0;
    const balance = data.balanceAfter || 0;
    const disc = data.discountAmount || 0;
    const netCharged = data.netCharged != null ? data.netCharged : (data.totalCharged || 0) - disc;
    // No payment → this is a bill/invoice, not a receipt
    const docTitle = paid > 0 ? 'KIT PURCHASE RECEIPT' : 'BILL / INVOICE — UNPAID';
    const html = `<!DOCTYPE html><html><head><title>Kit Purchase - ${data.receiptNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; margin:20px; color:#1e293b; font-size:13px; }
  .header { text-align:center; border-bottom:3px solid #006400; padding-bottom:12px; margin-bottom:16px; }
  .school { font-size:20px; font-weight:bold; color:#006400; }
  .rcp { display:inline-block; background:#1e40af; color:white; padding:4px 20px; border-radius:4px; font-size:14px; font-weight:bold; margin:8px 0; font-family:monospace; }
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
    <div style="font-size:14px;font-weight:bold;color:#1e293b;margin-top:6px">${docTitle}</div>
    <div class="rcp">${data.receiptNumber}</div>
    <div style="font-size:11px;color:#666">Date: ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</div>
  </div>
  <h3>Student Details</h3>
  <div class="grid">
    <div class="field"><div class="label">Name</div><div class="value">${data.student.name}</div></div>
    <div class="field"><div class="label">Admission No</div><div class="value">${data.student.admissionNo}</div></div>
    <div class="field"><div class="label">Class</div><div class="value">${data.student.className || '—'} — ${data.student.sectionName || ''}</div></div>
  </div>
  <h3>Items Purchased</h3>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right;width:30%">Amount</th></tr></thead>
    <tbody>
      ${rows}
      <tr>
        <td style="padding:6px 12px;font-size:13px;border:1px solid #cbd5e1">Subtotal</td>
        <td style="padding:6px 12px;font-size:13px;border:1px solid #cbd5e1;text-align:right;font-weight:600">₹${(data.totalCharged || 0).toLocaleString('en-IN')}</td>
      </tr>
      ${disc > 0 ? `<tr>
        <td style="padding:6px 12px;border:1px solid #cbd5e1;color:#7c3aed;font-weight:600">Discount${data.discount?.description?.includes('—') ? ' — ' + data.discount.description.split('—')[1].trim() : ''}</td>
        <td style="padding:6px 12px;border:1px solid #cbd5e1;text-align:right;color:#7c3aed;font-weight:bold;font-size:14px">- ₹${disc.toLocaleString('en-IN')}</td>
      </tr>` : ''}
      <tr class="total-row">
        <td style="padding:8px 12px;border:1px solid #cbd5e1;font-size:14px">Net Total</td>
        <td style="padding:8px 12px;border:1px solid #cbd5e1;text-align:right;font-size:14px">₹${netCharged.toLocaleString('en-IN')}</td>
      </tr>
      ${paid > 0 ? `<tr>
        <td style="padding:6px 12px;border:1px solid #cbd5e1;color:#16a34a;font-weight:600">Paid (${kitDeposit.paymentMethod})</td>
        <td style="padding:6px 12px;border:1px solid #cbd5e1;text-align:right;color:#16a34a;font-weight:bold;font-size:14px">- ₹${paid.toLocaleString('en-IN')}</td>
      </tr>` : ''}
    </tbody>
  </table>
  <div class="balance-box" style="border-color:${balance > 0 ? '#dc2626' : '#16a34a'}; color:${balance > 0 ? '#dc2626' : '#16a34a'}">
    ${balance > 0 ? 'Balance Due' : 'Paid in Full'}: ₹${Math.abs(balance).toLocaleString('en-IN')}
  </div>
  <div class="sig-row">
    <div class="sig-line">Parent's Signature</div>
    <div class="sig-line">Accountant</div>
    <div class="sig-line">Principal</div>
  </div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const printExpenseSummary = (rows: { label: string; charged: number; paid: number; due: number }[], tot: { charged: number; paid: number; due: number }) => {
    if (!ledgerData) return;
    const s = ledgerData.student;
    const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
    const body = rows.map(r => `<tr>
      <td style="padding:7px 12px;border:1px solid #cbd5e1">${r.label}</td>
      <td style="padding:7px 12px;border:1px solid #cbd5e1;text-align:right">${fmt(r.charged)}</td>
      <td style="padding:7px 12px;border:1px solid #cbd5e1;text-align:right;color:#16a34a">${fmt(r.paid)}</td>
      <td style="padding:7px 12px;border:1px solid #cbd5e1;text-align:right;font-weight:600;color:${r.due > 0 ? '#dc2626' : '#64748b'}">${r.due > 0 ? fmt(r.due) : '—'}</td>
    </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Expense Statement — ${s?.name || ''}</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#1e293b}h1{font-size:18px;color:#1e40af;margin:0}
.sub{font-size:12px;color:#64748b;margin:2px 0 16px}table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#1e40af;color:#fff;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase}
.tot td{background:#dcfce7;font-weight:bold;font-size:14px;padding:9px 12px;border:1px solid #cbd5e1}</style></head>
<body>
  <h1>Fee Expense Statement</h1>
  <div class="sub">${s?.name || ''} · ${s?.class || ''}${s?.section ? ' - ' + s.section : ''} · Adm. No. ${s?.admissionNo || ''} · Printed ${new Date().toLocaleDateString('en-IN')}</div>
  <table>
    <thead><tr><th>Category</th><th style="text-align:right">Charged</th><th style="text-align:right">Paid</th><th style="text-align:right">Due</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr class="tot">
      <td>TOTAL</td>
      <td style="text-align:right">${fmt(tot.charged)}</td>
      <td style="text-align:right;color:#15803d">${fmt(tot.paid)}</td>
      <td style="text-align:right;color:${tot.due > 0 ? '#dc2626' : '#15803d'}">${tot.due > 0 ? fmt(tot.due) : 'ALL PAID'}</td>
    </tr></tfoot>
  </table>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  // Printable / savable record of everything a student has bought, grouped by
  // purchase. The browser print dialog's "Save as PDF" keeps a copy.
  const printPurchaseHistory = (txns: { date: string; items: any[]; discount: number; paid: number; dep: any; net: number }[]) => {
    if (!ledgerData) return;
    const s = ledgerData.student;
    const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
    const fmtDT = (d: string) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    let gNet = 0, gPaid = 0;
    const blocks = txns.map(tx => {
      gNet += tx.net; gPaid += tx.paid;
      const rows = tx.items.map(it => `<tr>
        <td style="padding:5px 10px;border:1px solid #e2e8f0">${(it.category || '').replace(/_/g, ' ')}</td>
        <td style="padding:5px 10px;border:1px solid #e2e8f0">${it.description}</td>
        <td style="padding:5px 10px;border:1px solid #e2e8f0;text-align:right">${fmt(it.amount)}</td>
      </tr>`).join('');
      const due = tx.net - tx.paid;
      return `<div class="tx">
        <div class="txh">${fmtDT(tx.date)}${tx.dep?.receiptNumber ? ' &nbsp;·&nbsp; ' + tx.dep.receiptNumber : ''}</div>
        <table>${rows}</table>
        <div class="txf">${tx.discount > 0 ? 'Discount −' + fmt(tx.discount) + ' &nbsp;·&nbsp; ' : ''}Total <b>${fmt(tx.net)}</b> &nbsp;·&nbsp; Paid <b style="color:#15803d">${fmt(tx.paid)}</b> &nbsp;·&nbsp; ${due > 0 ? 'Due <b style="color:#dc2626">' + fmt(due) + '</b>' : '<b style="color:#15803d">Settled</b>'}</div>
      </div>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><title>Purchase Record — ${s?.name || ''}</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#1e293b}h1{font-size:18px;color:#1e40af;margin:0}
.sub{font-size:12px;color:#64748b;margin:2px 0 16px}
.tx{border:1px solid #cbd5e1;border-radius:6px;margin-bottom:10px;overflow:hidden}
.txh{background:#f1f5f9;padding:6px 10px;font-size:12px;font-weight:600}
.tx table{width:100%;border-collapse:collapse;font-size:12px}
.txf{padding:6px 10px;font-size:12px;text-align:right;border-top:1px solid #e2e8f0}
.grand{margin-top:14px;padding:10px 12px;background:#dcfce7;border-radius:6px;font-weight:bold;display:flex;justify-content:space-between;font-size:14px}
@media print{body{margin:10px}}</style></head>
<body>
  <h1>Purchase Record</h1>
  <div class="sub">${s?.name || ''} · ${s?.class || ''}${s?.section ? ' - ' + s.section : ''} · Adm. No. ${s?.admissionNo || ''} · ${txns.length} purchase${txns.length === 1 ? '' : 's'} · Printed ${new Date().toLocaleDateString('en-IN')}</div>
  ${blocks || '<p style="color:#64748b">No purchases recorded.</p>'}
  <div class="grand"><span>GRAND TOTAL — ${txns.length} purchase${txns.length === 1 ? '' : 's'}</span><span>Billed ${fmt(gNet)} &nbsp;·&nbsp; Paid ${fmt(gPaid)} &nbsp;·&nbsp; ${gNet - gPaid > 0 ? 'Due ' + fmt(gNet - gPaid) : 'All settled'}</span></div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
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

          {/* ID CARD TAB — visible card + Print, uses the active Student ID template */}
          {activeTab === 'idcard' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Student ID Card</h2>
                    <p className="text-xs text-slate-500">
                      {idTemplate ? <>Using template: <strong className="text-slate-700">{idTemplate.name}</strong></> : 'No template configured — using defaults'}
                      {' · '}
                      <a href="/settings" className="text-blue-600 hover:underline">Change in Settings → Print Templates</a>
                    </p>
                  </div>
                  <button onClick={async () => {
                    if (!student) return;
                    const { printIdCards } = await import('@/lib/idCardHtml');
                    await printIdCards([student], idTemplate, true, schoolLogo);
                  }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                    <Printer className="h-4 w-4" /> Print ID Card
                  </button>
                </div>

                <div className="bg-slate-50 rounded-lg p-6 flex justify-center">
                  {idCardHtml ? (
                    <iframe
                      title="student-id-card"
                      srcDoc={idCardHtml}
                      style={{
                        width: idTemplate?.config?.orientation === 'landscape' ? 360 : 240,
                        height: idTemplate?.config?.orientation === 'landscape' ? 240 : 380,
                        border: 'none',
                        background: 'white',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <p className="text-sm text-slate-400 py-12">Generating ID card preview…</p>
                  )}
                </div>

                {!student?.photo && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                    <strong>No photo uploaded.</strong> The card will show initials. Upload a photo on the Personal tab for a proper ID card.
                  </div>
                )}
                {idTemplate?.config?.backEnabled && (
                  <div className="mt-3 text-xs text-slate-500">
                    Back side is enabled — both front and back will print together.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PARENT INFO TAB */}
          {activeTab === 'parent' && (
            <div className="space-y-6">
              {/* Siblings */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h2 className="text-lg font-semibold text-slate-900">Siblings</h2>
                  {siblingsInfo?.familyName && <span className="text-xs text-slate-500">Family: {siblingsInfo.familyName}</span>}
                </div>

                {/* Current siblings */}
                {siblingsInfo && siblingsInfo.siblings.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {siblingsInfo.siblings.map((s: any) => (
                      <div key={s.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm">
                        <button onClick={() => router.push(`/students/${s.id}`)} className="flex items-center gap-1 hover:underline">
                          {s.name} <span className="text-xs text-blue-400">— {s.class}{s.section ? ` ${s.section}` : ''}</span>
                          {!s.active && <span className="text-[10px] text-amber-600">(left)</span>}
                        </button>
                        <button onClick={() => removeSibling(s)} disabled={sibBusy}
                          title="Remove from family" className="p-0.5 text-blue-300 hover:text-red-600 disabled:opacity-50">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 mb-4">No siblings connected yet.</p>
                )}

                {/* Connect existing student */}
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-sm font-medium text-slate-700 mb-2">Add a sibling</p>
                  <div className="flex gap-2">
                    <input placeholder="Search a student already in school by name…" value={sibSearch}
                      onChange={e => setSibSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchSiblingStudents()}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    <button onClick={searchSiblingStudents} disabled={sibSearching}
                      className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
                      {sibSearching ? '…' : 'Search'}
                    </button>
                  </div>

                  {sibResults.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {sibResults.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                          <div>
                            <span className="text-sm font-medium text-slate-900">{s.user.firstName} {s.user.lastName}</span>
                            <span className="text-xs text-slate-500 ml-2">{s.admissionNo} · {s.class?.name}</span>
                          </div>
                          <button onClick={() => connectSibling(s.id, `${s.user.firstName} ${s.user.lastName}`)} disabled={sibBusy}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            Connect
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {sibSearch.trim() && sibResults.length === 0 && !sibSearching && (
                    <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <span className="text-xs text-amber-800">Not in school yet? Admit them as a new sibling — parent details carry over.</span>
                      <button onClick={() => router.push(`/admission?sibling=${student?.admissionNo || ''}`)}
                        className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 shrink-0">
                        + Admit New Sibling
                      </button>
                    </div>
                  )}
                  <button onClick={() => router.push(`/admission?sibling=${student?.admissionNo || ''}`)}
                    className="mt-3 text-xs text-green-700 hover:underline">
                    Sibling not in school? Admit a new sibling →
                  </button>
                </div>
              </div>

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
              {/* Organised top section: title + toggles, summary dashboard, action toolbar */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                {/* Row 1 — title + options */}
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Fee Ledger</h2>
                    {ledgerData?.student?.familyName && (
                      <p className="text-sm text-slate-500">Family: {ledgerData.student.familyName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer"
                      title="When checked, this student is skipped by monthly fee generation (manual and automatic)">
                      <input type="checkbox" checked={!!student?.feeExempt} onChange={e => toggleFeeExempt(e.target.checked)} />
                      No auto monthly fee
                    </label>
                    {ledgerData?.siblings?.length > 1 && (
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={ledgerFamily} onChange={e => setLedgerFamily(e.target.checked)} />
                        Family view
                      </label>
                    )}
                  </div>
                </div>

                {/* Row 2 — summary dashboard */}
                {(() => {
                  const billed = ledgerData?.totals?.totalCharged || 0;
                  const paid = ledgerData?.totals?.totalDeposited || 0;
                  const balance = ledgerData?.currentBalance || 0;
                  const cm = currentMonth();
                  const ents = ledgerData?.entries || [];
                  const mCharge = ents.filter((e: any) => !e.voidedAt && e.type === 'CHARGE' && e.month === cm).reduce((s: number, e: any) => s + e.amount, 0);
                  const mPaid = ents.filter((e: any) => !e.voidedAt && e.type === 'DEPOSIT' && e.month === cm).reduce((s: number, e: any) => s + e.amount, 0);
                  const mDue = mCharge - mPaid;
                  const cmLabel = new Date(cm + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">Total Billed</p>
                        <p className="text-xl font-bold text-slate-900">{formatCurrency(billed)}</p>
                      </div>
                      <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                        <p className="text-xs text-slate-500">Total Paid</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(paid)}</p>
                      </div>
                      <div className={`rounded-lg border p-3 ${balance > 0 ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'}`}>
                        <p className="text-xs text-slate-500">Balance Due</p>
                        <p className={`text-xl font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(Math.max(0, balance))}</p>
                        <p className={`text-[11px] ${balance > 0 ? 'text-red-500' : 'text-green-600'}`}>{balance > 0 ? 'Dues pending' : 'All cleared'}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">This Month ({cmLabel})</p>
                        <p className={`text-xl font-bold ${mDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>{mDue > 0 ? formatCurrency(mDue) : 'Cleared'}</p>
                        {mDue > 0 && <p className="text-[11px] text-amber-500">due this month</p>}
                      </div>
                    </div>
                  );
                })()}

                {/* Siblings pills */}
                {ledgerData?.siblings?.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    {ledgerData.siblings.map((s: any) => (
                      <span key={s.id} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {s.name} — {s.class}
                      </span>
                    ))}
                  </div>
                )}

                {/* Row 3 — action toolbar */}
                <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-100">
                  <span className="text-xs font-medium text-slate-400 uppercase mr-1">Actions</span>
                  <button onClick={() => { setShowDepositForm(!showDepositForm); setShowChargeForm(false); setShowOpeningBalance(false); setShowKitForm(false); }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                    + Deposit
                  </button>
                  <button onClick={() => { setShowChargeForm(!showChargeForm); setShowDepositForm(false); setShowOpeningBalance(false); setShowKitForm(false); }} className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">
                    + Charge
                  </button>
                  <button onClick={() => showKitForm ? setShowKitForm(false) : openKitForm()} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                    🛍️ Buy Kit
                  </button>
                  <button onClick={() => { setShowOpeningBalance(!showOpeningBalance); setShowChargeForm(false); setShowDepositForm(false); setShowKitForm(false); }} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                    Opening Balance
                  </button>
                  {ledgerData?.ledger?.length > 0 && (
                    <button onClick={handlePrintLedger} className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800 ml-auto">
                      <Printer className="h-3.5 w-3.5" /> Print Ledger
                    </button>
                  )}
                </div>
              </div>

              {/* Loading indicator */}
              {ledgerLoading && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
                  <span className="h-4 w-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                  {ledgerData ? 'Updating ledger…' : 'Loading ledger…'}
                </div>
              )}

              {/* View switcher — segmented control */}
              {ledgerData?.entries?.length > 0 && (
                <div className="inline-flex flex-wrap gap-1 bg-slate-100 rounded-lg p-1">
                  {([
                    ['all', 'Monthly', 'Month-by-month fees & purchases'],
                    ['summary', 'All Expenses', 'Every charge by category, paid/unpaid'],
                    ['purchases', 'Purchases', 'Kit items: dress, books, copy, dairy…'],
                    ['entries', 'Edit Entries', 'Edit / void / restore individual entries'],
                  ] as const).map(([val, label, hint]) => (
                    <button key={val} onClick={() => setLedgerView(val)} title={hint}
                      className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${ledgerView === val ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                      {label}
                    </button>
                  ))}
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
                  <h3 className="text-sm font-semibold text-purple-800">Previous Record — Balance & Payments</h3>
                  <p className="text-xs text-purple-600">
                    Backfill a student&apos;s history: total previous fees charged AND what was already paid back then.
                    The net difference carries forward as their opening balance.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                    <label className="text-xs text-purple-700">
                      Previous fees charged (₹)
                      <input type="number" placeholder="e.g. 7800" value={openingForm.amount} onChange={e => setOpeningForm({...openingForm, amount: e.target.value})} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                    </label>
                    <label className="text-xs text-purple-700">
                      Already paid (₹)
                      <input type="number" placeholder="0" value={openingForm.paidAmount} onChange={e => setOpeningForm({...openingForm, paidAmount: e.target.value})} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </label>
                    <label className="text-xs text-purple-700">
                      Paid via
                      <select value={openingForm.paymentMethod} onChange={e => setOpeningForm({...openingForm, paymentMethod: e.target.value})} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        {['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'DD'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-purple-700">
                      Academic year
                      <select value={openingForm.year} onChange={e => setOpeningForm({...openingForm, year: e.target.value})} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        {['2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-purple-700">
                      Month (optional)
                      <input type="month" value={openingForm.month} onChange={e => setOpeningForm({...openingForm, month: e.target.value})} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" disabled={chargeSaving} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">{chargeSaving ? 'Saving…' : 'Save'}</button>
                      <button type="button" onClick={() => setShowOpeningBalance(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                    </div>
                  </div>
                  {(parseFloat(openingForm.amount) || 0) > 0 && (
                    <p className="text-xs font-semibold text-purple-800">
                      Net carried forward: {formatCurrency(Math.max(0, (parseFloat(openingForm.amount) || 0) - (parseFloat(openingForm.paidAmount) || 0)))}
                      {(parseFloat(openingForm.paidAmount) || 0) > (parseFloat(openingForm.amount) || 0) &&
                        <span className="text-green-700"> (advance of {formatCurrency((parseFloat(openingForm.paidAmount) || 0) - (parseFloat(openingForm.amount) || 0))})</span>}
                    </p>
                  )}

                  {/* Existing previous records — with delete options */}
                  {(() => {
                    const all = ledgerData?.entries || [];
                    const prevCharges = all.filter((e: any) => !e.voidedAt && e.category === 'PREVIOUS_BALANCE');
                    const prevMonths = new Set(prevCharges.map((e: any) => e.month));
                    const prevDeposits = all.filter((e: any) => !e.voidedAt && e.type === 'DEPOSIT' && prevMonths.has(e.month));
                    const records = [...prevCharges, ...prevDeposits].sort((a: any, b: any) => a.month.localeCompare(b.month) || a.type.localeCompare(b.type));
                    if (records.length === 0) return null;
                    return (
                      <div className="border-t border-purple-200 pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-purple-800">Existing previous records</p>
                          <button type="button" onClick={() => removeAllPreviousRecords(records)}
                            className="px-2.5 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 font-semibold">
                            Remove all
                          </button>
                        </div>
                        {records.map((e: any) => (
                          <div key={e.id} className="flex items-center justify-between gap-2 bg-white border border-purple-100 rounded-lg px-3 py-1.5 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`px-1.5 py-0.5 rounded font-semibold ${e.type === 'CHARGE' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                {e.type === 'CHARGE' ? 'BALANCE' : 'DEPOSIT'}
                              </span>
                              <span className="text-slate-700 truncate">{e.description}</span>
                              <span className="text-slate-400">{new Date(e.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`font-bold ${e.type === 'CHARGE' ? 'text-orange-700' : 'text-green-700'}`}>{formatCurrency(e.amount)}</span>
                              <button type="button" onClick={() => handleEntryDelete(e)}
                                className="px-2 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100">Remove</button>
                            </div>
                          </div>
                        ))}
                        <p className="text-[10px] text-purple-500">Removed entries are voided (recoverable from All Entries → Show voided). Admin can permanently delete them from there.</p>
                      </div>
                    );
                  })()}
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
                      <button type="submit" disabled={depositSaving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">{depositSaving ? 'Saving…' : 'Save'}</button>
                      <button type="button" onClick={() => setShowDepositForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                    </div>
                  </div>
                </form>
              )}

              {/* Charge form */}
              {showChargeForm && (
                <form onSubmit={handleCharge} className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-orange-800">Add Charge</h3>
                  {(() => {
                    const isFamily = ledgerFamily && (ledgerData?.siblings?.length || 0) > 1;
                    return (
                      <>
                        {/* Shared fields */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input type="month" value={chargeForm.month} onChange={e => setChargeForm({...chargeForm, month: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" placeholder="Month" />
                          <select value={chargeForm.category} onChange={e => setChargeForm({...chargeForm, category: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                            {['MONTHLY_FEE', 'ANNUAL', 'BOOK', 'DRESS', 'COPY', 'DAIRY', 'TIE_BELT', 'TRANSPORT', 'REGISTRATION', 'ADMISSION', 'AD_HOC', 'PREVIOUS_BALANCE'].map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                          </select>
                          <input placeholder="Description (optional)" value={chargeForm.description} onChange={e => setChargeForm({...chargeForm, description: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                        </div>

                        {isFamily ? (
                          /* Per-child amounts — charge each sibling a different fee */
                          <div className="space-y-2">
                            <p className="text-xs text-orange-700 font-medium">Amount per child (leave blank to skip a child):</p>
                            {ledgerData.siblings.map((sib: any) => (
                              <div key={sib.id} className="flex items-center gap-3">
                                <span className="text-sm text-slate-700 w-48 truncate">{sib.name} <span className="text-slate-400 text-xs">— {sib.class}</span></span>
                                <input type="number" placeholder="₹ amount" value={chargePerStudent[sib.id] || ''}
                                  onChange={e => setChargePerStudent({ ...chargePerStudent, [sib.id]: e.target.value })}
                                  className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                              </div>
                            ))}
                            <div className="flex gap-2 pt-1">
                              <button type="submit" disabled={chargeSaving} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">{chargeSaving ? 'Adding…' : 'Add to each child'}</button>
                              <button type="button" onClick={() => setShowChargeForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3">
                            <input type="number" placeholder="Amount (₹)" value={chargeForm.amount} onChange={e => setChargeForm({...chargeForm, amount: e.target.value})} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                            <button type="submit" disabled={chargeSaving} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">{chargeSaving ? 'Adding…' : 'Add'}</button>
                            <button type="button" onClick={() => setShowChargeForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </form>
              )}

              {/* Buy Class Kit form */}
              {showKitForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-blue-900">Buy Class Kit — {student?.class?.name}{student?.section?.name ? ` (${student.section.name})` : ''}</h3>
                      <p className="text-xs text-blue-700 mt-0.5">Items and amounts pre-loaded from Annual Fee Plan. Uncheck what student isn&apos;t buying, edit amounts as needed.</p>
                    </div>
                    <button onClick={() => setShowKitForm(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
                  </div>

                  {kitLoading ? (
                    <p className="text-sm text-blue-700">Loading class kit...</p>
                  ) : (
                    <>
                      <div className="bg-white rounded-xl overflow-hidden border border-blue-100">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-10"></th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Item</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-36">Category</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-36">Amount (₹)</th>
                              <th className="px-3 py-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {kitItems.map((item, i) => (
                              <tr key={i} className={item.selected ? '' : 'opacity-50'}>
                                <td className="px-3 py-2 text-center">
                                  <input type="checkbox" checked={item.selected}
                                    onChange={e => { const c = [...kitItems]; c[i].selected = e.target.checked; setKitItems(c); }} />
                                </td>
                                <td className="px-3 py-2">
                                  <input value={item.description}
                                    onChange={e => { const c = [...kitItems]; c[i].description = e.target.value; setKitItems(c); }}
                                    className="w-full text-sm text-slate-900 bg-transparent outline-none" />
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500">{item.category.replace(/_/g, ' ')}</td>
                                <td className="px-3 py-2">
                                  <input type="number" placeholder="0" value={item.amount}
                                    onChange={e => { const c = [...kitItems]; c[i].amount = e.target.value; setKitItems(c); }}
                                    className="w-full text-sm text-slate-900 text-right bg-transparent outline-none font-medium" />
                                </td>
                                <td className="px-3 py-2">
                                  <button onClick={() => setKitItems(kitItems.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="px-3 py-2 border-t border-slate-200 flex justify-between items-center">
                          <button onClick={() => setKitItems([...kitItems, { selected: true, category: 'AD_HOC', description: '', amount: '' }])}
                            className="text-xs text-blue-600 hover:text-blue-800">+ Add custom item</button>
                          <div className="text-sm font-bold text-slate-900">Total: {formatCurrency(kitSelectedTotal)}</div>
                        </div>
                      </div>

                      {/* Optional discount */}
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                        <h4 className="text-xs font-semibold text-purple-800 mb-2">Discount (optional — admin can give ₹ off)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input type="number" placeholder="Discount amount (₹)" value={kitDiscount.amount}
                            onChange={e => setKitDiscount({ ...kitDiscount, amount: e.target.value })}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                          <input placeholder="Reason (e.g. sibling, scholarship, approved by X)" value={kitDiscount.reason}
                            onChange={e => setKitDiscount({ ...kitDiscount, reason: e.target.value })}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                        </div>
                        {kitSelectedTotal > 0 && (
                          <div className="mt-2 flex justify-end gap-4 text-xs">
                            <span className="text-slate-600">Subtotal: <strong>{formatCurrency(kitSelectedTotal)}</strong></span>
                            {kitDiscountAmount > 0 && <span className="text-purple-700">Discount: <strong>-{formatCurrency(kitDiscountAmount)}</strong></span>}
                            <span className="text-slate-900">Net: <strong>{formatCurrency(kitNetTotal)}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Also collect this month's fee in the same bill */}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <h4 className="text-xs font-semibold text-blue-800 mb-2">Also collect (same bill)</h4>
                        {kitMonthlyFee > 0 && !kitMonthlyCharged ? (
                          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input type="checkbox" checked={kitIncludeFee} onChange={e => setKitIncludeFee(e.target.checked)} />
                            Monthly Fee — {new Date(currentMonth() + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                            <strong className="ml-1">{formatCurrency(kitMonthlyFee)}</strong>
                          </label>
                        ) : kitMonthlyCharged ? (
                          <p className="text-xs text-slate-500">This month&apos;s fee is already on the ledger — it&apos;s included in &quot;previous dues&quot; below if unpaid.</p>
                        ) : (
                          <p className="text-xs text-slate-500">No monthly fee set for this class in the Annual Fee Plan.</p>
                        )}
                      </div>

                      {/* Payment + live bill summary */}
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-3">
                        <h4 className="text-xs font-semibold text-green-800">Payment at Purchase</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <input type="number" placeholder="Paid amount (₹)" value={kitDeposit.amount}
                            onChange={e => setKitDeposit({ ...kitDeposit, amount: e.target.value })}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                          <select value={kitDeposit.paymentMethod} onChange={e => setKitDeposit({ ...kitDeposit, paymentMethod: e.target.value })}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                            {['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'DD'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                          </select>
                          <input placeholder="Received by" value={kitDeposit.receivedBy}
                            onChange={e => setKitDeposit({ ...kitDeposit, receivedBy: e.target.value })}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setKitDeposit({ ...kitDeposit, amount: String(kitTotalPayable) })}
                            disabled={kitTotalPayable <= 0}
                            className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40">
                            Pay in full ({formatCurrency(kitTotalPayable)})
                          </button>
                          {kitNewCharges > 0 && kitPrevDues > 0 && (
                            <button type="button" onClick={() => setKitDeposit({ ...kitDeposit, amount: String(kitNewCharges) })}
                              className="px-3 py-1.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                              Pay this bill only ({formatCurrency(kitNewCharges)})
                            </button>
                          )}
                          <button type="button" onClick={() => setKitDeposit({ ...kitDeposit, amount: '' })}
                            className="px-3 py-1.5 text-xs font-semibold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                            No payment
                          </button>
                        </div>

                        {/* Live bill summary */}
                        <div className="bg-white rounded-lg border border-slate-200 p-3 text-sm space-y-1">
                          <div className="flex justify-between text-slate-600"><span>Kit (net)</span><span>{formatCurrency(kitNetTotal)}</span></div>
                          {kitFeeAmount > 0 && <div className="flex justify-between text-slate-600"><span>Monthly Fee</span><span>{formatCurrency(kitFeeAmount)}</span></div>}
                          <div className="flex justify-between font-medium text-slate-800 border-t border-slate-100 pt-1"><span>New charges</span><span>{formatCurrency(kitNewCharges)}</span></div>
                          {kitPrevDues > 0 && <div className="flex justify-between text-slate-600"><span>Previous dues</span><span>{formatCurrency(kitPrevDues)}</span></div>}
                          <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-1"><span>Total payable</span><span>{formatCurrency(kitTotalPayable)}</span></div>
                          <div className="flex justify-between text-green-700"><span>Paid now</span><span>{formatCurrency(kitPaidNow)}</span></div>
                          <div className={`flex justify-between font-bold border-t border-slate-200 pt-1 ${kitBalanceAfter > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            <span>Balance after</span>
                            <span>{formatCurrency(Math.max(0, kitBalanceAfter))} {kitBalanceAfter > 0 ? 'DUE' : 'CLEAR'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowKitForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                        <button onClick={handleKitSubmit} disabled={kitSubmitting || kitNewCharges <= 0}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                          {kitSubmitting ? 'Saving...' : `Confirm & Print Receipt (${formatCurrency(kitNewCharges)})`}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Ledger table — matches physical register */}
              {ledgerView === 'all' && ledgerData?.ledger?.length > 0 && (() => {
                // Group by academic year (Apr-Mar)
                const getAcademicYear = (month: string) => {
                  const [y, m] = month.split('-').map(Number);
                  return m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
                };
                let lastYear = '';

                // Pre-pass: per-row payment status using cumulative totals.
                // monthlyFeePaid = cumulative deposits ≥ cumulative monthly fees through this row
                // rowPaymentStatus tracks whether running balance after this row is cleared
                let cumMonthlyFee = 0;
                let cumDeposits = 0;
                const decoratedRows = ledgerData.ledger.map((row: any) => {
                  cumMonthlyFee += row.monthlyFee || 0;
                  cumDeposits += row.deposited || 0;
                  const monthlyFeePaid = row.monthlyFee > 0 && cumDeposits >= cumMonthlyFee;
                  let status: 'PAID' | 'PARTIAL' | 'DUE' | 'NONE';
                  if (row.monthlyFee === 0 && row.otherCharges === 0 && row.deposited === 0) status = 'NONE';
                  else if (row.balance <= 0) status = 'PAID';
                  else if (cumDeposits > 0 || row.deposited > 0) status = 'PARTIAL';
                  else status = 'DUE';
                  return { ...row, monthlyFeePaid, status };
                });

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
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Status</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Date / Sign</th>
                          <th className="text-center px-4 py-3 text-sm font-medium text-slate-500">Pay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {decoratedRows.map((row: any) => {
                          const year = getAcademicYear(row.month);
                          const showYearHeader = year !== lastYear;
                          lastYear = year;
                          const isPrevBalance = row.monthlyFee === 0 && row.otherCharges > 0 && row.otherDetails.some((d: string) => d.toLowerCase().includes('previous') || d.toLowerCase().includes('opening'));
                          const rowTint = row.status === 'PAID' ? 'bg-green-50/50' : row.status === 'PARTIAL' ? 'bg-amber-50/40' : '';

                          return (
                            <Fragment key={row.month}>{showYearHeader && (
                              <tr className="bg-blue-50">
                                <td colSpan={9} className="px-4 py-2 text-sm font-bold text-blue-700">Academic Year {year}</td>
                              </tr>
                            )}
                            <tr className={`hover:bg-slate-50 ${isPrevBalance ? 'bg-purple-50' : rowTint}`}>
                              <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                {new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                {isPrevBalance && <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Prev. Balance</span>}
                              </td>
                              <td className={`px-4 py-3 text-sm text-right ${row.monthlyFeePaid ? 'text-green-700 font-semibold' : 'text-slate-700'}`}>
                                {row.monthlyFee > 0 ? (
                                  <span className={row.monthlyFeePaid ? 'inline-flex items-center gap-1' : ''}>
                                    <span className={row.monthlyFeePaid ? 'line-through opacity-70' : ''}>{formatCurrency(row.monthlyFee)}</span>
                                    {row.monthlyFeePaid && <span className="text-green-600">✓</span>}
                                  </span>
                                ) : '—'}
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
                              <td className="px-4 py-3">
                                {row.status === 'PAID' && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">PAID</span>}
                                {row.status === 'PARTIAL' && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">PARTIAL</span>}
                                {row.status === 'DUE' && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">DUE</span>}
                                {row.status === 'NONE' && <span className="text-slate-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-400">
                                {(ledgerData?.entries || [])
                                  .filter((d: any) => d.type === 'DEPOSIT' && d.month === row.month && !d.voidedAt)
                                  .map((d: any) => (
                                    <div key={d.id} className="flex items-center justify-between gap-2 mb-1 last:mb-0">
                                      <div>
                                        <div>{new Date(d.date).toLocaleDateString('en-IN')}</div>
                                        <div className="text-slate-500">{d.paymentMethod || '—'}</div>
                                      </div>
                                      <button onClick={() => printDepositReceipt(d.id)}
                                        title="Print receipt"
                                        className="p-1 rounded hover:bg-purple-50 text-purple-600 hover:text-purple-800">
                                        <Printer className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                {(!row.depositDates?.length) && <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {(() => {
                                  const monthDue = Math.max(0, (row.monthlyFee || 0) + (row.otherCharges || 0) - (row.deposited || 0));
                                  const isLocked = ledgerData?.feeLockMonth && row.month <= ledgerData.feeLockMonth;
                                  if (isLocked) return <span className="text-slate-300 text-xs" title="Month is locked">🔒</span>;
                                  if (monthDue <= 0) return <span className="text-green-500 text-xs">✓</span>;
                                  return (
                                    <button onClick={() => openInlineDeposit(row)}
                                      title={`Collect ${formatCurrency(monthDue)} for this month`}
                                      className="px-2.5 py-1 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">
                                      + Pay
                                    </button>
                                  );
                                })()}
                              </td>
                            </tr>
                            {inlineDeposit && inlineDeposit.month === row.month && (() => {
                              const dep = inlineDeposit;
                              return (
                              <tr key={`pay-${row.month}`} className="bg-green-50">
                                <td colSpan={9} className="px-4 py-3">
                                  <form onSubmit={saveInlineDeposit} className="flex items-end gap-3 flex-wrap">
                                    <span className="text-sm font-semibold text-green-800 pb-2">
                                      Deposit — {new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                    </span>
                                    <label className="text-xs text-slate-600">
                                      Amount (₹)
                                      <input type="number" step="0.01" min="1" autoFocus required value={dep.amount}
                                        onChange={ev => setInlineDeposit({ ...dep, amount: ev.target.value })}
                                        className="mt-1 block w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900" />
                                    </label>
                                    <label className="text-xs text-slate-600">
                                      Method
                                      <select value={dep.paymentMethod}
                                        onChange={ev => setInlineDeposit({ ...dep, paymentMethod: ev.target.value })}
                                        className="mt-1 block px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
                                        {['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'DD'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                                      </select>
                                    </label>
                                    <label className="text-xs text-slate-600">
                                      Received by
                                      <input value={dep.receivedBy}
                                        onChange={ev => setInlineDeposit({ ...dep, receivedBy: ev.target.value })}
                                        className="mt-1 block w-36 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900" />
                                    </label>
                                    <button type="submit" disabled={inlineDepositSaving}
                                      className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                                      {inlineDepositSaving ? 'Saving…' : 'Save Deposit'}
                                    </button>
                                    <button type="button" onClick={() => setInlineDeposit(null)}
                                      className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                                  </form>
                                </td>
                              </tr>
                              );
                            })()}</Fragment>
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
                          <td>
                            {ledgerData.currentBalance <= 0
                              ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">ALL PAID</span>
                              : <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">{formatCurrency(ledgerData.currentBalance)} DUE</span>}
                          </td>
                          <td></td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Expense Summary — every charge category rolled up: Charged / Paid / Due */}
              {ledgerView === 'summary' && (() => {
                const CAT_LABELS: Record<string, string> = {
                  MONTHLY_FEE: 'Monthly Fee', ANNUAL: 'Annual Charge', ADMISSION: 'Admission',
                  REGISTRATION: 'Registration', BOOK: 'Books', DRESS: 'Dress', COPY: 'Copy',
                  DAIRY: 'Dairy', TIE_BELT: 'Tie / Belt', TRANSPORT: 'Transport', EXAM_FEE: 'Exam Fee',
                  FINE: 'Fine', ID_CARD: 'ID Card', PREVIOUS_BALANCE: 'Previous Balance',
                  DISCOUNT: 'Discount', AD_HOC: 'Other',
                };
                // Group non-voided CHARGE rows by category. paidAmount is FIFO-tracked
                // per charge row, so paid/due per category are accurate.
                const byCat = new Map<string, { charged: number; paid: number }>();
                for (const e of (ledgerData?.entries || [])) {
                  if (e.voidedAt || e.type !== 'CHARGE') continue;
                  const key = e.category || 'AD_HOC';
                  const cur = byCat.get(key) || { charged: 0, paid: 0 };
                  cur.charged += e.amount;
                  cur.paid += e.paidAmount || 0;
                  byCat.set(key, cur);
                }
                const rows = Array.from(byCat.entries())
                  .map(([cat, v]) => ({ cat, label: CAT_LABELS[cat] || cat.replace(/_/g, ' '), ...v, due: Math.max(0, v.charged - v.paid) }))
                  .sort((a, b) => b.charged - a.charged);
                const tot = rows.reduce((t, r) => ({ charged: t.charged + r.charged, paid: t.paid + r.paid, due: t.due + r.due }), { charged: 0, paid: 0, due: 0 });

                if (rows.length === 0) {
                  return <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">No charges recorded yet.</div>;
                }
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-sm text-slate-600">Total of every charge this student has been billed, grouped by type.</p>
                      <button onClick={() => printExpenseSummary(rows, tot)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800">
                        <Printer className="h-3.5 w-3.5" /> Print Statement
                      </button>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium">Category</th>
                            <th className="text-right px-4 py-3 font-medium">Charged</th>
                            <th className="text-right px-4 py-3 font-medium">Paid</th>
                            <th className="text-right px-4 py-3 font-medium">Due</th>
                            <th className="text-left px-4 py-3 font-medium w-40">Progress</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rows.map(r => {
                            const pct = r.charged > 0 ? Math.min(100, (r.paid / r.charged) * 100) : 0;
                            return (
                              <tr key={r.cat} className="hover:bg-slate-50">
                                <td className="px-4 py-2.5 font-medium text-slate-900">{r.label}</td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{formatCurrency(r.charged)}</td>
                                <td className="px-4 py-2.5 text-right text-green-600 font-medium">{formatCurrency(r.paid)}</td>
                                <td className={`px-4 py-2.5 text-right font-semibold ${r.due > 0 ? 'text-red-600' : 'text-slate-400'}`}>{r.due > 0 ? formatCurrency(r.due) : '—'}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                                      <div className={`h-2 rounded-full ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300'}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs text-slate-400 w-9 text-right">{Math.round(pct)}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                            <td className="px-4 py-3">TOTAL</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(tot.charged)}</td>
                            <td className="px-4 py-3 text-right text-green-700">{formatCurrency(tot.paid)}</td>
                            <td className={`px-4 py-3 text-right ${tot.due > 0 ? 'text-red-600' : 'text-green-600'}`}>{tot.due > 0 ? formatCurrency(tot.due) : 'ALL PAID'}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Itemised — every expense line in one place, paid or unpaid */}
                    {(() => {
                      const items = (ledgerData?.entries || [])
                        .filter((e: any) => !e.voidedAt && e.type === 'CHARGE')
                        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.month.localeCompare(b.month));
                      if (items.length === 0) return null;
                      return (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-2">All Expenses — itemised</h3>
                          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                  <th className="text-left px-4 py-2.5 font-medium">Date</th>
                                  <th className="text-left px-4 py-2.5 font-medium">Expense</th>
                                  <th className="text-left px-4 py-2.5 font-medium">Category</th>
                                  <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                                  <th className="text-right px-4 py-2.5 font-medium">Paid</th>
                                  <th className="text-right px-4 py-2.5 font-medium">Due</th>
                                  <th className="text-center px-4 py-2.5 font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {items.map((e: any) => {
                                  const paid = e.paidAmount || 0;
                                  const due = Math.max(0, e.amount - paid);
                                  const st = due <= 0.005 ? 'PAID' : paid > 0.005 ? 'PARTIAL' : 'DUE';
                                  const stColor = st === 'PAID' ? 'bg-green-100 text-green-700' : st === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
                                  return (
                                    <tr key={e.id} className="hover:bg-slate-50">
                                      <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString('en-IN')}</td>
                                      <td className="px-4 py-2 text-slate-900">{e.description}</td>
                                      <td className="px-4 py-2 text-xs text-slate-500">{(CAT_LABELS[e.category] || e.category || 'Other')}</td>
                                      <td className="px-4 py-2 text-right text-slate-900">{formatCurrency(e.amount)}</td>
                                      <td className="px-4 py-2 text-right text-green-600">{formatCurrency(paid)}</td>
                                      <td className={`px-4 py-2 text-right font-medium ${due > 0 ? 'text-red-600' : 'text-slate-300'}`}>{due > 0 ? formatCurrency(due) : '—'}</td>
                                      <td className="px-4 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${stColor}`}>{st}</span></td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
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

                    {/* Purchase records — each kit transaction grouped (what was bought, when, paid) */}
                    {(() => {
                      // All non-voided entries that share a timestamp with a purchase
                      // charge belong to the same purchase transaction (the kit route
                      // stamps every row in one purchase with the same instant).
                      const stamps = new Set(purchases.map((p: any) => new Date(p.date).getTime()));
                      const groups = new Map<number, any[]>();
                      for (const e of (ledgerData?.entries || [])) {
                        if (e.voidedAt) continue;
                        const t = new Date(e.date).getTime();
                        if (!stamps.has(t)) continue;
                        const list = groups.get(t) || [];
                        list.push(e);
                        groups.set(t, list);
                      }
                      const txns = Array.from(groups.entries())
                        .sort((a, b) => b[0] - a[0])
                        .map(([t, entries]) => {
                          const items = entries.filter((e: any) => e.type === 'CHARGE' && e.amount > 0);
                          const discount = entries.filter((e: any) => e.type === 'CHARGE' && e.amount < 0).reduce((s: number, e: any) => s + Math.abs(e.amount), 0);
                          const dep = entries.find((e: any) => e.type === 'DEPOSIT');
                          const paid = entries.filter((e: any) => e.type === 'DEPOSIT').reduce((s: number, e: any) => s + e.amount, 0);
                          const gross = items.reduce((s: number, e: any) => s + e.amount, 0);
                          return { t, date: entries[0].date, items, discount, paid, dep, net: gross - discount };
                        });
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-700">Purchase Records ({txns.length})</h3>
                            {txns.length > 0 && (
                              <button onClick={() => printPurchaseHistory(txns)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800">
                                <Printer className="h-3.5 w-3.5" /> Save / Print
                              </button>
                            )}
                          </div>
                          {txns.map(tx => (
                            <div key={tx.t} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex-wrap">
                                <span className="text-sm font-medium text-slate-700">{fmtDateTime(tx.date)}</span>
                                <div className="flex items-center gap-3">
                                  {tx.dep?.receiptNumber && <span className="text-xs text-slate-400">{tx.dep.receiptNumber}</span>}
                                  {tx.dep && (
                                    <button onClick={() => printDepositReceipt(tx.dep.id)}
                                      className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 flex items-center gap-1">
                                      <Printer className="h-3 w-3" /> Receipt
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="px-4 py-2 divide-y divide-slate-50">
                                {tx.items.map((it: any) => (
                                  <div key={it.id} className="flex items-center justify-between py-1.5 text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CAT_COLORS[it.category] || 'bg-slate-100 text-slate-600'}`}>{it.category.replace(/_/g, ' ')}</span>
                                      <span className="text-slate-700">{it.description}</span>
                                    </div>
                                    <span className="text-slate-900 font-medium">{formatCurrency(it.amount)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-end gap-5 text-sm flex-wrap">
                                {tx.discount > 0 && <span className="text-purple-700">Discount: <strong>-{formatCurrency(tx.discount)}</strong></span>}
                                <span className="text-slate-700">Total: <strong>{formatCurrency(tx.net)}</strong></span>
                                <span className="text-green-700">Paid: <strong>{formatCurrency(tx.paid)}</strong></span>
                                <span className={tx.net - tx.paid > 0 ? 'text-red-600' : 'text-green-600'}>
                                  {tx.net - tx.paid > 0 ? <>Due: <strong>{formatCurrency(tx.net - tx.paid)}</strong></> : <strong>Settled</strong>}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* All entries view — editable */}
              {ledgerView === 'entries' && (() => {
                const allEntries = ledgerData?.entries || [];
                const voidable = allEntries.filter(isEntryVoidable);
                const allSelected = voidable.length > 0 && voidable.every((e: any) => selectedEntries.has(e.id));
                const selectedCount = allEntries.filter((e: any) => selectedEntries.has(e.id) && isEntryVoidable(e)).length;
                const toggleSelectAll = () => {
                  setSelectedEntries(() => allSelected ? new Set() : new Set(voidable.map((e: any) => e.id)));
                };
                // In family view, label which child each row belongs to
                const isFamily = (ledgerData?.siblings?.length || 0) > 1;
                const nameById = new Map<string, string>((ledgerData?.siblings || []).map((s: any) => [s.id, s.name]));
                return (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 bg-amber-50 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-amber-800">
                      <strong>Edit mode:</strong> Delete = void (kept for audit, can be restored). Tick rows to void several at once.
                      {ledgerData?.feeLockMonth && (
                        <span className="ml-1 font-semibold">🔒 Months up to {ledgerData.feeLockMonth} are locked (read-only).</span>
                      )}
                    </p>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)} />
                        Show voided entries
                      </label>
                      <Link href={`/fee-reports/audit-log?studentId=${id}`}
                        className="text-xs text-blue-600 hover:underline">Change history</Link>
                    </div>
                  </div>

                  {/* Bulk selection bar */}
                  {selectedCount > 0 && (
                    <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm font-medium text-red-800">{selectedCount} selected</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedEntries(new Set())} disabled={bulkVoiding}
                          className="px-3 py-1.5 text-xs bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50">Clear</button>
                        <button onClick={handleBulkVoid} disabled={bulkVoiding}
                          className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5">
                          {bulkVoiding && <span className="h-3 w-3 border-2 border-red-200 border-t-white rounded-full animate-spin" />}
                          {bulkVoiding ? 'Voiding…' : 'Void selected'}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-center w-8">
                            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                              title="Select all voidable entries" disabled={voidable.length === 0} />
                          </th>
                          {isFamily && <th className="px-3 py-2 text-left">Student</th>}
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Month</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Category</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Method / Receipt</th>
                          <th className="px-3 py-2 text-right">Balance After</th>
                          <th className="px-3 py-2 text-right w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(ledgerData?.entries || []).map((e: any) => {
                          const paid = e.paidAmount ?? 0;
                          const isCharge = e.type === 'CHARGE';
                          const isVoided = !!e.voidedAt;
                          const fullyPaid = isCharge && !isVoided && paid >= e.amount - 0.01;
                          const partial = isCharge && !isVoided && paid > 0 && !fullyPaid;
                          const rowTint = isVoided ? 'bg-slate-100/60 opacity-60' : fullyPaid ? 'bg-green-50/40' : partial ? 'bg-amber-50/30' : '';
                          const voidable = isEntryVoidable(e);
                          return (
                            <tr key={e.id} className={`hover:bg-slate-50 ${rowTint} ${selectedEntries.has(e.id) ? 'bg-red-50/50' : ''}`}>
                              <td className="px-3 py-2 text-center">
                                {voidable
                                  ? <input type="checkbox" checked={selectedEntries.has(e.id)} onChange={() => toggleEntrySelect(e.id)} />
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              {isFamily && <td className="px-3 py-2 text-slate-700 font-medium">{nameById.get(e.studentId) || '—'}</td>}
                              <td className="px-3 py-2 text-slate-700">{new Date(e.date).toLocaleDateString('en-IN')}</td>
                              <td className="px-3 py-2 text-slate-700">{e.month}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                  isCharge ? 'bg-orange-100 text-orange-700' :
                                  e.type === 'DISCOUNT' ? 'bg-pink-100 text-pink-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {e.type}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-700 text-xs">{e.category || '—'}</td>
                              <td className="px-3 py-2 text-slate-700">
                                {e.description}
                                {isVoided && <div className="text-[10px] text-red-600 mt-0.5">Voided: {e.voidReason || 'no reason'}</div>}
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${isVoided ? 'text-slate-400 line-through' : fullyPaid ? 'text-green-700' : 'text-slate-900'}`}>
                                {inlineAmount && inlineAmount.id === e.id ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <input type="number" step="0.01" autoFocus value={inlineAmount.value}
                                      onChange={ev => setInlineAmount({ id: e.id, value: ev.target.value })}
                                      onKeyDown={ev => { if (ev.key === 'Enter') saveInlineAmount(e); if (ev.key === 'Escape') setInlineAmount(null); }}
                                      className="w-24 px-2 py-1 border border-blue-400 rounded text-right text-slate-900" />
                                    <button onClick={() => saveInlineAmount(e)} disabled={inlineAmountSaving}
                                      className="px-1.5 text-green-600 hover:text-green-800 disabled:opacity-40" title="Save">✓</button>
                                    <button onClick={() => setInlineAmount(null)} className="px-1.5 text-slate-400 hover:text-slate-600" title="Cancel">✕</button>
                                  </div>
                                ) : voidable ? (
                                  <button onClick={() => setInlineAmount({ id: e.id, value: String(e.amount) })}
                                    className="underline decoration-dotted decoration-slate-300 underline-offset-2 hover:decoration-blue-500"
                                    title="Click to correct the amount">
                                    {formatCurrency(e.amount)}
                                  </button>
                                ) : formatCurrency(e.amount)}
                              </td>
                              <td className="px-3 py-2">
                                {isVoided ? (
                                  <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-xs font-semibold">VOIDED</span>
                                ) : isCharge ? (
                                  fullyPaid
                                    ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">PAID</span>
                                    : partial
                                      ? <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold" title={`Paid ${formatCurrency(paid)} of ${formatCurrency(e.amount)}`}>PARTIAL</span>
                                      : <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">DUE</span>
                                ) : <span className="text-slate-300 text-xs">—</span>}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-500">
                                {e.paymentMethod && <div>{e.paymentMethod}</div>}
                                {e.receiptNumber && <div className="text-slate-400">{e.receiptNumber}</div>}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(e.balanceAfter)}</td>
                              <td className="px-3 py-2 text-right">
                                <div className="flex gap-1 justify-end flex-wrap items-center">
                                  {(() => {
                                    if (busyEntryId === e.id) {
                                      return (
                                        <span className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400">
                                          <span className="h-3 w-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" /> Working…
                                        </span>
                                      );
                                    }
                                    const isLocked = ledgerData?.feeLockMonth && e.month <= ledgerData.feeLockMonth;
                                    if (isLocked) {
                                      return (
                                        <>
                                          {!isVoided && !isCharge && (
                                            <button onClick={() => printDepositReceipt(e.id)}
                                              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Print</button>
                                          )}
                                          <span className="px-2 py-1 text-xs bg-slate-100 text-slate-500 rounded"
                                            title={`Locked — months up to ${ledgerData.feeLockMonth} are read-only (Settings → Annual Fee Plan)`}>
                                            🔒 Locked
                                          </span>
                                        </>
                                      );
                                    }
                                    return isVoided ? (
                                      <>
                                        <button onClick={() => handleEntryRestore(e)}
                                          className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">Restore</button>
                                        {authUser?.role === 'ADMIN' && (
                                          <button onClick={() => handleEntryHardDelete(e)}
                                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Delete forever</button>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        {!isCharge && (
                                          <button onClick={() => printDepositReceipt(e.id)}
                                            className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Print</button>
                                        )}
                                        <button onClick={() => setEditingEntry({ ...e, amount: String(e.amount) })}
                                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Edit</button>
                                        <button onClick={() => handleEntryDelete(e)}
                                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">Void</button>
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {(!ledgerData?.entries || ledgerData.entries.length === 0) && (
                          <tr><td colSpan={isFamily ? 12 : 11} className="px-3 py-6 text-center text-slate-400 text-sm">No entries yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                );
              })()}

              {/* Edit entry modal */}
              {editingEntry && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditingEntry(null)}>
                  <form onSubmit={handleEntrySave} onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Edit Ledger Entry</h3>
                      <button type="button" onClick={() => setEditingEntry(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-slate-600">
                        Type
                        <select value={editingEntry.type}
                          onChange={ev => setEditingEntry({ ...editingEntry, type: ev.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                          <option value="CHARGE">CHARGE</option>
                          <option value="DEPOSIT">DEPOSIT</option>
                          <option value="DISCOUNT">DISCOUNT</option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-600">
                        Month (YYYY-MM)
                        <input type="month" value={editingEntry.month}
                          onChange={ev => setEditingEntry({ ...editingEntry, month: ev.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      </label>
                      <label className="text-xs text-slate-600">
                        Category
                        <select value={editingEntry.category || ''}
                          onChange={ev => setEditingEntry({ ...editingEntry, category: ev.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                          <option value="">—</option>
                          {['MONTHLY_FEE', 'ANNUAL', 'BOOK', 'DRESS', 'COPY', 'DAIRY', 'TIE_BELT', 'TRANSPORT', 'REGISTRATION', 'ADMISSION', 'AD_HOC', 'PREVIOUS_BALANCE', 'DEPOSIT'].map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                        </select>
                      </label>
                      <label className="text-xs text-slate-600">
                        Amount (₹)
                        <input type="number" step="0.01" value={editingEntry.amount}
                          onChange={ev => setEditingEntry({ ...editingEntry, amount: ev.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      </label>
                      <label className="text-xs text-slate-600 col-span-2">
                        Description
                        <input value={editingEntry.description}
                          onChange={ev => setEditingEntry({ ...editingEntry, description: ev.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      </label>
                      {editingEntry.type === 'DEPOSIT' && (
                        <>
                          <label className="text-xs text-slate-600">
                            Payment Method
                            <select value={editingEntry.paymentMethod || ''}
                              onChange={ev => setEditingEntry({ ...editingEntry, paymentMethod: ev.target.value })}
                              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                              <option value="">—</option>
                              {['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'DD'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                            </select>
                          </label>
                          <label className="text-xs text-slate-600">
                            Received By
                            <input value={editingEntry.receivedBy || ''}
                              onChange={ev => setEditingEntry({ ...editingEntry, receivedBy: ev.target.value })}
                              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                          </label>
                          <label className="text-xs text-slate-600 col-span-2">
                            Receipt Number
                            <input value={editingEntry.receiptNumber || ''}
                              onChange={ev => setEditingEntry({ ...editingEntry, receiptNumber: ev.target.value })}
                              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                          </label>
                        </>
                      )}
                      <label className="text-xs text-slate-600 col-span-2">
                        Reason for change
                        <input value={editingEntry._reason || ''}
                          onChange={ev => setEditingEntry({ ...editingEntry, _reason: ev.target.value })}
                          placeholder="e.g. Wrong amount entered, correcting month…"
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setEditingEntry(null)}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                      <button type="submit" disabled={entrySaving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                        {entrySaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
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

      {/* Photo cropper — appears when a file is picked, before upload */}
      {pendingPhoto && (
        <PhotoCropper
          file={pendingPhoto}
          aspect={3 / 4}
          outputW={600}
          onCancel={() => setPendingPhoto(null)}
          onConfirm={handleCroppedPhoto}
        />
      )}

      {/* ID Card Modal — uses the active Student ID template from Settings */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">ID Card Preview</p>
                <p className="text-[11px] text-slate-500">
                  {idTemplate ? <>Template: <strong>{idTemplate.name}</strong></> : 'No template configured — using defaults'}
                </p>
              </div>
              <button onClick={() => setShowQR(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            <div className="p-5 bg-slate-50 flex justify-center overflow-auto max-h-[60vh]">
              {idCardHtml ? (
                <iframe
                  title="id-card-preview"
                  srcDoc={idCardHtml}
                  style={{ width: 240, height: 380, border: 'none', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
              ) : (
                <p className="text-sm text-slate-400 py-8">Generating preview…</p>
              )}
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button onClick={async () => {
                if (!student) return;
                const { printIdCards } = await import('@/lib/idCardHtml');
                await printIdCards([student], idTemplate, true, schoolLogo);
              }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                <Printer className="h-4 w-4" /> Print ID Card
              </button>
              <button onClick={() => setShowQR(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm">
                Close
              </button>
            </div>
            <div className="px-5 pb-3 text-[11px] text-slate-400 text-center">
              Change the design at <strong>Settings → Print Templates</strong>
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
