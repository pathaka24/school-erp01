'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Save, User, BookOpen, GraduationCap, Calendar, Camera, Printer, MapPin, CreditCard, Clock, CalendarCheck, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';

const TABS = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'timetable', label: 'Timetable', icon: Calendar },
  { id: 'academic', label: 'Academic', icon: BookOpen },
  { id: 'classes', label: 'Classes & Students', icon: GraduationCap },
  { id: 'bank', label: 'Bank & Salary', icon: CreditCard },
];

const DESIGNATIONS = ['PRT', 'TGT', 'PGT', 'Principal', 'Vice Principal', 'Librarian', 'PTI', 'Lab Assistant', 'Clerk'];
const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export default function TeacherProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [teacher, setTeacher] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [attData, setAttData] = useState<any>(null);
  const [attMonth, setAttMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });

  useEffect(() => {
    api.get(`/teachers/${id}`).then(r => {
      setTeacher(r.data);
      setForm({
        firstName: r.data.user.firstName,
        lastName: r.data.user.lastName,
        phone: r.data.user.phone || '',
        qualification: r.data.qualification || '',
        specialization: r.data.specialization || '',
        experience: r.data.experience || 0,
        dateOfBirth: r.data.dateOfBirth ? r.data.dateOfBirth.slice(0, 10) : '',
        gender: r.data.gender || '',
        bloodGroup: r.data.bloodGroup || '',
        aadhaarNumber: r.data.aadhaarNumber || '',
        panNumber: r.data.panNumber || '',
        address: r.data.address || '',
        city: r.data.city || '',
        state: r.data.state || '',
        pincode: r.data.pincode || '',
        emergencyContact: r.data.emergencyContact || '',
        emergencyPhone: r.data.emergencyPhone || '',
        bankName: r.data.bankName || '',
        bankAccount: r.data.bankAccount || '',
        ifscCode: r.data.ifscCode || '',
        salary: r.data.salary || '',
        designation: r.data.designation || '',
        department: r.data.department || '',
      });
    }).catch(() => router.push('/teachers')).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (activeTab === 'attendance' && id) {
      api.get(`/teachers/${id}/attendance?month=${attMonth}`).then(r => setAttData(r.data)).catch(() => setAttData(null));
    }
  }, [activeTab, attMonth, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/teachers/${id}`, form);
      alert('Saved!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed');
    }
    setSaving(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const { data } = await api.post(`/teachers/${id}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setTeacher((prev: any) => ({ ...prev, photo: data.photo }));
    } catch { alert('Upload failed'); }
    setUploadingPhoto(false);
    e.target.value = '';
  };

  const printProfile = () => {
    if (!teacher) return;
    const html = `<!DOCTYPE html><html><head><title>Teacher Profile - ${form.firstName} ${form.lastName}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial;margin:20px;color:#1e293b;font-size:13px}
.card{border:2px solid #006400;border-radius:12px;overflow:hidden;max-width:700px;margin:0 auto}
.card-header{background:#006400;color:white;text-align:center;padding:12px}
.school{font-size:18px;font-weight:bold;letter-spacing:1px}
.card-body{padding:20px}.profile-row{display:flex;gap:20px;margin-bottom:16px}
.info-grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:3px 16px}
.label{font-size:10px;color:#64748b;text-transform:uppercase}.value{font-size:13px;font-weight:600;margin-bottom:4px}
h3{color:#006400;font-size:12px;border-bottom:2px solid #006400;padding-bottom:3px;margin:14px 0 8px;text-transform:uppercase;letter-spacing:1px}
.sig-row{display:flex;justify-content:space-between;margin-top:30px;padding:0 20px 16px}
.sig-line{border-top:1px solid #000;width:180px;text-align:center;padding-top:4px;font-size:10px}
@media print{body{margin:10px}}</style></head><body>
<div class="card"><div class="card-header"><div class="school">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
<div style="font-size:10px;opacity:0.8">Salarpur, Sector - 101</div>
<div style="font-size:13px;font-weight:bold;margin-top:4px;letter-spacing:2px">TEACHER PROFILE</div></div>
<div class="card-body">
<div style="text-align:center;margin-bottom:12px"><span style="display:inline-block;background:#dc2626;color:white;padding:3px 20px;border-radius:4px;font-weight:bold;font-size:15px">${teacher.employeeId}</span></div>
<div class="profile-row">
<div style="width:120px;height:150px;border-radius:8px;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-size:40px;font-weight:bold;color:#94a3b8">${form.firstName?.[0] || ''}${form.lastName?.[0] || ''}</div>
<div class="info-grid">
<div><div class="label">Name</div><div class="value" style="font-size:16px">${form.firstName} ${form.lastName}</div></div>
<div><div class="label">Designation</div><div class="value">${form.designation || '—'}</div></div>
<div><div class="label">Email</div><div class="value">${teacher.user.email}</div></div>
<div><div class="label">Phone</div><div class="value">${form.phone || '—'}</div></div>
<div><div class="label">Qualification</div><div class="value">${form.qualification || '—'}</div></div>
<div><div class="label">Experience</div><div class="value">${form.experience || 0} years</div></div>
<div><div class="label">DOB</div><div class="value">${form.dateOfBirth ? new Date(form.dateOfBirth).toLocaleDateString('en-IN') : '—'}</div></div>
<div><div class="label">Gender</div><div class="value">${form.gender || '—'}</div></div>
</div></div>
<h3>Subjects & Classes</h3>
<div class="info-grid">
<div><div class="label">Subjects</div><div class="value">${teacher.subjects?.map((s: any) => s.name).join(', ') || '—'}</div></div>
<div><div class="label">Class Teacher of</div><div class="value">${teacher.classSections?.map((s: any) => `${s.class.name} - ${s.name}`).join(', ') || '—'}</div></div>
</div>
<h3>Address</h3>
<div style="font-size:13px;font-weight:500">${[form.address, form.city, form.state, form.pincode].filter(Boolean).join(', ') || '—'}</div>
${form.bankAccount ? `<h3>Bank Details</h3><div class="info-grid">
<div><div class="label">Bank</div><div class="value">${form.bankName || '—'}</div></div>
<div><div class="label">Account</div><div class="value">${form.bankAccount}</div></div>
<div><div class="label">IFSC</div><div class="value">${form.ifscCode || '—'}</div></div>
</div>` : ''}
</div>
<div class="sig-row"><div class="sig-line">Teacher's Signature</div><div class="sig-line">Principal</div></div>
</div></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const u = (field: string, value: any) => setForm({ ...form, [field]: value });

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/teachers')} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft className="h-5 w-5 text-slate-600" /></button>
            {/* Photo */}
            <div className="relative group">
              {teacher?.photo ? (
                <img src={teacher.photo} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-blue-200" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl font-bold">
                  {form.firstName?.[0]}{form.lastName?.[0]}
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 shadow-lg">
                {uploadingPhoto ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="h-3 w-3" />}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
              </label>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{form.firstName} {form.lastName}</h1>
              <p className="text-slate-500">{teacher?.employeeId} | {form.designation || 'Teacher'} | {teacher?.user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center cursor-pointer group" onClick={() => setShowQR(true)}>
              <div className="bg-white border border-slate-200 rounded-lg p-1.5 group-hover:border-emerald-400 transition">
                <QRCode value={`TCH:${id}`} size={56} />
              </div>
              <span className="text-[9px] text-slate-400 mt-0.5">ID Card</span>
            </div>
            <button onClick={printProfile} className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm"><Printer className="h-4 w-4" /> Print</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <tab.icon className="h-4 w-4" />{tab.label}
            </button>
          ))}
        </div>

        {/* PERSONAL TAB */}
        {activeTab === 'personal' && (
          <div className="space-y-5">
            {/* Hero */}
            <div className="bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-700 rounded-2xl p-6 text-white flex flex-col md:flex-row gap-6 items-center">
              <div className="relative group shrink-0">
                {teacher?.photo ? (
                  <img src={teacher.photo} alt="" className="w-32 h-32 rounded-2xl object-cover border-4 border-white/20 shadow-lg" />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-white/10 flex items-center justify-center text-5xl font-bold text-white/60">{form.firstName?.[0]}{form.lastName?.[0]}</div>
                )}
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-bold">{form.firstName} {form.lastName}</h2>
                <div className="flex flex-wrap gap-2 mt-2 justify-center md:justify-start">
                  <span className="px-3 py-1 bg-white/10 rounded-full text-sm">{teacher?.employeeId}</span>
                  {form.designation && <span className="px-3 py-1 bg-white/10 rounded-full text-sm">{form.designation}</span>}
                  {form.qualification && <span className="px-3 py-1 bg-white/10 rounded-full text-sm">{form.qualification}</span>}
                  {form.experience > 0 && <span className="px-3 py-1 bg-white/10 rounded-full text-sm">{form.experience} yrs exp</span>}
                  {form.bloodGroup && <span className="px-3 py-1 bg-red-500/30 rounded-full text-sm font-bold">{form.bloodGroup}</span>}
                </div>
                {teacher?.subjects?.length > 0 && (
                  <p className="text-emerald-200 text-sm mt-2">Subjects: {teacher.subjects.map((s: any) => s.name).join(', ')}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><User className="h-4 w-4 text-blue-600" /></div><h3 className="text-sm font-semibold text-slate-900">Basic Details</h3></div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" value={form.firstName} onChange={v => u('firstName', v)} />
                  <Field label="Last Name" value={form.lastName} onChange={v => u('lastName', v)} />
                  <Field label="Date of Birth" value={form.dateOfBirth} onChange={v => u('dateOfBirth', v)} type="date" />
                  <Select label="Gender" value={form.gender} onChange={v => u('gender', v)} options={GENDERS.map(g => ({ v: g, l: g.charAt(0) + g.slice(1).toLowerCase() }))} />
                  <Field label="Blood Group" value={form.bloodGroup} onChange={v => u('bloodGroup', v)} placeholder="e.g. O+" />
                  <Field label="Phone" value={form.phone} onChange={v => u('phone', v)} />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><MapPin className="h-4 w-4 text-green-600" /></div><h3 className="text-sm font-semibold text-slate-900">Contact & Identity</h3></div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Aadhaar No." value={form.aadhaarNumber} onChange={v => u('aadhaarNumber', v)} />
                  <Field label="PAN No." value={form.panNumber} onChange={v => u('panNumber', v)} />
                  <Field label="Emergency Contact" value={form.emergencyContact} onChange={v => u('emergencyContact', v)} />
                  <Field label="Emergency Phone" value={form.emergencyPhone} onChange={v => u('emergencyPhone', v)} />
                  <div className="col-span-2"><Field label="Address" value={form.address} onChange={v => u('address', v)} /></div>
                  <Field label="City" value={form.city} onChange={v => u('city', v)} />
                  <div className="flex gap-2"><Field label="State" value={form.state} onChange={v => u('state', v)} /><Field label="Pincode" value={form.pincode} onChange={v => u('pincode', v)} /></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACADEMIC TAB */}
        {activeTab === 'academic' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Professional Details</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Select label="Designation" value={form.designation} onChange={v => u('designation', v)} options={DESIGNATIONS.map(d => ({ v: d, l: d }))} />
                <Field label="Department" value={form.department} onChange={v => u('department', v)} placeholder="e.g. Science, Maths" />
                <Field label="Qualification" value={form.qualification} onChange={v => u('qualification', v)} placeholder="e.g. B.Ed, M.A." />
                <Field label="Specialization" value={form.specialization} onChange={v => u('specialization', v)} />
                <Field label="Experience (years)" value={form.experience} onChange={v => u('experience', v)} type="number" />
                <Field label="Joining Date" value={teacher?.joiningDate?.slice(0, 10)} disabled />
              </div>
            </div>
            {/* Subjects */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Subjects Assigned</h3>
              {teacher?.subjects?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {teacher.subjects.map((s: any) => (
                    <span key={s.id} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">{s.name} ({s.code})</span>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">No subjects assigned</p>}
            </div>
          </div>
        )}

        {/* CLASSES & STUDENTS TAB */}
        {activeTab === 'classes' && (
          <div className="space-y-5">
            {teacher?.classSections?.length > 0 ? teacher.classSections.map((sec: any) => (
              <div key={sec.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-emerald-700 text-white px-5 py-3 flex items-center justify-between">
                  <h3 className="font-bold">{sec.class.name} — Section {sec.name}</h3>
                  <span className="text-sm text-emerald-200">{sec.students?.length || 0} students</span>
                </div>
                {sec.students?.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {sec.students.map((s: any, i: number) => (
                      <div key={s.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-xs text-slate-400 text-right">{i + 1}.</span>
                          <span className="text-sm font-medium text-slate-900">{s.user.firstName} {s.user.lastName}</span>
                        </div>
                        <span className="text-xs text-slate-400">{s.admissionNo}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="p-5 text-sm text-slate-400">No students</p>}
              </div>
            )) : <p className="text-slate-400 text-center py-8">Not assigned as class teacher to any section</p>}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="space-y-5">
            {/* Month selector + summary */}
            <div className="flex items-center gap-4 flex-wrap">
              <input type="month" value={attMonth} onChange={e => setAttMonth(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              {attData?.summary && (
                <div className="flex gap-3">
                  <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-bold">Present: {attData.summary.present}</span>
                  <span className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-bold">Absent: {attData.summary.absent}</span>
                  <span className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-bold">Late: {attData.summary.late}</span>
                  <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold">{attData.summary.pct}%</span>
                </div>
              )}
            </div>
            {/* Calendar grid */}
            {attData?.records?.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Day</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Check In</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Check Out</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attData.records.map((r: any) => {
                      const d = new Date(r.date);
                      const statusColors: Record<string, string> = { PRESENT: 'bg-green-100 text-green-700', ABSENT: 'bg-red-100 text-red-700', LATE: 'bg-yellow-100 text-yellow-700', EXCUSED: 'bg-blue-100 text-blue-700' };
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium">{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                          <td className="px-4 py-2.5 text-center text-slate-500">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[r.status] || 'bg-slate-100 text-slate-600'}`}>{r.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-600">{r.checkIn || '—'}</td>
                          <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-600">{r.checkOut || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-400">{r.remarks || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No attendance records for this month</p>
            )}
          </div>
        )}

        {/* TIMETABLE TAB — Period-wise table */}
        {activeTab === 'timetable' && (() => {
          const slots = teacher?.timetableSlots || [];
          // Build unique periods (sorted by startTime)
          const periodSet = new Map<string, { startTime: string; endTime: string }>();
          slots.forEach((s: any) => {
            const key = `${s.startTime}-${s.endTime}`;
            if (!periodSet.has(key)) periodSet.set(key, { startTime: s.startTime, endTime: s.endTime });
          });
          const periods = Array.from(periodSet.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));

          // Build lookup: day+period -> slot
          const lookup = new Map<string, any>();
          slots.forEach((s: any) => {
            lookup.set(`${s.dayOfWeek}|${s.startTime}-${s.endTime}`, s);
          });

          return (
            <div className="space-y-4">
              {periods.length > 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="px-3 py-3 text-left font-semibold w-28">Day / Period</th>
                        {periods.map((p, i) => (
                          <th key={i} className="px-2 py-3 text-center font-semibold">
                            <div>Period {i + 1}</div>
                            <div className="text-[10px] font-normal opacity-70">{p.startTime}–{p.endTime}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map(day => (
                        <tr key={day} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-3 font-bold text-slate-700 bg-slate-50">{day.slice(0, 3)}</td>
                          {periods.map((p, i) => {
                            const slot = lookup.get(`${day}|${p.startTime}-${p.endTime}`);
                            return (
                              <td key={i} className="px-2 py-2 text-center">
                                {slot ? (
                                  <div>
                                    <div className="font-bold text-blue-700">{slot.subject?.name || '—'}</div>
                                    <div className="text-[10px] text-slate-400">{slot.section?.class?.name}-{slot.section?.name}</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-200">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">No timetable slots assigned</p>
              )}
            </div>
          );
        })()}

        {/* BANK & SALARY TAB */}
        {activeTab === 'bank' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Bank & Salary Details</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Bank Name" value={form.bankName} onChange={v => u('bankName', v)} />
              <Field label="Account Number" value={form.bankAccount} onChange={v => u('bankAccount', v)} />
              <Field label="IFSC Code" value={form.ifscCode} onChange={v => u('ifscCode', v)} />
              <Field label="Monthly Salary (₹)" value={form.salary} onChange={v => u('salary', v)} type="number" />
            </div>
          </div>
        )}
      </div>

      {/* QR ID Card Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div id="teacher-id-card" className="p-6">
              <div className="border-2 border-emerald-800 rounded-xl overflow-hidden">
                <div className="text-center py-3 text-white" style={{ background: '#006400' }}>
                  <p className="text-sm font-bold tracking-wider">PATHAK EDUCATIONAL FOUNDATION SCHOOL</p>
                  <p className="text-[10px] opacity-80">Staff Identity Card</p>
                </div>
                <div className="p-4 flex gap-4">
                  <div className="flex-1">
                    {teacher?.photo ? (
                      <img src={teacher.photo} alt="" className="w-24 h-28 object-cover rounded-lg border border-slate-200" />
                    ) : (
                      <div className="w-24 h-28 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold">
                        {form.firstName?.[0]}{form.lastName?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-xs space-y-1.5">
                    <div><span className="text-slate-400">Name</span><p className="font-bold text-slate-900">{form.firstName} {form.lastName}</p></div>
                    <div><span className="text-slate-400">Designation</span><p className="font-bold text-slate-900">{form.designation || 'Teacher'}</p></div>
                    <div><span className="text-slate-400">Employee ID</span><p className="font-bold text-blue-700">{teacher?.employeeId}</p></div>
                    <div><span className="text-slate-400">Subjects</span><p className="font-bold text-slate-900">{teacher?.subjects?.map((s: any) => s.name).join(', ') || '—'}</p></div>
                  </div>
                </div>
                <div className="flex items-center justify-center pb-4">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <QRCode value={`TCH:${id}`} size={100} />
                  </div>
                </div>
                <div className="text-center py-2 bg-slate-100 text-[10px] text-slate-500">Scan for attendance</div>
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button onClick={() => {
                const el = document.getElementById('teacher-id-card');
                if (!el) return;
                const w = window.open('', '_blank');
                if (w) { w.document.write(`<html><head><title>ID - ${form.firstName} ${form.lastName}</title><style>body{margin:20px;font-family:Arial}@media print{body{margin:10px}}</style></head><body>${el.innerHTML}</body></html>`); w.document.close(); w.print(); }
              }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 text-sm font-medium">
                <Printer className="h-4 w-4" /> Print ID Card
              </button>
              <button onClick={() => setShowQR(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, disabled }: {
  label: string; value: string; onChange?: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled}
        className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 ${disabled ? 'bg-slate-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500'} outline-none`} />
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none">
        <option value="">Select</option>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
