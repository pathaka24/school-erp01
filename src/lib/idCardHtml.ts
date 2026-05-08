// Shared ID card rendering — used by both the bulk ID maker (/id-maker)
// and the per-student / per-teacher "Print ID Card" buttons on profile pages.
// Output is plain HTML (with inline CSS) suitable for a fresh window.print().

import QRCodeLib from 'qrcode';
import { getCurrentAcademicYear } from '@/lib/utils';

export const DEFAULT_ID_TEMPLATE = {
  primaryColor: '#006400',
  textColor: '#ffffff',
  headerLine1: 'PATHAK EDUCATIONAL FOUNDATION SCHOOL',
  headerLine2: 'Salarpur, Sector - 101',
  headerLine3: '',
  cardLabel: 'ID Card',
  fields: ['name', 'class', 'admissionNo', 'fatherName'],
  showQR: true,
  showPhoto: true,
  showSession: true,
  footer: 'Scan for attendance',
  orientation: 'portrait',
  layout: 'photo-left',
  backEnabled: false,
  backText: '',
  backShowContactInfo: true,
  logoUrl: '',
};

export const FIELD_LABELS: Record<string, string> = {
  name: 'Name', class: 'Class', section: 'Section', admissionNo: 'Adm. No',
  rollNumber: 'Roll No', fatherName: 'Father', motherName: 'Mother',
  guardianName: 'Guardian', phone: 'Phone', address: 'Address',
  bloodGroup: 'Blood Grp', dob: 'D.O.B',
  designation: 'Designation', employeeId: 'Emp. ID', subjects: 'Subjects',
  qualification: 'Qualification',
};

export function getFieldValue(record: any, key: string, isStudent: boolean): string {
  switch (key) {
    case 'name': return `${record.user?.firstName || ''} ${record.user?.lastName || ''}`.trim();
    case 'class': return isStudent ? (record.class?.name || '') : '';
    case 'section': return isStudent ? (record.section?.name || '') : '';
    case 'admissionNo': return record.admissionNo || '';
    case 'rollNumber': return record.rollNumber || '';
    case 'fatherName': return record.fatherName || '';
    case 'motherName': return record.motherName || '';
    case 'guardianName': return record.guardianName || '';
    case 'phone': return record.user?.phone || record.phone || '';
    case 'address': return record.currentAddress || record.address || '';
    case 'bloodGroup': return record.bloodGroup || '';
    case 'dob': return record.dateOfBirth ? new Date(record.dateOfBirth).toLocaleDateString('en-IN') : '';
    case 'designation': return record.designation || 'Teacher';
    case 'employeeId': return record.employeeId || '';
    case 'subjects': return (record.subjects || []).map((s: any) => s.name).join(', ');
    case 'qualification': return record.qualification || '';
    default: return '';
  }
}

