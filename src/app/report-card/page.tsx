'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { getAcademicYears, getCurrentAcademicYear } from '@/lib/utils';
import { Printer, Search } from 'lucide-react';

export default function ReportCardPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [academicYear, setAcademicYear] = useState(() => getCurrentAcademicYear());
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)); }, []);

  useEffect(() => {
    if (selectedClass) {
      api.get('/students', { params: { classId: selectedClass } }).then(r => setStudents(r.data));
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedStudent) {
      setLoading(true);
      api.get(`/report-card/${selectedStudent}`, { params: { academicYear } })
        .then(r => setReport(r.data))
        .catch(() => setReport(null))
        .finally(() => setLoading(false));
    }
  }, [selectedStudent, academicYear]);

  const filteredStudents = search
    ? students.filter((s: any) => `${s.user.firstName} ${s.user.lastName} ${s.admissionNo}`.toLowerCase().includes(search.toLowerCase()))
    : students;

  const handlePrint = () => {
    if (!report) return;
    const r = report;
    const s = r.student;

    const subjectRows = r.subjects.map((sub: any) => `
      <tr>
        <td style="padding:5px 8px;font-weight:500">${sub.name}</td>
        <td style="text-align:center;padding:5px 4px">${sub.ft1 ?? ''}</td>
        <td style="text-align:center;padding:5px 4px;font-weight:600">${sub.sa1 ?? ''}</td>
        <td style="text-align:center;padding:5px 4px;font-weight:700;background:#f0f9ff">${sub.term1 ?? ''}</td>
        <td style="text-align:center;padding:5px 4px">${sub.ft2 ?? ''}</td>
        <td style="text-align:center;padding:5px 4px;font-weight:600">${sub.sa2 ?? ''}</td>
        <td style="text-align:center;padding:5px 4px;font-weight:700;background:#f0fdf4">${sub.term2 ?? ''}</td>
        <td style="text-align:center;padding:5px 4px;font-weight:800;font-size:14px">${sub.total ?? ''}</td>
        <td style="text-align:center;padding:5px 4px;font-weight:700">${sub.grade}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>Report Card - ${s.name}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Times New Roman', serif; margin:20px; color:#1a1a1a; font-size:13px; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #333; }
  .header { text-align:center; margin-bottom:12px; }
  .school-name { font-size:20px; font-weight:bold; color:#006400; }
  .school-addr { font-size:11px; color:#444; }
  .title { background:#006400; color:white; text-align:center; padding:6px; font-size:14px; font-weight:bold; letter-spacing:1px; margin:8px 0; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:2px 24px; margin:8px 0; font-size:12px; }
  .info-grid span { font-weight:bold; }
  .section-head { background:#006400; color:white; text-align:center; padding:4px; font-size:12px; font-weight:bold; letter-spacing:2px; margin:10px 0 4px; }
  th { background:#e8f5e9; padding:5px 4px; font-size:11px; text-align:center; font-weight:600; }
  .total-row { background:#fffde7; font-weight:bold; }
  .result-box { border:2px solid #006400; padding:8px 16px; margin:10px 0; font-size:13px; }
  .sig-row { display:flex; justify-content:space-between; margin-top:50px; }
  .sig-line { border-top:1px solid #000; width:160px; text-align:center; padding-top:4px; font-size:11px; }
  @media print { body { margin:10px; } }
</style></head><body>
  <div class="header">
    <div class="school-name">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
    <div class="school-addr">Salarpur, Sector - 101</div>
    <div class="school-addr">Mobile - Contact no - 6397339902</div>
    <div class="school-addr">Reg: NCER/90001255</div>
  </div>

  <div class="title">REPORT CARD FOR ACADEMIC SESSION (${r.academicYear})</div>

  <div class="info-grid">
    <div>NAME : <span>${s.name}</span></div>
    <div>CLASS : <span>${s.class}</span></div>
    <div>MOTHER'S NAME : <span>${s.motherName || '—'}</span></div>
    <div>D.O.B : <span>${s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : '—'}</span></div>
    <div>FATHER'S NAME : <span>${s.fatherName || '—'}</span></div>
    <div>Adm. No : <span>${s.admissionNo || ''}</span></div>
    <div style="grid-column:span 2">ADDRESS : <span>${s.address || '—'}</span></div>
  </div>

  <div class="section-head">SCHOLASTIC AREAS</div>
  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width:18%">Subject</th>
        <th colspan="3" style="background:#bbdefb">Term - 1</th>
        <th colspan="3" style="background:#c8e6c9">Term - 2</th>
        <th colspan="2">Annual Result</th>
      </tr>
      <tr>
        <th style="background:#bbdefb">FT-1<br><span style="font-size:9px">Marks(20)</span></th>
        <th style="background:#bbdefb">SA-1<br><span style="font-size:9px">Marks(80)</span></th>
        <th style="background:#bbdefb">Term-1<br><span style="font-size:9px">Marks(100)</span></th>
        <th style="background:#c8e6c9">FT-2<br><span style="font-size:9px">Marks(20)</span></th>
        <th style="background:#c8e6c9">SA-2<br><span style="font-size:9px">Marks(80)</span></th>
        <th style="background:#c8e6c9">Term-2<br><span style="font-size:9px">Marks(100)</span></th>
        <th>TOTAL<br><span style="font-size:9px">MARKS</span></th>
        <th>GRADE</th>
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
      <tr class="total-row">
        <td style="padding:5px 8px;font-weight:bold">Total</td>
        <td style="text-align:center;padding:5px 4px"></td>
        <td style="text-align:center;padding:5px 4px"></td>
        <td style="text-align:center;padding:5px 4px;font-weight:bold">${r.totals.term1.marks}</td>
        <td style="text-align:center;padding:5px 4px"></td>
        <td style="text-align:center;padding:5px 4px"></td>
        <td style="text-align:center;padding:5px 4px;font-weight:bold">${r.totals.term2.marks}</td>
        <td style="text-align:center;padding:5px 4px;font-weight:bold;font-size:14px">${r.totals.annual.marks}</td>
        <td style="text-align:center;padding:5px 4px"></td>
      </tr>
      <tr class="total-row">
        <td style="padding:5px 8px">Percentage</td>
        <td colspan="2"></td>
        <td style="text-align:center;padding:5px 4px">${r.totals.term1.pct}%</td>
        <td colspan="2"></td>
        <td style="text-align:center;padding:5px 4px">${r.totals.term2.pct}%</td>
        <td colspan="2" style="text-align:center;padding:5px 4px;font-weight:bold;font-size:14px">${r.totals.annual.pct}%</td>
      </tr>
    </tbody>
  </table>

  <div class="section-head">DISCIPLINE (on a 5-point (A-E) grading scale)</div>
  <table style="width:50%;margin:0 auto 8px">
    <thead><tr><th style="width:60%">Subject</th><th>Grade</th></tr></thead>
    <tbody>
      <tr><td style="padding:4px 8px">Discipline</td><td style="text-align:center;padding:4px 8px;font-weight:bold">—</td></tr>
    </tbody>
  </table>

  <div style="margin:8px 0;font-size:12px"><strong>CLASS TEACHER'S REMARKS :</strong> ........................................................................</div>
  <div style="margin:6px 0;font-size:12px">Congratulations and best of luck for the next session.</div>

  <div class="result-box">
    <strong>RESULT :</strong> ${r.summary.result === 'Promoted' ? `Promoted to class <u><strong>${r.summary.promotedTo || '__'}</strong></u>` : '<span style="color:red">Detained</span>'}
  </div>

  <div style="display:flex;justify-content:space-between;font-size:11px;margin:8px 0">
    <div>Issue date: ${r.dates.issueDate}</div>
    <div>School Reopen on: ${r.dates.schoolReopen}</div>
  </div>

  <div class="sig-row">
    <div class="sig-line">CLASS TEACHER</div>
    <div class="sig-line">PRINCIPAL</div>
    <div class="sig-line">PARENT</div>
  </div>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Report Card</h1>
          {report && (
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 text-sm">
              <Printer className="h-4 w-4" /> Print Report Card
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); setReport(null); }}
              className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
              <option value="">Select Class</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
              {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {selectedClass && (
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900" />
              </div>
            )}
          </div>
          {selectedClass && (
            <div className="flex gap-2 flex-wrap mt-3 max-h-24 overflow-y-auto">
              {filteredStudents.map((s: any) => (
                <button key={s.id} onClick={() => setSelectedStudent(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${selectedStudent === s.id ? 'bg-green-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {s.user.firstName} {s.user.lastName} <span className="opacity-60">({s.admissionNo})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700 mx-auto"></div></div>}

        {/* Report Card Preview — matches physical template */}
        {report && !loading && (
          <div className="bg-white rounded-xl border-2 border-green-800 overflow-hidden">
            {/* School Header */}
            <div className="text-center py-4 border-b-2 border-green-800">
              <h1 className="text-xl font-bold" style={{ color: '#006400' }}>PATHAK EDUCATIONAL FOUNDATION SCHOOL</h1>
              <p className="text-xs text-slate-500">Salarpur, Sector - 101 | Mobile: 6397339902 | Reg: NCER/90001255</p>
            </div>

            {/* Title */}
            <div className="text-center py-2 text-white font-bold text-sm tracking-wider" style={{ background: '#006400' }}>
              REPORT CARD FOR ACADEMIC SESSION ({report.academicYear})
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 p-4 text-sm border-b border-slate-200">
              <div className="flex gap-2">
                <span className="text-slate-500 w-32">NAME</span>
                <span className="font-bold text-slate-900">: {report.student.name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-20">CLASS</span>
                <span className="font-bold text-slate-900">: {report.student.class}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-32">MOTHER'S NAME</span>
                <span className="font-bold text-slate-900">: {report.student.motherName || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-20">D.O.B</span>
                <span className="font-bold text-slate-900">: {report.student.dob ? new Date(report.student.dob).toLocaleDateString('en-IN') : '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-32">FATHER'S NAME</span>
                <span className="font-bold text-slate-900">: {report.student.fatherName || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-20">Adm No.</span>
                <span className="font-bold text-slate-900">: {report.student.admissionNo}</span>
              </div>
            </div>

            {/* SCHOLASTIC AREAS */}
            <div className="text-center py-1.5 text-white font-bold text-xs tracking-[3px]" style={{ background: '#006400' }}>
              SCHOLASTIC AREAS
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700 bg-slate-50 w-[16%]">Subject</th>
                    <th colSpan={3} className="border border-slate-300 px-2 py-1.5 text-center font-bold text-blue-800 bg-blue-50">Term - 1</th>
                    <th colSpan={3} className="border border-slate-300 px-2 py-1.5 text-center font-bold text-green-800 bg-green-50">Term - 2</th>
                    <th colSpan={2} className="border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-800 bg-slate-50">Annual Result</th>
                  </tr>
                  <tr>
                    <th className="border border-slate-300 px-1 py-1.5 text-center bg-blue-50 text-blue-700">FT-1<br /><span className="text-[9px] font-normal">Marks(20)</span></th>
                    <th className="border border-slate-300 px-1 py-1.5 text-center bg-blue-50 text-blue-700">SA-1<br /><span className="text-[9px] font-normal">Marks(80)</span></th>
                    <th className="border border-slate-300 px-1 py-1.5 text-center bg-blue-100 text-blue-800 font-bold">Term-1<br /><span className="text-[9px] font-normal">Marks(100)</span></th>
                    <th className="border border-slate-300 px-1 py-1.5 text-center bg-green-50 text-green-700">FT-2<br /><span className="text-[9px] font-normal">Marks(20)</span></th>
                    <th className="border border-slate-300 px-1 py-1.5 text-center bg-green-50 text-green-700">SA-2<br /><span className="text-[9px] font-normal">Marks(80)</span></th>
                    <th className="border border-slate-300 px-1 py-1.5 text-center bg-green-100 text-green-800 font-bold">Term-2<br /><span className="text-[9px] font-normal">Marks(100)</span></th>
                    <th className="border border-slate-300 px-1 py-1.5 text-center bg-slate-100 font-bold">TOTAL<br /><span className="text-[9px] font-normal">MARKS</span></th>
                    <th className="border border-slate-300 px-1 py-1.5 text-center bg-slate-100 font-bold">GRADE</th>
                  </tr>
                </thead>
                <tbody>
                  {report.subjects.map((sub: any) => (
                    <tr key={sub.code || sub.name} className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-3 py-2 font-medium text-slate-900">{sub.name}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center">{sub.ft1 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center font-medium">{sub.sa1 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center font-bold bg-blue-50">{sub.term1 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center">{sub.ft2 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center font-medium">{sub.sa2 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center font-bold bg-green-50">{sub.term2 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center font-extrabold text-sm">{sub.total ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center font-bold">{sub.grade}</td>
                    </tr>
                  ))}
                  {/* Totals */}
                  <tr className="bg-amber-50 font-bold">
                    <td className="border border-slate-300 px-3 py-2">Total</td>
                    <td className="border border-slate-300 px-1 py-2 text-center"></td>
                    <td className="border border-slate-300 px-1 py-2 text-center"></td>
                    <td className="border border-slate-300 px-1 py-2 text-center text-blue-800">{report.totals.term1.marks}</td>
                    <td className="border border-slate-300 px-1 py-2 text-center"></td>
                    <td className="border border-slate-300 px-1 py-2 text-center"></td>
                    <td className="border border-slate-300 px-1 py-2 text-center text-green-800">{report.totals.term2.marks}</td>
                    <td className="border border-slate-300 px-1 py-2 text-center text-sm">{report.totals.annual.marks}</td>
                    <td className="border border-slate-300 px-1 py-2 text-center"></td>
                  </tr>
                  <tr className="bg-amber-50">
                    <td className="border border-slate-300 px-3 py-2 font-medium">Percentage</td>
                    <td colSpan={2} className="border border-slate-300"></td>
                    <td className="border border-slate-300 px-1 py-2 text-center font-bold text-blue-800">{report.totals.term1.pct}%</td>
                    <td colSpan={2} className="border border-slate-300"></td>
                    <td className="border border-slate-300 px-1 py-2 text-center font-bold text-green-800">{report.totals.term2.pct}%</td>
                    <td colSpan={2} className="border border-slate-300 px-1 py-2 text-center font-extrabold text-sm">{report.totals.annual.pct}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Discipline */}
            <div className="text-center py-1.5 text-white font-bold text-xs tracking-[3px] mt-2" style={{ background: '#006400' }}>
              DISCIPLINE (on a 5-point (A-E) grading scale)
            </div>
            <div className="flex justify-center py-2">
              <table className="w-1/2 text-xs">
                <thead>
                  <tr>
                    <th className="border border-slate-300 px-3 py-1.5 bg-slate-50 text-left">Subject</th>
                    <th className="border border-slate-300 px-3 py-1.5 bg-slate-50 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 px-3 py-1.5">Discipline</td>
                    <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Teacher remarks + Result */}
            <div className="p-4 space-y-3 text-sm">
              <div><strong>CLASS TEACHER'S REMARKS :</strong> <span className="text-slate-400">........................................................................................................................</span></div>
              <p className="text-slate-600 italic">Congratulations and best of luck for the next session.</p>

              <div className="border-2 rounded-lg p-3 flex items-center gap-2" style={{ borderColor: '#006400' }}>
                <strong>RESULT :</strong>
                {report.summary.result === 'Promoted' ? (
                  <span>Promoted to class <strong className="underline text-green-800">{report.summary.promotedTo || '__'}</strong></span>
                ) : (
                  <span className="text-red-600 font-bold">Detained</span>
                )}
              </div>

              <div className="flex justify-between text-xs text-slate-500">
                <span>Issue date: {report.dates.issueDate}</span>
                <span>School Reopen on: {report.dates.schoolReopen}</span>
              </div>
            </div>

            {/* Signatures */}
            <div className="flex justify-between px-8 pb-6 pt-10">
              <div className="text-center">
                <div className="border-t border-black w-36"></div>
                <p className="text-xs text-slate-600 mt-1 font-medium">CLASS TEACHER</p>
              </div>
              <div className="text-center">
                <div className="border-t border-black w-36"></div>
                <p className="text-xs text-slate-600 mt-1 font-medium">PRINCIPAL</p>
              </div>
              <div className="text-center">
                <div className="border-t border-black w-36"></div>
                <p className="text-xs text-slate-600 mt-1 font-medium">PARENT</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
