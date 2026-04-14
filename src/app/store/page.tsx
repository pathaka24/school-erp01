'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Plus, Trash2, ShoppingCart, Package, AlertTriangle,
  Search, X, Minus,
} from 'lucide-react';

const CATEGORIES = ['BOOKS', 'UNIFORM', 'STATIONERY', 'SPORTS', 'LAB_EQUIPMENT', 'ART_SUPPLIES', 'TECH_ACCESSORIES', 'OTHER'];
const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'ACCOUNT'];
const BUYER_TYPES = ['STUDENT', 'STAFF', 'WALK_IN'];

const catColors: Record<string, string> = {
  BOOKS: 'bg-blue-100 text-blue-700',
  UNIFORM: 'bg-purple-100 text-purple-700',
  STATIONERY: 'bg-green-100 text-green-700',
  SPORTS: 'bg-orange-100 text-orange-700',
  LAB_EQUIPMENT: 'bg-teal-100 text-teal-700',
  ART_SUPPLIES: 'bg-pink-100 text-pink-700',
  TECH_ACCESSORIES: 'bg-cyan-100 text-cyan-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

export default function StorePage() {
  const [tab, setTab] = useState<'inventory' | 'sell' | 'orders'>('inventory');
  const [items, setItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [catFilter, setCatFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Add item form
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState({
    name: '', category: 'BOOKS', description: '', price: '', stock: '', minStock: '5', unit: 'pcs', supplier: '',
  });

  // Cart for selling
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleForm, setSaleForm] = useState({
    buyerType: 'STUDENT', studentId: '', buyerName: '', discount: '0', paymentMethod: 'CASH', notes: '',
  });

  // Stock edit
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [stockValue, setStockValue] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/store/items').then(r => setItems(r.data)),
      api.get('/store/orders').then(r => setOrders(r.data)),
      api.get('/store/summary').then(r => setSummary(r.data)),
      api.get('/students').then(r => setStudents(r.data)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  const refreshData = async () => {
    const [itemsR, ordersR, sumR] = await Promise.all([
      api.get('/store/items', { params: { ...(catFilter && { category: catFilter }), ...(searchFilter && { search: searchFilter }) } }),
      api.get('/store/orders'),
      api.get('/store/summary'),
    ]);
    setItems(itemsR.data);
    setOrders(ordersR.data);
    setSummary(sumR.data);
  };

  useEffect(() => {
    if (!loading) {
      api.get('/store/items', { params: { ...(catFilter && { category: catFilter }), ...(searchFilter && { search: searchFilter }) } })
        .then(r => setItems(r.data));
    }
  }, [catFilter, searchFilter]);

  // Inventory actions
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/store/items', itemForm);
      setShowItemForm(false);
      setItemForm({ name: '', category: 'BOOKS', description: '', price: '', stock: '', minStock: '5', unit: 'pcs', supplier: '' });
      refreshData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed');
    }
  };

  const handleUpdateStock = async (id: string) => {
    await api.put(`/store/items/${id}`, { stock: stockValue });
    setEditingStock(null);
    refreshData();
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    await api.delete(`/store/items/${id}`);
    refreshData();
  };

  // Cart actions
  const addToCart = (item: any) => {
    const existing = cart.find(c => c.itemId === item.id);
    if (existing) {
      if (existing.quantity >= item.stock) return alert('Not enough stock');
      setCart(cart.map(c => c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      if (item.stock < 1) return alert('Out of stock');
      setCart([...cart, { itemId: item.id, name: item.name, price: item.price, quantity: 1, stock: item.stock }]);
    }
  };

  const updateCartQty = (itemId: string, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter(c => c.itemId !== itemId));
    } else {
      setCart(cart.map(c => c.itemId === itemId ? { ...c, quantity: Math.min(qty, c.stock) } : c));
    }
  };

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartDiscount = parseFloat(saleForm.discount) || 0;
  const cartNet = cartTotal - cartDiscount;

  const handleSale = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    try {
      await api.post('/store/orders', {
        studentId: saleForm.buyerType === 'STUDENT' ? saleForm.studentId : null,
        buyerName: saleForm.buyerType !== 'STUDENT' ? saleForm.buyerName : null,
        buyerType: saleForm.buyerType,
        items: cart.map(c => ({ itemId: c.itemId, quantity: c.quantity })),
        discount: saleForm.discount,
        paymentMethod: saleForm.paymentMethod,
        notes: saleForm.notes,
      });
      setCart([]);
      setSaleForm({ buyerType: 'STUDENT', studentId: '', buyerName: '', discount: '0', paymentMethod: 'CASH', notes: '' });
      refreshData();
      alert('Sale completed!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to process sale');
    }
  };

  const cancelOrder = async (id: string) => {
    if (!confirm('Cancel this order? Stock will be restored.')) return;
    await api.put(`/store/orders/${id}`, { status: 'CANCELLED' });
    refreshData();
  };

  const lowStockItems = items.filter(i => i.stock <= i.minStock && i.stock > 0);
  const outOfStockItems = items.filter(i => i.stock === 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">School Store</h1>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Total Items</p>
                <p className="text-xl font-bold text-slate-900">{summary?.totalItems || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Stock Value</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(summary?.totalStockValue || 0)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Total Sales</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(summary?.totalSales || 0)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Orders</p>
                <p className="text-xl font-bold text-slate-900">{summary?.totalOrders || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Low Stock</p>
                <p className="text-xl font-bold text-orange-600">{summary?.lowStockItems || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Out of Stock</p>
                <p className="text-xl font-bold text-red-600">{summary?.outOfStock || 0}</p>
              </div>
            </div>

            {/* Low stock alert */}
            {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  {outOfStockItems.length > 0 && (
                    <p className="text-red-700 font-medium">Out of stock: {outOfStockItems.map(i => i.name).join(', ')}</p>
                  )}
                  {lowStockItems.length > 0 && (
                    <p className="text-amber-700">Low stock: {lowStockItems.map(i => `${i.name} (${i.stock} left)`).join(', ')}</p>
                  )}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
              {[
                { id: 'inventory', label: 'Inventory' },
                { id: 'sell', label: 'New Sale' },
                { id: 'orders', label: 'Sales History' },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id as any)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >{t.label}</button>
              ))}
            </div>

            {/* INVENTORY TAB */}
            {tab === 'inventory' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-3 flex-1">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input placeholder="Search items..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      <option value="">All Categories</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setShowItemForm(!showItemForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                    <Plus className="h-4 w-4" /> Add Item
                  </button>
                </div>

                {showItemForm && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">Add Store Item</h2>
                    <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <input placeholder="Item Name *" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      <select value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                      </select>
                      <input placeholder="Price (₹) *" type="number" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      <input placeholder="Stock *" type="number" value={itemForm.stock} onChange={e => setItemForm({ ...itemForm, stock: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" required />
                      <input placeholder="Min Stock Alert" type="number" value={itemForm.minStock} onChange={e => setItemForm({ ...itemForm, minStock: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <input placeholder="Unit (pcs, sets, kg)" value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <input placeholder="Supplier" value={itemForm.supplier} onChange={e => setItemForm({ ...itemForm, supplier: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <input placeholder="Description" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                      <div className="flex gap-2">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Add</button>
                        <button type="button" onClick={() => setShowItemForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Item</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Category</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Price</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-slate-500">Stock</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Supplier</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No items</td></tr>
                      ) : items.map(item => (
                        <tr key={item.id} className={`hover:bg-slate-50 ${item.stock === 0 ? 'bg-red-50' : item.stock <= item.minStock ? 'bg-amber-50' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="text-sm text-slate-900 font-medium">{item.name}</p>
                            {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${catColors[item.category] || 'bg-slate-100'}`}>
                              {item.category.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900 font-semibold text-right">{formatCurrency(item.price)}</td>
                          <td className="px-4 py-3 text-center">
                            {editingStock === item.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <input type="number" value={stockValue} onChange={e => setStockValue(e.target.value)}
                                  className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center text-slate-900" autoFocus />
                                <button onClick={() => handleUpdateStock(item.id)} className="text-green-600 text-xs font-medium">Save</button>
                                <button onClick={() => setEditingStock(null)} className="text-slate-400 text-xs">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingStock(item.id); setStockValue(String(item.stock)); }}
                                className={`text-sm font-medium ${item.stock === 0 ? 'text-red-600' : item.stock <= item.minStock ? 'text-orange-600' : 'text-slate-900'}`}>
                                {item.stock} {item.unit}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">{item.supplier || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SELL TAB */}
            {tab === 'sell' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Items grid */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input placeholder="Search items..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                    <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      <option value="">All</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {items.filter(i => i.isActive).map(item => (
                      <button key={item.id} onClick={() => addToCart(item)} disabled={item.stock === 0}
                        className={`text-left p-4 rounded-xl border transition ${item.stock === 0 ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-sm'}`}>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${catColors[item.category] || 'bg-slate-100'}`}>{item.category.replace('_', ' ')}</span>
                        <p className="text-sm font-medium text-slate-900 mt-2">{item.name}</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm font-bold text-slate-900">{formatCurrency(item.price)}</span>
                          <span className={`text-xs ${item.stock === 0 ? 'text-red-500' : item.stock <= item.minStock ? 'text-orange-500' : 'text-slate-400'}`}>{item.stock} left</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cart */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 h-fit sticky top-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <ShoppingCart className="h-5 w-5 text-blue-600" /> Cart
                    {cart.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{cart.length}</span>}
                  </h2>

                  {cart.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">Click items to add</p>
                  ) : (
                    <div className="space-y-3 mb-4">
                      {cart.map(c => (
                        <div key={c.itemId} className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-900 font-medium truncate">{c.name}</p>
                            <p className="text-xs text-slate-400">{formatCurrency(c.price)} each</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateCartQty(c.itemId, c.quantity - 1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-sm font-medium w-6 text-center">{c.quantity}</span>
                            <button onClick={() => updateCartQty(c.itemId, c.quantity + 1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                              <Plus className="h-3 w-3" />
                            </button>
                            <span className="text-sm font-semibold w-16 text-right">{formatCurrency(c.price * c.quantity)}</span>
                            <button onClick={() => updateCartQty(c.itemId, 0)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Buyer info */}
                  <div className="space-y-3 border-t border-slate-200 pt-4">
                    <select value={saleForm.buyerType} onChange={e => setSaleForm({ ...saleForm, buyerType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                      {BUYER_TYPES.map(b => <option key={b} value={b}>{b.replace('_', ' ')}</option>)}
                    </select>
                    {saleForm.buyerType === 'STUDENT' ? (
                      <select value={saleForm.studentId} onChange={e => setSaleForm({ ...saleForm, studentId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        <option value="">Select Student</option>
                        {students.map((s: any) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName} ({s.admissionNo})</option>)}
                      </select>
                    ) : (
                      <input placeholder="Buyer Name" value={saleForm.buyerName} onChange={e => setSaleForm({ ...saleForm, buyerName: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <select value={saleForm.paymentMethod} onChange={e => setSaleForm({ ...saleForm, paymentMethod: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input placeholder="Discount (₹)" type="number" value={saleForm.discount} onChange={e => setSaleForm({ ...saleForm, discount: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="border-t border-slate-200 pt-4 mt-4 space-y-1">
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Subtotal</span><span>{formatCurrency(cartTotal)}</span>
                    </div>
                    {cartDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span><span>-{formatCurrency(cartDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold text-slate-900 pt-1">
                      <span>Total</span><span>{formatCurrency(cartNet)}</span>
                    </div>
                  </div>

                  <button onClick={handleSale} disabled={cart.length === 0}
                    className="w-full mt-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    Complete Sale
                  </button>
                </div>
              </div>
            )}

            {/* ORDERS TAB */}
            {tab === 'orders' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Order #</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Buyer</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Items</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-slate-500">Amount</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Payment</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Status</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-500"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No orders yet</td></tr>
                    ) : orders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-blue-600 font-mono">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                          {order.student ? `${order.student.user.firstName} ${order.student.user.lastName}` : order.buyerName || '-'}
                          <span className="text-xs text-slate-400 ml-1">({order.buyerType})</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {order.items?.map((i: any) => `${i.item.name} x${i.quantity}`).join(', ')}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                          {formatCurrency(order.netAmount)}
                          {order.discount > 0 && <span className="text-xs text-green-600 block">(-{formatCurrency(order.discount)})</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{order.paymentMethod || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                            order.status === 'REFUNDED' ? 'bg-purple-100 text-purple-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{order.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {order.status === 'COMPLETED' && (
                            <button onClick={() => cancelOrder(order.id)} className="text-xs text-red-500 hover:text-red-700">Cancel</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
