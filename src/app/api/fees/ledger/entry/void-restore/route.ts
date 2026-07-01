import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger, getFeeLockMonth, isMonthLocked } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

function snapshot(e: any) {
  return {
    id: e.id, type: e.type, category: e.category, description: e.description,
    amount: e.amount, month: e.month, date: e.date,
    voidedAt: e.voidedAt, voidedBy: e.voidedBy, voidReason: e.voidReason,
  };
}

// POST /api/fees/ledger/entry/void-restore
// Body: { ids: string[] | id: string, action?: 'restore' | 'delete', actor?, reason? }
//   restore = un-void (bring the entry back into the active ledger)
//   delete  = PERMANENTLY remove voided entries (ADMIN only, irreversible)
// Bulk-capable; recomputes once per affected student.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
  const action = body.action === 'delete' ? 'delete' : 'restore';
  const actor = body.actor || `${auth.userId}`;
  if (ids.length === 0) return Response.json({ error: 'ids is required' }, { status: 400 });

  if (action === 'delete' && auth.role !== 'ADMIN') {
    return Response.json({ error: 'Permanent delete requires an admin' }, { status: 403 });
  }

  const entries = await prisma.feeLedger.findMany({ where: { id: { in: ids } } });
  if (entries.length === 0) return Response.json({ error: 'No matching entries' }, { status: 404 });

  const lockMonth = await getFeeLockMonth();
  const locked = entries.find(e => isMonthLocked(e.month, lockMonth));
  if (locked) {
    return Response.json({ error: `Ledger is locked through ${lockMonth} — entries in locked months are read-only.` }, { status: 423 });
  }

  // Only act on entries that are actually voided
  const target = entries.filter(e => !!e.voidedAt);
  if (target.length === 0) return Response.json({ action, count: 0, studentsAffected: 0 });

  const targetIds = target.map(e => e.id);
  const affected = new Set(target.map(e => e.studentId));

  // Batch update/delete + audit in a single ARRAY-form transaction. The
  // interactive form (async tx => …) was opening one transaction per row, which
  // times out under the Supabase pooler (connection_limit=1) → P2028.
  if (action === 'delete') {
    const auditData = target.map(e => ({
      entryId: e.id, studentId: e.studentId, action: 'VOID',
      before: JSON.stringify(snapshot(e)), after: null,
      userId: auth.userId || null, userName: actor,
      reason: `HARD_DELETE (voided): ${body.reason || 'Permanently deleted voided entry'}`,
    }));
    await prisma.$transaction([
      prisma.feeLedgerAudit.createMany({ data: auditData }),
      prisma.feeLedger.deleteMany({ where: { id: { in: targetIds } } }),
    ]);
  } else {
    const auditData = target.map(e => ({
      entryId: e.id, studentId: e.studentId, action: 'RESTORE',
      before: JSON.stringify(snapshot(e)),
      after: JSON.stringify({ ...snapshot(e), voidedAt: null, voidedBy: null, voidReason: null }),
      userId: auth.userId || null, userName: actor,
      reason: 'Restored from voided (bulk)',
    }));
    await prisma.$transaction([
      prisma.feeLedger.updateMany({ where: { id: { in: targetIds } }, data: { voidedAt: null, voidedBy: null, voidReason: null } }),
      prisma.feeLedgerAudit.createMany({ data: auditData }),
    ]);
  }

  for (const sid of affected) await recomputeStudentLedger(sid);

  return Response.json({ action, count: target.length, studentsAffected: affected.size });
}
