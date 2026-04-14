'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { Plus, CreditCard, Receipt, Search, Users, IndianRupee, Printer, X, BookOpen, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

const FEE_TYPES = ['TUITION', 'TRANSPORT', 'ANNUAL', 'LAB', 'SPORTS', 'LIBRARY', 'MISC', 'FINE'];
const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'DD'];

export default function FeesPage() {
  const [fees, setFees] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'collect' | 'structures' | 'payments'>('collect');
  const [showForm, setShowForm] = useState(false);

  // Fee structure form
  const [form, setForm] = useState({
    name: '', classId: '', feeType: 'TUITION', amount: '', frequency: 'MONTHLY',
    dueDate: '', academicYear: '2025-2026', description: '', isOptional: false,
  });

  // ─── Collection state ───
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]); // students to collect from
  const [studentLedgers, setStudentLedgers] = useState<Record<string, any>>({}); // ledger data per student
  const [siblingPrompt, setSiblingPrompt] = useState<{ student: any; siblings: any[] } | null>(null); // sibling detection prompt
  const [perStudentAmounts, setPerStudentAmounts] = useState<Record<string, string>>({}); // per-student custom amounts
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [receivedBy, setReceivedBy] = useState('');
  const [depositMonth, setDepositMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [submitting, setSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [combinedLedger, setCombinedLedger] = useState<any>(null); // combined family ledger
  const [showCombinedLedger, setShowCombinedLedger] = useState(false);
  const [addLateFee, setAddLateFee] = useState(false);
  const [lateFeeAmount, setLateFeeAmount] = useState('');
  const [lateFeePerStudent, setLateFeePerStudent] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      api.get('/fees').then(r => setFees(r.data)),
      api.get('/classes').then(r => setClasses(r.data)),
      api.get('/fees/payments').then(r => setPayments(r.data)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Load students when class selected
  useEffect(() => {
    if (!selectedClassId) { setClassStudents([]); return; }
    api.get('/students', { params: { classId: selectedClassId } }).then(r => setClassStudents(r.data)).catch(() => setClassStudents([]));
  }, [selectedClassId]);

  // Fetch combined family ledger when multiple students selected
  useEffect(() => {
    if (selectedStudents.length < 2) {
      setCombinedLedger(null);
      setShowCombinedLedger(false);
      return;
    }
    // Use first student's family endpoint to get combined view
    const firstWithFamily = selectedStudents.find(s => studentLedgers[s.id]?.student?.familyId);
    if (firstWithFamily) {
      api.get(`/fees/ledger/${firstWithFamily.id}?family=true`)
        .then(r => setCombinedLedger(r.data))
        .catch(() => setCombinedLedger(null));
    } else {
      // No family link — merge individual ledgers client-side
      mergeLedgers();
    }
  }, [selectedStudents.length]);

  const mergeLedgers = () => {
    if (selectedStudents.length < 2) return;
    const allEntries: any[] = [];
    const names: any[] = [];
    for (const s of selectedStudents) {
      const ledger = studentLedgers[s.id];
      if (!ledger) continue;
      names.push({ id: s.id, name: `${s.user.firstName} ${s.user.lastName}`, class: s.class?.name, admissionNo: s.admissionNo });
      for (const entry of (ledger.entries || [])) {
        allEntries.push(entry);
      }
    }
    // Sort chronologically
    allEntries.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Build monthly summary
    const monthMap = new Map<string, any>();
    let runningBalance = 0;
    for (const entry of allEntries) {
      const month = entry.month;
      if (!monthMap.has(month)) {
        monthMap.set(month, { month, monthlyFee: 0, otherCharges: 0, otherDetails: [], totalDue: 0, deposited: 0, balance: 0, depositDates: [], depositMethods: [], receiptNumbers: [], students: new Set() });
      }
      const row = monthMap.get(month)!;
      row.students.add(entry.studentId);
      if (entry.type === 'CHARGE') {
        if (entry.category === 'MONTHLY_FEE') row.monthlyFee += entry.amount;
        else { row.otherCharges += entry.amount; row.otherDetails.push(`${entry.description}: ₹${entry.amount}`); }
        runningBalance += entry.amount;
      } else if (entry.type === 'DEPOSIT') {
        row.deposited += entry.amount;
        if (entry.date) row.depositDates.push(entry.date);
        if (entry.paymentMethod) row.depositMethods.push(entry.paymentMethod);
        if (entry.receiptNumber) row.receiptNumbers.push(entry.receiptNumber);
        runningBalance -= entry.amount;
      }
      row.totalDue = runningBalance + row.deposited;
      row.balance = runningBalance;
    }
    const ledgerRows = Array.from(monthMap.values()).map(r => ({ ...r, students: Array.from(r.students) }));
    const totals = {
      totalMonthlyFees: ledgerRows.reduce((s, r) => s + r.monthlyFee, 0),
      totalOtherCharges: ledgerRows.reduce((s, r) => s + r.otherCharges, 0),
      totalCharged: 0,
      totalDeposited: ledgerRows.reduce((s, r) => s + r.deposited, 0),
    };
    totals.totalCharged = totals.totalMonthlyFees + totals.totalOtherCharges;
    setCombinedLedger({ siblings: names, currentBalance: runningBalance, totals, ledger: ledgerRows });
  };

  // Search students
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const { data } = await api.get('/students', { params: { search: searchQuery } });
      setSearchResults(data);
    } catch { setSearchResults([]); }
  };

  // Add student — check for siblings first
  const addStudent = async (student: any) => {
    if (selectedStudents.find(s => s.id === student.id)) return;
    setSearchResults([]);
    setSearchQuery('');

    // Load ledger to check for siblings
    try {
      const { data } = await api.get(`/fees/ledger/${student.id}?family=true`);
      setStudentLedgers(prev => ({ ...prev, [student.id]: data }));

      // If has siblings, show prompt instead of auto-adding
      const otherSiblings = (data.siblings || []).filter((s: any) => s.id !== student.id && !selectedStudents.find((ss: any) => ss.id === s.id));
      if (otherSiblings.length > 0) {
        setSiblingPrompt({ student, siblings: otherSiblings });
        setSelectedStudents(prev => [...prev, student]);
        return;
      }
    } catch {}

    setSelectedStudents(prev => [...prev, student]);
  };

  // Add a sibling from the prompt
  const addSibling = async (sib: any) => {
    try {
      const { data } = await api.get(`/fees/ledger/${sib.id}?family=false`);
      setStudentLedgers(prev => ({ ...prev, [sib.id]: data }));
      const sibStudent = { id: sib.id, user: { firstName: sib.name.split(' ')[0], lastName: sib.name.split(' ').slice(1).join(' ') }, class: { name: sib.class }, admissionNo: sib.admissionNo || '', _isSibling: true };
      setSelectedStudents(prev => [...prev, sibStudent]);
    } catch {}
  };

  const addAllSiblings = async () => {
    if (!siblingPrompt) return;
    for (const sib of siblingPrompt.siblings) {
      await addSibling(sib);
    }
    setSiblingPrompt(null);
  };

  const removeStudent = (id: string) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== id));
    setStudentLedgers(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (siblingPrompt?.student?.id === id) setSiblingPrompt(null);
  };

  const totalBalance = selectedStudents.reduce((sum, s) => sum + (studentLedgers[s.id]?.currentBalance || 0), 0);
  const depositAmt = parseFloat(depositAmount) || 0;
  const customTotal = Object.values(perStudentAmounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const effectiveTotal = splitMode === 'custom' && selectedStudents.length > 1 ? customTotal : depositAmt;

  // Late fee computation
  const lateFeeAmt = parseFloat(lateFeeAmount) || 0;
  const totalLateFee = selectedStudents.length > 1
    ? selectedStudents.reduce((sum, s) => sum + (parseFloat(lateFeePerStudent[s.id]) || 0), 0)
    : lateFeeAmt;
  const grandTotal = effectiveTotal + totalLateFee;

  // Handle deposit — records to fee ledger for each student
  const handleCollect = async () => {
    if (selectedStudents.length === 0 || effectiveTotal <= 0) return;
    setSubmitting(true);

    try {
      const studentIds = selectedStudents.map(s => s.id);
      const isMultiple = selectedStudents.length > 1;

      // Step 1: Charge late fee if enabled
      let lateFeeCharged = 0;
      if (addLateFee && totalLateFee > 0) {
        if (isMultiple) {
          // Charge per-student late fees
          for (const s of selectedStudents) {
            const fee = parseFloat(lateFeePerStudent[s.id]) || 0;
            if (fee > 0) {
              await api.post('/fees/ledger/charge', {
                studentIds: [s.id],
                month: depositMonth,
                category: 'LATE_FEE',
                description: 'Late fee',
                amount: fee,
              });
              lateFeeCharged += fee;
            }
          }
        } else {
          // Single student late fee
          await api.post('/fees/ledger/charge', {
            studentIds,
            month: depositMonth,
            category: 'LATE_FEE',
            description: 'Late fee',
            amount: lateFeeAmt,
          });
          lateFeeCharged = lateFeeAmt;
        }
      }

      // Step 2: Record deposit
      const payload: any = {
        studentIds,
        month: depositMonth,
        amount: effectiveTotal,
        paymentMethod,
        receivedBy: receivedBy || undefined,
      };

      if (isMultiple && splitMode === 'custom') {
        payload.perStudentAmounts = {};
        for (const s of selectedStudents) {
          payload.perStudentAmounts[s.id] = parseFloat(perStudentAmounts[s.id]) || 0;
        }
        payload.splitEvenly = false;
      } else if (isMultiple) {
        payload.splitEvenly = true;
      }

      const { data } = await api.post('/fees/ledger/deposit', payload);

      setLastReceipt({
        ...data,
        students: selectedStudents,
        totalBalance,
        depositAmt: effectiveTotal,
        perStudentAmounts: splitMode === 'custom' ? { ...perStudentAmounts } : null,
        splitMode,
        lateFeeCharged,
        lateFeePerStudent: isMultiple ? { ...lateFeePerStudent } : null,
      });

      // Reset
      setSelectedStudents([]);
      setStudentLedgers({});
      setCombinedLedger(null);
      setShowCombinedLedger(false);
      setDepositAmount('');
      setPerStudentAmounts({});
      setSplitMode('equal');
      setReceivedBy('');
      setAddLateFee(false);
      setLateFeeAmount('');
      setLateFeePerStudent({});

      // Refresh payments
      const pRes = await api.get('/fees/payments');
      setPayments(pRes.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Payment failed');
    }
    setSubmitting(false);
  };

  const printReceipt = () => {
    if (!lastReceipt) return;
    const r = lastReceipt;
    const isCombined = r.students.length > 1;
    let studentRows = '';
    if (isCombined) {
      studentRows = `<table style="width:100%;border-collapse:collapse;margin:12px 0">
        <thead><tr><th style="background:#f1f5f9;padding:6px 12px;text-align:left;font-size:11px;color:#64748b">Student</th><th style="background:#f1f5f9;padding:6px 12px;text-align:left;font-size:11px;color:#64748b">Class</th><th style="background:#f1f5f9;padding:6px 12px;text-align:right;font-size:11px;color:#64748b">Amount</th></tr></thead>
        <tbody>${r.students.map((s: any) => {
          const amt = r.perStudentAmounts?.[s.id] ? parseFloat(r.perStudentAmounts[s.id]) : Math.round(r.depositAmt / r.students.length);
          return `<tr><td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #e2e8f0">${s.user.firstName} ${s.user.lastName}</td><td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #e2e8f0">${s.class?.name || ''}</td><td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold">₹${amt.toLocaleString('en-IN')}</td></tr>`;
        }).join('')}
        </tbody></table>`;
    }

    const html = `<!DOCTYPE html><html><head><title>Fee Receipt</title>
      <style>body{font-family:Arial;margin:20px;color:#1e293b}.header{text-align:center;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:16px}.school{font-size:20px;font-weight:bold;color:#1e40af}.info-table{width:100%;border-collapse:collapse;margin:12px 0}.info-table td{padding:6px 12px;font-size:13px;border-bottom:1px solid #e2e8f0}.total{font-size:20px;font-weight:bold;text-align:center;padding:14px;border:3px solid #16a34a;border-radius:8px;color:#16a34a;margin:16px 0}.combined{display:inline-block;background:#1e40af;color:white;padding:3px 12px;border-radius:4px;font-size:11px;font-weight:bold;margin-top:4px}@media print{body{margin:10px}}</style>
    </head><body>
      <div class="header">
        <div class="school">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
        <div style="font-size:13px;color:#64748b">Fee Receipt</div>
        ${isCombined ? '<div class="combined">COMBINED FAMILY RECEIPT</div>' : ''}
        <div style="font-size:12px;color:#64748b;margin-top:4px">Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
      <table class="info-table">
        ${!isCombined ? `<tr><td><strong>Student</strong></td><td>${r.students[0]?.user?.firstName} ${r.students[0]?.user?.lastName}</td></tr>` : ''}
        ${!isCombined ? `<tr><td><strong>Class</strong></td><td>${r.students[0]?.class?.name || ''}</td></tr>` : ''}
        <tr><td><strong>Receipt No.</strong></td><td style="color:#1e40af;font-weight:bold">${r.receipt || '—'}</td></tr>
        <tr><td><strong>Payment Method</strong></td><td>${paymentMethod}</td></tr>
        ${receivedBy ? `<tr><td><strong>Received By</strong></td><td>${receivedBy}</td></tr>` : ''}
      </table>
      ${studentRows}
      ${r.lateFeeCharged > 0 ? `
        <table class="info-table" style="margin:8px 0">
          <tr><td style="color:#92400e"><strong>Late Fee</strong></td><td style="text-align:right;color:#92400e;font-weight:bold">₹${r.lateFeeCharged.toLocaleString('en-IN')}</td></tr>
          <tr><td><strong>Fee Deposited</strong></td><td style="text-align:right;font-weight:bold">₹${r.depositAmt.toLocaleString('en-IN')}</td></tr>
          <tr style="background:#f1f5f9"><td><strong>Total Collected</strong></td><td style="text-align:right;font-weight:bold;font-size:16px">₹${(r.depositAmt + r.lateFeeCharged).toLocaleString('en-IN')}</td></tr>
        </table>
      ` : ''}
      <div class="total">Amount Paid: ₹${(r.depositAmt + (r.lateFeeCharged || 0)).toLocaleString('en-IN')}</div>
      <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:12px">
        <div style="border-top:1px solid #000;width:180px;text-align:center;padding-top:4px">Parent Signature</div>
        <div style="border-top:1px solid #000;width:180px;text-align:center;padding-top:4px">Accountant</div>
      </div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const printCombinedLedger = () => {
    if (!combinedLedger) return;
    const cl = combinedLedger;
    const siblings = cl.siblings || selectedStudents.map((s: any) => ({ name: `${s.user.firstName} ${s.user.lastName}`, class: s.class?.name, admissionNo: s.admissionNo }));
    const siblingRows = siblings.map((s: any) => `<tr><td style="padding:4px 10px;font-size:12px;border-bottom:1px solid #e2e8f0">${s.name}</td><td style="padding:4px 10px;font-size:12px;border-bottom:1px solid #e2e8f0">${s.class || ''}</td><td style="padding:4px 10px;font-size:12px;border-bottom:1px solid #e2e8f0">${s.admissionNo || ''}</td></tr>`).join('');
    const ledgerRows = (cl.ledger || []).map((row: any) => {
      const charged = row.monthlyFee + row.otherCharges;
      const monthLabel = new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      return `<tr>
        <td style="padding:6px 10px;font-size:12px;border:1px solid #cbd5e1">${monthLabel}</td>
        <td style="padding:6px 10px;font-size:12px;border:1px solid #cbd5e1;text-align:right">${row.monthlyFee > 0 ? '₹' + row.monthlyFee.toLocaleString('en-IN') : '—'}</td>
        <td style="padding:6px 10px;font-size:12px;border:1px solid #cbd5e1;text-align:right">${row.otherCharges > 0 ? '₹' + row.otherCharges.toLocaleString('en-IN') : '—'}</td>
        <td style="padding:6px 10px;font-size:12px;border:1px solid #cbd5e1;text-align:right;font-weight:bold">₹${charged.toLocaleString('en-IN')}</td>
        <td style="padding:6px 10px;font-size:12px;border:1px solid #cbd5e1;text-align:right;color:#16a34a">${row.deposited > 0 ? '₹' + row.deposited.toLocaleString('en-IN') : '—'}</td>
        <td style="padding:6px 10px;font-size:12px;border:1px solid #cbd5e1;text-align:right;font-weight:bold;color:${row.balance > 0 ? '#dc2626' : '#16a34a'}">₹${row.balance.toLocaleString('en-IN')}</td>
        <td style="padding:6px 10px;font-size:12px;border:1px solid #cbd5e1">${row.depositDates?.length > 0 ? new Date(row.depositDates[0]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}</td>
      </tr>`;
    }).join('');
    const t = cl.totals || {};
    const html = `<!DOCTYPE html><html><head><title>Combined Fee Ledger</title>
      <style>body{font-family:Arial;margin:20px;color:#1e293b}@media print{body{margin:10px}}</style>
    </head><body>
      <div style="text-align:center;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:16px">
        <div style="font-size:20px;font-weight:bold;color:#1e40af">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
        <div style="font-size:14px;color:#64748b;margin-top:4px">Combined Family Fee Ledger</div>
        <div style="display:inline-block;background:#1e40af;color:white;padding:3px 12px;border-radius:4px;font-size:11px;font-weight:bold;margin-top:6px">${siblings.length} STUDENTS</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr><th style="background:#f1f5f9;padding:4px 10px;text-align:left;font-size:11px;color:#64748b">Student</th><th style="background:#f1f5f9;padding:4px 10px;text-align:left;font-size:11px;color:#64748b">Class</th><th style="background:#f1f5f9;padding:4px 10px;text-align:left;font-size:11px;color:#64748b">Adm. No.</th></tr></thead>
        <tbody>${siblingRows}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr>
          <th style="background:#1e293b;color:white;padding:8px 10px;font-size:11px;text-align:left;border:1px solid #334155">Month</th>
          <th style="background:#1e293b;color:white;padding:8px 10px;font-size:11px;text-align:right;border:1px solid #334155">Monthly Fee</th>
          <th style="background:#1e293b;color:white;padding:8px 10px;font-size:11px;text-align:right;border:1px solid #334155">Other</th>
          <th style="background:#1e293b;color:white;padding:8px 10px;font-size:11px;text-align:right;border:1px solid #334155">Total</th>
          <th style="background:#1e293b;color:white;padding:8px 10px;font-size:11px;text-align:right;border:1px solid #334155">Deposited</th>
          <th style="background:#1e293b;color:white;padding:8px 10px;font-size:11px;text-align:right;border:1px solid #334155">Balance</th>
          <th style="background:#1e293b;color:white;padding:8px 10px;font-size:11px;text-align:left;border:1px solid #334155">Date</th>
        </tr></thead>
        <tbody>${ledgerRows}
          <tr style="background:#f1f5f9;font-weight:bold">
            <td style="padding:8px 10px;font-size:12px;border:1px solid #cbd5e1">TOTAL</td>
            <td style="padding:8px 10px;font-size:12px;border:1px solid #cbd5e1;text-align:right">₹${(t.totalMonthlyFees || 0).toLocaleString('en-IN')}</td>
            <td style="padding:8px 10px;font-size:12px;border:1px solid #cbd5e1;text-align:right">₹${(t.totalOtherCharges || 0).toLocaleString('en-IN')}</td>
            <td style="padding:8px 10px;font-size:12px;border:1px solid #cbd5e1;text-align:right">₹${(t.totalCharged || 0).toLocaleString('en-IN')}</td>
            <td style="padding:8px 10px;font-size:12px;border:1px solid #cbd5e1;text-align:right;color:#16a34a">₹${(t.totalDeposited || 0).toLocaleString('en-IN')}</td>
            <td style="padding:8px 10px;font-size:12px;border:1px solid #cbd5e1;text-align:right;font-weight:bold;color:${(cl.currentBalance || 0) > 0 ? '#dc2626' : '#16a34a'}">₹${(cl.currentBalance || 0).toLocaleString('en-IN')}</td>
            <td style="padding:8px 10px;border:1px solid #cbd5e1"></td>
          </tr>
        </tbody>
      </table>
      <div style="text-align:center;padding:14px;border:3px solid ${(cl.currentBalance || 0) > 0 ? '#dc2626' : '#16a34a'};border-radius:8px;font-size:18px;font-weight:bold;color:${(cl.currentBalance || 0) > 0 ? '#dc2626' : '#16a34a'}">
        Balance: ₹${(cl.currentBalance || 0).toLocaleString('en-IN')} ${(cl.currentBalance || 0) > 0 ? '(Dues Pending)' : '(Cleared)'}
      </div>
      <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:12px">
        <div style="border-top:1px solid #000;width:180px;text-align:center;padding-top:4px">Parent Signature</div>
        <div style="border-top:1px solid #000;width:180px;text-align:center;padding-top:4px">Accountant</div>
      </div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const handleCreateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/fees', { ...form, amount: parseFloat(form.amount), isOptional: form.isOptional });
      setShowForm(false);
      setForm({ name: '', classId: '', feeType: 'TUITION', amount: '', frequency: 'MONTHLY', dueDate: '', academicYear: '2025-2026', description: '', isOptional: false });
      const r = await api.get('/fees');
      setFees(r.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed');
    }
  };

  const feeTypeColors: Record<string, string> = {
    TUITION: 'bg-blue-100 text-blue-700', TRANSPORT: 'bg-green-100 text-green-700',
    ANNUAL: 'bg-purple-100 text-purple-700', LAB: 'bg-orange-100 text-orange-700',
    SPORTS: 'bg-teal-100 text-teal-700', LIBRARY: 'bg-indigo-100 text-indigo-700',
    MISC: 'bg-slate-100 text-slate-700', FINE: 'bg-red-100 text-red-700',
  };
  const statusColors: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700', PENDING: 'bg-yellow-100 text-yellow-700',
    OVERDUE: 'bg-red-100 text-red-700', CLEARING: 'bg-blue-100 text-blue-700', FAILED: 'bg-red-100 text-red-700',
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          <FadeIn>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-slate-900">Fee Management</h1>
              <Button onClick={() => setShowForm(!showForm)} variant="outline">
                <Plus className="h-4 w-4" /> Add Fee Structure
              </Button>
            </div>
          </FadeIn>

          {/* Tabs */}
          <FadeIn delay={0.05}>
            <div className="flex gap-1 border-b border-slate-200">
              {[
                { id: 'collect', l: 'Collect Fees', icon: CreditCard },
                { id: 'structures', l: 'Fee Structures', icon: Receipt },
                { id: 'payments', l: 'Payment History', icon: IndianRupee },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id as any)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  <t.icon className="h-4 w-4" />{t.l}
                </button>
              ))}
            </div>
          </FadeIn>

          {/* ─── COLLECT FEES TAB ─── */}
          {tab === 'collect' && (
            <FadeIn delay={0.1}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Search + Student selection */}
                <div className="lg:col-span-2 space-y-4">

                  {/* Class cards */}
                  <div className="flex gap-2 flex-wrap">
                    {classes.map((cls: any, i: number) => {
                      const colors = ['bg-blue-600', 'bg-indigo-600', 'bg-purple-600', 'bg-violet-600', 'bg-fuchsia-600', 'bg-pink-600', 'bg-rose-600', 'bg-orange-600', 'bg-amber-600', 'bg-teal-600'];
                      const isSelected = selectedClassId === cls.id;
                      return (
                        <button key={cls.id} onClick={() => setSelectedClassId(isSelected ? '' : cls.id)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isSelected ? colors[i % colors.length] + ' text-white shadow-lg scale-105' : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400'}`}>
                          {cls.name}
                          <span className={`ml-1.5 text-xs ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>({cls._count?.students || 0})</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Students in selected class */}
                  {selectedClassId && classStudents.length > 0 && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{classes.find((c: any) => c.id === selectedClassId)?.name} — click to add</p>
                        <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto">
                          {classStudents.map((s: any) => {
                            const alreadyAdded = selectedStudents.find(ss => ss.id === s.id);
                            return (
                              <button key={s.id} onClick={() => !alreadyAdded && addStudent(s)} disabled={!!alreadyAdded}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${alreadyAdded ? 'bg-green-100 text-green-700 cursor-default' : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700'}`}>
                                {s.user.firstName} {s.user.lastName}
                                <span className="text-slate-400 ml-1">({s.admissionNo})</span>
                                {alreadyAdded && <span className="ml-1">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Receipt success */}
                  {lastReceipt && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-green-800">Payment Recorded!</p>
                          <p className="text-xs text-green-600">Receipt: {lastReceipt.receipt}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={printReceipt}><Printer className="h-3.5 w-3.5" /> Print</Button>
                          <button onClick={() => setLastReceipt(null)} className="text-green-400 hover:text-green-600"><X className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Search */}
                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-sm font-semibold text-slate-700 mb-3">Search Student</p>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input placeholder="Search by name or admission no..." value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <Button onClick={handleSearch} variant="outline">Search</Button>
                      </div>
                      {/* Search results */}
                      {searchResults.length > 0 && (
                        <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                          {searchResults.map((s: any) => (
                            <button key={s.id} onClick={() => addStudent(s)}
                              className="w-full flex items-center justify-between bg-slate-50 hover:bg-blue-50 rounded-lg px-3 py-2 text-left transition">
                              <div>
                                <span className="text-sm font-medium text-slate-900">{s.user.firstName} {s.user.lastName}</span>
                                <span className="text-xs text-slate-400 ml-2">{s.admissionNo} | {s.class?.name}</span>
                              </div>
                              <Badge variant="default">Add</Badge>
                            </button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Selected students with ledger */}
                  {selectedStudents.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4 text-blue-600" />
                            {selectedStudents.length === 1 ? 'Student' : `${selectedStudents.length} Students (Combined)`}
                          </CardTitle>
                          {selectedStudents.length > 1 && (
                            <Badge variant="success" className="text-xs">Family / Combined Receipt</Badge>
                          )}
                        </div>
                      </CardHeader>

                      {/* Sibling detection prompt */}
                      {siblingPrompt && (
                        <div className="mx-6 mb-3 bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Users className="h-5 w-5 text-amber-600" />
                            <p className="text-sm font-bold text-amber-800">Sibling(s) found!</p>
                          </div>
                          <p className="text-xs text-amber-700 mb-3">
                            {siblingPrompt.student.user.firstName} has {siblingPrompt.siblings.length} sibling(s). Want to collect fees together?
                          </p>
                          <div className="space-y-2 mb-3">
                            {siblingPrompt.siblings.map((sib: any) => {
                              const alreadyAdded = selectedStudents.find(s => s.id === sib.id);
                              return (
                                <div key={sib.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-200">
                                  <div>
                                    <span className="text-sm font-medium text-slate-900">{sib.name}</span>
                                    <span className="text-xs text-slate-500 ml-2">{sib.class} {sib.admissionNo ? `| ${sib.admissionNo}` : ''}</span>
                                  </div>
                                  {alreadyAdded ? (
                                    <Badge variant="success" className="text-xs">Added</Badge>
                                  ) : (
                                    <Button size="sm" variant="warning" onClick={() => addSibling(sib)}>Add</Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="success" onClick={addAllSiblings}>
                              <Users className="h-3.5 w-3.5" /> Add All & Collect Together
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setSiblingPrompt(null)}>
                              Skip — collect only for {siblingPrompt.student.user.firstName}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Combined balance banner for siblings */}
                      {selectedStudents.length > 1 && (
                        <div className="mx-6 mb-3 bg-blue-900 rounded-xl p-4 flex items-center justify-between text-white">
                          <div>
                            <p className="text-xs text-blue-300">Combined Balance ({selectedStudents.length} students)</p>
                            <p className="text-2xl font-black">{formatCurrency(totalBalance)}</p>
                          </div>
                          <div className="text-right space-y-1">
                            {selectedStudents.map(s => (
                              <div key={s.id} className="text-xs text-blue-200">
                                {s.user.firstName}: {formatCurrency(studentLedgers[s.id]?.currentBalance || 0)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <CardContent className="space-y-3">
                        {selectedStudents.map(s => {
                          const ledger = studentLedgers[s.id];
                          const balance = ledger?.currentBalance || 0;
                          return (
                            <div key={s.id} className="bg-slate-50 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                    {s.user.firstName[0]}{s.user.lastName?.[0] || ''}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">{s.user.firstName} {s.user.lastName}</p>
                                    <p className="text-xs text-slate-500">{s.class?.name} | {s.admissionNo}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${balance > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {formatCurrency(balance)}
                                  </span>
                                  <button onClick={() => removeStudent(s.id)} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                                </div>
                              </div>
                              {/* Mini ledger */}
                              {ledger?.ledger?.length > 0 && (
                                <div className="max-h-28 overflow-y-auto mt-2">
                                  <table className="w-full text-[11px]">
                                    <thead className="sticky top-0 bg-slate-100">
                                      <tr>
                                        <th className="text-left px-2 py-1 text-slate-500">Month</th>
                                        <th className="text-right px-2 py-1 text-slate-500">Charged</th>
                                        <th className="text-right px-2 py-1 text-slate-500">Paid</th>
                                        <th className="text-right px-2 py-1 text-slate-500">Balance</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ledger.ledger.slice(-6).map((row: any) => (
                                        <tr key={row.month} className="border-t border-slate-100">
                                          <td className="px-2 py-1 text-slate-600">{new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</td>
                                          <td className="px-2 py-1 text-right text-slate-700">{formatCurrency(row.monthlyFee + row.otherCharges)}</td>
                                          <td className="px-2 py-1 text-right text-green-600">{row.deposited > 0 ? formatCurrency(row.deposited) : '—'}</td>
                                          <td className={`px-2 py-1 text-right font-bold ${row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(row.balance)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  {/* ─── Combined Family Ledger ─── */}
                  {selectedStudents.length > 1 && combinedLedger && (
                    <Card className="border-blue-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-600" />
                            Combined Family Ledger
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={printCombinedLedger}>
                              <Printer className="h-3.5 w-3.5" /> Print
                            </Button>
                            <button onClick={() => setShowCombinedLedger(!showCombinedLedger)}
                              className="text-slate-400 hover:text-slate-600">
                              {showCombinedLedger ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        {/* Siblings bar */}
                        <div className="flex gap-2 flex-wrap mt-2">
                          {(combinedLedger.siblings || selectedStudents.map((s: any) => ({ name: `${s.user.firstName} ${s.user.lastName}`, class: s.class?.name }))).map((sib: any, i: number) => (
                            <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                              {sib.name} — {sib.class} {sib.admissionNo ? `(${sib.admissionNo})` : ''}
                            </span>
                          ))}
                        </div>
                        {/* Balance summary */}
                        <div className="flex items-center gap-4 mt-2">
                          <div className="text-xs text-slate-500">
                            Charged: <span className="font-bold text-slate-700">{formatCurrency(combinedLedger.totals?.totalCharged || 0)}</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            Deposited: <span className="font-bold text-green-600">{formatCurrency(combinedLedger.totals?.totalDeposited || 0)}</span>
                          </div>
                          <div className={`text-xs px-2 py-0.5 rounded-full font-bold ${(combinedLedger.currentBalance || 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            Balance: {formatCurrency(combinedLedger.currentBalance || 0)}
                          </div>
                        </div>
                      </CardHeader>

                      {showCombinedLedger && (
                        <CardContent className="pt-0">
                          <div className="max-h-72 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 bg-slate-800 text-white">
                                <tr>
                                  <th className="text-left px-3 py-2">Month</th>
                                  <th className="text-right px-3 py-2">Monthly Fee</th>
                                  <th className="text-right px-3 py-2">Other</th>
                                  <th className="text-right px-3 py-2">Total Due</th>
                                  <th className="text-right px-3 py-2">Deposited</th>
                                  <th className="text-right px-3 py-2">Balance</th>
                                  <th className="text-left px-3 py-2">Date/Sign</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(combinedLedger.ledger || []).map((row: any) => {
                                  const charged = row.monthlyFee + row.otherCharges;
                                  return (
                                    <tr key={row.month} className="border-t border-slate-100 hover:bg-slate-50">
                                      <td className="px-3 py-2 text-slate-700 font-medium">
                                        {new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                                      </td>
                                      <td className="px-3 py-2 text-right text-slate-600">{row.monthlyFee > 0 ? formatCurrency(row.monthlyFee) : '—'}</td>
                                      <td className="px-3 py-2 text-right text-slate-600">
                                        {row.otherCharges > 0 ? (
                                          <span title={row.otherDetails?.join(', ')}>{formatCurrency(row.otherCharges)}</span>
                                        ) : '—'}
                                      </td>
                                      <td className="px-3 py-2 text-right font-bold text-slate-800">{formatCurrency(charged)}</td>
                                      <td className="px-3 py-2 text-right text-green-600 font-medium">{row.deposited > 0 ? formatCurrency(row.deposited) : '—'}</td>
                                      <td className={`px-3 py-2 text-right font-bold ${row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatCurrency(row.balance)}
                                      </td>
                                      <td className="px-3 py-2 text-slate-400">
                                        {row.depositDates?.length > 0 ? new Date(row.depositDates[0]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* Totals row */}
                                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                  <td className="px-3 py-2 text-slate-800">TOTAL</td>
                                  <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(combinedLedger.totals?.totalMonthlyFees || 0)}</td>
                                  <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(combinedLedger.totals?.totalOtherCharges || 0)}</td>
                                  <td className="px-3 py-2 text-right text-slate-800">{formatCurrency(combinedLedger.totals?.totalCharged || 0)}</td>
                                  <td className="px-3 py-2 text-right text-green-600">{formatCurrency(combinedLedger.totals?.totalDeposited || 0)}</td>
                                  <td className={`px-3 py-2 text-right ${(combinedLedger.currentBalance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(combinedLedger.currentBalance || 0)}
                                  </td>
                                  <td className="px-3 py-2"></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  )}
                </div>

                {/* Right: Payment panel */}
                <div className="space-y-4">
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-green-800 flex items-center gap-2">
                        <IndianRupee className="h-4 w-4" /> Payment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Summary */}
                      {selectedStudents.length > 0 && (
                        <div className="bg-white rounded-xl p-4 space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-slate-500">Students</span><span className="font-medium">{selectedStudents.length}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Total Outstanding</span><span className="font-bold text-red-600">{formatCurrency(totalBalance)}</span></div>
                          <hr className="border-slate-200" />
                          {/* Quick amount buttons */}
                          <div>
                            <p className="text-xs text-slate-400 mb-2">Quick amounts</p>
                            <div className="flex flex-wrap gap-1.5">
                              {[1000, 2000, 3000, 5000].map(amt => (
                                <button key={amt} onClick={() => setDepositAmount(String(amt))}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${depositAmt === amt ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                  {formatCurrency(amt)}
                                </button>
                              ))}
                              {totalBalance > 0 && (
                                <button onClick={() => setDepositAmount(String(totalBalance))}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${depositAmt === totalBalance ? 'bg-green-600 text-white' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                                  Full: {formatCurrency(totalBalance)}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Split mode toggle (only for multiple students) */}
                      {selectedStudents.length > 1 && (
                        <div>
                          <label className="text-xs font-medium text-green-700 mb-1 block">Split Mode</label>
                          <div className="flex gap-1 bg-green-100 rounded-xl p-1">
                            <button onClick={() => setSplitMode('equal')}
                              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${splitMode === 'equal' ? 'bg-white text-green-800 shadow-sm' : 'text-green-600'}`}>
                              Equal Split
                            </button>
                            <button onClick={() => setSplitMode('custom')}
                              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${splitMode === 'custom' ? 'bg-white text-green-800 shadow-sm' : 'text-green-600'}`}>
                              Custom per Student
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Amount input — equal mode or single student */}
                      {(splitMode === 'equal' || selectedStudents.length <= 1) && (
                        <div>
                          <label className="text-xs font-medium text-green-700">{selectedStudents.length > 1 ? 'Total Amount (₹) — split equally' : 'Amount (₹)'}</label>
                          <input type="number" placeholder="Enter amount" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                            className="w-full px-3 py-3 border border-green-300 rounded-xl text-lg font-bold text-slate-900 text-center focus:ring-2 focus:ring-green-500 outline-none mt-1" />
                          {splitMode === 'equal' && selectedStudents.length > 1 && depositAmt > 0 && (
                            <p className="text-xs text-green-600 mt-1 text-center">{formatCurrency(Math.round(depositAmt / selectedStudents.length))} per student</p>
                          )}
                        </div>
                      )}

                      {/* Per-student amounts — custom mode */}
                      {splitMode === 'custom' && selectedStudents.length > 1 && (
                        <div>
                          <label className="text-xs font-medium text-green-700 mb-2 block">Amount per Student</label>
                          <div className="space-y-2">
                            {selectedStudents.map(s => {
                              const bal = studentLedgers[s.id]?.currentBalance || 0;
                              return (
                                <div key={s.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-green-200">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-900 truncate">{s.user.firstName} {s.user.lastName}</p>
                                    <p className="text-[10px] text-slate-400">Bal: {formatCurrency(bal)}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-slate-400">₹</span>
                                    <input type="number" placeholder="0"
                                      value={perStudentAmounts[s.id] || ''}
                                      onChange={e => setPerStudentAmounts(prev => ({ ...prev, [s.id]: e.target.value }))}
                                      className="w-20 px-2 py-1.5 border border-green-300 rounded-lg text-sm font-bold text-slate-900 text-right" />
                                  </div>
                                  {bal > 0 && (
                                    <button onClick={() => setPerStudentAmounts(prev => ({ ...prev, [s.id]: String(bal) }))}
                                      className="text-[9px] text-red-500 hover:text-red-700 whitespace-nowrap">Full</button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between mt-2 text-sm font-bold">
                            <span className="text-green-700">Total</span>
                            <span className="text-green-800">{formatCurrency(customTotal)}</span>
                          </div>
                        </div>
                      )}

                      {/* Month */}
                      <div>
                        <label className="text-xs font-medium text-green-700">Month</label>
                        <input type="month" value={depositMonth} onChange={e => setDepositMonth(e.target.value)}
                          className="w-full px-3 py-2 border border-green-300 rounded-xl text-sm text-slate-900 mt-1" />
                      </div>

                      {/* Payment method */}
                      <div>
                        <label className="text-xs font-medium text-green-700">Payment Method</label>
                        <div className="grid grid-cols-3 gap-1.5 mt-1">
                          {PAYMENT_METHODS.map(m => (
                            <button key={m} onClick={() => setPaymentMethod(m)}
                              className={`px-2 py-2 rounded-lg text-xs font-medium transition ${paymentMethod === m ? 'bg-green-600 text-white' : 'bg-white border border-green-200 text-slate-600 hover:border-green-400'}`}>
                              {m.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Received by */}
                      <div>
                        <label className="text-xs font-medium text-green-700">Received By</label>
                        <input placeholder="Name" value={receivedBy} onChange={e => setReceivedBy(e.target.value)}
                          className="w-full px-3 py-2 border border-green-300 rounded-xl text-sm text-slate-900 mt-1" />
                      </div>

                      {/* Late fee option */}
                      {selectedStudents.length > 0 && totalBalance > 0 && (
                        <div className={`rounded-xl border-2 transition-all ${addLateFee ? 'border-amber-400 bg-amber-50' : 'border-dashed border-slate-200 bg-white'}`}>
                          <button onClick={() => { setAddLateFee(!addLateFee); if (addLateFee) { setLateFeeAmount(''); setLateFeePerStudent({}); } }}
                            className="w-full flex items-center justify-between px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className={`h-4 w-4 ${addLateFee ? 'text-amber-600' : 'text-slate-400'}`} />
                              <span className={`text-xs font-medium ${addLateFee ? 'text-amber-800' : 'text-slate-500'}`}>Add Late Fee</span>
                            </div>
                            <div className={`w-8 h-4.5 rounded-full transition-colors ${addLateFee ? 'bg-amber-500' : 'bg-slate-200'} relative`}>
                              <div className={`w-3.5 h-3.5 rounded-full bg-white shadow absolute top-[2px] transition-all ${addLateFee ? 'right-[2px]' : 'left-[2px]'}`} />
                            </div>
                          </button>
                          {addLateFee && (
                            <div className="px-3 pb-3 space-y-2">
                              {selectedStudents.length === 1 ? (
                                <div>
                                  <div className="flex gap-1.5 mb-1.5">
                                    {[50, 100, 200, 500].map(amt => (
                                      <button key={amt} onClick={() => setLateFeeAmount(String(amt))}
                                        className={`px-2 py-1 rounded text-[10px] font-medium transition ${lateFeeAmt === amt ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                                        ₹{amt}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-amber-600">₹</span>
                                    <input type="number" placeholder="Late fee amount" value={lateFeeAmount}
                                      onChange={e => setLateFeeAmount(e.target.value)}
                                      className="flex-1 px-2 py-1.5 border border-amber-300 rounded-lg text-sm font-bold text-slate-900 text-right focus:ring-2 focus:ring-amber-400 outline-none" />
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex gap-1.5 mb-1">
                                    <p className="text-[10px] text-amber-600 flex-1">Apply to all:</p>
                                    {[50, 100, 200].map(amt => (
                                      <button key={amt} onClick={() => {
                                        const obj: Record<string, string> = {};
                                        selectedStudents.forEach(s => { obj[s.id] = String(amt); });
                                        setLateFeePerStudent(obj);
                                      }}
                                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition">
                                        ₹{amt} each
                                      </button>
                                    ))}
                                  </div>
                                  {selectedStudents.map(s => (
                                    <div key={s.id} className="flex items-center gap-2">
                                      <span className="text-[10px] text-amber-700 flex-1 truncate">{s.user.firstName}</span>
                                      <span className="text-[10px] text-amber-500">₹</span>
                                      <input type="number" placeholder="0"
                                        value={lateFeePerStudent[s.id] || ''}
                                        onChange={e => setLateFeePerStudent(prev => ({ ...prev, [s.id]: e.target.value }))}
                                        className="w-16 px-2 py-1 border border-amber-300 rounded text-xs font-bold text-slate-900 text-right" />
                                    </div>
                                  ))}
                                  <div className="flex justify-between text-xs font-bold text-amber-800 pt-1 border-t border-amber-200">
                                    <span>Total Late Fee</span>
                                    <span>{formatCurrency(totalLateFee)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Payment summary */}
                      {effectiveTotal > 0 && selectedStudents.length > 0 && (
                        <div className="bg-white rounded-xl p-3 text-sm space-y-1.5">
                          {selectedStudents.length > 1 && (
                            <>
                              <div className="text-xs text-blue-600 font-medium mb-1">
                                {splitMode === 'custom' ? 'Custom split:' : 'Equal split:'}
                              </div>
                              {selectedStudents.map(s => {
                                const bal = studentLedgers[s.id]?.currentBalance || 0;
                                const share = splitMode === 'custom'
                                  ? (parseFloat(perStudentAmounts[s.id]) || 0)
                                  : Math.round(depositAmt / selectedStudents.length);
                                const studentLateFee = addLateFee ? (parseFloat(lateFeePerStudent[s.id]) || 0) : 0;
                                const balAfter = bal + studentLateFee - share;
                                return (
                                  <div key={s.id} className="flex justify-between text-xs">
                                    <span className="text-slate-700 font-medium">{s.user.firstName} {s.user.lastName}</span>
                                    <span>
                                      <span className="text-green-600 font-bold">{formatCurrency(share)}</span>
                                      {studentLateFee > 0 && <span className="text-amber-600 ml-1">(+₹{studentLateFee} late)</span>}
                                      <span className="text-slate-400 mx-1">→</span>
                                      <span className={balAfter > 0 ? 'text-red-500' : 'text-green-500'}>{formatCurrency(Math.max(balAfter, 0))}</span>
                                    </span>
                                  </div>
                                );
                              })}
                              <hr className="border-slate-200" />
                            </>
                          )}
                          <div className="flex justify-between font-bold">
                            <span className="text-slate-600">Fee Amount</span>
                            <span className="text-green-700">{formatCurrency(effectiveTotal)}</span>
                          </div>
                          {addLateFee && totalLateFee > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-amber-600 font-medium">+ Late Fee</span>
                              <span className="text-amber-700 font-bold">{formatCurrency(totalLateFee)}</span>
                            </div>
                          )}
                          {addLateFee && totalLateFee > 0 && (
                            <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5">
                              <span className="text-slate-800">Grand Total</span>
                              <span className="text-slate-900">{formatCurrency(grandTotal)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-500 text-xs">Balance after</span>
                            <span className={`font-bold ${totalBalance + totalLateFee - effectiveTotal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(Math.max(totalBalance + totalLateFee - effectiveTotal, 0))}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Submit */}
                      <Button className="w-full" variant="success" size="lg" onClick={handleCollect}
                        disabled={submitting || selectedStudents.length === 0 || effectiveTotal <= 0}>
                        {submitting ? 'Processing...' : `Record Payment ${grandTotal > 0 ? formatCurrency(grandTotal) : ''}`}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </FadeIn>
          )}

          {/* ─── FEE STRUCTURES TAB ─── */}
          {tab === 'structures' && (
            <FadeIn delay={0.1}>
              {showForm && (
                <Card className="mb-4">
                  <CardContent className="pt-5">
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">Add Fee Structure</h2>
                    <form onSubmit={handleCreateFee} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <input placeholder="Fee Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900" required />
                      <select value={form.classId} onChange={e => setForm({...form, classId: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900" required>
                        <option value="">Select Class</option>
                        {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <select value={form.feeType} onChange={e => setForm({...form, feeType: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                        {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input placeholder="Amount (₹)" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900" required />
                      <select value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                        <option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option><option value="ONE_TIME">One-Time</option>
                      </select>
                      <input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900" required />
                      <input placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900" />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm">Create</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Class</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Frequency</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fees.map((fee: any) => (
                      <tr key={fee.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">{fee.name}</td>
                        <td className="px-4 py-3"><Badge className={feeTypeColors[fee.feeType]}>{fee.feeType}</Badge></td>
                        <td className="px-4 py-3 text-sm text-slate-500">{fee.class?.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-bold text-right">{formatCurrency(fee.amount)}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{fee.frequency}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDate(fee.dueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FadeIn>
          )}

          {/* ─── PAYMENT HISTORY TAB ─── */}
          {tab === 'payments' && (
            <FadeIn delay={0.1}>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Receipt</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fee</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Mode</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No payments</td></tr>
                    ) : payments.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-blue-600 font-mono">{p.receiptNumber || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">{p.student?.user?.firstName} {p.student?.user?.lastName}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{p.feeStructure?.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-bold text-right">{formatCurrency(p.amountPaid)}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{p.paymentMethod || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDate(p.paidDate)}</td>
                        <td className="px-4 py-3"><Badge className={statusColors[p.status]}>{p.status}</Badge></td>
                      </tr>
                    ))}
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
