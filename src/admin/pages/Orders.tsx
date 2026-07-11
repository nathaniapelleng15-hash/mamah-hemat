import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Clock, CheckCircle2, ChefHat, Truck,
  XCircle, ChevronDown, ChevronUp, Phone, StickyNote,
  Calendar, RefreshCw, AlertCircle, MapPin, ExternalLink,
  Navigation, Package, User, Check, ArrowRight, Copy, CopyCheck
} from 'lucide-react';
import {
  Order, OrderStatus,
  ORDER_STATUS_CONFIG, formatIDR, formatDate, timeAgo
} from '../data';

const STATUS_FLOW: OrderStatus[] = [
  'pending',
  'preparing',
  'delivered'
];

const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  preparing: <ChefHat className="w-3.5 h-3.5" />,
  delivered: <Truck className="w-3.5 h-3.5" />,
  cancelled: <XCircle className="w-3.5 h-3.5" />,
};

const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: 'Mulai Diproses',
  preparing: 'Tandai Terkirim',
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [adminNoteInput, setAdminNoteInput] = useState<Record<number, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Ambil token admin dari localStorage untuk auth header
  const getAuthHeaders = () => {
    const token = localStorage.getItem('mh_admin_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  // Fetch pesanan asli dari database via backend
  const fetchOrders = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch('/api/orders', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Gagal memuat data pesanan dari server.');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Gagal fetch orders:', err);
      setLoadError(err.message || 'Terjadi kesalahan saat memuat pesanan.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load awal + auto-refresh tiap 15 detik supaya pesanan baru langsung kelihatan
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const filtered = filterStatus === 'all' ? orders : orders.filter(o => o.order_status === filterStatus);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.created_at.startsWith(todayStr));
  const pendingCount = orders.filter(o => o.order_status === 'pending').length;
  const activeCount = orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.order_status)).length;
  const doneCount = orders.filter(o => o.order_status === 'delivered').length;

  // Susun alamat lengkap jadi satu teks siap-copy (area + alamat detail)
  const buildFullAddress = (order: Order) => {
    const parts = [order.delivery_area_label, order.delivery_address].filter(Boolean);
    return parts.join(', ');
  };

  // Copy alamat lengkap ke clipboard, kasih feedback singkat "Tersalin"
  const copyAddress = async (order: Order, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const text = buildFullAddress(order);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(order.id);
      setTimeout(() => setCopiedId(prev => (prev === order.id ? null : prev)), 1500);
    } catch (err) {
      console.error('Gagal copy alamat:', err);
    }
  };

  // Update status pesanan ke backend, lalu sinkronkan state lokal
  const updateStatus = async (id: number, newStatus: OrderStatus) => {
    setUpdatingStatusId(id);
    // Optimistic update biar terasa responsif
    const prevOrders = orders;
    setOrders(prev => prev.map(o => o.id === id ? { ...o, order_status: newStatus } : o));

    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Gagal update status di server.');
    } catch (err) {
      console.error(err);
      setOrders(prevOrders); // rollback kalau gagal
      alert('Gagal mengubah status pesanan. Coba lagi.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Simpan catatan admin ke backend
  const saveAdminNote = async (id: number) => {
    const note = adminNoteInput[id] ?? '';
    setSavingNoteId(id);
    try {
      const res = await fetch(`/api/orders/${id}/notes`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ adminNotes: note }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan catatan.');
      setOrders(prev => prev.map(o => o.id === id ? { ...o, admin_notes: note } : o));
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan catatan admin. Coba lagi.');
    } finally {
      setSavingNoteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Pesanan Masuk</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Pantau dan kelola status pesanan pelanggan di sini</p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-[#E4C670] bg-neutral-900/60 border border-neutral-800/60 hover:border-[#E4C670]/30 px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Error state */}
      {loadError && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-400 font-semibold">{loadError}</p>
            <p className="text-xs text-neutral-500 mt-0.5">Pastikan backend & endpoint /api/orders aktif.</p>
          </div>
          <button onClick={fetchOrders} className="text-xs font-semibold text-red-400 hover:underline shrink-0">
            Coba lagi
          </button>
        </div>
      )}

      {/* Loading skeleton awal */}
      {isLoading && orders.length === 0 && !loadError && (
        <div className="text-center py-16 text-neutral-600">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
          <p>Memuat pesanan...</p>
        </div>
      )}

      {(!isLoading || orders.length > 0) && !loadError && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Pesanan Hari Ini', value: todayOrders.length, color: 'text-[#E4C670]', icon: <ClipboardList className="w-4 h-4" /> },
              { label: 'Perlu Konfirmasi', value: pendingCount, color: 'text-amber-400', icon: <Clock className="w-4 h-4" /> },
              { label: 'Sedang Diproses', value: activeCount, color: 'text-blue-400', icon: <ChefHat className="w-4 h-4" /> },
              { label: 'Terkirim', value: doneCount, color: 'text-emerald-400', icon: <Truck className="w-4 h-4" /> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="bg-neutral-900/60 border border-neutral-800/60 rounded-2xl p-4">
                <div className={`flex items-center gap-2 ${color} mb-2`}>{icon}<span className="text-xs font-medium text-neutral-400">{label}</span></div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {(['all', ...STATUS_FLOW, 'cancelled'] as (OrderStatus | 'all')[]).map(s => {
              const cfg = s === 'all' ? { label: 'Semua', color: 'text-white', bg: '' } : ORDER_STATUS_CONFIG[s];
              const isActive = filterStatus === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${isActive
                    ? s === 'all'
                      ? 'bg-[#E4C670]/10 text-[#E4C670] border-[#E4C670]/30'
                      : `${cfg.bg} ${cfg.color} border`
                    : 'bg-neutral-900/40 text-neutral-500 border-neutral-800/60 hover:border-neutral-700'
                    }`}
                >
                  {s === 'all' ? 'Semua' : ORDER_STATUS_CONFIG[s].label}
                  {s !== 'all' && (
                    <span className="ml-1.5 opacity-70">{orders.filter(o => o.order_status === s).length}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Orders Table ── */}
          <div className="bg-[#FFFDF6] border border-[#EAD9AC] rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-[#EAD9AC] text-left bg-[#FAF3E0]">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A7A54]">No. Pesanan</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A7A54]">Pelanggan</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A7A54]">Pengiriman</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A7A54]">Waktu</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A7A54]">Total</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A7A54]">Status</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A7A54] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-[#9C8F6E]">
                        <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="font-medium text-[#8A7A54]">Belum ada pesanan di sini</p>
                        <p className="text-xs mt-1">Coba ganti filter status di atas</p>
                      </td>
                    </tr>
                  )}

                  {filtered.map(order => {
                    const cfg = ORDER_STATUS_CONFIG[order.order_status];
                    const isExpanded = expandedId === order.id;
                    const flowIndex = STATUS_FLOW.indexOf(order.order_status);
                    const isCancelled = order.order_status === 'cancelled';
                    const fullAddress = buildFullAddress(order);

                    return (
                      <React.Fragment key={order.id}>
                        {/* ── Row utama: ringkasan sekilas pandang, mirip tabel referensi ── */}
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : order.id)}
                          className={`cursor-pointer border-b border-[#F0E6CC] hover:bg-[#FBF3DD] transition-colors ${order.order_status === 'pending' ? 'bg-amber-50' : ''
                            } ${isExpanded ? 'bg-[#FBF3DD]' : ''}`}
                        >
                          <td className="px-4 py-3.5 align-top">
                            <span className="font-mono font-bold text-[#2B2417] text-xs">{order.order_number}</span>
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <p className="text-[#2B2417] font-medium flex items-center gap-1.5">
                              <User className="w-3 h-3 text-[#B0A47F] shrink-0" /> {order.customer.name}
                            </p>
                            <p className="text-xs text-[#9C8F6E] mt-0.5">{order.customer.phone}</p>
                          </td>

                          <td className="px-4 py-3.5 align-top max-w-[220px]">
                            <span className="flex items-center gap-1 text-xs text-[#8A7A54]">
                              {order.delivery_method === 'pickup' ? <Package className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                              {order.delivery_method === 'pickup' ? 'Ambil Sendiri' : (order.delivery_area_label || 'Delivery')}
                            </span>
                            {order.delivery_method === 'delivery' && fullAddress && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <p className="text-xs text-[#9C8F6E] truncate">{order.delivery_address}</p>
                                <button
                                  onClick={(e) => copyAddress(order, e)}
                                  title="Salin alamat lengkap"
                                  className="shrink-0 p-1 rounded-md text-[#9C8F6E] hover:text-[#B8862B] hover:bg-[#F0E6CC] transition-colors"
                                >
                                  {copiedId === order.id
                                    ? <CopyCheck className="w-3 h-3 text-emerald-400" />
                                    : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <span className="text-xs text-[#9C8F6E] flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {timeAgo(order.created_at)}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <span className="font-bold text-[#B8862B]">{formatIDR(order.grand_total)}</span>
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
                              {STATUS_ICONS[order.order_status]} {cfg.label}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 align-top text-right">
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#9C8F6E]">
                              {isExpanded ? 'Tutup' : 'Detail'}
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                          </td>
                        </tr>

                        {/* ── Row detail: semua fitur sebelumnya tetap ada, tampil saat baris diklik ── */}
                        {isExpanded && (
                          <tr className="border-b border-gray-200 bg-white">
                            <td colSpan={7} className="p-4 space-y-4">

                              {/* Progress status */}
                              {!isCancelled && (
                                <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3.5 overflow-x-auto">
                                  <div className="flex items-center min-w-max">
                                    {STATUS_FLOW.map((s, i) => {
                                      const isDone = i < flowIndex;
                                      const isCurrent = i === flowIndex;
                                      return (
                                        <React.Fragment key={s}>
                                          <div className="flex flex-col items-center gap-1.5 w-16">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 ${isDone ? 'bg-emerald-400/15 border-emerald-400/50 text-emerald-400'
                                                : isCurrent ? `${ORDER_STATUS_CONFIG[s].bg} border-current ${ORDER_STATUS_CONFIG[s].color}`
                                                  : 'bg-gray-100 border-gray-300 text-gray-400'
                                              }`}>
                                              {isDone ? <Check className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                                            </div>
                                            <span className={`text-[10px] text-center leading-tight ${isCurrent ? 'text-gray-900 font-semibold' : isDone ? 'text-gray-500' : 'text-gray-400'
                                              }`}>
                                              {ORDER_STATUS_CONFIG[s].label}
                                            </span>
                                          </div>
                                          {i < STATUS_FLOW.length - 1 && (
                                            <div className={`h-0.5 flex-1 min-w-[16px] -mt-4 ${i < flowIndex ? 'bg-emerald-400/40' : 'bg-gray-200'}`} />
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {isCancelled && (
                                <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-3.5 py-3 flex items-center gap-2 text-red-400 text-sm font-semibold">
                                  <XCircle className="w-4 h-4" /> Pesanan ini dibatalkan
                                </div>
                              )}

                              <div className="grid md:grid-cols-2 gap-4">
                                {/* Info Pengiriman */}
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2.5">
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                    {order.delivery_method === 'delivery'
                                      ? <><Truck className="w-3.5 h-3.5" /> Info Pengiriman</>
                                      : <><Package className="w-3.5 h-3.5" /> Metode Ambil Sendiri</>
                                    }
                                  </p>

                                  {order.delivery_method === 'pickup' ? (
                                    <p className="text-sm text-gray-700">Pelanggan akan ambil sendiri di tempat.</p>
                                  ) : (
                                    <div className="space-y-2.5">
                                      {order.delivery_area_label && (
                                        <div className="flex items-start gap-2">
                                          <MapPin className="w-3.5 h-3.5 text-[#E4C670] mt-0.5 shrink-0" />
                                          <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Area Pengantaran</p>
                                            <p className="text-sm text-gray-900 font-medium">{order.delivery_area_label}</p>
                                          </div>
                                        </div>
                                      )}

                                      {order.delivery_address && (
                                        <div className="flex items-start gap-2">
                                          <Navigation className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                                          <div className="flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Alamat Lengkap</p>
                                              <button
                                                onClick={(e) => copyAddress(order, e)}
                                                className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${copiedId === order.id
                                                    ? 'text-emerald-600 border-emerald-400/40 bg-emerald-400/10'
                                                    : 'text-gray-500 border-gray-200 hover:text-[#B8862B] hover:border-[#B8862B]/40'
                                                  }`}
                                              >
                                                {copiedId === order.id
                                                  ? <><CopyCheck className="w-3 h-3" /> Tersalin</>
                                                  : <><Copy className="w-3 h-3" /> Salin</>}
                                              </button>
                                            </div>
                                            <p className="text-sm text-gray-900 mt-0.5">{order.delivery_address}</p>
                                          </div>
                                        </div>
                                      )}

                                      {order.delivery_map_link && (
                                        <div className="flex items-start gap-2">
                                          <ExternalLink className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                          <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Link Google Maps</p>
                                            <a
                                              href={order.delivery_map_link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                                            >
                                              Buka Maps <ExternalLink className="w-3 h-3" />
                                            </a>
                                          </div>
                                        </div>
                                      )}

                                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                                        <Truck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        <span className="text-xs text-gray-500">Ongkos Kirim:</span>
                                        <span className={`text-xs font-semibold ${order.delivery_fee === 0 ? 'text-emerald-400' : 'text-[#E4C670]'
                                          }`}>
                                          {order.delivery_fee === 0 ? 'Gratis' : formatIDR(order.delivery_fee)}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {(order.delivery_date || order.delivery_time) && (
                                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                                      <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                      <span className="text-xs text-gray-500">Jadwal Antar:</span>
                                      <span className="text-xs font-semibold text-gray-900">
                                        {order.delivery_date ? formatDate(order.delivery_date) : ''}
                                        {order.delivery_date && order.delivery_time ? ' · ' : ''}
                                        {order.delivery_time ?? ''}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Item Pesanan */}
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <ClipboardList className="w-3.5 h-3.5" /> Item Pesanan
                                  </p>
                                  <div className="space-y-2">
                                    {order.items.map(item => (
                                      <div key={item.id} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">{item.product_name} <span className="text-gray-500">×{item.quantity}</span></span>
                                        <span className="text-gray-500">{formatIDR(item.subtotal)}</span>
                                      </div>
                                    ))}
                                    {order.addons.map((a, i) => (
                                      <div key={i} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">+ {a.addon_name}</span>
                                        <span className="text-gray-400">{formatIDR(a.price)}</span>
                                      </div>
                                    ))}
                                    <div className="flex items-center justify-between text-sm font-bold pt-2 mt-1 border-t border-gray-200">
                                      <span className="text-gray-900">Total</span>
                                      <span className="text-[#B8862B]">{formatIDR(order.grand_total)}</span>
                                    </div>
                                  </div>

                                  {order.notes && (
                                    <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mt-3">
                                      <p className="text-xs text-amber-400 font-semibold flex items-center gap-1.5 mb-1.5">
                                        <StickyNote className="w-3.5 h-3.5" /> Catatan Pelanggan
                                      </p>
                                      <p className="text-sm text-gray-700">{order.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Catatan Admin (Internal)</p>
                                <textarea
                                  rows={2}
                                  placeholder="Tambahkan catatan internal..."
                                  value={adminNoteInput[order.id] ?? order.admin_notes}
                                  onChange={e => setAdminNoteInput(prev => ({ ...prev, [order.id]: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:border-[#B8862B]/50"
                                />
                                <button
                                  onClick={(e) => { e.stopPropagation(); saveAdminNote(order.id); }}
                                  disabled={savingNoteId === order.id}
                                  className="mt-1.5 text-xs font-semibold text-[#B8862B] hover:underline disabled:opacity-50"
                                >
                                  {savingNoteId === order.id ? 'Menyimpan...' : 'Simpan Catatan'}
                                </button>
                              </div>

                              {order.order_status !== 'cancelled' && order.order_status !== 'delivered' && (
                                <div className="space-y-2.5 pt-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {NEXT_ACTION_LABEL[order.order_status] && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); updateStatus(order.id, STATUS_FLOW[flowIndex + 1]); }}
                                        disabled={updatingStatusId === order.id}
                                        className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-[#E4C670] text-neutral-900 hover:bg-[#f0d485] transition-all disabled:opacity-50"
                                      >
                                        {updatingStatusId === order.id
                                          ? 'Memperbarui...'
                                          : <>{NEXT_ACTION_LABEL[order.order_status]} <ArrowRight className="w-3.5 h-3.5" /></>}
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'cancelled'); }}
                                      disabled={updatingStatusId === order.id}
                                      className="text-xs font-semibold px-3 py-2.5 rounded-xl border bg-red-400/10 border-red-400/20 text-red-400 hover:opacity-80 disabled:opacity-50"
                                    >
                                      Batalkan Pesanan
                                    </button>
                                  </div>

                                  {STATUS_FLOW.filter(s => s !== order.order_status && s !== STATUS_FLOW[flowIndex + 1]).length > 0 && (
                                    <details className="group" onClick={(e) => e.stopPropagation()}>
                                      <summary className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer list-none select-none inline-flex items-center gap-1">
                                        Ubah ke status lain
                                        <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                                      </summary>
                                      <div className="flex flex-wrap gap-2 mt-2.5">
                                        {STATUS_FLOW.filter(s => s !== order.order_status && s !== STATUS_FLOW[flowIndex + 1]).map(s => (
                                          <button
                                            key={s}
                                            onClick={() => updateStatus(order.id, s)}
                                            disabled={updatingStatusId === order.id}
                                            className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-50 ${ORDER_STATUS_CONFIG[s].bg} ${ORDER_STATUS_CONFIG[s].color} hover:opacity-80`}
                                          >
                                            Set ke {ORDER_STATUS_CONFIG[s].label}
                                          </button>
                                        ))}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              )}

                              <a
                                href={`https://wa.me/${order.customer.phone.replace(/^0/, '62')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-400 bg-emerald-400/5 border border-emerald-400/20 hover:bg-emerald-400/10 transition-all rounded-xl py-2.5"
                              >
                                <Phone className="w-4 h-4" />
                                Hubungi via WhatsApp
                              </a>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}
    </div>
  );
}

