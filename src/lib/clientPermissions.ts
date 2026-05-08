'use client';

// Client-side helpers mirroring lib/permissions.ts. Used by sidebar filtering,
// page-level guards, and conditional UI (hide buttons the user can't use).

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import type { PermissionScope } from '@/lib/permissions';

// Map a pathname (or path prefix) to the scope it requires. ADMIN bypasses.
// First-match wins. Order matters — more specific paths first.
const PATH_SCOPE_MAP: { prefix: string; scope: PermissionScope }[] = [
  // Most specific first
  { prefix: '/fee-reports/audit-log', scope: 'reports' },
  { prefix: '/fee-reports/dashboard', scope: 'reports' },
  { prefix: '/fee-reports', scope: 'reports' },
  { prefix: '/fees/register', scope: 'fees' },
  { prefix: '/fees', scope: 'fees' },
  { prefix: '/finance', scope: 'finance' },
  { prefix: '/students/promote', scope: 'students' },
  { prefix: '/students', scope: 'students' },
  { prefix: '/admission', scope: 'admission' },
  { prefix: '/teachers', scope: 'teachers' },
  { prefix: '/teacher-attendance', scope: 'teachers' },
  { prefix: '/teacher-diary', scope: 'teachers' },
  { prefix: '/academics', scope: 'academics' },
  { prefix: '/exam-timetable', scope: 'exams' },
  { prefix: '/exam-fees', scope: 'fees' },
  { prefix: '/exams', scope: 'exams' },
  { prefix: '/grades', scope: 'grades' },
  { prefix: '/timetable', scope: 'timetable' },
  { prefix: '/attendance', scope: 'attendance' },
  { prefix: '/qr-scan', scope: 'attendance' },
  { prefix: '/scholarship-diary', scope: 'scholarship' },
  { prefix: '/scholarship', scope: 'scholarship' },
  { prefix: '/report-card-maker', scope: 'reportcard' },
  { prefix: '/report-card', scope: 'reportcard' },
  { prefix: '/admit-card', scope: 'admitcard' },
  { prefix: '/id-maker', scope: 'idcard' },
  { prefix: '/family', scope: 'family' },
  { prefix: '/notices', scope: 'notices' },
  { prefix: '/messages', scope: 'messages' },
  { prefix: '/calendar', scope: 'calendar' },
  { prefix: '/library', scope: 'library' },
  { prefix: '/store', scope: 'store' },
  { prefix: '/import', scope: 'bulkimport' },
  { prefix: '/users', scope: 'users' },
  { prefix: '/settings', scope: 'settings' },
  { prefix: '/monthly-diary', scope: 'academics' },
];

// Pages that any authenticated user can access (no scope required)
const ALWAYS_ALLOWED = [
  '/dashboard',
  '/profile',
  '/login',
];

export function pageScope(pathname: string): PermissionScope | null {
  if (ALWAYS_ALLOWED.some(p => pathname === p || pathname.startsWith(p + '/'))) return null;
  // Teacher / parent / student portals are gated by role, not scope
  if (pathname.startsWith('/teacher/') || pathname.startsWith('/parent/')) return null;
  for (const { prefix, scope } of PATH_SCOPE_MAP) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return scope;
  }
  return null;
}

export function userHasScope(
  role: string | undefined,
  permissions: string[] | undefined,
  scope: PermissionScope,
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'STAFF') return false;
  return (permissions || []).includes(scope);
}

// Hook: redirects to /dashboard if the current user lacks the page's scope.
// Place once in any admin page that should be gated.
export function useRequireScope(scope: PermissionScope | null) {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return; // AuthGuard handles unauthenticated case
    if (!scope) return; // page is open to all authenticated users
    if (userHasScope(user.role, user.permissions, scope)) return;
    // No access — bounce to dashboard with a flash message
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'flash',
        `You don't have access to that page. Ask an admin for the "${scope}" permission.`,
      );
    }
    router.replace('/dashboard');
  }, [user, scope, router]);
}

// Hook variant: derives scope from current pathname automatically.
// Useful as a single one-liner in a layout that wraps all admin pages.
export function useAutoScopeGuard() {
  const pathname = usePathname();
  const scope = pageScope(pathname);
  useRequireScope(scope);
}
