'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency, getAcademicYears, getCurrentAcademicYear } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { BookOpen, Save, Printer, Download, Trophy } from 'lucide-react';

const DISC_OPTIONS = [
  { v: '', l: '—' },
  { v: 'V_GOOD', l: 'V. Good' },
  { v: 'GOOD', l: 'Good' },
  { v: 'AVERAGE', l: 'Average' },
  { v: 'POOR', l: 'Poor' },
];
const DISC_COLORS: Record<string, string> = {
  V_GOOD: 'bg-green-100 text-green-700',
  GOOD: 'bg-blue-100 text-blue-700',
  AVERAGE: 'bg-yellow-100 text-yellow-700',
  POOR: 'bg-red-100 text-red-700',
};
const MONTHS = [
  { v: '04', l: 'April' }, { v: '05', l: 'May' }, { v: '06', l: 'June' },
  { v: '07', l: 'July' }, { v: '08', l: 'August' }, { v: '09', l: 'September' },
  { v: '10', l: 'October' }, { v: '11', l: 'November' }, { v: '12', l: 'December' },
  { v: '01', l: 'January' }, { v: '02', l: 'February' }, { v: '03', l: 'March' },
];

export default function MonthlyDiaryPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [academicYear, setAcademicYear] = useState(() => getCurrentAcademicYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [quizBonusAmount, setQuizBonusAmount] = useState('50'); // default quiz bonus

  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data));
    // Load quiz bonus setting
    api.get('/settings/fee-plan').then(r => {
      if (r.data.quizBonusAmount) setQuizBonusAmount(String(r.data.quizBonusAmount));
    }).catch(() => {});
  }, []);

  const selectedClassObj = classes.find((c: any) => c.id === selectedClass);
  const sections = selectedClassObj?.sections || [];

  const loadData = async () => {
    if (!selectedClass || !selectedMonth) return;
    setLoading(true);
    try {
      const params: any = { classId: selectedClass, month: selectedMonth, academicYear };
      if (selectedSection) params.sectionId = selectedSection;
      const r = await api.get('/monthly-report/class', { params });
      setData(r.data);
      setEdits({});
    } catch { setData(null); }
    setLoading(false);
  };

  useEffect(() => { if (selectedClass && selectedMonth) loadData(); }, [selectedClass, selectedSection, selectedMonth]);

  const updateEdit = (studentId: string, field: string, value: any) => {
    setEdits(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const toggleQuizWinner = (studentId: string) => {
    const current = edits[studentId]?.quizBonus;
    const studentData = data?.students?.find((s: any) => s.studentId === studentId);
    const existing = studentData?.quizBonus || 0;
    const isCurrentlyWinner = current !== undefined ? parseFloat(current) > 0 : existing > 0;

    if (isCurrentlyWinner) {
      updateEdit(studentId, 'quizBonus', '0');
    } else {
      updateEdit(studentId, 'quizBonus', quizBonusAmount);
    }
  };

  const handleSaveAll = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const entries = data.students.map((s: any) => {
        const e = edits[s.studentId];
        if (!e) return null;
        const entry: any = { studentId: s.studentId };
        if (e.discipline !== undefined) entry.discipline = e.discipline;
        if (e.comment !== undefined) entry.comment = e.comment;
        if (e.scholarship !== undefined) entry.rewardAmount = parseFloat(e.scholarship) || null;
        if (e.quizBonus !== undefined) entry.quizBonus = parseFloat(e.quizBonus) || 0;
        return entry;
      }).filter(Boolean);

      if (entries.length > 0) {
        await api.post('/monthly-report/class', { month: selectedMonth, academicYear, entries });
      }
      alert(`Saved ${entries.length} entries!`);
      loadData();
    } catch { alert('Failed to save'); }
    setSaving(false);
  };

  const handlePrint = () => {
    if (!data) return;
    const monthLabel = MONTHS.find(m => selectedMonth.endsWith(m.v))?.l || selectedMonth;
    let rows = data.students.map((s: any) => {
      const e = edits[s.studentId] || {};
      const sch = e.scholarship !== undefined ? parseFloat(e.scholarship) || 0 : (s.scholarship || 0);
      const qb = e.quizBonus !== undefined ? parseFloat(e.quizBonus) || 0 : (s.quizBonus || 0);
      const grand = sch + qb;
      const br = s.scholarshipBreakdown;
      return `<tr ${qb > 0 ? 'style="background:#faf5ff"' : ''}>
        <td style="padding:6px 10px;font-size:13px">${s.name}</td>
        <td style="padding:6px 10px;text-align:center;font-size:13px">${s.section || ''}</td>
        <td style="padding:6px 10px;text-align:center;font-size:13px">${s.attendancePct != null ? s.attendancePct + '%' : '—'}</td>
        <td style="padding:6px 10px;text-align:center;font-size:13px">${s.testMarksPct != null ? s.testMarksPct + '%' : '—'}</td>
        <td style="padding:6px 10px;text-align:center;font-size:13px">${s.feeBalancePct != null ? s.feeBalancePct + '%' : '—'}</td>
        <td style="padding:6px 10px;text-align:right;font-size:13px;color:#1e40af;font-weight:600">₹${sch}</td>
        <td style="padding:6px 10px;text-align:center;font-size:13px;color:#7c3aed;font-weight:bold">${qb > 0 ? '🏆 +₹' + qb : '—'}</td>
        <td style="padding:6px 10px;text-align:right;font-size:14px;font-weight:bold">${grand > 0 ? '₹' + grand.toLocaleString('en-IN') : '—'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Scholarship Diary - ${selectedClassObj?.name} - ${monthLabel}</title>
      <style>body{font-family:Arial;margin:20px;color:#1e293b}.header{text-align:center;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:20px}.school{font-size:20px;font-weight:bold;color:#1e40af}table{width:100%;border-collapse:collapse}th{background:#1e3a8a;color:white;padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase}td{border-bottom:1px solid #e2e8f0}.summary{margin-top:16px;display:flex;gap:24px;justify-content:center;font-size:14px}@media print{body{margin:10px}}</style>
    </head><body>
      <div class="header">
        <div class="school">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
        <div style="font-size:14px;color:#475569;margin-top:4px">${selectedClassObj?.name} | ${monthLabel} ${selectedMonth.split('-')[0]} | ${academicYear}</div>
        <div style="font-size:12px;color:#64748b">Annual: ₹${(data.annualScholarship || 1200).toLocaleString('en-IN')} | Monthly Max: ₹${data.monthlyScholarship || 100} | Att 10% + Test 20% + Fee Balance 70%</div>
      </div>
      <table>
        <thead><tr>
          <th style="text-align:left">Student</th><th>Sec</th><th>Att (10%)</th><th>Test (20%)</th><th>Fee Bal (70%)</th><th style="text-align:right">Scholarship</th><th>Quiz</th><th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary">
        <span>Students: <strong>${data.summary.totalStudents}</strong></span>
        <span>Total Scholarship: <strong style="color:#1e40af">₹${data.summary.totalScholarship.toLocaleString('en-IN')}</strong></span>
      </div>
      <div style="margin-top:16px;font-size:11px;color:#94a3b8;text-align:center">Printed on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const monthLabel = MONTHS.find(m => selectedMonth.endsWith(m.v))?.l || selectedMonth;

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Scholarship Diary</h1>
                  <p className="text-sm text-slate-500">Class-wide scholarship calculation & management</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {data && (
                  <>
                    <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4" /> Print</Button>
                    <Button size="sm" onClick={handleSaveAll} disabled={saving || Object.keys(edits).length === 0}>
                      <Save className="h-4 w-4" /> {saving ? 'Saving...' : `Save (${Object.keys(edits).length})`}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Filters */}
          <FadeIn delay={0.1}>
            <div className="flex items-center gap-3 flex-wrap">
              <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                <option value="">Select Class</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                <option value="">All Sections</option>
                {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                {MONTHS.map(m => {
                  const y = parseInt(m.v) >= 4 ? academicYear.split('-')[0] : academicYear.split('-')[1];
                  return <option key={m.v} value={`${y}-${m.v}`}>{m.l} {y}</option>;
                })}
              </select>
              <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </FadeIn>

          {/* Summary cards */}
          {data && (
            <FadeIn delay={0.15}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-xs text-slate-500">Students</p>
                  <p className="text-2xl font-bold text-slate-900">{data.summary.totalStudents}</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-xs text-slate-500">Monthly Max</p>
                  <p className="text-2xl font-bold text-slate-700">{formatCurrency(data.monthlyScholarship || 100)}</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-xs text-slate-500">Total Scholarship</p>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(data.summary.totalScholarship)}</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-xs text-slate-500">Annual Budget</p>
                  <p className="text-2xl font-bold text-slate-700">{formatCurrency(data.annualScholarship || 1200)}</p>
                </Card>
              </div>
            </FadeIn>
          )}

          {/* Quiz bonus bar */}
          {data && (
            <FadeIn delay={0.18}>
              <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                <Trophy className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Monthly Quiz Bonus:</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-purple-600">₹</span>
                  <input type="number" min="0" value={quizBonusAmount}
                    onChange={e => setQuizBonusAmount(e.target.value)}
                    className="w-20 px-2 py-1 border border-purple-300 rounded-lg text-sm font-bold text-purple-900 text-center bg-white" />
                </div>
                <span className="text-xs text-purple-500">Click the trophy icon to mark winner — amount auto-fills</span>
              </div>
            </FadeIn>
          )}

          {/* Student table */}
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
          ) : !data ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">Select a class and month to view diary</div>
          ) : (
            <FadeIn delay={0.2}>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Sec</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Att (10%)</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Test (20%)</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Fee Bal (70%)</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Breakdown</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Scholarship</th>
                      <th className="text-center px-2 py-3 text-xs font-semibold text-purple-600 uppercase">Quiz</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold text-slate-900 uppercase">Total</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.students.map((s: any) => {
                      const e = edits[s.studentId] || {};
                      const disc = e.discipline !== undefined ? e.discipline : (s.discipline || '');
                      const comment = e.comment !== undefined ? e.comment : (s.comment || '');
                      const scholarship = e.scholarship !== undefined ? e.scholarship : s.scholarship;

                      const attColor = (s.attendancePct ?? 0) >= 90 ? 'text-green-600' : (s.attendancePct ?? 0) >= 75 ? 'text-yellow-600' : 'text-red-600';
                      const testColor = (s.testMarksPct ?? 0) >= 75 ? 'text-green-600' : (s.testMarksPct ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600';
                      const feeColor = (s.feeBalancePct ?? 0) >= 80 ? 'text-green-600' : (s.feeBalancePct ?? 0) > 0 ? 'text-yellow-600' : 'text-red-600';
                      const isEdited = !!edits[s.studentId];
                      const br = s.scholarshipBreakdown;
                      const qb = e.quizBonus !== undefined ? parseFloat(e.quizBonus) || 0 : (s.quizBonus || 0);
                      const isQuizWinner = qb > 0;
                      const grandTotal = (parseFloat(scholarship) || 0) + qb;

                      return (
                        <tr key={s.studentId} className={`hover:bg-slate-50 ${isEdited ? 'bg-blue-50' : ''} ${isQuizWinner ? 'bg-purple-50' : ''}`}>
                          <td className="px-4 py-2.5">
                            <div className="text-sm font-medium text-slate-900">{s.name}</div>
                            <div className="text-xs text-slate-400">{s.admissionNo}</div>
                          </td>
                          <td className="px-3 py-2.5 text-center text-sm text-slate-500">{s.section}</td>
                          <td className={`px-3 py-2.5 text-center text-sm font-bold ${attColor}`}>{s.attendancePct != null ? s.attendancePct + '%' : '—'}</td>
                          <td className={`px-3 py-2.5 text-center text-sm font-bold ${testColor}`}>{s.testMarksPct != null ? s.testMarksPct + '%' : '—'}</td>
                          <td className={`px-3 py-2.5 text-center text-sm font-bold ${feeColor}`}>{s.feeBalancePct != null ? s.feeBalancePct + '%' : '—'}</td>
                          <td className="px-3 py-2.5 text-center text-[10px] text-slate-400">
                            {br && `₹${br.attAmount}+₹${br.testAmount}+₹${br.feeAmount}`}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <input type="number" value={scholarship}
                              onChange={ev => updateEdit(s.studentId, 'scholarship', ev.target.value)}
                              className="w-16 px-1 py-1 border border-slate-200 rounded text-xs text-right font-bold text-blue-700 bg-transparent hover:border-blue-400 outline-none" />
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <button onClick={() => toggleQuizWinner(s.studentId)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isQuizWinner ? 'bg-purple-600 text-white shadow-lg scale-110' : 'bg-slate-100 text-slate-300 hover:bg-purple-100 hover:text-purple-500'}`}
                              title={isQuizWinner ? `Quiz Winner: ₹${qb}` : 'Mark as quiz winner'}>
                              <Trophy className="h-4 w-4" />
                            </button>
                            {isQuizWinner && <p className="text-[9px] text-purple-600 font-bold mt-0.5">+₹{qb}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-sm font-extrabold text-slate-900">₹{grandTotal}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <input value={comment}
                              onChange={ev => updateEdit(s.studentId, 'comment', ev.target.value)}
                              placeholder="..."
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-slate-700 bg-transparent hover:border-blue-400 outline-none" />
                          </td>
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
