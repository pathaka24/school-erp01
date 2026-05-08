import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';
import { parseConfig, type TemplateType } from '@/lib/printTemplates';

// GET /api/print-templates/[id] — fetch one template (auth, any role)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tpl = await (prisma as any).printTemplate.findUnique({ where: { id } });
  if (!tpl) return Response.json({ error: 'Template not found' }, { status: 404 });
  return Response.json({
    id: tpl.id, name: tpl.name, type: tpl.type, isDefault: tpl.isDefault,
    config: parseConfig(tpl.type as TemplateType, tpl.config),
  });
}

// PATCH /api/print-templates/[id] — update name / config / default flag. ADMIN only.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireScope(request, 'settings');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const existing = await (prisma as any).printTemplate.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: 'Template not found' }, { status: 404 });

  const data: any = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return Response.json({ error: 'name must be non-empty' }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (body.config !== undefined) {
    data.config = JSON.stringify(body.config);
  }
  if (body.isDefault === true && !existing.isDefault) {
    // Unset other defaults of same type before flipping this one
    await (prisma as any).printTemplate.updateMany({
      where: { type: existing.type, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
    data.isDefault = true;
  } else if (body.isDefault === false) {
    data.isDefault = false;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  const updated = await (prisma as any).printTemplate.update({ where: { id }, data });
  return Response.json({
    id: updated.id, name: updated.name, type: updated.type, isDefault: updated.isDefault,
    config: parseConfig(updated.type as TemplateType, updated.config),
  });
}

// DELETE /api/print-templates/[id] — ADMIN only.
// Refuses if it's the only template for its type (system needs at least one default).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireScope(request, 'settings');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await (prisma as any).printTemplate.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: 'Template not found' }, { status: 404 });

  const sameTypeCount = await (prisma as any).printTemplate.count({ where: { type: existing.type } });
  if (sameTypeCount === 1) {
    return Response.json(
      { error: 'Cannot delete the last template of this type. Create another first.' },
      { status: 409 },
    );
  }

  await (prisma as any).printTemplate.delete({ where: { id } });

  // If we just deleted the default, promote the most recently updated remaining one
  if (existing.isDefault) {
    const next = await (prisma as any).printTemplate.findFirst({
      where: { type: existing.type },
      orderBy: { updatedAt: 'desc' },
    });
    if (next) {
      await (prisma as any).printTemplate.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  return Response.json({ deleted: true });
}
