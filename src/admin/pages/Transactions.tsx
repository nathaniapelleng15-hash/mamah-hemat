import { useState, useEffect, useCallback, useMemo } from 'react';
import { CreditCard, TrendingUp, Clock, CheckCircle2, XCircle, RefreshCw, AlertCircle, Calendar, X } from 'lucide-react';
import {
  Transaction, PaymentStatus,
  PAYMENT_STATUS_CONFIG, PAYMENT_METHOD_LABELS,
  formatIDR, formatDateTime
} from '../data';

type DatePreset = 'today' | '7days' | 'month' | 'all' | 'custom';

function toLocalDateStr(date: Date) {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

function getPresetRange(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date();
  const todayStr = toLocalDateStr(now);
  if (preset === 'today') return { from: todayStr, to: todayStr };
  if (preset === '7days') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: toLocalDateStr(d), to: todayStr };
  }
  if (preset === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toLocalDateStr(d), to: todayStr };
  }
  return null;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'all'>('all');

  // ── Date filter state ──
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('mh_admin_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  // Ambil data transaksi asli dari database via backend
  const fetchTransactions = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch('/api/transactions', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Gagal memuat data transaksi dari server.');
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err: any) {
      console.error('Gagal fetch transactions:', err);
      setLoadError(err.message || 'Terjadi kesalahan saat memuat transaksi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load awal + auto-refresh tiap 15 detik biar transaksi baru langsung kelihatan
  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 15000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  // Terapkan preset → update dateFrom & dateTo
  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const range = getPresetRange(preset);
    if (range) {
      setDateFrom(range.from);
      setDateTo(range.to);
    } else {
      setDateFrom('');
      setDateTo('');
    }
  };

  // Ketika user ubah input manual → preset jadi 'custom'
  const handleManualDate = (field: 'from' | 'to', val: string) => {
    setDatePreset('all'); // reset preset label
    if (field === 'from') setDateFrom(val);
    else setDateTo(val);
  };

  const clearDateFilter = () => {
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
  };

  // Filter transaksi berdasarkan tanggal & status
  const dateFiltered = useMemo(() => {
    return transactions.filter(t => {
      const txDate = t.created_at.slice(0, 10); // YYYY-MM-DD
      if (dateFrom && txDate < dateFrom) return false;
      if (dateTo && txDate > dateTo) return false;
      return true;
    });
  }, [transactions, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    return filterStatus === 'all'
      ? dateFiltered
      : dateFiltered.filter(t => t.payment_status === filterStatus);
  }, [dateFiltered, filterStatus]);

  // Stats dihitung dari dateFiltered (ikut filter tanggal)
  const totalRevenue = dateFiltered.filter(t => t.payment_status === 'paid').reduce((s, t) => s + (t.amount_paid ?? 0), 0);
  const pendingAmount = dateFiltered.filter(t => t.payment_status === 'pending').reduce((s, t) => s + t.amount, 0);
  const paidCount = dateFiltered.filter(t => t.payment_status === 'paid').length;
  const failedCount = dateFiltered.filter(t => t.payment_status === 'failed').length;

  const isDateActive = dateFrom !== '' || dateTo !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Daftar Transaksi</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Riwayat pembayaran dan status transaksi</p>
        </div>
        <button
          onClick={fetchTransactions}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-[#E4C670] bg-neutral-900/60 border border-neutral-800/60 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error state */}
      {loadError && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-400 font-semibold">{loadError}</p>
            <p className="text-xs text-neutral-500 mt-0.5">Pastikan backend & endpoint /api/transactions aktif.</p>
          </div>
          <button onClick={fetchTransactions} className="text-xs font-semibold text-red-400 hover:underline shrink-0">
            Coba lagi
          </button>
        </div>
      )}

      {/* Loading skeleton awal */}
      {isLoading && transactions.length === 0 && !loadError && (
        <div className="text-center py-16 text-neutral-600">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
          <p>Memuat transaksi...</p>
        </div>
      )}

      {(!isLoading || transactions.length > 0) && !loadError && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Pendapatan', value: formatIDR(totalRevenue), color: 'text-[#E4C670]', icon: <TrendingUp className="w-4 h-4" /> },
              { label: 'Menunggu Pembayaran', value: formatIDR(pendingAmount), color: 'text-amber-400', icon: <Clock className="w-4 h-4" /> },
              { label: 'Transaksi Lunas', value: String(paidCount), color: 'text-emerald-400', icon: <CheckCircle2 className="w-4 h-4" /> },
              { label: 'Transaksi Gagal', value: String(failedCount), color: 'text-red-400', icon: <XCircle className="w-4 h-4" /> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="bg-neutral-900/60 border border-neutral-800/60 rounded-2xl p-4">
                <div className={`flex items-center gap-2 ${color} mb-2`}>{icon}<span className="text-xs font-medium">{label}</span></div>
                <p className={`text-xl font-bold ${color} break-words`}>{value}</p>
                {isDateActive && <p className="text-[10px] text-neutral-600 mt-1">periode ini</p>}
              </div>
            ))}
          </div>

          {/* ── Date Filter: compact inline row ── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Dropdown preset */}
            <div className="relative">
              <select
                value={datePreset}
                onChange={e => applyPreset(e.target.value as DatePreset)}
                className="appearance-none bg-neutral-900/70 border border-neutral-700/70 text-neutral-300 text-xs font-medium rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-[#E4C670]/50 transition-colors cursor-pointer"
              >
                <option value="all">Semua Waktu</option>
                <option value="today">Hari Ini</option>
                <option value="7days">7 Hari Terakhir</option>
                <option value="month">Bulan Ini</option>
                {datePreset === 'custom' && <option value="custom">Kustom</option>}
              </select>
              <Calendar className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            </div>

            {/* Date inputs */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={e => handleManualDate('from', e.target.value)}
                className="bg-neutral-900/70 border border-neutral-700/70 text-neutral-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#E4C670]/50 transition-colors w-[130px]"
              />
              <span className="text-neutral-600 text-xs">—</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={e => handleManualDate('to', e.target.value)}
                className="bg-neutral-900/70 border border-neutral-700/70 text-neutral-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#E4C670]/50 transition-colors w-[130px]"
              />
            </div>

            {/* Clear */}
            {isDateActive && (
              <button
                onClick={clearDateFilter}
                title="Hapus filter tanggal"
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-red-400 border border-neutral-700/60 hover:border-red-500/40 bg-neutral-900/60 px-2.5 py-2 rounded-xl transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {isDateActive && (
              <span className="text-xs text-neutral-600">{dateFiltered.length} transaksi</span>
            )}
          </div>

          {/* Filter Status */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'processing', 'paid', 'failed', 'refunded'] as (PaymentStatus | 'all')[]).map(s => {
              const cfg = s === 'all' ? { label: 'Semua', color: 'text-white', bg: '' } : PAYMENT_STATUS_CONFIG[s];
              const isActive = filterStatus === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${isActive
                      ? s === 'all'
                        ? 'bg-[#E4C670]/10 text-[#E4C670] border-[#E4C670]/30'
                        : `${cfg.bg} ${cfg.color} border`
                      : 'bg-neutral-900/40 text-neutral-500 border-neutral-800/60 hover:border-neutral-700'
                    }`}
                >
                  {s === 'all' ? 'Semua' : PAYMENT_STATUS_CONFIG[s].label}
                  {s !== 'all' && (
                    <span className="ml-1.5 opacity-70">{dateFiltered.filter(t => t.payment_status === s).length}</span>
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Table */}
          <div className="bg-[#FFFDF6] border border-[#EAD9AC] rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#EAD9AC] bg-[#FAF3E0]">
                    {['No. Transaksi', 'Pesanan', 'Pelanggan', 'Metode', 'Jumlah', 'Status', 'Waktu'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-[#8A7A54] uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E6CC]">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-[#9C8F6E]">
                        <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p>Tidak ada transaksi ditemukan</p>
                      </td>
                    </tr>
                  )}
                  {filtered.map(txn => {
                    const cfg = PAYMENT_STATUS_CONFIG[txn.payment_status];
                    return (
                      <tr key={txn.id} className="hover:bg-[#FBF3DD] transition-all">
                        <td className="px-4 py-3 font-mono text-xs text-[#3D3226] whitespace-nowrap">
                          {txn.transaction_number}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#B8862B] whitespace-nowrap">
                          {txn.order_number}
                        </td>
                        <td className="px-4 py-3 text-[#3D3226] whitespace-nowrap">
                          {txn.customer_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs bg-[#F0E6CC] text-[#8A7A54] px-2 py-1 rounded-lg">
                            {PAYMENT_METHOD_LABELS[txn.payment_method]}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <p className="text-[#2B2417] font-semibold">{formatIDR(txn.amount)}</p>
                            {txn.amount_paid && txn.amount_paid !== txn.amount && (
                              <p className="text-xs text-[#9C8F6E]">Diterima: {formatIDR(txn.amount_paid)}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#9C8F6E] whitespace-nowrap">
                          <div>{formatDateTime(txn.created_at)}</div>
                          {txn.paid_at && (
                            <div className="text-emerald-600 mt-0.5">Lunas: {formatDateTime(txn.paid_at)}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary footer */}
          <div className="flex flex-wrap gap-4 text-xs text-neutral-600 pt-1">
            <span>Total semua: {transactions.length} transaksi</span>
            {isDateActive && <><span>·</span><span className="text-[#E4C670]/70">Periode ini: {dateFiltered.length}</span></>}
            <span>·</span>
            <span>Ditampilkan: {filtered.length}</span>
          </div>
        </>
      )}
    </div>
  );
}