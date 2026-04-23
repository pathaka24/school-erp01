'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowLeft, X } from 'lucide-react';

type Row = {
  firstName: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  fatherName?: string;
  motherName?: string;
  fatherPhone?: string;
  contact?: string;
  aadhaarNumber?: string;
  caste?: string;
};

type ParsedRow = Row & {
  _raw?: Record<string, string>;
  _warnings: string[];
};

const COLUMN_ALIASES: Record<string, keyof Row> = {
  // student name variants
  'student_name': 'firstName',
  'studentname': 'firstName',
  'student name': 'firstName',
  'name': 'firstName',
  'firstname': 'firstName',
  'first name': 'firstName',
  'lastname': 'lastName',
  'last name': 'lastName',
  // father
  "father's name": 'fatherName',
  'fathers name': 'fatherName',
  'father name': 'fatherName',
  'fathername': 'fatherName',
  'father': 'fatherName',
  // mother
  "mother's name": 'motherName',
  "mothe's rname": 'motherName', // handle the typo in the user's sheet
  "mother's rname": 'motherName',
  'mothers name': 'motherName',
  'mother name': 'motherName',
  'mothername': 'motherName',
  'mother': 'motherName',
  // dob
  'dob': 'dateOfBirth',
  'dateofbirth': 'dateOfBirth',
  'date of birth': 'dateOfBirth',
  'birthdate': 'dateOfBirth',
  // aadhar
  'aadhar number': 'aadhaarNumber',
  'aadhaar number': 'aadhaarNumber',
  'aadhar': 'aadhaarNumber',
  'aadhaar': 'aadhaarNumber',
  'aadhaarnumber': 'aadhaarNumber',
  // contact
  'contact': 'contact',
  'phone': 'contact',
  'mobile': 'contact',
  'contactnumber': 'contact',
  'contact number': 'contact',
  // caste
  'caste': 'caste',
  'category': 'caste',
  // gender
  'gender': 'gender',
  'sex': 'gender',
};

