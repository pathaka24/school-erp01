// Edge-runtime compatible token verifier (uses Web Crypto, not Node crypto).
// Used by middleware.ts which runs at the edge.

const AUTH_SECRET = process.env.AUTH_SECRET || 'school-erp-secret-key-change-in-production';
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface TokenPayload {
  userId: string;
  role: string;
}

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyTokenEdge(token: string): Promise<TokenPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedPayload, timestamp, signature] = parts;

  const tokenTime = parseInt(timestamp, 10);
  if (isNaN(tokenTime) || Date.now() - tokenTime > TOKEN_MAX_AGE_MS) return null;

  const data = `${encodedPayload}.${timestamp}`;
  const expected = await hmacSha256Hex(AUTH_SECRET, data);
  if (!constantTimeEq(signature, expected)) return null;

  try {
    const json = atob(encodedPayload);
    const decoded = JSON.parse(json);
    if (!decoded.userId || !decoded.role) return null;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}
