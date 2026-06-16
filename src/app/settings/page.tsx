'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { getAcademicYears, compressImage } from '@/lib/utils';
import { useFeedback } from '@/components/ui/feedback';

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
  const [tab, setTab] = useState<'general' | 'fees' | 'grading' | 'exams' | 'classes' | 'templates'>('general');
  // Classes & sections
  const [classList, setClassList] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [newClass, setNewClass] = useState({ name: '', numericGrade: '', sections: 'A' });
  const [addingClass, setAddingClass] = useState(false);
  const { toast } = useFeedback();
  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [grades, setGrades] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Fee plan
  const [feePlan, setFeePlan] = useState<any>(null);
  const [feePlanYear, setFeePlanYear] = useState('2025-2026');
  const [feeExpanded, setFeeExpanded] = useState<string | null>(null);
  // Ledger period lock (YYYY-MM; '' = unlocked)
  const [feeLockMonth, setFeeLockMonth] = useState('');
  const [savingFeeLock, setSavingFeeLock] = useState(false);

  // General settings form
  const [general, setGeneral] = useState({
    schoolName: '', schoolAddress: '', schoolPhone: '', schoolEmail: '',
    schoolLogo: '',
    academicYear: '2025-2026', academicYearStart: '4', academicYearEnd: '3',
    passingPercentage: '33', attendanceThreshold: '75',
    gradingSystem: 'PERCENTAGE', maxMarksDefault: '100',
    reportCardTitle: '', reportCardSubtitle: '',
    currency: '₹', feeLatePenalty: '0',
    promotionPolicy: 'MANUAL',
  });
  const [schoolLogoUploading, setSchoolLogoUploading] = useState(false);

  const uploadSchoolLogo = async (file: File) => {
    setSchoolLogoUploading(true);
    try {
      let toUpload: File = file;
      if (file.type !== 'image/svg+xml') {
        toUpload = await compressImage(file, { targetKB: 100, maxDim: 800 });
      }
      const fd = new FormData();
      fd.append('file', toUpload);
      const { data } = await api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setGeneral(g => ({ ...g, schoolLogo: data.url }));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Logo upload failed. Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env');
    } finally {
      setSchoolLogoUploading(false);
    }
  };

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
        if (typeof r.data.feeLockMonth === 'string') setFeeLockMonth(r.data.feeLockMonth);
      }),
      api.get('/settings/grade-scale').then(r => setGrades(r.data)),
      api.get('/settings/exam-patterns').then(r => setPatterns(r.data)),
      api.get('/settings/fee-plan').then(r => setFeePlan(r.data)).catch(() => {}),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Lazy-load classes + teachers when the Classes tab opens
  const loadClassesTab = async () => {
    setClassesLoading(true);
    try {
      const [classesRes, teachersRes] = await Promise.all([
        api.get('/classes'),
        api.get('/teachers'),
      ]);
      setClassList(classesRes.data || []);
      setTeachersList(teachersRes.data || []);
    } finally { setClassesLoading(false); }
  };
  useEffect(() => {
    if (tab === 'classes' && classList.length === 0) loadClassesTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const saveFeeLock = async () => {
    setSavingFeeLock(true);
    try {
      await api.put('/settings/general', { feeLockMonth });
      toast('success', feeLockMonth
        ? `Fee ledger locked through ${feeLockMonth}`
        : 'Fee ledger lock removed');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to save ledger lock');
    } finally {
      setSavingFeeLock(false);
    }
  };

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingClass(true);
    try {
      await api.post('/classes', {
        name: newClass.name.trim(),
        numericGrade: parseInt(newClass.numericGrade, 10),
        sections: newClass.sections.split(',').map(s => s.trim()).filter(Boolean),
      });
      toast('success', `Class "${newClass.name.trim()}" created`);
      setNewClass({ name: '', numericGrade: '', sections: 'A' });
      loadClassesTab();
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to create class');
    } finally {
      setAddingClass(false);
    }
  };

  // Templates loader + helpers
  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const { data } = await api.get('/print-templates');
      setTemplates(data || []);
    } finally { setTemplatesLoading(false); }
  };
  useEffect(() => {
    if (tab === 'templates' && templates.length === 0) loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const createTemplate = async (type: string) => {
    const name = window.prompt(`Name for new ${type.replace(/_/g, ' ').toLowerCase()} template:`);
    if (!name) return;
    try {
      const { data } = await api.post('/print-templates', { name, type });
      setTemplates(t => [...t, data]);
      setEditingTemplate(data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create template');
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    setTemplateSaving(true);
    try {
      const { data } = await api.patch(`/print-templates/${editingTemplate.id}`, {
        name: editingTemplate.name,
        config: editingTemplate.config,
        isDefault: editingTemplate.isDefault,
      });
      setTemplates(t => t.map(x => x.id === data.id ? data : (data.isDefault && x.type === data.type ? { ...x, isDefault: false } : x)));
      setEditingTemplate(data);
      alert('Saved.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save');
    } finally {
      setTemplateSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    try {
      await api.delete(`/print-templates/${id}`);
      setTemplates(t => t.filter(x => x.id !== id));
      if (editingTemplate?.id === id) setEditingTemplate(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const setAsDefault = async (id: string) => {
    try {
      const { data } = await api.patch(`/print-templates/${id}`, { isDefault: true });
      setTemplates(t => t.map(x => x.type === data.type ? { ...x, isDefault: x.id === data.id } : x));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to set default');
    }
  };

  const uploadLogo = async (file: File) => {
    if (!editingTemplate) return;
    setLogoUploading(true);
    try {
      // Compress raster images client-side to keep storage usage low and
      // page loads fast. SVGs are passed through (already vector, tiny).
      let toUpload: File = file;
      if (file.type !== 'image/svg+xml') {
        const originalKB = Math.round(file.size / 1024);
        toUpload = await compressImage(file, { targetKB: 100, maxDim: 800 });
        const newKB = Math.round(toUpload.size / 1024);
        if (originalKB > newKB) {
          console.info(`Logo compressed: ${originalKB}KB → ${newKB}KB`);
        }
      }

      const fd = new FormData();
      fd.append('file', toUpload);
      const { data } = await api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEditingTemplate({
        ...editingTemplate,
        config: { ...editingTemplate.config, logoUrl: data.url },
      });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Logo upload failed. Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env');
    } finally {
      setLogoUploading(false);
    }
  };

  const updateSectionClassTeacher = async (sectionId: string, teacherId: string | null) => {
    setSavingSectionId(sectionId);
    try {
      await api.patch(`/sections/${sectionId}`, { classTeacherId: teacherId });
      // Refresh inline rather than refetching everything
      setClassList(prev => prev.map((cls: any) => ({
        ...cls,
        sections: (cls.sections || []).map((s: any) => {
          if (s.id !== sectionId) return s;
          if (!teacherId) return { ...s, classTeacherId: null, classTeacher: null };
          const t = teachersList.find((t: any) => t.id === teacherId);
          return {
            ...s, classTeacherId: teacherId,
            classTeacher: t ? { id: t.id, user: { firstName: t.user.firstName, lastName: t.user.lastName } } : null,
          };
        }),
      })));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update class teacher');
    } finally {
      setSavingSectionId(null);
    }
  };

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
                { id: 'classes', label: 'Classes & Class Teachers' },
                { id: 'templates', label: 'Print Templates' },
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

                  {/* School logo — used as default for all print templates */}
                  <div className="mt-5 pt-5 border-t border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-2">School Logo</label>
                    <p className="text-xs text-slate-500 mb-3">Used as the default logo for all ID cards, admit cards, and report cards. Each template can override with its own logo.</p>
                    <div className="flex items-center gap-4">
                      {general.schoolLogo ? (
                        <img src={general.schoolLogo} alt="logo" className="h-20 w-20 object-contain bg-slate-50 rounded border border-slate-200" />
                      ) : (
                        <div className="h-20 w-20 rounded border-2 border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">No logo</div>
                      )}
                      <div className="flex-1">
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadSchoolLogo(f); }}
                          disabled={schoolLogoUploading}
                          className="text-xs text-slate-600 file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs file:font-medium hover:file:bg-blue-100" />
                        {general.schoolLogo && (
                          <button onClick={() => setGeneral(g => ({ ...g, schoolLogo: '' }))}
                            className="ml-2 text-xs text-red-600 hover:underline">Remove</button>
                        )}
                        {schoolLogoUploading && <span className="ml-2 text-xs text-slate-400">Uploading…</span>}
                        <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, WEBP, or SVG. Auto-compressed to ~100 KB.</p>
                      </div>
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

                {/* Ledger period lock */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Ledger Period Lock</h3>
                      <p className="text-xs text-slate-500 max-w-xl">
                        Entries in the locked months (and earlier) become read-only — no one can edit, void, restore, or delete them.
                        Lock a month after you reconcile it. Clear the field to unlock everything.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="month" value={feeLockMonth}
                        onChange={e => setFeeLockMonth(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <button onClick={saveFeeLock} disabled={savingFeeLock}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-900 disabled:opacity-50">
                        {savingFeeLock ? 'Saving…' : feeLockMonth ? 'Lock through this month' : 'Save (unlocked)'}
                      </button>
                    </div>
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

            {/* PRINT TEMPLATES TAB */}
            {tab === 'templates' && (
              <TemplatesTab
                templates={templates}
                loading={templatesLoading}
                editing={editingTemplate}
                setEditing={setEditingTemplate}
                onCreate={createTemplate}
                onSave={saveTemplate}
                onDelete={deleteTemplate}
                onSetDefault={setAsDefault}
                saving={templateSaving}
                onLogoUpload={uploadLogo}
                logoUploading={logoUploading}
                schoolLogo={general.schoolLogo}
              />
            )}

            {/* CLASSES & CLASS TEACHERS TAB */}
            {tab === 'classes' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Classes &amp; Sections</h2>
                      <p className="text-xs text-slate-500">Assign or change a class teacher for each section. Select &quot;— None —&quot; to clear.</p>
                    </div>
                    <button onClick={loadClassesTab}
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">Refresh</button>
                  </div>
                </div>

                {/* Add class */}
                <form onSubmit={addClass} className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Add Class</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Grade position controls ordering and yearly promotion (each class promotes to the next position).
                    Pre-primary: Nursery → LKG → UKG → Class 1.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <label className="text-xs text-slate-600">
                      Class name
                      <input value={newClass.name} required
                        onChange={e => setNewClass({ ...newClass, name: e.target.value })}
                        placeholder="e.g. NUR, LKG, UKG, Class 11"
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </label>
                    <label className="text-xs text-slate-600">
                      Grade position
                      <select value={newClass.numericGrade} required
                        onChange={e => setNewClass({ ...newClass, numericGrade: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        <option value="">Select…</option>
                        <option value="-2">Nursery (before LKG)</option>
                        <option value="-1">LKG (before UKG)</option>
                        <option value="0">UKG (before Class 1)</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(g => (
                          <option key={g} value={g}>Class {g}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-slate-600">
                      Sections (comma-separated)
                      <input value={newClass.sections}
                        onChange={e => setNewClass({ ...newClass, sections: e.target.value })}
                        placeholder="A, B"
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </label>
                    <div className="flex items-end">
                      <button type="submit" disabled={addingClass}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                        <Plus className="h-4 w-4" /> {addingClass ? 'Adding…' : 'Add Class'}
                      </button>
                    </div>
                  </div>
                </form>

                {classesLoading && <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>}

                {!classesLoading && classList.length === 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
                    No classes configured yet.
                  </div>
                )}

                {!classesLoading && classList.map((cls: any) => (
                  <div key={cls.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{cls.name}</h3>
                        <p className="text-xs text-slate-500">{cls._count?.students || 0} students · {cls.sections?.length || 0} section{cls.sections?.length === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    {cls.sections?.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-4 py-2 text-left">Section</th>
                            <th className="px-4 py-2 text-left w-1/2">Class Teacher</th>
                            <th className="px-4 py-2 text-right">Students</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cls.sections.map((s: any) => (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-medium text-slate-900">{s.name}</td>
                              <td className="px-4 py-2.5">
                                <select
                                  value={s.classTeacherId || ''}
                                  disabled={savingSectionId === s.id}
                                  onChange={e => updateSectionClassTeacher(s.id, e.target.value || null)}
                                  className="w-full max-w-md px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:bg-slate-100"
                                >
                                  <option value="">— None —</option>
                                  {teachersList.map((t: any) => (
                                    <option key={t.id} value={t.id}>
                                      {t.user.firstName} {t.user.lastName}{t.subject ? ` · ${t.subject}` : ''}
                                    </option>
                                  ))}
                                </select>
                                {savingSectionId === s.id && <span className="ml-2 text-xs text-slate-400">saving…</span>}
                              </td>
                              <td className="px-4 py-2.5 text-right text-slate-600">{(s as any).studentCount ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="px-5 py-4 text-sm text-slate-400">No sections in this class.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Templates tab + editor ─────────────────────────────────

const TEMPLATE_TYPES: { id: string; label: string }[] = [
  { id: 'STUDENT_ID', label: 'Student ID Cards' },
  { id: 'TEACHER_ID', label: 'Staff ID Cards' },
  { id: 'ADMIT_CARD', label: 'Admit Cards' },
  { id: 'REPORT_CARD', label: 'Report Cards' },
];

const FIELDS_BY_TYPE: Record<string, { key: string; label: string }[]> = {
  STUDENT_ID: [
    { key: 'name', label: 'Full Name' }, { key: 'class', label: 'Class' },
    { key: 'section', label: 'Section' }, { key: 'admissionNo', label: 'Admission No' },
    { key: 'rollNumber', label: 'Roll Number' }, { key: 'fatherName', label: "Father's Name" },
    { key: 'motherName', label: "Mother's Name" }, { key: 'guardianName', label: "Guardian's Name" },
    { key: 'phone', label: 'Phone' }, { key: 'address', label: 'Address' },
    { key: 'bloodGroup', label: 'Blood Group' }, { key: 'dob', label: 'Date of Birth' },
  ],
  TEACHER_ID: [
    { key: 'name', label: 'Full Name' }, { key: 'designation', label: 'Designation' },
    { key: 'employeeId', label: 'Employee ID' }, { key: 'subjects', label: 'Subjects' },
    { key: 'phone', label: 'Phone' }, { key: 'qualification', label: 'Qualification' },
    { key: 'bloodGroup', label: 'Blood Group' }, { key: 'dob', label: 'Date of Birth' },
  ],
  ADMIT_CARD: [
    { key: 'name', label: 'Full Name' }, { key: 'class', label: 'Class' },
    { key: 'section', label: 'Section' }, { key: 'admissionNo', label: 'Admission No' },
    { key: 'rollNumber', label: 'Roll Number' }, { key: 'fatherName', label: "Father's Name" },
    { key: 'examName', label: 'Exam Name' }, { key: 'examDates', label: 'Exam Dates' },
    { key: 'examCenter', label: 'Exam Center' }, { key: 'subjects', label: 'Subjects (with timetable)' },
  ],
  REPORT_CARD: [
    { key: 'name', label: 'Full Name' }, { key: 'class', label: 'Class' },
    { key: 'admissionNo', label: 'Admission No' }, { key: 'rollNumber', label: 'Roll Number' },
    { key: 'fatherName', label: "Father's Name" }, { key: 'motherName', label: "Mother's Name" },
    { key: 'dob', label: 'Date of Birth' }, { key: 'address', label: 'Address' },
  ],
};

function TemplatesTab(props: {
  templates: any[];
  loading: boolean;
  editing: any;
  setEditing: (t: any) => void;
  onCreate: (type: string) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  saving: boolean;
  onLogoUpload: (file: File) => void;
  logoUploading: boolean;
  schoolLogo: string;
}) {
  const { templates, loading, editing, setEditing, onCreate, onSave, onDelete, onSetDefault, saving, onLogoUpload, logoUploading, schoolLogo } = props;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* List */}
      <div className="lg:col-span-1 space-y-3">
        {loading && <p className="text-center py-6 text-slate-400 text-sm">Loading…</p>}
        {!loading && TEMPLATE_TYPES.map(t => {
          const list = templates.filter(x => x.type === t.id);
          return (
            <div key={t.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{t.label}</p>
                <button onClick={() => onCreate(t.id)}
                  className="text-xs text-blue-600 hover:underline">+ New</button>
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-slate-400 px-4 py-3">No templates. Click + New to create one.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {list.map(tpl => (
                    <div key={tpl.id} className={`px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-50 ${editing?.id === tpl.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setEditing(tpl)}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{tpl.name}</div>
                        {tpl.isDefault && <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Default</span>}
                      </div>
                      {!tpl.isDefault && (
                        <button onClick={e => { e.stopPropagation(); onSetDefault(tpl.id); }}
                          className="text-[10px] text-slate-500 hover:text-emerald-700">Make default</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Editor + preview */}
      <div className="lg:col-span-2">
        {!editing ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-400">
            Select a template on the left, or click <strong>+ New</strong> to create one.
          </div>
        ) : (
          <TemplateEditor
            tpl={editing}
            onChange={setEditing}
            onSave={onSave}
            onDelete={() => onDelete(editing.id)}
            saving={saving}
            onLogoUpload={onLogoUpload}
            logoUploading={logoUploading}
            schoolLogo={schoolLogo}
          />
        )}
      </div>
    </div>
  );
}

function TemplateEditor(props: {
  tpl: any;
  onChange: (t: any) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  onLogoUpload: (file: File) => void;
  logoUploading: boolean;
  schoolLogo: string;
}) {
  const { tpl, onChange, onSave, onDelete, saving, onLogoUpload, logoUploading, schoolLogo } = props;
  const cfg = tpl.config;
  const fields = FIELDS_BY_TYPE[tpl.type] || [];

  const setCfg = (patch: any) => onChange({ ...tpl, config: { ...cfg, ...patch } });

  const selectedFields = (tpl.type === 'REPORT_CARD' ? cfg.studentFields : cfg.fields) || [];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <input value={tpl.name} onChange={e => onChange({ ...tpl, name: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 min-w-[240px]" />
          <div className="flex gap-2">
            <button onClick={onDelete} className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Delete</button>
            <button onClick={onSave} disabled={saving} className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>

        {/* Header section */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-slate-600">
              Header Line 1 (school name)
              <input value={cfg.headerLine1 || ''} onChange={e => setCfg({ headerLine1: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-600">
              Header Line 2 (address)
              <input value={cfg.headerLine2 || ''} onChange={e => setCfg({ headerLine2: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-600">
              Header Line 3 (reg no / phone)
              <input value={cfg.headerLine3 || ''} onChange={e => setCfg({ headerLine3: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-600">
              Card label / title
              <input value={cfg.cardLabel || ''} onChange={e => setCfg({ cardLabel: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-600">
              Primary color (header bar)
              <div className="mt-1 flex gap-2">
                <input type="color" value={cfg.primaryColor || '#006400'}
                  onChange={e => setCfg({ primaryColor: e.target.value })}
                  className="w-16 h-9 border border-slate-300 rounded" />
                <input value={cfg.primaryColor || '#006400'}
                  onChange={e => setCfg({ primaryColor: e.target.value })}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono" />
              </div>
            </label>
            <label className="text-xs text-slate-600">
              Footer text
              <input value={cfg.footer || ''} onChange={e => setCfg({ footer: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
            </label>
          </div>

          {/* Logo — defaults to school logo unless overridden */}
          <div>
            <label className="text-xs text-slate-600 block mb-1">Logo</label>
            {!cfg.logoUrl ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800 mb-2">
                  ✓ Using <strong>school logo</strong> from General settings.
                </p>
                <div className="flex items-center gap-3">
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={e => { const f = e.target.files?.[0]; if (f) onLogoUpload(f); }}
                    disabled={logoUploading}
                    className="text-xs text-slate-600 file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-white file:text-blue-700 file:text-xs file:font-medium hover:file:bg-blue-100" />
                  {logoUploading && <span className="text-xs text-slate-400">Uploading…</span>}
                </div>
                <p className="text-[10px] text-blue-700/70 mt-1">Upload a different logo only if this template needs a special one (e.g. branded for a specific class).</p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <img src={cfg.logoUrl} alt="logo" className="h-16 w-16 object-contain bg-slate-50 rounded border border-slate-200" />
                <div className="flex-1">
                  <p className="text-xs text-amber-800 font-medium mb-1">Custom logo (overrides school logo)</p>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={e => { const f = e.target.files?.[0]; if (f) onLogoUpload(f); }}
                    disabled={logoUploading}
                    className="text-xs text-slate-600" />
                  <button onClick={() => setCfg({ logoUrl: null })}
                    className="ml-2 text-xs text-red-600 hover:underline">Reset to school logo</button>
                  {logoUploading && <span className="ml-2 text-xs text-slate-400">Uploading…</span>}
                  <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, WEBP, or SVG. Auto-compressed.</p>
                </div>
              </div>
            )}
          </div>

          {/* Fields with ordering */}
          <div>
            <label className="text-xs text-slate-600 block mb-2">Fields to include (drag order with arrows — top of list prints first)</label>
            <FieldOrderList
              allFields={fields}
              selected={selectedFields}
              onChange={(next) => {
                const target = tpl.type === 'REPORT_CARD' ? 'studentFields' : 'fields';
                setCfg({ [target]: next });
              }}
            />
          </div>

          {/* Type-specific toggles */}
          {(tpl.type === 'STUDENT_ID' || tpl.type === 'TEACHER_ID') && (
            <>
              {/* Layout pickers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-slate-600">
                  Orientation
                  <select value={cfg.orientation || 'portrait'} onChange={e => setCfg({ orientation: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                    <option value="portrait">Portrait (tall)</option>
                    <option value="landscape">Landscape (wide)</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Layout — where the photo sits
                  <select value={cfg.layout || 'photo-left'} onChange={e => setCfg({ layout: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                    <option value="photo-left">Photo on left, fields on right</option>
                    <option value="photo-right">Photo on right, fields on left</option>
                    <option value="photo-top">Photo on top, fields below</option>
                    <option value="compact">Compact — small photo with fields</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!cfg.showQR} onChange={e => setCfg({ showQR: e.target.checked })} /> Show QR code
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!cfg.showPhoto} onChange={e => setCfg({ showPhoto: e.target.checked })} /> Show photo
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!cfg.showSession} onChange={e => setCfg({ showSession: e.target.checked })} /> Show session in footer
                </label>
              </div>

              {/* Back side */}
              <div className="border-t border-slate-200 pt-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                  <input type="checkbox" checked={!!cfg.backEnabled} onChange={e => setCfg({ backEnabled: e.target.checked })} />
                  Print a back side for each card
                </label>
                {cfg.backEnabled && (
                  <div className="mt-3 space-y-3">
                    <label className="text-xs text-slate-600 block">
                      Back text (one paragraph per blank line — terms, contact, lost-and-found note)
                      <textarea value={cfg.backText || ''} rows={5}
                        onChange={e => setCfg({ backText: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono" />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={!!cfg.backShowContactInfo}
                        onChange={e => setCfg({ backShowContactInfo: e.target.checked })} />
                      Print school address &amp; phone on back
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          {tpl.type === 'ADMIT_CARD' && (
            <>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!cfg.showPhoto} onChange={e => setCfg({ showPhoto: e.target.checked })} /> Show photo
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!cfg.showQR} onChange={e => setCfg({ showQR: e.target.checked })} /> Show QR code
                </label>
              </div>
              <label className="text-xs text-slate-600 block">
                Exam instructions (one per line)
                <textarea value={cfg.examInstructions || ''} rows={4}
                  onChange={e => setCfg({ examInstructions: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono" />
              </label>
              <label className="text-xs text-slate-600 block">
                Signature labels (comma-separated)
                <input value={(cfg.signatureLabels || []).join(', ')}
                  onChange={e => setCfg({ signatureLabels: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </label>
            </>
          )}

          {tpl.type === 'REPORT_CARD' && (
            <>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!cfg.showDiscipline} onChange={e => setCfg({ showDiscipline: e.target.checked })} /> Show discipline section
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!cfg.showRemarks} onChange={e => setCfg({ showRemarks: e.target.checked })} /> Show remarks line
                </label>
              </div>
              <label className="text-xs text-slate-600 block">
                Default remarks text
                <input value={cfg.remarksDefault || ''}
                  onChange={e => setCfg({ remarksDefault: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </label>
              <label className="text-xs text-slate-600 block">
                Signature labels (comma-separated)
                <input value={(cfg.signatureLabels || []).join(', ')}
                  onChange={e => setCfg({ signatureLabels: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-xs uppercase font-semibold text-slate-500 mb-3">Preview (sample data)</p>
        <TemplatePreview tpl={tpl} schoolLogo={schoolLogo} />
      </div>
    </div>
  );
}

function TemplatePreview({ tpl, schoolLogo }: { tpl: any; schoolLogo: string }) {
  const cfg = tpl.config;
  const effectiveLogo = cfg.logoUrl || schoolLogo || '';
  const isIdCard = tpl.type === 'STUDENT_ID' || tpl.type === 'TEACHER_ID';
  const sample: any = tpl.type === 'STUDENT_ID' ? {
    name: 'Aarav Sharma', class: 'Class 5', section: 'A', admissionNo: 'ADM-2026-0042',
    rollNumber: '12', fatherName: 'Rajesh Sharma', motherName: 'Priya Sharma',
    phone: '9876543210', bloodGroup: 'B+', dob: '12 Apr 2018',
  } : tpl.type === 'TEACHER_ID' ? {
    name: 'Mrs. Deeksha Mishra', designation: 'Class Teacher', employeeId: 'EMP-001',
    subjects: 'Math, Science', phone: '9911938387', qualification: 'M.Sc, B.Ed',
    bloodGroup: 'O+', dob: '15 Aug 1985',
  } : tpl.type === 'ADMIT_CARD' ? {
    name: 'Aarav Sharma', class: 'Class 10', section: 'B', admissionNo: 'ADM-2026-0042',
    rollNumber: '15', fatherName: 'Rajesh Sharma', examName: 'SA-2 (Annual)',
    examDates: '01–10 Mar 2026', examCenter: 'Main Building', subjects: 'English, Hindi, Math, Science, Social Studies',
  } : {
    name: 'Aarav Sharma', class: 'Class 5 - A', admissionNo: 'ADM-2026-0042',
    rollNumber: '12', fatherName: 'Rajesh Sharma', motherName: 'Priya Sharma',
    dob: '12 Apr 2018', address: 'Salarpur, Sector 101',
  };

  const fieldsList = (tpl.type === 'REPORT_CARD' ? cfg.studentFields : cfg.fields) || [];

  if (isIdCard) {
    const layout = cfg.layout || 'photo-left';
    const orientation = cfg.orientation || 'portrait';
    const isLandscape = orientation === 'landscape';

    const photoBox = cfg.showPhoto && (
      <div className={`shrink-0 rounded bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center text-white text-2xl font-bold ${layout === 'photo-top' ? 'w-20 h-24 mx-auto' : 'w-20 h-24'}`}>
        {sample.name.split(' ').map((s: string) => s[0]).slice(0, 2).join('')}
      </div>
    );
    const fieldsBox = (
      <div className="flex-1 text-[10px] space-y-1 leading-tight overflow-hidden">
        {fieldsList.map((k: string) => (
          <div key={k}>
            <span className="text-slate-400 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
            <p className="font-bold text-slate-900 truncate">{sample[k] || '—'}</p>
          </div>
        ))}
      </div>
    );
    const qrBox = cfg.showQR && (
      <div className="bg-white p-1 rounded border border-slate-200 self-center w-14 h-14 flex items-center justify-center text-[8px] text-slate-400 shrink-0">[QR]</div>
    );

    let body;
    if (layout === 'photo-top') {
      body = (
        <div className="p-3 flex flex-col gap-2">
          {photoBox}
          <div className="flex gap-2">{fieldsBox}{qrBox}</div>
        </div>
      );
    } else if (layout === 'photo-right') {
      body = <div className="p-3 flex gap-3">{qrBox}{fieldsBox}{photoBox}</div>;
    } else if (layout === 'compact') {
      body = <div className="p-2 flex gap-2 items-start">{photoBox}{fieldsBox}{qrBox}</div>;
    } else {
      body = <div className="p-3 flex gap-3">{photoBox}{fieldsBox}{qrBox}</div>;
    }

    const renderCard = (
      <div className={`border-2 rounded-xl overflow-hidden ${isLandscape ? 'max-w-md' : 'max-w-xs'}`} style={{ borderColor: cfg.primaryColor }}>
        <div className="text-center py-2 px-2" style={{ background: cfg.primaryColor, color: cfg.textColor || '#fff' }}>
          {effectiveLogo && <img src={effectiveLogo} alt="" className="h-8 mx-auto mb-1 object-contain" />}
          <p className="text-xs font-bold tracking-wider leading-tight">{cfg.headerLine1}</p>
          {cfg.headerLine2 && <p className="text-[9px] opacity-80 leading-tight">{cfg.headerLine2}</p>}
          {cfg.headerLine3 && <p className="text-[9px] opacity-80 leading-tight">{cfg.headerLine3}</p>}
          <p className="text-[10px] mt-1 opacity-90">{cfg.cardLabel}</p>
        </div>
        {body}
        <div className="text-center py-1 bg-slate-100 text-[9px] text-slate-500">{cfg.footer}</div>
      </div>
    );

    if (cfg.backEnabled) {
      return (
        <div className="space-y-3">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Front</div>
          {renderCard}
          <div className="text-[10px] uppercase font-semibold text-slate-400 mt-3">Back</div>
          <div className={`border-2 rounded-xl overflow-hidden ${isLandscape ? 'max-w-md' : 'max-w-xs'}`} style={{ borderColor: cfg.primaryColor }}>
            <div className="text-center py-1.5" style={{ background: cfg.primaryColor, color: cfg.textColor || '#fff' }}>
              <p className="text-[10px] font-bold tracking-wider">— BACK —</p>
            </div>
            <div className="p-3 text-[10px] text-slate-700 leading-relaxed whitespace-pre-line min-h-[8rem]">
              {cfg.backText || <span className="text-slate-400 italic">(empty — add back text in the editor above)</span>}
            </div>
            {cfg.backShowContactInfo && (
              <div className="text-[9px] text-slate-500 text-center px-3 py-2 border-t border-slate-200">
                {cfg.headerLine1} · {cfg.headerLine2 || ''}
              </div>
            )}
          </div>
        </div>
      );
    }
    return renderCard;
  }

  if (tpl.type === 'ADMIT_CARD') {
    return (
      <div className="max-w-md border-2 rounded-lg overflow-hidden" style={{ borderColor: cfg.primaryColor }}>
        <div className="text-center py-3 px-3" style={{ background: cfg.primaryColor, color: cfg.textColor || '#fff' }}>
          {effectiveLogo && <img src={effectiveLogo} alt="" className="h-10 mx-auto mb-1 object-contain" />}
          <p className="text-sm font-bold">{cfg.headerLine1}</p>
          {cfg.headerLine2 && <p className="text-[10px] opacity-80">{cfg.headerLine2}</p>}
          <p className="text-base font-bold mt-1">{cfg.cardLabel}</p>
        </div>
        <div className="p-4 grid grid-cols-2 gap-2 text-xs">
          {fieldsList.map((k: string) => (
            <div key={k}>
              <p className="text-slate-400 capitalize text-[10px]">{k.replace(/([A-Z])/g, ' $1')}</p>
              <p className="font-bold text-slate-900">{sample[k] || '—'}</p>
            </div>
          ))}
        </div>
        {cfg.examInstructions && (
          <div className="px-4 pb-2 text-[10px] text-slate-600 whitespace-pre-line border-t border-slate-200 pt-2">
            <strong>Instructions:</strong>
            <div className="mt-1">{cfg.examInstructions}</div>
          </div>
        )}
        <div className="px-4 pb-3 flex justify-between text-[10px] text-slate-500 mt-3">
          {(cfg.signatureLabels || []).map((s: string, i: number) => (
            <div key={i} className="text-center">
              <div className="border-t border-slate-400 w-24 pt-0.5">{s}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // REPORT_CARD preview
  return (
    <div className="border-2 rounded-lg overflow-hidden" style={{ borderColor: cfg.primaryColor }}>
      <div className="text-center py-3" style={{ background: cfg.primaryColor, color: cfg.textColor || '#fff' }}>
        {effectiveLogo && <img src={effectiveLogo} alt="" className="h-12 mx-auto mb-1 object-contain" />}
        <p className="text-base font-bold">{cfg.headerLine1}</p>
        {cfg.headerLine2 && <p className="text-[11px] opacity-80">{cfg.headerLine2}</p>}
        {cfg.headerLine3 && <p className="text-[11px] opacity-80">{cfg.headerLine3}</p>}
        <p className="text-sm font-bold mt-1">{cfg.cardLabel}</p>
      </div>
      <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {fieldsList.map((k: string) => (
          <div key={k}>
            <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}: </span>
            <span className="font-semibold text-slate-900">{sample[k] || '—'}</span>
          </div>
        ))}
      </div>
      <p className="px-4 text-[10px] text-slate-400 italic pb-2">[Subject marks table appears here when printed]</p>
      {cfg.showRemarks && (
        <p className="px-4 pb-2 text-xs">
          <strong>Remarks:</strong> <em className="text-slate-600">{cfg.remarksDefault}</em>
        </p>
      )}
      <div className="px-4 pb-3 flex justify-between text-[10px] text-slate-500 mt-3">
        {(cfg.signatureLabels || []).map((s: string, i: number) => (
          <div key={i} className="text-center">
            <div className="border-t border-slate-400 w-24 pt-0.5">{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Field selector with up/down ordering. Selected fields appear at top in
// their chosen order; unselected ones appear at bottom alphabetically.
function FieldOrderList({ allFields, selected, onChange }: {
  allFields: { key: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const labelByKey = new Map(allFields.map(f => [f.key, f.label]));
  const unselectedKeys = allFields.map(f => f.key).filter(k => !selected.includes(k));

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...selected];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };
  const moveDown = (idx: number) => {
    if (idx === selected.length - 1) return;
    const next = [...selected];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  };
  const remove = (key: string) => onChange(selected.filter(k => k !== key));
  const add = (key: string) => onChange([...selected, key]);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Selected, in order */}
      <div className="bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 uppercase">In card · drag with arrows</div>
      {selected.length === 0 && (
        <p className="px-3 py-2 text-xs text-slate-400 italic">No fields selected — pick from the list below.</p>
      )}
      {selected.map((key, idx) => (
        <div key={key} className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-white">
          <span className="text-sm text-slate-800">
            <span className="text-slate-400 text-xs mr-2">{idx + 1}.</span>
            {labelByKey.get(key) || key}
          </span>
          <div className="flex gap-1">
            <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0}
              className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded disabled:opacity-30">↑</button>
            <button type="button" onClick={() => moveDown(idx)} disabled={idx === selected.length - 1}
              className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded disabled:opacity-30">↓</button>
            <button type="button" onClick={() => remove(key)}
              className="px-2 py-0.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">Remove</button>
          </div>
        </div>
      ))}

      {/* Unselected — click to add */}
      {unselectedKeys.length > 0 && (
        <>
          <div className="bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase border-t border-slate-200">Available — click to add</div>
          <div className="px-3 py-2 flex flex-wrap gap-2 bg-white border-t border-slate-100">
            {unselectedKeys.map(key => (
              <button key={key} type="button" onClick={() => add(key)}
                className="px-2.5 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-blue-100 hover:text-blue-700">
                + {labelByKey.get(key) || key}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
