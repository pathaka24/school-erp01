'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { CalendarCheck, Save, Printer, Users, CheckCircle, XCircle, Clock, BarChart3 } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'P', color: 'bg-green-500 text-white', light: 'bg-green-100 text-green-700' },
  { value: 'ABSENT', label: 'A', color: 'bg-red-500 text-white', light: 'bg-red-100 text-red-700' },
  { value: 'LATE', label: 'L', color: 'bg-yellow-500 text-white', light: 'bg-yellow-100 text-yellow-700' },
  { value: 'EXCUSED', label: 'E', color: 'bg-blue-500 text-white', light: 'bg-blue-100 text-blue-700' },
];

export default function TeacherAttendancePage() {
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [data, setData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, { status: string; checkIn: string; checkOut: string }>>({});

  // Load daily
  useEffect(() => {
    if (tab === 'daily') {
      setLoading(true);
      api.get('/teacher-attendance', { params: { date } }).then(r => {
        setData(r.data);
        const att: Record<string, any> = {};
        r.data.teachers.forEach((t: any) => {
          att[t.id] = {
            status: t.attendance?.status || '',
            checkIn: t.attendance?.checkIn || '',
            checkOut: t.attendance?.checkOut || '',
          };
        });
        setAttendance(att);
      }).finally(() => setLoading(false));
    }
  }, [tab, date]);

  // Load monthly
  useEffect(() => {
    if (tab === 'monthly') {
      setLoading(true);
      api.get('/teacher-attendance', { params: { month } }).then(r => setMonthlyData(r.data)).finally(() => setLoading(false));
    }
  }, [tab, month]);

  const updateAtt = (teacherId: string, field: string, value: string) => {
    setAttendance(prev => ({ ...prev, [teacherId]: { ...prev[teacherId], [field]: value } }));
  };

  const toggleStatus = (teacherId: string) => {
    const current = attendance[teacherId]?.status || '';
    const order = ['', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    updateAtt(teacherId, 'status', next);
  };

  const markAll = (status: string) => {
    const updated = { ...attendance };
    data?.teachers?.forEach((t: any) => { updated[t.id] = { ...updated[t.id], status }; });
    setAttendance(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const records = Object.entries(attendance)
        .filter(([_, v]) => v.status)
        .map(([teacherId, v]) => ({ teacherId, status: v.status, checkIn: v.checkIn || undefined, checkOut: v.checkOut || undefined }));
      await api.post('/teacher-attendance', { date, records });
      alert(`Saved ${records.length} records!`);
    } catch { alert('Failed to save'); }
    setSaving(false);
  };

  const handlePrint = () => {
    if (tab === 'daily' && data) {
      const rows = data.teachers.map((t: any, i: number) => {
        const a = attendance[t.id];
        const statusLabel = a?.status || '—';
        return `<tr><td style="padding:6px 10px">${i + 1}</td><td style="padding:6px 10px">${t.employeeId}</td><td style="padding:6px 10px;font-weight:600">${t.name}</td><td style="padding:6px 10px">${t.phone || '—'}</td><td style="padding:6px 10px;text-align:center;font-weight:bold;color:${statusLabel === 'PRESENT' ? '#16a34a' : statusLabel === 'ABSENT' ? '#dc2626' : statusLabel === 'LATE' ? '#d97706' : '#64748b'}">${statusLabel}</td><td style="padding:6px 10px;text-align:center">${a?.checkIn || '—'}</td><td style="padding:6px 10px;text-align:center">${a?.checkOut || '—'}</td></tr>`;
      }).join('');
      const present = Object.values(attendance).filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
      const absent = Object.values(attendance).filter(a => a.status === 'ABSENT').length;
      const html = `<!DOCTYPE html><html><head><title>Teacher Attendance - ${date}</title>
<style>body{font-family:Arial;margin:20px;color:#1e293b}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1}th{background:#1e3a8a;color:white;padding:8px 10px;font-size:12px;text-transform:uppercase}@media print{body{margin:10px}}</style>
</head><body>
<div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:bold;color:#006400">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div><div style="font-size:11px;color:#666">Salarpur, Sector-101</div><div style="font-size:14px;font-weight:bold;margin-top:8px">TEACHER ATTENDANCE REGISTER</div><div style="font-size:13px;color:#1e40af;font-weight:bold;margin-top:4px">Date: ${new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div></div>
<div style="display:flex;gap:24px;justify-content:center;margin-bottom:12px;font-size:14px"><span>Total: <strong>${data.totalTeachers}</strong></span><span style="color:#16a34a">Present: <strong>${present}</strong></span><span style="color:#dc2626">Absent: <strong>${absent}</strong></span></div>
<table><thead><tr><th>#</th><th>Emp ID</th><th style="text-align:left">Name</th><th>Phone</th><th>Status</th><th>In</th><th>Out</th></tr></thead><tbody>${rows}</tbody></table>
<div style="display:flex;justify-content:space-between;margin-top:40px;font-size:11px"><div style="border-top:1px solid #000;width:160px;text-align:center;padding-top:4px">Admin Signature</div><div style="border-top:1px solid #000;width:160px;text-align:center;padding-top:4px">Principal</div></div>
</body></html>`;
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.print(); }
    }
  };

  const dayName = new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const markedCount = Object.values(attendance).filter(a => a.status).length;

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          <FadeIn>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-6 w-6 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Teacher Attendance</h1>
                  <p className="text-sm text-slate-500">Mark & track staff attendance</p>
                </div>
              </div>
              <div className="flex gap-2">
                {tab === 'daily' && data && (
                  <>
                    <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4" /> Print</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving || markedCount === 0}>
                      <Save className="h-4 w-4" /> {saving ? 'Saving...' : `Save (${markedCount})`}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Tab + Controls */}
          <FadeIn delay={0.05}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                <button onClick={() => setTab('daily')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Daily</button>
                <button onClick={() => setTab('monthly')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Monthly</button>
              </div>
              {tab === 'daily' && <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900" />}
              {tab === 'monthly' && <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900" />}
              {tab === 'daily' && (
                <div className="flex gap-1">
                  <button onClick={() => markAll('PRESENT')} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200">All Present</button>
                  <button onClick={() => markAll('ABSENT')} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200">All Absent</button>
                </div>
              )}
            </div>
          </FadeIn>

          {/* Stats */}
          {tab === 'daily' && data && (
            <FadeIn delay={0.1}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4 text-center"><Users className="h-5 w-5 text-blue-600 mx-auto mb-1" /><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-bold text-slate-900">{data.totalTeachers}</p></Card>
                <Card className="p-4 text-center"><CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" /><p className="text-xs text-slate-500">Present</p><p className="text-2xl font-bold text-green-600">{Object.values(attendance).filter((a: any) => a.status === 'PRESENT').length}</p></Card>
                <Card className="p-4 text-center"><XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" /><p className="text-xs text-slate-500">Absent</p><p className="text-2xl font-bold text-red-600">{Object.values(attendance).filter((a: any) => a.status === 'ABSENT').length}</p></Card>
                <Card className="p-4 text-center"><Clock className="h-5 w-5 text-yellow-600 mx-auto mb-1" /><p className="text-xs text-slate-500">Late</p><p className="text-2xl font-bold text-yellow-600">{Object.values(attendance).filter((a: any) => a.status === 'LATE').length}</p></Card>
              </div>
            </FadeIn>
          )}

          {loading && <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>}

          {/* ─── DAILY VIEW ─── */}
          {tab === 'daily' && data && !loading && (
            <FadeIn delay={0.15}>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-800 text-white px-5 py-3 text-sm font-bold">{dayName}</div>
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-8">#</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Emp ID</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Phone</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500">Check In</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500">Check Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.teachers.map((t: any, i: number) => {
                      const att = attendance[t.id] || { status: '', checkIn: '', checkOut: '' };
                      const statusOpt = STATUS_OPTIONS.find(s => s.value === att.status);
                      return (
                        <tr key={t.id} className={`hover:bg-slate-50 ${att.status === 'ABSENT' ? 'bg-red-50' : att.status === 'LATE' ? 'bg-yellow-50' : ''}`}>
                          <td className="px-4 py-2.5 text-xs text-slate-400">{i + 1}</td>
                          <td className="px-4 py-2.5 text-sm font-mono text-slate-600">{t.employeeId}</td>
                          <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{t.name}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-500">{t.phone || '—'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {STATUS_OPTIONS.map(opt => (
                                <button key={opt.value} onClick={() => updateAtt(t.id, 'status', att.status === opt.value ? '' : opt.value)}
                                  className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${att.status === opt.value ? opt.color + ' scale-110 shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input type="time" value={att.checkIn} onChange={e => updateAtt(t.id, 'checkIn', e.target.value)}
                              className="w-24 px-1.5 py-1 border border-slate-200 rounded text-xs text-slate-700 text-center" />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input type="time" value={att.checkOut} onChange={e => updateAtt(t.id, 'checkOut', e.target.value)}
                              className="w-24 px-1.5 py-1 border border-slate-200 rounded text-xs text-slate-700 text-center" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </FadeIn>
          )}

          {/* ─── MONTHLY VIEW ─── */}
          {tab === 'monthly' && monthlyData && !loading && (
            <FadeIn delay={0.15}>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="text-left px-3 py-3 font-semibold sticky left-0 bg-slate-800 z-10">#</th>
                      <th className="text-left px-3 py-3 font-semibold sticky left-8 bg-slate-800 z-10 min-w-[140px]">Name</th>
                      {Array.from({ length: new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate() }, (_, i) => {
                        const d = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]) - 1, i + 1);
                        const dayName = d.toLocaleDateString('en-IN', { weekday: 'narrow' });
                        const isSun = d.getDay() === 0;
                        return <th key={i} className={`px-1 py-2 text-center min-w-[28px] ${isSun ? 'bg-red-900' : ''}`}>{i + 1}<br /><span className="font-normal opacity-60">{dayName}</span></th>;
                      })}
                      <th className="px-2 py-3 text-center bg-green-900">P</th>
                      <th className="px-2 py-3 text-center bg-red-900">A</th>
                      <th className="px-2 py-3 text-center">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.teachers.map((t: any, idx: number) => {
                      const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
                      const recordMap = new Map(t.records.map((r: any) => [new Date(r.date).getUTCDate(), r.status]));
                      return (
                        <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-400 sticky left-0 bg-white">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-900 sticky left-8 bg-white">{t.name}</td>
                          {Array.from({ length: daysInMonth }, (_, i) => {
                            const day = i + 1;
                            const status = recordMap.get(day) as string | undefined;
                            const d = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]) - 1, day);
                            const isSun = d.getDay() === 0;
                            const color = status === 'PRESENT' ? 'bg-green-500 text-white' : status === 'ABSENT' ? 'bg-red-500 text-white' : status === 'LATE' ? 'bg-yellow-400 text-white' : status === 'EXCUSED' ? 'bg-blue-400 text-white' : isSun ? 'bg-red-50 text-red-300' : 'bg-slate-50 text-slate-300';
                            const label = status === 'PRESENT' ? 'P' : status === 'ABSENT' ? 'A' : status === 'LATE' ? 'L' : status === 'EXCUSED' ? 'E' : isSun ? 'S' : '·';
                            return <td key={i} className={`px-0 py-1 text-center font-bold ${color}`} style={{ fontSize: '10px' }}>{label}</td>;
                          })}
                          <td className="px-2 py-2 text-center font-bold text-green-700">{t.summary.present}</td>
                          <td className="px-2 py-2 text-center font-bold text-red-700">{t.summary.absent}</td>
                          <td className={`px-2 py-2 text-center font-bold ${t.summary.pct >= 90 ? 'text-green-600' : t.summary.pct >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>{t.summary.pct}%</td>
                        </tr>
                      );
                    })}
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
