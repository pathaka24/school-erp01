// Sends push notifications via Expo's free push service.
// Token format: ExponentPushToken[xxxxxxxx]

import { prisma } from '@/lib/db';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendBatch(tokens: string[], payload: PushPayload) {
  if (tokens.length === 0) return;

  const messages = tokens.map(t => ({
    to: t,
    sound: payload.sound === undefined ? 'default' : payload.sound,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      console.warn('[push] Expo API non-2xx', res.status, await res.text());
      return;
    }

    const result = await res.json();
    // Expo returns receipts indicating delivery status. Clean up tokens that
    // come back as DeviceNotRegistered to keep our table fresh.
    const data = result.data || [];
    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      if (r?.status === 'error' && r?.details?.error === 'DeviceNotRegistered') {
        const badToken = tokens[i];
        prisma.pushToken.deleteMany({ where: { token: badToken } }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[push] send failed', e);
  }
}

export async function pushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return;
  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true },
  });
  await sendBatch(tokens.map(t => t.token), payload);
}

export async function pushToRoles(roles: ('ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT')[], payload: PushPayload) {
  if (roles.length === 0) return;
  const users = await prisma.user.findMany({
    where: { role: { in: roles as any[] } },
    select: { id: true },
  });
  await pushToUsers(users.map(u => u.id), payload);
}

export async function pushToAll(payload: PushPayload) {
  const tokens = await prisma.pushToken.findMany({ select: { token: true } });
  await sendBatch(tokens.map(t => t.token), payload);
}
