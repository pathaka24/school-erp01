'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatCurrency, getAcademicYears } from '@/lib/utils';
import { BookOpen } from 'lucide-react';

export default function ParentDiaryPage() {
  const { user } = useAuthStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [diaryData, setDiaryData] = useState<any>(null);
  const [diaryYear, setDiaryYear] = useState(() => { const n = new Date(); const y = n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1; return `${y}-${y+1}`; });

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/parent/children?userId=${user.id}`)
      .then(res => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) {
          setSelectedChild(res.data.children[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!selectedChild) return;
    api.get(`/monthly-report/${selectedChild}?academicYear=${diaryYear}`)
      .then(res => setDiaryData(res.data))
      .catch(() => setDiaryData(null));
  }, [selectedChild, diaryYear]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  const DISC_LABELS: Record<string, string> = { V_GOOD: 'V. Good', GOOD: 'Good', AVERAGE: 'Average', POOR: 'Poor' };
  const DISC_COLORS: Record<string, string> = { V_GOOD: 'text-green-700 bg-green-100', GOOD: 'text-blue-700 bg-blue-100', AVERAGE: 'text-yellow-700 bg-yellow-100', POOR: 'text-red-700 bg-red-100' };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Scholarship Diary</h1>
          </div>
          <div className="flex items-center gap-2">
            {children.length > 1 && (
              <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
                {children.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.className})</option>
                ))}
              </select>
            )}
            <select value={diaryYear} onChange={e => setDiaryYear(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
              {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {children.length === 1 && (
          <p className="text-sm text-slate-500">{children[0].name} - {children[0].className} {children[0].sectionName}</p>
        )}

        {!diaryData ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
        ) : diaryData.diary?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {diaryData.diary.map((d: any) => {
              const attVal = d.attendancePct;
              const attDisplay = d.isHoliday ? 'Holiday' : (attVal != null ? attVal + '%' : '\u2014');
              const attColor = d.isHoliday ? 'text-blue-600' : (attVal >= 90 ? 'text-green-600' : attVal >= 75 ? 'text-yellow-600' : attVal != null ? 'text-red-600' : 'text-slate-400');

              const testVal = d.testMarksPct;
              const testDisplay = testVal != null ? testVal + '%' : '0%';
              const testColor = testVal >= 80 ? 'text-green-600' : testVal >= 50 ? 'text-yellow-600' : 'text-red-600';

              const feeVal = d.feeSubmissionPct;
              const feeDisplay = feeVal != null ? feeVal + '%' : '0%';
              const feeColor = feeVal >= 80 ? 'text-green-600' : feeVal > 0 ? 'text-yellow-600' : 'text-red-600';

              return (
                <div key={d.month} className="border-2 border-blue-800 rounded-xl overflow-hidden bg-amber-50">
                  <div className="bg-blue-800 text-white text-center py-2 font-bold text-sm uppercase tracking-wide">
                    {d.monthName}
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Attendance:</span>
                        <span className={`font-bold ${attColor}`}>{attDisplay}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Test Marks:</span>
                        <span className={`font-bold ${testColor}`}>{testDisplay}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Fee Submission:</span>
                        <span className={`font-bold ${feeColor}`}>{feeDisplay}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Discipline:</span>
                        {d.discipline ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${DISC_COLORS[d.discipline] || 'bg-slate-100 text-slate-600'}`}>
                            {DISC_LABELS[d.discipline] || d.discipline}
                          </span>
                        ) : <span className="text-slate-400">{'\u2014'}</span>}
                      </div>
                    </div>

                    <div className="flex justify-between items-end border-t border-slate-200 pt-2 mt-1">
                      {d.runningBalance > 0 ? (
                        <span className="text-xs text-red-500">Bal: {formatCurrency(d.runningBalance)}</span>
                      ) : d.runningBalance != null ? (
                        <span className="text-xs text-green-500">Clear</span>
                      ) : <span />}
                      <span className="text-lg font-bold text-blue-800">
                        {d.feeAmount > 0 ? formatCurrency(d.feeAmount) : '\u2014'}
                      </span>
                    </div>

                    {d.comment && (
                      <p className="text-xs text-slate-500 border-t border-slate-200 pt-2">
                        <strong>Comment:</strong> {d.comment}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            No diary entries for this academic year
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