export function escHtml(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Generate one card (front or back) as HTML string. Caller supplies QR SVG.
// `cfg.logoUrl` overrides; otherwise the school's default logo is used.
export function renderCardHtml(
  record: any,
  cfg: any,
  isStudent: boolean,
  qrSvg: string | undefined,
  side: 'front' | 'back',
): string {
  // Resolve logo: per-template override wins, else the schoolLogo on cfg
  const effectiveLogo = cfg.logoUrl || cfg.schoolLogo || '';
  const themeColor = cfg.primaryColor || '#006400';
  const textColor = cfg.textColor || '#ffffff';
  const layout = cfg.layout || 'photo-left';
  const cssVars = `--theme:${themeColor};--themeText:${textColor}`;

  if (side === 'back') {
    const backText = (cfg.backText || '');
    const contact = cfg.backShowContactInfo
      ? `<div class="contact">${escHtml(cfg.headerLine1)}${cfg.headerLine2 ? ' · ' + escHtml(cfg.headerLine2) : ''}${cfg.headerLine3 ? ' · ' + escHtml(cfg.headerLine3) : ''}</div>`
      : '';
    return `<div class="card back" style="${cssVars}">
      <div class="header"><div class="h1">— BACK —</div></div>
      <div class="body-back">
        <div class="text">${escHtml(backText).replace(/\n/g, '<br/>')}</div>
        ${contact}
        <div class="sig-row"><div class="sig">Holder Sign</div><div class="sig">Principal</div></div>
      </div>
    </div>`;
  }

  const initials =
    ((record.user?.firstName || '')[0] || '') +
    ((record.user?.lastName || '')[0] || '');

  const photoHtml = cfg.showPhoto
    ? (record.photo
      ? `<div class="photo"><img src="${escHtml(record.photo)}" alt="" /></div>`
      : `<div class="photo">${escHtml(initials)}</div>`)
    : '';

  const fields: string[] = cfg.fields || DEFAULT_ID_TEMPLATE.fields;
  const fieldsHtml = fields.map(k => {
    const val = getFieldValue(record, k, isStudent);
    if (!val) return '';
    const cls = k === 'name' ? 'val name' : (k === 'admissionNo' || k === 'employeeId') ? 'val code' : 'val';
    return `<div><div class="lbl">${escHtml(FIELD_LABELS[k] || k)}</div><div class="${cls}">${escHtml(val)}</div></div>`;
  }).join('');

  const qrHtml = cfg.showQR && qrSvg ? `<div class="qr">${qrSvg}</div>` : '';

  let bodyHtml: string;
  if (layout === 'photo-top') {
    bodyHtml = `<div class="body layout-photo-top">
      <div class="photo-row">${photoHtml}</div>
      <div class="below"><div class="fields">${fieldsHtml}</div>${qrHtml}</div>
    </div>`;
  } else if (layout === 'photo-right') {
    bodyHtml = `<div class="body">${qrHtml}<div class="fields">${fieldsHtml}</div>${photoHtml}</div>`;
  } else if (layout === 'compact') {
    const compactPhoto = cfg.showPhoto
      ? `<div class="photo photo-small">${record.photo ? `<img src="${escHtml(record.photo)}" alt="" />` : escHtml(initials)}</div>`
      : '';
    bodyHtml = `<div class="body">${compactPhoto}<div class="fields">${fieldsHtml}</div>${qrHtml}</div>`;
  } else {
    bodyHtml = `<div class="body">${photoHtml}<div class="fields">${fieldsHtml}</div>${qrHtml}</div>`;
  }

  const headerLogo = effectiveLogo ? `<img src="${escHtml(effectiveLogo)}" alt="" />` : '';
  const session = cfg.showSession ? `Session ${getCurrentAcademicYear()}` : '';
  const footerText = [session, cfg.footer].filter(Boolean).join(' · ');

  return `<div class="card" style="${cssVars}">
    <div class="header">
      ${headerLogo}
      <div class="h1">${escHtml(cfg.headerLine1)}</div>
      ${cfg.headerLine2 ? `<div class="h2">${escHtml(cfg.headerLine2)}</div>` : ''}
      ${cfg.headerLine3 ? `<div class="h3">${escHtml(cfg.headerLine3)}</div>` : ''}
      <div class="label">${escHtml(cfg.cardLabel || (isStudent ? 'Student ID Card' : 'Staff ID Card'))}</div>
    </div>
    ${bodyHtml}
    <div class="footer">${escHtml(footerText)}</div>
  </div>`;
}

// Shared CSS for any rendered card. Embed once per print window or preview.
export function idCardCss(orientation: 'portrait' | 'landscape', gap: string = '4mm'): string {
  const isLandscape = orientation === 'landscape';
  const cardW = isLandscape ? '85mm' : '54mm';
  const cardH = isLandscape ? '54mm' : '85mm';
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;background:white;padding:8mm}
.grid{display:flex;flex-wrap:wrap;gap:${gap};align-content:flex-start}
.card{
  width:${cardW};height:${cardH};
  border:2px solid var(--theme,#006400);
  border-radius:6px;overflow:hidden;
  display:flex;flex-direction:column;background:white;
  page-break-inside:avoid;break-inside:avoid;
}
.header{
  background:var(--theme,#006400);color:var(--themeText,#fff);
  padding:4px 4px 5px;text-align:center;
}
.header img{height:18px;margin:0 auto 2px;display:block;object-fit:contain}
.header .h1{font-size:8.5px;font-weight:bold;letter-spacing:0.5px;line-height:1.1}
.header .h2,.header .h3{font-size:6.5px;opacity:0.85;line-height:1.15}
.header .label{font-size:6.5px;opacity:0.95;margin-top:2px}
.body{flex:1;padding:5px;display:flex;gap:5px;overflow:hidden}
.body.layout-photo-top{flex-direction:column;align-items:stretch}
.body.layout-photo-top .photo-row{display:flex;justify-content:center}
.body.layout-photo-top .below{display:flex;gap:5px;flex:1}
.photo{
  width:18mm;height:22mm;flex-shrink:0;
  border:1px solid #cbd5e1;border-radius:3px;
  background:linear-gradient(135deg,var(--theme,#006400),#6b21a8);
  color:white;font-weight:bold;font-size:14px;
  display:flex;align-items:center;justify-content:center;overflow:hidden;
}
.photo img{width:100%;height:100%;object-fit:cover}
.photo-small{width:14mm;height:18mm;font-size:11px}
.fields{flex:1;font-size:7px;line-height:1.25;overflow:hidden;display:flex;flex-direction:column;gap:1.5px}
.fields .lbl{color:#94a3b8;font-size:6px;text-transform:uppercase;letter-spacing:0.2px}
.fields .val{font-weight:bold;color:#0f172a;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fields .val.name{font-size:9px}
.fields .val.code{color:var(--theme,#006400)}
.qr{
  width:16mm;height:16mm;flex-shrink:0;align-self:center;
  background:white;border:1px solid #cbd5e1;border-radius:3px;padding:1mm;
}
.qr svg{width:100%;height:100%}
.footer{
  background:#f1f5f9;color:#64748b;font-size:6px;
  text-align:center;padding:2px;line-height:1.2;
}
.card.back .header{padding:3px 4px}
.card.back .header .h1{font-size:7px}
.body-back{flex:1;padding:4mm;display:flex;flex-direction:column;font-size:7px;color:#475569;line-height:1.4;gap:2mm}
.body-back .text{flex:1}
.body-back .contact{font-size:6px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:1.5mm}
.body-back .sig-row{display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:2mm}
.body-back .sig{font-size:6px;color:#64748b;text-align:center;border-top:1px solid #475569;width:18mm;padding-top:0.5mm}
@page{size:A4;margin:8mm}
@media print{body{padding:0;margin:0}}
`;
}

// Pre-generate QR SVGs for a list of records.
export async function buildQrSvgs(
  records: { id: string }[],
  isStudent: boolean,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const r of records) {
    const value = isStudent ? `STU:${r.id}` : `TCH:${r.id}`;
    out[r.id] = await QRCodeLib.toString(value, { type: 'svg', width: 80, margin: 0 });
  }
  return out;
}

// Build a complete HTML document for printing one or many cards.
// `schoolLogo` is the school-wide default logo; used when a template doesn't
// have its own logoUrl override.
export async function buildIdCardSheetHtml(
  records: any[],
  template: any,
  isStudent: boolean,
  schoolLogo?: string,
): Promise<string> {
  const cfg = { ...DEFAULT_ID_TEMPLATE, ...(template?.config || {}), schoolLogo };
  const qrSvgs = cfg.showQR ? await buildQrSvgs(records, isStudent) : {};

  const cardsHtml = records.map(r => {
    const front = renderCardHtml(r, cfg, isStudent, qrSvgs[r.id], 'front');
    if (!cfg.backEnabled) return front;
    const back = renderCardHtml(r, cfg, isStudent, qrSvgs[r.id], 'back');
    return front + back;
  }).join('');

  const title = records.length === 1
    ? `ID Card — ${records[0].user?.firstName || ''} ${records[0].user?.lastName || ''}`.trim()
    : `ID Cards — ${records.length} ${isStudent ? 'students' : 'staff'}`;

  return `<!DOCTYPE html><html><head>
<title>${escHtml(title)}</title>
<style>${idCardCss(cfg.orientation as 'portrait' | 'landscape')}</style>
</head><body>
  <div class="grid">${cardsHtml}</div>
</body></html>`;
}

// Open the print window with the given records + template.
// Used by both the bulk maker and per-record print buttons.
export async function printIdCards(records: any[], template: any, isStudent: boolean, schoolLogo?: string) {
  const html = await buildIdCardSheetHtml(records, template, isStudent, schoolLogo);
  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up blocked. Please allow pop-ups for this site to print.');
    return;
  }
  w.document.write(html);
  w.document.close();
  // Wait for images (logos, photos) to load before printing
  setTimeout(() => { try { w.print(); } catch {} }, 500);
}
