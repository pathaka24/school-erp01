import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { pushToUsers, pushToRoles, pushToAll } from '@/lib/push';

// GET /api/notices?role=&userId=&classId=&sectionId=&studentId=
// Returns notices visible to the caller. If userId provided, also annotates `read` flag.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const role = searchParams.get('role');
  const userId = searchParams.get('userId');
  const classId = searchParams.get('classId');
  const sectionId = searchParams.get('sectionId');
  const studentId = searchParams.get('studentId');

  // Resolve student → class/section if given
  let resolvedClassId = classId;
  let resolvedSectionId = sectionId;
  if (studentId && !classId) {
    const s = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true, sectionId: true } });
    if (s) { resolvedClassId = s.classId; resolvedSectionId = s.sectionId; }
  }

  const audienceFilter: any[] = [{ audience: 'ALL' }];
  if (role === 'ADMIN') audienceFilter.push({ audience: 'ADMINS' });
  if (role === 'TEACHER') audienceFilter.push({ audience: 'TEACHERS' });
  if (role === 'PARENT') audienceFilter.push({ audience: 'PARENTS' });
  if (role === 'STUDENT') audienceFilter.push({ audience: 'STUDENTS' });
  if (resolvedClassId) audienceFilter.push({ audience: 'CLASS', classId: resolvedClassId });
  if (resolvedSectionId) audienceFilter.push({ audience: 'SECTION', sectionId: resolvedSectionId });

  const now = new Date();
  const notices = await prisma.notice.findMany({
    where: {
      AND: [
        { OR: audienceFilter },
        { publishedAt: { lte: now } },
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
      ],
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, role: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      ...(userId ? { reads: { where: { userId }, select: { id: true } } } : {}),
    },
    orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
  });

  return Response.json(
    notices.map((n: any) => ({
      ...n,
      read: userId ? n.reads.length > 0 : undefined,
      reads: undefined,
    }))
  );
}

// POST /api/notices — create a notice
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, body: noticeBody, audience, classId, sectionId, authorId, isPinned, expiresAt, publishedAt } = body;

  if (!title || !noticeBody || !authorId) {
    return Response.json({ error: 'title, body, and authorId are required' }, { status: 400 });
  }
  if (audience === 'CLASS' && !classId) {
    return Response.json({ error: 'classId is required for CLASS audience' }, { status: 400 });
  }
  if (audience === 'SECTION' && !sectionId) {
    return Response.json({ error: 'sectionId is required for SECTION audience' }, { status: 400 });
  }

  const notice = await prisma.notice.create({
    data: {
      title,
      body: noticeBody,
      audience: audience || 'ALL',
      classId: classId || null,
      sectionId: sectionId || null,
      authorId,
      isPinned: isPinned || false,
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });

  // Fire push to the audience (best-effort, don't block response)
  (async () => {
    try {
      const payload = { title: notice.title, body: notice.body.slice(0, 140), data: { type: 'notice', id: notice.id } };
      const aud = notice.audience;
      if (aud === 'ALL') await pushToAll(payload);
      else if (aud === 'ADMINS') await pushToRoles(['ADMIN'], payload);
      else if (aud === 'TEACHERS') await pushToRoles(['TEACHER'], payload);
      else if (aud === 'PARENTS') await pushToRoles(['PARENT'], payload);
      else if (aud === 'STUDENTS') await pushToRoles(['STUDENT'], payload);
      else if (aud === 'CLASS' && notice.classId) {
        const students = await prisma.student.findMany({
          where: { classId: notice.classId },
          select: { user: { select: { id: true } }, parent: { select: { user: { select: { id: true } } } } },
        });
        const ids = new Set<string>();
        for (const s of students) {
          if (s.user?.id) ids.add(s.user.id);
          if (s.parent?.user?.id) ids.add(s.parent.user.id);
        }
        await pushToUsers(Array.from(ids), payload);
      }
      else if (aud === 'SECTION' && notice.sectionId) {
        const students = await prisma.student.findMany({
          where: { sectionId: notice.sectionId },
          select: { user: { select: { id: true } }, parent: { select: { user: { select: { id: true } } } } },
        });
        const ids = new Set<string>();
        for (const s of students) {
          if (s.user?.id) ids.add(s.user.id);
          if (s.parent?.user?.id) ids.add(s.parent.user.id);
        }
        await pushToUsers(Array.from(ids), payload);
      }
    } catch (e) {
      console.warn('[notice] push failed', e);
    }
  })();

  return Response.json(notice, { status: 201 });
}
