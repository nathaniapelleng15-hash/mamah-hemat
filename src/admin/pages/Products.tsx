import { useState } from 'react';
import {
  Package, Plus, Pencil, Trash2, Eye, EyeOff,
  X, Check, Tag, Image as ImageIcon, Info
} from 'lucide-react';
import {
  dummyProducts, dummyAddons, dummyCategories,
  Product, Addon, Category, StockStatus, formatIDR
} from '../data';

const STOCK_CONFIG: Record<StockStatus, { label: string; color: string; bg: string }> = {
  available: { label: 'Tersedia', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  out_of_stock: { label: 'Habis', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
  hidden: { label: 'Disembunyikan', color: 'text-neutral-400', bg: 'bg-neutral-400/10 border-neutral-400/20' },
};

// ---- MODAL: Tambah / Edit Produk ----
function ProductModal({
  product, categories, onClose, onSave
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: (p: Product) => void;
}) {
  const isEdit = !!product;
  const [form, setForm] = useState<Partial<Product>>(product ?? {
    category_id: categories[0]?.id ?? 0,
    category_name: categories[0]?.name ?? '',
    sku: '', name: '', description: '',
    price: 0, pax_info: '', tag: '', image_url: '', stock_qty: 100, stock_status: 'available', is_active: true,
  });
  const [uploading, setUploading] = useState(false);

  const set = (key: keyof Product, val: unknown) => setForm(prev => ({ ...prev, [key]: val }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setUploading(true);
    try {
      const token = localStorage.getItem('mh_admin_token');
      const res = await fetch('/api/products/upload-image', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal mengunggah gambar');
      }

      set('image_url', result.url);
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat mengunggah.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!form.name?.trim() || !form.price) return;
    const cat = categories.find(c => c.id === form.category_id);
    onSave({
      ...form,
      id: product?.id ?? Date.now(),
      category_name: cat?.name ?? '',
      stock_qty: form.stock_qty ?? 0,
    } as Product);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#111111] border border-neutral-800/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/60">
          <h2 className="font-bold text-white">{isEdit ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-all">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Category & SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Kategori</label>
              {categories.length === 0 ? (
                <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2.5">
                  Belum ada kategori. Buat kategori dulu di tab "Kategori".
                </p>
              ) : (
                <select
                  value={form.category_id}
                  onChange={e => set('category_id', Number(e.target.value))}
                  className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#E4C670]/40"
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">SKU (Kode Produk)</label>
              <input
                value={form.sku ?? ''}
                onChange={e => set('sku', e.target.value)}
                placeholder="MH-006"
                className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-[#E4C670]/40"
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Nama Produk <span className="text-red-400">*</span></label>
            <input
              value={form.name ?? ''}
              onChange={e => set('name', e.target.value)}
              placeholder="Nama menu..."
              className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-[#E4C670]/40"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Deskripsi</label>
            <textarea
              rows={3}
              value={form.description ?? ''}
              onChange={e => set('description', e.target.value)}
              placeholder="Deskripsi menu..."
              className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 resize-none focus:outline-none focus:border-[#E4C670]/40"
            />
          </div>

          {/* Price & Pax */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Harga (Rp) <span className="text-red-400">*</span></label>
              <input
                type="number"
                value={form.price ?? 0}
                onChange={e => set('price', Number(e.target.value))}
                className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#E4C670]/40"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Satuan</label>
              <input
                value={form.pax_info ?? ''}
                onChange={e => set('pax_info', e.target.value)}
                placeholder="1 Pax (Kenyang)"
                className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-[#E4C670]/40"
              />
            </div>
          </div>

          {/* Stock Quantity — INTERNAL, tidak tampil di katalog pelanggan */}
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 flex items-center gap-1.5">
              Jumlah Stok (Porsi)
              <span className="group relative inline-flex">
                <Info className="w-3 h-3 text-neutral-600 cursor-help" />
                <span className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-56 text-[10px] text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-lg p-2 z-10 leading-relaxed shadow-xl">
                  Dipakai sistem reservasi anti-overselling saat checkout. Angka ini tidak ditampilkan ke pelanggan di katalog.
                </span>
              </span>
            </label>
            <input
              type="number"
              min={0}
              value={form.stock_qty ?? 0}
              onChange={e => set('stock_qty', Number(e.target.value))}
              placeholder="100"
              className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-[#E4C670]/40"
            />
            <p className="text-[10px] text-neutral-600 mt-1">Internal saja — tidak tampil di halaman pelanggan.</p>
          </div>

          {/* Tag & Stock Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Tag/Label</label>
              <input
                value={form.tag ?? ''}
                onChange={e => set('tag', e.target.value)}
                placeholder="Best Seller"
                className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-[#E4C670]/40"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Status Stok</label>
              <select
                value={form.stock_status}
                onChange={e => set('stock_status', e.target.value as StockStatus)}
                className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#E4C670]/40"
              >
                <option value="available">Tersedia</option>
                <option value="out_of_stock">Habis</option>
                <option value="hidden">Sembunyikan</option>
              </select>
            </div>
          </div>

          {/* Image Upload & URL */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Gambar Produk</label>
              <div className="flex gap-3">
                {/* File Input Trigger Button */}
                <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-neutral-700/60 hover:border-[#E4C670]/40 rounded-xl p-4 cursor-pointer bg-neutral-800/20 transition-all text-center">
                  <span className="text-xs font-semibold text-[#E4C670]">
                    {uploading ? 'Mengunggah...' : 'Pilih File Gambar'}
                  </span>
                  <span className="text-[10px] text-neutral-500 mt-1">PNG, JPG, JPEG, WEBP (Maks 5MB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-500 mb-1 block">Atau Input URL Gambar</label>
              <input
                value={form.image_url ?? ''}
                onChange={e => set('image_url', e.target.value)}
                placeholder="https://..."
                className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-[#E4C670]/40"
              />
            </div>

            {form.image_url && (
              <div className="relative mt-2 rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950/40">
                <img src={form.image_url} alt="preview" className="w-full h-28 object-cover opacity-80" />
                <button
                  type="button"
                  onClick={() => set('image_url', '')}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-red-500/80 p-1.5 rounded-lg text-white transition-all text-xs"
                >
                  Hapus Gambar
                </button>
              </div>
            )}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between bg-neutral-800/40 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm text-white font-medium">Tampilkan di Katalog</p>
              <p className="text-xs text-neutral-500">Produk aktif akan muncul di halaman pelanggan</p>
            </div>
            <button
              onClick={() => set('is_active', !form.is_active)}
              className={`relative w-10 h-6 rounded-full border transition-all ${form.is_active ? 'bg-[#E4C670]/20 border-[#E4C670]/40' : 'bg-neutral-800 border-neutral-700'
                }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-all ${form.is_active ? 'bg-[#E4C670] translate-x-4' : 'bg-neutral-600'
                }`} />
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-neutral-800/60">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-neutral-700 text-neutral-400 text-sm hover:bg-white/5 transition-all">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name?.trim() || categories.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-[#E4C670]/10 border border-[#E4C670]/30 text-[#E4C670] text-sm font-semibold hover:bg-[#E4C670]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- MODAL: Tambah / Edit Add-on ----
function AddonModal({ addon, onClose, onSave }: { addon: Addon | null; onClose: () => void; onSave: (a: Addon) => void }) {
  const [form, setForm] = useState<Partial<Addon>>(addon ?? { name: '', description: '', price: 0, badge: '', is_active: true });
  const set = (key: keyof Addon, val: unknown) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#111111] border border-neutral-800/60 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/60">
          <h2 className="font-bold text-white">{addon ? 'Edit Add-on' : 'Tambah Add-on'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Nama Add-on <span className="text-red-400">*</span></label>
            <input value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Nama add-on..."
              className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-[#E4C670]/40" />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Deskripsi</label>
            <textarea rows={2} value={form.description ?? ''} onChange={e => set('description', e.target.value)}
              className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 resize-none focus:outline-none focus:border-[#E4C670]/40" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Harga (Rp)</label>
              <input type="number" value={form.price ?? 0} onChange={e => set('price', Number(e.target.value))}
                className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#E4C670]/40" />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Badge</label>
              <input value={form.badge ?? ''} onChange={e => set('badge', e.target.value)} placeholder="Dingin"
                className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-[#E4C670]/40" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-neutral-800/60">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-neutral-700 text-neutral-400 text-sm hover:bg-white/5 transition-all">Batal</button>
          <button onClick={() => { onSave({ ...form, id: addon?.id ?? Date.now() } as Addon); onClose(); }} disabled={!form.name?.trim()}
            className="flex-1 py-2.5 rounded-xl bg-[#E4C670]/10 border border-[#E4C670]/30 text-[#E4C670] text-sm font-semibold hover:bg-[#E4C670]/20 transition-all disabled:opacity-40">
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- MODAL: Tambah / Edit Kategori ----
function CategoryModal({ category, onClose, onSave }: { category: Category | null; onClose: () => void; onSave: (c: Category) => void }) {
  const [form, setForm] = useState<Partial<Category>>(category ?? { name: '', description: '', sort_order: 0 });
  const set = (key: keyof Category, val: unknown) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#111111] border border-neutral-800/60 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/60">
          <h2 className="font-bold text-white">{category ? 'Edit Kategori' : 'Tambah Kategori'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Nama Kategori <span className="text-red-400">*</span></label>
            <input value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="mis. Fresh Meat"
              className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-[#E4C670]/40" />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Deskripsi</label>
            <textarea rows={2} value={form.description ?? ''} onChange={e => set('description', e.target.value)}
              className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-700 resize-none focus:outline-none focus:border-[#E4C670]/40" />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Urutan Tampil</label>
            <input type="number" value={form.sort_order ?? 0} onChange={e => set('sort_order', Number(e.target.value))}
              className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#E4C670]/40" />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-neutral-800/60">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-neutral-700 text-neutral-400 text-sm hover:bg-white/5 transition-all">Batal</button>
          <button onClick={() => { onSave({ ...form, id: category?.id ?? Date.now() } as Category); onClose(); }} disabled={!form.name?.trim()}
            className="flex-1 py-2.5 rounded-xl bg-[#E4C670]/10 border border-[#E4C670]/30 text-[#E4C670] text-sm font-semibold hover:bg-[#E4C670]/20 transition-all disabled:opacity-40">
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- MAIN PAGE ----
export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [categories, setCategories] = useState<Category[]>(dummyCategories); // fallback awal sebelum fetch selesai
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'products' | 'addons' | 'categories'>('products');
  const [productModal, setProductModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [addonModal, setAddonModal] = useState<{ open: boolean; addon: Addon | null }>({ open: false, addon: null });
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('mh_admin_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  // ─── Fetch data dari database ────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/products', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Gagal memuat data produk dari server.');
      const data = await res.json();
      setProducts(data.products || []);
      setAddons(data.addons || []);
      setCategories(data.categories || dummyCategories);
    } catch (err: any) {
      setError(err.message || 'Koneksi ke server gagal.');
    } finally {
      setLoading(false);
    }
  };

  // Load data saat halaman pertama kali dibuka
  useState(() => { fetchData(); });

  // ─── Simpan Produk (Tambah atau Edit) ────────────────────
  const saveProduct = async (p: Product) => {
    setSaving(true);
    try {
      const isEdit = products.some(x => x.id === p.id);
      const url = isEdit ? `/api/products/${p.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(p),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan produk.');
      }

      await fetchData(); // Refresh dari database
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Hapus Produk ─────────────────────────────────────────
  const deleteProduct = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus produk.');
      }
      setConfirmDelete(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle Aktif/Nonaktif Produk ─────────────────────────
  const toggleProduct = async (id: number) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    await saveProduct({ ...p, is_active: !p.is_active });
  };

  // ─── Simpan Add-on ────────────────────────────────────────
  const saveAddon = async (a: Addon) => {
    setSaving(true);
    try {
      const isEdit = addons.some(x => x.id === a.id);
      const url = isEdit ? `/api/products/addons/${a.id}` : '/api/products/addons';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(a),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan add-on.');
      }

      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Hapus Add-on ─────────────────────────────────────────
  const deleteAddon = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/addons/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus add-on.');
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAddon = async (id: number) => {
    const a = addons.find(x => x.id === id);
    if (!a) return;
    await saveAddon({ ...a, is_active: !a.is_active });
  };

  // ─── Simpan Kategori ────────────────────────────────────────
  const saveCategory = async (c: Category) => {
    setSaving(true);
    try {
      const isEdit = categories.some(x => x.id === c.id);
      const url = isEdit ? `/api/products/categories/${c.id}` : '/api/products/categories';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(c),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan kategori.');
      }

      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Hapus Kategori ─────────────────────────────────────────
  const deleteCategory = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/categories/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus kategori.');
      }
      setConfirmDeleteCategory(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading / Error States ───────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-2 border-[#E4C670]/40 border-t-[#E4C670] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 rounded-xl bg-[#E4C670]/10 border border-[#E4C670]/30 text-[#E4C670] text-sm">
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Produk & Add-on</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Kelola menu, pelengkap pesanan, dan kategori</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <div className="w-4 h-4 border border-[#E4C670]/40 border-t-[#E4C670] rounded-full animate-spin" />}
          {tab === 'products' && (
            <button onClick={() => setProductModal({ open: true, product: null })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E4C670]/10 border border-[#E4C670]/30 text-[#E4C670] text-sm font-semibold hover:bg-[#E4C670]/20 transition-all">
              <Plus className="w-4 h-4" /> Tambah Produk
            </button>
          )}
          {tab === 'addons' && (
            <button onClick={() => setAddonModal({ open: true, addon: null })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E4C670]/10 border border-[#E4C670]/30 text-[#E4C670] text-sm font-semibold hover:bg-[#E4C670]/20 transition-all">
              <Plus className="w-4 h-4" /> Tambah Add-on
            </button>
          )}
          {tab === 'categories' && (
            <button onClick={() => setCategoryModal({ open: true, category: null })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E4C670]/10 border border-[#E4C670]/30 text-[#E4C670] text-sm font-semibold hover:bg-[#E4C670]/20 transition-all">
              <Plus className="w-4 h-4" /> Tambah Kategori
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-800/60 pb-0">
        {(['products', 'addons', 'categories'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all ${tab === t ? 'border-[#E4C670] text-[#E4C670]' : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}>
            {t === 'products' ? `Produk (${products.length})`
              : t === 'addons' ? `Add-on (${addons.length})`
              : `Kategori (${categories.length})`}
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="grid gap-3">
          {products.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-8">Belum ada produk. Klik "Tambah Produk" untuk mulai.</p>
          )}
          {products.map(p => {
            const cfg = STOCK_CONFIG[p.stock_status];
            return (
              <div key={p.id} className={`bg-neutral-900/50 border rounded-2xl overflow-hidden transition-all ${p.is_active ? 'border-neutral-800/60' : 'border-neutral-800/30 opacity-60'
                }`}>
                <div className="flex gap-4 p-4">
                  {/* Image */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-neutral-800">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-neutral-700" /></div>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{p.name}</span>
                      {p.tag && (
                        <span className="text-[10px] text-[#E4C670] bg-[#E4C670]/10 border border-[#E4C670]/20 px-2 py-0.5 rounded-full shrink-0">
                          {p.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{p.category_name} · {p.sku} · {p.pax_info}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-sm font-bold text-[#E4C670]">{formatIDR(p.price)}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-neutral-500">Stok: {p.stock_qty ?? '—'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => setProductModal({ open: true, product: p })}
                      className="p-2 rounded-lg bg-neutral-800/60 text-neutral-400 hover:text-[#E4C670] hover:bg-[#E4C670]/10 transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleProduct(p.id)}
                      className="p-2 rounded-lg bg-neutral-800/60 text-neutral-400 hover:text-white hover:bg-white/10 transition-all">
                      {p.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setConfirmDelete(p.id)}
                      className="p-2 rounded-lg bg-neutral-800/60 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Confirm Delete */}
                {confirmDelete === p.id && (
                  <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-red-400">Hapus produk ini secara permanen?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:bg-white/5 border border-neutral-700 transition-all">Batal</button>
                      <button onClick={() => deleteProduct(p.id)} className="px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all">Hapus</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add-ons Tab */}
      {tab === 'addons' && (
        <div className="grid gap-3">
          {addons.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-8">Belum ada add-on. Klik "Tambah Add-on" untuk mulai.</p>
          )}
          {addons.map(a => (
            <div key={a.id} className={`bg-neutral-900/50 border rounded-2xl p-4 flex items-center gap-4 transition-all ${a.is_active ? 'border-neutral-800/60' : 'border-neutral-800/30 opacity-60'
              }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{a.name}</span>
                  {a.badge && <span className="text-[10px] text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-full">{a.badge}</span>}
                </div>
                <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{a.description}</p>
                <p className="text-sm font-bold text-[#E4C670] mt-1">{formatIDR(a.price)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setAddonModal({ open: true, addon: a })}
                  className="p-2 rounded-lg bg-neutral-800/60 text-neutral-400 hover:text-[#E4C670] hover:bg-[#E4C670]/10 transition-all">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => toggleAddon(a.id)}
                  className="p-2 rounded-lg bg-neutral-800/60 text-neutral-400 hover:text-white hover:bg-white/10 transition-all">
                  {a.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => deleteAddon(a.id)}
                  className="p-2 rounded-lg bg-neutral-800/60 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Categories Tab */}
      {tab === 'categories' && (
        <div className="grid gap-3">
          {categories.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-8">Belum ada kategori. Klik "Tambah Kategori" untuk mulai.</p>
          )}
          {categories.map(c => (
            <div key={c.id} className="bg-neutral-900/50 border border-neutral-800/60 rounded-2xl overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{c.name}</span>
                    <span className="text-[10px] text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full">Urutan: {c.sort_order ?? 0}</span>
                  </div>
                  {c.description && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{c.description}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setCategoryModal({ open: true, category: c })}
                    className="p-2 rounded-lg bg-neutral-800/60 text-neutral-400 hover:text-[#E4C670] hover:bg-[#E4C670]/10 transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setConfirmDeleteCategory(c.id)}
                    className="p-2 rounded-lg bg-neutral-800/60 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {confirmDeleteCategory === c.id && (
                <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-red-400">Hapus kategori ini secara permanen?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDeleteCategory(null)} className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:bg-white/5 border border-neutral-700 transition-all">Batal</button>
                    <button onClick={() => deleteCategory(c.id)} className="px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all">Hapus</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {productModal.open && (
        <ProductModal product={productModal.product} categories={categories} onClose={() => setProductModal({ open: false, product: null })} onSave={saveProduct} />
      )}
      {addonModal.open && (
        <AddonModal addon={addonModal.addon} onClose={() => setAddonModal({ open: false, addon: null })} onSave={saveAddon} />
      )}
      {categoryModal.open && (
        <CategoryModal category={categoryModal.category} onClose={() => setCategoryModal({ open: false, category: null })} onSave={saveCategory} />
      )}
    </div>
  );
}
