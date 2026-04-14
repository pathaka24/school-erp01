'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Save } from 'lucide-react';

const GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'E'];
const CO_ACTIVITIES = ['Art & Craft', 'Music', 'Physical Education', 'Work Education', 'Computer'];
const QUALITIES = ['Regularity', 'Behaviour', 'Self-Confidence', 'Responsibility', 'Leadership'];
const CO_GRADES = ['A_PLUS', 'A', 'B_PLUS', 'B', 'C'];
const CO_GRADE_LABELS: Record<string, string> = { A_PLUS: 'A+', A: 'A', B_PLUS: 'B+', B: 'B', C: 'C' };

function getGradeColor(g: string) {
  if (g === 'A+' || g === 'A') return 'text-green-600';
  if (g === 'B+' || g === 'B') return 'text-blue-600';
  if (g === 'C+' || g === 'C') return 'text-yellow-600';
  if (g === 'D') return 'text-orange-600';
  return 'text-red-600';
}

function getBarColor(pct: number) {
  if (pct >= 81) return 'bg-green-500';
  if (pct >= 61) return 'bg-blue-500';
  if (pct >= 41) return 'bg-yellow-500';
  if (pct >= 33) return 'bg-orange-500';
  return 'bg-red-500';
}

function autoGrade(pct: number): string {
  if (pct >= 91) return 'A+';
  if (pct >= 81) return 'A';
  if (pct >= 71) return 'B+';
  if (pct >= 61) return 'B';
  if (pct >= 51) return 'C+';
  if (pct >= 41) return 'C';
  if (pct >= 33) return 'D';
  return 'E';
}

