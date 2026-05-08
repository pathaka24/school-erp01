'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { CreditCard, Printer, RefreshCw, Search } from 'lucide-react';
import { printIdCards } from '@/lib/idCardHtml';

type Mode = 'students' | 'teachers';

export default function IdMakerPage() {
  const [mode, setMode] = useState<Mode>('students');
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [perPage, setPerPage] = useState<4 | 6 | 8>(6);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [schoolLogo, setSchoolLogo] = useState<string>('');

  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data)).catch(() => {});
    api.get('/settings/general').then(r => setSchoolLogo(r.data?.schoolLogo || '')).catch(() => {});
  }, []);

  useEffect(() => {
    const type = mode === 'students' ? 'STUDENT_ID' : 'TEACHER_ID';
    api.get('/print-templates', { params: { type } }).then(r => {
      const list = r.data || [];
      setTemplates(list);
      const def = list.find((t: any) => t.isDefault) || list[0];
      setTemplateId(def?.id || '');
    }).catch(() => { setTemplates([]); setTemplateId(''); });
  }, [mode]);

  const activeTemplate = useMemo(
    () => templates.find((t: any) => t.id === templateId) || templates[0] || null,
    [templates, templateId],
  );

  const sections = useMemo(() => classes.find((c: any) => c.id === classId)?.sections || [], [classes, classId]);

  const loadRecords = async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      if (mode === 'students') {
        const params: any = {};
        if (classId) params.classId = classId;
        if (sectionId) params.sectionId = sectionId;
        const { data } = await api.get('/students', { params });
        const list = Array.isArray(data) ? data : (data.rows || []);
        setAllRecords(list);
      } else {
        const { data } = await api.get('/teachers');
        setAllRecords(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, classId, sectionId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allRecords;
    const q = search.trim().toLowerCase();
    return allRecords.filter((r: any) => {
      const name = `${r.user?.firstName || ''} ${r.user?.lastName || ''}`.toLowerCase();
      const code = (r.admissionNo || r.employeeId || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [allRecords, search]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r: any) => r.id)));
  };
  const toggle = (id: string) => {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handlePrint = async () => {
    const cardsToPrint = filtered.filter((r: any) => selected.has(r.id));
    if (cardsToPrint.length === 0) {
      alert('Select at least one record to print.');
      return;
    }
    setPrinting(true);
    try {
      await printIdCards(cardsToPrint, activeTemplate, mode === 'students', schoolLogo);
    } catch (err: any) {
      alert('Print failed: ' + (err?.message || 'unknown error'));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">ID Card Maker</h1>
                <p className="text-xs text-slate-500">Bulk print student or staff ID cards on A4 sheets.</p>
              </div>
            </div>
          </FadeIn>

          {/* Mode + filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <label className="text-xs text-slate-600">
              For
              <select value={mode} onChange={e => { setMode(e.target.value as Mode); setClassId(''); setSectionId(''); }}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="students">Students</option>
                <option value="teachers">Teachers / Staff</option>
              </select>
            </label>
            {mode === 'students' && (
              <>
                <label className="text-xs text-slate-600">
                  Class
                  <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                    <option value="">All classes</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Section
                  <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:bg-slate-100">
                    <option value="">All sections</option>
                    {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              </>
            )}
            <label className="text-xs text-slate-600">
              Template
              <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                {templates.length === 0 && <option value="">No templates — using defaults</option>}
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              <span className="invisible">Search</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name / ID"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </div>
            </label>
            <button onClick={loadRecords}
              className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 flex items-center justify-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {/* Selection list */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-slate-600">
                <strong>{selected.size}</strong> selected of {filtered.length} {mode}
                {activeTemplate && (
                  <span className="ml-3 text-slate-400">· Using template: <strong className="text-slate-700">{activeTemplate.name}</strong></span>
                )}
              </p>
              <div className="flex gap-2">
                <button onClick={toggleAll}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200">
                  {selected.size === filtered.length && filtered.length > 0 ? 'Deselect all' : 'Select all'}
                </button>
                <button onClick={handlePrint} disabled={selected.size === 0 || printing}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                  <Printer className="h-3.5 w-3.5" /> {printing ? 'Generating…' : `Print${selected.size > 0 ? ` (${selected.size})` : ''}`}
                </button>
              </div>
            </div>
            {loading ? (
              <p className="text-center py-8 text-slate-400 text-sm">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">No records.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {filtered.map((r: any) => (
                  <label key={r.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{r.user?.firstName} {r.user?.lastName}</div>
                      <div className="text-xs text-slate-500">
                        {mode === 'students'
                          ? `${r.admissionNo} · ${r.class?.name || ''}${r.section?.name ? ` · ${r.section.name}` : ''}`
                          : `${r.employeeId || ''} · ${r.designation || ''}`}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            Tip: cards print at standard credit-card size (54×85mm portrait or 85×54mm landscape). Cards flow into the A4 sheet automatically — no need to pick "cards per page" anymore.
            {activeTemplate?.config?.backEnabled && (
              <> Back side is enabled — every card prints front then back side-by-side.</>
            )}
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}

