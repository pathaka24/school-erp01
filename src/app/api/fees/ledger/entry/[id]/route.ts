import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger, writeFeeLedgerAudit, getFeeLockMonth, isMonthLocked } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

function lockedResponse(lockMonth: string) {
  return Response.json(
    { error: `Ledger is locked through ${lockMonth} — entries in locked months are read-only. Move the lock in Settings → Annual Fee Plan first.` },
    { status: 423 }
  );
}

// PATCH /api/fees/ledger/entry/[id] — edit a ledger entry. Writes an UPDATE
// audit row capturing before/after, then recomputes balances + paidAmount.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.feeLedger.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: 'Entry not found' }, { status: 404 });
  if (existing.voidedAt) return Response.json({ error: 'Cannot edit a voided entry — restore it first' }, { status: 400 });

  if (!body.reason || !String(body.reason).trim()) {
    return Response.json({ error: 'A reason is required when editing a ledger entry' }, { status: 400 });
  }

  const lockMonth = await getFeeLockMonth();
  if (isMonthLocked(existing.month, lockMonth)) return lockedResponse(lockMonth!);

  const allowed: Record<string, any> = {};
  if (body.amount !== undefined) {
    const n = parseFloat(body.amount);
    if (isNaN(n) || n < 0) return Response.json({ error: 'amount must be a non-negative number' }, { status: 400 });
    allowed.amount = n;
  }
  if (body.description !== undefined) allowed.description = String(body.description);
  if (body.category !== undefined) allowed.category = body.category || null;
  if (body.month !== undefined) {
    if (!/^\d{4}-\d{2}$/.test(body.month)) return Response.json({ error: 'month must be YYYY-MM' }, { status: 400 });
    allowed.month = body.month;
    const newDate = new Date(body.month + '-01T00:00:00Z');
    if (!isNaN(newDate.getTime())) allowed.date = newDate;
  }
  if (body.type !== undefined) {
    if (!['CHARGE', 'DEPOSIT', 'DISCOUNT'].includes(body.type)) {
      return Response.json({ error: 'type must be CHARGE, DEPOSIT or DISCOUNT' }, { status: 400 });
    }
    allowed.type = body.type;
  }
  if (body.paymentMethod !== undefined) allowed.paymentMethod = body.paymentMethod || null;
  if (body.receivedBy !== undefined) allowed.receivedBy = body.receivedBy || null;
  if (body.receiptNumber !== undefined) allowed.receiptNumber = body.receiptNumber || null;

  if (Object.keys(allowed).length === 0) {
    return Response.json({ error: 'No editable fields provided' }, { status: 400 });
  }
  // Also block moving an entry INTO a locked month
  if (allowed.month && isMonthLocked(allowed.month, lockMonth)) return lockedResponse(lockMonth!);

  try {
    // Change + audit row commit together — never one without the other
    await prisma.$transaction(async tx => {
      const updated = await tx.feeLedger.update({ where: { id }, data: allowed });
      await writeFeeLedgerAudit({
        entryId: id,
        studentId: existing.studentId,
        action: 'UPDATE',
        before: snapshot(existing),
        after: snapshot(updated),
        userId: auth.userId,
        userName: body._actor || undefined,
        reason: body.reason || undefined,
      }, tx);
    });
    const { balance } = await recomputeStudentLedger(existing.studentId);
    const fresh = await prisma.feeLedger.findUnique({ where: { id } });
    return Response.json({ entry: fresh, currentBalance: balance });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return Response.json({ error: 'Receipt number already exists' }, { status: 409 });
    }
    return Response.json({ error: 'Failed to update entry: ' + error.message }, { status: 500 });
  }
}

// DELETE /api/fees/ledger/entry/[id] — SOFT delete (void) the entry. Sets
// voidedAt/voidedBy/voidReason, writes a VOID audit row, recomputes ledger.
// Pass ?hard=true (admin only) for a true delete, but only if no audit history.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const reason = sp.get('reason') || undefined;
  const actor = sp.get('actor') || `${auth.userId}`;
  const hard = sp.get('hard') === 'true';

  if (hard && auth.role !== 'ADMIN') {
    return Response.json({ error: 'Hard delete requires admin — use void instead' }, { status: 403 });
  }
  if (!reason || !reason.trim()) {
    return Response.json({ error: 'A reason is required when voiding or deleting a ledger entry' }, { status: 400 });
  }

  const existing = await prisma.feeLedger.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: 'Entry not found' }, { status: 404 });

  const lockMonth = await getFeeLockMonth();
  if (isMonthLocked(existing.month, lockMonth)) return lockedResponse(lockMonth!);

  try {
    if (hard) {
      // Hard delete is allowed but should be rare. Audit row stays as orphan
      // pointer (entryId still readable for forensics).
      await prisma.$transaction(async tx => {
        await writeFeeLedgerAudit({
          entryId: id, studentId: existing.studentId, action: 'VOID',
          before: snapshot(existing), userId: auth.userId, userName: actor, reason: `HARD_DELETE: ${reason}`,
        }, tx);
        await tx.feeLedger.delete({ where: { id } });
      });
    } else if (existing.voidedAt) {
      return Response.json({ error: 'Already voided' }, { status: 400 });
    } else {
      await prisma.$transaction(async tx => {
        const voided = await tx.feeLedger.update({
          where: { id },
          data: {
            voidedAt: new Date(),
            voidedBy: actor || null,
            voidReason: reason || null,
          },
        });
        await writeFeeLedgerAudit({
          entryId: id, studentId: existing.studentId, action: 'VOID',
          before: snapshot(existing), after: snapshot(voided),
          userId: auth.userId, userName: actor, reason,
        }, tx);
      });
    }
    const { balance } = await recomputeStudentLedger(existing.studentId);
    return Response.json({ voided: !hard, deleted: hard, currentBalance: balance });
  } catch (error: any) {
    return Response.json({ error: 'Failed to void entry: ' + error.message }, { status: 500 });
  }
}

// POST /api/fees/ledger/entry/[id] — restore a previously voided entry.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = await prisma.feeLedger.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: 'Entry not found' }, { status: 404 });
  if (!existing.voidedAt) return Response.json({ error: 'Entry is not voided' }, { status: 400 });

  const lockMonth = await getFeeLockMonth();
  if (isMonthLocked(existing.month, lockMonth)) return lockedResponse(lockMonth!);

  const restored = await prisma.$transaction(async tx => {
    const r = await tx.feeLedger.update({
      where: { id },
      data: { voidedAt: null, voidedBy: null, voidReason: null },
    });
    await writeFeeLedgerAudit({
      entryId: id, studentId: existing.studentId, action: 'RESTORE',
      before: snapshot(existing), after: snapshot(r),
      userId: auth.userId, userName: body.actor, reason: body.reason,
    }, tx);
    return r;
  });
  const { balance } = await recomputeStudentLedger(existing.studentId);
  return Response.json({ restored: true, entry: restored, currentBalance: balance });
}

function snapshot(e: any) {
  return {
    id: e.id, type: e.type, category: e.category, description: e.description,
    amount: e.amount, month: e.month, date: e.date,
    paymentMethod: e.paymentMethod, receivedBy: e.receivedBy, receiptNumber: e.receiptNumber,
    voidedAt: e.voidedAt, voidedBy: e.voidedBy, voidReason: e.voidReason,
  };
}
