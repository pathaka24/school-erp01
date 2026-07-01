import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger, getFeeLockMonth, isMonthLocked } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

function snapshot(e: any) {
  return {
    id: e.id, type: e.type, category: e.category, description: e.description,
    amount: e.amount, month: e.month, date: e.date,
    archivedAt: e.archivedAt, archivedBy: e.archivedBy,
  };
}

// POST /api/fees/ledger/entry/archive
// Body: { ids: string[] | id: string, action?: 'archive' | 'restore' | 'delete', actor?, reason? }
//   archive = set aside (excluded from balance/totals) without deleting
//   restore = bring an archived entry back
//   delete  = PERMANENTLY remove archived entries (ADMIN only, irreversible)
// Supports one or many entries; recomputes once per affected student.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
  const action = body.action === 'restore' ? 'restore' : body.action === 'delete' ? 'delete' : 'archive';
  const actor = body.actor || `${auth.userId}`;
  if (ids.length === 0) return Response.json({ error: 'ids is required' }, { status: 400 });

  if (action === 'delete' && auth.role !== 'ADMIN') {
    return Response.json({ error: 'Permanent delete requires an admin' }, { status: 403 });
  }

  const entries = await prisma.feeLedger.findMany({ where: { id: { in: ids } } });
  if (entries.length === 0) return Response.json({ error: 'No matching entries' }, { status: 404 });

  // Period lock guards archive/restore/delete too
  const lockMonth = await getFeeLockMonth();
  const locked = entries.find(e => isMonthLocked(e.month, lockMonth));
  if (locked) {
    return Response.json({ error: `Ledger is locked through ${lockMonth} — entries in locked months are read-only.` }, { status: 423 });
  }

  const now = new Date();

  // Batch every mutation + audit into a single ARRAY-form transaction. Per-row
  // interactive transactions (async tx => …) time out under the Supabase pooler
  // (connection_limit=1) → P2028 on bulk actions.
  if (action === 'delete') {
    // Only permanently delete rows that are currently archived — never active/voided ones
    const target = entries.filter(e => !!e.archivedAt && !e.voidedAt);
    if (target.length === 0) return Response.json({ action, count: 0, studentsAffected: 0 });
    const targetIds = target.map(e => e.id);
    const affected = new Set(target.map(e => e.studentId));
    const auditData = target.map(e => ({
      entryId: e.id, studentId: e.studentId, action: 'VOID',
      before: JSON.stringify(snapshot(e)), after: null,
      userId: auth.userId || null, userName: actor,
      reason: `HARD_DELETE (archived): ${body.reason || 'Permanently deleted archived entry'}`,
    }));
    await prisma.$transaction([
      prisma.feeLedgerAudit.createMany({ data: auditData }),
      prisma.feeLedger.deleteMany({ where: { id: { in: targetIds } } }),
    ]);
    for (const sid of affected) await recomputeStudentLedger(sid);
    return Response.json({ action, count: target.length, studentsAffected: affected.size });
  }

  // Archive only active rows; restore only currently-archived rows. Voided rows are left alone.
  const target = entries.filter(e => !e.voidedAt && (action === 'archive' ? !e.archivedAt : !!e.archivedAt));
  if (target.length === 0) return Response.json({ action, count: 0, studentsAffected: 0 });
  const targetIds = target.map(e => e.id);
  const affected = new Set(target.map(e => e.studentId));
  const setData = action === 'archive' ? { archivedAt: now, archivedBy: actor || null } : { archivedAt: null, archivedBy: null };
  const auditData = target.map(e => ({
    entryId: e.id, studentId: e.studentId,
    action: action === 'archive' ? 'ARCHIVE' : 'UNARCHIVE',
    before: JSON.stringify(snapshot(e)),
    after: JSON.stringify({ ...snapshot(e), ...setData }),
    userId: auth.userId || null, userName: actor,
    reason: action === 'archive' ? 'Archived — set aside from total' : 'Restored from archive',
  }));
  await prisma.$transaction([
    prisma.feeLedger.updateMany({ where: { id: { in: targetIds } }, data: setData }),
    prisma.feeLedgerAudit.createMany({ data: auditData }),
  ]);

  for (const sid of affected) await recomputeStudentLedger(sid);

  return Response.json({ action, count: target.length, studentsAffected: affected.size });
}
