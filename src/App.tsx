import { useState, useEffect, useRef, FormEvent, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  MessageSquare,
  Plus,
  Minus,
  ShoppingBag,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Check,
  Store,
  Truck,
  Copy,
  ExternalLink,
  ShieldCheck,
  Search,
  X,
  Link2,
  ChevronDown
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  tag?: string;
  paxInfo: string;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

interface AddOn {
  id: string;
  name: string;
  price: number;
  description: string;
  badge?: string;
}

interface DeliveryArea {
  id: number;       // ID numerik dari tabel delivery_areas
  label: string;
  fee: number;
  is_active: number;
}

type DeliveryMethod = "pickup" | "delivery";


export default function App() {
  const [menuList, setMenuList] = useState<MenuItem[]>([]);
  const [addOnsList, setAddOnsList] = useState<AddOn[]>([]);
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Gagal memuat katalog.');
        const data = await res.json();

        const mappedProducts = (data.products || [])
          .filter((p: any) => p.is_active === 1 && p.stock_status !== 'hidden')
          .map((p: any) => ({
            id: p.id.toString(),
            name: p.name,
            description: p.description || '',
            price: Number(p.price),
            image: p.image_url || '',
            category: p.category_name,
            tag: p.tag || undefined,
            paxInfo: p.pax_info || ''
          }));

        const mappedAddons = (data.addons || [])
          .filter((a: any) => a.is_active === 1)
          .map((a: any) => ({
            id: a.id.toString(),
            name: a.name,
            price: Number(a.price),
            description: a.description || '',
            badge: a.badge || undefined
          }));

        setMenuList(mappedProducts);
        setAddOnsList(mappedAddons);
      } catch (err) {
        console.error("Gagal sinkronisasi data katalog pelanggan:", err);
      }
    };

    // Load area pengantaran dari DB (dinamis, bisa diubah dari admin)
    const fetchDeliveryAreas = async () => {
      try {
        const res = await fetch('/api/delivery-areas');
        if (!res.ok) return;
        const data = await res.json();
        // Hanya tampilkan area yang aktif
        setDeliveryAreas((data.areas || []).filter((a: DeliveryArea) => a.is_active === 1));
      } catch (err) {
        console.error("Gagal memuat area pengantaran:", err);
      }
    };

    fetchCatalog();
    fetchDeliveryAreas();
  }, []);

  const [screen, setScreen] = useState<"catalog" | "checkout" | "payment" | "receipt">("catalog");
  const formRef = useRef<HTMLFormElement>(null);

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup");
  const [deliveryAreaId, setDeliveryAreaId] = useState<string>(""); // string agar kompatibel dgn select value
  const [deliveryDetail, setDeliveryDetail] = useState("");
  const [deliveryMapLink, setDeliveryMapLink] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Semua");

  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string; area?: string; address?: string }>({});

  const [paymentTimer, setPaymentTimer] = useState(900);
  const [paymentStatus, setPaymentStatus] = useState<"waiting" | "processing" | "success">("waiting");
  const [transactionId, setTransactionId] = useState("");
  const [qrisCode, setQrisCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const updateQuantity = (item: MenuItem, change: number) => {
    setCart((prevCart) => {
      const existing = prevCart.find((c) => c.item.id === item.id);
      if (existing) {
        const newQty = existing.quantity + change;
        if (newQty <= 0) {
          return prevCart.filter((c) => c.item.id !== item.id);
        }
        return prevCart.map((c) =>
          c.item.id === item.id ? { ...c, quantity: newQty } : c
        );
      } else if (change > 0) {
        return [...prevCart, { item, quantity: 1 }];
      }
      return prevCart;
    });
  };

  const getCartQuantity = (itemId: string) => {
    const found = cart.find((c) => c.item.id === itemId);
    return found ? found.quantity : 0;
  };

  const totalCartItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const subtotalCart = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);

  const addOnsTotal = selectedAddOns.reduce((sum, id) => {
    const addOn = addOnsList.find((a) => a.id === id);
    return sum + (addOn ? addOn.price : 0);
  }, 0);

  const selectedDeliveryArea = useMemo(
    () => deliveryAreas.find((a) => a.id.toString() === deliveryAreaId),
    [deliveryAreaId, deliveryAreas]
  );

  const deliveryFee = deliveryMethod === "delivery" ? (selectedDeliveryArea?.fee ?? 0) : 0;
  const grandTotal = subtotalCart + addOnsTotal + deliveryFee;
  const deliveryMethodLabel = deliveryMethod === "pickup" ? "Ambil Sendiri (Pick Up)" : "Diantar (Delivery)";

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (screen === "payment" && paymentTimer > 0 && paymentStatus === "waiting") {
      timer = setInterval(() => {
        setPaymentTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [screen, paymentTimer, paymentStatus]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (screen === "payment" && paymentStatus === "waiting" && transactionId) {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/checkout/status/${transactionId}`);
          if (res.ok) {
            const data = await res.json();

            if (data.paymentStatus === 'paid') {
              clearInterval(pollInterval);
              setPaymentStatus("success");
              setScreen("receipt");
              showToast("Pembayaran Berhasil Diverifikasi Sistem!");
            }
            else if (data.paymentStatus === 'failed' || data.orderStatus === 'cancelled') {
              clearInterval(pollInterval);
              setPaymentStatus("waiting");
              setScreen("checkout");
              showToast("Pembayaran kedaluwarsa atau stok dikembalikan ke pool.");
            }
          }
        } catch (err) {
          console.error("Gagal melakukan polling status pembayaran:", err);
        }
      }, 5000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [screen, paymentStatus, transactionId]);

  const handleProceedToCheckout = () => {
    if (cart.length === 0) {
      showToast("Silakan tambahkan menu ke keranjang terlebih dahulu.");
      return;
    }
    if (deliveryMethod === "delivery" && !deliveryAreaId) {
      setFormErrors((prev) => ({ ...prev, area: "Pilih area pengantaran terlebih dahulu" }));
      showToast("Harap pilih area pengantaran terlebih dahulu.");
      return;
    }
    if (deliveryMethod === "delivery" && !deliveryDetail.trim()) {
      setFormErrors((prev) => ({ ...prev, address: "Detail alamat wajib diisi untuk delivery" }));
      showToast("Harap lengkapi detail alamat delivery terlebih dahulu.");
      return;
    }
    setScreen("checkout");
  };

  const handleCheckoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const errors: { name?: string; phone?: string; area?: string; address?: string } = {};
    if (!userName.trim()) {
      errors.name = "Nama lengkap harus diisi";
    }
    if (!userPhone.trim()) {
      errors.phone = "Nomor WhatsApp harus diisi";
    } else if (!/^[0-9+]{8,15}$/.test(userPhone.trim())) {
      errors.phone = "Nomor WhatsApp tidak valid";
    }
    if (deliveryMethod === "delivery" && !deliveryAreaId) {
      errors.area = "Pilih area pengantaran terlebih dahulu";
    }
    if (deliveryMethod === "delivery" && !deliveryDetail.trim()) {
      errors.address = "Detail alamat wajib diisi untuk delivery";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast("Harap lengkapi data pemesanan Anda dengan benar.");
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        customer: {
          name: userName.trim(),
          phone: userPhone.trim(),
        },
        items: cart.map(c => ({
          productId: parseInt(c.item.id),
          name: c.item.name,
          unitPrice: c.item.price,
          quantity: c.quantity
        })),
        addons: selectedAddOns.map(id => {
          const originalAddOn = addOnsList.find(a => a.id === id);
          return {
            id: parseInt(id),
            name: originalAddOn ? originalAddOn.name : "Add-on",
            price: originalAddOn ? originalAddOn.price : 0
          };
        }),
        deliveryMethod,
        deliveryAreaId: deliveryMethod === "delivery" ? (selectedDeliveryArea?.id ?? null) : null,
        deliveryArea: deliveryMethod === "delivery" ? (selectedDeliveryArea?.label ?? "") : "",
        deliveryAreaLabel: deliveryMethod === "delivery" ? (selectedDeliveryArea?.label ?? "") : "",
        deliveryAddress: deliveryMethod === "delivery" ? deliveryDetail.trim() : "",
        deliveryMapLink: deliveryMethod === "delivery" ? deliveryMapLink.trim() : "",
        deliveryFee,
        notes: userNotes.trim()
      };

      const response = await fetch('/api/checkout/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal memproses checkout.");
      }

      setTransactionId(result.orderNumber);
      setQrisCode(result.qrisPayload);
      setPaymentTimer(result.ttlMinutes * 60);
      setPaymentStatus("waiting");
      setScreen("payment");
      showToast("Stok berhasil dikunci! Silakan bayar.");

    } catch (err: any) {
      console.error(err);
      alert(err.message || "Gagal melakukan pemesanan. Stok mungkin habis.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerManualSuccess = () => {
    setPaymentStatus("processing");
    setTimeout(() => {
      setPaymentStatus("success");
      setScreen("receipt");
      showToast("Pembayaran Sukses melalui simulasi instan.");
    }, 1500);
  };

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(num);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} disalin ke clipboard!`);
  };

  const availableCategories = useMemo(() => {
    const unique = Array.from(new Set(menuList.map((m) => m.category))).filter(Boolean);
    return ["Semua", ...unique];
  }, [menuList]);

  const filteredMenuList = useMemo(() => {
    return menuList.filter((menu) => {
      const matchesCategory = activeCategory === "Semua" || menu.category === activeCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === "" ||
        menu.name.toLowerCase().includes(query) ||
        menu.description.toLowerCase().includes(query) ||
        menu.category.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [menuList, activeCategory, searchQuery]);

  return (
    <div className="relative min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-3 md:p-6 overflow-hidden">

      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#E4C670] opacity-10 rounded-full blur-[130px] pointer-events-none animate-float1" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] bg-[#D3B45F] opacity-[0.08] rounded-full blur-[120px] pointer-events-none animate-float2" />
      <div className="absolute top-[25%] right-[-15%] w-[45%] h-[45%] bg-[#E4C670] opacity-[0.06] rounded-full blur-[100px] pointer-events-none animate-float3" />

      <main className="w-full max-w-[430px] min-h-screen md:min-h-[92vh] md:my-4 bg-[#070707]/90 md:border md:border-neutral-800/60 md:rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden relative flex flex-col backdrop-blur-xl z-10">

        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 16, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="absolute top-4 inset-x-4 bg-neutral-900/95 border border-[#E4C670]/30 text-[#E4C670] text-xs font-medium py-3 px-4 rounded-2xl flex items-center gap-2 shadow-2xl z-50 backdrop-blur-md"
            >
              <Sparkles className="w-4 h-4 shrink-0 text-[#E4C670]" />
              <p className="flex-1 text-center font-sans">{toastMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto no-scrollbar">

          <AnimatePresence mode="wait">

            {screen === "catalog" && (
              <motion.div
                key="catalog"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col px-4 pt-4 pb-24 gap-5"
              >
                <header className="flex flex-col items-center text-center mt-3 mb-2">
                  <div className="w-16 h-16 rounded-full border-2 border-[#E4C670]/40 flex items-center justify-center mb-3 shadow-lg overflow-hidden bg-black">
                    <img src="/logo-mamahemat.png" alt="Mamah Hemat Logo" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex flex-col items-center select-none gap-1.5">
                    <h1 className="font-serif-lux text-[28px] font-black tracking-widest text-[#E4C670] uppercase leading-tight">
                      <img
                        src="/mamah hemat.png"
                        alt="Mamah Hemat Logo"
                        className="w-40 mx-auto object-contain"
                      />
                    </h1>
                    <span className="font-sans text-[20px] text-neutral-140 tracking-wide font-medium leading-none block">
                      Food & Beverage Store
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1 mt-2.5">
                    <span className="text-[9px] font-sans text-neutral-500 tracking-wide">
                      Fresh Meat • Fruits • Bakery • Catering • Frozen Food
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-2 mt-3">
                    <span className="inline-flex items-center gap-1 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-[9px] text-neutral-400">
                      <MapPin className="w-2.5 h-2.5 text-[#E4C670]" />
                      Panorama Sepatan, Tangerang
                    </span>
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[9px] text-emerald-400 font-medium">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                      Dapur Buka
                    </span>
                  </div>
                </header>

                <section className="bg-white text-neutral-900 rounded-[14px] p-5 shadow-lg border border-neutral-100 flex flex-col gap-4">
                  <div className="flex flex-col">
                    <h2 className="font-display text-[15px] font-black text-neutral-900 tracking-tight">
                      Pilih metode pengambilan
                    </h2>
                    <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                      Ambil sendiri di dapur atau pilih layanan antar sesuai kebutuhan pesanan.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest font-sans flex items-center gap-1.5 leading-none">
                      <Store className="w-3 h-3 text-[#E4C670] shrink-0" />
                      METODE
                    </label>
                    <div className="grid grid-cols-2 gap-2 pt-0.5 w-full">
                      {([
                        { id: "pickup" as const, label: "Ambil Sendiri", caption: "Pick Up", icon: Store },
                        { id: "delivery" as const, label: "Diantar", caption: "Delivery", icon: Truck }
                      ]).map((option) => {
                        const isSelected = deliveryMethod === option.id;
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setDeliveryMethod(option.id);
                              if (option.id === "pickup") {
                                setFormErrors((prev) => ({ ...prev, address: undefined, area: undefined }));
                              }
                            }}
                            className={`min-h-[76px] px-3 py-3 rounded-[10px] flex flex-col items-center justify-center transition-all duration-200 cursor-pointer w-full border ${isSelected
                              ? "bg-neutral-950 text-white font-black border-neutral-950 shadow-md scale-[1.03]"
                              : "bg-white text-neutral-700 border-neutral-200/80 hover:bg-neutral-50"
                              }`}
                          >
                            <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? "text-[#E4C670]" : "text-neutral-400"}`} />
                            <span className="text-[11px] sm:text-xs font-display font-black leading-tight text-center">
                              {option.label}
                            </span>
                            <span className={`text-[9px] font-sans font-extrabold uppercase tracking-wide mt-0.5 ${isSelected ? "text-[#E4C670]" : "text-neutral-400"}`}>
                              {option.caption}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {deliveryMethod === "delivery" ? (
                    <div className="flex flex-col gap-3 border-t border-neutral-100/80 pt-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-extrabold text-neutral-700 font-sans tracking-wide">
                          Area Pengantaran <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={deliveryAreaId}
                            onChange={(e) => {
                              setDeliveryAreaId(e.target.value);
                              if (e.target.value) {
                                setFormErrors((prev) => ({ ...prev, area: undefined }));
                              }
                            }}
                            className={`w-full appearance-none px-4 py-2.5 pr-9 rounded-xl text-xs bg-neutral-50 border transition-all text-neutral-900 outline-none focus:bg-white cursor-pointer ${formErrors.area ? "border-red-500 focus:ring-1 focus:ring-red-500" : "border-neutral-200 focus:border-[#E4C670]"
                              }`}
                          >
                            <option value="" disabled>
                              Pilih area kamu...
                            </option>
                            {deliveryAreas.map((area) => (
                              <option key={area.id} value={area.id}>
                                {area.label} — {area.fee === 0 ? "Gratis" : formatIDR(area.fee)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        {formErrors.area && (
                          <span className="text-[9px] text-red-500 font-medium pl-1">
                            {formErrors.area}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-extrabold text-neutral-700 font-sans tracking-wide">
                          Detail Alamat <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={2}
                          value={deliveryDetail}
                          onChange={(e) => {
                            setDeliveryDetail(e.target.value);
                            if (e.target.value.trim()) {
                              setFormErrors((prev) => ({ ...prev, address: undefined }));
                            }
                          }}
                          placeholder="Nama jalan, nomor rumah, blok, patokan."
                          className={`w-full px-4 py-2.5 rounded-xl text-xs bg-neutral-50 border transition-all text-neutral-900 placeholder:text-neutral-400 outline-none focus:bg-white resize-none ${formErrors.address ? "border-red-500 focus:ring-1 focus:ring-red-500" : "border-neutral-200 focus:border-[#E4C670]"
                            }`}
                        />
                        {formErrors.address && (
                          <span className="text-[9px] text-red-500 font-medium pl-1">
                            {formErrors.address}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-extrabold text-neutral-700 font-sans tracking-wide flex items-center gap-1.5">
                          <Link2 className="w-3 h-3 text-[#E4C670] shrink-0" />
                          Link Lokasi (Opsional)
                        </label>
                        <input
                          type="text"
                          value={deliveryMapLink}
                          onChange={(e) => setDeliveryMapLink(e.target.value)}
                          placeholder="Tempel link Google Maps atau share location WA"
                          className="w-full px-4 py-2.5 rounded-xl text-xs bg-neutral-50 border border-neutral-200 transition-all text-neutral-900 placeholder:text-neutral-400 outline-none focus:bg-white focus:border-[#E4C670]"
                        />
                        <span className="text-[9px] text-neutral-400 pl-1 leading-normal font-sans">
                          Bantu kurir menemukan lokasi kamu lebih cepat & akurat.
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1">
                        <span>Ongkir area ini</span>
                        <span className="font-display font-black text-neutral-900">
                          {selectedDeliveryArea ? formatIDR(selectedDeliveryArea.fee) : "Pilih area dulu"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-neutral-100/80 pt-3">
                      <div className="bg-neutral-50 border border-neutral-100 rounded-xl px-3.5 py-3 flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-[#E4C670] shrink-0 mt-0.5" />
                        <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">
                          Ambil di Dapur Mamah Hemat — kapan saja saat dapur buka
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 border-t border-neutral-100/80 pt-3">
                    <MessageSquare className="w-3.5 h-3.5 text-[#E4C670] shrink-0 mt-0.5" />
                    <p className="text-[10px] text-neutral-400 leading-relaxed">
                      Butuh waktu pengambilan/pengantaran tertentu? Chat admin kami langsung via WhatsApp ya, karena estimasi waktu menyesuaikan antrian dapur.
                    </p>
                  </div>
                </section>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari menu, misal: rendang, tumpeng..."
                    className="w-full pl-10 pr-9 py-3 rounded-[12px] text-xs bg-[#0C0C0C] border border-neutral-800 text-white placeholder:text-neutral-600 outline-none focus:border-[#E4C670]/40 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {availableCategories.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
                    {availableCategories.map((cat) => {
                      const isActive = activeCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActiveCategory(cat)}
                          className={`shrink-0 px-3.5 py-1.5 rounded-full text-[10.5px] font-sans font-bold whitespace-nowrap transition-all border ${isActive
                            ? "bg-[#E4C670] text-neutral-950 border-[#E4C670]"
                            : "bg-transparent text-neutral-400 border-neutral-800 hover:border-neutral-600"
                            }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between px-1 mt-1">
                  <h3 className="text-[11.5px] uppercase tracking-widest text-[#E4C670] font-extrabold font-sans leading-none">
                    {activeCategory === "Semua" ? "MENU HARI INI" : activeCategory.toUpperCase()}
                  </h3>
                  <span className="text-[10px] text-neutral-500 font-sans">
                    {filteredMenuList.length} item
                  </span>
                </div>

                <div className="flex flex-col gap-3.5">
                  {filteredMenuList.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-[12px] text-neutral-500">
                        Tidak ada menu yang cocok dengan pencarian "{searchQuery}".
                      </p>
                    </div>
                  )}
                  {filteredMenuList.map((menu) => {
                    const qtyInCart = getCartQuantity(menu.id);
                    return (
                      <article
                        key={menu.id}
                        className="bg-[#0C0C0C]/80 backdrop-blur-xs border border-neutral-900 text-white rounded-[14px] p-4.5 flex gap-4 items-center transition-all duration-300 hover:border-neutral-800/60"
                      >
                        <div className="w-[92px] h-[92px] rounded-[10px] overflow-hidden shrink-0 border border-[#E4C670]/20 p-1 bg-black/40 flex items-center justify-center relative shadow-md">
                          <img
                            src={menu.image}
                            alt={menu.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover rounded-[8px]"
                          />
                        </div>

                        <div className="flex-1 flex flex-col justify-between min-h-[82px]">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-sans font-bold text-[14px] text-white leading-tight">
                                {menu.name}
                              </h4>
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-1 leading-snug line-clamp-2 font-sans opacity-95">
                              {menu.description}
                            </p>
                          </div>

                          <div className="flex items-end justify-between mt-2 pt-1">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-neutral-500 font-sans tracking-tight leading-none mb-1">
                                {menu.paxInfo.split(" (")[0].toLowerCase()}
                              </span>
                              <span className="text-[15.5px] font-display font-extrabold text-[#E4C670] tracking-tight leading-none">
                                {formatIDR(menu.price)}
                              </span>
                            </div>

                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={() => qtyInCart > 0 && updateQuantity(menu, -1)}
                                disabled={qtyInCart === 0}
                                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all cursor-pointer ${qtyInCart > 0
                                  ? "border-[#E4C670]/40 text-[#E4C670] hover:bg-[#E4C670]/10 active:scale-95"
                                  : "border-neutral-800 text-neutral-700 cursor-not-allowed opacity-40"
                                  }`}
                                aria-label="Kurangi porsi"
                              >
                                <Minus className="w-3 h-3 stroke-[2.5]" />
                              </button>
                              <span className="font-sans text-[12.5px] font-bold text-white w-6 text-center">
                                {qtyInCart}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(menu, 1)}
                                className="w-7 h-7 rounded-full bg-[#E4C670] hover:bg-[#D3B45F] active:scale-[0.93] text-neutral-950 flex items-center justify-center transition-all cursor-pointer font-black"
                                aria-label="Tambah porsi"
                              >
                                <Plus className="w-3 h-3 stroke-[3]" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center mt-3">
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Butuh penyesuaian porsi besar atau piring khusus? <br />
                    <a href="https://wa.me/6281290840140?text=Halo%20Mamah%20Hemat%2C%20saya%20mau%20tanya%20soal%20menu%2Fpesanan."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#E4C670] font-medium cursor-pointer underline hover:opacity-90"
                    >
                      Hubungi Chef Mamah via WhatsApp →
                    </a>
                  </p>
                </div>
              </motion.div>
            )}

            {screen === "checkout" && (
              <motion.div
                key="checkout"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col px-4 pt-4 pb-28 gap-5"
              >
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setScreen("catalog")}
                    className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-850 flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer text-white"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="font-display text-lg font-black tracking-tight text-white">Pesanan kamu</h2>
                    <p className="text-[10.5px] text-[#E4C670] font-sans font-extrabold uppercase tracking-widest leading-none">TINJAU & DATA PEMESANAN</p>
                  </div>
                </div>

                <form ref={formRef} onSubmit={handleCheckoutSubmit} className="flex flex-col gap-5">

                  <div className="flex flex-col gap-1.5 px-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-sans font-extrabold text-neutral-400 uppercase tracking-widest leading-none">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span>PENGAMBILAN</span>
                    </div>

                    <div className="bg-neutral-900 border border-[#E4C670]/20 text-white rounded-[14px] p-4.5 shadow-md flex flex-col gap-3 relative">
                      <div className="flex items-center justify-between">
                        <h4 className="font-display font-extrabold text-[13px] text-white leading-tight">
                          {deliveryMethodLabel}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setScreen("catalog");
                            showToast("Silakan sesuaikan metode pengambilan pada menu!");
                          }}
                          className="bg-neutral-800 hover:bg-neutral-750 text-[#E4C670] border border-[#E4C670]/30 text-[10px] font-black px-3.5 py-1 rounded-full transition-all cursor-pointer"
                        >
                          Ubah
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5 border-t border-neutral-800 pt-2.5 text-[11px] text-neutral-300 font-medium">
                        <div className="flex items-start gap-2">
                          {deliveryMethod === "pickup" ? (
                            <Store className="w-3.5 h-3.5 text-[#E4C670] shrink-0 mt-0.5" />
                          ) : (
                            <Truck className="w-3.5 h-3.5 text-[#E4C670] shrink-0 mt-0.5" />
                          )}
                          <span>
                            {deliveryMethod === "pickup"
                              ? "Dapur Mamah Hemat"
                              : `${selectedDeliveryArea?.label ?? "Area belum dipilih"} — ${deliveryDetail.trim()}`}
                          </span>
                        </div>
                        {deliveryMethod === "pickup" && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-[#E4C670]" />
                            <span>Kapan saja saat dapur buka</span>
                          </div>
                        )}
                        {deliveryMethod === "delivery" && deliveryMapLink.trim() && (
                          <a
                            href={deliveryMapLink.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[#E4C670] hover:underline"
                          >
                            <Link2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Lihat link lokasi</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 px-0.5">
                    <div className="flex items-center justify-between text-[11px] font-sans font-extrabold text-neutral-400 uppercase tracking-widest leading-none">
                      <span>ITEM</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCart([]);
                          setScreen("catalog");
                          showToast("Semua pesanan dibersihkan!");
                        }}
                        className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1"
                      >
                        Hapus semua
                      </button>
                    </div>

                    <div className="bg-white text-neutral-900 rounded-[14px] p-4.5 shadow-lg border border-neutral-100 flex flex-col gap-3">
                      <div className="divide-y divide-neutral-100">
                        {cart.map((cartItem) => (
                          <div key={cartItem.item.id} className="py-3.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                            <div className="flex-1">
                              <h4 className="font-display font-extrabold text-[12.5px] text-neutral-900 leading-snug">
                                {cartItem.item.name}
                              </h4>
                              <p className="text-[10px] text-neutral-400 font-medium mt-0.5">
                                {cartItem.item.paxInfo.split(" ")[0]} • {formatIDR(cartItem.item.price)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2.5 bg-neutral-50 border border-neutral-200/50 rounded-full px-2 py-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => updateQuantity(cartItem.item, -1)}
                                className="w-6 h-6 rounded-full hover:bg-neutral-200 flex items-center justify-center transition-all cursor-pointer text-neutral-600"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-mono text-xs font-bold text-neutral-800 w-3 text-center">
                                {cartItem.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(cartItem.item, 1)}
                                className="w-6 h-6 rounded-full hover:bg-neutral-200 flex items-center justify-center transition-all cursor-pointer text-neutral-600"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-neutral-100 pt-3 flex items-center justify-between text-xs text-neutral-500 font-medium">
                        <span>Subtotal</span>
                        <span className="font-display font-black text-[13.5px] text-neutral-900">
                          {formatIDR(subtotalCart)}
                        </span>
                      </div>
                      {deliveryMethod === "delivery" && (
                        <div className="flex items-center justify-between text-xs text-neutral-500 font-medium">
                          <span>Ongkir ({selectedDeliveryArea?.label ?? "-"})</span>
                          <span className="font-display font-black text-[13.5px] text-neutral-900">
                            {formatIDR(deliveryFee)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 px-0.5">
                    <div className="text-[11px] font-sans font-extrabold text-neutral-400 uppercase tracking-widest leading-none">
                      <span>TAMBAHAN</span>
                    </div>

                    <div className="bg-white text-neutral-900 rounded-[14px] p-4.5 shadow-lg border border-neutral-100 flex flex-col gap-3">
                      {addOnsList.map((addOn) => {
                        const isSelected = selectedAddOns.includes(addOn.id);
                        return (
                          <div
                            key={addOn.id}
                            onClick={() => toggleAddOn(addOn.id)}
                            className="flex items-center justify-between py-2 cursor-pointer group"
                          >
                            <div className="flex-1 pr-3">
                              <h4 className="font-display font-bold text-[12px] text-neutral-800 group-hover:text-neutral-950 transition-colors">
                                {addOn.name}
                              </h4>
                              <p className="text-[9.5px] text-neutral-400 mt-0.5 leading-normal">
                                {addOn.description}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-display font-extrabold text-[11px] text-neutral-900">
                                {formatIDR(addOn.price)}
                              </span>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${isSelected
                                ? "bg-[#E4C670] border-[#E4C670] text-neutral-950"
                                : "bg-white border-neutral-300"
                                }`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 px-0.5">
                    <div className="text-[11px] font-sans font-extrabold text-neutral-400 uppercase tracking-widest leading-none">
                      <span>DATA KAMU</span>
                    </div>

                    <div className="bg-white text-neutral-900 rounded-[14px] p-4.5 shadow-lg border border-neutral-100 flex flex-col gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-extrabold text-neutral-700 font-sans tracking-wide">
                          Nama <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={userName}
                          onChange={(e) => {
                            setUserName(e.target.value);
                            if (e.target.value.trim()) {
                              setFormErrors((prev) => ({ ...prev, name: undefined }));
                            }
                          }}
                          placeholder="Nama Anda"
                          className={`w-full px-4 py-2.5 rounded-xl text-xs bg-neutral-50 border transition-all text-neutral-900 placeholder:text-neutral-400 outline-none focus:bg-white ${formErrors.name ? "border-red-500 focus:ring-1 focus:ring-red-500" : "border-neutral-200 focus:border-[#E4C670]"
                            }`}
                        />
                        {formErrors.name && (
                          <span className="text-[9px] text-red-500 font-medium pl-1">
                            {formErrors.name}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-extrabold text-neutral-700 font-sans tracking-wide">
                          Nomor WhatsApp <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs font-semibold text-neutral-400 font-mono">
                            +62
                          </span>
                          <input
                            type="tel"
                            value={userPhone}
                            onChange={(e) => {
                              setUserPhone(e.target.value);
                              if (e.target.value.trim()) {
                                setFormErrors((prev) => ({ ...prev, phone: undefined }));
                              }
                            }}
                            placeholder="81234567890"
                            className={`w-full pl-11 pr-4 py-2.5 rounded-xl text-xs bg-neutral-50 border transition-all text-neutral-900 placeholder:text-neutral-400 outline-none focus:bg-white ${formErrors.phone ? "border-red-500 focus:ring-1 focus:ring-red-500" : "border-neutral-200 focus:border-[#E4C670]"
                              }`}
                          />
                        </div>
                        {formErrors.phone ? (
                          <span className="text-[9px] text-red-500 font-medium pl-1">
                            {formErrors.phone}
                          </span>
                        ) : (
                          <span className="text-[9px] text-neutral-400 pl-1 leading-normal font-sans">
                            Kirim struk digital & notifikasi pesanan via WhatsApp.
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-extrabold text-neutral-700 font-sans tracking-wide">
                          Catatan Tambahan (Opsional)
                        </label>
                        <textarea
                          rows={2}
                          value={userNotes}
                          onChange={(e) => setUserNotes(e.target.value)}
                          placeholder="Contoh: Sambal dipisah, dll."
                          className="w-full px-4 py-2.5 rounded-xl text-xs bg-neutral-50 border border-neutral-200 transition-all text-neutral-900 placeholder:text-neutral-400 outline-none focus:bg-white focus:border-[#E4C670] resize-none"
                        />
                      </div>
                    </div>
                  </div>

                </form>
              </motion.div>
            )}

            {screen === "payment" && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col px-4 pt-4 pb-12 gap-5"
              >
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => {
                      if (confirm("Apakah Anda yakin ingin membatalkan pembayaran ini?")) {
                        setScreen("checkout");
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5 text-neutral-300" />
                  </button>
                  <div>
                    <h2 className="font-display text-lg font-black tracking-tight text-white">Pembayaran</h2>
                    <p className="text-[9px] text-[#E4C670] font-sans uppercase tracking-widest font-extrabold">DENGAN QRIS STAT/DYN</p>
                  </div>
                </div>

                <div className="bg-white text-neutral-900 rounded-[14px] p-6 shadow-lg border border-neutral-100 flex flex-col items-center text-center gap-5 relative overflow-hidden">

                  <div className="flex flex-col items-center gap-1.5 mt-1">
                    <span className="bg-[#B27041]/10 text-[#B27041] text-[10.5px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider font-sans">
                      QRIS • SCAN UNTUK BAYAR
                    </span>
                    <p className="text-[11px] text-neutral-400 font-sans font-medium mt-1">Total tagihan</p>
                    <h3 className="font-sans text-[28px] font-black tracking-tight text-[#2C4E35] leading-none">
                      {formatIDR(grandTotal)}
                    </h3>
                  </div>

                  <div className="bg-white border border-neutral-200/85 rounded-[14px] p-4 flex items-center justify-center shadow-xs relative w-[210px] h-[210px]">

                    {paymentStatus === "waiting" && (
                      <div className="absolute inset-x-3 h-0.5 bg-[#E4C670]/80 shadow-md shadow-[#E4C670] animate-bounce top-3 bottom-3 z-20 pointer-events-none" />
                    )}

                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrisCode || '000201010212')}`}
                      alt="Dynamic QRIS Code"
                      referrerPolicy="no-referrer"
                      className={`w-full h-full object-contain ${paymentStatus === "processing" ? "opacity-30 blur-[2px]" : ""} transition-all duration-300`}
                    />

                    {paymentStatus === "processing" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-white/80 backdrop-blur-xs rounded-[14px] z-30">
                        <div className="w-8 h-8 border-3 border-[#2C4E35] border-t-transparent rounded-full animate-spin mb-2" />
                        <p className="text-[10px] font-extrabold text-neutral-800 uppercase tracking-widest font-sans">
                          Verifikasi Dana
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-neutral-500 font-sans font-medium leading-relaxed max-w-[250px]">
                    Scan pakai GoPay / aplikasi apa pun yang mendukung QRIS.
                  </p>

                  <div className="w-full bg-[#F3F6F4] text-[#2C4E35] rounded-[10px] px-4 py-3.5 flex items-center gap-3 border border-[#E1EAE3] shadow-xs">
                    <div className="w-4.5 h-4.5 rounded-full border-2 border-[#2C4E35] border-t-transparent animate-spin shrink-0" />
                    <p className="text-[11px] font-sans font-medium text-left leading-normal flex-1">
                      Menunggu pembayaran... status terupdate otomatis <span className="font-bold">· sisa {formatTime(paymentTimer)}.</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-neutral-400 mt-0.5">
                    <ShieldCheck className="w-4 h-4 text-neutral-400" />
                    <span className="text-[10px] font-sans font-semibold tracking-wide uppercase">
                      Pembayaran QRIS aman & terenkripsi
                    </span>
                  </div>

                </div>

                <div className="bg-neutral-900/80 border border-neutral-850 rounded-[14px] p-4 flex flex-col gap-2.5">
                  <div className="flex flex-col text-center">
                    <span className="text-[9px] font-mono text-[#E4C670] uppercase tracking-wider font-semibold">
                      ⚡ Simulator Sandbox
                    </span>
                    <p className="text-[10px] text-neutral-400 leading-relaxed">
                      Lakukan simulasi pembayaran sukses instan untuk uji coba flow checkout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={triggerManualSuccess}
                    disabled={paymentStatus === "processing"}
                    className="w-full bg-[#E4C670] hover:bg-[#D3B45F] disabled:bg-neutral-800 text-neutral-950 font-black text-[11px] py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <CheckCircle2 className="w-4.5 h-4.5 text-neutral-950 fill-neutral-950/20" />
                    Simulasi Pembayaran Sukses (Instan)
                  </button>
                </div>

                <p className="text-[10px] text-neutral-500 text-center leading-relaxed">
                  Apabila dana sudah terpotong namun status belum berubah dalam 1 menit, harap simpan screenshot bukti transfer dan hubungi CS kami.
                </p>

              </motion.div>
            )}

            {screen === "receipt" && (
              <motion.div
                key="receipt"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.35, type: "spring", stiffness: 120 }}
                className="flex flex-col px-4 pt-4 pb-12 gap-5"
              >

                <div className="flex flex-col items-center text-center mt-6 gap-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.2)] animate-pulse">
                    <Check className="w-9 h-9 stroke-[3]" />
                  </div>
                  <h2 className="font-display text-2xl font-black tracking-tight text-white mt-1">
                    Pesanan Terkonfirmasi!
                  </h2>
                  <p className="text-xs text-neutral-400 max-w-[280px] leading-relaxed">
                    Terima kasih, <span className="text-white font-semibold">{userName}</span>! Pembayaran sebesar <span className="text-[#E4C670] font-semibold">{formatIDR(grandTotal)}</span> telah berhasil diterima dan pesanan Anda sedang kami proses.
                  </p>
                </div>

                <div className="bg-white text-neutral-900 rounded-[14px] overflow-hidden shadow-2xl border border-neutral-100 flex flex-col relative">

                  <div className="h-2 w-full bg-gradient-to-r from-[#E4C670] via-neutral-950 to-[#E4C670]" />

                  <div className="p-5 flex flex-col gap-4">

                    <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                      <div>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase font-mono tracking-widest">KODE TRANSAKSI (INVOICE)</p>
                        <p className="font-mono text-sm font-black text-neutral-900 mt-0.5 flex items-center gap-1">
                          {transactionId}
                          <button
                            onClick={() => copyToClipboard(transactionId, "Invoice ID")}
                            className="text-neutral-400 hover:text-neutral-800 transition-colors p-0.5 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </p>
                      </div>
                      <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest font-mono">
                        LUNAS
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 bg-neutral-50 rounded-2xl p-3 border border-neutral-100/50">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase font-mono">METODE PENGAMBILAN</span>
                      <p className="font-display text-xs font-black text-neutral-850 mt-1 leading-snug">
                        {deliveryMethodLabel}
                      </p>
                      <p className="text-[11px] text-neutral-500 leading-normal mt-0.5">
                        {deliveryMethod === "pickup"
                          ? "Dapur Mamah Hemat"
                          : `${selectedDeliveryArea?.label ?? ""} — ${deliveryDetail.trim()}`}
                      </p>
                      {deliveryMethod === "delivery" && deliveryMapLink.trim() && (
                        <a
                          href={deliveryMapLink.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#B27041] font-semibold flex items-center gap-1 mt-0.5 hover:underline"
                        >
                          <Link2 className="w-3 h-3" />
                          Buka link lokasi
                        </a>
                      )}
                      <div className="mt-2 pt-2 border-t border-neutral-200/60 flex items-center justify-between text-xs">
                        <span className="font-medium text-neutral-500">
                          {deliveryMethod === "pickup" ? "Info Ambil:" : "Estimasi:"}
                        </span>
                        <span className="font-extrabold text-neutral-900 bg-[#E4C670]/20 px-2 py-0.5 rounded">
                          {deliveryMethod === "pickup" ? "Saat dapur buka" : "Sameday, ikuti antrian dapur"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase font-mono">📋 RINCIAN MENU</span>
                      <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {cart.map((cartItem) => (
                          <div key={cartItem.item.id} className="flex items-center justify-between text-xs">
                            <span className="text-neutral-700">
                              {cartItem.item.name} <span className="font-mono text-[11px] text-neutral-400">({cartItem.quantity}x)</span>
                            </span>
                            <span className="font-mono text-neutral-800 font-semibold">
                              {formatIDR(cartItem.item.price * cartItem.quantity)}
                            </span>
                          </div>
                        ))}

                        {selectedAddOns.map((addOnId) => {
                          const addOn = addOnsList.find((a) => a.id === addOnId);
                          if (!addOn) return null;
                          return (
                            <div key={addOnId} className="flex items-center justify-between text-xs">
                              <span className="text-neutral-600 flex items-center gap-0.5">
                                {addOn.name} <span className="text-[9px] bg-neutral-100 text-neutral-500 px-1 rounded">Addon</span>
                              </span>
                              <span className="font-mono text-neutral-800">
                                {formatIDR(addOn.price)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-dashed border-neutral-200 pt-3 flex flex-col gap-1">
                     
                      {deliveryMethod === "delivery" && (
                        <div className="flex items-center justify-between text-xs text-neutral-500">
                          <span>Ongkos Kirim ({selectedDeliveryArea?.label ?? "-"})</span>
                          <span className="text-neutral-800 font-mono font-semibold">{formatIDR(deliveryFee)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 text-sm font-extrabold text-neutral-900">
                        <span>Total yang Dibayar</span>
                        <span className="font-display font-black text-base text-neutral-950">
                          {formatIDR(grandTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-neutral-100 pt-3 text-[10px] text-neutral-500 flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span>Nama Pemesan:</span>
                        <span className="font-bold text-neutral-800">{userName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>No. WhatsApp:</span>
                        <span className="font-bold text-neutral-800 font-mono">+62 {userPhone}</span>
                      </div>
                      {userNotes.trim() && (
                        <div className="flex flex-col gap-0.5 mt-1 bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                          <span className="font-bold uppercase text-[8px] text-neutral-400">Catatan Khusus Kitchen:</span>
                          <p className="text-neutral-600 leading-normal text-[10px] italic">
                            "{userNotes}"
                          </p>
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="relative h-4 bg-neutral-100 flex items-center justify-between px-1">
                    <div className="absolute -left-3 w-6 h-6 rounded-full bg-neutral-950" />
                    <div className="w-full border-t border-dashed border-neutral-300" />
                    <div className="absolute -right-3 w-6 h-6 rounded-full bg-neutral-950" />
                  </div>

                  <div className="p-5 bg-neutral-50 flex flex-col gap-3">
                    <div className="text-center">
                      <p className="text-[11px] text-neutral-500 leading-relaxed font-sans">
                        Struk digital ini juga telah otomatis terkirim ke WhatsApp Anda. Silakan sebutkan Invoice ID saat konfirmasi pesanan dengan admin kami.
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-1 py-1">
                      <div className="w-24 h-24 bg-white p-1 border border-neutral-200 rounded-lg shadow-sm">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${transactionId}`}
                          alt="Pickup QR"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] font-mono font-bold text-neutral-400 tracking-wider">CODE: {transactionId}</span>
                    </div>

                    <a
                      href={`https://wa.me/6281234567890?text=Halo%20Mamah%20Hemat,%20saya%20sudah%20melakukan%20pembayaran%20untuk%20Invoice%20${transactionId}%20sebesar%20${grandTotal}.%20Mohon%20segera%20diproses%20ya.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-neutral-900 text-[#E4C670] hover:bg-neutral-800 font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-[#E4C670]/20 cursor-pointer"
                    >
                      <span>Hubungi CS WhatsApp</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                </div>

                <button
                  onClick={() => {
                    setCart([]);
                    setSelectedAddOns([]);
                    setDeliveryAreaId("");
                    setDeliveryDetail("");
                    setDeliveryMapLink("");
                    setScreen("catalog");
                  }}
                  className="w-full bg-[#E4C670] hover:bg-[#D3B45F] text-black font-extrabold text-xs py-3.5 rounded-2xl shadow-md transition-all cursor-pointer"
                >
                  Pesan Menu Baru Lagi
                </button>

              </motion.div>
            )}

          </AnimatePresence>

        </div>

        {screen === "catalog" && cart.length > 0 && (
          <div className="absolute bottom-4 inset-x-4 z-40">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-neutral-900/95 border border-[#E4C670]/30 rounded-[16px] p-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3"
            >
              <div className="flex flex-col pl-2">
                <span className="text-[9px] text-neutral-400 font-bold uppercase font-mono tracking-wider">
                  Total {totalCartItems} Menu Pilihan
                </span>
                <span className="text-sm font-display font-extrabold text-[#E4C670]">
                  {formatIDR(subtotalCart)}
                </span>
              </div>

              <button
                onClick={handleProceedToCheckout}
                className="bg-[#E4C670] hover:bg-[#D3B45F] text-black font-bold text-xs py-2.5 px-5 rounded-2xl flex items-center gap-1.5 shadow-md shadow-[#E4C670]/20 transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>Lihat Pesanan</span>
              </button>
            </motion.div>
          </div>
        )}

        {screen === "checkout" && cart.length > 0 && (
          <div className="absolute bottom-4 inset-x-4 z-40">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-neutral-900/95 border border-[#E4C670]/20 rounded-[16px] p-3 shadow-2xl backdrop-blur-md"
            >
              <button
                type="button"
                onClick={() => formRef.current?.requestSubmit()}
                className="w-full bg-[#E4C670] hover:bg-[#D3B45F] active:scale-[0.98] text-neutral-950 font-extrabold text-[12.5px] py-3.5 px-5 rounded-2xl shadow-lg transition-all duration-200 flex items-center justify-between border border-[#E4C670]/10 cursor-pointer"
              >
                <span className="font-display">Lanjut bayar</span>
                <span className="font-display font-black">
                  {formatIDR(grandTotal)}
                </span>
              </button>
            </motion.div>
          </div>
        )}

      </main>
    </div>
  );
}
