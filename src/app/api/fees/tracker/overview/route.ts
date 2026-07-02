import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// GET /api/fees/tracker/overview?session=YYYY-YYYY
// Per-class collection summary for a session: students, billed, collected,
// outstanding and collection %. The school-wide top-down view.
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const session = request.nextUrl.searchParams.get('session');
  const now = new Date();
  const defStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  let start = defStart;
  if (session && /^\d{4}-\d{4}$/.test(session)) start = parseInt(session.split('-')[0], 10);
  const months: string[] = [];
  for (let m = 4; m <= 12; m++) months.push(`${start}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 3; m++) months.push(`${start + 1}-${String(m).padStart(2, '0')}`);

  const students = await prisma.student.findMany({
    where: { user: { isActive: true } },
    select: { id: true, classId: true, class: { select: { id: true, name: true, numericGrade: true } } },
  });
  const classOf = new Map(students.map(s => [s.id, s.class]));
  const ids = students.map(s => s.id);

  const charges = ids.length === 0 ? [] : await prisma.feeLedger.findMany({
    where: { studentId: { in: ids }, month: { in: months }, type: 'CHARGE', voidedAt: null, archivedAt: null },
    select: { studentId: true, amount: true, paidAmount: true },
  });

  const byClass = new Map<string, { id: string; name: string; grade: number; students: number; billed: number; collected: number }>();
  const ensure = (c: any) => {
    if (!c) return null;
    if (!byClass.has(c.id)) byClass.set(c.id, { id: c.id, name: c.name, grade: c.numericGrade ?? 999, students: 0, billed: 0, collected: 0 });
    return byClass.get(c.id)!;
  };
  // student counts per class
  for (const s of students) { const e = ensure(s.class); if (e) e.students++; }
  // billed/collected
  for (const c of charges) {
    const cls = classOf.get(c.studentId);
    const e = ensure(cls);
    if (!e) continue;
    e.billed += c.amount;
    e.collected += Math.min(c.paidAmount, c.amount);
  }

  const rows = Array.from(byClass.values())
    .map(c => ({
      classId: c.id, name: c.name, students: c.students,
      billed: c.billed, collected: c.collected, outstanding: Math.max(0, c.billed - c.collected),
      collectionRate: c.billed > 0 ? Math.round((c.collected / c.billed) * 100) : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const grand = {
    students: rows.reduce((a, r) => a + r.students, 0),
    billed: rows.reduce((a, r) => a + r.billed, 0),
    collected: rows.reduce((a, r) => a + r.collected, 0),
    outstanding: rows.reduce((a, r) => a + r.outstanding, 0),
  };

  return Response.json({ session: `${start}-${start + 1}`, rows, grand });
}