function normalizeKey(k: string): string {
  return k.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Take first non-empty line of a multi-line bilingual cell (English line is usually first).
function firstLine(v: string | undefined): string {
  if (!v) return '';
  const lines = String(v).split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
  return lines[0] || '';
}

function splitFirstLast(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function validateRow(r: ParsedRow, existingAdmissionNos: Set<string>): ParsedRow {
  const warnings: string[] = [];
  if (!r.firstName) warnings.push('Missing firstName');
  if (!r.dateOfBirth) warnings.push('DOB blank — will default to 1900-01-01');
  if (!r.gender) warnings.push('Gender blank — will default to OTHER');
  return { ...r, _warnings: warnings };
}

export default function ImportStudentsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [feePlan, setFeePlan] = useState<any>(null);
  const [applyClassCharges, setApplyClassCharges] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/classes'), api.get('/settings/fee-plan')]).then(([classesRes, feePlanRes]) => {
      setClasses(classesRes.data);
      setFeePlan(feePlanRes.data);
      // Default to Class 1 + Section A
      const class1 = classesRes.data.find((c: any) => c.name === 'Class 1' || c.numericGrade === 1);
      if (class1) {
        setClassId(class1.id);
        const secA = class1.sections?.find((s: any) => s.name === 'A');
        if (secA) setSectionId(secA.id);
        else if (class1.sections?.[0]) setSectionId(class1.sections[0].id);
      }
    });
  }, []);

  const classPlan = feePlan?.classes?.find((c: any) => c.classId === classId);
  const presetCharges = (classPlan?.charges || []).filter((c: any) => (parseFloat(c.amount) || 0) > 0);
  const presetTotal = presetCharges.reduce((s: number, c: any) => s + (parseFloat(c.amount) || 0), 0);

  const selectedClass = classes.find(c => c.id === classId);
  const sections = selectedClass?.sections || [];

  const handleFile = async (file: File) => {
    setParsing(true);
    setError('');
    setResult(null);
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

      const rows: ParsedRow[] = raw.map((r): ParsedRow => {
        // Build a normalized key map
        const normalized: Record<string, string> = {};
        for (const [k, v] of Object.entries(r)) {
          normalized[normalizeKey(k)] = String(v ?? '').trim();
        }

        // Map aliases → canonical field
        const mapped: Row = {} as any;
        for (const [key, val] of Object.entries(normalized)) {
          const field = COLUMN_ALIASES[key];
          if (field && !mapped[field]) mapped[field] = val;
        }

        // Student_Name → split English first line into firstName + lastName
        const studentEn = firstLine(mapped.firstName);
        const { firstName, lastName } = splitFirstLast(studentEn);
        mapped.firstName = firstName;
        if (lastName && !mapped.lastName) mapped.lastName = lastName;

        // Parents: take first (English) line
        if (mapped.fatherName) mapped.fatherName = firstLine(mapped.fatherName);
        if (mapped.motherName) mapped.motherName = firstLine(mapped.motherName);

        return validateRow({ ...mapped, _raw: normalized, _warnings: [] }, new Set());
      }).filter(r => r.firstName || Object.values(r._raw || {}).some(v => v));

      setParsed(rows);
    } catch (e: any) {
      setError('Failed to parse file: ' + (e.message || String(e)));
    } finally {
      setParsing(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['Student_Name', "Father's Name", "Mother's Name", 'DOB', 'Gender', 'Aadhar number', 'CONTACT', 'caste'];
    const sample = [
      ['VISHNU', 'RAJ KUMAR', 'RAKHI', '2/1/2016', 'MALE', '838077942976', '7500882093', ''],
      ['POOJA DEVI', 'NARENDRA', 'NEELAM DEVI', '10/3/2018', 'FEMALE', '', '7291907591', ''],
    ];
    const csv = [headers, ...sample].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCommit = async () => {
    if (!classId || !sectionId) return setError('Select class and section');
    if (parsed.length === 0) return setError('No rows to import');
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/students/import', {
        classId, sectionId,
        applyClassCharges,
        rows: parsed.map(r => ({
          firstName: r.firstName,
          lastName: r.lastName,
          dateOfBirth: r.dateOfBirth,
          gender: r.gender,
          fatherName: r.fatherName,
          motherName: r.motherName,
          fatherPhone: r.fatherPhone,
          contact: r.contact,
          aadhaarNumber: r.aadhaarNumber,
          caste: r.caste,
        })),
      });
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setParsed([]);
    setFileName('');
    setResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  // ─── Result view ───
  if (result) {
    return (
      <DashboardLayout>
        <PageTransition>
          <div className="max-w-4xl mx-auto space-y-6">
            <FadeIn>
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Import complete</h2>
                    <p className="text-sm text-slate-500">
                      {result.summary.successful} of {result.summary.total} students imported successfully
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-xl p-4"><p className="text-xs text-slate-500">Total rows</p><p className="text-2xl font-bold text-slate-900">{result.summary.total}</p></div>
                  <div className="bg-green-50 rounded-xl p-4"><p className="text-xs text-green-600">Created</p><p className="text-2xl font-bold text-green-700">{result.summary.successful}</p></div>
                  <div className="bg-red-50 rounded-xl p-4"><p className="text-xs text-red-600">Failed</p><p className="text-2xl font-bold text-red-700">{result.summary.failed}</p></div>
                </div>

                {result.created?.length > 0 && (
                  <details className="mb-4">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700 mb-2">Show created students ({result.created.length})</summary>
                    <div className="mt-2 bg-slate-50 rounded-lg p-3 max-h-64 overflow-y-auto text-sm font-mono">
                      {result.created.map((c: any) => (
                        <div key={c.studentId}>{c.admissionNo} — {c.name}</div>
                      ))}
                    </div>
                  </details>
                )}

                {result.failed?.length > 0 && (
                  <details open>
                    <summary className="cursor-pointer text-sm font-medium text-red-700 mb-2">Failed rows ({result.failed.length})</summary>
                    <div className="mt-2 bg-red-50 rounded-lg p-3 max-h-64 overflow-y-auto text-sm">
                      {result.failed.map((f: any, i: number) => (
                        <div key={i} className="py-1 border-b border-red-100 last:border-0">
                          <span className="font-medium text-red-800">Row {f.rowIndex + 1}:</span>{' '}
                          <span className="text-red-600">{f.error}</span>{' — '}
                          <span className="text-slate-600">{f.row?.firstName || '(no name)'}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="flex gap-2 mt-6">
                  <Button variant="outline" onClick={handleReset}>Import another file</Button>
                  <Button onClick={() => router.push('/students')}>Go to students</Button>
                </div>
              </div>
            </FadeIn>
          </div>
        </PageTransition>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="max-w-6xl mx-auto space-y-6">
          <FadeIn>
            <div className="flex items-center justify-between">
              <div>
                <button onClick={() => router.push('/students')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Students
                </button>
                <h1 className="text-2xl font-bold text-slate-900">Import Students</h1>
                <p className="text-sm text-slate-500">Upload an Excel or CSV file to bulk-create student records. Missing fields default to placeholders — fix later per student.</p>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Download Template
              </Button>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <Card>
              <CardHeader><CardTitle>1. Target Class &amp; Section</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Class *</label>
                    <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900">
                      <option value="">Select class</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Section *</label>
                    <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 disabled:bg-slate-50">
                      <option value="">Select section</option>
                      {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">All imported students will be assigned to this class and section.</p>
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.15}>
            <Card>
              <CardHeader><CardTitle>2. Admission Charges</CardTitle></CardHeader>
              <CardContent>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={applyClassCharges} onChange={e => setApplyClassCharges(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <div>
                    <span className="text-sm font-medium text-slate-900">Auto-apply class admission charges to each student</span>
                    <p className="text-xs text-slate-500 mt-0.5">Creates fee ledger entries for dress, tie/belt, books, copy, dairy, admission charge, annual, registration etc. based on the Annual Fee Plan for the selected class.</p>
                  </div>
                </label>

                {applyClassCharges && classId && (
                  <div className="mt-4">
                    {presetCharges.length > 0 ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-blue-900">Each student will be charged</p>
                          <p className="text-2xl font-bold text-blue-800">₹{presetTotal.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                          {presetCharges.map((c: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs bg-white rounded px-2.5 py-1.5">
                              <span className="text-slate-600">{c.description}</span>
                              <span className="font-semibold text-slate-900">₹{parseFloat(c.amount).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>
                        {parsed.length > 0 && (
                          <p className="text-xs text-blue-700 mt-3">
                            Total across {parsed.length} students: <strong>₹{(presetTotal * parsed.length).toLocaleString('en-IN')}</strong>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                        No charges defined for this class. Set them in <button onClick={() => router.push('/settings')} className="underline font-medium">Settings → Annual Fee Plan</button>, or uncheck to skip.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.2}>
            <Card>
              <CardHeader><CardTitle>3. Upload File</CardTitle></CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition"
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500', 'bg-blue-50'); }}
                  onDragLeave={e => { e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50'); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                  }}>
                  <FileSpreadsheet className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 mb-3">Drag and drop your file here, or</p>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                    className="hidden" />
                  <Button variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Choose file
                  </Button>
                  <p className="text-xs text-slate-400 mt-3">Accepts .xlsx, .xls, .csv</p>
                </div>
                {fileName && (
                  <div className="mt-3 flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
                    <span className="text-sm text-slate-700 font-medium truncate">{fileName}</span>
                    <button onClick={handleReset} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                )}
                {parsing && <p className="text-sm text-blue-600 mt-3">Parsing...</p>}
                {error && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeIn>

          {parsed.length > 0 && (
            <FadeIn delay={0.3}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>4. Preview ({parsed.length} rows)</CardTitle>
                    <Button onClick={handleCommit} disabled={submitting || !classId || !sectionId}>
                      {submitting ? 'Importing...' : `Import ${parsed.length} students`}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">#</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Name</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">DOB</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Gender</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Father</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Mother</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Aadhar</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Contact</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsed.map((r, i) => (
                          <tr key={i} className={`hover:bg-slate-50 ${!r.firstName ? 'bg-red-50' : ''}`}>
                            <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2 text-sm font-medium text-slate-900">{r.firstName} {r.lastName}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{r.dateOfBirth || <span className="text-slate-400">—</span>}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{r.gender || <span className="text-slate-400">OTHER</span>}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{r.fatherName || <span className="text-slate-400">—</span>}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{r.motherName || <span className="text-slate-400">—</span>}</td>
                            <td className="px-3 py-2 text-xs text-slate-600 font-mono">{r.aadhaarNumber || <span className="text-slate-400">—</span>}</td>
                            <td className="px-3 py-2 text-xs text-slate-600 font-mono">{r.contact || r.fatherPhone || <span className="text-slate-400">—</span>}</td>
                            <td className="px-3 py-2 text-xs">
                              {!r.firstName && <Badge variant="danger">No name</Badge>}
                              {r._warnings.length > 0 && r.firstName && (
                                <span className="text-amber-600" title={r._warnings.join('\n')}>
                                  {r._warnings.length} warning{r._warnings.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {r.firstName && r._warnings.length === 0 && <span className="text-green-600">✓</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
