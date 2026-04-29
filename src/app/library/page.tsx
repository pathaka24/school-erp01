'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Library, Plus, X, BookOpen, Trash2, Search } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  ISSUED: 'bg-blue-100 text-blue-700',
  RETURNED: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
  LOST: 'bg-red-100 text-red-700',
};

export default function LibraryPage() {
  const [tab, setTab] = useState<'books' | 'issues' | 'overdue'>('books');
  const [books, setBooks] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showBookForm, setShowBookForm] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [bookForm, setBookForm] = useState({
    title: '', author: '', isbn: '', category: '', publisher: '', edition: '', language: '', totalCopies: 1, shelfNumber: '', description: '',
  });

  // issue form
  const [students, setStudents] = useState<any[]>([]);
  const [issueForm, setIssueForm] = useState({ bookId: '', studentId: '', dueDate: '' });

  const loadBooks = async () => {
    const { data } = await api.get('/library/books', { params: search ? { search } : {} });
    setBooks(data);
  };
  const loadIssues = async (overdue = false) => {
    const { data } = await api.get('/library/issues', { params: overdue ? { overdue: 'true' } : {} });
    setIssues(data);
  };

  useEffect(() => {
    if (tab === 'books') loadBooks();
    else loadIssues(tab === 'overdue');
  }, [tab, search]);

  useEffect(() => {
    if (showIssueForm && students.length === 0) {
      api.get('/students').then(r => setStudents(r.data));
    }
  }, [showIssueForm]);

  const submitBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/library/books', bookForm);
      setShowBookForm(false);
      setBookForm({ title: '', author: '', isbn: '', category: '', publisher: '', edition: '', language: '', totalCopies: 1, shelfNumber: '', description: '' });
      loadBooks();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add book');
    }
  };

  const removeBook = async (id: string) => {
    if (!confirm('Delete this book and all its issue records?')) return;
    await api.delete(`/library/books/${id}`);
    loadBooks();
  };

  const submitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/library/issues', issueForm);
      setShowIssueForm(false);
      setIssueForm({ bookId: '', studentId: '', dueDate: '' });
      if (tab === 'issues') loadIssues();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to issue book');
    }
  };

  const returnIssue = async (id: string) => {
    const fine = prompt('Fine amount (₹)? Leave blank for none.');
    await api.put(`/library/issues/${id}`, { action: 'RETURN', fineAmount: fine ? Number(fine) : 0 });
    loadIssues(tab === 'overdue');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Library className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Library</h1>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'books' && (
              <button onClick={() => setShowBookForm(true)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                <Plus className="h-4 w-4" /> Add Book
              </button>
            )}
            {(tab === 'issues' || tab === 'overdue') && (
              <button onClick={() => setShowIssueForm(true)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                <Plus className="h-4 w-4" /> Issue Book
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200">
          {(['books', 'issues', 'overdue'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'books' ? 'Books' : t === 'issues' ? 'All Issues' : 'Overdue'}
            </button>
          ))}
        </div>

        {tab === 'books' && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                placeholder="Search by title, author, ISBN..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
              />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Title</th>
                    <th className="text-left px-4 py-2">Author</th>
                    <th className="text-left px-4 py-2">ISBN</th>
                    <th className="text-left px-4 py-2">Category</th>
                    <th className="text-left px-4 py-2">Available</th>
                    <th className="text-left px-4 py-2">Shelf</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {books.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{b.title}</td>
                      <td className="px-4 py-2 text-slate-700">{b.author}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{b.isbn || '—'}</td>
                      <td className="px-4 py-2 text-slate-700">{b.category || '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${b.availableCopies > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {b.availableCopies}/{b.totalCopies}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{b.shelfNumber || '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => removeBook(b.id)} className="p-1 rounded hover:bg-red-50 transition">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {books.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">No books found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {(tab === 'issues' || tab === 'overdue') && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Book</th>
                  <th className="text-left px-4 py-2">Borrower</th>
                  <th className="text-left px-4 py-2">Issued</th>
                  <th className="text-left px-4 py-2">Due</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Fine</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map(i => {
                  const overdueDays = i.status === 'ISSUED' && new Date(i.dueDate) < new Date()
                    ? Math.ceil((Date.now() - new Date(i.dueDate).getTime()) / 86400000) : 0;
                  return (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{i.book.title}</td>
                      <td className="px-4 py-2 text-slate-700">
                        {i.student
                          ? `${i.student.user.firstName} ${i.student.user.lastName} (${i.student.class.name} ${i.student.section.name})`
                          : i.teacher ? `${i.teacher.user.firstName} ${i.teacher.user.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{formatDate(i.issuedDate)}</td>
                      <td className="px-4 py-2 text-slate-500">
                        {formatDate(i.dueDate)}
                        {overdueDays > 0 && <span className="ml-2 text-xs text-red-600 font-medium">({overdueDays}d late)</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[overdueDays > 0 ? 'OVERDUE' : i.status]}`}>
                          {overdueDays > 0 ? 'OVERDUE' : i.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-700">{i.fineAmount > 0 ? `₹${i.fineAmount}` : '—'}</td>
                      <td className="px-4 py-2 text-right">
                        {i.status === 'ISSUED' && (
                          <button onClick={() => returnIssue(i.id)} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition">
                            Return
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {issues.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">No issues.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {showBookForm && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <form onSubmit={submitBook} className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Add book</h2>
                <button type="button" onClick={() => setShowBookForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <input required placeholder="Title *" value={bookForm.title} onChange={e => setBookForm({ ...bookForm, title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              <input required placeholder="Author *" value={bookForm.author} onChange={e => setBookForm({ ...bookForm, author: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="ISBN" value={bookForm.isbn} onChange={e => setBookForm({ ...bookForm, isbn: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                <input placeholder="Category" value={bookForm.category} onChange={e => setBookForm({ ...bookForm, category: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                <input placeholder="Publisher" value={bookForm.publisher} onChange={e => setBookForm({ ...bookForm, publisher: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                <input placeholder="Edition" value={bookForm.edition} onChange={e => setBookForm({ ...bookForm, edition: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                <input type="number" min={1} placeholder="Total copies" value={bookForm.totalCopies} onChange={e => setBookForm({ ...bookForm, totalCopies: Number(e.target.value) })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                <input placeholder="Shelf number" value={bookForm.shelfNumber} onChange={e => setBookForm({ ...bookForm, shelfNumber: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBookForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Add book</button>
              </div>
            </form>
          </div>
        )}

        {showIssueForm && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <form onSubmit={submitIssue} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Issue book</h2>
                <button type="button" onClick={() => setShowIssueForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <select required value={issueForm.bookId} onChange={e => setIssueForm({ ...issueForm, bookId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                <option value="">Select book *</option>
                {books.filter(b => b.availableCopies > 0).map(b => <option key={b.id} value={b.id}>{b.title} — {b.author} ({b.availableCopies} left)</option>)}
              </select>
              <select required value={issueForm.studentId} onChange={e => setIssueForm({ ...issueForm, studentId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                <option value="">Select student *</option>
                {students.map((s: any) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName} ({s.class.name} {s.section.name})</option>)}
              </select>
              <input required type="date" placeholder="Due date *" value={issueForm.dueDate} onChange={e => setIssueForm({ ...issueForm, dueDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowIssueForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Issue book</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
