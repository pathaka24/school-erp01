import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail, leaveDecisionEmail } from '@/lib/email';
import { pushToUsers } from '@/lib/push';

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

    // Email the parent on a final decision (approve/reject)
    if (status === 'APPROVED' || status === 'REJECTED') {
      try {
        const full = await prisma.leaveApplication.findUnique({
          where: { id },
          include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
            appliedBy: { select: { email: true, firstName: true, lastName: true } },
            reviewedBy: { select: { firstName: true, lastName: true } },
          },
        });
        if (full?.appliedBy?.email) {
          const tpl = leaveDecisionEmail({
            parentName: `${full.appliedBy.firstName} ${full.appliedBy.lastName}`,
            studentName: `${full.student.user.firstName} ${full.student.user.lastName}`,
            fromDate: full.fromDate.toISOString().slice(0, 10),
            toDate: full.toDate.toISOString().slice(0, 10),
            status: status as 'APPROVED' | 'REJECTED',
            reviewNote: reviewNote || undefined,
            reviewerName: full.reviewedBy ? `${full.reviewedBy.firstName} ${full.reviewedBy.lastName}` : undefined,
          });
          await sendEmail({ to: full.appliedBy.email, ...tpl });
        }
        // Push to applicant
        if (full?.appliedById) {
          await pushToUsers([full.appliedById], {
            title: `Leave ${status.toLowerCase()}`,
            body: `${full.student.user.firstName}'s leave (${full.fromDate.toISOString().slice(0,10)} – ${full.toDate.toISOString().slice(0,10)}) was ${status.toLowerCase()}.`,
            data: { type: 'leave', id: full.id },
          });
        }
      } catch (e) {
        console.warn('[leave] email send failed', e);
      }
    }

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
