'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { motion } from 'framer-motion';
import { Bell, LogOut } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <motion.header
      className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-800">School ERP</h2>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <span className="text-sm font-medium text-slate-700">{user.firstName} {user.lastName}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              user.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
              user.role === 'TEACHER' ? 'bg-blue-100 text-blue-700' :
              user.role === 'PARENT' ? 'bg-green-100 text-green-700' :
              'bg-slate-100 text-slate-600'
            }`}>{user.role}</span>
          </motion.div>
        )}
        <motion.button
          className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          animate={{
            scale: [1, 1.15, 1],
          }}
          transition={{
            scale: {
              repeat: Infinity,
              repeatDelay: 4,
              duration: 0.6,
              ease: 'easeInOut',
            },
          }}
        >
          <Bell className="h-5 w-5" />
        </motion.button>
        {user && (
          <motion.button
            onClick={handleLogout}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition"
            title="Logout"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <LogOut className="h-5 w-5" />
          </motion.button>
        )}
      </div>
    </motion.header>
  );
}
