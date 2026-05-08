'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { FileText, Printer, RefreshCw, Search } from 'lucide-react';
import { getAcademicYears, getCurrentAcademicYear } from '@/lib/utils';

// Render a single report-card HTML body (no <html><head>) for one student.
// This mirrors the single-student template at /report-card/page.tsx so that
// the printed output is identical row-by-row.
function reportCardHtml(r: any): string {
  const s = r.student;
  const subjectRows = (r.subjects || []).map((sub: any) => `
    <tr>
      <td style="padding:5px 8px;font-weight:500">${sub.name}</td>
      <td style="text-align:center;padding:5px 4px">${sub.ft1 ?? ''}</td>
      <td style="text-align:center;padding:5px 4px;font-weight:600">${sub.sa1 ?? ''}</td>
      <td style="text-align:center;padding:5px 4px;font-weight:700;background:#f0f9ff">${sub.term1 ?? ''}</td>
      <td style="text-align:center;padding:5px 4px">${sub.ft2 ?? ''}</td>
      <td style="text-align:center;padding:5px 4px;font-weight:600">${sub.sa2 ?? ''}</td>
      <td style="text-align:center;padding:5px 4px;font-weight:700;background:#f0fdf4">${sub.term2 ?? ''}</td>
      <td style="text-align:center;padding:5px 4px;font-weight:800;font-size:14px">${sub.total ?? ''}</td>
      <td style="text-align:center;padding:5px 4px;font-weight:700">${sub.grade ?? ''}</td>
    </tr>`).join('');

  return `
  <div class="card-page">
    <div class="header">
      <div class="school-name">PATHAK EDUCATIONAL FOUNDATION SCHOOL</div>
      <div class="school-addr">Salarpur, Sector - 101</div>
      <div class="school-addr">Mobile - Contact no - 6397339902</div>
      <div class="school-addr">Reg: NCER/90001255</div>
    </div>

    <div class="title">REPORT CARD FOR ACADEMIC SESSION (${r.academicYear})</div>

    <div class="info-grid">
      <div>NAME : <span>${s.name}</span></div>
      <div>CLASS : <span>${s.class}</span></div>
      <div>MOTHER'S NAME : <span>${s.motherName || '—'}</span></div>
      <div>D.O.B : <span>${s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : '—'}</span></div>
      <div>FATHER'S NAME : <span>${s.fatherName || '—'}</span></div>
      <div>Adm. No : <span>${s.admissionNo || ''}</span></div>
      <div style="grid-column:span 2">ADDRESS : <span>${s.address || '—'}</span></div>
    </div>

    <div class="section-head">SCHOLASTIC AREAS</div>
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="width:18%">Subject</th>
          <th colspan="3" style="background:#bbdefb">Term - 1</th>
          <th colspan="3" style="background:#c8e6c9">Term - 2</th>
          <th colspan="2">Annual Result</th>
        </tr>
        <tr>
          <th style="background:#bbdefb">FT-1<br><span style="font-size:9px">Marks(20)</span></th>
          <th style="background:#bbdefb">SA-1<br><span style="font-size:9px">Marks(80)</span></th>
          <th style="background:#bbdefb">Term-1<br><span style="font-size:9px">Marks(100)</span></th>
          <th style="background:#c8e6c9">FT-2<br><span style="font-size:9px">Marks(20)</span></th>
          <th style="background:#c8e6c9">SA-2<br><span style="font-size:9px">Marks(80)</span></th>
          <th style="background:#c8e6c9">Term-2<br><span style="font-size:9px">Marks(100)</span></th>
          <th>TOTAL<br><span style="font-size:9px">MARKS</span></th>
          <th>GRADE</th>
        </tr>
      </thead>
      <tbody>
        ${subjectRows}
        <tr class="total-row">
          <td style="padding:5px 8px;font-weight:bold">Total</td>
          <td style="text-align:center;padding:5px 4px"></td>
          <td style="text-align:center;padding:5px 4px"></td>
          <td style="text-align:center;padding:5px 4px;font-weight:bold">${r.totals?.term1?.marks ?? ''}</td>
          <td style="text-align:center;padding:5px 4px"></td>
          <td style="text-align:center;padding:5px 4px"></td>
          <td style="text-align:center;padding:5px 4px;font-weight:bold">${r.totals?.term2?.marks ?? ''}</td>
          <td style="text-align:center;padding:5px 4px;font-weight:bold;font-size:14px">${r.totals?.annual?.marks ?? ''}</td>
          <td style="text-align:center;padding:5px 4px"></td>
        </tr>
        <tr class="total-row">
          <td style="padding:5px 8px">Percentage</td>
          <td colspan="2"></td>
          <td style="text-align:center;padding:5px 4px">${r.totals?.term1?.pct ?? ''}%</td>
          <td colspan="2"></td>
          <td style="text-align:center;padding:5px 4px">${r.totals?.term2?.pct ?? ''}%</td>
          <td colspan="2" style="text-align:center;padding:5px 4px;font-weight:bold;font-size:14px">${r.totals?.annual?.pct ?? ''}%</td>
        </tr>
      </tbody>
    </table>

    <div class="section-head">DISCIPLINE (on a 5-point (A-E) grading scale)</div>
    <table style="width:50%;margin:0 auto 8px">
      <thead><tr><th style="width:60%">Subject</th><th>Grade</th></tr></thead>
      <tbody>
        <tr><td style="padding:4px 8px">Discipline</td><td style="text-align:center;padding:4px 8px;font-weight:bold">—</td></tr>
      </tbody>
    </table>

    <div style="margin:8px 0;font-size:12px"><strong>CLASS TEACHER'S REMARKS :</strong> ........................................................................</div>
    <div style="margin:6px 0;font-size:12px">Congratulations and best of luck for the next session.</div>

    <div class="result-box">
      <strong>RESULT :</strong> ${r.summary?.result === 'Promoted' ? `Promoted to class <u><strong>${r.summary.promotedTo || '__'}</strong></u>` : '<span style="color:red">Detained</span>'}
    </div>

    <div style="display:flex;justify-content:space-between;font-size:11px;margin:8px 0">
      <div>Issue date: ${r.dates?.issueDate || ''}</div>
      <div>School Reopen on: ${r.dates?.schoolReopen || ''}</div>
    </div>

    <div class="sig-row">
      <div class="sig-line">CLASS TEACHER</div>
      <div class="sig-line">PRINCIPAL</div>
      <div class="sig-line">PARENT</div>
    </div>
  </div>`;
}

