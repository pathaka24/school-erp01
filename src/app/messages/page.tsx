'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { MessageSquare, Send, Plus, X, Search } from 'lucide-react';

type Thread = {
  id: string;
  subject: string;
  studentId: string | null;
  student: any;
  participants: any[];
  lastMessage: any;
  unreadLast: boolean;
  updatedAt: string;
  _count: { messages: number };
};

type Message = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; role: string };
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  TEACHER: 'bg-blue-100 text-blue-700',
  PARENT: 'bg-green-100 text-green-700',
  STUDENT: 'bg-amber-100 text-amber-700',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<any>(null);
  const [draft, setDraft] = useState('');
  const [showNew, setShowNew] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New thread form
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newRecipientId, setNewRecipientId] = useState('');
  const [newInitial, setNewInitial] = useState('');

  const loadThreads = async () => {
    if (!user) return;
    const { data } = await api.get('/messages/threads', { params: { userId: user.id } });
    setThreads(data);
  };

  useEffect(() => { loadThreads(); }, [user]);

  useEffect(() => {
    if (!activeId || !user) return;
    api.get(`/messages/threads/${activeId}`, { params: { userId: user.id } })
      .then(r => setActiveThread(r.data));
  }, [activeId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages?.length]);

  const sendMessage = async () => {
    if (!draft.trim() || !user || !activeId) return;
    await api.post(`/messages/threads/${activeId}`, { senderId: user.id, body: draft });
    setDraft('');
    const r = await api.get(`/messages/threads/${activeId}`, { params: { userId: user.id } });
    setActiveThread(r.data);
    loadThreads();
  };

  const loadUsers = async () => {
    if (users.length > 0) return;
    const { data } = await api.get('/users');
    setUsers(data.filter((u: any) => u.id !== user?.id));
  };

  const startThread = async () => {
    if (!user || !newRecipientId || !newSubject.trim()) return;
    try {
      const { data } = await api.post('/messages/threads', {
        subject: newSubject,
        participantIds: [user.id, newRecipientId],
        initialMessage: newInitial || null,
        senderId: user.id,
      });
      setShowNew(false);
      setNewSubject(''); setNewRecipientId(''); setNewInitial(''); setSearchTerm('');
      await loadThreads();
      setActiveId(data.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create conversation');
    }
  };

  const filteredUsers = users.filter((u: any) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q);
  });

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-7rem)] flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Sidebar — threads */}
        <aside className="w-80 border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-slate-900">Messages</h2>
            </div>
            <button
              onClick={() => { setShowNew(true); loadUsers(); }}
              className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">No conversations yet.</div>
            ) : (
              threads.map(t => {
                const others = t.participants.filter((p: any) => p.user.id !== user?.id);
                const otherNames = others.map((p: any) => `${p.user.firstName} ${p.user.lastName}`).join(', ');
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition ${
                      activeId === t.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium text-sm truncate ${t.unreadLast ? 'text-slate-900' : 'text-slate-700'}`}>
                        {t.subject}
                      </p>
                      <span className="text-xs text-slate-400 flex-shrink-0">{formatTime(t.updatedAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-1">{otherNames}</p>
                    {t.lastMessage && (
                      <p className={`text-xs truncate mt-1 ${t.unreadLast ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                        {t.lastMessage.sender.firstName}: {t.lastMessage.body}
                      </p>
                    )}
                    {t.student && (
                      <p className="text-xs text-blue-600 mt-1">
                        Re: {t.student.user.firstName} {t.student.user.lastName}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Main — conversation */}
        <main className="flex-1 flex flex-col">
          {!activeThread ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-40" />
                <p>Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900">{activeThread.subject}</h2>
                <div className="flex flex-wrap gap-2 mt-1 text-xs">
                  {activeThread.participants.map((p: any) => (
                    <span key={p.user.id} className={`px-2 py-0.5 rounded ${ROLE_COLORS[p.user.role] || 'bg-slate-100 text-slate-600'}`}>
                      {p.user.firstName} {p.user.lastName}
                    </span>
                  ))}
                  {activeThread.student && (
                    <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-700">
                      Re: {activeThread.student.user.firstName} {activeThread.student.user.lastName}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {activeThread.messages.map((m: Message) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md ${mine ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-900'} rounded-lg p-3`}>
                        {!mine && (
                          <p className="text-xs font-medium mb-1 text-slate-500">
                            {m.sender.firstName} {m.sender.lastName}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                        <p className={`text-xs mt-1 ${mine ? 'text-blue-100' : 'text-slate-400'}`}>{formatTime(m.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="p-4 border-t border-slate-200 flex gap-2"
              >
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
                <button type="submit" disabled={!draft.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </main>

        {/* New thread modal */}
        {showNew && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">New conversation</h2>
                <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recipient</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                {searchTerm && (
                  <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                    {filteredUsers.slice(0, 20).map((u: any) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setNewRecipientId(u.id); setSearchTerm(`${u.firstName} ${u.lastName}`); }}
                        className={`w-full text-left p-2 hover:bg-slate-50 transition flex items-center justify-between ${
                          newRecipientId === u.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span className="text-sm text-slate-900">{u.firstName} {u.lastName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${ROLE_COLORS[u.role] || 'bg-slate-100'}`}>{u.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                required
                placeholder="Subject *"
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
              <textarea
                placeholder="First message (optional)"
                value={newInitial}
                onChange={e => setNewInitial(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNew(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">Cancel</button>
                <button
                  onClick={startThread}
                  disabled={!newRecipientId || !newSubject.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Start conversation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
