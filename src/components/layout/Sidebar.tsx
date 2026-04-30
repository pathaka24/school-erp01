'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, UserPlus, GraduationCap, ClipboardList,
  Calendar, BookOpen, Award, CreditCard, School, ChevronLeft, Menu,
  FileText, UsersRound, Sparkles, BarChart3, Printer, Shield, NotebookPen, IndianRupee, ShoppingBag, Settings,
  Home, QrCode, CalendarCheck, Sun, ClipboardCheck,
  Megaphone, MessageSquare, CalendarOff, Library, ShieldAlert, FileSpreadsheet, FolderOpen,
} from 'lucide-react';
import { useState } from 'react';

const adminMenu = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'New Admission', href: '/admission', icon: UserPlus },
  { label: 'Bulk Import', href: '/import', icon: FileSpreadsheet },
  { label: 'Users', href: '/users', icon: Shield },
  { label: 'Students', href: '/students', icon: Users },
  { label: 'Teachers', href: '/teachers', icon: GraduationCap },
  { label: 'Academics', href: '/academics', icon: BookOpen },
  { label: 'Notices', href: '/notices', icon: Megaphone },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Library', href: '/library', icon: Library },
  { label: 'Attendance', href: '/attendance', icon: ClipboardList },
  { label: 'Staff Attendance', href: '/teacher-attendance', icon: CalendarCheck },
  { label: 'QR Scanner', href: '/qr-scan', icon: QrCode },
  { label: 'Scholarship Diary', href: '/scholarship-diary', icon: Sparkles },
  { label: 'Teacher Diary', href: '/teacher-diary', icon: NotebookPen },
  { label: 'Timetable', href: '/timetable', icon: Calendar },
  { label: 'Exams', href: '/exams', icon: FileText },
  { label: 'Exam Timetable', href: '/exam-timetable', icon: Calendar },
  { label: 'Exam Fees', href: '/exam-fees', icon: IndianRupee },
  { label: 'Admit Cards', href: '/admit-card', icon: CreditCard },
  { label: 'Grades', href: '/grades', icon: Award },
  { label: 'Fees', href: '/fees', icon: CreditCard },
  { label: 'Finance', href: '/finance', icon: IndianRupee },
  { label: 'Store', href: '/store', icon: ShoppingBag },
  { label: 'Family', href: '/family', icon: UsersRound },
  { label: 'Scholarship', href: '/scholarship', icon: Sparkles },
  { label: 'Fee Reports', href: '/fee-reports', icon: BarChart3 },
  { label: 'Report Card', href: '/report-card', icon: Printer },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const teacherMenu = [
  { label: 'Today', href: '/teacher/today', icon: Sun },
  { label: 'Dashboard', href: '/teacher/dashboard', icon: LayoutDashboard },
  { label: 'My Students', href: '/teacher/students', icon: Users },
  { label: 'Notices', href: '/notices', icon: Megaphone },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Attendance', href: '/teacher/attendance', icon: ClipboardList },
  { label: 'Leave Requests', href: '/teacher/leave', icon: CalendarOff },
  { label: 'Timetable', href: '/timetable', icon: Calendar },
  { label: 'Exams', href: '/teacher/exams', icon: FileText },
  { label: 'Grades', href: '/teacher/grades', icon: Award },
  { label: 'Lesson Plans', href: '/teacher/lesson-plans', icon: NotebookPen },
  { label: 'Daily Log Book', href: '/teacher/daily-log', icon: BookOpen },
  { label: 'Syllabus', href: '/teacher/syllabus', icon: BookOpen },
  { label: 'Class Tests', href: '/teacher/class-tests', icon: ClipboardCheck },
  { label: 'Behaviour Log', href: '/teacher/behaviour', icon: ShieldAlert },
  { label: 'Study Materials', href: '/teacher/materials', icon: FolderOpen },
];

const parentMenu = [
  { label: 'Dashboard', href: '/parent', icon: Home },
  { label: 'My Children', href: '/parent/children', icon: Users },
  { label: 'Notices', href: '/notices', icon: Megaphone },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Attendance', href: '/parent/attendance', icon: ClipboardList },
  { label: 'Leave', href: '/parent/leave', icon: CalendarOff },
  { label: 'Exam Results', href: '/parent/exams', icon: Award },
  { label: 'Fee Ledger', href: '/parent/fees', icon: IndianRupee },
  { label: 'Daily Diary', href: '/parent/daily-diary', icon: NotebookPen },
  { label: 'Behaviour Notes', href: '/parent/behaviour', icon: ShieldAlert },
  { label: 'Study Materials', href: '/parent/materials', icon: FolderOpen },
  { label: 'Scholarship Diary', href: '/parent/diary', icon: Sparkles },
  { label: 'Report Card', href: '/parent/report-card', icon: Printer },
];

const menuContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
};

const menuItemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
};

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuthStore();

  const menuItems = user?.role === 'TEACHER' ? teacherMenu : user?.role === 'PARENT' ? parentMenu : adminMenu;

  return (
    <motion.aside
      layout
      className={cn(
        'h-screen bg-slate-900 text-white flex flex-col overflow-hidden',
      )}
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="brand"
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <School className="h-6 w-6 text-blue-400" />
              <span className="font-bold text-lg whitespace-nowrap">SchoolERP</span>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-slate-700 rounded"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {collapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </motion.button>
      </div>

      {/* Role badge */}
      <AnimatePresence>
        {!collapsed && user && (
          <motion.div
            className="px-4 py-2 border-b border-slate-700"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              user.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-300' :
              user.role === 'PARENT' ? 'bg-green-500/20 text-green-300' :
              'bg-blue-500/20 text-blue-300'
            )}>
              {user.role}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <motion.div
          variants={menuContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {menuItems.map((item) => {
            const isDashboard = item.href === '/dashboard' || item.href === '/teacher/dashboard' || item.href === '/parent';
            const isActive = pathname === item.href || (!isDashboard && (pathname.startsWith(item.href + '/') || pathname.startsWith(item.href + '?')));
            return (
              <motion.div
                key={item.href}
                variants={menuItemVariants}
                className="relative"
              >
                <Link
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors z-10',
                    isActive
                      ? 'text-white'
                      : 'text-slate-300 hover:text-white'
                  )}
                >
                  {/* Active indicator bar - animates between items */}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute inset-0 bg-blue-600 rounded-lg"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}

                  {/* Hover background that slides in from left */}
                  {!isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-lg bg-slate-800 opacity-0"
                      whileHover={{ opacity: 1, x: ['-100%', '0%'] }}
                      transition={{ duration: 0.25 }}
                    />
                  )}

                  <item.icon className="h-5 w-5 flex-shrink-0 relative z-10" />
                  <AnimatePresence mode="wait">
                    {!collapsed && (
                      <motion.span
                        key="label"
                        className="relative z-10 whitespace-nowrap"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </nav>
    </motion.aside>
  );
}