export default function ReportCardMakerPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [academicYear, setAcademicYear] = useState(() => getCurrentAcademicYear());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: [] as string[] });

  useEffect(() => { api.get('/classes').then(r => setClasses(r.data)).catch(() => {}); }, []);

  const sections = useMemo(() => classes.find((c: any) => c.id === classId)?.sections || [], [classes, classId]);

  useEffect(() => {
    if (!classId) { setStudents([]); return; }
    setLoading(true);
    setSelected(new Set());
    const params: any = { classId };
    if (sectionId) params.sectionId = sectionId;
    api.get('/students', { params })
      .then(r => setStudents(Array.isArray(r.data) ? r.data : (r.data.rows || [])))
      .finally(() => setLoading(false));
  }, [classId, sectionId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter((s: any) =>
      `${s.user?.firstName || ''} ${s.user?.lastName || ''} ${s.admissionNo || ''}`.toLowerCase().includes(q),
    );
  }, [students, search]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s: any) => s.id)));
  };
  const toggle = (id: string) => {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // Fetch all selected students' report cards then open one print window
  // containing all of them, with page breaks between cards.
  const handlePrint = async () => {
    if (selected.size === 0) {
      alert('Select at least one student.');
      return;
    }
    setPrinting(true);
    setProgress({ done: 0, total: selected.size, failed: [] });

    const ids = Array.from(selected);
    const reports: any[] = [];
    const failed: string[] = [];
    for (const id of ids) {
      try {
        const { data } = await api.get(`/report-card/${id}`, { params: { academicYear } });
        reports.push(data);
      } catch {
        const stu = students.find((s: any) => s.id === id);
        failed.push(stu ? `${stu.user?.firstName} ${stu.user?.lastName}` : id);
      } finally {
        setProgress(p => ({ ...p, done: p.done + 1 }));
      }
    }
    setProgress(p => ({ ...p, failed }));

    if (reports.length === 0) {
      alert('Failed to load any report cards. Check console for errors.');
      setPrinting(false);
      return;
    }

    const cardsHtml = reports.map(r => reportCardHtml(r)).join('\n<div class="page-break"></div>\n');
    const html = `<!DOCTYPE html><html><head><title>Report Cards — ${academicYear}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Times New Roman', serif; margin:20px; color:#1a1a1a; font-size:13px; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #333; }
  .header { text-align:center; margin-bottom:12px; }
  .school-name { font-size:20px; font-weight:bold; color:#006400; }
  .school-addr { font-size:11px; color:#444; }
  .title { background:#006400; color:white; text-align:center; padding:6px; font-size:14px; font-weight:bold; letter-spacing:1px; margin:8px 0; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:2px 24px; margin:8px 0; font-size:12px; }
  .info-grid span { font-weight:bold; }
  .section-head { background:#006400; color:white; text-align:center; padding:4px; font-size:12px; font-weight:bold; letter-spacing:2px; margin:10px 0 4px; }
  th { background:#e8f5e9; padding:5px 4px; font-size:11px; text-align:center; font-weight:600; }
  .total-row { background:#fffde7; font-weight:bold; }
  .result-box { border:2px solid #006400; padding:8px 16px; margin:10px 0; font-size:13px; }
  .sig-row { display:flex; justify-content:space-between; margin-top:50px; }
  .sig-line { border-top:1px solid #000; width:160px; text-align:center; padding-top:4px; font-size:11px; }
  .card-page { page-break-after: always; }
  .card-page:last-child { page-break-after: auto; }
  .page-break { page-break-after: always; }
  @media print { body { margin:10px; } @page { size: A4; margin: 8mm; } }
</style></head><body>
${cardsHtml}
</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      // Give the new window a beat to render, then print
      setTimeout(() => w.print(), 300);
    } else {
      alert('Pop-up blocked. Allow pop-ups for this site to print.');
    }
    setPrinting(false);
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-4">
          <FadeIn>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-green-700" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Report Card Maker</h1>
                <p className="text-xs text-slate-500">Generate report cards for an entire class in one go.</p>
              </div>
            </div>
          </FadeIn>

          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <label className="text-xs text-slate-600">
              Class
              <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">Select class</option>
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
            <label className="text-xs text-slate-600">
              Academic Year
              <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                {getAcademicYears().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Search
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Name / admission no"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </div>
            </label>
            <button onClick={() => { if (classId) { setClassId(classId); /* trigger reload via sectionId state */ } }}
              className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 flex items-center justify-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {/* Selection */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-slate-600">
                <strong>{selected.size}</strong> selected of {filtered.length} students
              </p>
              <div className="flex gap-2">
                <button onClick={toggleAll}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200">
                  {selected.size === filtered.length && filtered.length > 0 ? 'Deselect all' : 'Select all'}
                </button>
                <button onClick={handlePrint} disabled={selected.size === 0 || printing}
                  className="px-4 py-1.5 bg-green-700 text-white rounded text-xs hover:bg-green-800 disabled:opacity-50 flex items-center gap-1">
                  <Printer className="h-3.5 w-3.5" />
                  {printing ? `Generating ${progress.done}/${progress.total}…` : `Print ${selected.size > 0 ? `(${selected.size})` : ''}`}
                </button>
              </div>
            </div>

            {progress.failed.length > 0 && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
                Couldn&apos;t load report card for: {progress.failed.join(', ')}
              </div>
            )}

            {loading ? (
              <p className="text-center py-8 text-slate-400 text-sm">Loading students…</p>
            ) : !classId ? (
              <p className="text-center py-8 text-slate-400 text-sm">Pick a class to begin.</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">No students.</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                {filtered.map((s: any) => (
                  <label key={s.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">
                        {s.user?.firstName} {s.user?.lastName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {s.admissionNo} · {s.class?.name}{s.section?.name ? ` · ${s.section.name}` : ''}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Tip */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            Tip: each report card prints on its own A4 page with page-breaks between students. The browser&apos;s print dialog opens once for all selected students together.
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
