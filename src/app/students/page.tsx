'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem, ScaleHover } from '@/components/ui/motion';
import { Search, Eye, Trash2, ArrowLeft, Users, UserPlus, GraduationCap, Upload } from 'lucide-react';

const CLASS_COLORS = [
  'from-blue-500 to-blue-600',
  'from-indigo-500 to-indigo-600',
  'from-purple-500 to-purple-600',
  'from-violet-500 to-violet-600',
  'from-fuchsia-500 to-fuchsia-600',
  'from-pink-500 to-pink-600',
  'from-rose-500 to-rose-600',
  'from-orange-500 to-orange-600',
  'from-amber-500 to-amber-600',
  'from-teal-500 to-teal-600',
];

export default function StudentsPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedSection, setSelectedSection] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);

  useEffect(() => {
    api.get('/classes').then(r => { setClasses(r.data); setLoading(false); });
  }, []);

  const loadStudents = async (classId: string, sectionId?: string) => {
    setStudentsLoading(true);
    try {
      const params: any = { classId };
      if (sectionId) params.sectionId = sectionId;
      const { data } = await api.get('/students', { params });
      setStudents(data);
    } catch { setStudents([]); }
    setStudentsLoading(false);
  };

  const selectClass = (cls: any) => {
    setSelectedClass(cls);
    setSelectedSection('');
    setSearch('');
    loadStudents(cls.id);
  };

  const selectSection = (sectionId: string) => {
    setSelectedSection(sectionId);
    if (selectedClass) loadStudents(selectedClass.id, sectionId || undefined);
  };

  const goBack = () => {
    setSelectedClass(null);
    setSelectedSection('');
    setStudents([]);
    setSearch('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student?')) return;
    try {
      await api.delete(`/students/${id}`);
      if (selectedClass) loadStudents(selectedClass.id, selectedSection || undefined);
    } catch { alert('Failed to delete'); }
  };

  const filteredStudents = search
    ? students.filter(s => `${s.user.firstName} ${s.user.lastName} ${s.admissionNo}`.toLowerCase().includes(search.toLowerCase()))
    : students;

  const totalStudents = classes.reduce((s: number, c: any) => s + (c._count?.students || 0), 0);

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">

          {/* ─── CLASS CARDS VIEW ─── */}
          {!selectedClass && (
            <>
              <FadeIn>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">Students</h1>
                    <p className="text-sm text-slate-500">{totalStudents} total students across {classes.length} classes</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push('/students/import')}>
                      <Upload className="h-4 w-4" /> Import from Excel/CSV
                    </Button>
                    <Button onClick={() => router.push('/admission')}>
                      <UserPlus className="h-4 w-4" /> New Admission
                    </Button>
                  </div>
                </div>
              </FadeIn>

              {loading ? (
                <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
              ) : (
                <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {classes.map((cls: any, i: number) => {
                    const studentCount = cls._count?.students || 0;
                    const sectionCount = cls.sections?.length || 0;
                    return (
                      <StaggerItem key={cls.id}>
                        <ScaleHover>
                          <button onClick={() => selectClass(cls)} className="w-full text-left">
                            <div className={`bg-gradient-to-br ${CLASS_COLORS[i % CLASS_COLORS.length]} rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow`}>
                              <div className="flex items-center justify-between mb-3">
                                <GraduationCap className="h-6 w-6 opacity-80" />
                                <Badge className="bg-white/20 text-white border-0 text-[10px]">
                                  {sectionCount} sec
                                </Badge>
                              </div>
                              <h3 className="text-lg font-bold">{cls.name}</h3>
                              <div className="flex items-center gap-1.5 mt-2">
                                <Users className="h-4 w-4 opacity-70" />
                                <span className="text-2xl font-black">{studentCount}</span>
                                <span className="text-sm opacity-70">students</span>
                              </div>
                              {cls.sections?.length > 0 && (
                                <div className="flex gap-1.5 mt-3">
                                  {cls.sections.map((sec: any) => (
                                    <span key={sec.id} className="px-2 py-0.5 bg-white/20 rounded text-[11px] font-medium">
                                      {sec.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        </ScaleHover>
                      </StaggerItem>
                    );
                  })}
                </StaggerContainer>
              )}
            </>
          )}

          {/* ─── STUDENT LIST VIEW (after class selected) ─── */}
          {selectedClass && (
            <>
              <FadeIn>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={goBack} className="p-2 hover:bg-slate-100 rounded-xl transition">
                      <ArrowLeft className="h-5 w-5 text-slate-600" />
                    </button>
                    <div>
                      <h1 className="text-2xl font-bold text-slate-900">{selectedClass.name}</h1>
                      <p className="text-sm text-slate-500">{students.length} students</p>
                    </div>
                  </div>
                  <Button onClick={() => router.push('/admission')}>
                    <UserPlus className="h-4 w-4" /> New Admission
                  </Button>
                </div>
              </FadeIn>

              {/* Section tabs + search */}
              <FadeIn delay={0.1}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                    <button onClick={() => selectSection('')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${!selectedSection ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      All
                    </button>
                    {selectedClass.sections?.map((sec: any) => (
                      <button key={sec.id} onClick={() => selectSection(sec.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedSection === sec.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Section {sec.name}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input placeholder="Search by name or admission no..." value={search} onChange={e => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </FadeIn>

              {/* Student cards */}
              <FadeIn delay={0.15}>
                {studentsLoading ? (
                  <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
                ) : filteredStudents.length === 0 ? (
                  <Card className="p-12 text-center text-slate-400">No students found</Card>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">#</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Adm. No</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Section</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Phone</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map((student: any, idx: number) => (
                          <tr key={student.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => router.push(`/students/${student.id}`)}>
                            <td className="px-5 py-3 text-sm text-slate-400">{idx + 1}</td>
                            <td className="px-5 py-3">
                              <span className="text-sm font-mono text-blue-600">{student.admissionNo}</span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                {student.photo ? (
                                  <img src={student.photo} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                    {student.user.firstName[0]}{student.user.lastName[0]}
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{student.user.firstName} {student.user.lastName}</p>
                                  <p className="text-xs text-slate-400">{student.user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <Badge variant="secondary">{student.section?.name}</Badge>
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-500">{student.user.phone || '—'}</td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                                <button onClick={() => router.push(`/students/${student.id}`)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition">
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDelete(student.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </FadeIn>
            </>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
