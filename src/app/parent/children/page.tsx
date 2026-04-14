'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Users, ChevronRight } from 'lucide-react';

export default function ParentChildrenPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/parent/children?userId=${user.id}`)
      .then(res => setChildren(res.data.children))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">My Children</h1>
        </div>

        {children.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            No children linked to your account.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Class</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Adm. No</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Attendance</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Fee Balance</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {children.map(child => (
                  <tr
                    key={child.id}
                    onClick={() => router.push(`/parent/child/${child.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{child.name}</p>
                      {child.familyName && <p className="text-xs text-slate-400">{child.familyName}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {child.className} - {child.sectionName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{child.admissionNo}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-semibold ${
                        child.attendancePct >= 90 ? 'text-green-600' :
                        child.attendancePct >= 75 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {child.attendancePct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-semibold ${child.feeBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(child.feeBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
