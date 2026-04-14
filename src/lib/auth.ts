import { createHmac } from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'school-erp-secret-key-change-in-production';

export interface TokenPayload {
  userId: string;
  role: string;
}

/**
 * HMAC-SHA256 sign a payload. Returns a token in the format:
 *   base64(payload).timestamp.signature
 */
export function signToken(payload: TokenPayload): string {
  const timestamp = Date.now().toString();
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const data = `${encodedPayload}.${timestamp}`;
  const signature = createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
  return `${data}.${signature}`;
}

/**
 * Verify an HMAC-SHA256 signed token. Returns the payload if valid, null otherwise.
 */
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedPayload, timestamp, signature] = parts;

  // Check expiration
  const tokenTime = parseInt(timestamp, 10);
  if (isNaN(tokenTime) || Date.now() - tokenTime > TOKEN_MAX_AGE_MS) return null;

  // Verify signature
  const data = `${encodedPayload}.${timestamp}`;
  const expectedSignature = createHmac('sha256', AUTH_SECRET).update(data).digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) return null;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  // Decode payload
  try {
    const decoded = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf-8'));
    if (!decoded.userId || !decoded.role) return null;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

/**
 * Extract and verify the auth token from the Authorization header of a request.
 * Expects: `Authorization: Bearer <token>`
 */
export function getAuthFromRequest(request: Request): TokenPayload | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  return verifyToken(match[1]);
}
