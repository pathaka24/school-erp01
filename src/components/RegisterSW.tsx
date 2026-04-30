'use client';

import { useEffect } from 'react';

// Registers the service worker in production. In dev we skip to avoid stale caches.
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('[SW] register failed', err));
  }, []);

  return null;
}