export default function AcademicsPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [tab, setTab] = useState<'marks' | 'co-scholastic' | 'qualities' | 'achievements' | 'history'>('marks');

  // Assessment data
  const [assessments, setAssessments] = useState<any[]>([]);
  const [coScholastics, setCoScholastics] = useState<any[]>([]);
  const [personalQualities, setPersonalQualities] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Edit state for marks
  const [marksEdit, setMarksEdit] = useState<Record<string, { fa1: string; fa2: string; sa: string; remark: string }>>({});

  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data));
  }, []);

  useEffect(() => {
    if (selectedClass && selectedSection) {
      api.get('/students', { params: { classId: selectedClass, sectionId: selectedSection } }).then(r => setStudents(r.data));
      api.get('/subjects', { params: { classId: selectedClass } }).then(r => setSubjects(r.data));
    }
  }, [selectedClass, selectedSection]);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentData();
    }
  }, [selectedStudent, academicYear]);

  const loadStudentData = async () => {
    const [aRes, csRes, pqRes, achRes, histRes] = await Promise.all([
      api.get('/assessments', { params: { studentId: selectedStudent, academicYear } }),
      api.get('/co-scholastics', { params: { studentId: selectedStudent, academicYear } }),
      api.get('/personal-qualities', { params: { studentId: selectedStudent, academicYear } }),
      api.get('/achievements', { params: { studentId: selectedStudent } }),
      api.get(`/assessments/${selectedStudent}`),
    ]);
    setAssessments(aRes.data);
    setCoScholastics(csRes.data);
    setPersonalQualities(pqRes.data);
    setAchievements(achRes.data);
    setHistory(histRes.data);

    // Populate edit state
    const edits: any = {};
    subjects.forEach((s: any) => {
      const existing = aRes.data.find((a: any) => a.subjectId === s.id);
      edits[s.id] = {
        fa1: existing?.fa1?.toString() || '',
        fa2: existing?.fa2?.toString() || '',
        sa: existing?.sa?.toString() || '',
        remark: existing?.teacherRemark || '',
      };
    });
    setMarksEdit(edits);
  };

  const saveMarks = async () => {
    setSaving(true);
    try {
      await Promise.all(
        subjects.map((s: any) => {
          const m = marksEdit[s.id];
          if (!m) return null;
          return api.post('/assessments', {
            studentId: selectedStudent,
            subjectId: s.id,
            academicYear,
            fa1: m.fa1 ? parseFloat(m.fa1) : null,
            fa2: m.fa2 ? parseFloat(m.fa2) : null,
            sa: m.sa ? parseFloat(m.sa) : null,
            teacherRemark: m.remark || null,
          });
        })
      );
      await loadStudentData();
      alert('Marks saved!');
    } catch (e) {
      alert('Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const saveCoScholastic = async (activity: string, grade: string) => {
    await api.post('/co-scholastics', { studentId: selectedStudent, academicYear, activity, grade });
    const r = await api.get('/co-scholastics', { params: { studentId: selectedStudent, academicYear } });
    setCoScholastics(r.data);
  };

  const saveQuality = async (quality: string, grade: string) => {
    await api.post('/personal-qualities', { studentId: selectedStudent, academicYear, quality, grade });
    const r = await api.get('/personal-qualities', { params: { studentId: selectedStudent, academicYear } });
    setPersonalQualities(r.data);
  };

  const selectedClassData = classes.find((c: any) => c.id === selectedClass);
  const selectedStudentData = students.find((s: any) => s.id === selectedStudent);

  // Summary calc
  const totalMarks = assessments.reduce((s: number, a: any) => s + (a.total || 0), 0);
  const maxMarks = assessments.length * 160;
  const overallPct = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Academics & Marks</h1>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
              <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="2025-2026">2025-2026</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2023-2024">2023-2024</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); setSelectedStudent(''); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">Select</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
              <select value={selectedSection} onChange={e => { setSelectedSection(e.target.value); setSelectedStudent(''); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">Select</option>
                {selectedClassData?.sections?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Student</label>
              <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">Select Student</option>
                {students.map((s: any) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName} ({s.admissionNo})</option>)}
              </select>
            </div>
          </div>
        </div>

        {selectedStudent && (
          <>
            {/* Summary Cards */}
            {assessments.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{totalMarks}</p>
                  <p className="text-xs text-slate-500">Total Marks</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{maxMarks}</p>
                  <p className="text-xs text-slate-500">Max Marks</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{overallPct.toFixed(1)}%</p>
                  <p className="text-xs text-slate-500">Percentage</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className={`text-2xl font-bold ${getGradeColor(autoGrade(overallPct))}`}>{autoGrade(overallPct)}</p>
                  <p className="text-xs text-slate-500">Grade</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className={`text-2xl font-bold ${overallPct >= 33 ? 'text-green-600' : 'text-red-600'}`}>{overallPct >= 33 ? 'PASS' : 'FAIL'}</p>
                  <p className="text-xs text-slate-500">Result</p>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
              {[
                { id: 'marks', label: 'Subject-wise Marks' },
                { id: 'co-scholastic', label: 'Co-Scholastic' },
                { id: 'qualities', label: 'Personal Qualities' },
                { id: 'achievements', label: 'Achievements' },
                { id: 'history', label: 'Year-over-Year' },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id as any)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >{t.label}</button>
              ))}
            </div>

            {/* MARKS TAB */}
            {tab === 'marks' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Formative & Summative Assessment</h2>
                  <button onClick={saveMarks} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                    <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Marks'}
                  </button>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Subject</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">FA1 /40</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">FA2 /40</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">SA /80</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">Total /160</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">%</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-slate-500 w-32">Bar</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">Grade</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjects.map((subj: any) => {
                      const m = marksEdit[subj.id] || { fa1: '', fa2: '', sa: '', remark: '' };
                      const fa1 = parseFloat(m.fa1) || 0;
                      const fa2 = parseFloat(m.fa2) || 0;
                      const sa = parseFloat(m.sa) || 0;
                      const total = fa1 + fa2 + sa;
                      const pct = (total / 160) * 100;
                      const grade = total > 0 ? autoGrade(pct) : '-';
                      return (
                        <tr key={subj.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-sm font-medium text-slate-900">{subj.name}</td>
                          <td className="px-3 py-2"><input type="number" min="0" max="40" value={m.fa1} onChange={e => setMarksEdit({...marksEdit, [subj.id]: {...m, fa1: e.target.value}})} className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center text-slate-900" /></td>
                          <td className="px-3 py-2"><input type="number" min="0" max="40" value={m.fa2} onChange={e => setMarksEdit({...marksEdit, [subj.id]: {...m, fa2: e.target.value}})} className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center text-slate-900" /></td>
                          <td className="px-3 py-2"><input type="number" min="0" max="80" value={m.sa} onChange={e => setMarksEdit({...marksEdit, [subj.id]: {...m, sa: e.target.value}})} className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center text-slate-900" /></td>
                          <td className="px-3 py-2 text-center text-sm font-semibold text-slate-900">{total || '-'}</td>
                          <td className="px-3 py-2 text-center text-sm text-slate-600">{total > 0 ? pct.toFixed(1) : '-'}</td>
                          <td className="px-3 py-2">
                            <div className="w-full bg-slate-100 rounded-full h-2.5">
                              <div className={`h-2.5 rounded-full ${getBarColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                            </div>
                          </td>
                          <td className={`px-3 py-2 text-center text-sm font-bold ${getGradeColor(grade)}`}>{grade}</td>
                          <td className="px-3 py-2"><input value={m.remark} onChange={e => setMarksEdit({...marksEdit, [subj.id]: {...m, remark: e.target.value}})} className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-slate-900" placeholder="Remark" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* CO-SCHOLASTIC TAB */}
            {tab === 'co-scholastic' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Co-Scholastic Activities</h2>
                <div className="space-y-3">
                  {CO_ACTIVITIES.map(activity => {
                    const existing = coScholastics.find((c: any) => c.activity === activity);
                    return (
                      <div key={activity} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">{activity}</span>
                        <div className="flex gap-2">
                          {CO_GRADES.map(g => (
                            <button key={g} onClick={() => saveCoScholastic(activity, g)}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${existing?.grade === g ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                            >{CO_GRADE_LABELS[g]}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PERSONAL QUALITIES TAB */}
            {tab === 'qualities' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Personal Qualities</h2>
                <div className="space-y-3">
                  {QUALITIES.map(quality => {
                    const existing = personalQualities.find((p: any) => p.quality === quality);
                    return (
                      <div key={quality} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">{quality}</span>
                        <div className="flex gap-2">
                          {CO_GRADES.map(g => (
                            <button key={g} onClick={() => saveQuality(quality, g)}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${existing?.grade === g ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                            >{CO_GRADE_LABELS[g]}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ACHIEVEMENTS TAB */}
            {tab === 'achievements' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Achievements</h2>
                {achievements.length === 0 ? (
                  <p className="text-slate-400">No achievements recorded</p>
                ) : (
                  <div className="space-y-3">
                    {achievements.map((a: any) => (
                      <div key={a.id} className="flex items-start gap-3 bg-slate-50 rounded-lg px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium mt-0.5 ${
                          a.type === 'academic' ? 'bg-blue-100 text-blue-700' :
                          a.type === 'sports' ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>{a.type}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{a.title}</p>
                          {a.description && <p className="text-xs text-slate-500">{a.description}</p>}
                          <p className="text-xs text-slate-400 mt-1">{new Date(a.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* YEAR-OVER-YEAR TAB */}
            {tab === 'history' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Academic History</h2>
                {history.length === 0 ? (
                  <p className="text-slate-400">No academic history</p>
                ) : (
                  <div className="space-y-6">
                    {history.map((yr: any) => (
                      <div key={yr.year} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 flex justify-between items-center">
                          <span className="font-medium text-slate-700">{yr.year}</span>
                          <div className="flex gap-4 text-sm">
                            <span>Total: <strong>{yr.totalMarks}/{yr.maxMarks}</strong></span>
                            <span>Percentage: <strong>{yr.percentage}%</strong></span>
                            <span className={`font-bold ${getGradeColor(yr.grade)}`}>{yr.grade}</span>
                          </div>
                        </div>
                        <table className="w-full">
                          <thead>
                            <tr className="text-xs text-slate-500">
                              <th className="text-left px-4 py-1.5">Subject</th>
                              <th className="text-center px-2 py-1.5">FA1</th>
                              <th className="text-center px-2 py-1.5">FA2</th>
                              <th className="text-center px-2 py-1.5">SA</th>
                              <th className="text-center px-2 py-1.5">Total</th>
                              <th className="text-center px-2 py-1.5">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {yr.subjects.map((s: any) => (
                              <tr key={s.id}>
                                <td className="px-4 py-2 text-sm text-slate-900">{s.subject?.name}</td>
                                <td className="text-center text-sm text-slate-600">{s.fa1 ?? '-'}</td>
                                <td className="text-center text-sm text-slate-600">{s.fa2 ?? '-'}</td>
                                <td className="text-center text-sm text-slate-600">{s.sa ?? '-'}</td>
                                <td className="text-center text-sm font-medium text-slate-900">{s.total ?? '-'}</td>
                                <td className={`text-center text-sm font-bold ${getGradeColor(s.grade || '')}`}>{s.grade || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
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
