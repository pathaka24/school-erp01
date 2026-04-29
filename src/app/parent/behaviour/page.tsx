'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ShieldAlert, ThumbsUp, ThumbsDown, MinusCircle } from 'lucide-react';

const TYPE_BADGE: Record<string, string> = {
  POSITIVE: 'bg-emerald-100 text-emerald-700',
  NEGATIVE: 'bg-red-100 text-red-700',
  NEUTRAL: 'bg-slate-100 text-slate-700',
};
const TYPE_ICON: Record<string, any> = { POSITIVE: ThumbsUp, NEGATIVE: ThumbsDown, NEUTRAL: MinusCircle };

export default function ParentBehaviourPage() {
  const { user } = useAuthStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    api.get('/parent/children', { params: { userId: user.id } })
      .then(r => {
        setChildren(r.data.children);
        if (r.data.children.length > 0) setSelected(r.data.children[0].id);
      });
  }, [user]);

  useEffect(() => {
    if (!selected) return;
    api.get('/behaviour', { params: { studentId: selected } })
      .then(r => setLogs(r.data.filter((l: any) => l.parentNotified)));
  }, [selected]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Behaviour Notes</h1>
          </div>
          {children.length > 1 && (
            <select value={selected} onChange={e => setSelected(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
              {children.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.className})</option>)}
            </select>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            No behaviour notes yet.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map(l => {
              const Icon = TYPE_ICON[l.type];
              return (
                <div key={l.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 flex-shrink-0 ${l.type === 'POSITIVE' ? 'text-emerald-500' : l.type === 'NEGATIVE' ? 'text-red-500' : 'text-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${TYPE_BADGE[l.type]}`}>{l.type}</span>
                        <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{l.category}</span>
                      </div>
                      <p className="text-sm text-slate-700 mt-2">{l.description}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-2">
                        <span>{formatDate(l.date)}</span>
                        <span>By {l.teacher.user.firstName} {l.teacher.user.lastName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
