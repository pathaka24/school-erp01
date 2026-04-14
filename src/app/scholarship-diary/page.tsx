'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency, getAcademicYears, getCurrentAcademicYear } from '@/lib/utils';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { Button } from '@/components/ui/button';
import { Printer, Save, Search } from 'lucide-react';

const MONTHS = [
  { key: '04', label: 'APRIL' }, { key: '05', label: 'MAY' }, { key: '06', label: 'JUNE' },
  { key: '07', label: 'JULY' }, { key: '08', label: 'AUGUST' }, { key: '09', label: 'SEPTEMBER' },
  { key: '10', label: 'OCTOBER' }, { key: '11', label: 'NOVEMBER' }, { key: '12', label: 'DECEMBER' },
  { key: '01', label: 'JANUARY' }, { key: '02', label: 'FEBRUARY' }, { key: '03', label: 'MARCH' },
];


export default function ScholarshipDiaryPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [academicYear, setAcademicYear] = useState(() => getCurrentAcademicYear());
  const [diaryData, setDiaryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ discipline: '', comment: '', scholarship: '', quizBonus: '' });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)); }, []);

  useEffect(() => {
    if (selectedClass) {
      const params: any = { classId: selectedClass };
      if (selectedSection) params.sectionId = selectedSection;
      api.get('/students', { params }).then(r => setStudents(r.data));
    }
  }, [selectedClass, selectedSection]);

  const loadDiary = async (studentId: string) => {
    setLoading(true);
    try {
      const r = await api.get(`/monthly-report/${studentId}?academicYear=${academicYear}`);
      setDiaryData(r.data);
    } catch { setDiaryData(null); }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedStudent) loadDiary(selectedStudent);
  }, [selectedStudent, academicYear]);

  const handleSave = async (month: string) => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      await api.post(`/monthly-report/${selectedStudent}`, {
        month,
        academicYear,
        discipline: editForm.discipline || null,
        comment: editForm.comment || null,
        rewardAmount: editForm.scholarship ? parseFloat(editForm.scholarship) : null,
        quizBonus: editForm.quizBonus ? parseFloat(editForm.quizBonus) : null,
      });
      setEditingMonth(null);
      loadDiary(selectedStudent);
    } catch { alert('Failed to save'); }
    setSaving(false);
  };

  const selectedClassObj = classes.find((c: any) => c.id === selectedClass);
  const sections = selectedClassObj?.sections || [];

  const filteredStudents = searchQuery
    ? students.filter((s: any) => `${s.user.firstName} ${s.user.lastName} ${s.admissionNo}`.toLowerCase().includes(searchQuery.toLowerCase()))
    : students;

  const totalScholarship = diaryData?.diary?.reduce((s: number, d: any) => s + (d.grandTotal || d.rewardAmount || 0), 0) || 0;

  const handlePrint = () => {
    if (!diaryData) return;
    const s = diaryData.student;

    const monthlyMax = diaryData.monthlyScholarship || 100;
    let cards = '';
    for (const d of diaryData.diary) {
      const att = d.isHoliday ? 'Holiday' : (d.attendancePct != null ? d.attendancePct + '%' : '...........');
      const test = d.testMarksPct != null ? d.testMarksPct + '%' : '..........';
      const feeBal = d.feeBalancePct != null ? d.feeBalancePct + '%' : '..........';
      const comment = d.comment || '..................................................................................................';
      const br = d.scholarshipBreakdown;
      const attMax = Math.round(monthlyMax * 0.1);
      const testMax = Math.round(monthlyMax * 0.2);
      const feeMax = Math.round(monthlyMax * 0.7);

      cards += `
        <div class="card">
          <div class="card-month">${d.monthName.toUpperCase()}</div>
          <div class="card-body">
            <table style="width:100%;font-size:12px;border-collapse:collapse;color:#1a1a6e">
              <tr style="font-size:10px;color:#999">
                <td style="padding:2px 0">Component</td>
                <td style="text-align:center;padding:2px 0">Score</td>
                <td style="text-align:center;padding:2px 0">Max</td>
                <td style="text-align:right;padding:2px 0">Earned</td>
              </tr>
              <tr style="border-top:1px solid #ddd">
                <td style="padding:3px 0">Attendance (10%)</td>
                <td style="text-align:center;font-weight:bold">${att}</td>
                <td style="text-align:center;color:#999">₹${attMax}</td>
                <td style="text-align:right;font-weight:bold;color:${(br?.attAmount || 0) > 0 ? '#16a34a' : '#dc2626'}">₹${br?.attAmount || 0}</td>
              </tr>
              <tr style="border-top:1px solid #ddd">
                <td style="padding:3px 0">Test Marks (20%)</td>
                <td style="text-align:center;font-weight:bold">${test}</td>
                <td style="text-align:center;color:#999">₹${testMax}</td>
                <td style="text-align:right;font-weight:bold;color:${(br?.testAmount || 0) > 0 ? '#16a34a' : '#dc2626'}">₹${br?.testAmount || 0}</td>
              </tr>
              <tr style="border-top:1px solid #ddd">
                <td style="padding:3px 0">Fee Paid (70%)${d.balanceBeforeDeposit > 0 ? '<br><span style="font-size:9px;color:#666">Paid ₹' + (d.depositedThisMonth || 0).toLocaleString('en-IN') + ' of ₹' + d.balanceBeforeDeposit.toLocaleString('en-IN') + '</span>' : ''}${(d.depositedThisMonth || 0) <= 0 && d.balanceBeforeDeposit > 0 ? '<br><span style="font-size:9px;color:#dc2626;font-weight:bold">Not paid</span>' : ''}</td>
                <td style="text-align:center;font-weight:bold;color:${(d.feeBalancePct || 0) < 50 ? '#dc2626' : '#1a1a6e'}">${feeBal}</td>
                <td style="text-align:center;color:#999">₹${feeMax}</td>
                <td style="text-align:right;font-weight:bold;color:${(br?.feeAmount || 0) > 0 ? '#16a34a' : '#dc2626'}">₹${br?.feeAmount || 0}</td>
              </tr>
              <tr style="border-top:2px solid #1a1a6e">
                <td style="padding:3px 0;font-weight:bold">Auto Total</td>
                <td></td>
                <td style="text-align:center;color:#999">₹${monthlyMax}</td>
                <td style="text-align:right;font-weight:bold;color:#1a1a6e">₹${d.rewardAmount > 0 ? d.rewardAmount.toLocaleString('en-IN') : '0'}</td>
              </tr>
              ${(d.quizBonus || 0) > 0 ? `<tr style="background:#f3e8ff">
                <td style="padding:3px 0;font-weight:bold;color:#7c3aed">Quiz Bonus</td>
                <td></td><td></td>
                <td style="text-align:right;font-weight:bold;color:#7c3aed">+₹${d.quizBonus}</td>
              </tr>` : ''}
              <tr style="background:#1a1a6e;color:white">
                <td style="padding:4px 0;font-weight:bold" colspan="3">Grand Total</td>
                <td style="text-align:right;font-size:16px;font-weight:bold">₹${(d.grandTotal || d.rewardAmount || 0) > 0 ? (d.grandTotal || d.rewardAmount || 0).toLocaleString('en-IN') : '0'}/-</td>
              </tr>
            </table>
            <div style="margin-top:4px;font-size:11px;color:#666">Comment: ${comment}</div>
          </div>
        </div>`;
    }

    const html = `<!DOCTYPE html><html><head><title>Scholarship Diary - ${s.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; margin: 16px; color: #1a1a6e; }
        .header { text-align: center; margin-bottom: 16px; }
        .school-name { font-size: 18px; font-weight: bold; color: #1a1a6e; text-transform: uppercase; letter-spacing: 1px; }
        .student-info { font-size: 13px; margin-top: 6px; }
        .student-info strong { color: #1a1a6e; }
        .year-badge { display: inline-block; background: #cc0000; color: white; padding: 3px 16px; border-radius: 4px; font-weight: bold; font-size: 14px; margin: 8px 0; }
        .total { text-align: right; font-size: 16px; font-weight: bold; color: #1a1a6e; margin: 8px 16px; }
        .card { border: 2.5px solid #1a1a6e; border-radius: 8px; margin-bottom: 10px; overflow: hidden; page-break-inside: avoid; }
        .card-month { text-align: center; font-weight: bold; font-size: 13px; letter-spacing: 3px; padding: 4px; border-bottom: 1.5px solid #cc0000; color: #1a1a6e; text-decoration: underline; }
        .card-body { padding: 8px 12px; background: #fffbe6; }
        .field-row { display: flex; gap: 16px; margin-bottom: 3px; font-size: 12px; }
        .field { flex: 1; }
        .field strong { color: #1a1a6e; }
        .amount { font-size: 18px; font-weight: bold; color: #1a1a6e; white-space: nowrap; }
        .dotted { border-bottom: 1px dotted #999; }
        @media print { body { margin: 8px; } .card { margin-bottom: 8px; } }
      </style>
    </head><body>
      <div class="header">
        <div class="school-name">Pathak Educational Foundation School</div>
        <div style="font-size:12px;color:#666">(${academicYear})</div>
        <div class="student-info">
          Name: <strong>${s.name}</strong>&nbsp;&nbsp;&nbsp;
          Class: <strong>${s.class}</strong>&nbsp;&nbsp;&nbsp;
          Adm. No: <strong>${s.admissionNo || ''}</strong>
        </div>
      </div>
      <div class="year-badge">${academicYear}</div>
      <div style="text-align:center;font-size:11px;color:#666;margin-bottom:8px">Annual Budget: ₹${(diaryData.annualScholarship || 1200).toLocaleString('en-IN')} | Monthly Max: ₹${monthlyMax} | Attendance 10% + Test 20% + Fee Balance 70%</div>
      ${cards}
      <div class="total">Total Scholarship: ₹ ${totalScholarship.toLocaleString('en-IN')}/- (of ₹${(diaryData.annualScholarship || 1200).toLocaleString('en-IN')})</div>
      <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:12px">
        <div style="border-top:1px solid #000;width:180px;text-align:center;padding-top:4px">Parent's Signature</div>
        <div style="border-top:1px solid #000;width:180px;text-align:center;padding-top:4px">Class Teacher</div>
        <div style="border-top:1px solid #000;width:180px;text-align:center;padding-top:4px">Principal</div>
      </div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-5">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Scholarship Diary</h1>
              {diaryData && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4" /> Print Diary</Button>
                </div>
              )}
            </div>
          </FadeIn>

          {/* Filters */}
          <FadeIn delay={0.05}>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); setSelectedStudent(''); setDiaryData(null); }}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                  <option value="">Select Class</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={selectedSection} onChange={e => { setSelectedSection(e.target.value); setSelectedStudent(''); setDiaryData(null); }}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                  <option value="">All Sections</option>
                  {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900">
                  {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input placeholder="Search student..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900" />
                </div>
              </div>
              {/* Student list */}
              {selectedClass && (
                <div className="flex gap-2 flex-wrap mt-3 max-h-24 overflow-y-auto">
                  {filteredStudents.map((s: any) => (
                    <button key={s.id} onClick={() => setSelectedStudent(s.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${selectedStudent === s.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {s.user.firstName} {s.user.lastName} <span className="opacity-60">({s.admissionNo})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FadeIn>

          {/* Student header + total */}
          {diaryData && (
            <FadeIn delay={0.1}>
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-2xl px-6 py-4">
                <div>
                  <p className="text-xl font-bold">{diaryData.student.name}</p>
                  <p className="text-sm text-blue-200">{diaryData.student.class} {diaryData.student.section ? '- ' + diaryData.student.section : ''} | {diaryData.student.admissionNo}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-blue-300 uppercase">Annual Budget</p>
                  <p className="text-lg font-bold">{formatCurrency(diaryData.annualScholarship || 1200)}</p>
                  <p className="text-[10px] text-blue-400">₹{diaryData.monthlyScholarship || 100}/month</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-blue-200">Total Earned</p>
                  <p className="text-3xl font-black">{formatCurrency(totalScholarship)}</p>
                  <p className="text-[10px] text-blue-400">{Math.round((totalScholarship / (diaryData.annualScholarship || 1200)) * 100)}% of annual</p>
                </div>
              </div>
            </FadeIn>
          )}

          {/* Loading */}
          {loading && <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>}

          {/* No student selected */}
          {!selectedStudent && !loading && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              Select a class and student to view their scholarship diary
            </div>
          )}

          {/* Diary cards — matching physical format */}
          {diaryData && !loading && (
            <FadeIn delay={0.15}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {diaryData.diary.map((d: any) => {
                  const isEditing = editingMonth === d.month;
                  const att = d.isHoliday ? 'Holiday' : (d.attendancePct != null ? d.attendancePct + '%' : '—');
                  const test = d.testMarksPct != null ? d.testMarksPct + '%' : '0%';
                  const feeBal = d.feeBalancePct != null ? d.feeBalancePct + '%' : '0%';
                  const br = d.scholarshipBreakdown;
                  const hasPenalty = false;

                  return (
                    <div key={d.month}
                      className="rounded-xl overflow-hidden"
                      style={{ border: `3px solid ${hasPenalty ? '#dc2626' : '#1a1a6e'}` }}
                    >
                      {/* Month header — matches physical card */}
                      <div className="text-center py-2 font-bold text-sm tracking-[4px] uppercase"
                        style={{ color: '#1a1a6e', borderBottom: '2px solid #cc0000', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
                        {d.monthName}
                      </div>

                      {/* Card body — cream background like physical */}
                      <div className="p-4 space-y-2" style={{ background: '#fffbe6' }}>
                        {isEditing ? (
                          /* Edit mode */
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="text-[10px] text-slate-500 uppercase">Attendance (10%)</label>
                                <p className="text-sm font-bold" style={{ color: '#1a1a6e' }}>{att}</p>
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 uppercase">Test Marks (20%)</label>
                                <p className="text-sm font-bold" style={{ color: '#1a1a6e' }}>{test}</p>
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 uppercase">Fee Balance (70%)</label>
                                <p className="text-sm font-bold" style={{ color: '#1a1a6e' }}>{feeBal}</p>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 uppercase">Comment</label>
                              <input value={editForm.comment} onChange={e => setEditForm({ ...editForm, comment: e.target.value })}
                                className="w-full px-2 py-1 border rounded text-sm" placeholder="..." />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] text-slate-500 uppercase">Scholarship (₹)</label>
                                <input type="number" value={editForm.scholarship} onChange={e => setEditForm({ ...editForm, scholarship: e.target.value })}
                                  placeholder={`Auto: ₹${d.auto?.rewardAmount || 0}`}
                                  className="w-full px-2 py-1 border rounded text-sm font-bold" style={{ color: '#1a1a6e' }} />
                              </div>
                              <div>
                                <label className="text-[10px] text-purple-600 uppercase font-bold">Quiz Bonus (₹)</label>
                                <input type="number" value={editForm.quizBonus} onChange={e => setEditForm({ ...editForm, quizBonus: e.target.value })}
                                  placeholder="0"
                                  className="w-full px-2 py-1 border border-purple-300 rounded text-sm font-bold text-purple-700 bg-purple-50" />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" onClick={() => handleSave(d.month)} disabled={saving}>{saving ? '...' : 'Save'}</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingMonth(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          /* View mode — matches physical layout exactly */
                          <>
                            {/* Breakdown table */}
                            <table className="w-full text-[12px]" style={{ color: '#1a1a6e' }}>
                              <thead>
                                <tr className="text-[10px] text-slate-400 uppercase">
                                  <th className="text-left font-medium pb-1">Component</th>
                                  <th className="text-center font-medium pb-1">Score</th>
                                  <th className="text-center font-medium pb-1">Max</th>
                                  <th className="text-right font-medium pb-1">Earned</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-t" style={{ borderColor: '#e5d9a8' }}>
                                  <td className="py-1">Attendance <span className="text-[10px] text-slate-400">(10%)</span></td>
                                  <td className="text-center font-bold">{att}</td>
                                  <td className="text-center text-slate-400">₹{br ? Math.round(br.monthlyMax * 0.1) : 10}</td>
                                  <td className="text-right font-bold" style={{ color: (br?.attAmount || 0) > 0 ? '#16a34a' : '#dc2626' }}>₹{br?.attAmount || 0}</td>
                                </tr>
                                <tr className="border-t" style={{ borderColor: '#e5d9a8' }}>
                                  <td className="py-1">Test Marks <span className="text-[10px] text-slate-400">(20%)</span></td>
                                  <td className="text-center font-bold">{test}</td>
                                  <td className="text-center text-slate-400">₹{br ? Math.round(br.monthlyMax * 0.2) : 20}</td>
                                  <td className="text-right font-bold" style={{ color: (br?.testAmount || 0) > 0 ? '#16a34a' : '#dc2626' }}>₹{br?.testAmount || 0}</td>
                                </tr>
                                <tr className="border-t" style={{ borderColor: '#e5d9a8' }}>
                                  <td className="py-1">
                                    Fee Paid <span className="text-[10px] text-slate-400">(70%)</span>
                                    {d.balanceBeforeDeposit > 0 && (
                                      <span className="block text-[9px] text-slate-500">
                                        Paid ₹{(d.depositedThisMonth || 0).toLocaleString('en-IN')} of ₹{d.balanceBeforeDeposit.toLocaleString('en-IN')}
                                      </span>
                                    )}
                                    {d.depositedThisMonth <= 0 && d.balanceBeforeDeposit > 0 && (
                                      <span className="block text-[9px] text-red-600 font-bold">Not paid</span>
                                    )}
                                  </td>
                                  <td className="text-center font-bold" style={{ color: (d.feeBalancePct || 0) < 50 ? '#dc2626' : undefined }}>{feeBal}</td>
                                  <td className="text-center text-slate-400">₹{br ? Math.round(br.monthlyMax * 0.7) : 70}</td>
                                  <td className="text-right font-bold" style={{ color: (br?.feeAmount || 0) > 0 ? '#16a34a' : '#dc2626' }}>₹{br?.feeAmount || 0}</td>
                                </tr>
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2" style={{ borderColor: '#1a1a6e' }}>
                                  <td className="py-1 font-bold">Auto Total</td>
                                  <td></td>
                                  <td className="text-center text-slate-400">₹{br?.monthlyMax || 100}</td>
                                  <td className="text-right font-bold" style={{ color: '#1a1a6e' }}>₹{d.rewardAmount || 0}</td>
                                </tr>
                                {(d.quizBonus || 0) > 0 && (
                                  <tr style={{ background: '#f3e8ff' }}>
                                    <td className="py-1 font-bold text-purple-700">Quiz Bonus</td>
                                    <td></td>
                                    <td></td>
                                    <td className="text-right font-bold text-purple-700">+₹{d.quizBonus}</td>
                                  </tr>
                                )}
                                <tr style={{ background: '#1a1a6e' }}>
                                  <td className="py-1.5 font-black text-white" colSpan={3}>Grand Total</td>
                                  <td className="text-right text-lg font-black text-white">₹{d.grandTotal || d.rewardAmount || 0}/-</td>
                                </tr>
                              </tfoot>
                            </table>

                            <div className="flex items-end justify-between pt-1 border-t" style={{ borderColor: '#ddd' }}>
                              <span className="text-[12px] text-slate-500 flex-1">
                                Comment: {d.comment || '...............................................'}
                              </span>
                            </div>
                            <button onClick={() => { setEditingMonth(d.month); setEditForm({ discipline: d.discipline || '', comment: d.comment || '', scholarship: d.rewardAmount ? String(d.rewardAmount) : '', quizBonus: d.quizBonus ? String(d.quizBonus) : '' }); }}
                              className="text-[10px] text-blue-600 hover:text-blue-800 mt-1">
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </FadeIn>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
