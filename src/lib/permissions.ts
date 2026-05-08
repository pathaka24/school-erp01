// Feature scopes that an admin can grant to a STAFF user.
// Each scope corresponds to a chunk of the admin sidebar — granting a scope
// means the staff user can access those pages. ADMIN gets everything implicitly;
// STAFF only sees scopes in their User.permissions array.

export type PermissionScope =
  | 'students'
  | 'admission'
  | 'teachers'
  | 'attendance'
  | 'academics'
  | 'exams'
  | 'grades'
  | 'fees'
  | 'finance'
  | 'scholarship'
  | 'reports'
  | 'timetable'
  | 'notices'
  | 'messages'
  | 'calendar'
  | 'library'
  | 'store'
  | 'reportcard'
  | 'admitcard'
  | 'idcard'
  | 'family'
  | 'leave'
  | 'behaviour'
  | 'bulkimport'
  | 'users'
  | 'settings';

export const ALL_SCOPES: { id: PermissionScope; label: string; group: string; description: string }[] = [
  // People
  { id: 'students', label: 'Students', group: 'People', description: 'View, edit, manage student records' },
  { id: 'admission', label: 'New Admission', group: 'People', description: 'Add new students to the school' },
  { id: 'teachers', label: 'Teachers / Staff', group: 'People', description: 'Manage teacher accounts and details' },
  { id: 'family', label: 'Family / Siblings', group: 'People', description: 'Group siblings into families' },
  { id: 'bulkimport', label: 'Bulk Import', group: 'People', description: 'Import students/teachers via CSV/Excel' },
  // Money
  { id: 'fees', label: 'Fees', group: 'Money', description: 'Fee structures, collection, ledger' },
  { id: 'finance', label: 'Finance', group: 'Money', description: 'Expenses, salaries, finance reports' },
  { id: 'reports', label: 'Fee Reports & Audit', group: 'Money', description: 'Collection dashboard, audit log, defaulters' },
  { id: 'scholarship', label: 'Scholarship', group: 'Money', description: 'Wallets, ledger, tier management' },
  // Academics
  { id: 'academics', label: 'Academics', group: 'Academics', description: 'Marks, co-scholastic, qualities' },
  { id: 'attendance', label: 'Attendance', group: 'Academics', description: 'Mark and view attendance' },
  { id: 'exams', label: 'Exams', group: 'Academics', description: 'Exam scheduling and management' },
  { id: 'grades', label: 'Grades', group: 'Academics', description: 'Enter and view grades' },
  { id: 'timetable', label: 'Timetable', group: 'Academics', description: 'Class and exam schedules' },
  { id: 'reportcard', label: 'Report Card', group: 'Academics', description: 'Generate report cards' },
  { id: 'admitcard', label: 'Admit Card', group: 'Academics', description: 'Generate admit cards for exams' },
  { id: 'idcard', label: 'ID Card Maker', group: 'Academics', description: 'Bulk-print student/staff ID cards' },
  // Communication
  { id: 'notices', label: 'Notices', group: 'Communication', description: 'Post and manage school notices' },
  { id: 'messages', label: 'Messages', group: 'Communication', description: 'Direct messaging with parents/teachers' },
  { id: 'calendar', label: 'Calendar / Events', group: 'Communication', description: 'School calendar and events' },
  { id: 'leave', label: 'Leave Applications', group: 'Communication', description: 'Approve / view leave requests' },
  { id: 'behaviour', label: 'Behaviour Log', group: 'Communication', description: 'Student behaviour incidents' },
  // Other
  { id: 'library', label: 'Library', group: 'Other', description: 'Book catalog and issuance' },
  { id: 'store', label: 'Store', group: 'Other', description: 'School store / inventory' },
  // Admin-only
  { id: 'users', label: 'Users & Access', group: 'Admin', description: 'Manage user accounts and permissions (admin only)' },
  { id: 'settings', label: 'Settings', group: 'Admin', description: 'School-wide settings (admin only)' },
];

// Quick lookups
export const SCOPES_BY_GROUP = ALL_SCOPES.reduce((acc, s) => {
  if (!acc[s.group]) acc[s.group] = [];
  acc[s.group].push(s);
  return acc;
}, {} as Record<string, typeof ALL_SCOPES>);

// Effective scopes for a user. ADMIN gets all; STAFF gets their permissions; other roles get nothing here (they have their own portals).
export function effectivePermissions(role: string, permissions: string[] | undefined): Set<string> {
  if (role === 'ADMIN') return new Set(ALL_SCOPES.map(s => s.id));
  if (role === 'STAFF') return new Set(permissions || []);
  return new Set();
}

export function hasScope(role: string, permissions: string[] | undefined, scope: PermissionScope): boolean {
  return effectivePermissions(role, permissions).has(scope);
}
