'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

// Pages accessible by each role
const ROLE_ROUTES: Record<string, string[]> = {
  ADMIN: ['*'],
  TEACHER: ['/dashboard', '/teacher', '/attendance', '/timetable', '/exams', '/grades', '/students', '/qr-scan', '/report-card'],
  PARENT: ['/parent', '/report-card'],
  STUDENT: ['/student'],
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
