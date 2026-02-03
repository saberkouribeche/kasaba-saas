"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, writeBatch, doc, increment, query, where, orderBy, limit } from "firebase/firestore";
import { X, Trash2, ShoppingBag, ArrowRight, CheckCircle, MapPin, Phone, User as UserIcon, Home, FileText, Clock } from "lucide-react";
import { notify } from "@/lib/notify";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

export default function CartDrawer() {
  const { cart, removeFromCart, cartTotal, isDrawerOpen, setIsDrawerOpen, setCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  // Lock Body Scroll when Drawer is Open
  useLockBodyScroll(isDrawerOpen);

  const [step, setStep] = useState("cart");
  const [loading, setLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState(null);

  // Zones State
  const [zones, setZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState(0);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    zone: "",
    addressDetails: "",
    deliveryTime: "", // New Field
    deliveryType: "delivery", // 'delivery' | 'pickup'
    notes: ""
  });

  // Performance Optimization: Cache for today's order count (for restaurant delivery limits)
  const [todayOrdersCount, setTodayOrdersCount] = useState(null);
  const lastCheckedUser = useRef(null);

  // Fetch Zones
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const snapshot = await getDocs(collection(db, "delivery_zone"));

        let data = [];
        if (!snapshot.empty) {
          data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Fallback if no data (e.g. permission denied or empty DB)
        if (data.length === 0) {
          console.warn("Using fallback zones");
          data = [
            { id: "f1", zone_name: "قورصو", price: 300 },
            { id: "f2", zone_name: "بومرداس المركز", price: 400 },
            { id: "f3", zone_name: "بودواو", price: 500 },
            { id: "f4", zone_name: "تيجلابين", price: 500 },
            { id: "f5", zone_name: "الثنية", price: 600 }
          ];
        }

        setZones(data);
        setLoadingZones(false);

        // Set default if exists
        if (data.length > 0 && !formData.zone) {
          setFormData(prev => ({ ...prev, zone: data[0].zone_name }));
          setDeliveryFee(data[0].price);
        }
      } catch (error) {
        console.error("Error fetching zones", error);
        // Apply fallback on error too
        const fallbackData = [
          { id: "f1", zone_name: "قورصو", price: 300 },
          { id: "f2", zone_name: "بومرداس المركز", price: 400 },
          { id: "f3", zone_name: "بودواو", price: 500 },
          { id: "f4", zone_name: "تيجلابين", price: 500 },
          { id: "f5", zone_name: "الثنية", price: 600 }
        ];
        setZones(fallbackData);
        setLoadingZones(false);
        if (!formData.zone) {
          setFormData(prev => ({ ...prev, zone: fallbackData[0].zone_name }));
          setDeliveryFee(fallbackData[0].price);
        }
      }
    };
    fetchZones();
  }, []);

  // Update Fee when Zone or User Changes (with Free Delivery Limits)
  useEffect(() => {
    const calculateFee = async () => {
      let baseFee = 0;
      const selected = zones.find(z => z.zone_name === formData.zone);

      // Pickup Logic
      if (formData.deliveryType === 'pickup') {
        setDeliveryFee(0);
        return;
      }

      // Default Base Fee
      if (selected) baseFee = selected.price;

      // Smart Delivery Logic for Restaurants
      if (user?.role === 'restaurant' && user?.phone) {
        try {
          // 1. Get limit from user (default 1)
          const freeLimit = user.freeDeliveriesPerDay || 1;

          // 2. Count today's orders (with caching for performance)
          let ordersToday = todayOrdersCount;

          if (ordersToday === null || lastCheckedUser.current !== user.phone) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const q = query(
              collection(db, "order"),
              where("user_id", "==", user.phone),
              orderBy("created_at", "desc"),
              limit(10)
            );

            const snap = await getDocs(q);
            ordersToday = 0;
            snap.forEach(d => {
              const data = d.data();
              if (data.created_at) {
                const date = data.created_at.toDate();
                if (date >= today) ordersToday++;
              }
            });

            setTodayOrdersCount(ordersToday);
            lastCheckedUser.current = user.phone;
          }

          if (ordersToday < freeLimit) {
            setDeliveryFee(0); // Free
          } else {
            setDeliveryFee(200); // Fixed 200 DA as requested
          }
          return; // Exit, don't use baseFee

        } catch (e) {
          console.error("Delivery calc error", e);
          // Fallback to base
        }
      }

      // Default Customer (Non-Restaurant) or Fallback
      setDeliveryFee(baseFee);
    };

    calculateFee();
  }, [formData.zone, zones, user, formData.deliveryType]);

  // Time Slots
  const timeSlots = [
    { id: "morning", label: "صباحاً", time: "08:00 - 10:00", icon: "🌅" },
    { id: "noon", label: "ظهراً", time: "10:00 - 13:00", icon: "☀️" },
    { id: "afternoon", label: "بعد الظهر", time: "13:00 - 16:00", icon: "🌤️" },
    { id: "evening", label: "مساءً", time: "16:00 - 20:00", icon: "🌙" }
  ];

  // Auto-fill form
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.fullName || "",
        phone: user.phone || "",
        zone: user.zone || "",
        addressDetails: user.addressDetails || ""
      }));
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name?.trim()) {
      notify.error("يرجى إدخال الاسم الكامل");
      return;
    }
    if (!formData.phone?.trim()) {
      notify.error("يرجى إدخال رقم الهاتف");
      return;
    }
    // Phone format validation
    if (!/^(0)(5|6|7)[0-9]{8}$/.test(formData.phone.replace(/\s/g, ''))) {
      notify.error("رقم الهاتف غير صحيح (يجب أن يبدأ بـ 05، 06، أو 07)");
      return;
    }

    // Validation for Delivery Only (Skip for Restaurants - they have zone pre-set)
    if (formData.deliveryType === 'delivery' && user?.role !== 'restaurant') {
      if (!formData.zone) {
        notify.error("يرجى اختيار المنطقة");
        return;
      }
    }

    // Time Validation
    if (!formData.deliveryTime) {
      notify.error("يرجى تحديد وقت الاستلام/التوصيل");
      return;
    }

    setLoading(true);

    try {
      // 1. Prepare Order Data
      const finalTotal = cartTotal + deliveryFee;

      const orderData = {
        // order_number: Generated on Server
        user_id: user ? user.phone : null,
        customer_name: formData.name,
        customer_phone: formData.phone,
        delivery_type: formData.deliveryType, // Save type
        delivery_area: formData.deliveryType === 'pickup' ? 'استلام من المحل' : formData.zone,
        delivery_address_details: formData.deliveryType === 'pickup' ? 'استلام من المحل' : formData.addressDetails,
        delivery_time_slot: formData.deliveryTime,
        order_notes: formData.notes,
        order_items: cart.map(item => ({
          id: item.id, // Important for backend
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          isBundle: item.isBundle || false,
          bundleComponents: item.bundleComponents || [],
          options: item.options // Keep options for record
        })),
        subtotal: cartTotal,
        delivery_fee: deliveryFee,
        order_total: finalTotal,
        order_status: 'pending'
        // created_at will be set by server
      };

      // 2. Submit to API (Server-Side Processing)
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderData })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "فشل معالجة الطلب");
      }

      // Success

      // 1. Critical: Clear the global cart state immediately
      setCart([]);
      localStorage.removeItem("kasaba_cart");

      setIsDrawerOpen(false);

      // 2. Critical: Use REPLACE to prevent going back to the checkout form
      router.replace(`/success?orderId=${result.orderNumber}&amount=${finalTotal}`);

      notify.success("تم استلام طلبك بنجاح");

    } catch (error) {
      console.error("Error submitting order:", error);
      notify.error("حدث خطأ أثناء الإرسال. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const grandTotal = cartTotal + deliveryFee;

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start md:items-stretch md:justify-end">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsDrawerOpen(false)}
      ></div>

      <div className="relative w-full md:max-w-md bg-white shadow-2xl flex flex-col overflow-hidden 
        h-[100dvh] md:h-full 
        rounded-none md:rounded-l-3xl 
        animate-slide-up md:animate-slide-in">

        {/* Header */}
        <div className="p-6 pb-4 flex justify-between items-center bg-white sticky top-0 z-10 border-b border-slate-50">
          <h2 className="font-black text-xl text-slate-800 flex items-center gap-2">
            {step === "cart" && "سلة المشتريات"}
            {step === "checkout" && <button onClick={() => setStep("cart")} className="hover:bg-slate-100 p-1 rounded-full"><ArrowRight /></button>}
            {step === "checkout" && "إتمام الطلب"}
            {step === "success" && <span className="text-green-600">تم العملية بنجاح!</span>}
          </h2>
          <button onClick={() => setIsDrawerOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 pt-2 no-scrollbar" style={{ overscrollBehavior: 'contain' }}>

          {step === "cart" && (
            <div className="space-y-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center mt-20 opacity-50">
                  <ShoppingBag size={32} className="text-slate-400 mb-4" />
                  <p className="font-bold text-slate-500">السلة فارغة حالياً</p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div key={index} className="flex gap-4 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition">
                    <img src={item.img} alt={item.title} className="w-20 h-20 rounded-xl object-cover bg-slate-50" />
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>


                        {/* Totals */}
                        <h3 className="font-bold text-slate-800">{item.title}</h3>
                        <div className="text-slate-400 text-xs font-bold">
                          {item.isLandingPage ? (
                            <span>{item.quantity} قطعة</span>
                          ) : (
                            <span>{Number(item.quantity).toFixed(2)} كجم</span>
                          )}
                          {item.options && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {typeof item.options === 'object'
                                ? Object.values(item.options).map((val, i) => <span key={i} className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{val}</span>)
                                : <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{item.options}</span>
                              }
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-end">
                        <p className="text-red-600 font-black">{(item.price * item.quantity).toFixed(0)} دج</p>
                        <button onClick={() => removeFromCart(index)} className="text-slate-300 hover:text-red-500 transition">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {step === "checkout" && (
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              {user && (
                <div className="bg-blue-50 p-3 rounded-xl flex items-center gap-2 text-blue-700 text-sm font-bold border border-blue-100 mb-2">
                  <UserIcon size={16} /> مرحباً {user.fullName} {user.role === 'restaurant' && <span className="bg-blue-200 px-2 rounded-md text-[10px]">حساب مطعم</span>}
                </div>
              )}

              {/* Delivery Type Toggle */}
              <div className="bg-slate-100 p-1.5 rounded-2xl flex font-bold text-sm gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, deliveryType: 'delivery' })}
                  className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-center transition-all ${formData.deliveryType === 'delivery' ? 'bg-red-600 text-black shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
                >
                  <span>🛵 توصيل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, deliveryType: 'pickup' })}
                  className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-center transition-all ${formData.deliveryType === 'pickup' ? 'bg-red-600 text-black shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
                >
                  <span>🏪 الاستلام من المحل</span>
                </button>
              </div>

              {/* Personal Info & Address - Hidden for Restaurants (B2B) */}
              {user?.role === 'restaurant' ? (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold">العميل:</span>
                    <span className="font-black text-slate-800">{user.fullName}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold">المنطقة:</span>
                    <span className="font-black text-slate-800">{user.zone || formData.zone}</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Standard Checkout Fields */}
                  <div className="space-y-3">
                    <div className="relative">
                      <UserIcon className="absolute right-4 top-4 text-slate-400" size={18} />
                      <input required type="text" className="w-full pl-4 pr-11 py-4 bg-slate-50 border-none rounded-2xl text-slate-800 font-bold placeholder-slate-400 focus:ring-2 focus:ring-red-500 outline-none" placeholder="الاسم الكامل" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div className="relative">
                      <Phone className="absolute right-4 top-4 text-slate-400" size={18} />
                      <input required type="tel" className="w-full pl-4 pr-11 py-4 bg-slate-50 border-none rounded-2xl text-slate-800 font-bold placeholder-slate-400 focus:ring-2 focus:ring-red-500 outline-none text-right" placeholder="الموبايل" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} dir="rtl" />
                    </div>
                  </div>

                  {/* Address Section - Only for Delivery */}
                  {formData.deliveryType === 'delivery' && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4 animate-fade-in">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                          <MapPin size={18} />
                        </div>
                        <label className="text-sm font-black text-slate-800">العنوان والتوصيل</label>
                      </div>

                      <div className="relative">
                        <select
                          className="w-full p-4 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold outline-none focus:ring-2 focus:ring-red-500 appearance-none"
                          value={formData.zone}
                          onChange={e => setFormData({ ...formData, zone: e.target.value })}
                        >
                          {zones.map(z => <option key={z.id} value={z.zone_name}>{z.zone_name} - {z.price} دج</option>)}
                        </select>
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <ArrowRight size={16} className="rotate-90" />
                        </div>
                      </div>

                    </div>
                  )}
                </>
              )}

              {/* Delivery Time Selection */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                    <Clock size={18} />
                  </div>
                  <label className="text-sm font-black text-slate-800">
                    {formData.deliveryType === 'delivery' ? 'وقت التوصيل المفضل' : 'وقت الاستلام من المحل'}
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {timeSlots.map(slot => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, deliveryTime: slot.time });
                        setShowTimePicker(false);
                      }}
                      className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1
                        ${formData.deliveryTime === slot.time && !showTimePicker
                          ? 'bg-slate-800 text-white border-slate-800 shadow-lg transform scale-[1.02]'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                    >
                      <span className="text-2xl mb-1">{slot.icon}</span>
                      <span className="text-xs font-bold opacity-90">{slot.label}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${formData.deliveryTime === slot.time ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`} dir="ltr">{slot.time}</span>
                    </button>
                  ))}

                  {/* Custom Time Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowTimePicker(true);
                      setFormData({ ...formData, deliveryTime: "" }); // Reset to force pick
                    }}
                    className={`col-span-2 p-3 rounded-xl border text-center transition flex flex-row items-center justify-center gap-2
                        ${showTimePicker
                        ? 'bg-slate-800 text-white border-slate-800 shadow-lg'
                        : 'bg-white text-slate-600 border-slate-200 border-dashed hover:border-slate-300'}`}
                  >
                    <Clock size={16} />
                    <span className="text-xs font-bold">تحديد وقت دقيق آخر</span>
                  </button>

                  {showTimePicker && (
                    <div className="col-span-2 animate-fade-in">
                      <input
                        type="time"
                        className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-center text-slate-800 focus:border-red-500 outline-none"
                        value={formData.deliveryTime.includes('-') ? '' : formData.deliveryTime} // Clear if it was a range
                        onChange={(e) => setFormData({ ...formData, deliveryTime: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <FileText className="absolute right-4 top-4 text-slate-400" size={18} />
                <textarea className="w-full pl-4 pr-11 py-4 bg-slate-50 border-none rounded-2xl text-slate-800 font-bold placeholder-slate-400 focus:ring-2 focus:ring-red-500 outline-none resize-none transition focus:bg-white focus:shadow-sm" rows="2" placeholder="ملاحظات إضافية (اختياري)" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}></textarea>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions / Price Breakdown */}
        {step !== "success" && cart.length > 0 && (
          <div className="p-6 pt-4 border-t border-slate-50 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-20">

            {/* Breakdown */}
            {step === "checkout" && (
              <div className="space-y-2 mb-4 text-sm font-medium text-slate-500 border-b border-dashed pb-4">
                <div className="flex justify-between">
                  <span>مجموع المنتجات</span>
                  <span className="font-bold text-slate-800">{cartTotal.toLocaleString()} دج</span>
                </div>
                <div className="flex justify-between">
                  <span>تكلفة التوصيل ({formData.zone})</span>
                  <span className="font-bold text-slate-800">{deliveryFee.toLocaleString()} دج</span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-end mb-4">
              <span className="text-slate-500 font-bold text-sm">الإجمالي النهائي</span>
              <span className="text-2xl font-black text-red-600">
                {step === "checkout" ? grandTotal.toLocaleString() : cartTotal.toLocaleString()}
                <span className="text-sm font-medium text-slate-400"> دج</span>
              </span>
            </div>

            {step === "cart" ? (
              <button
                onClick={() => {
                  setStep("checkout");
                  // Pixel: InitiateCheckout
                  import('react-facebook-pixel')
                    .then((x) => x.default)
                    .then((ReactPixel) => {
                      ReactPixel.track('InitiateCheckout', {
                        currency: 'DZD',
                        value: cartTotal
                      });
                    });
                }}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition flex items-center justify-center gap-2">
                متابعة للدفع <ArrowRight size={18} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-green-600/20 hover:bg-green-700 transition disabled:bg-slate-300 flex justify-center items-center gap-2">
                {loading ? "جاري الإرسال..." : "تأكيد الطلب نهائياً"}
              </button>
            )}
          </div>
        )}
      </div>
    </div >
  );
}