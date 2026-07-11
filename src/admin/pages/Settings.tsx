import { useState, useEffect, useCallback } from 'react';
import {
  Shield, History, CheckCircle2, AlertCircle, Delete,
  MapPin, Plus, Pencil, Trash2, Check, X, Eye, EyeOff,
  RefreshCw, Truck
} from 'lucide-react';
import { hashPin, getStoredPin, savePin } from '../pinUtils';
import { formatIDR } from '../data';

// ── Type ──────────────────────────────────────────────────
interface DeliveryArea {
  id: number;
  label: string;
  fee: number;
  is_active: number; // 1 | 0
  sort_order: number;
}

// ── Helper ────────────────────────────────────────────────
const getAuthHeaders = () => {
  const token = localStorage.getItem('mh_admin_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// ── Sub-component: Section Area Pengantaran & Ongkir ─────
function DeliveryAreasSection() {
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form tambah area baru
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newFee, setNewFee] = useState('0');
  const [newSortOrder, setNewSortOrder] = useState('');
  const [addError, setAddError] = useState('');

  // Edit inline state: { [id]: { label, fee } }
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editFee, setEditFee] = useState('');
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchAreas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/delivery-areas', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Gagal memuat data area.');
      const data = await res.json();
      setAreas(data.areas || []);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAreas(); }, [fetchAreas]);

  // ── Tambah area ────────────────────────────────────────
  const handleAdd = async () => {
    if (!newLabel.trim()) { setAddError('Nama area wajib diisi.'); return; }
    const fee = parseFloat(newFee);
    if (isNaN(fee) || fee < 0) { setAddError('Ongkir harus angka >= 0.'); return; }
    setSaving(true);
    setAddError('');
    try {
      const res = await fetch('/api/delivery-areas', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ label: newLabel.trim(), fee, sort_order: parseInt(newSortOrder) || areas.length + 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan area.');
      setAreas(prev => [...prev, data.area]);
      setNewLabel(''); setNewFee('0'); setNewSortOrder(''); setShowAddForm(false);
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit inline — mulai edit ───────────────────────────
  const startEdit = (area: DeliveryArea) => {
    setEditingId(area.id);
    setEditLabel(area.label);
    setEditFee(area.fee.toString());
  };

  // ── Edit inline — simpan ───────────────────────────────
  const saveEdit = async (id: number) => {
    if (!editLabel.trim()) return;
    const fee = parseFloat(editFee);
    if (isNaN(fee) || fee < 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/delivery-areas/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ label: editLabel.trim(), fee }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
      setAreas(prev => prev.map(a => a.id === id ? data.area : a));
      setEditingId(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle aktif / nonaktif ────────────────────────────
  const toggleArea = async (id: number) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/delivery-areas/${id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal toggle.');
      setAreas(prev => prev.map(a => a.id === id ? { ...a, is_active: data.is_active } : a));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Hapus area ─────────────────────────────────────────
  const deleteArea = async (id: number, label: string) => {
    if (!confirm(`Hapus area "${label}"? Pesanan lama tidak terpengaruh.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/delivery-areas/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus.');
      setAreas(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-2xl overflow-hidden">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-5 py-4 border-b border-neutral-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Area Pengantaran & Ongkir</p>
            <p className="text-xs text-neutral-500">Kelola daftar area dan biaya pengiriman katalog</p>
          </div>
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <button
            onClick={fetchAreas}
            disabled={loading}
            className="flex-1 sm:flex-none flex justify-center items-center p-2 rounded-xl bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setShowAddForm(v => !v); setAddError(''); }}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#E4C670]/10 text-[#E4C670] border border-[#E4C670]/20 hover:bg-[#E4C670]/15 px-3 py-1.5 rounded-xl transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Area
          </button>
        </div>
      </div>

      {/* Form tambah area baru */}
      {showAddForm && (
        <div className="px-5 py-4 border-b border-neutral-800/40 bg-neutral-800/20">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Area Baru</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Nama area (mis. Sepatan City)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="flex-1 bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-[#E4C670]/40"
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">Rp</span>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={newFee}
                onChange={e => setNewFee(e.target.value)}
                className="w-full sm:w-36 bg-neutral-800/60 border border-neutral-700/60 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-[#E4C670]/40"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-[#E4C670] text-black px-4 py-2 rounded-xl hover:bg-[#E4C670]/90 disabled:opacity-50 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              Simpan
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddError(''); }}
              className="flex items-center justify-center p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {addError && <p className="text-xs text-red-400 mt-2">{addError}</p>}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="px-5 py-3 bg-red-500/5 border-b border-red-500/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 text-neutral-600">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Memuat data...</span>
        </div>
      )}

      {/* Tabel area */}
      {!loading && (
        <>
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-3 px-5 py-2 text-[10px] font-semibold text-neutral-600 uppercase tracking-wider border-b border-neutral-800/40">
            <span>Nama Area</span>
            <span className="text-right w-24">Ongkir</span>
            <span className="text-center w-16">Status</span>
            <span className="text-center w-20">Aksi</span>
          </div>

          <div className="divide-y divide-neutral-800/40">
            {areas.length === 0 && (
              <p className="text-center text-sm text-neutral-600 py-10">
                Belum ada area pengantaran. Klik "Tambah Area" untuk mulai.
              </p>
            )}
            {areas.map(area => (
              <div
                key={area.id}
                className={`grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-5 py-3 transition-colors ${!area.is_active ? 'opacity-50' : 'hover:bg-white/[0.02]'
                  }`}
              >
                {/* Nama area — edit inline jika sedang diedit */}
                <div className="flex items-center gap-2 min-w-0">
                  <Truck className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                  {editingId === area.id ? (
                    <input
                      autoFocus
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className="flex-1 bg-neutral-800/60 border border-[#E4C670]/40 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none"
                    />
                  ) : (
                    <span className="text-sm text-neutral-200 truncate">{area.label}</span>
                  )}
                </div>

                {/* Ongkir — edit inline */}
                <div className="flex items-center justify-end gap-1 w-24">
                  {editingId === area.id ? (
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">Rp</span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={editFee}
                        onChange={e => setEditFee(e.target.value)}
                        className="w-24 bg-neutral-800/60 border border-[#E4C670]/40 rounded-lg pl-6 pr-2 py-1 text-sm text-white focus:outline-none"
                      />
                    </div>
                  ) : (
                    <span className={`text-sm font-semibold ${area.fee === 0 ? 'text-emerald-400' : 'text-[#E4C670]'}`}>
                      {area.fee === 0 ? 'Gratis' : formatIDR(area.fee)}
                    </span>
                  )}
                </div>

                {/* Status toggle */}
                <div className="flex justify-center w-16">
                  <button
                    onClick={() => toggleArea(area.id)}
                    disabled={togglingId === area.id}
                    title={area.is_active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all disabled:opacity-40 ${area.is_active
                        ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/20'
                        : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:bg-emerald-400/10 hover:text-emerald-400 hover:border-emerald-400/20'
                      }`}
                  >
                    {togglingId === area.id
                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                      : area.is_active
                        ? <><Eye className="w-3 h-3" /> Aktif</>
                        : <><EyeOff className="w-3 h-3" /> Nonaktif</>
                    }
                  </button>
                </div>

                {/* Tombol Aksi */}
                <div className="flex items-center justify-center gap-1 w-20">
                  {editingId === area.id ? (
                    <>
                      {/* Simpan edit */}
                      <button
                        onClick={() => saveEdit(area.id)}
                        disabled={saving}
                        className="p-1.5 rounded-lg bg-[#E4C670]/10 text-[#E4C670] border border-[#E4C670]/20 hover:bg-[#E4C670]/20 transition-all disabled:opacity-50"
                        title="Simpan"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      {/* Batal edit */}
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-all"
                        title="Batal"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Edit */}
                      <button
                        onClick={() => startEdit(area)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-[#E4C670] hover:bg-[#E4C670]/10 transition-all"
                        title="Edit nama & ongkir"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* Hapus */}
                      <button
                        onClick={() => deleteArea(area.id, area.label)}
                        disabled={deletingId === area.id}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40"
                        title="Hapus area"
                      >
                        {deletingId === area.id
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer info */}
          {areas.length > 0 && (
            <div className="px-5 py-3 border-t border-neutral-800/40 bg-neutral-800/10">
              <p className="text-[10px] text-neutral-600">
                {areas.filter(a => a.is_active).length} area aktif · {areas.filter(a => !a.is_active).length} nonaktif · Total {areas.length} area
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ── Log interface ─────────────────────────────────────────
interface LogEntry {
  type: string;
  timestamp: string;
  description: string;
}

export default function Settings() {
  // ---- State PIN Changer ----
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ---- Logs ----
  const logs: LogEntry[] = JSON.parse(localStorage.getItem('mh_admin_logs') || '[]');

  const activePin = step === 'current' ? currentPin : step === 'new' ? newPin : confirmPin;

  const getTitle = () => {
    if (step === 'current') return 'Masukkan PIN Lama';
    if (step === 'new') return 'Masukkan PIN Baru (6 digit)';
    return 'Konfirmasi PIN Baru';
  };

  const handleNumber = (num: string) => {
    const setter = step === 'current' ? setCurrentPin : step === 'new' ? setNewPin : setConfirmPin;
    const current = step === 'current' ? currentPin : step === 'new' ? newPin : confirmPin;
    if (current.length >= 6) return;
    const next = current + num;
    setter(next);

    if (next.length === 6) {
      setTimeout(() => handleComplete(next), 150);
    }
  };

  const handleDelete = () => {
    if (step === 'current') setCurrentPin(p => p.slice(0, -1));
    else if (step === 'new') setNewPin(p => p.slice(0, -1));
    else setConfirmPin(p => p.slice(0, -1));
    setMessage(null);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  };

  const handleComplete = (pin: string) => {
    if (step === 'current') {
      // Verifikasi PIN lama
      if (hashPin(pin) !== getStoredPin()) {
        triggerShake();
        setMessage({ type: 'error', text: 'PIN lama tidak sesuai' });
        setCurrentPin('');
      } else {
        setStep('new');
        setMessage(null);
      }
    } else if (step === 'new') {
      if (pin.length < 6) return;
      setStep('confirm');
      setMessage(null);
    } else {
      // Konfirmasi PIN baru
      if (pin !== newPin) {
        triggerShake();
        setMessage({ type: 'error', text: 'Konfirmasi PIN tidak cocok' });
        setConfirmPin('');
      } else {
        // Simpan PIN baru
        savePin(pin);

        // Log aktivitas
        const logs: LogEntry[] = JSON.parse(localStorage.getItem('mh_admin_logs') || '[]');
        logs.unshift({
          type: 'pin_change',
          timestamp: new Date().toISOString(),
          description: 'PIN admin berhasil diubah',
        });
        localStorage.setItem('mh_admin_logs', JSON.stringify(logs.slice(0, 100)));

        setMessage({ type: 'success', text: 'PIN berhasil diubah! Gunakan PIN baru saat login berikutnya.' });
        // Reset form
        setStep('current');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      }
    }
  };

  const handleReset = () => {
    setStep('current');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setMessage(null);
  };

  const pinDots = activePin;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  const formatLogTime = (ts: string) =>
    new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const LOG_ICONS: Record<string, string> = {
    login: '🔐',
    logout: '🚪',
    pin_change: '🔑',
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Pengaturan</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Keamanan akun, area pengantaran, dan riwayat aktivitas</p>
      </div>

      {/* ── Section: Area Pengantaran & Ongkir ── */}
      <DeliveryAreasSection />

      {/* PIN Change Card */}
      <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-800/60">
          <div className="w-8 h-8 rounded-xl bg-[#E4C670]/10 border border-[#E4C670]/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#E4C670]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Ubah PIN Admin</p>
            <p className="text-xs text-neutral-500">PIN 6 digit untuk keamanan login</p>
          </div>
        </div>

        <div className="p-5">
          {/* Status message */}
          {message && (
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl mb-5 text-sm ${message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
              {message.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <AlertCircle className="w-4 h-4 shrink-0" />
              }
              {message.text}
            </div>
          )}

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-5">
            {(['current', 'new', 'confirm'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${step === s
                    ? 'bg-[#E4C670]/20 border-[#E4C670]/40 text-[#E4C670]'
                    : (step === 'new' && s === 'current') || (step === 'confirm' && s !== 'confirm')
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-600'
                  }`}>
                  {(step === 'new' && s === 'current') || (step === 'confirm' && s !== 'confirm') ? '✓' : i + 1}
                </div>
                {i < 2 && <div className={`h-px w-6 ${step !== 'current' && i === 0 ? 'bg-emerald-500/30' : 'bg-neutral-800'}`} />}
              </div>
            ))}
            <span className="text-xs text-neutral-500 ml-1">{getTitle()}</span>
          </div>

          {/* PIN Dots */}
          <div className={`flex justify-center gap-4 mb-6 ${shake ? 'animate-shake' : ''}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${i < pinDots.length ? 'bg-[#E4C670] border-[#E4C670] scale-110' : 'bg-transparent border-neutral-700'
                }`} />
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2.5">
            {keys.map((key, i) => {
              if (key === '') return <div key={i} />;
              if (key === 'del') return (
                <button key={i} onClick={handleDelete}
                  className="h-14 rounded-xl bg-neutral-800/60 border border-neutral-700/50 text-neutral-400 flex items-center justify-center hover:bg-neutral-700/60 hover:text-white active:scale-95 transition-all">
                  <Delete className="w-4.5 h-4.5" />
                </button>
              );
              return (
                <button key={i} onClick={() => handleNumber(key)}
                  className="h-14 rounded-xl bg-neutral-800/60 border border-neutral-700/50 text-white text-lg font-semibold hover:bg-neutral-700/60 hover:border-[#E4C670]/30 active:scale-95 active:bg-[#E4C670]/10 transition-all">
                  {key}
                </button>
              );
            })}
          </div>

          {step !== 'current' && (
            <button onClick={handleReset} className="mt-4 w-full text-xs text-neutral-600 hover:text-neutral-400 transition-all">
              ← Mulai ulang
            </button>
          )}
        </div>
      </div>

      {/* Activity Log Card */}
      <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-800/60">
          <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-neutral-700/60 flex items-center justify-center">
            <History className="w-4 h-4 text-neutral-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Riwayat Aktivitas</p>
            <p className="text-xs text-neutral-500">Log login, logout, dan perubahan PIN</p>
          </div>
        </div>

        <div className="divide-y divide-neutral-800/40">
          {logs.length === 0 && (
            <p className="text-center text-neutral-600 text-sm py-8">Belum ada aktivitas tercatat</p>
          )}
          {logs.slice(0, 15).map((log, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="text-base shrink-0">{LOG_ICONS[log.type] ?? '📋'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-300">{log.description}</p>
                <p className="text-xs text-neutral-600 mt-0.5">{formatLogTime(log.timestamp)}</p>
              </div>
            </div>
          ))}
          {logs.length > 15 && (
            <p className="text-center text-xs text-neutral-700 py-3">Menampilkan 15 dari {logs.length} aktivitas</p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
