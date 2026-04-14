'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Camera, CheckCircle, XCircle, Clock, User, CreditCard, CalendarCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  PRESENT: { color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle, label: 'Present' },
  ABSENT: { color: 'text-red-700', bg: 'bg-red-100', icon: XCircle, label: 'Absent' },
  LATE: { color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Clock, label: 'Late' },
  EXCUSED: { color: 'text-blue-700', bg: 'bg-blue-100', icon: CalendarCheck, label: 'Excused' },
};

export default function QrScanPage() {
  const [scanning, setScanning] = useState(false);
  const [studentData, setStudentData] = useState<any>(null);
  const [marking, setMarking] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [teacherData, setTeacherData] = useState<any>(null);

  const handleScan = useCallback(async (studentId: string) => {
    if (!studentId || studentData?.student?.id === studentId) return;
    setError(null);
    setTeacherData(null);
    try {
      const { data } = await api.get(`/students/${studentId}/qr-scan`);
      setStudentData(data);
      setLastAction(null);
    } catch {
      setError('Student not found');
      setStudentData(null);
    }
  }, [studentData]);

  const handleTeacherScan = useCallback(async (teacherId: string) => {
    if (!teacherId || teacherData?.teacher?.id === teacherId) return;
    setError(null);
    setStudentData(null);
    try {
      const { data } = await api.get(`/teachers/${teacherId}/qr-scan`);
      setTeacherData(data);
      setLastAction(null);
    } catch {
      setError('Teacher not found');
      setTeacherData(null);
    }
  }, [teacherData]);

  const startScanner = async () => {
    setScanning(true);
    setError(null);
    // Dynamic import to avoid SSR issues
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          // QR format: "STU:{id}" for students, "TCH:{id}" for teachers, or raw UUID
          if (decodedText.startsWith('TCH:')) {
            const teacherId = decodedText.slice(4);
            handleTeacherScan(teacherId);
          } else {
            const id = decodedText.startsWith('STU:') ? decodedText.slice(4) : decodedText;
            handleScan(id);
          }
        },
        () => {} // ignore errors during scan
      );
    } catch (err) {
      setError('Camera access denied or not available');
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { if (scannerRef.current) { try { scannerRef.current.stop(); } catch {} } };
  }, []);

  const markAttendance = async (status: string) => {
    const isTeacher = !!teacherData;
    const entityId = isTeacher ? teacherData.teacher.id : studentData?.student?.id;
    if (!entityId) return;
    setMarking(true);
    try {
      const endpoint = isTeacher ? `/teachers/${entityId}/qr-scan` : `/students/${entityId}/qr-scan`;
      await api.post(endpoint, { status });
      setLastAction(status);
      const entity = isTeacher ? teacherData.teacher : studentData.student;
      setScanHistory(prev => [{ ...entity, type: isTeacher ? 'teacher' : 'student', status, time: new Date() }, ...prev.slice(0, 19)]);
      // Refresh
      const { data } = await api.get(endpoint.replace('/qr-scan', '/qr-scan'));
      if (isTeacher) setTeacherData(data);
      else setStudentData(data);
    } catch {
      setError('Failed to mark attendance');
    }
    setMarking(false);
  };

  // Manual ID input
  const [manualId, setManualId] = useState('');
  const handleManualSearch = async () => {
    if (!manualId.trim()) return;
    // Search by admission number or ID
    try {
      const { data: students } = await api.get('/students', { params: { search: manualId.trim() } });
      if (students.length > 0) {
        handleScan(students[0].id);
      } else {
        setError('No student found');
      }
    } catch { setError('Search failed'); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">QR Attendance Scanner</h1>
          <div className="flex gap-2">
            {!scanning ? (
              <Button onClick={startScanner} variant="default">
                <Camera className="h-4 w-4" /> Start Scanner
              </Button>
            ) : (
              <Button onClick={stopScanner} variant="destructive">
                Stop Scanner
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Scanner + Manual */}
          <div className="space-y-4">
            {/* QR Scanner */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Scan QR Code</CardTitle>
              </CardHeader>
              <CardContent>
                <div id="qr-reader" ref={containerRef}
                  className={`w-full rounded-lg overflow-hidden ${scanning ? 'min-h-[280px]' : 'h-48 bg-slate-100 flex items-center justify-center'}`}>
                  {!scanning && (
                    <div className="text-center text-slate-400">
                      <Camera className="h-12 w-12 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Click "Start Scanner" to begin</p>
                    </div>
                  )}
                </div>
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              </CardContent>
            </Card>

            {/* Manual search */}
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Or search manually</p>
                <div className="flex gap-2">
                  <input placeholder="Name or Admission No..." value={manualId}
                    onChange={e => setManualId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                  <Button onClick={handleManualSearch} size="sm" variant="outline">Search</Button>
                </div>
              </CardContent>
            </Card>

            {/* Scan History */}
            {scanHistory.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Today's Scans ({scanHistory.length})</CardTitle>
                </CardHeader>
                <CardContent className="max-h-60 overflow-y-auto">
                  <div className="space-y-1.5">
                    {scanHistory.map((h, i) => {
                      const cfg = STATUS_CONFIG[h.status];
                      return (
                        <div key={i} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                          <div>
                            <span className="font-medium text-slate-900">{h.name}</span>
                            <span className="text-slate-400 ml-2">{h.class}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`${cfg?.bg} ${cfg?.color} text-[10px]`}>{cfg?.label}</Badge>
                            <span className="text-slate-400">{h.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Center + Right: Person card + quick attendance */}
          <div className="lg:col-span-2 space-y-4">
            {/* Teacher Card */}
            {teacherData && (
              <>
                <Card className="overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-900 to-emerald-700 p-5 text-white">
                    <div className="flex items-center gap-4">
                      {teacherData.teacher.photo ? (
                        <img src={teacherData.teacher.photo} alt="" className="w-20 h-20 rounded-full object-cover border-3 border-white/30" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
                          {teacherData.teacher.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                      )}
                      <div className="flex-1">
                        <Badge className="bg-emerald-500/30 text-emerald-100 text-[10px] mb-1">TEACHER</Badge>
                        <h2 className="text-2xl font-bold">{teacherData.teacher.name}</h2>
                        <p className="text-emerald-200 text-sm">{teacherData.teacher.designation || 'Teacher'} | {teacherData.teacher.employeeId}</p>
                        {teacherData.teacher.subjects?.length > 0 && (
                          <p className="text-emerald-300 text-xs mt-1">Subjects: {teacherData.teacher.subjects.join(', ')}</p>
                        )}
                      </div>
                      <Link href={`/teachers/${teacherData.teacher.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/20 rounded-lg text-xs hover:bg-white/30 transition">
                        <ExternalLink className="h-3.5 w-3.5" /> Profile
                      </Link>
                    </div>
                  </div>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 rounded-xl bg-slate-50">
                        <p className="text-[10px] text-slate-400 uppercase">Today</p>
                        {teacherData.todayAttendance ? (
                          <div className={`flex items-center justify-center gap-1.5 mt-1 ${STATUS_CONFIG[teacherData.todayAttendance.status]?.color}`}>
                            <span className="text-lg font-bold">{STATUS_CONFIG[teacherData.todayAttendance.status]?.label}</span>
                            {teacherData.todayAttendance.checkIn && <span className="text-xs text-slate-400 ml-2">In: {teacherData.todayAttendance.checkIn}</span>}
                          </div>
                        ) : <p className="text-lg font-bold text-slate-300 mt-1">Not Marked</p>}
                      </div>
                      <div className="text-center p-3 rounded-xl bg-slate-50">
                        <p className="text-[10px] text-slate-400 uppercase">This Month</p>
                        <p className="text-lg font-bold text-blue-700 mt-1">{teacherData.monthAttendance.present}/{teacherData.monthAttendance.total}</p>
                        <p className="text-[10px] text-slate-400">{teacherData.monthAttendance.pct}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Mark Attendance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-3">
                      {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
                        const Icon = cfg.icon;
                        const isActive = teacherData.todayAttendance?.status === status;
                        return (
                          <button key={status} onClick={() => markAttendance(status)} disabled={marking}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${isActive ? `${cfg.bg} ${cfg.color} border-current shadow-lg scale-105` : 'border-slate-200 text-slate-600 hover:border-slate-400'} ${marking ? 'opacity-50' : ''}`}>
                            <Icon className="h-8 w-8" />
                            <span className="text-sm font-bold">{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {!studentData && !teacherData ? (
              <Card className="p-12 text-center text-slate-400">
                <Camera className="h-16 w-16 mx-auto mb-3 opacity-20" />
                <p className="text-lg">Scan a student QR code or search manually</p>
                <p className="text-sm mt-1">Student profile and attendance will appear here</p>
              </Card>
            ) : (
              <>
                {/* Student Profile Card */}
                <Card className="overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-5 text-white">
                    <div className="flex items-center gap-4">
                      {studentData.student.photo ? (
                        <img src={studentData.student.photo} alt="" className="w-20 h-20 rounded-full object-cover border-3 border-white/30" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
                          {studentData.student.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold">{studentData.student.name}</h2>
                        <p className="text-blue-200 text-sm">
                          {studentData.student.class} | Adm: {studentData.student.admissionNo}
                          {studentData.student.fatherName && ` | S/o ${studentData.student.fatherName}`}
                        </p>
                      </div>
                      <Link href={`/students/${studentData.student.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/20 rounded-lg text-xs hover:bg-white/30 transition">
                        <ExternalLink className="h-3.5 w-3.5" /> Full Profile
                      </Link>
                    </div>
                  </div>

                  <CardContent className="pt-4">
                    <div className="grid grid-cols-3 gap-4">
                      {/* Today's Attendance */}
                      <div className="text-center p-3 rounded-xl bg-slate-50">
                        <p className="text-[10px] text-slate-400 uppercase">Today</p>
                        {studentData.todayAttendance ? (
                          <>
                            {(() => {
                              const cfg = STATUS_CONFIG[studentData.todayAttendance.status];
                              const Icon = cfg?.icon || CheckCircle;
                              return (
                                <div className={`flex items-center justify-center gap-1.5 mt-1 ${cfg?.color}`}>
                                  <Icon className="h-5 w-5" />
                                  <span className="text-lg font-bold">{cfg?.label}</span>
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <p className="text-lg font-bold text-slate-300 mt-1">Not Marked</p>
                        )}
                      </div>
                      {/* Month Attendance */}
                      <div className="text-center p-3 rounded-xl bg-slate-50">
                        <p className="text-[10px] text-slate-400 uppercase">This Month</p>
                        <p className="text-lg font-bold text-blue-700 mt-1">{studentData.monthAttendance.present}/{studentData.monthAttendance.total}</p>
                        <p className="text-[10px] text-slate-400">{studentData.monthAttendance.pct}% attendance</p>
                      </div>
                      {/* Fee Balance */}
                      <div className="text-center p-3 rounded-xl bg-slate-50">
                        <p className="text-[10px] text-slate-400 uppercase">Fee Balance</p>
                        <p className={`text-lg font-bold mt-1 ${studentData.feeBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(studentData.feeBalance)}
                        </p>
                        <p className="text-[10px] text-slate-400">{studentData.feeBalance > 0 ? 'Dues pending' : 'All clear'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Attendance Buttons */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Mark Attendance — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</CardTitle>
                      {lastAction && (
                        <Badge variant="success" className="text-xs">Marked {STATUS_CONFIG[lastAction]?.label}!</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-3">
                      {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
                        const Icon = cfg.icon;
                        const isActive = studentData.todayAttendance?.status === status;
                        return (
                          <button key={status} onClick={() => markAttendance(status)} disabled={marking}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                              isActive ? `${cfg.bg} ${cfg.color} border-current shadow-lg scale-105` : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                            } ${marking ? 'opacity-50' : ''}`}>
                            <Icon className="h-8 w-8" />
                            <span className="text-sm font-bold">{cfg.label}</span>
                            {isActive && <span className="text-[10px]">Current</span>}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
