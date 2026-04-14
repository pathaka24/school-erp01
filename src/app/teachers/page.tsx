'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { Plus, Trash2, Copy, Check, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import Link from 'next/link';

interface Teacher {
  id: string;
  employeeId: string;
  qualification?: string;
  experience?: number;
  user: { firstName: string; lastName: string; email: string; phone?: string };
  subjects: { id: string; name: string; code: string }[];
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '',
    employeeId: '', qualification: '', experience: 0, designation: '',
  });
  const [createdTeacher, setCreatedTeacher] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');

  // Reset password modal
  const [resetModal, setResetModal] = useState<Teacher | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => { fetchTeachers(); }, []);

  const fetchTeachers = async () => {
    try {
      const { data } = await api.get('/teachers');
      setTeachers(data);
    } catch {} finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.password) { alert('Password is required'); return; }
    try {
      const { data } = await api.post('/teachers', form);
      setCreatedTeacher({ ...data, email: form.email, password: form.password });
      setShowForm(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '', password: '', employeeId: '', qualification: '', experience: 0, designation: '' });
      fetchTeachers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create teacher');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this teacher? This cannot be undone.')) return;
    try { await api.delete(`/teachers/${id}`); fetchTeachers(); } catch { alert('Failed to delete'); }
  };

  const handleResetPassword = async () => {
    if (!resetModal || !newPassword) return;
    if (newPassword.length < 6) { alert('Password must be at least 6 characters'); return; }
    setResetting(true);
    try {
      await api.post(`/teachers/${resetModal.id}/reset-password`, { password: newPassword });
      setResetDone(true);
    } catch { alert('Failed to reset password'); }
    setResetting(false);
  };

  const copyCredentials = () => {
    if (!createdTeacher) return;
    navigator.clipboard.writeText(`Email: ${createdTeacher.email}\nPassword: ${createdTeacher.password}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const filteredTeachers = search
    ? teachers.filter(t => `${t.user.firstName} ${t.user.lastName} ${t.employeeId} ${t.user.email}`.toLowerCase().includes(search.toLowerCase()))
    : teachers;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Teachers</h1>
            <p className="text-slate-500">{teachers.length} total teachers</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="h-4 w-4" /> Add Teacher
          </button>
        </div>

        {/* Created teacher credentials */}
        {createdTeacher && (
          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <h3 className="font-bold text-green-800">Teacher Created!</h3>
              </div>
              <button onClick={() => setCreatedTeacher(null)} className="text-green-400 hover:text-green-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="bg-white rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Name</span><span className="font-medium">{createdTeacher.user?.firstName} {createdTeacher.user?.lastName}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Employee ID</span><span className="font-mono font-medium">{createdTeacher.employeeId}</span></div>
              <hr className="border-slate-200" />
              <div className="flex justify-between text-sm"><span className="text-slate-500">Login Email</span><span className="font-mono font-bold text-blue-700">{createdTeacher.email}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Password</span><span className="font-mono font-bold text-red-600">{createdTeacher.password}</span></div>
            </div>
            <button onClick={copyCredentials} className="mt-3 flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 text-sm">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied!' : 'Copy Credentials'}
            </button>
          </div>
        )}

        {/* Add Teacher Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Add New Teacher</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block text-xs font-medium text-slate-500 mb-1">First Name *</label><input value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Last Name</label><input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Employee ID *</label><input value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required placeholder="EMP-018" /></div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-3">Login Credentials</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-blue-600 mb-1">Email (login) *</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm text-slate-900 bg-white" required placeholder="name@school.com" /></div>
                  <div>
                    <label className="block text-xs font-medium text-blue-600 mb-1">Password *</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2 pr-10 border border-blue-300 rounded-lg text-sm text-slate-900 bg-white" required placeholder="Set password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Phone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Designation</label><select value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"><option value="">Select</option>{['PRT','TGT','PGT','Principal','Vice Principal','Librarian','PTI'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Qualification</label><input value={form.qualification} onChange={e => setForm({...form, qualification: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" placeholder="B.Ed" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Experience (yrs)</label><input type="number" value={form.experience} onChange={e => setForm({...form, experience: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Create Teacher</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div>
          <input placeholder="Search by name, email, or employee ID..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
        </div>

        {/* Teacher Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Employee ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Phone</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Email (Login)</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Subjects</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : filteredTeachers.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No teachers found</td></tr>
              ) : filteredTeachers.map((teacher) => (
                <tr key={teacher.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-mono text-slate-600">{teacher.employeeId}</td>
                  <td className="px-5 py-3 text-sm font-medium">
                    <Link href={`/teachers/${teacher.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                      {teacher.user.firstName} {teacher.user.lastName}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{teacher.user.phone || '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-500 font-mono text-xs">{teacher.user.email}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{teacher.subjects.map(s => s.name).join(', ') || '—'}</td>
                  <td className="px-5 py-3 text-sm text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setResetModal(teacher); setNewPassword(''); setResetDone(false); }}
                        className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg" title="Reset Password">
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(teacher.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setResetModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center"><KeyRound className="h-5 w-5 text-amber-600" /></div>
              <div>
                <h3 className="font-bold text-slate-900">Reset Password</h3>
                <p className="text-sm text-slate-500">{resetModal.user.firstName} {resetModal.user.lastName} ({resetModal.employeeId})</p>
              </div>
            </div>

            <div className="mb-3 text-xs text-slate-400">Login email: <span className="font-mono text-slate-600">{resetModal.user.email}</span></div>

            {!resetDone ? (
              <>
                <div className="relative mb-4">
                  <label className="block text-xs font-medium text-slate-500 mb-1">New Password</label>
                  <input type={showNewPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 chars)" className="w-full px-3 py-2.5 pr-10 border border-slate-300 rounded-lg text-sm text-slate-900" />
                  <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-8 text-slate-400">
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleResetPassword} disabled={resetting || !newPassword}
                    className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium text-sm">
                    {resetting ? 'Resetting...' : 'Reset Password'}
                  </button>
                  <button onClick={() => setResetModal(null)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm">Cancel</button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><Check className="h-5 w-5 text-green-600" /><span className="font-bold text-green-800">Password Reset!</span></div>
                  <div className="text-sm space-y-1">
                    <div><span className="text-slate-500">Email:</span> <span className="font-mono font-bold text-blue-700">{resetModal.user.email}</span></div>
                    <div><span className="text-slate-500">New Password:</span> <span className="font-mono font-bold text-red-600">{newPassword}</span></div>
                  </div>
                </div>
                <button onClick={() => {
                  navigator.clipboard.writeText(`Email: ${resetModal.user.email}\nPassword: ${newPassword}`);
                  alert('Copied!');
                }} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm">
                  <Copy className="h-4 w-4" /> Copy Credentials
                </button>
                <button onClick={() => setResetModal(null)} className="w-full px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
