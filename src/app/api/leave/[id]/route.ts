import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leave = await prisma.leaveApplication.findUnique({
    where: { id },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
      appliedBy: { select: { id: true, firstName: true, lastName: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!leave) return Response.json({ error: 'Leave not found' }, { status: 404 });
  return Response.json(leave);
}

// PUT /api/leave/[id] — review (approve/reject) or cancel
// Body: { status: APPROVED|REJECTED|CANCELLED, reviewedById, reviewNote? }
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status, reviewedById, reviewNote } = await request.json();

  if (!status || !['APPROVED', 'REJECTED', 'CANCELLED', 'PENDING'].includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    const leave = await prisma.leaveApplication.update({
      where: { id },
      data: {
        status,
        reviewedById: reviewedById || null,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
      include: { student: { select: { id: true } } },
    });

    // If approved, mark attendance EXCUSED for the date range
    if (status === 'APPROVED') {
      const days: Date[] = [];
      const cur = new Date(leave.fromDate);
      const end = new Date(leave.toDate);
      while (cur <= end) {
        days.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      await Promise.all(
        days.map(d =>
          prisma.attendance.upsert({
            where: { studentId_date: { studentId: leave.studentId, date: d } },
            update: { status: 'EXCUSED', remarks: `Leave approved: ${reviewNote || 'no note'}` },
            create: { studentId: leave.studentId, date: d, status: 'EXCUSED', remarks: `Leave approved: ${reviewNote || 'no note'}` },
          })
        )
      );
    }

    return Response.json(leave);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Leave not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update leave' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.leaveApplication.delete({ where: { id } });
    return Response.json({ message: 'Leave deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Leave not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete leave' }, { status: 500 });
  }
}
