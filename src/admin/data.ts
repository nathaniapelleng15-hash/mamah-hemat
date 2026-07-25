// ============================================================
// DUMMY DATA — Simulasi data dari database MySQL
// Nanti diganti dengan API call ke backend Express.js
// ============================================================
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'transfer_bca' | 'transfer_mandiri' | 'qris' | 'cash' | 'other';
export type StockStatus = 'available' | 'out_of_stock' | 'hidden';

export interface Customer {
  id: number;
  name: string;
  phone: string;
}

export interface OrderItem {
  id: number;
  product_id?: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

// ⚠️ FIX: interface Category sebelumnya didefinisikan 2x (duplicate identifier).
// Sekarang cuma 1x, dengan field tambahan slug/description/sort_order (opsional)
// supaya kompatibel dengan response dari tabel `categories` di database.
export interface Category {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  sort_order?: number;
}

export interface OrderAddon {
  id?: number;
  addon_id?: number;
  addon_name: string;
  price: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer: Customer;
  delivery_method: 'pickup' | 'delivery';
  delivery_area_id: number | null;
  delivery_area_label: string | null;
  delivery_area: string | null;
  delivery_address: string | null;
  delivery_map_link: string | null;
  delivery_fee: number;
  delivery_date: string | null;
  delivery_time: string | null;
  notes: string;
  subtotal: number;
  addons_total: number;
  grand_total: number;
  order_status: OrderStatus;
  admin_notes: string;
  created_at: string;
  items: OrderItem[];
  addons: OrderAddon[];
}

export interface Transaction {
  id: number;
  order_number: string;
  customer_name: string;
  transaction_number: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount: number;
  amount_paid: number | null;
  paid_at: string | null;
  expired_at: string;
  created_at: string;
}

export interface Product {
  id: number;
  category_id: number;
  category_name: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  pax_info: string;
  tag: string;
  image_url: string;
  stock_qty?: number;
  stock_status: StockStatus;
  is_active: boolean;
  sort_order?: number;
}

export interface Addon {
  id: number;
  name: string;
  description: string;
  price: number;
  badge: string;
  is_active: boolean;
}

export const dummyTransactions: Transaction[] = [
  {
    id: 1,
    order_number: 'MH-202507-1001',
    customer_name: 'Dewi Rahayu',
    transaction_number: 'TXN-MH-202507-1001',
    payment_method: 'transfer_bca',
    payment_status: 'pending',
    amount: 125000,
    amount_paid: null,
    paid_at: null,
    expired_at: new Date(Date.now() + 10 * 60000).toISOString(),
    created_at: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 2,
    order_number: 'MH-202507-1002',
    customer_name: 'Budi Santoso',
    transaction_number: 'TXN-MH-202507-1002',
    payment_method: 'qris',
    payment_status: 'paid',
    amount: 140000,
    amount_paid: 140000,
    paid_at: new Date(Date.now() - 40 * 60000).toISOString(),
    expired_at: new Date(Date.now() - 30 * 60000).toISOString(),
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: 3,
    order_number: 'MH-202507-1003',
    customer_name: 'Siti Aminah',
    transaction_number: 'TXN-MH-202507-1003',
    payment_method: 'transfer_mandiri',
    payment_status: 'paid',
    amount: 498000,
    amount_paid: 498000,
    paid_at: new Date(Date.now() - 1.5 * 3600000).toISOString(),
    expired_at: new Date(Date.now() - 1 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 4,
    order_number: 'MH-202507-1004',
    customer_name: 'Rina Kartika',
    transaction_number: 'TXN-MH-202507-1004',
    payment_method: 'transfer_bca',
    payment_status: 'paid',
    amount: 130000,
    amount_paid: 130000,
    paid_at: new Date(Date.now() - 4.5 * 3600000).toISOString(),
    expired_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: 5,
    order_number: 'MH-202507-1005',
    customer_name: 'Anton Wijaya',
    transaction_number: 'TXN-MH-202507-1005',
    payment_method: 'cash',
    payment_status: 'failed',
    amount: 93000,
    amount_paid: null,
    paid_at: null,
    expired_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
];

// ⚠️ Ini cuma dipakai sebagai FALLBACK sebelum data asli dari API/database masuk.
// Kategori sesungguhnya sekarang dikelola dinamis lewat tab "Kategori" di halaman admin,
// tersimpan di tabel `categories` pada database.
export const dummyCategories: Category[] = [
  { id: 1, name: 'Fresh Meat' },
  { id: 2, name: 'Fruits' },
  { id: 3, name: 'Bakery' },
  { id: 4, name: 'Catering' },
  { id: 5, name: 'Frozen Food' },
];

export const dummyProducts: Product[] = [
  {
    id: 1, category_id: 1, category_name: 'Fresh Meat',
    sku: 'MH-001', name: 'Nasi Tumpeng Mini Sasmita',
    description: 'Nasi kuning wangi bumbu rempah pilihan, disajikan dengan ayam goreng krispi, sambal goreng ati kentang, abon sapi premium, telur dadar iris, perkedel kentang, dan lalapan segar.',
    price: 45000, pax_info: '1 Pax (Sangat Kenyang)', tag: 'Best Seller',
    image_url: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=600&q=80',
    stock_status: 'available', is_active: true,
  },
  {
    id: 2, category_id: 1, category_name: 'Fresh Meat',
    sku: 'MH-002', name: 'Bento Box Kencana Wagyu',
    description: 'Nasi melati wangi dipadukan dengan Rendang Daging Wagyu legendaris yang empuk meresap.',
    price: 65000, pax_info: '1 Pax (Sangat Mewah)', tag: 'Premium Choice',
    image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80',
    stock_status: 'available', is_active: true,
  },
  {
    id: 3, category_id: 2, category_name: 'Fruits',
    sku: 'MH-003', name: 'Rantang Royal Amartha (2-3 Pax)',
    description: 'Set lauk catering mewah ramah keluarga berisikan: Ayam Bakar Madu aroma kemangi, Empal Geprek serundeng.',
    price: 135000, pax_info: '2 - 3 Pax (Sempurna)', tag: 'Signature Dish',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    stock_status: 'available', is_active: true,
  },
  {
    id: 4, category_id: 3, category_name: 'Bakery',
    sku: 'MH-004', name: 'Tumpeng Ayu Kencana (10 Pax)',
    description: 'Karya seni kuliner tumpeng hias ukuran besar untuk perayaan istimewa.',
    price: 480000, pax_info: '10 Pax (Pesta & Syukuran)', tag: 'Party Highlight',
    image_url: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=600&q=80',
    stock_status: 'available', is_active: true,
  },
  {
    id: 5, category_id: 4, category_name: 'Catering',
    sku: 'MH-005', name: 'Es Selendang Mayang Ningrat',
    description: 'Hidangan penutup manis khas legendaris. Kue selendang mayang bertekstur lembut kenyal.',
    price: 25000, pax_info: 'Gelas Premium (Dingin)', tag: 'Refreshing',
    image_url: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=600&q=80',
    stock_status: 'available', is_active: true,
  },
];

export const dummyAddons: Addon[] = [
  { id: 1, name: 'Extra Ice Gel Pack',               description: 'Pengaman suhu ekstra agar pesanan tetap segar selama perjalanan jauh.', price: 5000,  badge: 'Dingin',       is_active: true },
  { id: 2, name: 'Tas Hantaran Batik Kencana',       description: 'Tas spunbond batik premium berpita emas mewah.',                       price: 15000, badge: 'Luxury Wrap',  is_active: true },
  { id: 3, name: 'Sendok Bebek & Garpu Set (5 pasang)', description: 'Sendok dan garpu tebal ramah lingkungan dilengkapi tisu basah steril.', price: 3000,  badge: 'Eco-Friendly', is_active: true },
];

// ---- HELPERS ----

export function formatIDR(num: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, {
  label: string;
  color: string;
  bg: string;
}> = {
  pending: {
    label: 'Menunggu Konfirmasi',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/20'
  },

  confirmed: {
    label: 'Dikonfirmasi',
    color: 'text-sky-400',
    bg: 'bg-sky-400/10 border-sky-400/20'
  },

  preparing: {
    label: 'Diproses',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10 border-purple-400/20'
  },

  ready: {
    label: 'Siap Kirim',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10 border-indigo-400/20'
  },

  delivered: {
    label: 'Terkirim',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/20'
  },

  cancelled: {
    label: 'Dibatalkan',
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20'
  },
};

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Menunggu',    color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/20'   },
  processing: { label: 'Diproses',   color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/20'    },
  paid:       { label: 'Lunas',       color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20'},
  failed:     { label: 'Gagal',       color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/20'      },
  refunded:   { label: 'Dikembalikan',color: 'text-neutral-400', bg: 'bg-neutral-400/10 border-neutral-400/20'},
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  transfer_bca:     'Transfer BCA',
  transfer_mandiri: 'Transfer Mandiri',
  transfer_bni:     'Transfer BNI',
  transfer_bri:     'Transfer BRI',
  qris:             'QRIS',
  cash:             'Tunai',
  other:            'Lainnya',
};
