'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { Calendar, Plus, Trash2, Printer, Save } from 'lucide-react';

export default function ExamTimetablePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [examDetail, setExamDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Create exam form
  const [showCreate, setShowCreate] = useState(false);
  const [newExam, setNewExam] = useState({ name: '', type: 'SA1', startDate: '', endDate: '' });
  const [newSubjects, setNewSubjects] = useState<{ subjectName: string; date: string; startTime: string; endTime: string; maxMarks: string; passingMarks: string }[]>([]);

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)); }, []);

  useEffect(() => {
    if (selectedClass) {
      api.get('/exams', { params: { classId: selectedClass } }).then(r => setExams(r.data)).catch(() => setExams([]));
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedExam) {
      setLoading(true);
      api.get(`/exams/${selectedExam}`).then(r => setExamDetail(r.data)).finally(() => setLoading(false));
    }
  }, [selectedExam]);

  const addSubjectRow = () => {
    setNewSubjects(prev => [...prev, { subjectName: '', date: '', startTime: '09:00', endTime: '11:00', maxMarks: '80', passingMarks: '27' }]);
  };

  const updateSubjectRow = (idx: number, field: string, value: string) => {
    setNewSubjects(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const removeSubjectRow = (idx: number) => {
    setNewSubjects(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreateExam = async () => {
    if (!newExam.name || !selectedClass || newSubjects.length === 0) { alert('Fill exam name, class, and add at least one subject'); return; }
    try {
      // Create subjects first if they don't exist, get IDs
      const subjectsWithIds = [];
      for (const sub of newSubjects) {
        if (!sub.subjectName || !sub.date) continue;
        const { data: subData } = await api.post('/academics/subjects', { name: sub.subjectName, classId: selectedClass });
        subjectsWithIds.push({
          subjectId: subData.id,
          date: sub.date,
          maxMarks: parseInt(sub.maxMarks) || 80,
          passingMarks: parseInt(sub.passingMarks) || 27,
        });
      }

      await api.post('/exams', {
        name: newExam.name, type: newExam.type, classId: selectedClass,
        startDate: newExam.startDate || newSubjects[0]?.date,
        endDate: newExam.endDate || newSubjects[newSubjects.length - 1]?.date,
        subjects: subjectsWithIds,
      });

      setShowCreate(false);
      setNewExam({ name: '', type: 'SA1', startDate: '', endDate: '' });
      setNewSubjects([]);
      // Reload exams
      const r = await api.get('/exams', { params: { classId: selectedClass } });
      setExams(r.data);
      alert('Exam created!');
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
  };

  const handlePrint = () => {
    if (!examDetail) return;
    const cls = classes.find(c => c.id === selectedClass);
    const rows = (examDetail.examSubjects || []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((es: any, i: number) =>
      `<tr><td style="padding:8px 12px;border:1px solid #ddd;text-align:center;font-weight:bold;color:#1e40af">${i + 1}</td><td style="padding:8px 12px;border:1px solid #ddd;font-weight:bold">${new Date(es.date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</td><td style="padding:8px 12px;border:1px solid #ddd;font-weight:600;font-size:15px">${es.subject?.name || '—'}</td><td style="padding:8px 12px;border:1px solid #ddd;text-align:center">${es.maxMarks}</td><td style="padding:8px 12px;border:1px solid #ddd;text-align:center">${es.passingMarks}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><title>Exam Timetable</title><style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse}th{background:#006400;color:white;padding:10px 12px;font-size:12px;border:1px solid #ddd}@media print{body{margin:10px}}</style></head><body>
    <div style="text-align:center;margin-bottom:20px"><div style="font-size:22px;font-weight:bold;color:#006400">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div><div style="font-size:11px;color:#666">Salarpur, Sector-101</div>
    <div style="display:inline-block;background:#006400;color:white;padding:6px 24px;border-radius:4px;font-size:16px;font-weight:bold;margin-top:10px">${examDetail.name} — EXAM TIMETABLE</div>
    <div style="font-size:13px;color:#475569;margin-top:6px">${cls?.name} | ${examDetail.type}</div></div>
    <table><thead><tr><th>#</th><th style="text-align:left">Date & Day</th><th style="text-align:left">Subject</th><th>Max Marks</th><th>Pass Marks</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="margin-top:20px;font-size:11px;color:#94a3b8;text-align:center">Students must carry their admit card during examination.</div>
    <div style="display:flex;justify-content:space-between;margin-top:40px;font-size:11px"><div style="border-top:1px solid #000;width:180px;text-align:center;padding-top:4px">Class Teacher</div><div style="border-top:1px solid #000;width:180px;text-align:center;padding-top:4px">Principal</div></div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          <FadeIn>
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold text-slate-900">Exam Timetable</h1><p className="text-sm text-slate-500">Create exam schedule with subjects, dates & marks</p></div>
              <div className="flex gap-2">
                {examDetail && <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4" /> Print</Button>}
                {selectedClass && <Button size="sm" onClick={() => { setShowCreate(!showCreate); if (!showCreate) addSubjectRow(); }}><Plus className="h-4 w-4" /> Create Exam</Button>}
              </div>
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
                <div className="flex gap-2 flex-wrap">
                  {exams.map((e: any) => (
                    <button key={e.id} onClick={() => setSelectedExam(e.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition ${selectedExam === e.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300'}`}>
                      {e.name} <span className="opacity-60 text-xs">({e.type})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FadeIn>

          {/* Create Exam Form */}
          {showCreate && (
            <FadeIn delay={0.1}>
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <h3 className="font-semibold text-slate-900">New Exam</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><label className="block text-xs text-slate-500 mb-1">Exam Name</label><input value={newExam.name} onChange={e => setNewExam({ ...newExam, name: e.target.value })} placeholder="e.g. SA-1, Annual" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" /></div>
                    <div><label className="block text-xs text-slate-500 mb-1">Type</label><select value={newExam.type} onChange={e => setNewExam({ ...newExam, type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      {['FA1','FA2','SA1','SA2','ANNUAL','MIDTERM','FINAL','QUIZ','UNIT_TEST'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select></div>
                    <div><label className="block text-xs text-slate-500 mb-1">Start Date</label><input type="date" value={newExam.startDate} onChange={e => setNewExam({ ...newExam, startDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" /></div>
                    <div><label className="block text-xs text-slate-500 mb-1">End Date</label><input type="date" value={newExam.endDate} onChange={e => setNewExam({ ...newExam, endDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" /></div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-slate-700">Exam Subjects</h4>
                      <button onClick={addSubjectRow} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus className="h-3 w-3" /> Add Subject</button>
                    </div>
                    <div className="space-y-2">
                      {newSubjects.map((sub, idx) => (
                        <div key={idx} className="grid grid-cols-6 gap-2 items-end bg-slate-50 rounded-lg p-2">
                          <div><label className="block text-[10px] text-slate-500">Subject</label><input value={sub.subjectName} onChange={e => updateSubjectRow(idx, 'subjectName', e.target.value)} placeholder="e.g. Hindi" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900" /></div>
                          <div><label className="block text-[10px] text-slate-500">Date</label><input type="date" value={sub.date} onChange={e => updateSubjectRow(idx, 'date', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900" /></div>
                          <div><label className="block text-[10px] text-slate-500">Start</label><input type="time" value={sub.startTime} onChange={e => updateSubjectRow(idx, 'startTime', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900" /></div>
                          <div><label className="block text-[10px] text-slate-500">End</label><input type="time" value={sub.endTime} onChange={e => updateSubjectRow(idx, 'endTime', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-slate-900" /></div>
                          <div><label className="block text-[10px] text-slate-500">Max / Pass</label><div className="flex gap-1"><input type="number" value={sub.maxMarks} onChange={e => updateSubjectRow(idx, 'maxMarks', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-900" /><input type="number" value={sub.passingMarks} onChange={e => updateSubjectRow(idx, 'passingMarks', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-900" /></div></div>
                          <button onClick={() => removeSubjectRow(idx)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleCreateExam}><Save className="h-4 w-4" /> Create Exam</Button>
                    <Button variant="ghost" onClick={() => { setShowCreate(false); setNewSubjects([]); }}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {loading && <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>}

          {/* Exam Detail View */}
          {examDetail && !loading && (
            <FadeIn delay={0.1}>
              <div className="bg-white rounded-2xl border-2 border-green-800 overflow-hidden">
                <div className="text-center py-3 text-white font-bold" style={{ background: '#006400' }}>
                  {examDetail.name} — EXAM TIMETABLE
                </div>
                <div className="text-center py-2 text-sm text-slate-500">
                  {classes.find(c => c.id === selectedClass)?.name} | {examDetail.type} | {examDetail.startDate ? new Date(examDetail.startDate).toLocaleDateString('en-IN') : ''} to {examDetail.endDate ? new Date(examDetail.endDate).toLocaleDateString('en-IN') : ''}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 w-12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Date & Day</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Subject</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Max Marks</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Pass Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(examDetail.examSubjects || []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((es: any, i: number) => (
                      <tr key={es.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-center font-bold text-blue-600">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{new Date(es.date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 text-base">{es.subject?.name || '—'}</td>
                        <td className="px-4 py-3 text-center font-bold">{es.maxMarks}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{es.passingMarks}</td>
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
