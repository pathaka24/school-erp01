'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { getAcademicYears } from '@/lib/utils';

const CATEGORIES = ['FORMATIVE', 'SUMMATIVE', 'INTERNAL', 'PRACTICAL'];

const defaultGrades = [
  { name: 'A+', minMarks: 90, maxMarks: 100, gpa: 10, remarks: 'Outstanding' },
  { name: 'A', minMarks: 80, maxMarks: 89.99, gpa: 9, remarks: 'Excellent' },
  { name: 'B+', minMarks: 70, maxMarks: 79.99, gpa: 8, remarks: 'Very Good' },
  { name: 'B', minMarks: 60, maxMarks: 69.99, gpa: 7, remarks: 'Good' },
  { name: 'C+', minMarks: 50, maxMarks: 59.99, gpa: 6, remarks: 'Above Average' },
  { name: 'C', minMarks: 40, maxMarks: 49.99, gpa: 5, remarks: 'Average' },
  { name: 'D', minMarks: 33, maxMarks: 39.99, gpa: 4, remarks: 'Below Average' },
  { name: 'F', minMarks: 0, maxMarks: 32.99, gpa: 0, remarks: 'Fail' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<'general' | 'fees' | 'grading' | 'exams'>('general');
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [grades, setGrades] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Fee plan
  const [feePlan, setFeePlan] = useState<any>(null);
  const [feePlanYear, setFeePlanYear] = useState('2025-2026');
  const [feeExpanded, setFeeExpanded] = useState<string | null>(null);

  // General settings form
  const [general, setGeneral] = useState({
    schoolName: '', schoolAddress: '', schoolPhone: '', schoolEmail: '',
    academicYear: '2025-2026', academicYearStart: '4', academicYearEnd: '3',
    passingPercentage: '33', attendanceThreshold: '75',
    gradingSystem: 'PERCENTAGE', maxMarksDefault: '100',
    reportCardTitle: '', reportCardSubtitle: '',
    currency: '₹', feeLatePenalty: '0',
    promotionPolicy: 'MANUAL',
  });

  // Exam pattern form
  const [showPatternForm, setShowPatternForm] = useState(false);
  const [patternForm, setPatternForm] = useState({
    name: '', displayName: '', maxMarks: '100', passingPct: '33', weightage: '100', category: 'SUMMATIVE',
  });

  useEffect(() => {
    Promise.all([
      api.get('/settings/general').then(r => {
        setSettings(r.data);
        setGeneral(prev => ({ ...prev, ...r.data }));
      }),
      api.get('/settings/grade-scale').then(r => setGrades(r.data)),
      api.get('/settings/exam-patterns').then(r => setPatterns(r.data)),
      api.get('/settings/fee-plan').then(r => setFeePlan(r.data)).catch(() => {}),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Fee plan helpers
  const updateClassFee = (classId: string, field: string, value: any) => {
    if (!feePlan) return;
    setFeePlan({
      ...feePlan,
      classes: feePlan.classes.map((c: any) => c.classId === classId ? { ...c, [field]: value } : c),
    });
  };
  const updateClassCharge = (classId: string, chargeIdx: number, field: string, value: any) => {
    if (!feePlan) return;
    setFeePlan({
      ...feePlan,
      classes: feePlan.classes.map((c: any) => {
        if (c.classId !== classId) return c;
        const charges = [...c.charges];
        charges[chargeIdx] = { ...charges[chargeIdx], [field]: value };
        return { ...c, charges };
      }),
    });
  };
  const addClassCharge = (classId: string) => {
    if (!feePlan) return;
    setFeePlan({
      ...feePlan,
      classes: feePlan.classes.map((c: any) => c.classId === classId ? { ...c, charges: [...c.charges, { category: 'AD_HOC', description: '', amount: 0 }] } : c),
    });
  };
  const removeClassCharge = (classId: string, chargeIdx: number) => {
    if (!feePlan) return;
    setFeePlan({
      ...feePlan,
      classes: feePlan.classes.map((c: any) => c.classId !== classId ? c : { ...c, charges: c.charges.filter((_: any, i: number) => i !== chargeIdx) }),
    });
  };
  const saveFeePlan = async () => {
    setSaving(true);
    try {
      await api.put('/settings/fee-plan', { academicYear: feePlanYear, classes: feePlan.classes, scholarshipWeights: feePlan.scholarshipWeights, annualScholarship: feePlan.annualScholarship, quizBonusAmount: feePlan.quizBonusAmount });
      alert('Fee plan saved!');
    } catch { alert('Failed to save'); }
    finally { setSaving(false); }
  };
  const copyFeeToAll = (sourceClassId: string) => {
    if (!feePlan) return;
    const source = feePlan.classes.find((c: any) => c.classId === sourceClassId);
    if (!source) return;
    setFeePlan({
      ...feePlan,
      classes: feePlan.classes.map((c: any) => c.classId === sourceClassId ? c : {
        ...c,
        charges: source.charges.map((ch: any) => ({ ...ch })),
      }),
    });
  };

  // General settings save
  const saveGeneral = async () => {
    setSaving(true);
    try {
      await api.put('/settings/general', general);
      alert('Settings saved!');
    } catch { alert('Failed to save'); }
    finally { setSaving(false); }
  };

  // Grade scale
  const updateGradeRow = (idx: number, field: string, value: any) => {
    const updated = [...grades];
    (updated[idx] as any)[field] = value;
    setGrades(updated);
  };

  const addGradeRow = () => {
    setGrades([...grades, { name: '', minMarks: 0, maxMarks: 0, gpa: 0, remarks: '' }]);
  };

  const removeGradeRow = (idx: number) => {
    setGrades(grades.filter((_, i) => i !== idx));
  };

  const saveGrades = async () => {
    setSaving(true);
    try {
      await api.put('/settings/grade-scale', { grades });
      const { data } = await api.get('/settings/grade-scale');
      setGrades(data);
      alert('Grade scale saved!');
    } catch { alert('Failed to save'); }
    finally { setSaving(false); }
  };

  const loadDefaultGrades = () => {
    if (confirm('Replace current grades with default CBSE grading scale?')) {
      setGrades(defaultGrades);
    }
  };

  // Exam patterns
  const addPattern = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/settings/exam-patterns', patternForm);
      setShowPatternForm(false);
      setPatternForm({ name: '', displayName: '', maxMarks: '100', passingPct: '33', weightage: '100', category: 'SUMMATIVE' });
      const { data } = await api.get('/settings/exam-patterns');
      setPatterns(data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed');
    }
  };

  const togglePattern = async (id: string, isActive: boolean) => {
    await api.put(`/settings/exam-patterns/${id}`, { isActive: !isActive });
    const { data } = await api.get('/settings/exam-patterns');
    setPatterns(data);
  };

  const updatePattern = async (id: string, field: string, value: any) => {
    await api.put(`/settings/exam-patterns/${id}`, { [field]: value });
    const { data } = await api.get('/settings/exam-patterns');
    setPatterns(data);
  };

  const deletePattern = async (id: string) => {
    if (!confirm('Delete this exam pattern?')) return;
    await api.delete(`/settings/exam-patterns/${id}`);
    const { data } = await api.get('/settings/exam-patterns');
    setPatterns(data);
  };

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">School Settings</h1>
          <p className="text-slate-500">Configure how your school operates</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
              {[
                { id: 'general', label: 'General' },
                { id: 'fees', label: 'Annual Fee Plan' },
                { id: 'grading', label: 'Grading Scale' },
                { id: 'exams', label: 'Exam Patterns' },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id as any)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >{t.label}</button>
              ))}
            </div>

            {/* GENERAL TAB */}
            {tab === 'general' && (
              <div className="space-y-6">
                {/* School Info */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold mb-4">School Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">School Name</label>
                      <input value={general.schoolName} onChange={e => setGeneral({ ...general, schoolName: e.target.value })}
                        placeholder="e.g. Delhi Public School" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input value={general.schoolEmail} onChange={e => setGeneral({ ...general, schoolEmail: e.target.value })}
                        placeholder="info@school.edu" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                      <input value={general.schoolPhone} onChange={e => setGeneral({ ...general, schoolPhone: e.target.value })}
                        placeholder="+91 98765 43210" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                      <input value={general.schoolAddress} onChange={e => setGeneral({ ...general, schoolAddress: e.target.value })}
                        placeholder="Full school address" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                  </div>
                </div>

                {/* Academic Settings */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold mb-4">Academic Settings</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Current Academic Year</label>
                      <input value={general.academicYear} onChange={e => setGeneral({ ...general, academicYear: e.target.value })}
                        placeholder="2025-2026" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year Starts</label>
                      <select value={general.academicYearStart} onChange={e => setGeneral({ ...general, academicYearStart: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year Ends</label>
                      <select value={general.academicYearEnd} onChange={e => setGeneral({ ...general, academicYearEnd: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Default Passing %</label>
                      <input type="number" value={general.passingPercentage} onChange={e => setGeneral({ ...general, passingPercentage: e.target.value })}
                        min={0} max={100} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Min Attendance %</label>
                      <input type="number" value={general.attendanceThreshold} onChange={e => setGeneral({ ...general, attendanceThreshold: e.target.value })}
                        min={0} max={100} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Default Max Marks</label>
                      <input type="number" value={general.maxMarksDefault} onChange={e => setGeneral({ ...general, maxMarksDefault: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Grading System</label>
                      <select value={general.gradingSystem} onChange={e => setGeneral({ ...general, gradingSystem: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        <option value="PERCENTAGE">Percentage Based</option>
                        <option value="GPA">GPA (Grade Points)</option>
                        <option value="LETTER">Letter Grades Only</option>
                        <option value="CGPA">CGPA (Cumulative)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Promotion Policy</label>
                      <select value={general.promotionPolicy} onChange={e => setGeneral({ ...general, promotionPolicy: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        <option value="MANUAL">Manual (Teacher decides)</option>
                        <option value="AUTO_PASS">Auto-promote if passing %</option>
                        <option value="AUTO_ATTENDANCE">Auto-promote if attendance + passing %</option>
                        <option value="NO_DETENTION">No Detention Policy</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Report Card / Fee */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold mb-4">Report Card & Fees</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Report Card Title</label>
                      <input value={general.reportCardTitle} onChange={e => setGeneral({ ...general, reportCardTitle: e.target.value })}
                        placeholder="e.g. Progress Report" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Report Card Subtitle</label>
                      <input value={general.reportCardSubtitle} onChange={e => setGeneral({ ...general, reportCardSubtitle: e.target.value })}
                        placeholder="e.g. Academic Year 2025-26" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Currency Symbol</label>
                      <input value={general.currency} onChange={e => setGeneral({ ...general, currency: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Late Fee Penalty %</label>
                      <input type="number" value={general.feeLatePenalty} onChange={e => setGeneral({ ...general, feeLatePenalty: e.target.value })}
                        min={0} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={saveGeneral} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                    <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}

            {/* FEE PLAN TAB */}
            {tab === 'fees' && feePlan && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Annual Fee Plan</h2>
                    <p className="text-sm text-slate-500">Set monthly fees and admission charges per class. Used in admissions, bulk charges, and monthly diary.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select value={feePlanYear} onChange={e => setFeePlanYear(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button onClick={saveFeePlan} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                      <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Fee Plan'}
                    </button>
                  </div>
                </div>

                {/* Class-wise fee table */}
                {feePlan.classes.map((cls: any) => {
                  const isExpanded = feeExpanded === cls.classId;
                  const admissionTotal = cls.charges.reduce((s: number, c: any) => s + (parseFloat(c.amount) || 0), 0);
                  const annualTotal = (cls.monthlyFee * 12) + admissionTotal;

                  return (
                    <div key={cls.classId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      {/* Class header row */}
                      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100" onClick={() => setFeeExpanded(isExpanded ? null : cls.classId)}>
                        <div className="flex items-center gap-4">
                          <h3 className="text-sm font-bold text-slate-900 w-24">{cls.className}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Monthly:</span>
                            <input type="number" value={cls.monthlyFee || ''} placeholder="0"
                              onClick={e => e.stopPropagation()}
                              onChange={e => updateClassFee(cls.classId, 'monthlyFee', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-slate-900 text-right font-medium" />
                          </div>
                          <span className="text-xs text-slate-400">|</span>
                          <span className="text-xs text-slate-500">Admission: <strong className="text-slate-700">₹{admissionTotal.toLocaleString('en-IN')}</strong></span>
                          <span className="text-xs text-slate-400">|</span>
                          <span className="text-xs text-slate-500">Annual: <strong className="text-blue-700">₹{annualTotal.toLocaleString('en-IN')}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); copyFeeToAll(cls.classId); }} className="text-xs text-blue-600 hover:text-blue-800" title="Copy this class's charges to all other classes">
                            Copy to all
                          </button>
                          <span className="text-slate-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* Expanded: admission charges */}
                      {isExpanded && (
                        <div className="p-4">
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Admission Charges</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {cls.charges.map((charge: any, ci: number) => (
                              <div key={ci} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                                <input value={charge.description} onChange={e => updateClassCharge(cls.classId, ci, 'description', e.target.value)}
                                  className="flex-1 text-sm text-slate-900 bg-transparent outline-none" placeholder="Item name" />
                                <span className="text-slate-400 text-sm">₹</span>
                                <input type="number" value={charge.amount || ''} placeholder="0"
                                  onChange={e => updateClassCharge(cls.classId, ci, 'amount', parseFloat(e.target.value) || 0)}
                                  className="w-24 text-sm text-slate-900 text-right bg-transparent outline-none font-medium" />
                                <button onClick={() => removeClassCharge(cls.classId, ci)} className="text-red-400 hover:text-red-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button onClick={() => addClassCharge(cls.classId)} className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <Plus className="h-3 w-3" /> Add charge item
                          </button>

                          {/* Per-class scholarship budget */}
                          <div className="mt-4 border border-purple-200 bg-purple-50 rounded-lg p-3">
                            <span className="text-xs font-semibold text-purple-700 block mb-2">Scholarship Budget (this class)</span>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] text-purple-600 font-medium">Annual ₹</label>
                                <input type="number" min="0"
                                  value={cls.annualScholarship ?? feePlan.annualScholarship ?? 1200}
                                  onChange={e => updateClassFee(cls.classId, 'annualScholarship', parseInt(e.target.value) || 0)}
                                  className="w-24 px-2 py-1.5 border border-purple-300 rounded-lg text-sm text-purple-900 text-center font-bold bg-white" />
                              </div>
                              <div className="text-xs text-purple-600">
                                = <strong>₹{Math.round((cls.annualScholarship ?? feePlan.annualScholarship ?? 1200) / 12)}/month</strong>
                              </div>
                              {cls.annualScholarship != null && cls.annualScholarship !== (feePlan.annualScholarship ?? 1200) && (
                                <button onClick={() => updateClassFee(cls.classId, 'annualScholarship', null)}
                                  className="text-[10px] text-purple-400 hover:text-purple-600 ml-auto">Reset to global</button>
                              )}
                            </div>
                          </div>

                          {/* Summary */}
                          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 grid grid-cols-4 gap-4 text-sm">
                            <div><span className="text-blue-600">Monthly Fee</span><p className="font-bold text-blue-800">₹{(cls.monthlyFee || 0).toLocaleString('en-IN')}/month</p></div>
                            <div><span className="text-blue-600">Admission Charges</span><p className="font-bold text-blue-800">₹{admissionTotal.toLocaleString('en-IN')} (one-time)</p></div>
                            <div><span className="text-blue-600">Annual Total</span><p className="font-bold text-blue-800">₹{annualTotal.toLocaleString('en-IN')}/year</p></div>
                            <div><span className="text-purple-600">Scholarship</span><p className="font-bold text-purple-800">₹{(cls.annualScholarship ?? feePlan.annualScholarship ?? 1200).toLocaleString('en-IN')}/year</p></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Scholarship Scheme */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Scholarship Scheme</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Annual amount divided into 12 months. Each month, scholarship is calculated from 3 components based on weights. Fee Balance = % of total dues cleared (cumulative).
                  </p>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Annual Scholarship Amount (₹)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0"
                        value={feePlan.annualScholarship ?? 1200}
                        onChange={e => setFeePlan({ ...feePlan, annualScholarship: parseInt(e.target.value) || 0 })}
                        className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 text-center font-bold" />
                      <span className="text-xs text-slate-500">= ₹{Math.round((feePlan.annualScholarship ?? 1200) / 12)}/month</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { key: 'attendance', label: 'Attendance', color: 'text-blue-700' },
                      { key: 'testMarks', label: 'Test Marks', color: 'text-purple-700' },
                      { key: 'feeBalance', label: 'Fee Balance', color: 'text-green-700' },
                    ].map(w => {
                      const monthly = Math.round((feePlan.annualScholarship ?? 1200) / 12);
                      const pct = feePlan.scholarshipWeights?.[w.key] ?? (w.key === 'attendance' ? 10 : w.key === 'testMarks' ? 20 : 70);
                      const maxAmt = Math.round(monthly * pct / 100);
                      return (
                        <div key={w.key}>
                          <label className={`block text-xs font-semibold ${w.color} mb-1`}>{w.label}</label>
                          <div className="flex items-center gap-1">
                            <input type="number" min="0" max="100"
                              value={pct}
                              onChange={e => setFeePlan({ ...feePlan, scholarshipWeights: { ...feePlan.scholarshipWeights, [w.key]: parseInt(e.target.value) || 0 } })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 text-center font-bold" />
                            <span className="text-sm text-slate-500">%</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 text-center">max ₹{maxAmt}/mo</p>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const sw = feePlan.scholarshipWeights || { attendance: 10, testMarks: 20, feeBalance: 70 };
                    const total = (sw.attendance || 0) + (sw.testMarks || 0) + (sw.feeBalance || 0);
                    return (
                      <p className={`text-xs mt-3 font-medium ${total === 100 ? 'text-green-600' : 'text-red-600'}`}>
                        Total: {total}% {total === 100 ? '(correct)' : `(must be 100% — currently ${total > 100 ? 'over' : 'under'})`}
                      </p>
                    );
                  })()}

                  {/* Quiz Bonus Setting */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-purple-700 mb-1">Monthly Quiz Winner Bonus (₹)</label>
                        <p className="text-[10px] text-slate-400 mb-1">Amount awarded to quiz winner each month — added on top of auto scholarship</p>
                      </div>
                      <input type="number" min="0"
                        value={feePlan.quizBonusAmount ?? 50}
                        onChange={e => setFeePlan({ ...feePlan, quizBonusAmount: parseInt(e.target.value) || 0 })}
                        className="w-28 px-3 py-2 border border-purple-300 rounded-lg text-sm text-purple-900 text-center font-bold bg-purple-50" />
                    </div>
                  </div>
                </div>

                {/* Grand Summary */}
                <div className="bg-blue-900 text-white rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-blue-200 mb-3">Fee Plan Summary</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-blue-300 text-xs">
                          <th className="text-left py-2">Class</th>
                          <th className="text-right py-2">Monthly</th>
                          <th className="text-right py-2">Admission</th>
                          <th className="text-right py-2">Annual Total</th>
                          <th className="text-right py-2 text-purple-300">Scholarship</th>
                          <th className="text-right py-2 text-purple-300">Per Month</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feePlan.classes.map((cls: any) => {
                          const admTotal = cls.charges.reduce((s: number, c: any) => s + (parseFloat(c.amount) || 0), 0);
                          const schAmt = cls.annualScholarship ?? feePlan.annualScholarship ?? 1200;
                          return (
                            <tr key={cls.classId} className="border-t border-blue-800">
                              <td className="py-2 font-medium">{cls.className}</td>
                              <td className="py-2 text-right">₹{(cls.monthlyFee || 0).toLocaleString('en-IN')}</td>
                              <td className="py-2 text-right text-blue-300">₹{admTotal.toLocaleString('en-IN')}</td>
                              <td className="py-2 text-right font-bold">₹{((cls.monthlyFee * 12) + admTotal).toLocaleString('en-IN')}</td>
                              <td className="py-2 text-right text-purple-300 font-bold">₹{schAmt.toLocaleString('en-IN')}</td>
                              <td className="py-2 text-right text-purple-400">₹{Math.round(schAmt / 12)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* GRADING TAB */}
            {tab === 'grading' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Define how marks map to grades. Each row is a grade with a percentage range.</p>
                  <div className="flex gap-2">
                    <button onClick={loadDefaultGrades} className="px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition">
                      Load CBSE Default
                    </button>
                    <button onClick={addGradeRow} className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                      <Plus className="h-4 w-4" /> Add Grade
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 w-8"></th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Grade</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Min %</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Max %</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">GPA</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Remarks</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {grades.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No grades defined. Add grades or load defaults.</td></tr>
                      ) : grades.map((g, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-300"><GripVertical className="h-4 w-4" /></td>
                          <td className="px-4 py-2">
                            <input value={g.name} onChange={e => updateGradeRow(idx, 'name', e.target.value)}
                              className="w-16 px-2 py-1 border border-slate-300 rounded text-sm font-semibold text-slate-900" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" value={g.minMarks} onChange={e => updateGradeRow(idx, 'minMarks', e.target.value)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-slate-900" min={0} max={100} />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" value={g.maxMarks} onChange={e => updateGradeRow(idx, 'maxMarks', e.target.value)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-slate-900" min={0} max={100} />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" value={g.gpa || ''} onChange={e => updateGradeRow(idx, 'gpa', e.target.value)}
                              className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-slate-900" min={0} max={10} step={0.5} />
                          </td>
                          <td className="px-4 py-2">
                            <input value={g.remarks || ''} onChange={e => updateGradeRow(idx, 'remarks', e.target.value)}
                              placeholder="e.g. Excellent" className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-slate-900" />
                          </td>
                          <td className="px-4 py-2">
                            <button onClick={() => removeGradeRow(idx)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <button onClick={saveGrades} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                    <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Grade Scale'}
                  </button>
                </div>
              </div>
            )}

            {/* EXAMS TAB */}
            {tab === 'exams' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Define exam types, their max marks, passing criteria, and weightage in final results.</p>
                  <button onClick={() => setShowPatternForm(!showPatternForm)}
                    className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    <Plus className="h-4 w-4" /> Add Exam Type
                  </button>
                </div>

                {showPatternForm && (
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">Add Exam Type</h2>
                    <form onSubmit={addPattern} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <input placeholder="Short Name (e.g. FA1, SA1)" value={patternForm.name} onChange={e => setPatternForm({ ...patternForm, name: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      <input placeholder="Display Name (e.g. Formative Assessment 1)" value={patternForm.displayName} onChange={e => setPatternForm({ ...patternForm, displayName: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      <select value={patternForm.category} onChange={e => setPatternForm({ ...patternForm, category: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input placeholder="Max Marks" type="number" value={patternForm.maxMarks} onChange={e => setPatternForm({ ...patternForm, maxMarks: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      <input placeholder="Passing %" type="number" value={patternForm.passingPct} onChange={e => setPatternForm({ ...patternForm, passingPct: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" min={0} max={100} />
                      <input placeholder="Weightage %" type="number" value={patternForm.weightage} onChange={e => setPatternForm({ ...patternForm, weightage: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" min={0} max={100} />
                      <div className="flex gap-2">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Add</button>
                        <button type="button" onClick={() => setShowPatternForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Patterns list */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Code</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Name</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Category</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-500">Max Marks</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-500">Pass %</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-500">Weightage %</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-500">Active</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {patterns.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No exam patterns defined</td></tr>
                      ) : patterns.map(p => {
                        const catColor: Record<string, string> = {
                          FORMATIVE: 'bg-blue-100 text-blue-700', SUMMATIVE: 'bg-purple-100 text-purple-700',
                          INTERNAL: 'bg-green-100 text-green-700', PRACTICAL: 'bg-orange-100 text-orange-700',
                        };
                        return (
                          <tr key={p.id} className={`hover:bg-slate-50 ${!p.isActive ? 'opacity-50' : ''}`}>
                            <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-900">{p.name}</td>
                            <td className="px-4 py-3 text-sm text-slate-900">{p.displayName}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${catColor[p.category] || 'bg-slate-100'}`}>{p.category}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-slate-600">{p.maxMarks}</td>
                            <td className="px-4 py-3 text-sm text-center text-slate-600">{p.passingPct}%</td>
                            <td className="px-4 py-3 text-sm text-center text-slate-600">{p.weightage}%</td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => togglePattern(p.id, p.isActive)}
                                className={`w-10 h-5 rounded-full transition-colors ${p.isActive ? 'bg-green-500' : 'bg-slate-300'}`}>
                                <span className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${p.isActive ? 'translate-x-5' : 'translate-x-0.5'}`}></span>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <button onClick={() => deletePattern(p.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Weightage summary */}
                {patterns.filter(p => p.isActive).length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm text-blue-700 font-medium">
                      Active exam weightage total: {patterns.filter(p => p.isActive).reduce((s, p) => s + p.weightage, 0)}%
                      {patterns.filter(p => p.isActive).reduce((s, p) => s + p.weightage, 0) !== 100 && (
                        <span className="text-red-600 ml-2">(Should add up to 100%)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
