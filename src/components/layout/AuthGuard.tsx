'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { pageScope, userHasScope } from '@/lib/clientPermissions';

// Pages accessible by each role
const ROLE_ROUTES: Record<string, string[]> = {
  ADMIN: ['*'],
  STAFF: ['*'],  // STAFF can hit any admin route URL — fine-grained gating is via pageScope below
  TEACHER: ['/dashboard', '/teacher', '/attendance', '/timetable', '/exams', '/grades', '/students', '/qr-scan', '/report-card', '/profile'],
  PARENT: ['/parent', '/report-card', '/profile'],
  STUDENT: ['/student', '/profile'],
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, token, hydrate, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrate();
    // Small delay to let hydrate populate store
    const timer = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(timer);
  }, [hydrate]);

  useEffect(() => {
    if (!ready) return;

    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }

    // Role-based route check
    if (user?.role) {
      const allowed = ROLE_ROUTES[user.role] || [];
      if (!allowed.includes('*')) {
        const hasAccess = allowed.some(route => pathname.startsWith(route));
        if (!hasAccess) {
          // Redirect to their home page
          const dest = user.role === 'TEACHER' ? '/teacher/dashboard' : user.role === 'PARENT' ? '/parent' : '/dashboard';
          router.push(dest);
          return;
        }
      }

      // Scope-based route check (for STAFF). ADMIN is allowed everywhere.
      if (user.role === 'STAFF') {
        const scope = pageScope(pathname);
        if (scope && !userHasScope(user.role, user.permissions, scope)) {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(
              'flash',
              `Access denied to ${pathname}. You don't have the "${scope}" permission.`,
            );
          }
          router.push('/dashboard');
        }
      }
    }
  }, [ready, user, token, pathname, router]);

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-slate-400 mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && !localStorage.getItem('token')) return null;

  return <>{children}</>;
}
