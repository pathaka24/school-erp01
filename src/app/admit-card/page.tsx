'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { Printer, CreditCard } from 'lucide-react';

export default function AdmitCardPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [examDetail, setExamDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)); }, []);

  useEffect(() => {
    if (selectedClass) {
      api.get('/exams', { params: { classId: selectedClass } }).then(r => setExams(r.data));
      api.get('/students', { params: { classId: selectedClass } }).then(r => setStudents(r.data));
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedExam) {
      setLoading(true);
      api.get(`/exams/${selectedExam}`).then(r => setExamDetail(r.data)).finally(() => setLoading(false));
    }
  }, [selectedExam]);

  const cls = classes.find(c => c.id === selectedClass);

  const printAdmitCards = (studentList?: any[]) => {
    if (!examDetail) return;
    const toPrint = studentList || students;
    const subjects = (examDetail.examSubjects || []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const subjectRows = subjects.map((es: any, i: number) =>
      `<tr><td style="padding:5px 8px;border:1px solid #999;text-align:center;font-weight:bold">${i + 1}</td><td style="padding:5px 8px;border:1px solid #999">${new Date(es.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</td><td style="padding:5px 8px;border:1px solid #999;font-weight:bold">${es.subject?.name || '—'}</td><td style="padding:5px 8px;border:1px solid #999;text-align:center">${es.maxMarks}</td></tr>`
    ).join('');

    const cards = toPrint.map((s: any) => `
      <div style="border:3px solid #006400;border-radius:12px;overflow:hidden;max-width:600px;margin:20px auto;page-break-inside:avoid">
        <div style="background:#006400;color:white;text-align:center;padding:12px">
          <div style="font-size:18px;font-weight:bold;letter-spacing:1px">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
          <div style="font-size:10px;opacity:0.8">Salarpur, Sector - 101 | Ph: 6397339902</div>
          <div style="display:inline-block;background:#c9a227;color:white;padding:4px 20px;border-radius:4px;font-size:14px;font-weight:bold;margin-top:6px;letter-spacing:2px">ADMIT CARD</div>
        </div>
        <div style="padding:16px;display:flex;gap:16px">
          <div style="flex:1">
            <table style="font-size:12px;width:100%">
              <tr><td style="padding:3px 0;color:#666;width:100px">Name</td><td style="padding:3px 0;font-weight:bold">${s.user.firstName} ${s.user.lastName}</td></tr>
              <tr><td style="padding:3px 0;color:#666">Class</td><td style="padding:3px 0;font-weight:bold">${cls?.name || ''} — ${s.section?.name || ''}</td></tr>
              <tr><td style="padding:3px 0;color:#666">Adm. No.</td><td style="padding:3px 0;font-weight:bold;color:#1e40af">${s.admissionNo}</td></tr>
              <tr><td style="padding:3px 0;color:#666">Roll No.</td><td style="padding:3px 0;font-weight:bold">${s.rollNumber || '—'}</td></tr>
              <tr><td style="padding:3px 0;color:#666">Father</td><td style="padding:3px 0;font-weight:bold">${s.fatherName || '—'}</td></tr>
              <tr><td style="padding:3px 0;color:#666">Exam</td><td style="padding:3px 0;font-weight:bold;color:#006400">${examDetail.name} (${examDetail.type})</td></tr>
            </table>
          </div>
          <div style="width:100px;height:120px;border:2px solid #ddd;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#f8fafc">
            ${s.photo ? `<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:6px" />` : `<div style="font-size:32px;font-weight:bold;color:#94a3b8">${s.user.firstName[0]}${s.user.lastName?.[0] || ''}</div>`}
          </div>
        </div>
        <div style="padding:0 16px 16px">
          <div style="font-size:12px;font-weight:bold;color:#006400;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Exam Schedule</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead><tr><th style="background:#006400;color:white;padding:5px 8px;border:1px solid #006400">#</th><th style="background:#006400;color:white;padding:5px 8px;border:1px solid #006400;text-align:left">Date</th><th style="background:#006400;color:white;padding:5px 8px;border:1px solid #006400;text-align:left">Subject</th><th style="background:#006400;color:white;padding:5px 8px;border:1px solid #006400;text-align:center">Marks</th></tr></thead>
            <tbody>${subjectRows}</tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0 16px 12px;font-size:10px">
          <div style="border-top:1px solid #000;width:140px;text-align:center;padding-top:4px;margin-top:30px">Student Sign</div>
          <div style="border-top:1px solid #000;width:140px;text-align:center;padding-top:4px;margin-top:30px">Class Teacher</div>
          <div style="border-top:1px solid #000;width:140px;text-align:center;padding-top:4px;margin-top:30px">Principal</div>
        </div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html><html><head><title>Admit Cards - ${examDetail.name} - ${cls?.name}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial;margin:10px}@media print{body{margin:0}}</style>
    </head><body>${cards}</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          <FadeIn>
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold text-slate-900">Admit Cards</h1><p className="text-sm text-slate-500">Generate & print admit cards for exams</p></div>
              {examDetail && students.length > 0 && (
                <Button onClick={() => printAdmitCards()} variant="default"><Printer className="h-4 w-4" /> Print All ({students.length})</Button>
              )}
            </div>
          </FadeIn>

          {/* Filters */}
          <FadeIn delay={0.05}>
            <div className="flex gap-3 flex-wrap">
              <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedExam(''); setExamDetail(null); }}
                className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                <option value="">Select Class</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {exams.length > 0 && (
                <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                  <option value="">Select Exam</option>
                  {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.type})</option>)}
                </select>
              )}
            </div>
          </FadeIn>

          {loading && <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>}

          {/* Preview cards */}
          {examDetail && !loading && (
            <FadeIn delay={0.1}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {students.map((s: any) => (
                  <div key={s.id} className="border-2 border-green-800 rounded-xl overflow-hidden bg-white">
                    {/* Card Header */}
                    <div className="text-center py-2 text-white text-xs font-bold" style={{ background: '#006400' }}>
                      PATHAK EDUCATIONAL FOUNDATION SCHOOL — ADMIT CARD
                    </div>
                    <div className="p-4 flex gap-3">
                      {/* Photo */}
                      {s.photo ? (
                        <img src={s.photo} alt="" className="w-16 h-20 rounded-lg object-cover border border-slate-200" />
                      ) : (
                        <div className="w-16 h-20 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-lg font-bold">
                          {s.user.firstName[0]}{s.user.lastName?.[0]}
                        </div>
                      )}
                      <div className="flex-1 text-xs space-y-0.5">
                        <p className="font-bold text-sm text-slate-900">{s.user.firstName} {s.user.lastName}</p>
                        <p className="text-slate-500">{cls?.name} — {s.section?.name} | Adm: {s.admissionNo}</p>
                        {s.rollNumber && <p className="text-slate-500">Roll: {s.rollNumber}</p>}
                        <p className="text-slate-500">Father: {s.fatherName || '—'}</p>
                        <p className="font-bold text-green-800">{examDetail.name} ({examDetail.type})</p>
                      </div>
                      <button onClick={() => printAdmitCards([s])} className="self-start p-1.5 text-slate-400 hover:text-blue-600" title="Print this card">
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                    {/* Schedule mini */}
                    <div className="px-4 pb-3">
                      <div className="flex flex-wrap gap-1">
                        {(examDetail.examSubjects || []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((es: any) => (
                          <span key={es.id} className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                            {new Date(es.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} — <strong>{es.subject?.name}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
          )}

          {!selectedClass && <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400"><CreditCard className="h-10 w-10 mx-auto mb-2 opacity-30" />Select a class and exam to generate admit cards</div>}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
