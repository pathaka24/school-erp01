import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';
import { isValidType, parseConfig, defaultConfig, type TemplateType } from '@/lib/printTemplates';

// GET /api/print-templates?type=STUDENT_ID
// Returns all templates of the given type (or all types if omitted).
// Reading templates is allowed for any authenticated user — the makers need it.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const type = sp.get('type');

  const where: any = {};
  if (type) {
    if (!isValidType(type)) return Response.json({ error: 'invalid type' }, { status: 400 });
    where.type = type;
  }

  const rows = await (prisma as any).printTemplate.findMany({
    where,
    orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
  });

  return Response.json(rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    isDefault: r.isDefault,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    config: parseConfig(r.type as TemplateType, r.config),
  })));
}

// POST /api/print-templates
// Body: { name, type, config?, makeDefault? }
// Creates a new template with defaults if config not provided.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'settings');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { name, type, config, makeDefault } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  if (!isValidType(type)) return Response.json({ error: 'invalid type' }, { status: 400 });

  const finalConfig = config ?? defaultConfig(type);

  // If makeDefault, clear other defaults of the same type
  if (makeDefault) {
    await (prisma as any).printTemplate.updateMany({
      where: { type, isDefault: true },
      data: { isDefault: false },
    });
  }

  const created = await (prisma as any).printTemplate.create({
    data: {
      name: name.trim(),
      type,
      config: JSON.stringify(finalConfig),
      isDefault: !!makeDefault,
    },
  });

  return Response.json({
    id: created.id, name: created.name, type: created.type,
    isDefault: created.isDefault, config: finalConfig,
  }, { status: 201 });
}
