'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const STUDENT_TEMPLATE = {
  admissionNo: 'STU2026001',
  firstName: 'Ravi',
  lastName: 'Kumar',
  email: 'ravi.kumar@example.com',
  password: 'student123',
  dateOfBirth: '2015-04-12',
  gender: 'MALE',
  bloodGroup: 'O+',
  classId: '<class-uuid-from-academics>',
  sectionId: '<section-uuid-from-academics>',
  rollNumber: '12',
  fatherName: 'Suresh Kumar',
  fatherPhone: '9876543210',
  motherName: 'Anita Kumar',
  motherPhone: '9876543211',
  address: '123 MG Road',
  city: 'Bangalore',
  state: 'Karnataka',
  pincode: '560001',
};

const TEACHER_TEMPLATE = {
  employeeId: 'EMP001',
  firstName: 'Priya',
  lastName: 'Sharma',
  email: 'priya@school.com',
  password: 'teacher123',
  phone: '9876543210',
  designation: 'PGT',
  department: 'Science',
  qualification: 'MSc, BEd',
  specialization: 'Physics',
  experience: 5,
  dateOfBirth: '1985-06-15',
  gender: 'FEMALE',
  salary: 45000,
};

export default function BulkImportPage() {
  const [tab, setTab] = useState<'students' | 'teachers'>('students');
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)).catch(() => {}); }, []);

  const downloadTemplate = () => {
    const data = tab === 'students' ? [STUDENT_TEMPLATE] : [TEACHER_TEMPLATE];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab === 'students' ? 'Students' : 'Teachers');
    XLSX.writeFile(wb, `${tab}-import-template.xlsx`);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws);
    setRows(json);
  };

  const upload = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/import/${tab}`, { rows });
      setResult(data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Bulk Import</h1>
        </div>

        <div className="flex gap-2 border-b border-slate-200">
          {(['students', 'teachers'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setRows([]); setResult(null); setFileName(''); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition capitalize ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <FileSpreadsheet className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-slate-700">
              <p className="font-medium text-slate-900">How to use:</p>
              <ol className="list-decimal list-inside mt-1 space-y-0.5 text-slate-600">
                <li>Download the template (.xlsx)</li>
                <li>Fill in your {tab} data — one row per record</li>
                {tab === 'students' && <li>For <code className="text-xs bg-white px-1 rounded">classId</code> / <code className="text-xs bg-white px-1 rounded">sectionId</code>, copy UUIDs from the Academics page (or see below)</li>}
                <li>Upload the filled file and click Import</li>
              </ol>
            </div>
            <button onClick={downloadTemplate} className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm flex-shrink-0">
              <Download className="h-4 w-4" /> Template
            </button>
          </div>

          {tab === 'students' && classes.length > 0 && (
            <details className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Class & Section IDs reference</summary>
              <table className="w-full mt-2 text-xs">
                <thead className="text-slate-500"><tr><th className="text-left p-1">Class</th><th className="text-left p-1">classId</th><th className="text-left p-1">Section</th><th className="text-left p-1">sectionId</th></tr></thead>
                <tbody>
                  {classes.flatMap((c: any) => (c.sections || []).map((s: any) => (
                    <tr key={s.id} className="border-t border-slate-200">
                      <td className="p-1">{c.name}</td>
                      <td className="p-1 font-mono text-slate-600">{c.id}</td>
                      <td className="p-1">{s.name}</td>
                      <td className="p-1 font-mono text-slate-600">{s.id}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </details>
          )}

          <div>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Upload .xlsx or .csv file</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="block w-full text-sm text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
              />
            </label>
          </div>

          {fileName && (
            <div className="text-sm text-slate-600">
              Loaded <strong>{fileName}</strong> — {rows.length} rows
            </div>
          )}

          {rows.length > 0 && !result && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-64 overflow-auto">
                <p className="text-xs font-medium text-slate-500 mb-2">Preview (first 5 rows):</p>
                <table className="w-full text-xs">
                  <thead><tr>{Object.keys(rows[0]).slice(0, 6).map(k => <th key={k} className="text-left text-slate-500 p-1">{k}</th>)}</tr></thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, idx) => (
                      <tr key={idx} className="border-t border-slate-200">
                        {Object.keys(rows[0]).slice(0, 6).map(k => <td key={k} className="p-1 text-slate-700">{String(r[k] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={upload}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Upload className="h-4 w-4" /> {busy ? 'Importing...' : `Import ${rows.length} ${tab}`}
              </button>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{result.created}</p>
                  <p className="text-xs text-emerald-600">Created</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                  <p className="text-xs text-amber-600">Skipped (already exist)</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
                  <p className="text-xs text-red-600">Errors</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-48 overflow-auto">
                  <p className="text-xs font-medium text-red-700 mb-2">Errors:</p>
                  <ul className="text-xs text-red-700 space-y-1">
                    {result.errors.map((e: any, i: number) => (
                      <li key={i}>Row {e.row}: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
