'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { FolderOpen, ExternalLink, FileText, Video, Link as LinkIcon, FileType, Image as ImageIcon } from 'lucide-react';

const TYPE_ICON: Record<string, any> = {
  PDF: FileType, VIDEO: Video, LINK: LinkIcon, NOTE: FileText, IMAGE: ImageIcon, DOC: FileText, OTHER: FileText,
};

export default function ParentMaterialsPage() {
  const { user } = useAuthStore();
  const [children, setChildren] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [materials, setMaterials] = useState<any[]>([]);

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
    api.get('/study-materials', { params: { studentId: selected } }).then(r => setMaterials(r.data));
  }, [selected]);

  // Group by subject
  const bySubject = materials.reduce((acc: Record<string, any[]>, m: any) => {
    const key = m.subject.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Study Materials</h1>
          </div>
          {children.length > 1 && (
            <select value={selected} onChange={e => setSelected(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900">
              {children.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.className})</option>)}
            </select>
          )}
        </div>

        {Object.keys(bySubject).length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            No study materials shared yet.
          </div>
        ) : (
          Object.entries(bySubject).map(([subject, items]) => (
            <div key={subject} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-3">{subject}</h2>
              <ul className="space-y-2">
                {items.map((m: any) => {
                  const Icon = TYPE_ICON[m.type] || FileText;
                  return (
                    <li key={m.id} className="flex items-start gap-3 border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition">
                      <Icon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900">{m.title}</p>
                          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{m.type}</span>
                        </div>
                        {m.description && <p className="text-sm text-slate-600 mt-1">{m.description}</p>}
                        <p className="text-xs text-slate-400 mt-1">
                          By {m.teacher.user.firstName} {m.teacher.user.lastName} · {formatDate(m.createdAt)}
                        </p>
                      </div>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700">
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
