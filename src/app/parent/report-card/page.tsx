'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { getAcademicYears, getCurrentAcademicYear, formatCurrency } from '@/lib/utils';
import { BookOpen, Printer } from 'lucide-react';

export default function ParentReportCardPage() {
  const { user } = useAuthStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [academicYear, setAcademicYear] = useState(() => getCurrentAcademicYear());
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/parent/children?userId=${user.id}`).then(r => {
      setChildren(r.data.children);
      if (r.data.children.length > 0) setSelectedChild(r.data.children[0].id);
    }).finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!selectedChild) return;
    setReport(null);
    api.get(`/report-card/${selectedChild}`, { params: { academicYear } })
      .then(r => setReport(r.data))
      .catch(() => setReport(null));
  }, [selectedChild, academicYear]);

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Report Card</h1>

        {/* Selectors */}
        <div className="flex gap-3 flex-wrap items-center">
          {children.length > 1 && (
            <div className="flex gap-2">
              {children.map(c => (
                <button key={c.id} onClick={() => setSelectedChild(c.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${selectedChild === c.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
            {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {!report ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
            No report card data available
          </div>
        ) : (
          <div className="bg-white rounded-xl border-2 border-green-800 overflow-hidden">
            {/* Header */}
            <div className="text-center py-4 border-b-2 border-green-800">
              <h2 className="text-xl font-bold" style={{ color: '#006400' }}>PATHAK EDUCATIONAL FOUNDATION SCHOOL</h2>
              <p className="text-xs text-slate-500">Salarpur, Sector - 101</p>
            </div>
            <div className="text-center py-2 text-white font-bold text-sm tracking-wider" style={{ background: '#006400' }}>
              REPORT CARD FOR ACADEMIC SESSION ({report.academicYear})
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 p-4 text-sm border-b border-slate-200">
              <div><span className="text-slate-500 w-24 inline-block">Name</span>: <strong>{report.student.name}</strong></div>
              <div><span className="text-slate-500 w-16 inline-block">Class</span>: <strong>{report.student.class}</strong></div>
              <div><span className="text-slate-500 w-24 inline-block">Father</span>: <strong>{report.student.fatherName || '—'}</strong></div>
              <div><span className="text-slate-500 w-16 inline-block">DOB</span>: <strong>{report.student.dob ? new Date(report.student.dob).toLocaleDateString('en-IN') : '—'}</strong></div>
            </div>

            {/* Results Summary */}
            <div className="grid grid-cols-4 gap-3 p-4">
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-600 font-medium">Percentage</p>
                <p className="text-2xl font-bold text-blue-800">{report.summary.percentage}%</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 font-medium">Rank</p>
                <p className="text-2xl font-bold text-slate-800">{report.summary.rank}/{report.summary.totalStudentsInClass}</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 font-medium">Grade</p>
                <p className="text-2xl font-bold text-slate-800">{report.summary.grade}</p>
              </div>
              <div className={`text-center p-3 rounded-xl ${report.summary.result === 'Promoted' ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-xs text-slate-500 font-medium">Result</p>
                <p className={`text-xl font-bold ${report.summary.result === 'Promoted' ? 'text-green-700' : 'text-red-700'}`}>{report.summary.result}</p>
              </div>
            </div>

            {/* Subject Table */}
            <div className="overflow-x-auto px-2 pb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left bg-slate-50">Subject</th>
                    <th colSpan={3} className="border border-slate-300 px-2 py-1 text-center bg-blue-50 text-blue-800">Term - 1</th>
                    <th colSpan={3} className="border border-slate-300 px-2 py-1 text-center bg-green-50 text-green-800">Term - 2</th>
                    <th className="border border-slate-300 px-2 py-1 text-center bg-slate-100">Total</th>
                    <th className="border border-slate-300 px-2 py-1 text-center bg-slate-100">Grade</th>
                  </tr>
                  <tr>
                    <th className="border border-slate-300 px-1 py-1 text-center bg-blue-50 text-[10px]">FT-1 (20)</th>
                    <th className="border border-slate-300 px-1 py-1 text-center bg-blue-50 text-[10px]">SA-1 (80)</th>
                    <th className="border border-slate-300 px-1 py-1 text-center bg-blue-100 text-[10px]">Term-1</th>
                    <th className="border border-slate-300 px-1 py-1 text-center bg-green-50 text-[10px]">FT-2 (20)</th>
                    <th className="border border-slate-300 px-1 py-1 text-center bg-green-50 text-[10px]">SA-2 (80)</th>
                    <th className="border border-slate-300 px-1 py-1 text-center bg-green-100 text-[10px]">Term-2</th>
                    <th className="border border-slate-300 px-1 py-1 text-center bg-slate-100 text-[10px]">200</th>
                    <th className="border border-slate-300 px-1 py-1 text-center bg-slate-100 text-[10px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {report.subjects.map((s: any) => (
                    <tr key={s.name}>
                      <td className="border border-slate-300 px-3 py-2 font-medium">{s.name}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center">{s.ft1 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center">{s.sa1 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center font-bold bg-blue-50">{s.term1 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center">{s.ft2 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center">{s.sa2 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center font-bold bg-green-50">{s.term2 ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center font-extrabold">{s.total ?? '—'}</td>
                      <td className="border border-slate-300 px-1 py-2 text-center font-bold">{s.grade}</td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50 font-bold">
                    <td className="border border-slate-300 px-3 py-2">Total</td>
                    <td className="border border-slate-300" colSpan={2}></td>
                    <td className="border border-slate-300 px-1 py-2 text-center">{report.totals.term1.marks}</td>
                    <td className="border border-slate-300" colSpan={2}></td>
                    <td className="border border-slate-300 px-1 py-2 text-center">{report.totals.term2.marks}</td>
                    <td className="border border-slate-300 px-1 py-2 text-center">{report.totals.annual.marks}</td>
                    <td className="border border-slate-300"></td>
                  </tr>
                  <tr className="bg-amber-50">
                    <td className="border border-slate-300 px-3 py-2 font-medium">Percentage</td>
                    <td className="border border-slate-300" colSpan={2}></td>
                    <td className="border border-slate-300 px-1 py-2 text-center font-bold">{report.totals.term1.pct}%</td>
                    <td className="border border-slate-300" colSpan={2}></td>
                    <td className="border border-slate-300 px-1 py-2 text-center font-bold">{report.totals.term2.pct}%</td>
                    <td className="border border-slate-300 px-1 py-2 text-center font-extrabold" colSpan={2}>{report.totals.annual.pct}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Result */}
            <div className="mx-4 mb-4 border-2 rounded-lg p-3 text-sm" style={{ borderColor: '#006400' }}>
              <strong>RESULT:</strong> {report.summary.result === 'Promoted' ? <span>Promoted to class <strong className="text-green-800">{report.summary.promotedTo}</strong></span> : <span className="text-red-600 font-bold">Detained</span>}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
