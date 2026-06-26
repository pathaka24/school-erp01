import { PrismaClient } from '@prisma/client';

// Supabase's transaction pooler (free tier) occasionally has a brief
// connectivity blip — Prisma throws P1001 "Can't reach database server" (or
// P1017 closed connection), which surfaces to the user as a 500. These are
// transient: a retry a fraction of a second later succeeds. This treats those
// specific errors as retryable so one blip doesn't fail the request.
function isTransientDbError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  if (err?.code && ['P1001', 'P1017', 'P1008', 'P2024'].includes(err.code)) return true;
  const msg = String(err?.message || '');
  return /can't reach database server|server has closed the connection|timed out fetching|connection pool/i.test(msg);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makePrisma(): PrismaClient {
  const client = new PrismaClient();
  client.$use(async (params, next) => {
    const maxAttempts = 4;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await next(params);
      } catch (e) {
        lastErr = e;
        if (attempt >= maxAttempts || !isTransientDbError(e)) throw e;
        await new Promise(r => setTimeout(r, attempt * 300)); // 300ms, 600ms, 900ms backoff
      }
    }
    throw lastErr;
  });
  return client;
}

export const prisma = globalForPrisma.prisma || makePrisma();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
